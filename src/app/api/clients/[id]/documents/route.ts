import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { canAccessClient } from "@/lib/auth";
import { getUploadUrl } from "@/lib/storage";

// Allowed document types for upload validation
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Sanitizes file names to prevent path traversal and clean up special characters
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, "_") // Replace non-alphanumeric (except dots/dashes) with underscores
    .replace(/_{2,}/g, "_");         // Condense multiple underscores
}

export const GET = withAuth(async (req: NextRequest, { user, prisma }) => {
  const url = new URL(req.url);
  const segments = url.pathname.split("/");
  // Path: /api/clients/<id>/documents
  const clientId = segments[segments.length - 2];

  const mockSession = { user };
  const hasAccess = await canAccessClient(clientId, mockSession as any);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const documents = await prisma.document.findMany({
    where: { clientId, archived: false },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json(documents);
});

export const POST = withAuth(async (req: NextRequest, { user, prisma }) => {
  const url = new URL(req.url);
  const segments = url.pathname.split("/");
  let clientId: string | undefined = segments[segments.length - 2];

  if (user.role === 'CLIENT') {
    clientId = user.clientId ?? undefined; // Enforce their own ID
    if (!clientId) {
      return NextResponse.json({ error: "Forbidden: No client associated" }, { status: 403 });
    }
  }

  const mockSession = { user };
  const hasAccess = await canAccessClient(clientId, mockSession as any);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { fileName, fileType, fileSize, type: docType, complianceItemId } = await req.json();

  // 1. File Type and Size Validation
  if (!ALLOWED_MIME_TYPES.includes(fileType)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  if (fileSize > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File exceeds 10MB limit" }, { status: 400 });
  }

  // 2. Sanitize file name server-side
  const cleanName = sanitizeFileName(fileName);
  // Create unique key
  const uniqueId = Math.random().toString(36).substring(2, 15);
  const fileKey = `${uniqueId}-${cleanName}`;

  // 3. Write metadata to database in transaction
  const document = await prisma.$transaction(async (tx) => {
    const doc = await tx.document.create({
      data: {
        clientId,
        type: docType,
        fileKey,
        fileName: cleanName,
        complianceItemId: complianceItemId || null,
        uploadedById: user.id,
      }
    });

    // Write to AuditLog
    await tx.auditLog.create({
      data: {
        entityType: "Document",
        entityId: doc.id,
        action: "CREATE",
        userId: user.id,
        diff: { fileName: cleanName, type: docType }
      }
    });

    return doc;
  });

  // Generate Pre-signed PUT URL OUTSIDE the transaction to avoid
  // holding a DB connection open during the S3 network call
  const uploadUrl = await getUploadUrl(fileKey, fileType);

  return NextResponse.json({ document, uploadUrl });
});
