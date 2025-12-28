import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { AdminAuditLog } from '@prisma/client';

/**
 * Audit log entry interface
 */
export interface AuditLogEntry {
  action: string;
  entityType: string;
  entityId: string;
  adminId: string;
  adminEmail: string;
  changes?: Record<string, { before?: unknown; after?: unknown }>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Audit log query options
 */
export interface AuditLogQuery {
  action?: string;
  entityType?: string;
  entityId?: string;
  adminId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Audit log query result with pagination
 */
export interface AuditLogResult {
  logs: AdminAuditLog[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Admin Audit Service
 *
 * Manages audit logging for all admin actions.
 * Tracks who did what, when, and with what changes.
 *
 * Best practices:
 * - Only log mutating actions (POST/PUT/PATCH/DELETE)
 * - Include before/after state for updates
 * - Log after the action completes successfully
 */
@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(private readonly _prismaService: PrismaService) {}

  /**
   * Create an audit log entry
   * @param entry - The audit log entry to create
   */
  async createLog(entry: AuditLogEntry): Promise<AdminAuditLog> {
    try {
      const log = await this._prismaService.adminAuditLog.create({
        data: {
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          adminId: entry.adminId,
          adminEmail: entry.adminEmail,
          changes: entry.changes ? JSON.stringify(entry.changes) : null,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      });

      this.logger.log(
        `Audit log created: ${entry.action} on ${entry.entityType}:${entry.entityId} by ${entry.adminEmail}`
      );

      return log;
    } catch (error) {
      // Don't throw errors for audit logging to avoid breaking admin operations
      this.logger.error(
        `Failed to create audit log: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return null as unknown as AdminAuditLog; // Return null on error
    }
  }

  /**
   * Query audit logs with filters
   * @param query - Query options
   * @returns Filtered audit logs with pagination
   */
  async queryLogs(query: AuditLogQuery): Promise<AuditLogResult> {
    const limit = Math.min(query.limit || 50, 500);
    const offset = Math.max(query.offset || 0, 0);

    const whereClause: Record<string, unknown> = {};

    if (query.action) {
      whereClause.action = query.action;
    }

    if (query.entityType) {
      whereClause.entityType = query.entityType;
    }

    if (query.entityId) {
      whereClause.entityId = query.entityId;
    }

    if (query.adminId) {
      whereClause.adminId = query.adminId;
    }

    if (query.startDate || query.endDate) {
      whereClause.createdAt = {};
      if (query.startDate) {
        (whereClause.createdAt as Record<string, unknown>).gte = query.startDate;
      }
      if (query.endDate) {
        (whereClause.createdAt as Record<string, unknown>).lte = query.endDate;
      }
    }

    const [logs, total] = await Promise.all([
      this._prismaService.adminAuditLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this._prismaService.adminAuditLog.count({ where: whereClause }),
    ]);

    return {
      logs,
      total,
      limit,
      offset,
    };
  }

  /**
   * Get audit logs for a specific entity
   * @param entityType - The type of entity
   * @param entityId - The ID of the entity
   * @returns Audit logs for the entity
   */
  async getEntityHistory(entityType: string, entityId: string): Promise<AdminAuditLog[]> {
    return this._prismaService.adminAuditLog.findMany({
      where: {
        entityType,
        entityId,
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit to 100 most recent
    });
  }

  /**
   * Get recent audit logs
   * @param limit - Number of recent logs to return
   * @returns Recent audit logs
   */
  async getRecentLogs(limit: number = 10): Promise<AdminAuditLog[]> {
    return this._prismaService.adminAuditLog.findMany({
      take: Math.min(limit, 100),
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get audit logs by action type
   * @param action - The action type to filter by
   * @param limit - Number of logs to return
   * @returns Audit logs with the specified action
   */
  async getLogsByAction(action: string, limit: number = 50): Promise<AdminAuditLog[]> {
    return this._prismaService.adminAuditLog.findMany({
      where: { action },
      take: Math.min(limit, 500),
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get audit logs by admin
   * @param adminId - The ID of the admin
   * @param limit - Number of logs to return
   * @returns Audit logs by the specified admin
   */
  async getLogsByAdmin(adminId: string, limit: number = 50): Promise<AdminAuditLog[]> {
    return this._prismaService.adminAuditLog.findMany({
      where: { adminId },
      take: Math.min(limit, 500),
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Export audit logs as CSV
   * @param query - Query options to filter logs
   * @returns CSV string of audit logs
   */
  async exportAsCsv(query: AuditLogQuery): Promise<string> {
    const limit = Math.min(query.limit || 10000, 50000); // Max 50k for export
    const offset = 0;

    const { logs } = await this.queryLogs({ ...query, limit, offset });

    // CSV header
    const headers = ['Timestamp', 'Action', 'Entity Type', 'Entity ID', 'Admin Email', 'IP Address', 'User Agent'];

    // Convert logs to CSV rows
    const rows = logs.map((log) => [
      log.createdAt.toISOString(),
      log.action,
      log.entityType,
      log.entityId,
      log.adminEmail,
      log.ipAddress || '',
      log.userAgent?.replace(/,/g, ' ') || '', // Escape commas in user agent
    ]);

    // Combine header and rows
    const csvRows = [headers, ...rows];

    // Convert to CSV string
    return csvRows.map((row) => row.join(',')).join('\n');
  }

  /**
   * Get audit log statistics
   * @returns Statistics about audit logs
   */
  async getStatistics(): Promise<{
    totalLogs: number;
    logsByAction: Record<string, number>;
    logsByEntityType: Record<string, number>;
    topAdmins: Array<{ email: string; count: number }>;
  }> {
    const [totalLogs, logsByAction, logsByEntityType, topAdmins] = await Promise.all([
      this._prismaService.adminAuditLog.count(),
      // Get count by action
      (this._prismaService.adminAuditLog.groupBy as any)({
        by: ['action'],
        _count: true,
        orderBy: { _count: { _all: 'desc' } },
        take: 20,
      }),
      // Get count by entity type
      (this._prismaService.adminAuditLog.groupBy as any)({
        by: ['entityType'],
        _count: true,
        orderBy: { _count: { _all: 'desc' } },
      }),
      // Get top admins
      (this._prismaService.adminAuditLog.groupBy as any)({
        by: ['adminEmail', 'adminId'],
        _count: true,
        orderBy: { _count: { _all: 'desc' } },
        take: 10,
      }),
    ]);

    // Convert groupBy results to Record<string, number>
    const byAction: Record<string, number> = {};
    for (const item of logsByAction) {
      byAction[item.action] = item._count;
    }

    const byEntityType: Record<string, number> = {};
    for (const item of logsByEntityType) {
      byEntityType[item.entityType] = item._count;
    }

    const topAdminsArray = topAdmins.map((item) => ({
      email: item.adminEmail,
      count: item._count,
    }));

    return {
      totalLogs,
      logsByAction: byAction,
      logsByEntityType: byEntityType,
      topAdmins: topAdminsArray,
    };
  }

  /**
   * Clean up old audit logs
   * @param daysToKeep - Number of days of logs to keep (default: 90)
   * @returns Number of logs deleted
   */
  async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this._prismaService.adminAuditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old audit logs (older than ${daysToKeep} days)`);

    return result.count;
  }
}
