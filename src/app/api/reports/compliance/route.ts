import { NextRequest, NextResponse } from "next/server";
import { getComplianceReportData } from "@/lib/reports";

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-mock-userid") || "dummy_user";
    const userRole = req.headers.get("x-mock-role") || "ADMIN";
    
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const clientId = searchParams.get("clientId") || undefined;

    const data = await getComplianceReportData(userId, userRole, startDate, endDate, clientId);
    
    return NextResponse.json(data);
  } catch (error: any) {
    if (error.message && error.message.startsWith("FORBIDDEN:")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.message === "Invalid date format" || error.message.includes("date range") || error.message.includes("before startDate")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Compliance report error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
