import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const { id } = await params;
    const body = await req.json();
    const { content } = body;

    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

    // Edit permission: Strictly author only
    if (comment.authorId !== userId) {
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
          userId: userId,
          diff: { oldContent: comment.content, newContent: content }
        }
      });

      return updated;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to update comment:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const userRole = session.user.role;
    const { id } = await params;

    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

    // Delete permission: Author or ADMIN/MANAGER
    if (comment.authorId !== userId && userRole !== "ADMIN" && userRole !== "MANAGER") {
      return NextResponse.json({ error: "FORBIDDEN: Only the author or moderation staff can delete this comment" }, { status: 403 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const deleted = await tx.comment.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          entityType: "Comment",
          entityId: id,
          action: "DELETE",
          userId: userId,
          diff: { content: comment.content } // Store the content that was deleted for audit
        }
      });

      return deleted;
    });

    return NextResponse.json({ success: true, deleted: result.id });
  } catch (error) {
    console.error("Failed to delete comment:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
