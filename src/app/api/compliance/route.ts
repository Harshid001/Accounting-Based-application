import { NextResponse } from "next/server"
import { ROLES } from "@/lib/permissions"
import { ComplianceType, ComplianceStatus } from "@prisma/client"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type")
    const status = searchParams.get("status")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10)))

    const { role, id: userId } = session.user

    let whereClause: any = {}

    // 1. Scoping by User Role
    if (role !== ROLES.ADMIN) {
      whereClause.client = {
        assignedTo: {
          some: { id: userId }
        }
      }
    }

    // 2. Filters
    if (type) {
      whereClause.type = type as ComplianceType
    }

    if (status) {
      whereClause.status = status as ComplianceStatus
    }

    if (startDate || endDate) {
      whereClause.dueDate = {}
      if (startDate) {
        whereClause.dueDate.gte = new Date(startDate)
      }
      if (endDate) {
        whereClause.dueDate.lte = new Date(endDate)
      }
    }

    const [items, total] = await Promise.all([
      prisma.complianceItem.findMany({
        where: whereClause,
        include: {
          client: {
            select: { id: true, name: true }
          }
        },
        orderBy: { dueDate: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.complianceItem.count({ where: whereClause }),
    ])

    return NextResponse.json({ data: items, pagination: { page, pageSize, total } })
  } catch (error) {
    console.error("Error fetching global compliance items:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
