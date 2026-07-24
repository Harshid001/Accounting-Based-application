import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { appCache } from "@/lib/cache";

const SERVICES_CACHE_KEY = "services:all";
const SERVICES_CACHE_TTL = 300_000; // 5 minutes

export const GET = withAuth(async (req: NextRequest, { user, prisma }) => {
  // Check cache first
  const cached = await appCache.get(SERVICES_CACHE_KEY);
  if (cached) {
    return NextResponse.json(cached);
  }

  const services = await prisma.service.findMany({
    include: {
      _count: {
        select: { subscriptions: true }
      }
    },
    orderBy: { name: "asc" }
  });

  await appCache.set(SERVICES_CACHE_KEY, services, SERVICES_CACHE_TTL, ["services"]);

  return NextResponse.json(services);
});

export const POST = withAuth(async (req: NextRequest, { user, prisma }) => {
  const body = await req.json();
  const { name } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Service name is required" }, { status: 400 });
  }

  const existing = await prisma.service.findUnique({
    where: { name: name.trim() }
  });

  if (existing) {
    return NextResponse.json({ error: "A service with this name already exists" }, { status: 409 });
  }

  const service = await prisma.service.create({
    data: { name: name.trim() }
  });

  // Invalidate services cache on mutation
  await appCache.invalidateByTag("services");

  return NextResponse.json(service, { status: 201 });
}, {
  allowedRoles: ["ADMIN", "MANAGER"],
});

export const PUT = withAuth(async (req: NextRequest, { user, prisma }) => {
  const body = await req.json();
  const { id, name } = body;

  if (!id || !name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Service ID and updated name are required" }, { status: 400 });
  }

  const updated = await prisma.service.update({
    where: { id },
    data: { name: name.trim() }
  });

  // Invalidate services cache on mutation
  await appCache.invalidateByTag("services");

  return NextResponse.json(updated);
}, {
  allowedRoles: ["ADMIN", "MANAGER"],
});

export const DELETE = withAuth(async (req: NextRequest, { user, prisma }) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Service ID query parameter required" }, { status: 400 });
  }

  await prisma.service.delete({
    where: { id }
  });

  // Invalidate services cache on mutation
  await appCache.invalidateByTag("services");

  return NextResponse.json({ message: "Service deleted successfully" });
}, {
  allowedRoles: ["ADMIN"],
});
