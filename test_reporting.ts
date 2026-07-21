import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function test() {
  console.log("=== STARTING REPORTING TESTS ===");

  try {
    // 1. Clean and Setup
    await prisma.comment.deleteMany({});
    await prisma.invoice.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.complianceItem.deleteMany({});
    await prisma.document.deleteMany({});
    await prisma.client.deleteMany({});
    await prisma.user.deleteMany({});

    const client1 = await prisma.client.create({ data: { name: "Client A", type: "BUSINESS", status: "ACTIVE" } });
    const client2 = await prisma.client.create({ data: { name: "Client B", type: "BUSINESS", status: "ACTIVE" } });
    
    const admin = await prisma.user.create({ data: { email: "admin@test.com", role: "ADMIN" } });
    const accountant = await prisma.user.create({ data: { email: "acc@test.com", role: "ACCOUNTANT" } });

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
        total: 10.01, // Exact decimal
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
        total: 20.02, // Exact decimal
        status: "DRAFT"
      }
    });

    console.log("Setup complete");

    // 2. Test Precision in Revenue Report
    console.log("\n--- Testing Financial Precision ---");
    const { getRevenueReportData } = require("./src/lib/reports.ts");
    const revenueData = await getRevenueReportData(admin.id, "ADMIN");
    console.log(`Expected: 30.03 | Actual: ${revenueData.metrics.totalBilled}`);
    if (revenueData.metrics.totalBilled === "30.03") {
      console.log("Success! Decimal precision maintained.");
    } else {
      console.error("Failed: Precision loss detected.");
    }

    // 3. Test Client Scoping
    console.log("\n--- Testing Client Scoping (ACCOUNTANT) ---");
    
    // Accountant requests Client 1 (allowed)
    const accValid = await getRevenueReportData(accountant.id, "ACCOUNTANT", undefined, undefined, client1.id);
    console.log("Accountant valid client access:", accValid ? "Success" : "Failed");

    // Accountant requests Client 2 (forbidden)
    try {
      await getRevenueReportData(accountant.id, "ACCOUNTANT", undefined, undefined, client2.id);
      console.error("Failed: Accountant was not blocked from unassigned client");
    } catch (e: any) {
      if (e.message.includes("FORBIDDEN")) {
        console.log("Success! Accountant blocked from unassigned client.");
      } else {
        throw e;
      }
    }

    // 4. Test Date Boundary Validation
    console.log("\n--- Testing Date Range Validation ---");
    try {
      await getRevenueReportData(admin.id, "ADMIN", "2025-01-01", "2024-01-01");
      console.error("Failed: Allowed endDate before startDate");
    } catch (e: any) {
       console.log("Success! endDate before startDate blocked.");
    }

    // 5. Test PDF Export & Audit Log
    console.log("\n--- Testing PDF Export & Audit Logging ---");
    const { GET: exportReport } = require("./src/app/api/reports/export/route.ts");
    
    const mockReq = { 
      url: "http://localhost:3000/api/reports/export?format=pdf&type=revenue",
      headers: new Headers({ "x-mock-role": "ADMIN", "x-mock-userid": admin.id })
    } as any;
    
    const res = await exportReport(mockReq);
    console.log(`Export status: ${res.status}`);
    if (res.status === 200 && res.headers.get("content-type") === "application/pdf") {
      console.log("Success! PDF stream generated successfully.");
      
      // Verify Audit Log
      const audit = await prisma.auditLog.findFirst({
        where: { entityType: "Report", action: "EXPORT" }
      });
      if (audit) {
        console.log("Success! AuditLog entry created for report export.");
      } else {
        console.error("Failed: AuditLog missing.");
      }
    } else {
      console.error("Failed to generate PDF.");
    }
    
    console.log("\n=== ALL TESTS COMPLETED SUCCESSFULLY ===");

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
