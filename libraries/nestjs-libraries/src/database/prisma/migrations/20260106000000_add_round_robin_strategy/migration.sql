-- AddRoundRobinStrategy
-- Add strategy field and roundRobinProviders field to AITaskAssignment table
-- This enables task-level round-robin provider rotation as an alternative to fallback mode

-- Step 1: Add strategy column as nullable (required for existing tables with data)
ALTER TABLE "AITaskAssignment" ADD COLUMN "strategy" TEXT;

-- Step 2: Update existing rows to set default value
UPDATE "AITaskAssignment" SET "strategy" = 'fallback' WHERE "strategy" IS NULL;

-- Step 3: Set the default value for new rows
ALTER TABLE "AITaskAssignment" ALTER COLUMN "strategy" SET DEFAULT 'fallback';

-- Step 4: Make the column NOT NULL
ALTER TABLE "AITaskAssignment" ALTER COLUMN "strategy" SET NOT NULL;

-- Add roundRobinProviders column for storing multiple providers in JSON format
ALTER TABLE "AITaskAssignment" ADD COLUMN "roundRobinProviders" TEXT;

-- Create index on strategy column for efficient queries
CREATE INDEX "AITaskAssignment_strategy_idx" ON "AITaskAssignment"("strategy");
