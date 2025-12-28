import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Query,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AdminGuard } from '@gitroom/nestjs-libraries/guards/admin.guard';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { User } from '@prisma/client';
import { BulkOperationsService } from '@gitroom/backend/services/admin/bulk-operations.service';
import { Throttle } from '@nestjs/throttler';
import type {
  BulkOperationResult,
  BulkUserOperationRequest,
  BulkOrganizationOperationRequest,
  CsvImportResult,
} from '@gitroom/backend/services/admin/bulk-operations.service';

/**
 * Admin Bulk Operations Controller
 *
 * Manages bulk administrative operations:
 * - Bulk promote/demote users
 * - Bulk set user quotas
 * - Bulk set organization tiers
 * - Bulk set organization limits
 * - CSV import/export for users
 *
 * All endpoints require superAdmin privileges (protected by AdminGuard)
 *
 * @see AdminGuard
 * @see BulkOperationsService
 */
@ApiTags('Admin - Bulk Operations')
@Controller('/api/admin/bulk')
@UseGuards(AdminGuard)
export class BulkOperationsController {
  /**
   * Constructor
   * @param _bulkService - Bulk operations service
   */
  constructor(private readonly _bulkService: BulkOperationsService) {}

  /**
   * Bulk promote users to superAdmin
   *
   * @param body - Bulk operation request with user IDs
   * @param admin - Authenticated admin user
   * @returns Operation result with success/failure counts
   *
   * @example
   * POST /api/admin/bulk/users/promote
   * {
   *   "userIds": ["user-id-1", "user-id-2"],
   *   "operation": "promote"
   * }
   */
  @Post('users/promote')
  @ApiOperation({
    summary: 'Bulk promote users to superAdmin',
    description: 'Promote multiple users to superAdmin status',
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk operation result',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number' },
        succeeded: { type: 'number' },
        failed: { type: 'number' },
        skipped: { type: 'number' },
        errors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests per minute (bulk operation)
  async bulkPromoteUsers(
    @Body() body: BulkUserOperationRequest,
    @GetUserFromRequest() admin: User
  ): Promise<BulkOperationResult> {
    if (body.operation !== 'promote') {
      throw new BadRequestException('Operation must be "promote"');
    }

    if (!body.userIds || body.userIds.length === 0) {
      throw new BadRequestException('userIds must be provided');
    }

    if (body.userIds.length > 100) {
      throw new BadRequestException('Maximum 100 users per operation');
    }

    return this._bulkService.bulkPromoteUsers(body.userIds, admin.id);
  }

  /**
   * Bulk demote users from superAdmin
   *
   * @param body - Bulk operation request with user IDs
   * @param admin - Authenticated admin user
   * @returns Operation result with success/failure counts
   *
   * @example
   * POST /api/admin/bulk/users/demote
   * {
   *   "userIds": ["user-id-1", "user-id-2"],
   *   "operation": "demote"
   * }
   */
  @Post('users/demote')
  @ApiOperation({
    summary: 'Bulk demote users from superAdmin',
    description: 'Remove superAdmin status from multiple users',
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk operation result',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async bulkDemoteUsers(
    @Body() body: BulkUserOperationRequest,
    @GetUserFromRequest() admin: User
  ): Promise<BulkOperationResult> {
    if (body.operation !== 'demote') {
      throw new BadRequestException('Operation must be "demote"');
    }

    if (!body.userIds || body.userIds.length === 0) {
      throw new BadRequestException('userIds must be provided');
    }

    if (body.userIds.length > 100) {
      throw new BadRequestException('Maximum 100 users per operation');
    }

    return this._bulkService.bulkDemoteUsers(body.userIds, admin.id);
  }

  /**
   * Bulk set organization tier
   *
   * @param body - Bulk operation request with organization IDs and tier
   * @param admin - Authenticated admin user
   * @returns Operation result
   *
   * @example
   * POST /api/admin/bulk/organizations/tier
   * {
   *   "organizationIds": ["org-id-1", "org-id-2"],
   *   "operation": "set_tier",
   *   "tier": "PRO"
   * }
   */
  @Post('organizations/tier')
  @ApiOperation({
    summary: 'Bulk set organization tier',
    description: 'Set subscription tier for multiple organizations',
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk operation result',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async bulkSetOrganizationTier(
    @Body() body: BulkOrganizationOperationRequest,
    @GetUserFromRequest() admin: User
  ): Promise<BulkOperationResult> {
    if (body.operation !== 'set_tier') {
      throw new BadRequestException('Operation must be "set_tier"');
    }

    if (!body.organizationIds || body.organizationIds.length === 0) {
      throw new BadRequestException('organizationIds must be provided');
    }

    if (!body.tier) {
      throw new BadRequestException('tier must be provided');
    }

    const validTiers = ['FREE', 'STANDARD', 'PRO', 'TEAM', 'ULTIMATE'];
    if (!validTiers.includes(body.tier)) {
      throw new BadRequestException(`Invalid tier. Must be one of: ${validTiers.join(', ')}`);
    }

    if (body.organizationIds.length > 100) {
      throw new BadRequestException('Maximum 100 organizations per operation');
    }

    return this._bulkService.bulkSetOrganizationTier(
      body.organizationIds,
      body.tier,
      admin.id
    );
  }

  /**
   * Bulk set organization limits
   *
   * @param body - Bulk operation request with organization IDs and limits
   * @param admin - Authenticated admin user
   * @returns Operation result
   *
   * @example
   * POST /api/admin/bulk/organizations/limits
   * {
   *   "organizationIds": ["org-id-1", "org-id-2"],
   *   "operation": "set_limits",
   *   "limits": {"posts_per_month": 500}
   * }
   */
  @Post('organizations/limits')
  @ApiOperation({
    summary: 'Bulk set organization limits',
    description: 'Set custom limits for multiple organizations',
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk operation result',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async bulkSetOrganizationLimits(
    @Body() body: BulkOrganizationOperationRequest,
    @GetUserFromRequest() admin: User
  ): Promise<BulkOperationResult> {
    if (body.operation !== 'set_limits') {
      throw new BadRequestException('Operation must be "set_limits"');
    }

    if (!body.organizationIds || body.organizationIds.length === 0) {
      throw new BadRequestException('organizationIds must be provided');
    }

    if (!body.limits) {
      throw new BadRequestException('limits must be provided');
    }

    if (body.organizationIds.length > 100) {
      throw new BadRequestException('Maximum 100 organizations per operation');
    }

    return this._bulkService.bulkSetOrganizationLimits(
      body.organizationIds,
      body.limits,
      admin.id
    );
  }

  /**
   * Import users from CSV
   *
   * Expected CSV format:
   * email,name,isSuperAdmin,customQuotas
   *
   * @param body - Request with CSV content
   * @param admin - Authenticated admin user
   * @returns Import result
   *
   * @example
   * POST /api/admin/bulk/users/import
   * {
   *   "content": "email,name,isSuperAdmin\nuser1@example.com,User 1,false\n..."
   * }
   */
  @Post('users/import')
  @ApiOperation({
    summary: 'Import users from CSV',
    description: 'Bulk import users from CSV file content',
  })
  @ApiResponse({
    status: 200,
    description: 'Import result',
    schema: {
      type: 'object',
      properties: {
        totalRows: { type: 'number' },
        imported: { type: 'number' },
        failed: { type: 'number' },
        errors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              row: { type: 'number' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @Throttle({ default: { limit: 2, ttl: 60000 } }) // 2 requests per minute (import operation)
  async importUsersFromCsv(
    @Body() body: { content: string },
    @GetUserFromRequest() admin: User
  ): Promise<CsvImportResult> {
    if (!body.content || body.content.trim().length === 0) {
      throw new BadRequestException('CSV content must be provided');
    }

    if (body.content.length > 10_000_000) {
      // 10MB limit
      throw new BadRequestException('CSV content too large (max 10MB)');
    }

    return this._bulkService.bulkImportUsersFromCsv(body.content, admin.id);
  }

  /**
   * Export users to CSV
   *
   * @param take - Maximum number of users to export (default: 1000)
   * @param skip - Number of users to skip (default: 0)
   * @param search - Optional search filter
   * @returns CSV formatted string
   *
   * @example
   * GET /api/admin/bulk/users/export?take=100&skip=0&search=john
   */
  @Get('users/export')
  @ApiOperation({
    summary: 'Export users to CSV',
    description: 'Export users to CSV format for download',
  })
  @ApiResponse({
    status: 200,
    description: 'CSV formatted user data',
    schema: {
      type: 'string',
    },
  })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async exportUsersToCsv(
    @Query('take') take: string = '1000',
    @Query('skip') skip: string = '0',
    @Query('search') search?: string
  ): Promise<{ csv: string; filename: string }> {
    const takeNum = Math.min(parseInt(take) || 1000, 10000);
    const skipNum = Math.max(parseInt(skip) || 0, 0);

    const csv = await this._bulkService.exportUsersToCsv(
      takeNum,
      skipNum,
      search
    );

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `users-export-${timestamp}.csv`;

    return { csv, filename };
  }
}
