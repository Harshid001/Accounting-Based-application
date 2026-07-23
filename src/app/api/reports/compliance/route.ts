import { NextRequest, NextResponse } from "next/server";
import { getComplianceReportData } from "@/lib/reports";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const userRole = session.user.role;
    
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const clientId = searchParams.get("clientId") || undefined;

    const data = await getComplianceReportData(userId, userRole, startDate, endDate, clientId);
    
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message && message.startsWith("FORBIDDEN:")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message === "Invalid date format" || message.includes("date range") || message.includes("before startDate")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("Compliance report error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
