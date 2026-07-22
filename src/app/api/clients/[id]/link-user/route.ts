import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // 1. Role-check server-side
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const body = await req.json();
    const { userId } = body;
    const { id: clientId } = await params;

    if (!userId || !clientId) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    // Attach existing user to the client
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { clientId: clientId },
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("[LINK_USER_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
