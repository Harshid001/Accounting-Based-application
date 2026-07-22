-- AlterTable
ALTER TABLE "ServiceSubscription" ADD COLUMN     "filingFrequency" TEXT;

-- AlterTable
ALTER TABLE "ComplianceItem" ADD COLUMN     "manualOverride" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "authMethod" TEXT,
ADD COLUMN     "ipAddress" TEXT;

