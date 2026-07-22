import { NextResponse } from "next/server";
import bcryptjs from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// Very basic in-memory rate limiter for this specific endpoint
const rateLimitMap = new Map<string, { count: number; expiresAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const now = Date.now();
    const rateRecord = rateLimitMap.get(ip);
    
    if (rateRecord && rateRecord.expiresAt > now) {
      if (rateRecord.count >= RATE_LIMIT_MAX) {
        return new NextResponse("Too many requests, please try again later.", { status: 429 });
      }
      rateRecord.count++;
    } else {
      rateLimitMap.set(ip, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_MS });
    }

    const body = await req.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    // Check Client table for matching email
    const match = await prisma.client.findUnique({
      where: { email },
      include: { clientUsers: true },
    });

    if (match && match.clientUsers.length > 0) {
      // Match found, already claimed
      return new NextResponse("An account with this email already exists or is claimed. Please contact your firm.", { status: 400 });
    }

    const hashedPassword = await bcryptjs.hash(password, 12); // explicitly set cost factor to 12

    try {
      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: "CLIENT", // Explicitly state role server-side
          isActive: false, // Pending approval
          clientId: null, // DELIBERATELY null until email verification completes
          authProvider: "CREDENTIALS",
        },
      });

      // Generate Verification Token
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date();
      expires.setHours(expires.getHours() + 24);

      await prisma.registrationVerificationToken.create({
        data: {
          identifier: email,
          token,
          expires,
        }
      });

      // Send verification email (falls back to console.log when RESEND_API_KEY is not set)
      const { sendEmail } = await import("@/lib/email");
      const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/verify-email?token=${token}`;
      await sendEmail({
        to: email,
        subject: "AFMS — Verify your email address",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a2e;">Welcome to AFMS</h2>
            <p>Please verify your email address by clicking the link below:</p>
            <p><a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #1a1a2e; color: #fff; text-decoration: none; border-radius: 6px;">Verify Email</a></p>
            <p style="color: #666; font-size: 12px;">This link expires in 24 hours. If you didn't register, you can ignore this email.</p>
          </div>
        `,
      });

      return NextResponse.json({ success: true, message: "Registration successful. Please check your email to verify your account." });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') { // Unique constraint violation
          // Duplicate-email check caught violation, not a check-then-create query
          return new NextResponse("An account with this email already exists or is claimed. Please contact your firm.", { status: 400 });
        }
      }
      throw error;
    }

  } catch (error) {
    console.error("[REGISTER_CLIENT_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
