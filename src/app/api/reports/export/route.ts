import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { getComplianceReportData, getRevenueReportData } from "@/lib/reports";
import { generateReportPDF } from "@/lib/pdfGenerator";

// Next.js helper to convert Node Readable stream to Web ReadableStream
function readableStreamToWeb(nodeStream: NodeJS.ReadableStream): ReadableStream {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', chunk => controller.enqueue(chunk));
      nodeStream.on('end', () => controller.close());
      nodeStream.on('error', err => controller.error(err));
    }
  });
}

export const GET = withAuth(async (req: NextRequest, { user, prisma }) => {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const format = searchParams.get("format");
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const clientId = searchParams.get("clientId") || undefined;

    if (format !== "pdf") {
      return NextResponse.json({ error: "Only pdf format is supported" }, { status: 400 });
    }

    if (type !== "revenue" && type !== "compliance") {
      return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
    }

    let data;
    if (type === "revenue") {
      data = await getRevenueReportData(user.id, user.role, startDate, endDate, clientId);
    } else {
      data = await getComplianceReportData(user.id, user.role, startDate, endDate, clientId);
    }

    // Generate AuditLog entry for the export
    await prisma.auditLog.create({
      data: {
        entityType: "Report",
        entityId: `report_${type}_${Date.now()}`,
        action: "EXPORT",
        userId: user.id,
        diff: {
          type,
          format,
          startDate,
          endDate,
          clientId,
          scope: clientId ? "Specific Client" : "All Authorized Clients"
        }
      }
    });

    const pdfStream = await generateReportPDF(type, data);
    const webStream = readableStreamToWeb(pdfStream);

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${type}_report.pdf"`
      }
    });

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
