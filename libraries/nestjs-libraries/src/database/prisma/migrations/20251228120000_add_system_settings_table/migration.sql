-- Create SystemSettings table for platform-wide configuration
/**
 * Admin Panel Migration: Create SystemSettings table
 * Stores key-value configuration pairs for system-wide settings
 * - key: Unique identifier for the setting (e.g., 'features.enable_ai', 'tier.standard')
 * - value: Setting value (stored as string, can be JSON for complex values)
 * - description: Optional description of what the setting controls
 * - updatedBy: ID of the admin who last modified the setting
 * - updatedAt: Timestamp of last modification
 */
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- Create unique index on key column
CREATE UNIQUE INDEX "SystemSettings_key_key" ON "SystemSettings"("key");

-- Create index on createdAt for sorting and filtering
CREATE INDEX "SystemSettings_createdAt_idx" ON "SystemSettings"("createdAt");

-- Add Role enum to support Role-based access control
/**
 * Admin Panel Migration: Add Role enum
 * Defines user roles for access control:
 * - SUPERADMIN: Full system access, can manage all users and settings
 * - ADMIN: Limited admin access (for future use)
 * - USER: Regular user access
 */
DO $$ BEGIN
    CREATE TYPE "Role" AS ENUM ('SUPERADMIN', 'ADMIN', 'USER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update existing users to have USER role by default (if column doesn't exist)
-- This is handled by Prisma's default value in the schema
