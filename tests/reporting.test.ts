import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { PrismaClient, type Client, type User } from "@prisma/client";
import type { NextRequest } from "next/server";
import { clearDatabase, setMockSession, clearMockSession } from "./setup";
import { getRevenueReportData } from "../src/lib/reports";
import { GET as exportReport } from "../src/app/api/reports/export/route";

const prisma = new PrismaClient();

describe("Reporting API", () => {
  let client1: Client;
  let client2: Client;
  let admin: User;
  let accountant: User;

  beforeAll(async () => {
    await clearDatabase();
    
    client1 = await prisma.client.create({ data: { name: "Client A", type: "BUSINESS", status: "ACTIVE" } });
    client2 = await prisma.client.create({ data: { name: "Client B", type: "BUSINESS", status: "ACTIVE" } });
    
    admin = await prisma.user.create({ data: { email: "admin@test.com", role: "ADMIN" } });
    accountant = await prisma.user.create({ data: { email: "acc@test.com", role: "ACCOUNTANT" } });

    await prisma.client.update({
      where: { id: client1.id },
      data: { assignedTo: { connect: { id: accountant.id } } }
    });

    // Create Decimal boundary invoices
    await prisma.invoice.create({
      data: {
        invoiceNumber: "INV-2026-R1",
        clientId: client1.id,
        dueDate: new Date(),
        subtotal: 10.01,
        taxTotal: 0,
        total: 10.01,
        status: "DRAFT"
      }
    });

    await prisma.invoice.create({
      data: {
        invoiceNumber: "INV-2026-R2",
        clientId: client1.id,
        dueDate: new Date(),
        subtotal: 20.02,
        taxTotal: 0,
        total: 20.02,
        status: "DRAFT"
      }
    });
  });

  afterEach(() => {
    clearMockSession();
  });

  afterAll(async () => {
    await clearDatabase();
    await prisma.$disconnect();
  });

  it("should maintain decimal precision in revenue report", async () => {
    const revenueData = await getRevenueReportData(admin.id, "ADMIN");
    expect(revenueData.metrics.totalBilled).toBe("30.03");
  });

  it("should allow accountant to access assigned client report", async () => {
    const revenueData = await getRevenueReportData(accountant.id, "ACCOUNTANT", undefined, undefined, client1.id);
    expect(revenueData).toBeDefined();
  });

  it("should block accountant from unassigned client", async () => {
    await expect(
      getRevenueReportData(accountant.id, "ACCOUNTANT", undefined, undefined, client2.id)
    ).rejects.toThrow("FORBIDDEN");
  });

  it("should block endDate before startDate", async () => {
    await expect(
      getRevenueReportData(admin.id, "ADMIN", "2025-01-01", "2024-01-01")
    ).rejects.toThrow();
  });

  it("should reject unauthenticated export request (401)", async () => {
    setMockSession(null);
    const mockReq = { 
      url: "http://localhost:3000/api/reports/export?format=pdf&type=revenue",
      headers: new Headers({})
    } as unknown as NextRequest;
    const res = await exportReport(mockReq);
    expect(res.status).toBe(401);
  });

  it("should successfully generate PDF stream and create audit log", async () => {
    setMockSession({ user: { id: admin.id, role: "ADMIN" } });
    const mockReq = { 
      url: "http://localhost:3000/api/reports/export?format=pdf&type=revenue",
      headers: new Headers({})
    } as unknown as NextRequest;
    
    const res = await exportReport(mockReq);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    
    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "Report", action: "EXPORT" }
    });
    expect(audit).toBeTruthy();
  });
});
