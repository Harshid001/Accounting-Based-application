import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, id: userId } = session.user;
    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        client: {
          include: { assignedTo: { select: { id: true } } }
        },
        lineItems: true,
        payments: { orderBy: { paymentDate: "desc" } }
      }
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // ADMIN: unrestricted
    if (role === "ADMIN") {
      return NextResponse.json(invoice);
    }

    // CLIENT: only their own client's invoices — strip internal staff data
    if (role === "CLIENT") {
      const userClientId = session.user.clientId;
      if (!userClientId || invoice.clientId !== userClientId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // Remove assignedTo from client — clients don't need to see staff assignments
      const { assignedTo, ...clientData } = invoice.client;
      return NextResponse.json({ ...invoice, client: clientData });
    }

    // MANAGER / ACCOUNTANT / DATA_ENTRY: must be assigned to this invoice's client
    const isAssigned = invoice.client.assignedTo.some((u: { id: string }) => u.id === userId);
    if (!isAssigned) {
      return NextResponse.json({ error: "Forbidden: Not assigned to this client" }, { status: 403 });
    }

    return NextResponse.json(invoice);
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userRole = session.user.role;
    if (!["ADMIN", "MANAGER", "ACCOUNTANT"].includes(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: invoiceId } = await params;
    const body = await req.json();
    const { status } = body;
    
    if (status && status !== "VOID") {
      return NextResponse.json({ error: "Manual status updates are restricted to VOID only" }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true }
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (status === "VOID" && invoice.payments.length > 0) {
      return NextResponse.json({ error: "Cannot void an invoice with existing payments." }, { status: 400 });
    }

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status }
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
