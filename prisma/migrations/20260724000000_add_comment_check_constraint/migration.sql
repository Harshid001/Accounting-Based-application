ALTER TABLE "Comment" DROP CONSTRAINT IF EXISTS "Comment_check_exactly_one_parent";

ALTER TABLE "Comment" ADD CONSTRAINT "Comment_check_exactly_one_parent" CHECK (
  (
    (CASE WHEN "taskId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "documentId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "complianceItemId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "invoiceId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "clientId" IS NOT NULL THEN 1 ELSE 0 END)
  ) <= 1
);
