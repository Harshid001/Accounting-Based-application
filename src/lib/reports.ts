import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";
import { appCache } from "./cache";

const REPORT_CACHE_TTL = 120_000; // 2 minutes

export async function validateReportParams(userId: string, role: string, startDate?: string, endDate?: string, clientId?: string) {
  // 1. Validate dates
  const start = startDate ? new Date(startDate) : new Date(new Date().setFullYear(new Date().getFullYear() - 1));
  const end = endDate ? new Date(endDate) : new Date();

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error("Invalid date format");
  }

  if (end < start) {
    throw new Error("endDate cannot be before startDate");
  }

  const maxRangeMs = 5 * 365 * 24 * 60 * 60 * 1000;
  if (end.getTime() - start.getTime() > maxRangeMs) {
    throw new Error("Report date range cannot exceed 5 years");
  }

  // 2. Client Scoping
  let clientIdsFilter: string[] | undefined = undefined;
  
  if (role === "CLIENT") {
    clientIdsFilter = [clientId!]; // Handled above, must be their own
  } else if (role === "ADMIN") {
    if (clientId) {
      clientIdsFilter = [clientId];
    }
  } else if (role === "ACCOUNTANT" || role === "MANAGER" || role === "DATA_ENTRY") {
    const assignedClients = await prisma.client.findMany({
      where: {
        assignedTo: { some: { id: userId } }
      },
      select: { id: true }
    });
    const assignedIds = assignedClients.map(c => c.id);
    
    if (clientId) {
      if (!assignedIds.includes(clientId)) {
        throw new Error("FORBIDDEN: You do not have access to this client's data.");
      }
      clientIdsFilter = [clientId];
    } else {
      clientIdsFilter = assignedIds;
    }
  } else {
    throw new Error("FORBIDDEN: Access denied");
  }

  return { start, end, clientIdsFilter };
}

export async function getRevenueReportData(userId: string, role: string, startDate?: string, endDate?: string, clientId?: string) {
  // Check cache first — key includes all scoping params
  const cacheKey = `report:revenue:${userId}:${role}:${startDate || ""}:${endDate || ""}:${clientId || ""}`;
  const cached = appCache.get<any>(cacheKey);
  if (cached) return cached;

  const { start, end, clientIdsFilter } = await validateReportParams(userId, role, startDate, endDate, clientId);

  // Get Invoice totals
  const invoiceWhere: Prisma.InvoiceWhereInput = {
    issueDate: { gte: start, lte: end },
    ...(clientIdsFilter ? { clientId: { in: clientIdsFilter } } : {})
  };

  // Exclude VOID invoices from total billed
  const activeInvoiceWhere: Prisma.InvoiceWhereInput = {
    ...invoiceWhere,
    status: { not: "VOID" }
  };
  
  const activeInvoiceAgg = await prisma.invoice.aggregate({
    _sum: { total: true },
    where: activeInvoiceWhere
  });

  const totalBilled = activeInvoiceAgg._sum.total || new Prisma.Decimal(0);

  // Get Payment totals
  const paymentWhere: Prisma.PaymentWhereInput = {
    paymentDate: { gte: start, lte: end },
    invoice: clientIdsFilter ? { clientId: { in: clientIdsFilter } } : undefined
  };

  const paymentAgg = await prisma.payment.aggregate({
    _sum: { amount: true },
    where: paymentWhere
  });

  const totalCollected = paymentAgg._sum.amount || new Prisma.Decimal(0);
  
  // Outstanding balance (total billed - total collected) - note: this isn't strictly
  // outstanding balance for *these* invoices, but aggregate over the period.
  // Actually, standard outstanding balance is just billed - collected in the period.
  const outstandingBalance = totalBilled.minus(totalCollected);

  const result = {
    period: { start, end },
    metrics: {
      totalBilled: totalBilled.toString(),
      totalCollected: totalCollected.toString(),
      outstandingBalance: outstandingBalance.toString()
    }
  };

  appCache.set(cacheKey, result, REPORT_CACHE_TTL, ["reports", "reports:revenue"]);

  return result;
}

export async function getComplianceReportData(userId: string, role: string, startDate?: string, endDate?: string, clientId?: string) {
  // Check cache first
  const cacheKey = `report:compliance:${userId}:${role}:${startDate || ""}:${endDate || ""}:${clientId || ""}`;
  const cached = appCache.get<any>(cacheKey);
  if (cached) return cached;

  const { start, end, clientIdsFilter } = await validateReportParams(userId, role, startDate, endDate, clientId);

  const whereClause: Prisma.ComplianceItemWhereInput = {
    dueDate: { gte: start, lte: end },
    ...(clientIdsFilter ? { clientId: { in: clientIdsFilter } } : {})
  };

  // Status breakdown
  const statusCounts = await prisma.complianceItem.groupBy({
    by: ['status'],
    _count: { id: true },
    where: whereClause
  });

  // Type breakdown
  const typeCounts = await prisma.complianceItem.groupBy({
    by: ['type'],
    _count: { id: true },
    where: whereClause
  });

  // Overdue count (PENDING/IN_PROGRESS and dueDate < now)
  const overdueCount = await prisma.complianceItem.count({
    where: {
      ...whereClause,
      status: { in: ["PENDING", "IN_PROGRESS"] },
      dueDate: { lt: new Date() }
    }
  });

  const result = {
    period: { start, end },
    metrics: {
      statusBreakdown: statusCounts,
      typeBreakdown: typeCounts,
      overdueCount
    }
  };

  appCache.set(cacheKey, result, REPORT_CACHE_TTL, ["reports", "reports:compliance"]);

  return result;
}
