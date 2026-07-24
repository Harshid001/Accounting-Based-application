import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { canAccessClient } from "@/lib/auth";

export const PATCH = withAuth(async (req: NextRequest, { user, prisma }) => {
  const url = new URL(req.url);
  const segments = url.pathname.split("/");
  // Path: /api/documents/<id>
  const id = segments[segments.length - 1];

  if (!id) {
    return NextResponse.json({ error: "Document ID is required" }, { status: 400 });
  }

  const body = await req.json();

  const document = await prisma.document.findUnique({
    where: { id }
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Re-construct session for canAccessClient (needs the full session shape)
  const session = { user: { id: user.id, role: user.role } } as any;

  const hasAccess = await canAccessClient(document.clientId, session);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Only allow archiving in this patch request for safety
  if (body.archived === undefined) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const updatedDoc = await prisma.$transaction(async (tx) => {
    const doc = await tx.document.update({
      where: { id },
      data: { archived: body.archived }
    });

    // Log the archiving action
    await tx.auditLog.create({
      data: {
        entityType: "Document",
        entityId: id,
        action: body.archived ? "ARCHIVE" : "UNARCHIVE",
        userId: user.id,
      }
    });

    return doc;
  });

  return NextResponse.json(updatedDoc);
});
