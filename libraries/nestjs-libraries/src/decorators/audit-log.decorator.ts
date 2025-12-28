import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';

/**
 * Extracts information about the current request for audit logging.
 *
 * @returns Request information including IP address and user agent
 *
 * @example
 * ```typescript
 * @Post()
 * @AuditLog('USER_CREATE', 'USER')
 * async createUser(@Body() body: CreateUserDto, @AuditInfo() auditInfo: AuditInfo) {
 *   await this.auditService.createLog({
 *     ...auditInfo,
 *     action: 'USER_CREATE',
 *     entityType: 'USER',
 *     entityId: createdUser.id,
 *     // ...
 *   });
 * }
 * ```
 */
export const AuditInfo = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): {
    ipAddress: string;
    userAgent: string;
  } => {
    const request = ctx.switchToHttp().getRequest();

    if (!request) {
      throw new InternalServerErrorException('Request not found');
    }

    // Get IP address from various possible locations
    const ipAddress =
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.headers['x-real-ip'] ||
      request.socket?.remoteAddress ||
      request.ip ||
      request.connection?.remoteAddress ||
      'unknown';

    // Get user agent
    const userAgent = request.headers['user-agent'] || 'unknown';

    return {
      ipAddress,
      userAgent,
    };
  }
);

/**
 * Audit Log Action Types
 *
 * Standard action types for audit logging.
 * Use these constants for consistency across the codebase.
 */
export const AuditAction = {
  // User actions
  USER_PROMOTE: 'USER_PROMOTE',
  USER_DEMOTE: 'USER_DEMOTE',
  USER_DELETE: 'USER_DELETE',
  USER_SET_QUOTAS: 'USER_SET_QUOTAS',

  // Organization actions
  ORG_CREATE: 'ORG_CREATE',
  ORG_UPDATE: 'ORG_UPDATE',
  ORG_DELETE: 'ORG_DELETE',
  ORG_SET_TIER: 'ORG_SET_TIER',
  ORG_SET_LIMITS: 'ORG_SET_LIMITS',
  ORG_BYPASS_BILLING: 'ORG_BYPASS_BILLING',
  ORG_MAKE_UNLIMITED: 'ORG_MAKE_UNLIMITED',

  // Settings actions
  SETTING_CREATE: 'SETTING_CREATE',
  SETTING_UPDATE: 'SETTING_UPDATE',
  SETTING_DELETE: 'SETTING_DELETE',
  SETTING_TIER_UPDATE: 'SETTING_TIER_UPDATE',
  SETTING_FEATURE_TOGGLE: 'SETTING_FEATURE_TOGGLE',

  // AI Provider actions
  AI_PROVIDER_CREATE: 'AI_PROVIDER_CREATE',
  AI_PROVIDER_UPDATE: 'AI_PROVIDER_UPDATE',
  AI_PROVIDER_DELETE: 'AI_PROVIDER_DELETE',
  AI_PROVIDER_TEST: 'AI_PROVIDER_TEST',
  AI_PROVIDER_SET_DEFAULT: 'AI_PROVIDER_SET_DEFAULT',

  // Bulk actions
  BULK_USER_PROMOTE: 'BULK_USER_PROMOTE',
  BULK_USER_DEMOTE: 'BULK_USER_DEMOTE',
  BULK_ORG_SET_TIER: 'BULK_ORG_SET_TIER',
  BULK_IMPORT: 'BULK_IMPORT',
  BULK_EXPORT: 'BULK_EXPORT',

  // Maintenance actions
  MAINTENANCE_RUN: 'MAINTENANCE_RUN',
  MAINTENANCE_CREATE: 'MAINTENANCE_CREATE',
  MAINTENANCE_UPDATE: 'MAINTENANCE_UPDATE',
  MAINTENANCE_DELETE: 'MAINTENANCE_DELETE',

  // Webhook actions
  WEBHOOK_CREATE: 'WEBHOOK_CREATE',
  WEBHOOK_UPDATE: 'WEBHOOK_UPDATE',
  WEBHOOK_DELETE: 'WEBHOOK_DELETE',
  WEBHOOK_TEST: 'WEBHOOK_TEST',

  // Email settings actions
  EMAIL_SETTINGS_UPDATE: 'EMAIL_SETTINGS_UPDATE',
  EMAIL_TEST: 'EMAIL_TEST',
} as const;

/**
 * Audit Log Entity Types
 *
 * Standard entity types for audit logging.
 */
export const AuditEntityType = {
  USER: 'USER',
  ORGANIZATION: 'ORGANIZATION',
  SETTING: 'SETTING',
  AI_PROVIDER: 'AI_PROVIDER',
  WEBHOOK: 'WEBHOOK',
  MAINTENANCE_TASK: 'MAINTENANCE_TASK',
  BULK_OPERATION: 'BULK_OPERATION',
  SUBSCRIPTION: 'SUBSCRIPTION',
} as const;

/**
 * Type for audit action
 */
export type AuditActionType = typeof AuditAction[keyof typeof AuditAction];

/**
 * Type for audit entity type
 */
export type AuditEntityTypeType = typeof AuditEntityType[keyof typeof AuditEntityType];
