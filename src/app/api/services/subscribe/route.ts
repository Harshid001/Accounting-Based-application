import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["ADMIN", "MANAGER", "ACCOUNTANT"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
  } catch (error) {
    console.error("Error creating service subscription:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["ADMIN", "MANAGER", "ACCOUNTANT"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Subscription ID is required" }, { status: 400 });
    }

    await prisma.serviceSubscription.delete({
      where: { id }
    });

    return NextResponse.json({ message: "Subscription removed successfully" });
  } catch (error) {
    console.error("Error deleting service subscription:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
