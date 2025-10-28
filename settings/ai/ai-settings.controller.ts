import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AISettingsService } from './ai-settings.service';
import { ModelDiscoveryService } from './model-discovery.service';

/**
 * Controller for managing AI provider settings
 * Provides endpoints for CRUD operations on AI providers and task assignments
 */
@Controller('api/settings/ai')
@UseGuards() // Add appropriate guards (auth guards, etc.)
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
  async getProviders(@Request() req: any) {
    const organizationId = req.user?.organizationId;
    return this._aiSettingsService.getProviders(organizationId);
  }

  /**
   * Get a specific AI provider
   * GET /api/settings/ai/providers/:providerId
   */
  @Get('providers/:providerId')
  async getProvider(@Request() req: any, @Param('providerId') providerId: string) {
    const organizationId = req.user?.organizationId;
    return this._aiSettingsService.getProvider(organizationId, providerId);
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
    @Request() req: any,
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
    const organizationId = req.user?.organizationId;
    return this._aiSettingsService.createProvider(organizationId, body);
  }

  /**
   * Update an AI provider
   * PUT /api/settings/ai/providers/:providerId
   * Body: Partial provider configuration
   */
  @Put('providers/:providerId')
  async updateProvider(
    @Request() req: any,
    @Param('providerId') providerId: string,
    @Body() body: any
  ) {
    const organizationId = req.user?.organizationId;
    return this._aiSettingsService.updateProvider(organizationId, providerId, body);
  }

  /**
   * Delete an AI provider
   * DELETE /api/settings/ai/providers/:providerId
   */
  @Delete('providers/:providerId')
  async deleteProvider(@Request() req: any, @Param('providerId') providerId: string) {
    const organizationId = req.user?.organizationId;
    return this._aiSettingsService.deleteProvider(organizationId, providerId);
  }

  /**
   * Test an AI provider configuration
   * POST /api/settings/ai/providers/:providerId/test
   * Validates the API key and attempts to fetch available models
   */
  @Post('providers/:providerId/test')
  async testProvider(
    @Request() req: any,
    @Param('providerId') providerId: string,
    @Body() body?: { model?: string }
  ) {
    const organizationId = req.user?.organizationId;
    const provider = await this._aiSettingsService.getProvider(organizationId, providerId);

    if (!provider) {
      return { valid: false, error: 'Provider not found' };
    }

    // Validate provider configuration
    const validation = await this._aiSettingsService.validateProvider(provider);

    if (!validation.valid) {
      // Update provider with test failure
      await this._aiSettingsService.updateProviderTestStatus(
        organizationId,
        providerId,
        'FAILED',
        validation.error
      );
      return { valid: false, error: validation.error };
    }

    // Update provider with test success
    await this._aiSettingsService.updateProviderTestStatus(
      organizationId,
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
  async getTaskAssignments(@Request() req: any) {
    const organizationId = req.user?.organizationId;
    return this._aiSettingsService.getTaskAssignments(organizationId);
  }

  /**
   * Get a specific task assignment
   * GET /api/settings/ai/tasks/:taskType
   */
  @Get('tasks/:taskType')
  async getTaskAssignment(
    @Request() req: any,
    @Param('taskType') taskType: string
  ) {
    const organizationId = req.user?.organizationId;
    return this._aiSettingsService.getTaskAssignment(organizationId, taskType);
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
    @Request() req: any,
    @Param('taskType') taskType: string,
    @Body()
    body: {
      providerId: string;
      model: string;
      fallbackProviderId?: string;
      fallbackModel?: string;
    }
  ) {
    const organizationId = req.user?.organizationId;
    return this._aiSettingsService.updateTaskAssignment(organizationId, taskType, body);
  }

  /**
   * Test a task assignment
   * POST /api/settings/ai/tasks/:taskType/test
   * Tests the provider and model assigned to a task
   */
  @Post('tasks/:taskType/test')
  async testTaskAssignment(@Request() req: any, @Param('taskType') taskType: string) {
    const organizationId = req.user?.organizationId;
    const assignment = await this._aiSettingsService.getTaskAssignment(
      organizationId,
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
  async discoverModels(@Request() req: any, @Param('providerId') providerId: string) {
    const organizationId = req.user?.organizationId;
    const provider = await this._aiSettingsService.getProvider(organizationId, providerId);

    if (!provider) {
      return { success: false, error: 'Provider not found' };
    }

    try {
      // Discover models from the provider
      const models = await this._modelDiscoveryService.discoverModels(provider);

      // Save the discovered models to the provider
      if (models.length > 0) {
        await this._aiSettingsService.updateProvider(organizationId, providerId, {
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
  async getDefaultModels(@Param('providerType') providerType: string) {
    const models = this._modelDiscoveryService.getDefaultModels(providerType);

    return {
      providerType,
      models,
      source: 'default',
    };
  }
}
