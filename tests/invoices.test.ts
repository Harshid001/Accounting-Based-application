import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { clearDatabase, setMockSession, clearMockSession } from "./setup";
import { POST as createInvoice, GET as listInvoices } from "../src/app/api/invoices/route";
import { GET as getInvoice, PATCH as patchInvoice } from "../src/app/api/invoices/[id]/route";
import { POST as createPayment } from "../src/app/api/invoices/[id]/payments/route";

const prisma = new PrismaClient();

describe("Billing & Invoicing API", () => {
  let client: any;
  let assignedStaff: any;
  let unassignedStaff: any;

  beforeAll(async () => {
    await clearDatabase();
    client = await prisma.client.create({
      data: { name: "Test Client Inc", type: "BUSINESS", status: "ACTIVE" }
    });
    
    assignedStaff = await prisma.user.create({
      data: { email: "staff@test.com", role: "ACCOUNTANT" }
    });
    
    unassignedStaff = await prisma.user.create({
      data: { email: "unassigned@test.com", role: "ACCOUNTANT" }
    });

    await prisma.client.update({
      where: { id: client.id },
      data: { assignedTo: { connect: { id: assignedStaff.id } } }
    });
    
    // Pre-seed the invoice counter to prevent P2028 transaction deadlocks
    await prisma.invoiceCounter.create({
      data: { id: new Date().getFullYear().toString(), seq: 0 }
    });
  });

  afterEach(() => {
    clearMockSession();
  });

  afterAll(async () => {
    await clearDatabase();
    await prisma.$disconnect();
  });

  const getPayload = (clientId: string) => ({
    clientId,
    dueDate: new Date(Date.now() + 86400000 * 30).toISOString(),
    notes: "Test invoice",
    total: 10.00, // Malicious total, should be ignored
    lineItems: [
      { description: "Audit Services", quantity: 1, unitPrice: 1000, taxRate: 10 }, // 1100
      { description: "Consulting", quantity: 2, unitPrice: 500, taxRate: 0 }        // 1000 => 2100 total
    ]
  });

  it("should reject unauthenticated invoice creation (401)", async () => {
    setMockSession(null);
    const req = { json: async () => getPayload(client.id), headers: new Headers({}) } as any;
    const res = await createInvoice(req);
    expect(res.status).toBe(401);
  });

  it("should reject invoice creation for unassigned staff", async () => {
    setMockSession({ user: { id: unassignedStaff.id, role: "ACCOUNTANT" } });
    const req = { json: async () => getPayload(client.id), headers: new Headers({}) } as any;
    const res = await createInvoice(req);
    expect(res.status).toBe(403);
  });

  it("should reject invoice creation for CLIENT role", async () => {
    setMockSession({ user: { id: "some-client-id", role: "CLIENT" } });
    const req = { json: async () => getPayload(client.id), headers: new Headers({}) } as any;
    const res = await createInvoice(req);
    expect(res.status).toBe(403);
  });

  it("should create invoice ignoring malicious total, generating correct INV- number", async () => {
    setMockSession({ user: { id: assignedStaff.id, role: "ACCOUNTANT" } });
    const req = { json: async () => getPayload(client.id), headers: new Headers({}) } as any;
    const res = await createInvoice(req);
    expect(res.status).toBe(201);
    const invoice = await res.json();
    expect(invoice.invoiceNumber).toMatch(/^INV-\d{4}-\d{4}$/);
    expect(Number(invoice.total)).toBe(2100);
  });

  it("should successfully fetch GET invoice", async () => {
    // Create invoice as ADMIN
    setMockSession({ user: { id: assignedStaff.id, role: "ADMIN" } });
    const createReq = { json: async () => getPayload(client.id), headers: new Headers({}) } as any;
    const createRes = await createInvoice(createReq);
    const invoice = await createRes.json();

    // Fetch it
    setMockSession({ user: { id: assignedStaff.id, role: "ACCOUNTANT" } });
    const getRes = await getInvoice({} as any, { params: Promise.resolve({ id: invoice.id }) } as any);
    expect(getRes.status).toBe(200);
    const fetchedInvoice = await getRes.json();
    expect(fetchedInvoice.invoiceNumber).toBe(invoice.invoiceNumber);
    expect(fetchedInvoice.status).toBe("DRAFT");
  });

  describe("Payments", () => {
    let activeInvoice: any;

    beforeEach(async () => {
      // Create fresh invoice as ADMIN for each payment test
      setMockSession({ user: { id: assignedStaff.id, role: "ADMIN" } });
      const req = { json: async () => getPayload(client.id), headers: new Headers({}) } as any;
      const res = await createInvoice(req);
      activeInvoice = await res.json();
    });

    it("should reject unauthenticated payment (401)", async () => {
      setMockSession(null);
      const req = { json: async () => ({ amount: 100, method: "CASH" }), headers: new Headers({}) } as any;
      const res = await createPayment(req, { params: Promise.resolve({ id: activeInvoice.id }) } as any);
      expect(res.status).toBe(401);
    });

    it("should reject overpayment", async () => {
      setMockSession({ user: { id: assignedStaff.id, role: "ADMIN" } });
      const req = { json: async () => ({ amount: 3000.00, method: "BANK_TRANSFER" }), headers: new Headers({}) } as any;
      const paymentRes = await createPayment(req, { params: Promise.resolve({ id: activeInvoice.id }) } as any);
      expect(paymentRes.status).toBe(400);
      const result = await paymentRes.json();
      expect(result.error).toContain("OVERPAYMENT");
    });

    it("should handle partial payment and transition status to PARTIALLY_PAID", async () => {
      setMockSession({ user: { id: assignedStaff.id, role: "ADMIN" } });
      const req = { json: async () => ({ amount: 1000.00, method: "CASH" }), headers: new Headers({}) } as any;
      const res = await createPayment(req, { params: Promise.resolve({ id: activeInvoice.id }) } as any);
      expect(res.status).toBe(201);
      const result = await res.json();
      expect(result.invoice.status).toBe("PARTIALLY_PAID");
    });

    it("should block VOID if payments exist", async () => {
      setMockSession({ user: { id: assignedStaff.id, role: "ADMIN" } });
      // Make a partial payment first
      const payReq = { json: async () => ({ amount: 1000.00, method: "CASH" }), headers: new Headers({}) } as any;
      await createPayment(payReq, { params: Promise.resolve({ id: activeInvoice.id }) } as any);

      // Now try to VOID the invoice
      const patchReq = { json: async () => ({ status: "VOID" }), headers: new Headers({}) } as any;
      const patchRes = await patchInvoice(patchReq, { params: Promise.resolve({ id: activeInvoice.id }) } as any);
      expect(patchRes.status).toBe(400);
      const resJson = await patchRes.json();
      expect(resJson.error).toContain("Cannot void an invoice");
    });

    it("should handle full payment and transition to PAID", async () => {
      setMockSession({ user: { id: assignedStaff.id, role: "ADMIN" } });
      const req = { json: async () => ({ amount: 2100.00, method: "CASH" }), headers: new Headers({}) } as any;
      const res = await createPayment(req, { params: Promise.resolve({ id: activeInvoice.id }) } as any);
      expect(res.status).toBe(201);
      const result = await res.json();
      expect(result.invoice.status).toBe("PAID");
    });
  });

  it("should handle 10 concurrent invoice creations without transaction timeout and with unique numbers", async () => {
    setMockSession({ user: { id: assignedStaff.id, role: "ADMIN" } });
    const reqs = Array.from({ length: 10 }, () => ({
      json: async () => getPayload(client.id),
      headers: new Headers({})
    } as any));

    const responses = await Promise.all(reqs.map(req => createInvoice(req)));
    for (const res of responses) {
      expect(res.status).toBe(201);
    }

    const invoices = await Promise.all(responses.map(r => r.json()));
    const numbers = invoices.map(i => i.invoiceNumber);

    expect(numbers.length).toBe(10);
    const uniqueNumbers = new Set(numbers);
    expect(uniqueNumbers.size).toBe(10);
  }, 15000);

  it("should generate a VOID stub record if invoice creation fails after sequence allocation", async () => {
    setMockSession({ user: { id: assignedStaff.id, role: "ADMIN" } });
    
    // Pass payload with non-existent serviceSubscriptionId to force FK creation failure during transaction
    const badPayload = {
      ...getPayload(client.id),
      serviceSubscriptionId: "invalid-non-existent-sub-id"
    };

    const req = {
      json: async () => badPayload,
      headers: new Headers({})
    } as any;

    const res = await createInvoice(req);
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.invoiceNumber).toBeTruthy();
    expect(body.error).toContain("VOID stub");

    // Verify VOID stub exists in DB
    const stub = await prisma.invoice.findUnique({
      where: { invoiceNumber: body.invoiceNumber }
    });

    expect(stub).toBeDefined();
    expect(stub!.status).toBe("VOID");
    expect(stub!.notes).toContain("SYSTEM_VOID");
  });
});
