import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";
import { withAuth, validateBody } from "@/lib/api/withAuth";
import { createCommentSchema, commentFiltersSchema } from "@/lib/api/validators";
import { validateEntityAccess, validateMentions } from "@/lib/comments";
import { Prisma } from "@prisma/client";

type Role = typeof ROLES[keyof typeof ROLES];

function buildCommentWhereClause(
  userRole: Role,
  userId: string,
  parentType?: string | null,
  parentId?: string | null
): Prisma.CommentWhereInput {
  const where: Prisma.CommentWhereInput = {};

  if (parentType && parentId) {
    switch (parentType) {
      case "task":
        where.taskId = parentId;
        break;
      case "client":
        where.clientId = parentId;
        break;
      case "document":
        where.documentId = parentId;
        break;
      case "complianceItem":
        where.complianceItemId = parentId;
        break;
      case "invoice":
        where.invoiceId = parentId;
        break;
      default:
        throw new Error("Invalid parent type");
    }
  }

  if (userRole === ROLES.CLIENT) {
    where.clientId = userId;
  } else if (
    userRole === ROLES.ACCOUNTANT ||
    userRole === ROLES.MANAGER ||
    userRole === ROLES.DATA_ENTRY
  ) {
    where.OR = [
      { clientId: { in: [] } }, // Will be replaced below
      { clientId: null },
    ];
  }

  return where;
}

export const GET = withAuth(async (req: NextRequest, { user, prisma }) => {
  const { searchParams } = new URL(req.url);
  const filters = commentFiltersSchema.parse({
    page: searchParams.get("page"),
    pageSize: searchParams.get("pageSize"),
    parentType: searchParams.get("parentType"),
    parentId: searchParams.get("parentId"),
  });

  const userRole = user.role as Role;
  const userId = user.id;

  if (userRole === ROLES.CLIENT) {
    if (!user.clientId) {
      return NextResponse.json({ error: "No client association" }, { status: 403 });
    }

    if (!filters.parentType || !filters.parentId) {
      const [comments, total] = await Promise.all([
        prisma.comment.findMany({
          where: { clientId: user.clientId },
          include: { User: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
          skip: (filters.page - 1) * filters.pageSize,
          take: filters.pageSize,
        }),
        prisma.comment.count({ where: { clientId: user.clientId } }),
      ]);
      return NextResponse.json({ data: comments, pagination: { page: filters.page, pageSize: filters.pageSize, total } });
    }

    try {
      await validateEntityAccess(userId, userRole, filters.parentType, filters.parentId);
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let where = buildCommentWhereClause(userRole, userId, filters.parentType, filters.parentId);

  if (
    userRole === ROLES.ACCOUNTANT ||
    userRole === ROLES.MANAGER ||
    userRole === ROLES.DATA_ENTRY
  ) {
    const assignedClients = await prisma.client.findMany({
      where: { assignedTo: { some: { id: userId } } },
      select: { id: true },
    });
    const assignedIds = assignedClients.map((c) => c.id);
    where.OR = [{ clientId: { in: assignedIds } }, { clientId: null }];
  }

  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where,
      include: { User: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.comment.count({ where }),
  ]);

  return NextResponse.json({ data: comments, pagination: { page: filters.page, pageSize: filters.pageSize, total } });
});

export const POST = withAuth(async (req: NextRequest, { user, prisma }) => {
  const body = await req.json();
  const validated = validateBody(body, createCommentSchema);

  const { content, parentType, parentId, mentions } = validated;
  const userId = user.id;
  const userRole = user.role as Role;

  await validateEntityAccess(userId, userRole, parentType, parentId);

  let validMentions: string[] = [];
  if (mentions && mentions.length > 0) {
    validMentions = await validateMentions(mentions, parentType, parentId);
  }

  const createData: Record<string, any> = {
    content,
    authorId: userId,
    mentions: validMentions,
  };

  switch (parentType) {
    case "task":
      createData.taskId = parentId;
      break;
    case "client":
      createData.clientId = parentId;
      break;
    case "document":
      createData.documentId = parentId;
      break;
    case "complianceItem":
      createData.complianceItemId = parentId;
      break;
    case "invoice":
      createData.invoiceId = parentId;
      break;
    default:
      return NextResponse.json({ error: "Invalid parent type" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const comment = await tx.comment.create({ data: createData as any });

    await tx.auditLog.create({
      data: {
        entityType: "Comment",
        entityId: comment.id,
        action: "CREATE",
        userId,
        diff: { content, parentType, parentId },
      },
    });

    if (validMentions.length > 0) {
      await tx.notification.createMany({
        data: validMentions.map((mentionedUid) => ({
          recipientId: mentionedUid,
          type: "GENERAL",
          channel: "IN_APP",
        })),
      });
    }

    return comment;
  });

  return NextResponse.json(result, { status: 201 });
});