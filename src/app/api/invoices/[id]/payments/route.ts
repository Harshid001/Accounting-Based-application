import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(
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
    const { amount, method, referenceId, paymentDate } = body;

    const paymentAmount = new Prisma.Decimal(amount);
    if (paymentAmount.lte(0)) {
      return NextResponse.json({ error: "Payment amount must be greater than zero" }, { status: 400 });
    }

    // Wrap in a transaction to ensure consistency
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch invoice with existing payments
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { payments: true }
      });

      if (!invoice) {
        throw new Error("Invoice not found");
      }

      if (invoice.status === "VOID") {
        throw new Error("Cannot pay a VOID invoice");
      }

      // 2. Calculate remaining balance
      const totalPaid = invoice.payments.reduce(
        (sum, p) => sum.add(p.amount),
        new Prisma.Decimal(0)
      );
      const remainingBalance = invoice.total.minus(totalPaid);

      // 3. Reject overpayment
      if (paymentAmount.gt(remainingBalance)) {
        throw new Error(`OVERPAYMENT: Payment amount exceeds remaining balance. Remaining balance is ${remainingBalance.toString()}`);
      }

      // 4. Calculate new status
      const newTotalPaid = totalPaid.add(paymentAmount);
      const newStatus = newTotalPaid.gte(invoice.total) ? "PAID" : "PARTIALLY_PAID";

      // 5. Create Payment
      const payment = await tx.payment.create({
        data: {
          invoiceId,
          amount: paymentAmount,
          method: method || "BANK_TRANSFER",
          referenceId,
          paymentDate: paymentDate ? new Date(paymentDate) : undefined,
        }
      });

      // 6. Update Invoice Status if it changed
      let updatedInvoice = invoice;
      if (invoice.status !== newStatus) {
        updatedInvoice = await tx.invoice.update({
          where: { id: invoiceId },
          data: { status: newStatus },
          include: { payments: true }
        });
      }

      // 7. Audit Log
      await tx.auditLog.create({
        data: {
          entityType: "Payment",
          entityId: payment.id,
          action: "CREATE",
          userId: "system", // TODO
          diff: JSON.parse(JSON.stringify({ payment, invoiceStatusChange: newStatus }))
        }
      });

      return { payment, invoice: updatedInvoice };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Failed to process payment:", error);
    if (error.message && error.message.startsWith("OVERPAYMENT:")) {
       // Return 400 with exact remaining balance info
       const match = error.message.match(/Remaining balance is ([\d\.]+)/);
       const remaining = match ? parseFloat(match[1]) : 0;
       return NextResponse.json({ 
         error: error.message, 
         remainingBalance: remaining 
       }, { status: 400 });
    }
    if (error.message === "Invoice not found") return NextResponse.json({ error: error.message }, { status: 404 });
    if (error.message === "Cannot pay a VOID invoice") return NextResponse.json({ error: error.message }, { status: 400 });
    
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
