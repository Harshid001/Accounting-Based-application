import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function testGaps() {
  console.log("=== STARTING REPORTING GAPS TESTS ===");
  try {
    const { getRevenueReportData } = require("./src/lib/reports.ts");
    
    // 1. Max Range
    console.log("\n--- Testing Max Range Cap ---");
    try {
      await getRevenueReportData("dummy", "ADMIN", "2020-01-01", "2026-01-01");
      console.error("Failed: Allowed > 5 years");
    } catch (e: any) {
      console.log(`Success! Max range blocked: ${e.message}`);
    }

    // 2. Client / Data Entry role
    console.log("\n--- Testing Role Rejections ---");
    try {
      await getRevenueReportData("dummy", "CLIENT");
      console.error("Failed: Allowed CLIENT");
    } catch (e: any) {
      console.log(`Success! CLIENT blocked: ${e.message}`);
    }
    
    try {
      await getRevenueReportData("dummy", "DATA_ENTRY");
      console.error("Failed: Allowed DATA_ENTRY");
    } catch (e: any) {
      console.log(`Success! DATA_ENTRY blocked: ${e.message}`);
    }
    
    // 3. Null handling for zero rows
    console.log("\n--- Testing Null _sum Fallback ---");
    // Ensure the DB is empty for a random client
    const res = await getRevenueReportData("dummy", "ADMIN", undefined, undefined, "no-exist-client");
    console.log(`Billed: ${res.metrics.totalBilled} | Collected: ${res.metrics.totalCollected}`);
    if (res.metrics.totalBilled === "0" && res.metrics.totalCollected === "0") {
      console.log("Success! null _sum safely falls back to '0'");
    }

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
testGaps();
