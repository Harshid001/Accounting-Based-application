import { NextRequest, NextResponse } from "next/server";
import { withAuth, validateBody } from "@/lib/api/withAuth";
import crypto from "crypto";
import { z } from "zod";
import { sendEmail } from "@/lib/email";

const VALID_STAFF_ROLES = ["ADMIN", "MANAGER", "ACCOUNTANT", "DATA_ENTRY"] as const;

const createInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MANAGER", "ACCOUNTANT", "DATA_ENTRY"]),
});

export const POST = withAuth(
  async (req: NextRequest, { user, prisma }) => {
    const userId = user.id;

    const body = await req.json();
    const { email, role } = validateBody(body, createInviteSchema);

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

    await sendEmail({
      to: email,
      subject: "You're invited to join the AFMS team",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a2e;">You've Been Invited</h2>
          <p>You have been invited to join the AFMS platform as a <strong>${role}</strong>.</p>
          <p>Click the link below to create your account. This invitation expires in 7 days.</p>
          <p style="margin: 24px 0;">
            <a href="${inviteUrl}" style="background: #1a1a2e; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
              Accept Invitation
            </a>
          </p>
          <p style="color: #666; font-size: 12px;">
            If you did not expect this invitation, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, email: invite.email });
  },
  {
    allowedRoles: ["ADMIN", "MANAGER"],
  }
);

