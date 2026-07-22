/**
 * Forensic Audit Script
 * Checks for records created during the x-mock-userid bypass window.
 * Run: npx ts-node forensic_audit.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runForensicAudit() {
  console.log("=== FORENSIC AUDIT: Auth Bypass Window Check ===\n");

  // 1. AuditLog entries with dummy_user userId
  const dummyAuditLogs = await prisma.auditLog.findMany({
    where: { userId: "dummy_user" },
    orderBy: { createdAt: "asc" }
  });

  console.log(`[1] AuditLog entries with userId='dummy_user': ${dummyAuditLogs.length}`);
  if (dummyAuditLogs.length > 0) {
    console.log("    ⚠️  DATA INTEGRITY INCIDENT — Review the following records:");
    dummyAuditLogs.forEach(log => {
      console.log(`    - [${log.createdAt.toISOString()}] ${log.action} on ${log.entityType} (${log.entityId})`);
    });
  } else {
    console.log("    ✅ None found.");
  }

  // 2. Comments authored by dummy_user
  const dummyComments = await prisma.comment.findMany({
    where: { authorId: "dummy_user" }
  });
  console.log(`\n[2] Comments with authorId='dummy_user': ${dummyComments.length}`);
  if (dummyComments.length > 0) {
    console.log("    ⚠️  INCIDENT — Forged comments exist:");
    dummyComments.forEach(c => console.log(`    - [${c.createdAt.toISOString()}] "${c.content.substring(0, 80)}"`));
  } else {
    console.log("    ✅ None found.");
  }

  // 3. Invoices created without a valid User reference (createdById if tracked, else check AuditLog)
  const suspiciousInvoiceLogs = await prisma.auditLog.findMany({
    where: {
      entityType: "Invoice",
      action: "CREATE",
      userId: "dummy_user"
    }
  });
  console.log(`\n[3] Invoices created via dummy_user (AuditLog): ${suspiciousInvoiceLogs.length}`);
  if (suspiciousInvoiceLogs.length > 0) {
    console.log("    ⚠️  INCIDENT — Forged invoices may exist. Recommend voiding:");
    suspiciousInvoiceLogs.forEach(log => {
      console.log(`    - Invoice ID: ${log.entityId} at ${log.createdAt.toISOString()}`);
    });
  } else {
    console.log("    ✅ None found.");
  }

  // 4. Payments created via dummy_user
  const suspiciousPaymentLogs = await prisma.auditLog.findMany({
    where: {
      entityType: "Payment",
      userId: "dummy_user"
    }
  });
  console.log(`\n[4] Payments recorded via dummy_user (AuditLog): ${suspiciousPaymentLogs.length}`);
  if (suspiciousPaymentLogs.length > 0) {
    console.log("    ⚠️  INCIDENT — Forged payments detected. Require manual review:");
    suspiciousPaymentLogs.forEach(log => {
      console.log(`    - Payment entity: ${log.entityId} at ${log.createdAt.toISOString()}`);
    });
  } else {
    console.log("    ✅ None found.");
  }

  // 5. Report exports by dummy_user
  const suspiciousReportLogs = await prisma.auditLog.findMany({
    where: {
      entityType: "Report",
      action: "EXPORT",
      userId: "dummy_user"
    }
  });
  console.log(`\n[5] Report exports by dummy_user: ${suspiciousReportLogs.length}`);
  if (suspiciousReportLogs.length > 0) {
    console.log("    ⚠️  INCIDENT — Revenue/compliance data may have been exported without auth:");
    suspiciousReportLogs.forEach(log => {
      console.log(`    - [${log.createdAt.toISOString()}] diff: ${JSON.stringify(log.diff)}`);
    });
  } else {
    console.log("    ✅ None found.");
  }

  // 6. Any user whose ID doesn't exist in User table but appears in AuditLog (orphaned actors)
  const allAuditActors = await prisma.auditLog.groupBy({
    by: ["userId"],
    _count: { userId: true }
  });
  const allUserIds = new Set(
    (await prisma.user.findMany({ select: { id: true } })).map(u => u.id)
  );
  const orphanActors = allAuditActors.filter(a => !allUserIds.has(a.userId));
  console.log(`\n[6] AuditLog actors not in User table (orphaned/forged): ${orphanActors.length}`);
  if (orphanActors.length > 0) {
    console.log("    ⚠️  INCIDENT — Unknown actors in audit trail:");
    orphanActors.forEach(a => console.log(`    - userId: ${a.userId} (${a._count.userId} entries)`));
  } else {
    console.log("    ✅ All audit actors correspond to real users.");
  }

  console.log("\n=== AUDIT COMPLETE ===");
  await prisma.$disconnect();
}

runForensicAudit().catch(e => {
  console.error("Forensic audit failed:", e);
  process.exit(1);
});
