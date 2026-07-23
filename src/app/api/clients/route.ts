import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";
import { withAuth, validateBody } from "@/lib/api/withAuth";
import {
  createClientSchema,
  updateClientSchema,
  clientFiltersSchema,
} from "@/lib/api/validators";

type Role = typeof ROLES[keyof typeof ROLES];

function buildClientWhereClause(role: Role, userId: string) {
  if (role === ROLES.ADMIN || role === ROLES.MANAGER) return {};
  return { assignedTo: { some: { id: userId } } };
}

function checkClientAccess(role: Role, userId: string, clientId: string) {
  return role === ROLES.ADMIN || prisma.client.findFirst({
    where: { id: clientId, assignedTo: { some: { id: userId } } },
    select: { id: true },
  });
}

export const GET = withAuth(async (req: NextRequest, { user }) => {
  console.log('GET /api/clients - user:', { id: user.id, role: user.role, email: user.email });
  const userRole = user.role as Role;
  const userId = user.id;
  const { searchParams } = new URL(req.url);

  const filters = clientFiltersSchema.parse({
    page: searchParams.get("page"),
    pageSize: searchParams.get("pageSize"),
  });

  const whereClause = buildClientWhereClause(userRole, userId);
  console.log('whereClause:', JSON.stringify(whereClause));

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where: whereClause,
      include: {
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        services: { include: { service: { select: { id: true, name: true } } } },
        _count: {
          select: { complianceItems: true, tasks: true, documents: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.client.count({ where: whereClause }),
  ]);

  return NextResponse.json({ data: clients, pagination: { page: filters.page, pageSize: filters.pageSize, total } });
});

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const userRole = user.role as Role;
  const userId = user.id;

  if (!(userRole === ROLES.ADMIN || userRole === ROLES.MANAGER)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const validated = validateBody(body, createClientSchema);

  const assignedIds = new Set(validated.assignedToIds ?? []);
  assignedIds.add(userId);

  const client = await prisma.client.create({
    data: {
      name: validated.name,
      type: validated.type,
      email: validated.email,
      phone: validated.phone,
      pan: validated.pan,
      gstin: validated.gstin,
      tan: validated.tan,
      address: validated.address,
      status: validated.status,
      assignedTo: { connect: Array.from(assignedIds).map((id) => ({ id })) },
    },
    include: {
      assignedTo: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  return NextResponse.json(client, { status: 201 });
});