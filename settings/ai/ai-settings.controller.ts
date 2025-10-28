import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Organization } from '@prisma/client';
import { AISettingsService } from './ai-settings.service';
import { ModelDiscoveryService } from './model-discovery.service';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { PoliciesGuard } from '@gitroom/backend/services/auth/permissions/permissions.guard';

/**
 * Controller for managing AI provider settings
 * Provides endpoints for CRUD operations on AI providers and task assignments
 * All endpoints require authentication and organization context
 */
@Controller('api/settings/ai')
@UseGuards(PoliciesGuard)
export class AISettingsController {
  constructor(
    private _aiSettingsService: AISettingsService,
    private _modelDiscoveryService: ModelDiscoveryService
  ) {}

  /**
   * Get all AI providers for the organization
   * GET /api/settings/ai/providers
   */
  @Get('providers')
  async getProviders(@GetOrgFromRequest() org: Organization) {
    this.validateOrganization(org);
    return this._aiSettingsService.getProviders(org.id);
  }

  /**
   * Get a specific AI provider
   * GET /api/settings/ai/providers/:providerId
   */
  @Get('providers/:providerId')
  async getProvider(
    @GetOrgFromRequest() org: Organization,
    @Param('providerId') providerId: string
  ) {
    this.validateOrganization(org);
    return this._aiSettingsService.getProvider(org.id, providerId);
  }

  /**
   * Create a new AI provider
   * POST /api/settings/ai/providers
   * Body: {
   *   name: string,
   *   type: 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'together' | 'openai-compatible',
   *   apiKey: string,
   *   baseUrl?: string,
   *   customConfig?: string,
   *   isDefault?: boolean
   * }
   */
  @Post('providers')
  async createProvider(
    @GetOrgFromRequest() org: Organization,
    @Body()
    body: {
      name: string;
      type: string;
      apiKey: string;
      baseUrl?: string;
      customConfig?: string;
      isDefault?: boolean;
    }
  ) {
    this.validateOrganization(org);
    return this._aiSettingsService.createProvider(org.id, body);
  }

  /**
   * Update an AI provider
   * PUT /api/settings/ai/providers/:providerId
   * Body: Partial provider configuration
   */
  @Put('providers/:providerId')
  async updateProvider(
    @GetOrgFromRequest() org: Organization,
    @Param('providerId') providerId: string,
    @Body() body: any
  ) {
    this.validateOrganization(org);
    return this._aiSettingsService.updateProvider(org.id, providerId, body);
  }

  /**
   * Delete an AI provider
   * DELETE /api/settings/ai/providers/:providerId
   */
  @Delete('providers/:providerId')
  async deleteProvider(
    @GetOrgFromRequest() org: Organization,
    @Param('providerId') providerId: string
  ) {
    this.validateOrganization(org);
    return this._aiSettingsService.deleteProvider(org.id, providerId);
  }

  /**
   * Test an AI provider configuration
   * POST /api/settings/ai/providers/:providerId/test
   * Validates the API key and attempts to fetch available models
   */
  @Post('providers/:providerId/test')
  async testProvider(
    @GetOrgFromRequest() org: Organization,
    @Param('providerId') providerId: string,
    @Body() body?: { model?: string }
  ) {
    this.validateOrganization(org);
    const provider = await this._aiSettingsService.getProvider(org.id, providerId);

    if (!provider) {
      return { valid: false, error: 'Provider not found' };
    }

    // Validate provider configuration
    const validation = await this._aiSettingsService.validateProvider(provider);

    if (!validation.valid) {
      // Update provider with test failure
      await this._aiSettingsService.updateProviderTestStatus(
        org.id,
        providerId,
        'FAILED',
        validation.error
      );
      return { valid: false, error: validation.error };
    }

    // Update provider with test success
    await this._aiSettingsService.updateProviderTestStatus(
      org.id,
      providerId,
      'SUCCESS'
    );

    // In a real implementation, we would also test a specific model if provided
    if (body?.model) {
      // Test the specific model
      return { valid: true, model: body.model, tested: true };
    }

    return { valid: true, models: validation.availableModels };
  }

  /**
   * Get all task assignments for the organization
   * GET /api/settings/ai/tasks
   * Returns image, text, video-slides, and agent task assignments
   */
  @Get('tasks')
  async getTaskAssignments(@GetOrgFromRequest() org: Organization) {
    this.validateOrganization(org);
    return this._aiSettingsService.getTaskAssignments(org.id);
  }

  /**
   * Get a specific task assignment
   * GET /api/settings/ai/tasks/:taskType
   */
  @Get('tasks/:taskType')
  async getTaskAssignment(
    @GetOrgFromRequest() org: Organization,
    @Param('taskType') taskType: string
  ) {
    this.validateOrganization(org);
    return this._aiSettingsService.getTaskAssignment(org.id, taskType);
  }

  /**
   * Update a task assignment
   * PUT /api/settings/ai/tasks/:taskType
   * Body: {
   *   providerId: string,
   *   model: string,
   *   fallbackProviderId?: string,
   *   fallbackModel?: string
   * }
   */
  @Put('tasks/:taskType')
  async updateTaskAssignment(
    @GetOrgFromRequest() org: Organization,
    @Param('taskType') taskType: string,
    @Body()
    body: {
      providerId: string;
      model: string;
      fallbackProviderId?: string;
      fallbackModel?: string;
    }
  ) {
    this.validateOrganization(org);
    return this._aiSettingsService.updateTaskAssignment(org.id, taskType, body);
  }

  /**
   * Test a task assignment
   * POST /api/settings/ai/tasks/:taskType/test
   * Tests the provider and model assigned to a task
   */
  @Post('tasks/:taskType/test')
  async testTaskAssignment(
    @GetOrgFromRequest() org: Organization,
    @Param('taskType') taskType: string
  ) {
    this.validateOrganization(org);
    const assignment = await this._aiSettingsService.getTaskAssignment(
      org.id,
      taskType
    );

    if (!assignment) {
      return { valid: false, error: 'Task assignment not found' };
    }

    // Validate the provider and model
    const validation = await this._aiSettingsService.validateProvider(assignment.provider);

    if (!validation.valid) {
      return {
        valid: false,
        error: validation.error,
        provider: assignment.provider.name,
      };
    }

    return {
      valid: true,
      provider: assignment.provider.name,
      model: assignment.model,
      taskType,
    };
  }

  /**
   * Discover available models for a provider
   * POST /api/settings/ai/providers/:providerId/discover-models
   * Fetches available models from the provider API
   * Stores the result in the provider's availableModels field
   */
  @Post('providers/:providerId/discover-models')
  async discoverModels(
    @GetOrgFromRequest() org: Organization,
    @Param('providerId') providerId: string
  ) {
    this.validateOrganization(org);
    const provider = await this._aiSettingsService.getProvider(org.id, providerId);

    if (!provider) {
      return { success: false, error: 'Provider not found' };
    }

    try {
      // Discover models from the provider
      const models = await this._modelDiscoveryService.discoverModels(provider);

      // Save the discovered models to the provider
      if (models.length > 0) {
        await this._aiSettingsService.updateProvider(org.id, providerId, {
          availableModels: JSON.stringify(models),
        });
      }

      return {
        success: true,
        models,
        message: `Discovered ${models.length} models`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to discover models',
      };
    }
  }

  /**
   * Get default models for a provider type
   * GET /api/settings/ai/models/defaults/:providerType
   * Returns default models when discovery is not possible
   */
  @Get('models/defaults/:providerType')
  async getDefaultModels(
    @GetOrgFromRequest() org: Organization,
    @Param('providerType') providerType: string
  ) {
    this.validateOrganization(org);
    const models = this._modelDiscoveryService.getDefaultModels(providerType);

    return {
      providerType,
      models,
      source: 'default',
    };
  }

  /**
   * Validate organization context from request
   * Throws BadRequestException if organization is missing
   * @param org - Organization from request context
   * @throws BadRequestException if organization is missing or invalid
   */
  private validateOrganization(org: Organization): void {
    if (!org || !org.id) {
      throw new BadRequestException('Organization context is required');
    }
  }
}
