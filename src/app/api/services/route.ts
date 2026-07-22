import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const services = await prisma.service.findMany({
      include: {
        _count: {
          select: { subscriptions: true }
        }
      },
      orderBy: { name: "asc" }
    });

    return NextResponse.json(services);
  } catch (error) {
    console.error("Error fetching services:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden: Admin or Manager role required" }, { status: 403 });
    }

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

    return NextResponse.json(service, { status: 201 });
  } catch (error) {
    console.error("Error creating service:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden: Admin or Manager role required" }, { status: 403 });
    }

    const body = await req.json();
    const { id, name } = body;

    if (!id || !name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Service ID and updated name are required" }, { status: 400 });
    }

    const updated = await prisma.service.update({
      where: { id },
      data: { name: name.trim() }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating service:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin role required to delete services" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Service ID query parameter required" }, { status: 400 });
    }

    await prisma.service.delete({
      where: { id }
    });

    return NextResponse.json({ message: "Service deleted successfully" });
  } catch (error) {
    console.error("Error deleting service:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
