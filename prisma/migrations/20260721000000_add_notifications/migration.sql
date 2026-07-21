-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('COMPLIANCE_DEADLINE', 'TASK_ASSIGNED', 'GENERAL');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'PUSH', 'IN_APP');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "relatedComplianceItemId" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "triggerOffset" INTEGER,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Notification_recipientId_relatedComplianceItemId_type_tri_key" ON "Notification"("recipientId", "relatedComplianceItemId", "type", "triggerOffset");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_relatedComplianceItemId_fkey" FOREIGN KEY ("relatedComplianceItemId") REFERENCES "ComplianceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
