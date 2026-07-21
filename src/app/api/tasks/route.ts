import { NextResponse } from 'next/server';

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ROLES } from "@/lib/permissions";

import { prisma } from "@/lib/prisma";

function taskScopeWhere(user: any) {
  if (user.role === ROLES.ADMIN) return null;
  if (user.role === ROLES.MANAGER) {
    return {
      OR: [
        { assignedToId: user.id },
        { client: { assignedTo: { some: { id: user.id } } } },
      ],
    };
  }
  return { assignedToId: user.id };
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const status = searchParams.get('status');

    let whereClause: any = { AND: [] };
    const scope = taskScopeWhere(session.user);
    if (scope) {
      whereClause.AND.push(scope);
    }

    if (clientId) {
      whereClause.AND.push({ clientId });
    }
    if (status) {
      whereClause.AND.push({ status });
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        client: { select: { id: true, name: true } },
        complianceItem: { select: { id: true, type: true } },
      },
      orderBy: [
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== ROLES.ADMIN && session.user.role !== ROLES.MANAGER) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, assignedToId, clientId, complianceItemId, dueDate } = body;

    if (!title || !assignedToId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const task = await prisma.$transaction(async (tx) => {
      const newTask = await tx.task.create({
        data: {
          title,
          description,
          assignedToId,
          clientId: clientId || null,
          complianceItemId: complianceItemId || null,
          dueDate: dueDate ? new Date(dueDate) : null,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'Task',
          entityId: newTask.id,
          action: 'CREATE',
          userId: session.user.id,
          diff: { title, assignedToId, clientId, complianceItemId }
        }
      });

      return newTask;
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
