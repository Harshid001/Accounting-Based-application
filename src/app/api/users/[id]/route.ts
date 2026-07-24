import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { Prisma } from "@prisma/client";

export const PATCH = withAuth(async (req: NextRequest, { user, prisma }) => {
  const url = new URL(req.url);
  // Extract [id] from the URL path: /api/users/<id>
  const segments = url.pathname.split("/");
  const id = segments[segments.length - 1];

  if (!id) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  const { role, isActive, clientId } = await req.json();

  const targetUser = await prisma.user.findUnique({ where: { id } });
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Last-Admin Lockout Guard
  if (targetUser.role === "ADMIN" && targetUser.isActive) {
    const isBeingDemoted = role && role !== "ADMIN";
    const isBeingDeactivated = isActive === false;
    
    if (isBeingDemoted || isBeingDeactivated) {
      const otherActiveAdminsCount = await prisma.user.count({
        where: { role: "ADMIN", isActive: true, id: { not: id } }
      });
      
      if (otherActiveAdminsCount === 0) {
        return NextResponse.json(
          { error: "Cannot demote or deactivate the final active Admin in the system." },
          { status: 400 }
        );
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
    });

    // Audit Logging
    const diff: Record<string, unknown> = {};
    if (role !== undefined && role !== targetUser.role) {
      diff.role = { old: targetUser.role, new: role };
    }
    if (isActive !== undefined && isActive !== targetUser.isActive) {
      diff.isActive = { old: targetUser.isActive, new: isActive };
    }
    if (clientId !== undefined && clientId !== targetUser.clientId) {
      diff.clientId = { old: targetUser.clientId, new: clientId };
    }

    if (Object.keys(diff).length > 0) {
      await tx.auditLog.create({
        data: {
          entityType: "User",
          entityId: id,
          action: "UPDATE",
          userId: user.id,
          diff: diff as Prisma.InputJsonValue
        }
      });
    }

    return updated;
  });

  return NextResponse.json({ 
    id: updatedUser.id, 
    name: updatedUser.name, 
    role: updatedUser.role, 
    isActive: updatedUser.isActive,
    clientId: updatedUser.clientId
  });
}, {
  allowedRoles: ["ADMIN"],
});
