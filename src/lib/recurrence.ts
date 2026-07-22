import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function spawnNextRecurringComplianceItem(
  item: {
    id: string;
    clientId: string;
    type: "GST" | "INCOME_TAX" | "SALES_TAX_VAT" | "TDS" | "ROC";
    dueDate: Date;
    notes?: string | null;
    manualOverride: boolean;
  },
  userId: string,
  tx?: Prisma.TransactionClient
) {
  const db = tx || prisma;
  
  // 1. If manual override is on, or if the type is ROC or TDS, NEVER auto-spawn.
  // ROC due dates are tied to AGM dates.
  // TDS involves two distinct cadences simultaneously (return vs payment).
  // Both require a real rules engine, not a fixed interval.
  if (item.manualOverride || item.type === "ROC" || item.type === "TDS") {
    console.log(`[RecurrenceEngine] Skipped auto-spawn for item ${item.id} (override: ${item.manualOverride}, type: ${item.type})`);
    return null;
  }

  // 2. Fetch the client's service subscription to get their specific filing frequency.
  // We no longer guess defaults based on type (e.g. GST QRMP scheme has different intervals).
  // Note on TDS: TDS has a dual cadence (quarterly return, monthly payment). Because `filingFrequency`
  // is currently a single string, TDS clients will need `manualOverride = true` indefinitely until
  // a dedicated tax rules engine splits this into two tracked obligations.
  let serviceName = "";
  if (item.type === "GST") serviceName = "GST Filing";
  else if (item.type === "INCOME_TAX") serviceName = "Income Tax Return";
  else if (item.type === "SALES_TAX_VAT") serviceName = "Sales Tax/VAT";

  const subscription = await db.serviceSubscription.findFirst({
    where: {
      clientId: item.clientId,
      service: { name: serviceName }
    }
  });

  if (!subscription || !subscription.filingFrequency) {
    console.log(`[RecurrenceEngine] Skipped auto-spawn for item ${item.id} (no explicit filingFrequency set in subscription)`);
    return null;
  }

  const currentDueDate = new Date(item.dueDate);
  const nextDueDate = new Date(currentDueDate);
  const freq = subscription.filingFrequency.toUpperCase();

  if (freq === "MONTHLY") {
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);
  } else if (freq === "QUARTERLY") {
    nextDueDate.setMonth(nextDueDate.getMonth() + 3);
  } else if (freq === "ANNUALLY") {
    nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
  } else {
    console.log(`[RecurrenceEngine] Skipped auto-spawn for item ${item.id} (unknown frequency: ${freq})`);
    return null;
  }

  // Check if a compliance item already exists for this client, type, and next due date (or month/year window)
  const windowStart = new Date(nextDueDate);
  windowStart.setDate(1);
  windowStart.setHours(0, 0, 0, 0);

  const windowEnd = new Date(windowStart);
  windowEnd.setMonth(windowEnd.getMonth() + 1);

  const existing = await db.complianceItem.findFirst({
    where: {
      clientId: item.clientId,
      type: item.type,
      dueDate: {
        gte: windowStart,
        lt: windowEnd
      }
    }
  });

  if (existing) {
    console.log(`[RecurrenceEngine] Next compliance item already exists (${existing.id}) for client ${item.clientId}`);
    return existing;
  }

  // Create the next period's compliance item
  const nextItem = await db.complianceItem.create({
    data: {
      clientId: item.clientId,
      type: item.type,
      dueDate: nextDueDate,
      status: "PENDING",
      manualOverride: true, // New items generated default to manualOverride=true to force review
    }
  });

  await db.auditLog.create({
    data: {
      entityType: "ComplianceItem",
      entityId: nextItem.id,
      action: "CREATE_AUTO_RECURRENCE",
      userId: userId,
      authMethod: "SYSTEM",
      diff: { sourceItemId: item.id, newDueDate: nextDueDate }
    }
  });

  console.log(`[RecurrenceEngine] Spawned next item (${nextItem.id}) for client ${item.clientId}, due ${nextDueDate.toISOString()}`);
  return nextItem;
}
