import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { canAccessClient } from "@/lib/auth";
import { getDownloadUrl } from "@/lib/storage";

export const GET = withAuth(async (req: NextRequest, { user, prisma }) => {
  const url = new URL(req.url);
  const segments = url.pathname.split("/");
  // Path: /api/documents/<id>/download
  const id = segments[segments.length - 2];

  if (!id) {
    return NextResponse.json({ error: "Document ID is required" }, { status: 400 });
  }

  const document = await prisma.document.findUnique({
    where: { id }
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Inherited object-level access check
  const session = { user: { id: user.id, role: user.role } } as any;

  const hasAccess = await canAccessClient(document.clientId, session);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Generate Pre-signed GET URL (valid for 15 minutes)
  const downloadUrl = await getDownloadUrl(document.fileKey);

  // Write to AuditLog
  await prisma.auditLog.create({
    data: {
      entityType: "Document",
      entityId: document.id,
      action: "DOWNLOAD",
      userId: user.id,
    }
  });

  return NextResponse.json({ downloadUrl });
});
