import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  Query,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AdminGuard } from '@gitroom/nestjs-libraries/guards/admin.guard';
import { Organization } from '@prisma/client';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import type { $Enums } from '@prisma/client';

/**
 * Safely parse JSON string with fallback
 * @param jsonString - The JSON string to parse
 * @param fallback - The fallback value if parsing fails
 * @returns Parsed object or fallback
 */
function safeJsonParse<T>(jsonString: string | null | undefined, fallback: T): T {
  if (!jsonString) return fallback;
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return fallback;
  }
}

/**
 * Admin Organizations Controller
 *
 * Manages organization administration including:
 * - Listing all organizations
 * - Forcing subscription tiers without payment
 * - Setting custom limits
 * - Bypassing billing checks
 *
 * All endpoints require superAdmin privileges (protected by AdminGuard)
 * @see AdminGuard
 */
@ApiTags('Admin - Organizations')
@Controller('/api/admin/organizations')
@UseGuards(AdminGuard)
export class AdminOrganizationsController {
  /**
   * Constructor
   * @param _prismaService - Prisma database service
   */
  constructor(private readonly _prismaService: PrismaService) {}

  /**
   * List all organizations in the system with pagination
   *
   * @param take - Number of records to return (default: 50, max: 500)
   * @param skip - Number of records to skip (default: 0)
   * @param search - Optional search by organization name
   * @returns Paginated list of organizations with details
   *
   * @example
   * GET /api/admin/organizations?take=20&skip=0&search=acme
   */
  @Get('/')
  @ApiOperation({
    summary: 'List all organizations',
    description: 'Returns paginated list of all organizations in system',
  })
  async listOrganizations(
    @Query('take') take: string = '50',
    @Query('skip') skip: string = '0',
    @Query('search') search?: string
  ) {
    // Validate and parse pagination parameters
    const takeNum = Math.min(parseInt(take) || 50, 500);
    const skipNum = Math.max(parseInt(skip) || 0, 0);

    // Build search filter - Use any to work around Prisma typing issues with QueryMode
    const whereClause: any = search
      ? {
          name: { contains: search, mode: 'insensitive' },
        }
      : {};

    // Fetch organizations and total count
    const [organizations, total] = await Promise.all([
      this._prismaService.organization.findMany({
        where: whereClause,
        skip: skipNum,
        take: takeNum,
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          bypassBilling: true,
          customLimits: true,
          users: {
            select: {
              id: true,
              user: {
                select: {
                  email: true,
                },
              },
            },
          },
          subscription: {
            select: {
              subscriptionTier: true,
              totalChannels: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this._prismaService.organization.count({ where: whereClause }),
    ]);

    // Format response
    const formatted = organizations.map((org: any) => ({
      id: org.id,
      name: org.name,
      description: org.description,
      createdAt: org.createdAt,
      bypassBilling: org.bypassBilling,
      customLimits: safeJsonParse(org.customLimits, null),
      userCount: org.users.length,
      currentTier: org.subscription?.subscriptionTier || 'FREE',
      totalChannels: org.subscription?.totalChannels || 1,
    }));

    return {
      organizations: formatted,
      total,
      skip: skipNum,
      take: takeNum,
    };
  }

  /**
   * Get detailed information about a specific organization
   *
   * @param orgId - The ID of the organization
   * @returns Organization details with all related data (excluding sensitive API keys)
   */
  @Get('/:orgId')
  @ApiOperation({
    summary: 'Get organization details',
    description: 'Retrieve detailed information about a specific organization',
  })
  async getOrganization(@Param('orgId') orgId: string) {
    const organization = await this._prismaService.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        description: true,
        // Intentionally exclude: apiKey (sensitive - org-level API key)
        // Intentionally exclude: paymentId (sensitive - Stripe payment ID)
        createdAt: true,
        updatedAt: true,
        allowTrial: true,
        isTrailing: true,
        bypassBilling: true,
        customLimits: true,
        users: {
          select: {
            id: true,
            role: true,
            disabled: true,
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                lastName: true,
                isSuperAdmin: true,
              },
            },
          },
        },
        subscription: true,
        aiProviders: {
          select: {
            id: true,
            organizationId: true,
            name: true,
            type: true,
            baseUrl: true,
            customConfig: true,
            enabled: true,
            isDefault: true,
            availableModels: true,
            lastTestedAt: true,
            testStatus: true,
            testError: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true,
            // Intentionally exclude: apiKey (sensitive)
          },
        },
        aiTaskAssignments: true,
      },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID ${orgId} not found`);
    }

    return {
      ...organization,
      customLimits: safeJsonParse(organization.customLimits, null),
    };
  }

  /**
   * Force set a subscription tier for an organization
   *
   * Bypasses Stripe payment - directly sets the subscription tier.
   * Useful for self-hosted or testing scenarios.
   *
   * @param orgId - The ID of the organization
   * @param body - { tier: 'FREE' | 'STANDARD' | 'PRO' | 'TEAM' | 'ULTIMATE' }
   * @returns Updated subscription
   *
   * @example
   * PUT /api/admin/organizations/:orgId/tier
   * { "tier": "PRO" }
   */
  @Put('/:orgId/tier')
  @ApiOperation({
    summary: 'Force set subscription tier',
    description: 'Admin can directly set subscription tier without payment',
  })
  async setSubscriptionTier(
    @Param('orgId') orgId: string,
    @Body() body: { tier: string }
  ) {
    // Validate tier
    const validTiers = ['FREE', 'STANDARD', 'PRO', 'TEAM', 'ULTIMATE'];
    if (!validTiers.includes(body.tier.toUpperCase())) {
      throw new BadRequestException(
        `Invalid tier. Must be one of: ${validTiers.join(', ')}`
      );
    }

    // Fetch organization to verify it exists
    const org = await this._prismaService.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw new NotFoundException(`Organization with ID ${orgId} not found`);
    }

    // Get or create subscription
    let subscription = await this._prismaService.subscription.findUnique({
      where: { organizationId: orgId },
    });

    if (!subscription) {
      // Create new subscription
      subscription = await this._prismaService.subscription.create({
        data: {
          organizationId: orgId,
          subscriptionTier: body.tier.toUpperCase() as $Enums.SubscriptionTier,
          totalChannels: 5,
          period: 'MONTHLY',
        },
      });
    } else {
      // Update existing subscription
      subscription = await this._prismaService.subscription.update({
        where: { organizationId: orgId },
        data: {
          subscriptionTier: body.tier.toUpperCase() as $Enums.SubscriptionTier,
        },
      });
    }

    return {
      success: true,
      message: `Organization ${org.name} subscription tier set to ${body.tier}`,
      subscription,
    };
  }

  /**
   * Enable/disable billing bypass for an organization
   *
   * When enabled, organization ignores all billing checks (402/406 responses)
   * and can use all features regardless of subscription.
   *
   * @param orgId - The ID of the organization
   * @param body - { bypass: boolean }
   * @returns Updated organization
   *
   * @example
   * PUT /api/admin/organizations/:orgId/bypass-billing
   * { "bypass": true }
   */
  @Put('/:orgId/bypass-billing')
  @ApiOperation({
    summary: 'Enable/disable billing bypass',
    description: 'Allow organization to bypass billing checks',
  })
  async setBypassBilling(
    @Param('orgId') orgId: string,
    @Body() body: { bypass: boolean }
  ) {
    // Fetch organization to verify it exists
    const org = await this._prismaService.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw new NotFoundException(`Organization with ID ${orgId} not found`);
    }

    // Update bypass billing flag
    const updated = await this._prismaService.organization.update({
      where: { id: orgId },
      data: {
        bypassBilling: body.bypass === true,
      },
      select: {
        id: true,
        name: true,
        bypassBilling: true,
      },
    });

    return {
      success: true,
      message: `Billing bypass ${body.bypass ? 'enabled' : 'disabled'} for ${org.name}`,
      organization: updated,
    };
  }

  /**
   * Set custom limits for an organization
   *
   * Allows admin to override system-wide limits for specific organizations.
   * Limits are stored as JSON for flexibility.
   *
   * @param orgId - The ID of the organization
   * @param body - Custom limits object
   * @returns Updated organization
   *
   * @example
   * PUT /api/admin/organizations/:orgId/limits
   * {
   *   "channels": 50,
   *   "posts_per_month": 10000,
   *   "image_generation_count": 500,
   *   "generate_videos": 50,
   *   "team_members": 100
   * }
   */
  @Put('/:orgId/limits')
  @ApiOperation({
    summary: 'Set custom organization limits',
    description: 'Override system limits for a specific organization',
  })
  async setCustomLimits(
    @Param('orgId') orgId: string,
    @Body() body: Record<string, any>
  ) {
    // Fetch organization to verify it exists
    const org = await this._prismaService.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw new NotFoundException(`Organization with ID ${orgId} not found`);
    }

    // Validate limits object
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Limits must be a valid object');
    }

    // Update organization with custom limits
    const updated = await this._prismaService.organization.update({
      where: { id: orgId },
      data: {
        customLimits: JSON.stringify(body),
      },
      select: {
        id: true,
        name: true,
        customLimits: true,
      },
    });

    return {
      success: true,
      message: `Custom limits set for organization ${org.name}`,
      organization: {
        ...updated,
        customLimits: safeJsonParse(updated.customLimits, {}),
      },
    };
  }

  /**
   * Remove custom limits for an organization
   *
   * Resets organization to system-wide limits.
   *
   * @param orgId - The ID of the organization
   * @returns Updated organization
   */
  @Post('/:orgId/limits/reset')
  @ApiOperation({
    summary: 'Reset organization limits to system defaults',
    description: 'Remove custom limits and revert to system-wide limits',
  })
  async resetCustomLimits(@Param('orgId') orgId: string) {
    // Fetch organization to verify it exists
    const org = await this._prismaService.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw new NotFoundException(`Organization with ID ${orgId} not found`);
    }

    // Reset limits to null
    const updated = await this._prismaService.organization.update({
      where: { id: orgId },
      data: {
        customLimits: null,
      },
      select: {
        id: true,
        name: true,
        customLimits: true,
      },
    });

    return {
      success: true,
      message: `Limits reset for organization ${org.name}. Now using system defaults.`,
      organization: updated,
    };
  }

  /**
   * Make an organization "unlimited" - maximum everything
   *
   * Convenience endpoint that sets all limits to high values.
   * Useful for admin/test organizations.
   *
   * @param orgId - The ID of the organization
   * @returns Updated organization
   */
  @Post('/:orgId/make-unlimited')
  @ApiOperation({
    summary: 'Make organization unlimited',
    description: 'Set all limits to maximum and bypass billing',
  })
  async makeUnlimited(@Param('orgId') orgId: string) {
    // Fetch organization to verify it exists
    const org = await this._prismaService.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw new NotFoundException(`Organization with ID ${orgId} not found`);
    }

    // Set unlimited limits and bypass billing
    const updated = await this._prismaService.organization.update({
      where: { id: orgId },
      data: {
        bypassBilling: true,
        customLimits: JSON.stringify({
          channels: 999,
          posts_per_month: 999999,
          image_generation_count: 999999,
          generate_videos: 999999,
          team_members: 999,
          webhooks: 999,
        }),
      },
      select: {
        id: true,
        name: true,
        bypassBilling: true,
        customLimits: true,
      },
    });

    return {
      success: true,
      message: `Organization ${org.name} made unlimited`,
      organization: {
        ...updated,
        customLimits: safeJsonParse(updated.customLimits, {}),
      },
    };
  }
}
