import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function spawnNextRecurringComplianceItem(
  item: {
    id: string;
    clientId: string;
    type: "GST" | "INCOME_TAX" | "SALES_TAX_VAT" | "TDS" | "ROC";
    dueDate: Date;
    notes?: string | null;
  },
  userId: string,
  tx?: Prisma.TransactionClient
) {
  const db = tx || prisma;
  const currentDueDate = new Date(item.dueDate);
  const nextDueDate = new Date(currentDueDate);

  switch (item.type) {
    case "GST":
      // Monthly recurrence (+1 month)
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      break;
    case "TDS":
    case "SALES_TAX_VAT":
      // Quarterly recurrence (+3 months)
      nextDueDate.setMonth(nextDueDate.getMonth() + 3);
      break;
    case "INCOME_TAX":
    case "ROC":
      // Annual recurrence (+1 year)
      nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
      break;
    default:
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);
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

  // Create next recurring compliance item
  const nextItem = await db.complianceItem.create({
    data: {
      clientId: item.clientId,
      type: item.type,
      status: "PENDING",
      dueDate: nextDueDate,
      notes: item.notes ? `Auto-recurring following item ${item.id}: ${item.notes}` : `Auto-recurring compliance item following item ${item.id}`
    }
  });

  // Log in AuditLog
  await db.auditLog.create({
    data: {
      entityType: "ComplianceItem",
      entityId: nextItem.id,
      action: "CREATE",
      userId,
      diff: {
        reason: "COMPLIANCE_RECURRENCE_AUTO_SPAWN",
        previousItemId: item.id,
        nextDueDate: nextDueDate.toISOString()
      }
    }
  });

  console.log(`[RecurrenceEngine] Auto-spawned next ${item.type} compliance item (${nextItem.id}) due on ${nextDueDate.toISOString()}`);
  return nextItem;
}
