import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

/**
 * Dashboard statistics interface
 */
export interface DashboardStats {
  users: {
    total: number;
    superAdmins: number;
    activeThisMonth: number;
  };
  organizations: {
    total: number;
    withBillingBypass: number;
    activeThisMonth: number;
  };
  subscriptions: {
    total: number;
    byTier: Record<string, number>;
    trial: number;
    paid: number;
  };
  posts: {
    total: number;
    publishedThisMonth: number;
    scheduled: number;
    errors: number;
  };
  integrations: {
    total: number;
    active: number;
  };
  aiProviders: {
    total: number;
    active: number;
  };
  system: {
    version: string;
    uptime: number;
    lastCacheRefresh: Date;
  };
}

/**
 * Cached statistics data
 */
interface CachedStats {
  data: DashboardStats;
  timestamp: Date;
}

/**
 * Admin Dashboard Service
 *
 * Provides cached dashboard statistics to avoid performance issues
 * with live COUNT(*) queries on large datasets.
 *
 * Statistics are cached for 5 minutes (configurable via DASHBOARD_STATS_CACHE_TTL).
 */
@Injectable()
export class AdminDashboardService {
  private readonly logger = new Logger(AdminDashboardService.name);

  // In-memory cache for dashboard stats
  private cachedStats: CachedStats | null = null;

  // Cache TTL in milliseconds (default 5 minutes)
  private readonly cacheTtl: number =
    parseInt(process.env.DASHBOARD_STATS_CACHE_TTL || '300', 10) * 1000;

  constructor(private readonly _prismaService: PrismaService) {}

  /**
   * Get dashboard statistics with caching
   * @returns Dashboard statistics
   */
  async getStats(): Promise<DashboardStats> {
    const now = new Date();

    // Return cached stats if still valid
    if (this.cachedStats && now.getTime() - this.cachedStats.timestamp.getTime() < this.cacheTtl) {
      this.logger.debug('Returning cached dashboard stats');
      return this.cachedStats.data;
    }

    // Generate fresh stats
    this.logger.debug('Generating fresh dashboard stats');
    const stats = await this.generateStats();

    // Update cache
    this.cachedStats = {
      data: stats,
      timestamp: now,
    };

    return stats;
  }

  /**
   * Force refresh of cached statistics
   * @returns Fresh dashboard statistics
   */
  async refreshStats(): Promise<DashboardStats> {
    this.logger.log('Force refreshing dashboard stats');
    this.cachedStats = null;
    return this.getStats();
  }

  /**
   * Clear the cached statistics
   */
  clearCache(): void {
    this.logger.log('Clearing dashboard stats cache');
    this.cachedStats = null;
  }

  /**
   * Generate fresh dashboard statistics
   * Uses efficient queries to avoid performance issues
   */
  private async generateStats(): Promise<DashboardStats> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Run all queries in parallel for better performance
    const [
      userCount,
      superAdminCount,
      activeUsersThisMonth,
      orgCount,
      billingBypassCount,
      activeOrgsThisMonth,
      subscriptionCount,
      subscriptionsByTier,
      trialCount,
      paidCount,
      postCount,
      publishedPostsThisMonth,
      scheduledPosts,
      errorPosts,
      integrationCount,
      activeIntegrations,
      aiProviderCount,
      activeAiProviders,
    ] = await Promise.all([
      // User stats
      this._prismaService.user.count(),
      this._prismaService.user.count({ where: { isSuperAdmin: true } }),
      this._prismaService.user.count({ where: { createdAt: { gte: startOfMonth } } }),

      // Organization stats
      this._prismaService.organization.count(),
      this._prismaService.organization.count({ where: { bypassBilling: true } }),
      this._prismaService.organization.count({ where: { createdAt: { gte: startOfMonth } } }),

      // Subscription stats
      this._prismaService.subscription.count(),
      this.getSubscriptionsByTier(),
      this._prismaService.subscription.count({ where: { isLifetime: true } }),
      this._prismaService.subscription.count({ where: { isLifetime: false } }),

      // Post stats
      this._prismaService.post.count({ where: { deletedAt: null } }),
      this._prismaService.post.count({ where: { deletedAt: null, state: 'PUBLISHED', publishDate: { gte: startOfMonth } } }),
      this._prismaService.post.count({ where: { deletedAt: null, state: 'QUEUE' } }),
      this._prismaService.post.count({ where: { deletedAt: null, state: 'ERROR' } }),

      // Integration stats
      this._prismaService.integration.count({ where: { deletedAt: null } }),
      this._prismaService.integration.count({ where: { deletedAt: null, disabled: false } }),

      // AI Provider stats
      this._prismaService.aIProvider.count({ where: { deletedAt: null } }),
      this._prismaService.aIProvider.count({ where: { deletedAt: null, enabled: true } }),
    ]);

    // Build byTier object from array
    const byTier: Record<string, number> = {
      FREE: 0,
      STANDARD: 0,
      PRO: 0,
      TEAM: 0,
      ULTIMATE: 0,
    };

    subscriptionsByTier.forEach((tier) => {
      byTier[tier.subscriptionTier] = tier._count;
    });

    return {
      users: {
        total: userCount,
        superAdmins: superAdminCount,
        activeThisMonth: activeUsersThisMonth,
      },
      organizations: {
        total: orgCount,
        withBillingBypass: billingBypassCount,
        activeThisMonth: activeOrgsThisMonth,
      },
      subscriptions: {
        total: subscriptionCount,
        byTier,
        trial: trialCount,
        paid: paidCount,
      },
      posts: {
        total: postCount,
        publishedThisMonth: publishedPostsThisMonth,
        scheduled: scheduledPosts,
        errors: errorPosts,
      },
      integrations: {
        total: integrationCount,
        active: activeIntegrations,
      },
      aiProviders: {
        total: aiProviderCount,
        active: activeAiProviders,
      },
      system: {
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        lastCacheRefresh: new Date(),
      },
    };
  }

  /**
   * Get subscription counts grouped by tier
   */
  private async getSubscriptionsByTier(): Promise<Array<{ subscriptionTier: string; _count: number }>> {
    return this._prismaService.subscription.groupBy({
      by: ['subscriptionTier'],
      _count: true,
    });
  }

  /**
   * Get recent activity from audit log
   * @param limit - Number of recent activities to return
   * @returns Recent admin activities
   */
  async getRecentActivity(limit: number = 10) {
    return this._prismaService.adminAuditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        adminEmail: true,
        createdAt: true,
      },
    });
  }

  /**
   * Get quick stats for a specific entity type
   * Useful for showing counts in UI without loading full dashboard
   */
  async getQuickStats(entity: 'users' | 'organizations' | 'posts'): Promise<number> {
    switch (entity) {
      case 'users':
        return this._prismaService.user.count();
      case 'organizations':
        return this._prismaService.organization.count();
      case 'posts':
        return this._prismaService.post.count({ where: { deletedAt: null } });
      default:
        return 0;
    }
  }
}
