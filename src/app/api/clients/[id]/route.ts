import { NextResponse } from "next/server"
import { ROLES } from "@/lib/permissions"

import { getServerSession } from "next-auth/next"
import { authOptions, canAccessClient } from "@/lib/auth"

import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    
    // Check RBAC for this specific client
    const hasAccess = await canAccessClient(id, session)
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden - You do not have access to this client" }, { status: 403 })
    }

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, role: true }
        },
        services: {
          include: { service: true }
        }
      }
    })

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    return NextResponse.json(client)
  } catch (error) {
    console.error("Error fetching client:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Check RBAC for this specific client
    const hasAccess = await canAccessClient(id, session)
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const data = await req.json()
    const { assignedToIds, ...otherFields } = data

    // Only Admin or Manager can reassign staff
    let updateData: any = { ...otherFields }
    
    if (assignedToIds !== undefined) {
      if (session.user.role === ROLES.ADMIN || session.user.role === ROLES.MANAGER) {
        updateData.assignedTo = {
          set: assignedToIds.map((userId: string) => ({ id: userId }))
        }
      } else {
        // If an Accountant tries to modify assignments, reject the entire request or just ignore that field
        return NextResponse.json({ error: "Forbidden - You do not have permission to reassign staff" }, { status: 403 })
      }
    }

    const client = await prisma.client.update({
      where: { id },
      data: updateData,
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, role: true }
        }
      }
    })

    return NextResponse.json(client)
  } catch (error) {
    console.error("Error updating client:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Check RBAC for this specific client (must be Admin/Manager for deletion)
    const hasAccess = await canAccessClient(id, session)
    if (!hasAccess || (session.user.role !== ROLES.ADMIN && session.user.role !== ROLES.MANAGER)) {
      return NextResponse.json({ error: "Forbidden - You do not have permission to delete this client" }, { status: 403 })
    }

    // Prisma won't let you delete if there are foreign keys attached unless cascading deletes are setup.
    // We have setup onDelete: Cascade in the schema, so this will now safely delete all related records.
    await prisma.client.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting client:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
