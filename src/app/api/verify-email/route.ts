import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return new NextResponse("Missing token", { status: 400 });
    }

    // Pre-flight: confirm token exists and is unexpired before opening the transaction.
    const verificationToken = await prisma.registrationVerificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      return new NextResponse("Invalid token", { status: 400 });
    }

    if (verificationToken.expires < new Date()) {
      return new NextResponse("Token expired", { status: 400 });
    }

    const email = verificationToken.identifier;

    // Check whether a matching Client record exists (outside tx — read-only, no write ordering needed).
    const client = await prisma.client.findUnique({ where: { email } });

    // Single $transaction: deleteMany (count-checked) + user.update together.
    // If user.update throws for any reason, Postgres rolls back the delete so the
    // token is still present and the user can retry. No dangling-account state.
    let activated = false;
    try {
      await prisma.$transaction(async (tx) => {
        const deleteResult = await tx.registrationVerificationToken.deleteMany({
          where: { token },
        });

        if (deleteResult.count !== 1) {
          // Token was consumed by a concurrent request between the pre-flight check
          // and now. Throw to roll back the transaction.
          throw new Error("TOKEN_ALREADY_USED");
        }

        await tx.user.update({
          where: { email },
          data: {
            emailVerified: new Date(),
            clientId: client ? client.id : null,
            // Activate immediately only when a verified Client match exists.
            // Unmatched registrants stay isActive: false pending admin approval.
            isActive: client !== null,
          },
        });

        activated = true;
      });
    } catch (txErr: unknown) {
      const txMessage = txErr instanceof Error ? txErr.message : String(txErr);
      if (txMessage === "TOKEN_ALREADY_USED") {
        return new NextResponse("Token has already been used", { status: 400 });
      }
      throw txErr; // Re-throw anything else (DB blip, etc.) to the outer handler.
    }

    return NextResponse.json({ success: true, message: "Email verified successfully." });
  } catch (error) {
    console.error("[VERIFY_EMAIL_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

