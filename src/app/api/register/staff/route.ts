import { NextResponse } from "next/server";
import crypto from "crypto";
import bcryptjs from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, name, password } = body;

    if (!token || !name || !password) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // Pre-flight: confirm the invite exists and is still valid before hashing password.
    const invite = await prisma.staffInvite.findUnique({ where: { tokenHash } });

    if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
      return new NextResponse("Invalid or expired invite token", { status: 400 });
    }

    // Hash password before opening the transaction — bcrypt is expensive and should
    // not hold a DB connection open while it runs.
    const hashedPassword = await bcryptjs.hash(password, 12); // cost factor explicit: 12

    // Single $transaction: mark invite used (count-checked) + create User together.
    // If User.create throws (e.g. duplicate email), Postgres rolls back the usedAt
    // update, leaving the invite still redeemable. No burned token / no account gap.
    let createdUser: { id: string } | null = null;
    try {
      await prisma.$transaction(async (tx) => {
        const updateResult = await tx.staffInvite.updateMany({
          where: {
            tokenHash,
            usedAt: null, // Race-safe: only succeeds if not already redeemed.
            expiresAt: { gt: new Date() }, // TOCTOU-safe: confirm expiry hasn't passed since pre-flight
          },
          data: { usedAt: new Date() },
        });

        if (updateResult.count !== 1) {
          throw new Error("INVITE_ALREADY_USED");
        }

        // role and isActive come from the invite record, never from request input.
        createdUser = await tx.user.create({
          data: {
            email: invite.email,
            name,
            password: hashedPassword,
            role: invite.role,   // from invite — not client-supplied
            isActive: true,      // staff accounts are active on redemption
            authProvider: "CREDENTIALS",
          },
        });
      });
    } catch (txErr: unknown) {
      const txMessage = txErr instanceof Error ? txErr.message : String(txErr);
      if (txMessage === "INVITE_ALREADY_USED") {
        return new NextResponse("Invite has already been used", { status: 400 });
      }
      throw txErr;
    }

    return NextResponse.json({ success: true, userId: createdUser!.id });
  } catch (error) {
    console.error("[REGISTER_STAFF_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

