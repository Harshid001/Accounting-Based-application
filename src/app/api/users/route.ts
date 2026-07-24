import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";

export const GET = withAuth(async (req: NextRequest, { user, prisma }) => {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10)));

  const where = { role: { not: "CLIENT" as const } };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        clientId: true,
        client: { select: { id: true, name: true } }
      },
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({ data: users, pagination: { page, pageSize, total } });
}, {
  allowedRoles: ["ADMIN", "MANAGER"],
});
