-- Remove BOTH from UserType enum
-- First, update any existing BOTH users to HOST (data migration)
UPDATE "users" SET "userType" = 'HOST' WHERE "userType" = 'BOTH';

-- PostgreSQL requires recreating the enum to remove a value
-- Step 1: Create new enum without BOTH
CREATE TYPE "UserType_new" AS ENUM ('HOST', 'GUEST');

-- Step 2: Update column to use new enum
ALTER TABLE "users" ALTER COLUMN "userType" TYPE "UserType_new" USING ("userType"::text::"UserType_new");

-- Step 3: Drop old enum and rename new one
DROP TYPE "UserType";
ALTER TYPE "UserType_new" RENAME TO "UserType";
