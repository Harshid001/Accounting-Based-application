import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Razorpay from "razorpay"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user || session.user.role !== "CLIENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { invoiceId } = await req.json()
    if (!invoiceId) {
      return NextResponse.json({ error: "Missing invoiceId" }, { status: 400 })
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true }
    })

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    if (invoice.clientId !== session.user.clientId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (invoice.status === "PAID" || invoice.status === "VOID") {
      return NextResponse.json({ error: "Invoice is not payable" }, { status: 400 })
    }

    const { Decimal } = await import("@prisma/client/runtime/library")
    const totalPaid = invoice.payments.reduce(
      (sum, p) => sum.add(p.amount),
      new Decimal(0)
    )
    const balance = invoice.total.sub(totalPaid)

    if (balance.lte(0)) {
      return NextResponse.json({ error: "Balance is zero" }, { status: 400 })
    }

    // Convert balance to paise using Decimal arithmetic (no floating-point drift)
    const amountInPaise = balance.mul(100).round().toNumber()

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json({ error: "Payment gateway not configured" }, { status: 500 })
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })

    const options = {
      amount: amountInPaise,
      currency: "INR", // We assume INR for Razorpay in this app context
      receipt: invoice.invoiceNumber,
      notes: {
        invoiceId: invoice.id,
        clientId: invoice.clientId
      }
    }

    const order = await razorpay.orders.create(options)

    // Log the intent
    await prisma.paymentIntent.create({
      data: {
        invoiceId: invoice.id,
        orderId: order.id,
        amount: balance, // Prisma Decimal, stored as rupees
        status: "CREATED"
      }
    })

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      paymentIntentId: order.id
    })

  } catch (error: unknown) {
    console.error("Checkout Error:", error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message || "Internal Server Error" }, { status: 500 })
  }
}
