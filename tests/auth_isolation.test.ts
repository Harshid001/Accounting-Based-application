/**
 * Authorization Isolation Tests
 * Proves that authentication ≠ authorization:
 * - An authenticated CLIENT cannot see another client's invoices
 * - An authenticated ACCOUNTANT cannot see invoices for unassigned clients
 * - A DATA_ENTRY user gets 403 on payment recording
 * - A CLIENT cannot call POST /api/invoices at all
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { clearDatabase, setMockSession, clearMockSession } from "./setup";
import { POST as createInvoice, GET as listInvoices } from "../src/app/api/invoices/route";
import { GET as getInvoice } from "../src/app/api/invoices/[id]/route";
import { POST as createPayment } from "../src/app/api/invoices/[id]/payments/route";

const prisma = new PrismaClient();

describe("Authorization Isolation (authentication ≠ authorization)", () => {
  let clientA: any;
  let clientB: any;
  let clientAUser: any;     // CLIENT role linked to clientA
  let clientBUser: any;     // CLIENT role linked to clientB
  let accountantA: any;     // ACCOUNTANT assigned to clientA only
  let dataEntryUser: any;   // DATA_ENTRY — no invoice/payment rights
  let adminUser: any;
  let invoiceA: any;        // Invoice belonging to clientA
  let invoiceB: any;        // Invoice belonging to clientB

  beforeAll(async () => {
    await clearDatabase();

    clientA = await prisma.client.create({ data: { name: "Client A", type: "BUSINESS", status: "ACTIVE" } });
    clientB = await prisma.client.create({ data: { name: "Client B", type: "BUSINESS", status: "ACTIVE" } });

    adminUser = await prisma.user.create({ data: { email: "admin@iso.test", role: "ADMIN" } });
    clientAUser = await prisma.user.create({ data: { email: "clienta@iso.test", role: "CLIENT", clientId: clientA.id } });
    clientBUser = await prisma.user.create({ data: { email: "clientb@iso.test", role: "CLIENT", clientId: clientB.id } });
    accountantA = await prisma.user.create({ data: { email: "acca@iso.test", role: "ACCOUNTANT" } });
    dataEntryUser = await prisma.user.create({ data: { email: "data@iso.test", role: "DATA_ENTRY" } });

    // Assign accountantA to clientA only — NOT clientB
    await prisma.client.update({
      where: { id: clientA.id },
      data: { assignedTo: { connect: { id: accountantA.id } } }
    });

    // Pre-seed invoice counter
    await prisma.invoiceCounter.upsert({
      where: { id: new Date().getFullYear().toString() },
      create: { id: new Date().getFullYear().toString(), seq: 100 },
      update: {}
    });

    const lineItems = [{ description: "Service", quantity: 1, unitPrice: 500, taxRate: 0 }];

    // Create invoice for clientA (as admin)
    setMockSession({ user: { id: adminUser.id, role: "ADMIN" } });
    const resA = await createInvoice({
      json: async () => ({ clientId: clientA.id, dueDate: new Date(Date.now() + 864e5).toISOString(), lineItems }),
      headers: new Headers({})
    } as any);
    invoiceA = await resA.json();

    // Create invoice for clientB (as admin)
    const resB = await createInvoice({
      json: async () => ({ clientId: clientB.id, dueDate: new Date(Date.now() + 864e5).toISOString(), lineItems }),
      headers: new Headers({})
    } as any);
    invoiceB = await resB.json();
  });

  afterEach(() => clearMockSession());

  afterAll(async () => {
    await clearDatabase();
    await prisma.$disconnect();
  });

  // ─── CLIENT role isolation ────────────────────────────────────────────────

  it("CLIENT A cannot fetch CLIENT B's invoice by ID → 403", async () => {
    setMockSession({ user: { id: clientAUser.id, role: "CLIENT", clientId: clientA.id } });
    const res = await getInvoice({} as any, { params: Promise.resolve({ id: invoiceB.id }) } as any);
    expect(res.status).toBe(403);
  });

  it("CLIENT A cannot see CLIENT B's invoice in list (scoped to own clientId)", async () => {
    setMockSession({ user: { id: clientAUser.id, role: "CLIENT", clientId: clientA.id } });
    const res = await listInvoices({ url: "http://localhost/api/invoices" } as any);
    expect(res.status).toBe(200);
    const invoices = await res.json();
    const ids = invoices.map((i: any) => i.id);
    expect(ids).toContain(invoiceA.id);
    expect(ids).not.toContain(invoiceB.id);
  });

  it("CLIENT cannot call POST /api/invoices → 403", async () => {
    setMockSession({ user: { id: clientAUser.id, role: "CLIENT", clientId: clientA.id } });
    const res = await createInvoice({
      json: async () => ({ clientId: clientA.id, dueDate: new Date().toISOString(), lineItems: [{ description: "x", quantity: 1, unitPrice: 100, taxRate: 0 }] }),
      headers: new Headers({})
    } as any);
    expect(res.status).toBe(403);
  });

  // ─── ACCOUNTANT role isolation ────────────────────────────────────────────

  it("ACCOUNTANT assigned to A cannot fetch CLIENT B's invoice by ID → 403", async () => {
    setMockSession({ user: { id: accountantA.id, role: "ACCOUNTANT" } });
    const res = await getInvoice({} as any, { params: Promise.resolve({ id: invoiceB.id }) } as any);
    expect(res.status).toBe(403);
  });

  it("ACCOUNTANT assigned to A cannot see CLIENT B's invoice in list", async () => {
    setMockSession({ user: { id: accountantA.id, role: "ACCOUNTANT" } });
    const res = await listInvoices({ url: "http://localhost/api/invoices" } as any);
    expect(res.status).toBe(200);
    const invoices = await res.json();
    const ids = invoices.map((i: any) => i.id);
    expect(ids).toContain(invoiceA.id);
    expect(ids).not.toContain(invoiceB.id);
  });

  it("ACCOUNTANT cannot request clientB invoices via ?clientId param → 403", async () => {
    setMockSession({ user: { id: accountantA.id, role: "ACCOUNTANT" } });
    const res = await listInvoices({ url: `http://localhost/api/invoices?clientId=${clientB.id}` } as any);
    expect(res.status).toBe(403);
  });

  it("ACCOUNTANT can fetch their own assigned client's invoice by ID → 200", async () => {
    setMockSession({ user: { id: accountantA.id, role: "ACCOUNTANT" } });
    const res = await getInvoice({} as any, { params: Promise.resolve({ id: invoiceA.id }) } as any);
    expect(res.status).toBe(200);
  });

  // ─── DATA_ENTRY isolation ─────────────────────────────────────────────────

  it("DATA_ENTRY cannot record payment → 403", async () => {
    setMockSession({ user: { id: dataEntryUser.id, role: "DATA_ENTRY" } });
    const res = await createPayment(
      { json: async () => ({ amount: 100, method: "CASH" }), headers: new Headers({}) } as any,
      { params: Promise.resolve({ id: invoiceA.id }) } as any
    );
    expect(res.status).toBe(403);
  });

  it("DATA_ENTRY cannot create invoices → 403", async () => {
    setMockSession({ user: { id: dataEntryUser.id, role: "DATA_ENTRY" } });
    const res = await createInvoice({
      json: async () => ({ clientId: clientA.id, dueDate: new Date().toISOString(), lineItems: [{ description: "x", quantity: 1, unitPrice: 100, taxRate: 0 }] }),
      headers: new Headers({})
    } as any);
    expect(res.status).toBe(403);
  });

  // ─── ADMIN sanity check ───────────────────────────────────────────────────

  it("ADMIN can see all invoices in list", async () => {
    setMockSession({ user: { id: adminUser.id, role: "ADMIN" } });
    const res = await listInvoices({ url: "http://localhost/api/invoices" } as any);
    expect(res.status).toBe(200);
    const invoices = await res.json();
    const ids = invoices.map((i: any) => i.id);
    expect(ids).toContain(invoiceA.id);
    expect(ids).toContain(invoiceB.id);
  });
});
