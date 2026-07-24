import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, isStaffLeadership, type Role } from "@/lib/permissions";
import { withAuth, validateBody } from "@/lib/api/withAuth";
import { updateTaskSchema } from "@/lib/api/validators";
import { Prisma } from "@prisma/client";

export const PATCH = withAuth(async (req: NextRequest, { user, prisma }) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  
  if (!id) {
    return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
  }

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const userRole = user.role as Role;
  const userId = user.id;
  const isAssignee = task.assignedToId === userId;
  const isManagerOrAdmin = isStaffLeadership(userRole);

  if (!isAssignee && !isManagerOrAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const validated = validateBody(body, updateTaskSchema);

  const updates: Record<string, unknown> = {};

  if (validated.status !== undefined) {
    updates.status = validated.status;
  }

  const isDetailUpdate = 
    validated.assignedToId !== undefined ||
    validated.title !== undefined ||
    validated.description !== undefined ||
    validated.dueDate !== undefined ||
    validated.clientId !== undefined ||
    validated.complianceItemId !== undefined;

  if (isDetailUpdate) {
    if (!isManagerOrAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Only Admin/Manager can modify task details other than status" },
        { status: 403 }
      );
    }
    
    if (validated.assignedToId !== undefined) updates.assignedToId = validated.assignedToId;
    if (validated.title !== undefined) updates.title = validated.title;
    if (validated.description !== undefined) updates.description = validated.description;
    if (validated.dueDate !== undefined) updates.dueDate = validated.dueDate ? new Date(validated.dueDate) : null;
    if (validated.clientId !== undefined) updates.clientId = validated.clientId;
    if (validated.complianceItemId !== undefined) updates.complianceItemId = validated.complianceItemId;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(task);
  }

  const updatedTask = await prisma.$transaction(async (tx) => {
    const taskRes = await tx.task.update({
      where: { id },
      data: updates as Prisma.TaskUpdateInput,
    });

    const auditLogs: Prisma.AuditLogCreateManyInput[] = [];

    if (updates.assignedToId && updates.assignedToId !== task.assignedToId) {
      auditLogs.push({
        entityType: "Task",
        entityId: id,
        action: "REASSIGN",
        userId: userId,
        diff: { old: task.assignedToId, new: updates.assignedToId } as Prisma.InputJsonValue,
      });
    }

    if (updates.status && updates.status !== task.status) {
      auditLogs.push({
        entityType: "Task",
        entityId: id,
        action: "STATUS_CHANGE",
        userId: userId,
        diff: { old: task.status, new: updates.status } as Prisma.InputJsonValue,
      });
    }

    const genericUpdates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) {
      if (k !== "assignedToId" && k !== "status") {
        genericUpdates[k] = v;
      }
    }

    if (Object.keys(genericUpdates).length > 0) {
      auditLogs.push({
        entityType: "Task",
        entityId: id,
        action: "UPDATE",
        userId: userId,
        diff: genericUpdates as Prisma.InputJsonValue,
      });
    }

    if (auditLogs.length > 0) {
      await tx.auditLog.createMany({ data: auditLogs });
    }

    return taskRes;
  });

  return NextResponse.json(updatedTask);
});