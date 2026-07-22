import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    // 1. Role-check server-side
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
      return new NextResponse("Forbidden", { status: 403 });
    }
    const userId = session.user.id;

    const body = await req.json();
    const { email, role } = body;

    if (!email || !role) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    // Invites can only create staff-side roles; CLIENT is self-registered only.
    if (role !== "ADMIN" && role !== "MANAGER" && role !== "ACCOUNTANT" && role !== "DATA_ENTRY") {
      return new NextResponse("Invalid role", { status: 400 });
    }

    // 2. Generate token and hash
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // 3. Set expiry (7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 4. Store in DB
    const invite = await prisma.staffInvite.create({
      data: {
        email,
        role,
        tokenHash,
        expiresAt,
        createdByUserId: userId,
      },
    });

    // 5. Send invite email containing the *raw* token
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/register/staff?token=${token}`;
    // await sendEmail(email, "You are invited to join the staff", `Click here: ${inviteUrl}`);

    return NextResponse.json({ success: true, inviteUrl }); // Return URL for testing purposes
  } catch (error) {
    console.error("[INVITE_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
