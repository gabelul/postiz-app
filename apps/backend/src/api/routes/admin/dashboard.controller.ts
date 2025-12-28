import {
  Controller,
  Get,
  UseGuards,
  Query,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AdminGuard } from '@gitroom/nestjs-libraries/guards/admin.guard';
import { AdminDashboardService, DashboardStats } from '@gitroom/backend/services/admin/admin-dashboard.service';
import { Throttle } from '@nestjs/throttler';

/**
 * Admin Dashboard Controller
 *
 * Provides dashboard statistics and activity data for the admin panel.
 * All endpoints require superAdmin privileges (protected by AdminGuard).
 *
 * Statistics are cached to avoid performance issues with live COUNT(*) queries.
 */
@ApiTags('Admin - Dashboard')
@Controller('/api/admin/dashboard')
@UseGuards(AdminGuard)
export class AdminDashboardController {
  constructor(private readonly _dashboardService: AdminDashboardService) {}

  /**
   * Get dashboard statistics
   *
   * Returns cached statistics about users, organizations, subscriptions, posts, etc.
   * Cache is refreshed every 5 minutes (configurable via DASHBOARD_STATS_CACHE_TTL).
   *
   * @returns Dashboard statistics
   *
   * @example
   * GET /api/admin/dashboard/stats
   */
  @Get('/stats')
  @ApiOperation({
    summary: 'Get dashboard statistics',
    description: 'Returns cached statistics about the system',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard statistics',
    schema: {
      type: 'object',
      properties: {
        users: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            superAdmins: { type: 'number' },
            activeThisMonth: { type: 'number' },
          },
        },
        organizations: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            withBillingBypass: { type: 'number' },
            activeThisMonth: { type: 'number' },
          },
        },
        subscriptions: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            byTier: { type: 'object' },
            trial: { type: 'number' },
            paid: { type: 'number' },
          },
        },
        posts: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            publishedThisMonth: { type: 'number' },
            scheduled: { type: 'number' },
            errors: { type: 'number' },
          },
        },
        integrations: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            active: { type: 'number' },
          },
        },
        aiProviders: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            active: { type: 'number' },
          },
        },
      },
    },
  })
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute
  async getStats(): Promise<DashboardStats> {
    return this._dashboardService.getStats();
  }

  /**
   * Force refresh dashboard statistics
   *
   * Invalidates the cache and generates fresh statistics.
   * Use this when you need up-to-the-minute data.
   *
   * @returns Fresh dashboard statistics
   *
   * @example
   * POST /api/admin/dashboard/stats/refresh
   */
  @Post('/stats/refresh')
  @ApiOperation({
    summary: 'Refresh dashboard statistics',
    description: 'Force refresh of cached statistics',
  })
  @ApiResponse({
    status: 200,
    description: 'Fresh dashboard statistics',
  })
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute (expensive operation)
  async refreshStats(): Promise<DashboardStats> {
    return this._dashboardService.refreshStats();
  }

  /**
   * Get recent admin activity
   *
   * Returns recent actions from the audit log for the dashboard timeline.
   *
   * @param limit - Number of recent activities to return (default: 10, max: 50)
   * @returns Recent admin activities
   *
   * @example
   * GET /api/admin/dashboard/activity?limit=20
   */
  @Get('/activity')
  @ApiOperation({
    summary: 'Get recent admin activity',
    description: 'Returns recent actions from the audit log',
  })
  @ApiResponse({
    status: 200,
    description: 'Recent admin activities',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          action: { type: 'string' },
          entityType: { type: 'string' },
          entityId: { type: 'string' },
          adminEmail: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute
  async getActivity(@Query('limit') limit: string = '10') {
    const limitNum = Math.min(parseInt(limit, 10) || 10, 50);
    return this._dashboardService.getRecentActivity(limitNum);
  }

  /**
   * Get quick stats for a specific entity
   *
   * Returns a single count value for the requested entity type.
   * Useful for showing badges or indicators in the UI.
   *
   * @param entity - Entity type to count (users, organizations, posts)
   * @returns Count of the requested entity
   *
   * @example
   * GET /api/admin/dashboard/quick-stats?entity=users
   */
  @Get('/quick-stats')
  @ApiOperation({
    summary: 'Get quick stats for an entity',
    description: 'Returns a single count value for the requested entity type',
  })
  @ApiResponse({
    status: 200,
    description: 'Entity count',
    schema: {
      type: 'object',
      properties: {
        entity: { type: 'string' },
        count: { type: 'number' },
      },
    },
  })
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute (lightweight)
  async getQuickStats(@Query('entity') entity: 'users' | 'organizations' | 'posts') {
    const count = await this._dashboardService.getQuickStats(entity);
    return {
      entity,
      count,
    };
  }
}
