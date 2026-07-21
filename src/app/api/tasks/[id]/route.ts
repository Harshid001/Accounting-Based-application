import { NextResponse } from 'next/server';

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ROLES, isStaffLeadership } from "@/lib/permissions";

import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const taskId = resolvedParams.id;
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const user = session.user;
    const isAssignee = task.assignedToId === user.id;
    const isManagerOrAdmin = isStaffLeadership(user.role as any);

    if (!isAssignee && !isManagerOrAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { status, assignedToId, title, description, dueDate, clientId, complianceItemId } = body;

    // Check permissions for updates
    const updates: any = {};

    if (status !== undefined) {
      updates.status = status;
    }

    if (assignedToId !== undefined || title !== undefined || description !== undefined || dueDate !== undefined || clientId !== undefined || complianceItemId !== undefined) {
      if (!isManagerOrAdmin) {
        return NextResponse.json(
          { error: 'Forbidden: Only Admin/Manager can modify task details other than status' },
          { status: 403 }
        );
      }
      
      if (assignedToId !== undefined) updates.assignedToId = assignedToId;
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;
      if (clientId !== undefined) updates.clientId = clientId || null;
      if (complianceItemId !== undefined) updates.complianceItemId = complianceItemId || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(task);
    }

    const updatedTask = await prisma.$transaction(async (tx) => {
      const taskRes = await tx.task.update({
        where: { id: taskId },
        data: updates,
      });

      const auditLogs = [];

      // 1. Reassignment Logic
      if (updates.assignedToId && updates.assignedToId !== task.assignedToId) {
        auditLogs.push({
          entityType: 'Task',
          entityId: taskId,
          action: 'REASSIGN',
          userId: session.user.id,
          diff: { old: task.assignedToId, new: updates.assignedToId }
        });
      }

      // 2. Status Change Logic
      if (updates.status && updates.status !== task.status) {
        auditLogs.push({
          entityType: 'Task',
          entityId: taskId,
          action: 'STATUS_CHANGE',
          userId: session.user.id,
          diff: { old: task.status, new: updates.status }
        });
      }

      // 3. Generic Update Logic (for title, description, etc.)
      const genericUpdates: any = {};
      for (const [k, v] of Object.entries(updates)) {
        if (k !== 'assignedToId' && k !== 'status') {
          genericUpdates[k] = v;
        }
      }

      if (Object.keys(genericUpdates).length > 0) {
        auditLogs.push({
          entityType: 'Task',
          entityId: taskId,
          action: 'UPDATE',
          userId: session.user.id,
          diff: genericUpdates
        });
      }

      if (auditLogs.length > 0) {
        await tx.auditLog.createMany({
          data: auditLogs
        });
      }

      return taskRes;
    });

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
