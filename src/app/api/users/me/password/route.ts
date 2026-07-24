import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import bcrypt from "bcryptjs";

export const PATCH = withAuth(async (req: NextRequest, { user, prisma }) => {
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
  });

  if (!dbUser || dbUser.authProvider === "GOOGLE") {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const body = await req.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const isValid = await bcrypt.compare(currentPassword, dbUser.password || "");
  if (!isValid) {
    return NextResponse.json({ error: "Incorrect current password" }, { status: 403 });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: dbUser.id },
    data: { password: hashedPassword },
  });

  return NextResponse.json({ success: true });
});
