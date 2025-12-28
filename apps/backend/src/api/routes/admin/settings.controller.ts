import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  UseGuards,
  Delete,
  Param,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AdminGuard } from '@gitroom/nestjs-libraries/guards/admin.guard';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { User } from '@prisma/client';
import { safeJsonParse } from '@gitroom/nestjs-libraries/utils';
import { Throttle } from '@nestjs/throttler';

/**
 * Admin Settings Controller
 *
 * Manages system-wide settings including:
 * - System configuration
 * - Feature flags
 * - Tier definitions (modify what each tier includes)
 * - Global AI provider configuration
 *
 * All endpoints require superAdmin privileges (protected by AdminGuard)
 * @see AdminGuard
 */
@ApiTags('Admin - Settings')
@Controller('/api/admin/settings')
@UseGuards(AdminGuard)
export class AdminSettingsController {
  /**
   * Constructor
   * @param _prismaService - Prisma database service
   */
  constructor(private readonly _prismaService: PrismaService) {}

  /**
   * Get all system settings
   *
   * Retrieves all system-wide configuration values.
   * Settings are key-value pairs stored in database.
   *
   * @returns List of all system settings
   */
  @Get('/system')
  @ApiOperation({
    summary: 'Get all system settings',
    description: 'Retrieve all system-wide configuration values',
  })
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute
  async getSystemSettings() {
    const settings = await this._prismaService.systemSettings.findMany({
      orderBy: { key: 'asc' },
    });

    // Group settings by category
    const grouped = settings.reduce((acc, setting) => {
      const category = setting.key.split('.')[0] || 'general';
      if (!acc[category]) acc[category] = [];
      acc[category].push(setting);
      return acc;
    }, {} as Record<string, any[]>);

    return {
      settings,
      grouped,
    };
  }

  /**
   * Get a specific system setting
   *
   * @param key - The setting key (e.g., 'billing.stripe_public_key')
   * @returns The setting value or null if not found
   */
  @Get('/system/:key')
  @ApiOperation({
    summary: 'Get specific system setting',
    description: 'Retrieve a specific system setting by key',
  })
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute
  async getSystemSetting(@Param('key') key: string) {
    const setting = await this._prismaService.systemSettings.findUnique({
      where: { key },
    });

    return setting || { key, value: null, found: false };
  }

  /**
   * Create or update a system setting
   *
   * @param body - { key: string, value: string, description?: string }
   * @returns The created/updated setting
   *
   * @example
   * POST /api/admin/settings/system
   * {
   *   "key": "features.enable_ai",
   *   "value": "true",
   *   "description": "Enable AI features globally"
   * }
   */
  @Post('/system')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async createSystemSetting(
    @Body() body: { key: string; value: string; description?: string },
    @GetUserFromRequest() user: User
  ) {
    // Validate key format
    if (!body.key || !body.value) {
      throw new BadRequestException('Both key and value are required');
    }

    const setting = await this._prismaService.systemSettings.upsert({
      where: { key: body.key },
      update: {
        value: body.value,
        description: body.description,
        updatedBy: user.id,
      },
      create: {
        key: body.key,
        value: body.value,
        description: body.description,
        updatedBy: user.id,
      },
    });

    return {
      success: true,
      message: 'Setting saved',
      setting,
    };
  }

  /**
   * Update a system setting
   *
   * @param key - The setting key
   * @param body - { value: string, description?: string }
   * @returns The updated setting
   */
  @Put('/system/:key')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async updateSystemSetting(
    @Param('key') key: string,
    @Body() body: { value: string; description?: string },
    @GetUserFromRequest() user: User
  ) {
    const setting = await this._prismaService.systemSettings.findUnique({
      where: { key },
    });

    if (!setting) {
      throw new NotFoundException('Setting not found');
    }

    const updated = await this._prismaService.systemSettings.update({
      where: { key },
      data: {
        value: body.value,
        description: body.description,
        updatedBy: user.id,
      },
    });

    return {
      success: true,
      message: 'Setting updated',
      setting: updated,
    };
  }

  /**
   * Delete a system setting
   *
   * @param key - The setting key
   * @returns Success response
   */
  @Delete('/system/:key')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async deleteSystemSetting(@Param('key') key: string) {
    const setting = await this._prismaService.systemSettings.findUnique({
      where: { key },
    });

    if (!setting) {
      throw new NotFoundException('Setting not found');
    }

    await this._prismaService.systemSettings.delete({
      where: { key },
    });

    return {
      success: true,
      message: 'Setting deleted',
    };
  }

  /**
   * Get current tier definitions
   *
   * Returns what features are included in each subscription tier.
   * These match the values in pricing.ts but are stored here for easy customization.
   *
   * @returns Current tier definitions
   */
  @Get('/tiers')
  @ApiOperation({
    summary: 'Get tier definitions',
    description: 'Retrieve current subscription tier features and limits',
  })
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute
  async getTiers() {
    // For now, return hardcoded tiers from pricing.ts
    // In a full implementation, these would be stored in database
    const tiers = {
      FREE: {
        current: 'FREE',
        month_price: 0,
        year_price: 0,
        channels: 1,
        posts_per_month: 0,
        image_generation_count: 0,
        image_generator: false,
        team_members: false,
        ai: false,
        public_api: false,
        webhooks: 0,
        autoPost: false,
        generate_videos: 0,
      },
      STANDARD: {
        current: 'STANDARD',
        month_price: 29,
        year_price: 278,
        channels: 5,
        posts_per_month: 400,
        image_generation_count: 20,
        image_generator: false,
        team_members: false,
        ai: true,
        public_api: true,
        webhooks: 2,
        autoPost: false,
        generate_videos: 3,
      },
      PRO: {
        current: 'PRO',
        month_price: 49,
        year_price: 468,
        channels: 20,
        posts_per_month: 2000,
        image_generation_count: 100,
        image_generator: true,
        team_members: true,
        ai: true,
        public_api: true,
        webhooks: 10,
        autoPost: true,
        generate_videos: 15,
      },
      TEAM: {
        current: 'TEAM',
        month_price: 99,
        year_price: 948,
        channels: 50,
        posts_per_month: 5000,
        image_generation_count: 500,
        image_generator: true,
        team_members: true,
        ai: true,
        public_api: true,
        webhooks: 25,
        autoPost: true,
        generate_videos: 50,
      },
      ULTIMATE: {
        current: 'ULTIMATE',
        month_price: 199,
        year_price: 1908,
        channels: 999,
        posts_per_month: 99999,
        image_generation_count: 9999,
        image_generator: true,
        team_members: true,
        ai: true,
        public_api: true,
        webhooks: 999,
        autoPost: true,
        generate_videos: 999,
      },
    };

    return tiers;
  }

  /**
   * Update a tier definition
   *
   * Modify what features are included in a subscription tier.
   * Changes are stored in system settings and override hardcoded defaults.
   *
   * @param tier - The tier name (FREE, STANDARD, PRO, TEAM, ULTIMATE)
   * @param body - Tier configuration object
   * @returns Updated tier definition
   *
   * @example
   * PUT /api/admin/settings/tiers/STANDARD
   * {
   *   "channels": 10,
   *   "posts_per_month": 800,
   *   "generate_videos": 5
   * }
   */
  @Put('/tiers/:tier')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async updateTier(
    @Param('tier') tier: string,
    @Body() body: Record<string, any>,
    @GetUserFromRequest() user: User
  ) {
    // Validate tier name
    const validTiers = ['FREE', 'STANDARD', 'PRO', 'TEAM', 'ULTIMATE'];
    if (!validTiers.includes(tier.toUpperCase())) {
      throw new BadRequestException(`Invalid tier. Must be one of: ${validTiers.join(', ')}`);
    }

    // Store in system settings
    const setting = await this._prismaService.systemSettings.upsert({
      where: { key: `tier.${tier.toLowerCase()}` },
      update: {
        value: JSON.stringify(body),
        updatedBy: user.id,
      },
      create: {
        key: `tier.${tier.toLowerCase()}`,
        value: JSON.stringify(body),
        description: `${tier} tier configuration`,
        updatedBy: user.id,
      },
    });

    return {
      success: true,
      message: `Tier ${tier} configuration updated`,
      tier: {
        name: tier,
        config: safeJsonParse(setting.value, {}),
      },
    };
  }

  /**
   * Reset a tier to default configuration
   *
   * @param tier - The tier name
   * @returns Success response
   */
  @Post('/tiers/:tier/reset')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async resetTier(@Param('tier') tier: string) {
    // Validate tier name
    const validTiers = ['FREE', 'STANDARD', 'PRO', 'TEAM', 'ULTIMATE'];
    if (!validTiers.includes(tier.toUpperCase())) {
      throw new BadRequestException(`Invalid tier. Must be one of: ${validTiers.join(', ')}`);
    }

    // Delete custom tier configuration
    try {
      await this._prismaService.systemSettings.delete({
        where: { key: `tier.${tier.toLowerCase()}` },
      });
    } catch {
      // Setting doesn't exist, that's fine
    }

    return {
      success: true,
      message: `Tier ${tier} reset to default configuration`,
    };
  }

  /**
   * Get all global AI provider configurations
   *
   * @returns Global AI provider settings
   */
  @Get('/ai-providers/global')
  @ApiOperation({
    summary: 'Get global AI providers',
    description: 'Retrieve globally configured AI providers available to all organizations',
  })
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute
  async getGlobalAiProviders() {
    const providers = await this._prismaService.systemSettings.findMany({
      where: {
        key: {
          startsWith: 'ai.provider.',
        },
      },
    });

    return {
      providers: providers.map((p) => ({
        key: p.key,
        config: safeJsonParse(p.value, {}),
        description: p.description,
      })),
    };
  }

  /**
   * Configure a global AI provider
   *
   * Sets up an AI provider available to all organizations.
   * Organizations can override with their own configuration.
   *
   * @param provider - Provider name (openai, anthropic, gemini, etc)
   * @param body - Provider configuration
   * @returns Updated provider configuration
   *
   * @example
   * POST /api/admin/settings/ai-providers/global/openai
   * {
   *   "name": "OpenAI Global",
   *   "type": "openai",
   *   "model": "gpt-4",
   *   "default": true
   * }
   */
  @Post('/ai-providers/global/:provider')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async configureGlobalAiProvider(
    @Param('provider') provider: string,
    @Body() body: Record<string, any>,
    @GetUserFromRequest() user: User
  ) {
    const setting = await this._prismaService.systemSettings.upsert({
      where: { key: `ai.provider.${provider.toLowerCase()}` },
      update: {
        value: JSON.stringify(body),
        updatedBy: user.id,
      },
      create: {
        key: `ai.provider.${provider.toLowerCase()}`,
        value: JSON.stringify(body),
        description: `Global configuration for ${provider} AI provider`,
        updatedBy: user.id,
      },
    });

    return {
      success: true,
      message: `Global AI provider ${provider} configured`,
      provider: {
        name: provider,
        config: safeJsonParse(setting.value, {}),
      },
    };
  }

  /**
   * Get feature flags
   *
   * Returns all system feature flags that control functionality.
   *
   * @returns Feature flag values
   */
  @Get('/features')
  @ApiOperation({
    summary: 'Get feature flags',
    description: 'Retrieve all system feature toggles',
  })
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute
  async getFeatures() {
    const flags = await this._prismaService.systemSettings.findMany({
      where: {
        key: {
          startsWith: 'feature.',
        },
      },
    });

    return {
      flags: flags.map((f) => ({
        key: f.key.replace('feature.', ''),
        enabled: f.value === 'true',
        description: f.description,
      })),
    };
  }

  /**
   * Toggle a feature flag
   *
   * @param feature - Feature name
   * @param body - { enabled: boolean }
   * @returns Updated feature flag
   *
   * @example
   * POST /api/admin/settings/features/ai
   * { "enabled": false }
   */
  @Post('/features/:feature')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async toggleFeature(
    @Param('feature') feature: string,
    @Body() body: { enabled: boolean },
    @GetUserFromRequest() user: User
  ) {
    const setting = await this._prismaService.systemSettings.upsert({
      where: { key: `feature.${feature.toLowerCase()}` },
      update: {
        value: body.enabled ? 'true' : 'false',
        updatedBy: user.id,
      },
      create: {
        key: `feature.${feature.toLowerCase()}`,
        value: body.enabled ? 'true' : 'false',
        description: `Feature flag for ${feature}`,
        updatedBy: user.id,
      },
    });

    return {
      success: true,
      message: `Feature ${feature} ${body.enabled ? 'enabled' : 'disabled'}`,
      feature: {
        name: feature,
        enabled: setting.value === 'true',
      },
    };
  }
}
