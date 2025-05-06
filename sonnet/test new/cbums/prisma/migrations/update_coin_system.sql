-- Step 1: Create a temporary column for coins 
ALTER TABLE "users" ADD COLUMN "temp_coins" INTEGER;

-- Step 2: Copy data from the old column to the new one
UPDATE "users" SET "temp_coins" = "coins";

-- Step 3: Drop the old column
ALTER TABLE "users" DROP COLUMN "coins";

-- Step 4: Rename the temporary column to the original name
ALTER TABLE "users" RENAME COLUMN "temp_coins" TO "coins";

-- Step 5: Update the TransactionReason type
CREATE TYPE "TransactionReason_new" AS ENUM ('ADMIN_CREATION', 'OPERATOR_CREATION', 'COIN_ALLOCATION', 'SESSION_CREATION');

-- Step 6: Convert the data
ALTER TABLE "coin_transactions" 
  ALTER COLUMN "reason" TYPE "TransactionReason_new" USING (
    CASE 
      WHEN "reason"::text = 'SESSION_START' THEN 'SESSION_CREATION'
      WHEN "reason"::text = 'MANUAL_TOPUP' THEN 'COIN_ALLOCATION'
      WHEN "reason"::text = 'ADMIN_TRANSFER' THEN 'COIN_ALLOCATION'
      WHEN "reason"::text = 'EMPLOYEE_TRANSFER' THEN 'COIN_ALLOCATION'
      ELSE 'COIN_ALLOCATION'
    END
  )::text::"TransactionReason_new";

-- Step 7: Drop the old enum type
DROP TYPE "TransactionReason";

-- Step 8: Rename the new enum type to the original name
ALTER TYPE "TransactionReason_new" RENAME TO "TransactionReason";

-- Step 9: Set coins to NULL for COMPANY and GUARD users
UPDATE "users" SET "coins" = NULL 
WHERE "role" = 'COMPANY' 
   OR ("role" = 'EMPLOYEE' AND "subrole" = 'GUARD'); 