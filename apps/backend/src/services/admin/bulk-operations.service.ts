import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { AdminAuditService } from '@gitroom/backend/services/admin/admin-audit.service';
import { AuditAction, AuditEntityType } from '@gitroom/nestjs-libraries/decorators/audit-log.decorator';

/**
 * Bulk Operation Result
 *
 * Summary of a bulk operation execution.
 */
export interface BulkOperationResult {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: Array<{ id: string; message: string }>;
}

/**
 * Bulk User Operation Request
 */
export interface BulkUserOperationRequest {
  userIds: string[];
  operation: 'promote' | 'demote' | 'set_quotas' | 'reset_quotas';
  quotas?: Record<string, unknown>;
}

/**
 * Bulk Organization Operation Request
 */
export interface BulkOrganizationOperationRequest {
  organizationIds: string[];
  operation: 'set_tier' | 'set_limits' | 'reset_limits' | 'toggle_billing';
  tier?: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  limits?: Record<string, unknown>;
  bypassBilling?: boolean;
}

/**
 * CSV Import Result
 */
export interface CsvImportResult {
  totalRows: number;
  imported: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

/**
 * Bulk Operations Service
 *
 * Handles bulk administrative operations on users and organizations.
 * Supports:
 * - Bulk promote/demote users
 * - Bulk set user quotas
 * - Bulk set organization tiers
 * - Bulk set organization limits
 * - CSV import/export
 *
 * All operations are performed in a transaction where possible,
 * with detailed result reporting.
 */
@Injectable()
export class BulkOperationsService {
  private readonly logger = new Logger(BulkOperationsService.name);

  constructor(
    private readonly _prismaService: PrismaService,
    private readonly _auditService: AdminAuditService
  ) {}

  /**
   * Bulk promote users to superAdmin
   *
   * @param userIds - Array of user IDs to promote
   * @param adminId - ID of the admin performing the operation
   * @returns Operation result with success/failure counts
   */
  async bulkPromoteUsers(
    userIds: string[],
    adminId: string
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      total: userIds.length,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    const admin = await this._prismaService.user.findUnique({
      where: { id: adminId },
      select: { id: true, email: true },
    });

    if (!admin) {
      throw new Error('Admin user not found');
    }

    for (const userId of userIds) {
      try {
        // Prevent self-promotion
        if (userId === adminId) {
          result.skipped++;
          result.errors.push({ id: userId, message: 'Cannot promote yourself' });
          continue;
        }

        await this._prismaService.$transaction(async (tx) => {
          const user = await tx.user.findUnique({ where: { id: userId } });

          if (!user) {
            throw new Error('User not found');
          }

          if (user.isSuperAdmin) {
            throw new Error('User is already a superAdmin');
          }

          await tx.user.update({
            where: { id: userId },
            data: { isSuperAdmin: true },
          });
        });

        result.succeeded++;

        // Audit log for each successful promotion
        await this._auditService.createLog({
          action: AuditAction.USER_PROMOTE,
          entityType: AuditEntityType.USER,
          entityId: userId,
          adminId,
        });
      } catch (error) {
        result.failed++;
        result.errors.push({
          id: userId,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.logger.log(
      `Bulk promote completed: ${result.succeeded} succeeded, ${result.failed} failed, ${result.skipped} skipped`
    );

    return result;
  }

  /**
   * Bulk demote users from superAdmin
   *
   * @param userIds - Array of user IDs to demote
   * @param adminId - ID of the admin performing the operation
   * @returns Operation result with success/failure counts
   */
  async bulkDemoteUsers(
    userIds: string[],
    adminId: string
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      total: userIds.length,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    const admin = await this._prismaService.user.findUnique({
      where: { id: adminId },
      select: { id: true, email: true },
    });

    if (!admin) {
      throw new Error('Admin user not found');
    }

    // Count superAdmins to prevent demoting the last one
    const superAdminCount = await this._prismaService.user.count({
      where: { isSuperAdmin: true },
    });

    for (const userId of userIds) {
      try {
        // Prevent self-demotion
        if (userId === adminId) {
          result.skipped++;
          result.errors.push({ id: userId, message: 'Cannot demote yourself' });
          continue;
        }

        await this._prismaService.$transaction(async (tx) => {
          const user = await tx.user.findUnique({ where: { id: userId } });

          if (!user) {
            throw new Error('User not found');
          }

          // Check if this is the last superAdmin
          if (user.isSuperAdmin && superAdminCount <= 1) {
            throw new Error('Cannot demote the last superAdmin');
          }

          if (!user.isSuperAdmin) {
            throw new Error('User is not a superAdmin');
          }

          await tx.user.update({
            where: { id: userId },
            data: { isSuperAdmin: false },
          });
        });

        result.succeeded++;

        await this._auditService.createLog({
          action: AuditAction.USER_DEMOTE,
          entityType: AuditEntityType.USER,
          entityId: userId,
          adminId,
        });
      } catch (error) {
        result.failed++;
        result.errors.push({
          id: userId,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.logger.log(
      `Bulk demote completed: ${result.succeeded} succeeded, ${result.failed} failed, ${result.skipped} skipped`
    );

    return result;
  }

  /**
   * Bulk set organization tier
   *
   * @param organizationIds - Array of organization IDs
   * @param tier - Tier to set
   * @param adminId - ID of the admin performing the operation
   * @returns Operation result
   */
  async bulkSetOrganizationTier(
    organizationIds: string[],
    tier: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE',
    adminId: string
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      total: organizationIds.length,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    for (const orgId of organizationIds) {
      try {
        await this._prismaService.$transaction(async (tx) => {
          const org = await tx.organization.findUnique({ where: { id: orgId } });

          if (!org) {
            throw new Error('Organization not found');
          }

          await tx.organization.update({
            where: { id: orgId },
            data: { subscriptionTier: tier },
          });
        });

        result.succeeded++;

        await this._auditService.createLog({
          action: 'ORG_SET_TIER',
          entityType: AuditEntityType.ORGANIZATION,
          entityId: orgId,
          adminId,
          changes: JSON.stringify({ subscriptionTier: { before: '-', after: tier } }),
        });
      } catch (error) {
        result.failed++;
        result.errors.push({
          id: orgId,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.logger.log(
      `Bulk set tier completed: ${result.succeeded} succeeded, ${result.failed} failed`
    );

    return result;
  }

  /**
   * Bulk set organization limits
   *
   * @param organizationIds - Array of organization IDs
   * @param limits - Limits object to apply
   * @param adminId - ID of the admin performing the operation
   * @returns Operation result
   */
  async bulkSetOrganizationLimits(
    organizationIds: string[],
    limits: Record<string, unknown>,
    adminId: string
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      total: organizationIds.length,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    for (const orgId of organizationIds) {
      try {
        await this._prismaService.$transaction(async (tx) => {
          const org = await tx.organization.findUnique({ where: { id: orgId } });

          if (!org) {
            throw new Error('Organization not found');
          }

          await tx.organization.update({
            where: { id: orgId },
            data: { customLimits: JSON.stringify(limits) },
          });
        });

        result.succeeded++;

        await this._auditService.createLog({
          action: 'ORG_SET_LIMITS',
          entityType: AuditEntityType.ORGANIZATION,
          entityId: orgId,
          adminId,
          changes: JSON.stringify({ customLimits: limits }),
        });
      } catch (error) {
        result.failed++;
        result.errors.push({
          id: orgId,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.logger.log(
      `Bulk set limits completed: ${result.succeeded} succeeded, ${result.failed} failed`
    );

    return result;
  }

  /**
   * Parse CSV content for bulk import
   *
   * Expected format: header row with column names, data rows
   *
   * @param content - CSV file content
   * @param type - Import type ('users' or 'organizations')
   * @returns Parsed data with validation
   */
  async parseCsvImport(
    content: string,
    type: 'users' | 'organizations'
  ): Promise<{ headers: string[]; rows: Array<Record<string, string>> }> {
    const lines = content.trim().split('\n');
    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Parse header row
    const headers = this._parseCsvLine(lines[0]);
    const rows: Array<Record<string, string>> = [];

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = this._parseCsvLine(lines[i]);
      const row: Record<string, string> = {};

      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = values[j] || '';
      }

      rows.push(row);
    }

    return { headers, rows };
  }

  /**
   * Bulk import users from CSV
   *
   * Expected CSV columns:
   * - email (required)
   * - name
   * - isSuperAdmin
   * - customQuotas (JSON string)
   *
   * @param content - CSV file content
   * @param adminId - ID of the admin performing the operation
   * @returns Import result
   */
  async bulkImportUsersFromCsv(
    content: string,
    adminId: string
  ): Promise<CsvImportResult> {
    const result: CsvImportResult = {
      totalRows: 0,
      imported: 0,
      failed: 0,
      errors: [],
    };

    try {
      const { headers, rows } = await this.parseCsvImport(content, 'users');
      result.totalRows = rows.length;

      const emailColumn = headers.findIndex((h) =>
        h.toLowerCase().includes('email')
      );

      if (emailColumn === -1) {
        throw new Error('CSV must contain an "email" column');
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 2; // 1-indexed, accounting for header

        try {
          const email = row[headers[emailColumn]]?.trim();

          if (!email) {
            throw new Error('Email is required');
          }

          // Check if user exists
          const existingUser = await this._prismaService.user.findUnique({
            where: { email },
          });

          if (existingUser) {
            // Update existing user
            const updateData: any = {};

            if (row.name !== undefined) {
              updateData.name = row.name;
            }
            if (row.isSuperAdmin !== undefined) {
              updateData.isSuperAdmin = row.isSuperAdmin === 'true' || row.isSuperAdmin === '1';
            }
            if (row.customQuotas) {
              try {
                updateData.customQuotas = JSON.stringify(JSON.parse(row.customQuotas));
              } catch {
                // Invalid JSON, skip
              }
            }

            if (Object.keys(updateData).length > 0) {
              await this._prismaService.user.update({
                where: { email },
                data: updateData,
              });
            }

            result.imported++;
          } else {
            // Create new user (without password - will need to set/reset)
            await this._prismaService.user.create({
              data: {
                email,
                name: row.name || null,
                isSuperAdmin: row.isSuperAdmin === 'true' || row.isSuperAdmin === '1',
                customQuotas: row.customQuotas ? row.customQuotas : null,
              },
            });

            result.imported++;
          }
        } catch (error) {
          result.failed++;
          result.errors.push({
            row: rowNumber,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Audit log for bulk import
      await this._auditService.createLog({
        action: 'BULK_OPERATION',
        entityType: AuditEntityType.USER,
        entityId: 'bulk-import',
        adminId,
        changes: JSON.stringify({
          type: 'CSV_IMPORT_USERS',
          imported: result.imported,
          failed: result.failed,
        }),
      });
    } catch (error) {
      result.errors.push({
        row: 0,
        message: error instanceof Error ? error.message : 'Failed to parse CSV',
      });
    }

    this.logger.log(
      `Bulk import users completed: ${result.imported} imported, ${result.failed} failed`
    );

    return result;
  }

  /**
   * Export users to CSV format
   *
   * @param take - Maximum number of users to export
   * @param skip - Number of users to skip
   * @param search - Optional search filter
   * @returns CSV formatted string
   */
  async exportUsersToCsv(
    take = 1000,
    skip = 0,
    search?: string
  ): Promise<string> {
    const whereClause: any = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const users = await this._prismaService.user.findMany({
      where: whereClause,
      skip,
      take,
      select: {
        id: true,
        email: true,
        name: true,
        isSuperAdmin: true,
        customQuotas: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // CSV header
    const headers = ['id', 'email', 'name', 'isSuperAdmin', 'customQuotas', 'createdAt'];
    const lines = [headers.join(',')];

    // CSV rows
    for (const user of users) {
      const row = [
        user.id,
        user.email,
        user.name || '',
        user.isSuperAdmin ? 'true' : 'false',
        user.customQuotas || '',
        user.createdAt.toISOString(),
      ];
      lines.push(this._formatCsvRow(row));
    }

    return lines.join('\n');
  }

  /**
   * Parse a single CSV line handling quoted values
   *
   * @param line - CSV line to parse
   * @returns Array of values
   */
  private _parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  }

  /**
   * Format a row as CSV with proper quoting
   *
   * @param values - Array of values to format
   * @returns CSV formatted row
   */
  private _formatCsvRow(values: (string | number | boolean | null)[]): string {
    return values
      .map((v) => {
        const str = String(v ?? '');

        // Prevent CSV injection: escape values that start with formula characters
        // These characters can cause Excel/LibreOffice to interpret the value as a formula
        if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
          return `'${str}`; // Prefix with single quote to force text interpretation
        }

        // Quote if contains comma, quote, or newline
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(',');
  }
}
