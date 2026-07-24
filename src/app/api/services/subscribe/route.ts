import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";

export const POST = withAuth(async (req: NextRequest, { user, prisma }) => {
  const body = await req.json();
  const { clientId, serviceId } = body;

  if (!clientId || !serviceId) {
    return NextResponse.json({ error: "clientId and serviceId are required" }, { status: 400 });
  }

  // Check if subscription already exists
  const existing = await prisma.serviceSubscription.findFirst({
    where: { clientId, serviceId }
  });

  if (existing) {
    return NextResponse.json({ error: "Client is already subscribed to this service" }, { status: 409 });
  }

  const subscription = await prisma.serviceSubscription.create({
    data: { clientId, serviceId },
    include: { service: true }
  });

  return NextResponse.json(subscription, { status: 201 });
}, {
  allowedRoles: ["ADMIN", "MANAGER", "ACCOUNTANT"],
});

export const DELETE = withAuth(async (req: NextRequest, { user, prisma }) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Subscription ID is required" }, { status: 400 });
  }

  await prisma.serviceSubscription.delete({
    where: { id }
  });

  return NextResponse.json({ message: "Subscription removed successfully" });
}, {
  allowedRoles: ["ADMIN", "MANAGER", "ACCOUNTANT"],
});
