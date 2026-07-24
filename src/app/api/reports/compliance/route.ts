import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { getComplianceReportData } from "@/lib/reports";

export const GET = withAuth(async (req: NextRequest, { user }) => {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const clientId = searchParams.get("clientId") || undefined;

    const data = await getComplianceReportData(user.id, user.role, startDate, endDate, clientId);
    
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message && message.startsWith("FORBIDDEN:")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message === "Invalid date format" || message.includes("date range") || message.includes("before startDate")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    throw error;
  }
});
