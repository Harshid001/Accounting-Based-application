import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { id: userId, role } = session.user;

    const hasAccess = await checkClientAccess(id, userId, role);
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
  } catch (error) {
    console.error("[CLIENTS_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { id: userId, role } = session.user;

    const hasAccess = await checkClientAccess(id, userId, role);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { assignedToIds, ...otherFields } = validateBody(body, updateClientSchema);

    const updateData: Record<string, unknown> = { ...otherFields };

    if (assignedToIds !== undefined) {
      if (!isLeadership(role)) {
        return NextResponse.json({ error: "Forbidden - Cannot reassign staff" }, { status: 403 });
      }
      updateData.assignedTo = { set: assignedToIds.map((uid: string) => ({ id: uid })) };
    }

    const client = await prisma.client.update({
      where: { id },
      data: updateData,
      include: {
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    return NextResponse.json(client);
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json({ error: "Unique constraint violation" }, { status: 409 });
      }
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Record not found" }, { status: 404 });
      }
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    console.error("[CLIENTS_PATCH]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { id: userId, role } = session.user;

    const hasAccess = await checkClientAccess(id, userId, role);
    if (!hasAccess || !isLeadership(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.client.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Record not found" }, { status: 404 });
      }
    }
    console.error("[CLIENTS_DELETE]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
