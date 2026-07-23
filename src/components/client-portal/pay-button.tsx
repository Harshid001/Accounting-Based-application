"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CreditCard, Loader2 } from "lucide-react"

declare global {
  interface Window {
    Razorpay: new (options: unknown) => { on: (event: string, handler: (response: unknown) => void) => void; open: () => void }
  }
}

export function PayButton({ invoiceId, amount }: { invoiceId: string, amount: number }) {
  const [loading, setLoading] = useState(false)

  const handlePay = async () => {
    try {
      setLoading(true)
      
      // Load Razorpay script if not already loaded
      if (!window.Razorpay) {
        await new Promise((resolve) => {
          const script = document.createElement("script")
          script.src = "https://checkout.razorpay.com/v1/checkout.js"
          script.onload = resolve
          document.body.appendChild(script)
        })
      }

      // 1. Create order on our backend
      const res = await fetch("/api/checkout/razorpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create order")
      }

      const { orderId, amount: orderAmount, currency, keyId, paymentIntentId } = await res.json()

      // 2. Open Razorpay Checkout
      const options = {
        key: keyId,
        amount: orderAmount,
        currency: currency,
        name: "Accounting Business App",
        description: `Payment for Invoice`,
        order_id: orderId,
        handler: async function (response: { razorpay_payment_id?: string }) {
          // This is a client-side success handler. 
          // The real source of truth is the webhook, but we can do a UI refresh here.
          alert("Payment successful! It may take a moment to reflect on your account.")
          window.location.reload()
        },
        prefill: {
          name: "Client",
        },
        theme: {
          color: "#0f172a"
        }
      }

      const rzp = new window.Razorpay(options)
      
      rzp.on('payment.failed', ((response: unknown) => {
        const err = response as { error: { description?: string } };
        alert("Payment failed: " + err.error.description);
        // The webhook handles the 'payment.failed' event to update PaymentIntent status to FAILED.
      }) as (response: unknown) => void);

      rzp.open()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handlePay} disabled={loading} size="sm" className="w-full sm:w-auto font-semibold">
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
      Pay Now
    </Button>
  )
}
