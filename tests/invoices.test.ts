import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { clearDatabase } from "./setup";
import { POST as createInvoice } from "../src/app/api/invoices/route";
import { GET as getInvoice, PATCH as patchInvoice } from "../src/app/api/invoices/[id]/route";
import { POST as createPayment } from "../src/app/api/invoices/[id]/payments/route";

const prisma = new PrismaClient();

describe("Billing & Invoicing API", () => {
  let client: any;
  let assignedStaff: any;
  let unassignedStaff: any;

  beforeAll(async () => {
    await clearDatabase();
    // 1. Create a dummy client and dummy users
    client = await prisma.client.create({
      data: {
        name: "Test Client Inc",
        type: "BUSINESS",
        status: "ACTIVE"
      }
    });
    
    assignedStaff = await prisma.user.create({
      data: { email: "staff@test.com", role: "ACCOUNTANT" }
    });
    
    unassignedStaff = await prisma.user.create({
      data: { email: "unassigned@test.com", role: "ACCOUNTANT" }
    });

    // Assign staff
    await prisma.client.update({
      where: { id: client.id },
      data: { assignedTo: { connect: { id: assignedStaff.id } } }
    });
    
    // Pre-seed the invoice counter to prevent P2028 transaction deadlocks
    await prisma.invoiceCounter.create({
      data: {
        id: new Date().getFullYear().toString(),
        seq: 0
      }
    });
  });

  afterAll(async () => {
    await clearDatabase();
    await prisma.$disconnect();
  });

  const maliciousPayload = {
    clientId: "",
    dueDate: new Date(Date.now() + 86400000 * 30).toISOString(),
    notes: "Test invoice",
    total: 10.00, // Malicious total, should be ignored
    lineItems: [
      { description: "Audit Services", quantity: 1, unitPrice: 1000, taxRate: 10 }, // 1100
      { description: "Consulting", quantity: 2, unitPrice: 500, taxRate: 0 } // 1000 => 2100 total
    ]
  };

  beforeEach(() => {
    maliciousPayload.clientId = client.id;
  });

  it("should reject invoice creation for unassigned staff", async () => {
    const unassignedReq = { 
      json: async () => maliciousPayload,
      headers: new Headers({ "x-mock-role": "ACCOUNTANT", "x-mock-userid": unassignedStaff.id })
    } as any;
    
    const res = await createInvoice(unassignedReq);
    expect(res.status).toBe(403);
  });

  it("should reject invoice creation for CLIENT role", async () => {
    const clientRoleReq = { 
      json: async () => maliciousPayload,
      headers: new Headers({ "x-mock-role": "CLIENT", "x-mock-userid": "some-id" })
    } as any;
    const res = await createInvoice(clientRoleReq);
    expect(res.status).toBe(403);
  });

  it("should create invoice ignoring malicious total, generating correct INV- number", async () => {
    const assignedReq = { 
      json: async () => maliciousPayload,
      headers: new Headers({ "x-mock-role": "ACCOUNTANT", "x-mock-userid": assignedStaff.id })
    } as any;
    
    const res = await createInvoice(assignedReq);
    expect(res.status).toBe(201);
    const invoice = await res.json();
    
    expect(invoice.invoiceNumber).toMatch(/^INV-\d{4}-\d{4}$/);
    expect(Number(invoice.total)).toBe(2100);
  });

  it("should successfully fetch GET invoice", async () => {
    // create invoice first
    const assignedReq = { 
      json: async () => maliciousPayload,
      headers: new Headers({ "x-mock-role": "ACCOUNTANT", "x-mock-userid": assignedStaff.id })
    } as any;
    const res = await createInvoice(assignedReq);
    const invoice = await res.json();

    const getRes = await getInvoice({} as any, { params: { id: invoice.id } });
    expect(getRes.status).toBe(200);
    const fetchedInvoice = await getRes.json();
    expect(fetchedInvoice.invoiceNumber).toBe(invoice.invoiceNumber);
    expect(fetchedInvoice.status).toBe("DRAFT");
  });

  describe("Payments", () => {
    let activeInvoice: any;

    beforeEach(async () => {
      // create fresh invoice
      const assignedReq = { 
        json: async () => maliciousPayload,
        headers: new Headers({ "x-mock-role": "ADMIN" })
      } as any;
      const res = await createInvoice(assignedReq);
      activeInvoice = await res.json();
    });

    it("should reject overpayment", async () => {
      const overpaymentPayload = { amount: 3000.00, method: "BANK_TRANSFER" }; // 3000 > 2100
      
      const mockPaymentReq = { 
        json: async () => overpaymentPayload,
        headers: new Headers({ "x-mock-role": "ADMIN" })
      } as any;
      const paymentRes = await createPayment(mockPaymentReq, { params: { id: activeInvoice.id } });
      expect(paymentRes.status).toBe(400);
      const paymentResult = await paymentRes.json();
      expect(paymentResult.error).toContain("OVERPAYMENT");
    });

    it("should handle partial payment and transition status to PARTIALLY_PAID", async () => {
      const partialPayload = { amount: 1000.00, method: "CASH" };
      const partialReq = { json: async () => partialPayload, headers: new Headers({ "x-mock-role": "ADMIN" }) } as any;
      const partialRes = await createPayment(partialReq, { params: { id: activeInvoice.id } });
      
      expect(partialRes.status).toBe(201);
      const partialResult = await partialRes.json();
      expect(partialResult.invoice.status).toBe("PARTIALLY_PAID");
    });

    it("should block VOID if payments exist", async () => {
      // make partial payment
      const partialPayload = { amount: 1000.00, method: "CASH" };
      const partialReq = { json: async () => partialPayload, headers: new Headers({ "x-mock-role": "ADMIN" }) } as any;
      await createPayment(partialReq, { params: { id: activeInvoice.id } });

      // try void
      const patchReq = { 
        json: async () => ({ status: "VOID" }),
        headers: new Headers({ "x-mock-role": "ADMIN" }) 
      } as any;
      const patchRes = await patchInvoice(patchReq, { params: { id: activeInvoice.id } });
      
      expect(patchRes.status).toBe(400);
      const resJson = await patchRes.json();
      expect(resJson.error).toContain("Cannot void an invoice");
    });

    it("should handle full payment and transition to PAID", async () => {
      const fullPayload = { amount: 2100.00, method: "CASH" }; // Total is 2100
      const fullReq = { json: async () => fullPayload, headers: new Headers({ "x-mock-role": "ADMIN" }) } as any;
      const fullRes = await createPayment(fullReq, { params: { id: activeInvoice.id } });
      
      expect(fullRes.status).toBe(201);
      const fullResult = await fullRes.json();
      expect(fullResult.invoice.status).toBe("PAID");
    });
  });

  it("should handle concurrent invoice numbering", async () => {
    const req1 = { json: async () => maliciousPayload, headers: new Headers({ "x-mock-role": "ADMIN" }) } as any;
    const req2 = { json: async () => maliciousPayload, headers: new Headers({ "x-mock-role": "ADMIN" }) } as any;
    
    // Fire simultaneously
    const [res1, res2] = await Promise.all([
      createInvoice(req1),
      createInvoice(req2)
    ]);
    
    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    
    const inv1 = await res1.json();
    const inv2 = await res2.json();
    
    expect(inv1.invoiceNumber).toBeTruthy();
    expect(inv2.invoiceNumber).toBeTruthy();
    expect(inv1.invoiceNumber).not.toBe(inv2.invoiceNumber);
  });
});
