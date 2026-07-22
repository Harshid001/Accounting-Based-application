import { NextResponse } from "next/server"

import { getServerSession } from "next-auth/next"
import { authOptions, canAccessClient } from "@/lib/auth"
import { spawnNextRecurringComplianceItem } from "@/lib/recurrence"
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()

    // Find the item first
    const item = await prisma.complianceItem.findUnique({
      where: { id }
    })

    if (!item) {
      return NextResponse.json({ error: "Compliance item not found" }, { status: 404 })
    }

    // Role Matrix: Clients cannot edit compliance items. Data Entry cannot sign-off.
    if (session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden - Clients cannot edit compliance items" }, { status: 403 })
    }

    // Check client assignment for staff roles
    const hasAccess = await canAccessClient(item.clientId, session)
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (session.user.role === "DATA_ENTRY" && (body.status === "FILED" || body.status === "ACKNOWLEDGED")) {
      return NextResponse.json({ error: "Forbidden - Data Entry staff cannot sign off compliance items" }, { status: 403 })
    }

    const oldStatus = item.status
    const newStatus = body.status || oldStatus

    const updateData: any = {}
    if (body.status) updateData.status = body.status
    if (body.notes !== undefined) updateData.notes = body.notes
    
    // Server-side timestamp for status transition
    if (body.status && body.status !== oldStatus) {
      if (body.status === "FILED" || body.status === "ACKNOWLEDGED") {
        updateData.filedDate = new Date()
      } else if (oldStatus === "FILED" || oldStatus === "ACKNOWLEDGED") {
        updateData.filedDate = null
      }
    }

    if (body.dueDate) updateData.dueDate = new Date(body.dueDate)

    const updatedItem = await prisma.$transaction(async (tx) => {
      const res = await tx.complianceItem.update({
        where: { id },
        data: updateData
      });

      await tx.auditLog.create({
        data: {
          entityType: "ComplianceItem",
          entityId: id,
          action: "UPDATE",
          userId: session.user.id,
          diff: updateData
        }
      });

      // Auto-spawn next compliance period item when marked FILED or ACKNOWLEDGED
      const isNewlyFiled = (newStatus === "FILED" || newStatus === "ACKNOWLEDGED") && (oldStatus !== "FILED" && oldStatus !== "ACKNOWLEDGED");
      if (isNewlyFiled) {
        await spawnNextRecurringComplianceItem(res, session.user.id, tx);
      }

      return res;
    });

    return NextResponse.json(updatedItem)
  } catch (error) {
    console.error("Error updating compliance item:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
