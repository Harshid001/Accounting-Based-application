import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/api/withAuth";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";
import { Prisma } from "@prisma/client";
import {
  updateClientSchema,
  validateBody,
  isValidationError,
} from "@/lib/api/validators";

function isLeadership(role: string): boolean {
  return role === ROLES.ADMIN || role === ROLES.MANAGER;
}

async function checkClientAccess(clientId: string, userId: string, role: string) {
  if (isLeadership(role)) return true;
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { assignedTo: { select: { id: true } } },
  });
  return !!client?.assignedTo.some((u) => u.id === userId);
}

export const GET = withAuth(async (req: NextRequest, { user, prisma }) => {
  const url = new URL(req.url);
  const segments = url.pathname.split("/");
  // Path: /api/clients/<id>
  const id = segments[segments.length - 1];

  const hasAccess = await checkClientAccess(id, user.id, user.role);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true, email: true, role: true } },
      services: { include: { service: true } },
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return NextResponse.json(client);
});

export const PATCH = withAuth(async (req: NextRequest, { user, prisma }) => {
  const url = new URL(req.url);
  const segments = url.pathname.split("/");
  const id = segments[segments.length - 1];

  const hasAccess = await checkClientAccess(id, user.id, user.role);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { assignedToIds, incorporationDate, ...otherFields } = validateBody(body, updateClientSchema);

  const updateData: Record<string, unknown> = { ...otherFields };

  if (incorporationDate !== undefined) {
    updateData.incorporationDate = incorporationDate ? new Date(incorporationDate) : null;
  }

  if (assignedToIds !== undefined) {
    if (!isLeadership(user.role)) {
      return NextResponse.json({ error: "Forbidden - Cannot reassign staff" }, { status: 403 });
    }
    updateData.assignedTo = { set: assignedToIds.map((uid: string) => ({ id: uid })) };
  }

  try {
    const client = await prisma.client.update({
      where: { id },
      data: updateData,
      include: {
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    return NextResponse.json(client);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json({ error: "Unique constraint violation" }, { status: 409 });
      }
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Record not found" }, { status: 404 });
      }
    }
    throw error;
  }
});

export const DELETE = withAuth(async (req: NextRequest, { user, prisma }) => {
  const url = new URL(req.url);
  const segments = url.pathname.split("/");
  const id = segments[segments.length - 1];

  const hasAccess = await checkClientAccess(id, user.id, user.role);
  if (!hasAccess || !isLeadership(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await prisma.client.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Record not found" }, { status: 404 });
      }
    }
    throw error;
  }
});
