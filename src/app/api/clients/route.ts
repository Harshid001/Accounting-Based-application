import { NextResponse } from "next/server"
import { ROLES } from "@/lib/permissions"

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { role, id: userId } = session.user

    let whereClause = {}
    
    // Admin sees all. Others only see assigned clients.
    if (role !== ROLES.ADMIN) {
      whereClause = {
        assignedTo: {
          some: {
            id: userId
          }
        }
      }
    }

    const clients = await prisma.client.findMany({
      where: whereClause,
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, role: true }
        },
        services: {
          include: { service: true }
        }
      },
      orderBy: { createdAt: "desc" }
    })

    return NextResponse.json(clients)
  } catch (error) {
    console.error("Error fetching clients:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only Admin or Manager can create clients
    if (session.user.role !== ROLES.ADMIN && session.user.role !== ROLES.MANAGER) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const data = await req.json()

    // Automatically add the creator to the assigned staff list 
    // to ensure they can see the client they just created, 
    // especially important for non-ADMIN users.
    const assignedIds = new Set<string>(data.assignedToIds || [])
    assignedIds.add(session.user.id)

    // Create the client
    const client = await prisma.client.create({
      data: {
        name: data.name,
        type: data.type,
        pan: data.pan,
        gstin: data.gstin,
        tan: data.tan,
        address: data.address,
        status: data.status || "ACTIVE",
        assignedTo: {
          connect: Array.from(assignedIds).map(id => ({ id }))
        },
      },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, role: true }
        }
      }
    })

    return NextResponse.json(client, { status: 201 })
  } catch (error) {
    console.error("Error creating client:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
