-- Add admin panel fields to User table
/**
 * Admin Panel Migration: Add custom quota field to User table
 * Allows superAdmins to override default quotas for individual users
 */
ALTER TABLE "User" ADD COLUMN "customQuotas" TEXT;

-- Add admin panel fields to Organization table
/**
 * Admin Panel Migration: Add admin-related fields to Organization table
 * - bypassBilling: Allows admins to bypass billing checks for testing/self-hosted scenarios
 * - customLimits: JSON string with custom limits override for the organization
 */
ALTER TABLE "Organization" ADD COLUMN "bypassBilling" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "customLimits" TEXT;
