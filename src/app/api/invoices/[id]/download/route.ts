import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateInvoicePDF } from "@/lib/pdfGenerator"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { client: true }
    })

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    // Role check: If CLIENT, must be their own invoice.
    if (session.user.role === "CLIENT") {
      if (invoice.clientId !== session.user.clientId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const stream = await generateInvoicePDF(invoice)

    return new Response(stream as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`,
      }
    })
  } catch (error: unknown) {
    console.error("PDF Generation Error:", error)
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 })
  }
}
