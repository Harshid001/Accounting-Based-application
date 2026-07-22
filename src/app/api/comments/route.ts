import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateEntityAccess, validateMentions } from "@/lib/comments";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const parentType = searchParams.get("parentType");
    const parentId = searchParams.get("parentId");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10)));

    // CLIENT role: only allow fetching comments for their own client entity
    if (session.user.role === "CLIENT") {
      const userClientId = (session.user as any).clientId;
      if (!userClientId) {
        return NextResponse.json({ error: "No client association" }, { status: 403 });
      }

      // If no parentType/parentId, return all comments scoped to their client
      if (!parentType || !parentId) {
        const [comments, total] = await Promise.all([
          prisma.comment.findMany({
            where: { clientId: userClientId },
            include: { User: { select: { id: true, name: true } } },
            orderBy: { createdAt: "asc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          prisma.comment.count({ where: { clientId: userClientId } }),
        ]);
        return NextResponse.json({ data: comments, pagination: { page, pageSize, total } });
      }

      // Validate they own the entity before returning comments
      try {
        const userId = session.user.id || (session.user as any).userId;
        await validateEntityAccess(userId, session.user.role, parentType, parentId);
      } catch {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Build query
    const where: any = {};
    if (parentType && parentId) {
      if (parentType === "task") where.taskId = parentId;
      else if (parentType === "client") where.clientId = parentId;
      else if (parentType === "document") where.documentId = parentId;
      else if (parentType === "complianceItem") where.complianceItemId = parentId;
      else if (parentType === "invoice") where.invoiceId = parentId;
      else return NextResponse.json({ error: "Invalid parent type" }, { status: 400 });
    }

    const { role, id: userId } = session.user;
    
    // Non-ADMIN staff must be scoped to their assigned clients
    if (role === "ACCOUNTANT" || role === "MANAGER" || role === "DATA_ENTRY") {
      const assignedClients = await prisma.client.findMany({
        where: { assignedTo: { some: { id: userId } } },
        select: { id: true }
      });
      const assignedIds = assignedClients.map(c => c.id);
      
      // We ensure the comments they fetch are linked to their assigned clients.
      // (For firm-level tasks where clientId is null, they can still see them since they are internal staff,
      // so we use an OR clause: either clientId is in assignedIds, or clientId is null)
      where.OR = [
        { clientId: { in: assignedIds } },
        { clientId: null }
      ];
    }

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        include: { User: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.comment.count({ where }),
    ]);

    return NextResponse.json({ data: comments, pagination: { page, pageSize, total } });
  } catch (error: any) {
    console.error("Failed to list comments:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const userRole = session.user.role;

    const body = await req.json();
    const { content, parentType, parentId, mentions } = body;

    if (!content || !parentType || !parentId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Validate Access
    await validateEntityAccess(userId, userRole, parentType, parentId);

    // 2. Validate Mentions (strip out those who shouldn't see this entity)
    let validMentions: string[] = [];
    if (mentions && Array.isArray(mentions)) {
      validMentions = await validateMentions(mentions, parentType, parentId);
    }

    // 3. Map parentType to specific FK field
    const createData: any = {
      content,
      authorId: userId,
      mentions: validMentions
    };
    
    if (parentType === "task") createData.taskId = parentId;
    else if (parentType === "client") createData.clientId = parentId;
    else if (parentType === "document") createData.documentId = parentId;
    else if (parentType === "complianceItem") createData.complianceItemId = parentId;
    else if (parentType === "invoice") createData.invoiceId = parentId;
    else return NextResponse.json({ error: "Invalid parent type" }, { status: 400 });

    // 4. Create in Transaction with AuditLog and Notifications
    const result = await prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({ data: createData });

      await tx.auditLog.create({
        data: {
          entityType: "Comment",
          entityId: comment.id,
          action: "CREATE",
          userId: userId,
          diff: { content, parentType, parentId }
        }
      });

      // N+1 FIX: Batch-create mention notifications with createMany
      // instead of sequential creates in a loop
      if (validMentions.length > 0) {
        await tx.notification.createMany({
          data: validMentions.map(mentionedUid => ({
            recipientId: mentionedUid,
            type: "GENERAL" as const,
            channel: "IN_APP" as const,
          })),
        });
      }

      return comment;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create comment:", error);
    if (error.message && error.message.startsWith("FORBIDDEN")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.code === "P2010" || (error.meta && error.meta.message && error.meta.message.includes("check_single_parent"))) {
       return NextResponse.json({ error: "Database constraint violation on parent IDs" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
