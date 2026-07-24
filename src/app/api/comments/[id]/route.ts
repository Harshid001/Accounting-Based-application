import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";

export const PATCH = withAuth(async (req: NextRequest, { user, prisma }) => {
  const url = new URL(req.url);
  const segments = url.pathname.split("/");
  // Path: /api/comments/<id>
  const id = segments[segments.length - 1];

  if (!id) {
    return NextResponse.json({ error: "Comment ID is required" }, { status: 400 });
  }

  const body = await req.json();
  const { content } = body;

  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

  // Edit permission: Strictly author only
  if (comment.authorId !== user.id) {
    return NextResponse.json({ error: "FORBIDDEN: Only the author can edit this comment" }, { status: 403 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.comment.update({
      where: { id },
      data: { content }
    });

    await tx.auditLog.create({
      data: {
        entityType: "Comment",
        entityId: id,
        action: "UPDATE",
        userId: user.id,
        diff: { oldContent: comment.content, newContent: content }
      }
    });

    return updated;
  });

  return NextResponse.json(result);
});

export const DELETE = withAuth(async (req: NextRequest, { user, prisma }) => {
  const url = new URL(req.url);
  const segments = url.pathname.split("/");
  const id = segments[segments.length - 1];

  if (!id) {
    return NextResponse.json({ error: "Comment ID is required" }, { status: 400 });
  }

  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

  // Delete permission: Author or ADMIN/MANAGER
  if (comment.authorId !== user.id && user.role !== "ADMIN" && user.role !== "MANAGER") {
    return NextResponse.json({ error: "FORBIDDEN: Only the author or moderation staff can delete this comment" }, { status: 403 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const deleted = await tx.comment.delete({ where: { id } });

    await tx.auditLog.create({
      data: {
        entityType: "Comment",
        entityId: id,
        action: "DELETE",
        userId: user.id,
        diff: { content: comment.content } // Store the content that was deleted for audit
      }
    });

    return deleted;
  });

  return NextResponse.json({ success: true, deleted: result.id });
});
