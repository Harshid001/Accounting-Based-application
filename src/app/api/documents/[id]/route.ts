import { NextResponse } from "next/server"

import { getServerSession } from "next-auth/next"
import { authOptions, canAccessClient } from "@/lib/auth"

import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()

    const document = await prisma.document.findUnique({
      where: { id }
    })

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const hasAccess = await canAccessClient(document.clientId, session)
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Only allow archiving in this patch request for safety
    if (body.archived === undefined) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 })
    }

    const updatedDoc = await prisma.$transaction(async (tx) => {
      const doc = await tx.document.update({
        where: { id },
        data: { archived: body.archived }
      })

      // Log the archiving action
      await tx.auditLog.create({
        data: {
          entityType: "Document",
          entityId: id,
          action: body.archived ? "ARCHIVE" : "UNARCHIVE",
          userId: session.user.id,
        }
      })

      return doc
    })

    return NextResponse.json(updatedDoc)
  } catch (error) {
    console.error("Error patching document:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
