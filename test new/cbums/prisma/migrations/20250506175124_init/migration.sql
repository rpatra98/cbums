/*
  Warnings:

  - The values [SESSION_START,MANUAL_TOPUP,ADMIN_TRANSFER,EMPLOYEE_TRANSFER] on the enum `TransactionReason` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TransactionReason_new" AS ENUM ('ADMIN_CREATION', 'OPERATOR_CREATION', 'COIN_ALLOCATION', 'SESSION_CREATION');
ALTER TABLE "coin_transactions" ALTER COLUMN "reason" TYPE "TransactionReason_new" USING ("reason"::text::"TransactionReason_new");
ALTER TYPE "TransactionReason" RENAME TO "TransactionReason_old";
ALTER TYPE "TransactionReason_new" RENAME TO "TransactionReason";
DROP TYPE "TransactionReason_old";
COMMIT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "coins" DROP NOT NULL,
ALTER COLUMN "coins" DROP DEFAULT;
