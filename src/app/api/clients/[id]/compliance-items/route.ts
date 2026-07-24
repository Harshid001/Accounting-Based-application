import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { canAccessClient } from "@/lib/auth";

export const GET = withAuth(async (req: NextRequest, { user, prisma }) => {
  const url = new URL(req.url);
  const segments = url.pathname.split("/");
  // Path: /api/clients/<id>/compliance-items
  const clientId = segments[segments.length - 2];

  // We must re-hydrate the full session-like object for canAccessClient which expects Session shape
  const mockSession = { user };

  const hasAccess = await canAccessClient(clientId, mockSession as any);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const items = await prisma.complianceItem.findMany({
    where: { clientId },
    orderBy: { dueDate: "asc" }
  });

  return NextResponse.json(items);
});

export const POST = withAuth(async (req: NextRequest, { user, prisma }) => {
  // Data Entry staff cannot create compliance items
  if (user.role === "DATA_ENTRY") {
    return NextResponse.json({ error: "Forbidden - Insufficient permissions" }, { status: 403 });
  }

  const url = new URL(req.url);
  const segments = url.pathname.split("/");
  const clientId = segments[segments.length - 2];

  const mockSession = { user };
  const hasAccess = await canAccessClient(clientId, mockSession as any);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { type, dueDate, notes } = await req.json();

  if (!type || !dueDate) {
    return NextResponse.json({ error: "Type and Due Date are required" }, { status: 400 });
  }

  const item = await prisma.$transaction(async (tx) => {
    const newItem = await tx.complianceItem.create({
      data: {
        clientId,
        type,
        dueDate: new Date(dueDate),
        notes: notes || null
      }
    });

    await tx.auditLog.create({
      data: {
        entityType: "ComplianceItem",
        entityId: newItem.id,
        action: "CREATE",
        userId: user.id,
        diff: { type, dueDate, notes }
      }
    });

    return newItem;
  });

  return NextResponse.json(item, { status: 201 });
});
