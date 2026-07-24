import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";

export const GET = withAuth(async (req: NextRequest, { user, prisma }) => {
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, name: true, email: true, phone: true, role: true, image: true },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(dbUser);
});

export const PATCH = withAuth(async (req: NextRequest, { user, prisma }) => {
  const body = await req.json();
  const { name, email, phone } = body as { name?: string; email?: string; phone?: string };

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
    },
    select: { id: true, name: true, email: true, phone: true, role: true, image: true },
  });

  return NextResponse.json(updated);
});
