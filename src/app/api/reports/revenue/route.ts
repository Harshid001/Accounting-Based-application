import { NextRequest, NextResponse } from "next/server";
import { getRevenueReportData } from "@/lib/reports";
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

    const data = await getRevenueReportData(userId, userRole, startDate, endDate, clientId);
    
    return NextResponse.json(data);
  } catch (error: any) {
    if (error.message && error.message.startsWith("FORBIDDEN:")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.message === "Invalid date format" || error.message.includes("date range") || error.message.includes("before startDate")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Revenue report error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
