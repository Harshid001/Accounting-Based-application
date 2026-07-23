import { vi } from "vitest";
import { PrismaClient } from "@prisma/client";

// ── Session Mock ─────────────────────────────────────────────────────────────
// All routes now use getServerSession(authOptions) instead of x-mock-* headers.
// This module lets individual tests inject a fake session per-call.

let _mockSession: { user: { id: string; role: string; email?: string; clientId?: string } } | null = null;

/**
 * Call this before a test to set the session that getServerSession will return.
 * Pass `null` to simulate an unauthenticated request (→ 401).
 */
export function setMockSession(session: {
  user: { id: string; role: string; email?: string; clientId?: string };
} | null) {
  _mockSession = session;
}

/** Reset the session back to null after each test if desired. */
export function clearMockSession() {
  _mockSession = null;
}

// Globally mock next-auth/next so every route import gets the fake session.
vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(async () => _mockSession),
}));

// ── Database Utilities ───────────────────────────────────────────────────────
const prisma = new PrismaClient();

export async function clearDatabase() {
  try {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "AuditLog", "Notification", "Comment", "PaymentIntent", "Payment", "InvoiceLineItem", "Invoice", "ComplianceItem", "Document", "Task", "ServiceSubscription", "Service", "User", "Client", "InvoiceCounter" RESTART IDENTITY CASCADE;'
    );
  } catch {
    await prisma.auditLog.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.comment.deleteMany({});
    await prisma.paymentIntent.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.invoiceLineItem.deleteMany({});
    await prisma.invoice.deleteMany({});
    await prisma.complianceItem.deleteMany({});
    await prisma.document.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.serviceSubscription.deleteMany({});
    await prisma.service.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.client.deleteMany({});
    await prisma.invoiceCounter.deleteMany({});
  }
}
