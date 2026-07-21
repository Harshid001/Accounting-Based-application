import { NextResponse } from "next/server"

import { getServerSession } from "next-auth/next"
import { authOptions, canAccessClient } from "@/lib/auth"

import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: clientId } = await params

    const hasAccess = await canAccessClient(clientId, session)
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const items = await prisma.complianceItem.findMany({
      where: { clientId },
      orderBy: { dueDate: "asc" }
    })

    return NextResponse.json(items)
  } catch (error) {
    console.error("Error fetching compliance items:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Data Entry staff cannot create compliance items
    if (session.user.role === "DATA_ENTRY") {
      return NextResponse.json({ error: "Forbidden - Insufficient permissions" }, { status: 403 })
    }

    const { id: clientId } = await params

    const hasAccess = await canAccessClient(clientId, session)
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { type, dueDate, notes } = await req.json()

    if (!type || !dueDate) {
      return NextResponse.json({ error: "Type and Due Date are required" }, { status: 400 })
    }

    const item = await prisma.$transaction(async (tx) => {
      const newItem = await tx.complianceItem.create({
        data: {
          clientId,
          type,
          dueDate: new Date(dueDate),
          notes: notes || null
        }
      })

      await tx.auditLog.create({
        data: {
          entityType: "ComplianceItem",
          entityId: newItem.id,
          action: "CREATE",
          userId: session.user.id,
          diff: { type, dueDate, notes }
        }
      })

      return newItem;
    });

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error("Error creating compliance item:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
