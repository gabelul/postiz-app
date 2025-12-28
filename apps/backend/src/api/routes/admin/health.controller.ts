import {
  Controller,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AdminGuard } from '@gitroom/nestjs-libraries/guards/admin.guard';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Throttle } from '@nestjs/throttler';

/**
 * System health metrics
 */
interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  database: {
    status: 'connected' | 'disconnected';
    latency?: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  stats: {
    totalUsers: number;
    totalOrganizations: number;
    totalPosts: number;
    totalSubscriptions: number;
  };
}

/**
 * AI Provider health status
 */
interface AiProviderStatus {
  provider: string;
  configured: boolean;
  lastUsed?: string;
  errorCount: number;
}

/**
 * Admin Health Controller
 *
 * Provides system health metrics and monitoring for admin panel.
 * Includes database status, memory usage, and AI provider health.
 *
 * All endpoints require superAdmin privileges (protected by AdminGuard)
 */
@ApiTags('Admin - Health')
@Controller('/api/admin/health')
@UseGuards(AdminGuard)
export class AdminHealthController {
  private readonly startTime = Date.now();

  constructor(private readonly _prismaService: PrismaService) {}

  /**
   * Get overall system health
   *
   * Returns comprehensive system health metrics including:
   * - Database connection status
   * - Memory usage
   * - Key statistics (users, organizations, posts, subscriptions)
   * - System uptime
   *
   * @returns System health metrics
   */
  @Get()
  @ApiOperation({
    summary: 'Get system health',
    description: 'Retrieve comprehensive system health metrics',
  })
  @ApiResponse({
    status: 200,
    description: 'System health metrics',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
        timestamp: { type: 'string' },
        uptime: { type: 'number' },
        database: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            latency: { type: 'number' },
          },
        },
        memory: {
          type: 'object',
          properties: {
            used: { type: 'number' },
            total: { type: 'number' },
            percentage: { type: 'number' },
          },
        },
        stats: {
          type: 'object',
          properties: {
            totalUsers: { type: 'number' },
            totalOrganizations: { type: 'number' },
            totalPosts: { type: 'number' },
            totalSubscriptions: { type: 'number' },
          },
        },
      },
    },
  })
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute
  @HttpCode(HttpStatus.OK)
  async getSystemHealth(): Promise<SystemHealth> {
    const startTime = Date.now();

    // Get key statistics in parallel
    const [totalUsers, totalOrganizations, totalPosts, totalSubscriptions] =
      await Promise.all([
        this._prismaService.user.count(),
        this._prismaService.organization.count(),
        this._prismaService.post.count(),
        this._prismaService.subscription.count(),
      ]);

    const dbLatency = Date.now() - startTime;

    // Memory usage
    const memoryUsage = process.memoryUsage();
    const memoryTotal = memoryUsage.heapTotal;
    const memoryUsed = memoryUsage.heapUsed;
    const memoryPercentage = (memoryUsed / memoryTotal) * 100;

    // Determine overall health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (memoryPercentage > 90) {
      status = 'unhealthy';
    } else if (memoryPercentage > 75 || dbLatency > 1000) {
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      database: {
        status: 'connected',
        latency: dbLatency,
      },
      memory: {
        used: Math.round(memoryUsed / 1024 / 1024), // MB
        total: Math.round(memoryTotal / 1024 / 1024), // MB
        percentage: Math.round(memoryPercentage * 100) / 100,
      },
      stats: {
        totalUsers,
        totalOrganizations,
        totalPosts,
        totalSubscriptions,
      },
    };
  }

  /**
   * Get AI provider health status
   *
   * Returns status of all configured AI providers.
   * Indicates which providers are configured and their error counts.
   *
   * @returns AI provider status array
   */
  @Get('/ai-providers')
  @ApiOperation({
    summary: 'Get AI provider health',
    description: 'Retrieve health status of all configured AI providers',
  })
  @ApiResponse({
    status: 200,
    description: 'AI provider health status',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          provider: { type: 'string' },
          configured: { type: 'boolean' },
          lastUsed: { type: 'string' },
          errorCount: { type: 'number' },
        },
      },
    },
  })
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async getAiProviderHealth(): Promise<AiProviderStatus[]> {
    // Fetch AI provider settings from system settings
    const providerSettings = await this._prismaService.systemSettings.findMany({
      where: {
        key: {
          startsWith: 'ai.provider.',
        },
      },
    });

    // Map to provider status
    const providers: AiProviderStatus[] = providerSettings.map((setting) => {
      const providerName = setting.key.replace('ai.provider.', '');
      const config = JSON.parse(setting.value || '{}');

      return {
        provider: providerName,
        configured: !!config.enabled || !!config.apiKey || !!config.model,
        lastUsed: config.lastUsed || undefined,
        errorCount: config.errorCount || 0,
      };
    });

    // Always include common providers even if not configured
    const commonProviders = ['openai', 'anthropic', 'gemini', 'grok'];
    for (const provider of commonProviders) {
      if (!providers.find((p) => p.provider === provider)) {
        providers.push({
          provider,
          configured: false,
          errorCount: 0,
        });
      }
    }

    return providers;
  }

  /**
   * Perform database health check
   *
   * Simple endpoint to verify database connectivity.
   * Returns 200 OK if database is accessible.
   *
   * @returns Database connection status
   */
  @Get('/database')
  @ApiOperation({
    summary: 'Check database health',
    description: 'Verify database connectivity with a simple query',
  })
  @ApiResponse({
    status: 200,
    description: 'Database is connected',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        latency: { type: 'number' },
      },
    },
  })
  @Throttle({ default: { limit: 60, ttl: 60000 } }) // 60 requests per minute
  @HttpCode(HttpStatus.OK)
  async checkDatabaseHealth(): Promise<{ status: string; latency: number }> {
    const startTime = Date.now();

    // Perform a simple count query
    await this._prismaService.user.count({ take: 1 });

    const latency = Date.now() - startTime;

    return {
      status: 'connected',
      latency,
    };
  }
}
