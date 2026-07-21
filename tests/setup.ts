import { PrismaClient } from "@prisma/client";

// Ensure tests use the shadow/dev DB strictly
const prisma = new PrismaClient();

export async function clearDatabase() {
  await prisma.auditLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.complianceItem.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.client.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.invoiceCounter.deleteMany({});
}
