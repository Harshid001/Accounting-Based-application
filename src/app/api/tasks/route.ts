import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { ROLES } from "@/lib/permissions";
import { withAuth, validateBody } from "@/lib/api/withAuth";
import { createTaskSchema, taskFiltersSchema } from "@/lib/api/validators";

type Role = typeof ROLES[keyof typeof ROLES];

function taskScopeWhere(user: { id: string; role: string }) {
  const userRole = user.role as Role;
  if (userRole === ROLES.ADMIN) return null;
  if (userRole === ROLES.MANAGER) {
    return {
      OR: [
        { assignedToId: user.id },
        { client: { assignedTo: { some: { id: user.id } } } },
      ],
    };
  }
  return { assignedToId: user.id };
}

export const GET = withAuth(async (req: NextRequest, { user, prisma }) => {
  const { searchParams } = new URL(req.url);
  const filters = taskFiltersSchema.parse({
    page: searchParams.get("page"),
    pageSize: searchParams.get("pageSize"),
    clientId: searchParams.get("clientId"),
    status: searchParams.get("status"),
  });

  const userRole = user.role as Role;
  const scope = taskScopeWhere(user);

  const whereClause: Prisma.TaskWhereInput & { AND?: Prisma.TaskWhereInput[] } = { AND: [] };
  if (scope) whereClause.AND!.push(scope);
  if (filters.clientId) whereClause.AND!.push({ clientId: filters.clientId });
  if (filters.status) whereClause.AND!.push({ status: filters.status });
  if (whereClause.AND!.length === 0) delete whereClause.AND;

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where: whereClause,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        client: { select: { id: true, name: true } },
        complianceItem: { select: { id: true, type: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.task.count({ where: whereClause }),
  ]);

  return NextResponse.json({ data: tasks, pagination: { page: filters.page, pageSize: filters.pageSize, total } });
});

export const POST = withAuth(async (req: NextRequest, { user, prisma }) => {
  const userRole = user.role as Role;
  const userId = user.id;

  if (userRole !== ROLES.ADMIN && userRole !== ROLES.MANAGER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const validated = validateBody(body, createTaskSchema);

  const task = await prisma.$transaction(async (tx) => {
    const newTask = await tx.task.create({
      data: {
        title: validated.title,
        description: validated.description,
        assignedToId: validated.assignedToId,
        clientId: validated.clientId ?? null,
        complianceItemId: validated.complianceItemId ?? null,
        dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
      },
    });

    await tx.auditLog.create({
      data: {
        entityType: "Task",
        entityId: newTask.id,
        action: "CREATE",
        userId: userId,
        diff: {
          title: validated.title,
          assignedToId: validated.assignedToId,
          clientId: validated.clientId,
          complianceItemId: validated.complianceItemId,
        },
      },
    });

    return newTask;
  });

  return NextResponse.json(task, { status: 201 });
});