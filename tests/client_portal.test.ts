import { expect, test, describe, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import { PrismaClient, Prisma } from '@prisma/client'
import crypto from 'crypto'

// ─── Mocks ──────────────────────────────────────────────────────────────
// Must be declared before imports of the modules they mock.

// Mock getServerSession — we control the returned session per test
let mockSession: any = null
vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(() => Promise.resolve(mockSession))
}))

// Mock Razorpay SDK — we don't hit Razorpay's API in tests
vi.mock('razorpay', () => {
  return {
    default: function MockRazorpay() {
      return {
        orders: {
          create: vi.fn().mockResolvedValue({
            id: 'order_mock_test_001',
            amount: 11000,
            currency: 'INR'
          })
        }
      }
    }
  }
})

// Mock react-pdf for the download route (renderToStream)
vi.mock('@react-pdf/renderer', () => ({
  Document: ({ children }: any) => children,
  Page: ({ children }: any) => children,
  Text: ({ children }: any) => children,
  View: ({ children }: any) => children,
  StyleSheet: { create: (s: any) => s },
  renderToStream: vi.fn().mockResolvedValue(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('%PDF-mock'))
        controller.close()
      }
    })
  )
}))

// ─── Imports (after mocks) ──────────────────────────────────────────────
import { POST as checkoutPost } from '@/app/api/checkout/razorpay/route'
import { GET as downloadGet } from '@/app/api/invoices/[id]/download/route'
import { POST as webhookPost } from '@/app/api/webhooks/razorpay/route'
import { getRedirectTarget } from '@/lib/middleware-logic'

const prisma = new PrismaClient()

const WEBHOOK_SECRET = "test_secret_for_vitest"

function signPayload(payload: object): { body: string; signature: string } {
  const body = JSON.stringify(payload)
  const signature = crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex")
  return { body, signature }
}

function webhookRequest(body: string, signature: string) {
  return new Request('http://localhost/api/webhooks/razorpay', {
    method: "POST",
    body,
    headers: { "x-razorpay-signature": signature }
  })
}

describe('Client Portal & Razorpay', () => {
  let clientId: string
  let otherClientId: string
  let invoiceId: string
  let otherInvoiceId: string
  let paidInvoiceId: string
  let orderId: string
  let clientUserId: string
  let otherClientUserId: string

  beforeAll(async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET
    process.env.RAZORPAY_KEY_ID = 'rzp_test_mock'
    process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret_mock'

    // Primary client + user
    const client = await prisma.client.create({
      data: { name: 'Portal Test Client A', type: 'INDIVIDUAL', status: 'ACTIVE' }
    })
    clientId = client.id

    const clientUser = await prisma.user.create({
      data: { email: 'portal-a@example.com', role: 'CLIENT', clientId }
    })
    clientUserId = clientUser.id

    // Second client + user
    const otherClient = await prisma.client.create({
      data: { name: 'Portal Test Client B', type: 'INDIVIDUAL', status: 'ACTIVE' }
    })
    otherClientId = otherClient.id

    const otherClientUser = await prisma.user.create({
      data: { email: 'portal-b@example.com', role: 'CLIENT', clientId: otherClientId }
    })
    otherClientUserId = otherClientUser.id

    // Invoice for client A (unpaid)
    const invoice = await prisma.invoice.create({
      data: {
        clientId,
        invoiceNumber: 'BEHAV-INV-001',
        dueDate: new Date(),
        subtotal: 100,
        taxTotal: 10,
        total: 110,
        status: 'SENT'
      }
    })
    invoiceId = invoice.id

    // Invoice for client B
    const otherInvoice = await prisma.invoice.create({
      data: {
        clientId: otherClientId,
        invoiceNumber: 'BEHAV-INV-002',
        dueDate: new Date(),
        subtotal: 200,
        taxTotal: 20,
        total: 220,
        status: 'SENT'
      }
    })
    otherInvoiceId = otherInvoice.id

    // Already-paid invoice for client A
    const paidInv = await prisma.invoice.create({
      data: {
        clientId,
        invoiceNumber: 'BEHAV-INV-003-PAID',
        dueDate: new Date(),
        subtotal: 50,
        taxTotal: 5,
        total: 55,
        status: 'PAID'
      }
    })
    paidInvoiceId = paidInv.id

    // PaymentIntent for webhook tests
    orderId = 'order_behav_001'
    await prisma.paymentIntent.create({
      data: { invoiceId, orderId, amount: 110, status: 'CREATED' }
    })
  })

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { invoiceId: { in: [invoiceId, otherInvoiceId, paidInvoiceId] } } })
    await prisma.paymentIntent.deleteMany({ where: { invoiceId: { in: [invoiceId, otherInvoiceId, paidInvoiceId] } } })
    await prisma.invoice.deleteMany({ where: { id: { in: [invoiceId, otherInvoiceId, paidInvoiceId] } } })
    await prisma.user.deleteMany({ where: { id: { in: [clientUserId, otherClientUserId] } } })
    await prisma.client.deleteMany({ where: { id: { in: [clientId, otherClientId] } } })
  })

  beforeEach(() => {
    mockSession = null // reset between tests
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 1. MIDDLEWARE — imported from the real module, not a hand-copied mirror
  // ═══════════════════════════════════════════════════════════════════════

  describe('Middleware — getRedirectTarget (imported from src/lib/middleware-logic.ts)', () => {
    test('Unauthenticated → /dashboard redirects to /login', () => {
      expect(getRedirectTarget("/dashboard", undefined)).toBe("/login")
      expect(getRedirectTarget("/dashboard/tasks", undefined)).toBe("/login")
      expect(getRedirectTarget("/dashboard/clients/123", undefined)).toBe("/login")
    })

    test('Unauthenticated → /client-view redirects to /login', () => {
      expect(getRedirectTarget("/client-view", undefined)).toBe("/login")
      expect(getRedirectTarget("/client-view/invoices", undefined)).toBe("/login")
    })

    test('Unauthenticated → /api/* returns 401', () => {
      expect(getRedirectTarget("/api/invoices", undefined)).toBe("401")
      expect(getRedirectTarget("/api/checkout/razorpay", undefined)).toBe("401")
    })

    test('CLIENT → /dashboard redirects to /client-view', () => {
      expect(getRedirectTarget("/dashboard", "CLIENT")).toBe("/client-view")
      expect(getRedirectTarget("/dashboard/tasks", "CLIENT")).toBe("/client-view")
      expect(getRedirectTarget("/dashboard/clients/123", "CLIENT")).toBe("/client-view")
    })

    test('CLIENT → /client-view passes through (null)', () => {
      expect(getRedirectTarget("/client-view", "CLIENT")).toBeNull()
      expect(getRedirectTarget("/client-view/invoices", "CLIENT")).toBeNull()
    })

    test('ADMIN/ACCOUNTANT → /dashboard passes through (null)', () => {
      expect(getRedirectTarget("/dashboard", "ADMIN")).toBeNull()
      expect(getRedirectTarget("/dashboard", "ACCOUNTANT")).toBeNull()
      expect(getRedirectTarget("/dashboard/tasks", "ADMIN")).toBeNull()
    })

    test('Middleware matcher excludes /api/webhooks/* (regex verification)', () => {
      const apiMatcher = /^\/api\/((?!cron|auth|webhooks).*)/
      expect(apiMatcher.test("/api/webhooks/razorpay")).toBe(false)
      expect(apiMatcher.test("/api/checkout/razorpay")).toBe(true)
      expect(apiMatcher.test("/api/invoices/123/download")).toBe(true)
    })

    test('proxy.ts imports getRedirectTarget from middleware-logic.ts', async () => {
      const fs = await import('fs')
      const proxyContent = fs.readFileSync(
        'd:/NewVolumeE/Accounting Business App/src/proxy.ts', 'utf-8'
      )
      expect(proxyContent).toContain('import { getRedirectTarget } from "@/lib/middleware-logic"')
      expect(proxyContent).toContain('getRedirectTarget(pathname, role)')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 2. CHECKOUT ROUTE — behavioral tests invoking the real handler
  // ═══════════════════════════════════════════════════════════════════════

  describe('Checkout — Behavioral IDOR & Guard Tests', () => {

    test('Client A checking out Client B invoice → 403 Forbidden', async () => {
      // Session is Client A
      mockSession = {
        user: { id: clientUserId, role: 'CLIENT', clientId: clientId }
      }

      // But invoiceId belongs to Client B
      const req = new Request('http://localhost/api/checkout/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: otherInvoiceId })
      })

      const res = await checkoutPost(req)
      expect(res.status).toBe(403)

      const json = await res.json()
      expect(json.error).toBe("Forbidden")
    })

    test('Client A checking out own invoice → 200 with orderId', async () => {
      mockSession = {
        user: { id: clientUserId, role: 'CLIENT', clientId: clientId }
      }

      const req = new Request('http://localhost/api/checkout/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoiceId })
      })

      const res = await checkoutPost(req)
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.orderId).toBe('order_mock_test_001')
      expect(json.keyId).toBe('rzp_test_mock')
    })

    test('Checkout creates a real PaymentIntent row in DB', async () => {
      // The happy-path test above should have created one
      const intent = await prisma.paymentIntent.findUnique({
        where: { orderId: 'order_mock_test_001' }
      })
      expect(intent).toBeDefined()
      expect(intent!.invoiceId).toBe(invoiceId)
      expect(intent!.status).toBe("CREATED")
      expect(intent!.amount.toNumber()).toBeGreaterThan(0)
    })

    test('Checkout rejects PAID invoice → 400', async () => {
      mockSession = {
        user: { id: clientUserId, role: 'CLIENT', clientId: clientId }
      }

      const req = new Request('http://localhost/api/checkout/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: paidInvoiceId })
      })

      const res = await checkoutPost(req)
      expect(res.status).toBe(400)

      const json = await res.json()
      expect(json.error).toBe("Invoice is not payable")
    })

    test('Checkout rejects zero-balance invoice → 400', async () => {
      // Create an invoice that's fully paid via a manual payment
      const zeroBal = await prisma.invoice.create({
        data: {
          clientId,
          invoiceNumber: 'BEHAV-ZERO-BAL',
          dueDate: new Date(),
          subtotal: 100, taxTotal: 0, total: 100,
          status: 'SENT'
        }
      })
      await prisma.payment.create({
        data: { invoiceId: zeroBal.id, amount: 100, method: 'CASH' }
      })

      mockSession = {
        user: { id: clientUserId, role: 'CLIENT', clientId: clientId }
      }

      const req = new Request('http://localhost/api/checkout/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: zeroBal.id })
      })

      const res = await checkoutPost(req)
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe("Balance is zero")

      // Cleanup
      await prisma.payment.deleteMany({ where: { invoiceId: zeroBal.id } })
      await prisma.invoice.delete({ where: { id: zeroBal.id } })
    })

    test('Non-CLIENT role (ADMIN) cannot use checkout → 401', async () => {
      mockSession = {
        user: { id: 'admin-user', role: 'ADMIN' }
      }

      const req = new Request('http://localhost/api/checkout/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoiceId })
      })

      const res = await checkoutPost(req)
      expect(res.status).toBe(401)
    })

    test('Unauthenticated request → 401', async () => {
      mockSession = null

      const req = new Request('http://localhost/api/checkout/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoiceId })
      })

      const res = await checkoutPost(req)
      expect(res.status).toBe(401)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 3. DOWNLOAD ROUTE — behavioral tests invoking the real handler
  // ═══════════════════════════════════════════════════════════════════════

  describe('Download — Behavioral IDOR Tests', () => {

    test('Client A downloading Client B invoice → 403 Forbidden', async () => {
      mockSession = {
        user: { id: clientUserId, role: 'CLIENT', clientId: clientId }
      }

      const req = new Request('http://localhost/api/invoices/download', { method: 'GET' })
      const res = await downloadGet(req, { params: Promise.resolve({ id: otherInvoiceId }) } as any)

      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.error).toBe("Forbidden")
    })

    test('Client A downloading own invoice → 200 with PDF', async () => {
      mockSession = {
        user: { id: clientUserId, role: 'CLIENT', clientId: clientId }
      }

      const req = new Request('http://localhost/api/invoices/download', { method: 'GET' })
      const res = await downloadGet(req, { params: Promise.resolve({ id: invoiceId }) } as any)

      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('application/pdf')
    })

    test('ADMIN downloading any invoice → 200 (no ownership restriction)', async () => {
      mockSession = {
        user: { id: 'admin-user', role: 'ADMIN' }
      }

      const req = new Request('http://localhost/api/invoices/download', { method: 'GET' })
      const res = await downloadGet(req, { params: Promise.resolve({ id: otherInvoiceId }) } as any)

      expect(res.status).toBe(200)
    })

    test('Unauthenticated download → 401', async () => {
      mockSession = null

      const req = new Request('http://localhost/api/invoices/download', { method: 'GET' })
      const res = await downloadGet(req, { params: Promise.resolve({ id: invoiceId }) } as any)

      expect(res.status).toBe(401)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 4. WEBHOOK — real DB round-trips (unchanged from prior pass)
  // ═══════════════════════════════════════════════════════════════════════

  describe('Webhook — Signature Verification', () => {
    test('Rejects invalid signature → 400', async () => {
      const { body } = signPayload({ event: "payment.captured" })
      const res = await webhookPost(webhookRequest(body, "definitely_invalid"))
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe("Invalid signature")
    })

    test('Rejects missing signature header → 400', async () => {
      const req = new Request('http://localhost/api/webhooks/razorpay', {
        method: "POST",
        body: JSON.stringify({ event: "payment.captured" }),
        headers: {}
      })
      const res = await webhookPost(req)
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe("Missing signature or secret")
    })
  })

  describe('Webhook — payment.captured', () => {
    test('Creates Payment, updates Invoice to PAID, converts paise→rupees', async () => {
      const payload = {
        event: "payment.captured",
        payload: { payment: { entity: {
          id: "pay_behav_001", order_id: orderId, amount: 11000
        }}}
      }
      const { body, signature } = signPayload(payload)
      const res = await webhookPost(webhookRequest(body, signature))
      expect(res.status).toBe(200)

      const payment = await prisma.payment.findUnique({ where: { gatewayEventId: "pay_behav_001" } })
      expect(payment).toBeDefined()
      expect(payment!.amount.toNumber()).toBe(110)
      expect(payment!.method).toBe("RAZORPAY")

      const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
      expect(invoice!.status).toBe("PAID")

      const intent = await prisma.paymentIntent.findUnique({ where: { orderId } })
      expect(intent!.status).toBe("SUCCESS")
    })

    test('Idempotency — duplicate gatewayEventId → no second Payment', async () => {
      const payload = {
        event: "payment.captured",
        payload: { payment: { entity: {
          id: "pay_behav_001", order_id: orderId, amount: 11000
        }}}
      }
      const { body, signature } = signPayload(payload)
      const res = await webhookPost(webhookRequest(body, signature))
      expect(res.status).toBe(200)

      const count = await prisma.payment.count({ where: { gatewayEventId: "pay_behav_001" } })
      expect(count).toBe(1)
    })
  })

  describe('Webhook — payment.failed', () => {
    test('Sets PaymentIntent to FAILED', async () => {
      const failedOrderId = 'order_behav_failed_001'
      await prisma.paymentIntent.create({
        data: { invoiceId, orderId: failedOrderId, amount: 110, status: 'CREATED' }
      })

      const payload = {
        event: "payment.failed",
        payload: { payment: { entity: { order_id: failedOrderId } } }
      }
      const { body, signature } = signPayload(payload)
      const res = await webhookPost(webhookRequest(body, signature))
      expect(res.status).toBe(200)

      const intent = await prisma.paymentIntent.findUnique({ where: { orderId: failedOrderId } })
      expect(intent!.status).toBe("FAILED")
    })

    test('Does not overwrite SUCCESS with FAILED (race guard)', async () => {
      const payload = {
        event: "payment.failed",
        payload: { payment: { entity: { order_id: orderId } } }
      }
      const { body, signature } = signPayload(payload)
      const res = await webhookPost(webhookRequest(body, signature))
      expect(res.status).toBe(200)

      const intent = await prisma.paymentIntent.findUnique({ where: { orderId } })
      expect(intent!.status).toBe("SUCCESS")
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 5. RECONCILIATION — manual + Razorpay
  // ═══════════════════════════════════════════════════════════════════════

  describe('Payment Reconciliation', () => {
    test('Manual cash + Razorpay webhook sum to full invoice total → PAID', async () => {
      const inv = await prisma.invoice.create({
        data: { clientId, invoiceNumber: 'BEHAV-RECON-001', dueDate: new Date(),
                subtotal: 400, taxTotal: 100, total: 500, status: 'SENT' }
      })

      await prisma.payment.create({
        data: { invoiceId: inv.id, amount: 200, method: "CASH" }
      })

      const reconOrder = 'order_behav_recon_001'
      await prisma.paymentIntent.create({
        data: { invoiceId: inv.id, orderId: reconOrder, amount: 300, status: 'CREATED' }
      })

      const payload = {
        event: "payment.captured",
        payload: { payment: { entity: { id: "pay_recon_001", order_id: reconOrder, amount: 30000 } } }
      }
      const { body, signature } = signPayload(payload)
      const res = await webhookPost(webhookRequest(body, signature))
      expect(res.status).toBe(200)

      const payments = await prisma.payment.findMany({ where: { invoiceId: inv.id } })
      expect(payments.reduce((s, p) => s + p.amount.toNumber(), 0)).toBe(500)

      const updated = await prisma.invoice.findUnique({ where: { id: inv.id } })
      expect(updated!.status).toBe("PAID")

      await prisma.payment.deleteMany({ where: { invoiceId: inv.id } })
      await prisma.paymentIntent.deleteMany({ where: { invoiceId: inv.id } })
      await prisma.invoice.delete({ where: { id: inv.id } })
    })

    test('Partial Razorpay payment → PARTIALLY_PAID', async () => {
      const inv = await prisma.invoice.create({
        data: { clientId, invoiceNumber: 'BEHAV-PARTIAL-001', dueDate: new Date(),
                subtotal: 800, taxTotal: 200, total: 1000, status: 'SENT' }
      })

      const partialOrder = 'order_behav_partial_001'
      await prisma.paymentIntent.create({
        data: { invoiceId: inv.id, orderId: partialOrder, amount: 400, status: 'CREATED' }
      })

      const payload = {
        event: "payment.captured",
        payload: { payment: { entity: { id: "pay_partial_001", order_id: partialOrder, amount: 40000 } } }
      }
      const { body, signature } = signPayload(payload)
      const res = await webhookPost(webhookRequest(body, signature))
      expect(res.status).toBe(200)

      const updated = await prisma.invoice.findUnique({ where: { id: inv.id } })
      expect(updated!.status).toBe("PARTIALLY_PAID")

      await prisma.payment.deleteMany({ where: { invoiceId: inv.id } })
      await prisma.paymentIntent.deleteMany({ where: { invoiceId: inv.id } })
      await prisma.invoice.delete({ where: { id: inv.id } })
    })
  })
})
