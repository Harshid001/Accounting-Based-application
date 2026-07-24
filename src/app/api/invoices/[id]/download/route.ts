import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { generateInvoicePDF } from "@/lib/pdfGenerator";

export const GET = withAuth(async (req: NextRequest, { user, prisma }) => {
  const url = new URL(req.url);
  const segments = url.pathname.split("/");
  // Path: /api/invoices/<id>/download
  const id = segments[segments.length - 2];

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { client: true }
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Role check: If CLIENT, must be their own invoice.
  if (user.role === "CLIENT") {
    if (invoice.clientId !== user.clientId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const stream = await generateInvoicePDF(invoice);

  return new NextResponse(stream as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`,
    }
  });
});
