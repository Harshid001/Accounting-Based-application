import { NextResponse } from "next/server"

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Only ADMIN can update user details" }, { status: 403 })
    }

    const { id } = await params
    const { role, isActive, clientId } = await req.json()

    const targetUser = await prisma.user.findUnique({ where: { id } })
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Last-Admin Lockout Guard
    if (targetUser.role === "ADMIN" && targetUser.isActive) {
      const isBeingDemoted = role && role !== "ADMIN"
      const isBeingDeactivated = isActive === false
      
      if (isBeingDemoted || isBeingDeactivated) {
        const otherActiveAdminsCount = await prisma.user.count({
          where: { role: "ADMIN", isActive: true, id: { not: id } }
        })
        
        if (otherActiveAdminsCount === 0) {
          return NextResponse.json(
            { error: "Cannot demote or deactivate the final active Admin in the system." },
            { status: 400 }
          )
        }
      }
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          ...(role !== undefined && { role }),
          ...(isActive !== undefined && { isActive }),
          ...(clientId !== undefined && { clientId: clientId || null })
        }
      })

      // Audit Logging
      const diff: any = {}
      if (role !== undefined && role !== targetUser.role) {
        diff.role = { old: targetUser.role, new: role }
      }
      if (isActive !== undefined && isActive !== targetUser.isActive) {
        diff.isActive = { old: targetUser.isActive, new: isActive }
      }
      if (clientId !== undefined && clientId !== targetUser.clientId) {
        diff.clientId = { old: targetUser.clientId, new: clientId }
      }

      if (Object.keys(diff).length > 0) {
        await tx.auditLog.create({
          data: {
            entityType: "User",
            entityId: id,
            action: "UPDATE",
            userId: session.user.id,
            diff
          }
        })
      }

      return updated
    })

    return NextResponse.json({ 
      id: updatedUser.id, 
      name: updatedUser.name, 
      role: updatedUser.role, 
      isActive: updatedUser.isActive,
      clientId: updatedUser.clientId
    })
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
