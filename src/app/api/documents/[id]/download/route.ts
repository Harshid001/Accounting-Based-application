import { NextResponse } from "next/server"

import { getServerSession } from "next-auth/next"
import { authOptions, canAccessClient } from "@/lib/auth"
import { getDownloadUrl } from "@/lib/storage"

import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const document = await prisma.document.findUnique({
      where: { id }
    })

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // Inherited object-level access check
    const hasAccess = await canAccessClient(document.clientId, session)
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Generate Pre-signed GET URL (valid for 15 minutes)
    const downloadUrl = await getDownloadUrl(document.fileKey)

    // Write to AuditLog
    await prisma.auditLog.create({
      data: {
        entityType: "Document",
        entityId: document.id,
        action: "DOWNLOAD",
        userId: session.user.id,
      }
    })

    return NextResponse.json({ downloadUrl })
  } catch (error) {
    console.error("Error generating download URL:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
