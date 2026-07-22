import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { Prisma } from "@prisma/client"
import { getSystemActorId } from "@/lib/constants"

export async function POST(req: Request) {
  try {
    const bodyText = await req.text()
    const signature = req.headers.get("x-razorpay-signature")
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET

    if (!signature || !secret) {
      return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 })
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(bodyText)
      .digest("hex")

    if (expectedSignature !== signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    const event = JSON.parse(bodyText)

    // Handle payment captured
    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity
      const orderId = payment.order_id
      const amountPaise = payment.amount
      const gatewayEventId = payment.id

      // Find the PaymentIntent
      const intent = await prisma.paymentIntent.findUnique({
        where: { orderId }
      })

      if (!intent) {
        return NextResponse.json({ error: "Intent not found" }, { status: 404 })
      }

      await prisma.$transaction(async (tx) => {
        // Update intent status
        await tx.paymentIntent.update({
          where: { orderId },
          data: { status: "SUCCESS" }
        })

        // Idempotency: Create payment if gatewayEventId doesn't exist
        const existing = await tx.payment.findUnique({
          where: { gatewayEventId }
        })

        if (!existing) {
          const amountRupees = new Prisma.Decimal(amountPaise).div(100)
          
          const payment = await tx.payment.create({
            data: {
              invoiceId: intent.invoiceId,
              amount: amountRupees,
              method: "RAZORPAY",
              gatewayEventId,
              referenceId: orderId,
            }
          })

          const systemUserId = await getSystemActorId();
          await tx.auditLog.create({
            data: {
              entityType: "Payment",
              entityId: payment.id,
              action: "CREATE",
              userId: systemUserId,
              diff: JSON.parse(JSON.stringify({ payment, source: "webhook" }))
            }
          })

          // Recalculate invoice status
          const invoice = await tx.invoice.findUnique({
            where: { id: intent.invoiceId },
            include: { payments: true }
          })

          if (invoice) {
            const totalPaid = invoice.payments.reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0))
            const totalPaidPlusNew = totalPaid.add(amountRupees)

            let newStatus = invoice.status
            if (totalPaidPlusNew.gte(invoice.total)) {
              newStatus = "PAID"
            } else if (totalPaidPlusNew.gt(0)) {
              newStatus = "PARTIALLY_PAID"
            }

            if (newStatus !== invoice.status) {
              await tx.invoice.update({
                where: { id: invoice.id },
                data: { status: newStatus }
              })
            }
          }
        }
      })
    } else if (event.event === "payment.failed") {
      const payment = event.payload.payment.entity
      const orderId = payment.order_id
      
      const intent = await prisma.paymentIntent.findUnique({
        where: { orderId }
      })

      if (intent && intent.status !== "SUCCESS") {
        await prisma.paymentIntent.update({
          where: { orderId },
          data: { status: "FAILED" }
        })
      }
    }

    return NextResponse.json({ status: "ok" })
  } catch (error: any) {
    console.error("Webhook error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
