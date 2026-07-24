import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { prisma } from "@/lib/prisma";

export const POST = withAuth(async (req: NextRequest, { user, prisma }) => {
  const body = await req.json();
  const { userId } = body;
  
  const url = new URL(req.url);
  const segments = url.pathname.split("/");
  // Path: /api/clients/<id>/link-user
  const clientId = segments[segments.length - 2];

  if (!userId || !clientId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Attach existing user to the client
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { clientId: clientId },
  });

  return NextResponse.json({ success: true, user: updatedUser });
}, {
  allowedRoles: ["ADMIN", "MANAGER"],
});
