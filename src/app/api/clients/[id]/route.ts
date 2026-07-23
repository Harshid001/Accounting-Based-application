import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";
import { withAuth, validateBody } from "@/lib/api/withAuth";
import { updateClientSchema } from "@/lib/api/validators";

type Role = typeof ROLES[keyof typeof ROLES];

async function checkClientAccess(prisma: typeof import("@/lib/prisma").prisma, clientId: string, userId: string, role: Role) {
  if (role === ROLES.ADMIN) return true;
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { assignedTo: { select: { id: true } } },
  });
  return !!client?.assignedTo.some((u) => u.id === userId);
}

function canDeleteClient(role: Role): boolean {
  return role === ROLES.ADMIN || role === ROLES.MANAGER;
}

function canReassignStaff(role: Role): boolean {
  return role === ROLES.ADMIN || role === ROLES.MANAGER;
}

export const GET = withAuth(async (req: NextRequest, { user, prisma }) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  
  if (!id) {
    return NextResponse.json({ error: "Client ID is required" }, { status: 400 });
  }

  const hasAccess = await checkClientAccess(prisma, id, user.id, user.role as Role);
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
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  
  if (!id) {
    return NextResponse.json({ error: "Client ID is required" }, { status: 400 });
  }

  const userRole = user.role as Role;
  const hasAccess = await checkClientAccess(prisma, id, user.id, userRole);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { assignedToIds, ...otherFields } = validateBody(body, updateClientSchema);

  let updateData: Record<string, any> = { ...otherFields };

  if (assignedToIds !== undefined) {
    if (!canReassignStaff(userRole)) {
      return NextResponse.json({ error: "Forbidden - Cannot reassign staff" }, { status: 403 });
    }
    updateData.assignedTo = { set: assignedToIds.map((userId: string) => ({ id: userId })) };
  }

  const client = await prisma.client.update({
    where: { id },
    data: updateData,
    include: {
      assignedTo: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  return NextResponse.json(client);
});

export const DELETE = withAuth(async (req: NextRequest, { user, prisma }) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  
  if (!id) {
    return NextResponse.json({ error: "Client ID is required" }, { status: 400 });
  }

  const userRole = user.role as Role;
  const hasAccess = await checkClientAccess(prisma, id, user.id, userRole);
  if (!hasAccess || !canDeleteClient(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.client.delete({ where: { id } });

  return NextResponse.json({ success: true });
});