import { NextResponse } from "next/server"

import { getServerSession } from "next-auth/next"
import { authOptions, canAccessClient } from "@/lib/auth"
import { getUploadUrl } from "@/lib/storage"

import { prisma } from "@/lib/prisma";

// Allowed document types for upload validation
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// Sanitizes file names to prevent path traversal and clean up special characters
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, "_") // Replace non-alphanumeric (except dots/dashes) with underscores
    .replace(/_{2,}/g, "_")         // Condense multiple underscores
}

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

    const documents = await prisma.document.findMany({
      where: { clientId, archived: false },
      orderBy: { createdAt: "desc" }
    })

    return NextResponse.json(documents)
  } catch (error) {
    console.error("Error listing documents:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let { id: clientId } = await params

    if (session.user.role === 'CLIENT') {
      clientId = (session.user as any).clientId; // Enforce their own ID
      if (!clientId) {
        return NextResponse.json({ error: "Forbidden: No client associated" }, { status: 403 })
      }
    }

    const hasAccess = await canAccessClient(clientId, session)
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { fileName, fileType, fileSize, type: docType, complianceItemId } = await req.json()

    // 1. File Type and Size Validation
    if (!ALLOWED_MIME_TYPES.includes(fileType)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 })
    }

    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds 10MB limit" }, { status: 400 })
    }

    // 2. Sanitize file name server-side
    const cleanName = sanitizeFileName(fileName)
    // Create unique key
    const uniqueId = Math.random().toString(36).substring(2, 15)
    const fileKey = `${uniqueId}-${cleanName}`

    // 3. Write metadata to database in transaction
    const document = await prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          clientId,
          type: docType,
          fileKey,
          fileName: cleanName,
          complianceItemId: complianceItemId || null,
          uploadedById: session.user.id,
        }
      })

      // Write to AuditLog
      await tx.auditLog.create({
        data: {
          entityType: "Document",
          entityId: doc.id,
          action: "CREATE",
          userId: session.user.id,
          diff: { fileName: cleanName, type: docType }
        }
      })

      return doc
    });

    // Generate Pre-signed PUT URL OUTSIDE the transaction to avoid
    // holding a DB connection open during the S3 network call
    const uploadUrl = await getUploadUrl(fileKey, fileType)

    return NextResponse.json({ document, uploadUrl })
  } catch (error: any) {
    console.error("Error initiating upload:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
  }
}
