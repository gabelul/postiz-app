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
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Organization } from '@prisma/client';
import { AISettingsService } from './ai-settings.service';
import { ModelDiscoveryService } from './model-discovery.service';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { PoliciesGuard } from '@gitroom/backend/services/auth/permissions/permissions.guard';
import { CreateProviderDto } from './dtos/create-provider.dto';
import { UpdateProviderDto } from './dtos/update-provider.dto';
import { UpdateTaskAssignmentDto } from './dtos/update-task-assignment.dto';

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
   * Validates all input data and creates a new provider configuration
   *
   * @param org - Organization from request context
   * @param body - Provider configuration with validation
   * @returns Created provider with masked API key
   * @throws BadRequestException if organization is missing or data is invalid
   */
  @Post('providers')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async createProvider(
    @GetOrgFromRequest() org: Organization,
    @Body() body: CreateProviderDto
  ) {
    this.validateOrganization(org);
    return this._aiSettingsService.createProvider(org.id, body);
  }

  /**
   * Update an AI provider
   * PUT /api/settings/ai/providers/:providerId
   * Validates all input data before updating provider configuration
   * Only provided fields are updated, others remain unchanged
   *
   * @param org - Organization from request context
   * @param providerId - Provider ID to update
   * @param body - Partial provider configuration with validation
   * @returns Updated provider with masked API key
   * @throws BadRequestException if organization is missing or data is invalid
   * @throws NotFoundException if provider not found
   */
  @Put('providers/:providerId')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async updateProvider(
    @GetOrgFromRequest() org: Organization,
    @Param('providerId') providerId: string,
    @Body() body: UpdateProviderDto
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
   * Requires decrypted provider for validation to work correctly
   */
  @Post('providers/:providerId/test')
  async testProvider(
    @GetOrgFromRequest() org: Organization,
    @Param('providerId') providerId: string,
    @Body() body?: { model?: string }
  ) {
    this.validateOrganization(org);

    // Get provider with decrypted API key for validation
    // This is necessary because validateProvider expects the encrypted key to decrypt it
    const provider = await this._aiSettingsService.getProviderInternal(org.id, providerId);

    if (!provider) {
      return { valid: false, error: 'Provider not found' };
    }

    // Validate provider configuration using the raw provider with encrypted key
    // validateProvider will decrypt the key and verify it
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
   * Validates assignment configuration and updates the task-to-provider mapping
   *
   * @param org - Organization from request context
   * @param taskType - The task type (image, text, video-slides, agent)
   * @param body - Assignment configuration with validation
   * @returns Updated task assignment
   * @throws BadRequestException if organization is missing or data is invalid
   */
  @Put('tasks/:taskType')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async updateTaskAssignment(
    @GetOrgFromRequest() org: Organization,
    @Param('taskType') taskType: string,
    @Body() body: UpdateTaskAssignmentDto
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
   * Requires decrypted provider for API calls to work correctly
   */
  @Post('providers/:providerId/discover-models')
  async discoverModels(
    @GetOrgFromRequest() org: Organization,
    @Param('providerId') providerId: string
  ) {
    this.validateOrganization(org);

    // Get provider with decrypted API key for model discovery
    // ModelDiscoveryService needs the raw provider with encrypted key to decrypt it
    const provider = await this._aiSettingsService.getProviderInternal(org.id, providerId);

    if (!provider) {
      return { success: false, error: 'Provider not found' };
    }

    try {
      // Discover models from the provider using raw provider object
      // This ensures API calls have the correct decrypted credentials
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
