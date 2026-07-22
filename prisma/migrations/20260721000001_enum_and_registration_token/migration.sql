-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'STAFF', 'CLIENT');

-- AlterTable
ALTER TABLE "StaffInvite" DROP COLUMN "role",
ADD COLUMN     "role" "UserRole" NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'CLIENT';

-- DropTable
DROP TABLE "VerificationToken";

-- CreateTable
CREATE TABLE "RegistrationVerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationVerificationToken_token_key" ON "RegistrationVerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationVerificationToken_identifier_token_key" ON "RegistrationVerificationToken"("identifier", "token");
