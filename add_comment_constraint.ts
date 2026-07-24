import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Adding CHECK constraint to Comment table...");
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Comment" DROP CONSTRAINT IF EXISTS "Comment_check_exactly_one_parent";
    `);
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Comment" ADD CONSTRAINT "Comment_check_exactly_one_parent" CHECK (
        (
          (CASE WHEN "taskId" IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN "documentId" IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN "complianceItemId" IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN "invoiceId" IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN "clientId" IS NOT NULL THEN 1 ELSE 0 END)
        ) <= 1
      );
    `);
    console.log("Constraint added successfully.");
  } catch (error) {
    console.error("Failed to add constraint:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
