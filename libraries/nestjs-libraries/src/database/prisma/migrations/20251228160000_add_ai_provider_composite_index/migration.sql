-- Migration: Add composite index to AIProvider for optimized queries
-- This index improves performance of queries filtering by organizationId, type, and deletedAt
-- which are commonly used together in the AIProvidersService

-- Create composite index on AIProvider table
CREATE INDEX "AIProvider_organizationId_type_deletedAt_idx" ON "AIProvider"("organizationId", "type", "deletedAt");
