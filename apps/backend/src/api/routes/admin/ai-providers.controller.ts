import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AdminGuard } from '@gitroom/nestjs-libraries/guards/admin.guard';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { User } from '@prisma/client';
import { AIProvidersService } from '@gitroom/backend/services/ai/ai-providers.service';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';

/**
 * Admin AI Providers Controller
 *
 * Manages AI provider configurations for organizations.
 * All endpoints require superAdmin privileges (protected by AdminGuard).
 *
 * Provides CRUD operations for AI providers including:
 * - OpenAI, Anthropic, Gemini, Ollama, Together AI, custom OpenAI-compatible endpoints
 * - Provider testing and model discovery
 * - Default provider selection
 */
@ApiTags('Admin - AI Providers')
@Controller('/api/admin/settings/ai-providers')
@UseGuards(AdminGuard)
export class AdminAIProvidersController {
  constructor(private readonly _aiProvidersService: AIProvidersService) {}

  /**
   * Get all AI providers for an organization
   * @param org - Organization from request context
   * @returns List of AI providers (API keys are masked)
   */
  @Get()
  @ApiOperation({
    summary: 'List all AI providers',
    description: 'Returns all AI providers configured for the organization',
  })
  @ApiResponse({ status: 200, description: 'List of AI providers' })
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute
  async getProviders(@GetOrgFromRequest() org: Organization) {
    return this._aiProvidersService.getProviders(org.id);
  }

  /**
   * Get a single AI provider
   * @param org - Organization from request context
   * @param id - Provider ID
   * @returns AI provider details (API key is masked)
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get AI provider details',
    description: 'Returns details of a specific AI provider',
  })
  @ApiResponse({ status: 200, description: 'AI provider details' })
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute
  async getProvider(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._aiProvidersService.getProvider(org.id, id);
  }

  /**
   * Create a new AI provider
   * @param org - Organization from request context
   * @param body - Provider configuration
   * @param user - Authenticated user
   * @returns Created provider (API key is masked)
   */
  @Post()
  @ApiOperation({
    summary: 'Create AI provider',
    description: 'Creates a new AI provider with the given configuration',
  })
  @ApiResponse({ status: 201, description: 'Provider created successfully' })
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async createProvider(
    @GetOrgFromRequest() org: Organization,
    @Body()
    body: {
      name: string;
      type: string;
      apiKey: string;
      baseUrl?: string;
      customConfig?: string;
    },
    @GetUserFromRequest() user: User
  ) {
    if (!body.name || !body.type) {
      throw new BadRequestException('name and type are required');
    }

    // API key is optional for some providers like ollama and custom openai-compatible
    const providersThatDontRequireKey = ['ollama', 'openai-compatible'];
    if (!body.apiKey && !providersThatDontRequireKey.includes(body.type)) {
      throw new BadRequestException(`API key is required for ${body.type} providers`);
    }

    // Use empty string as default for optional API keys
    const payload = {
      ...body,
      apiKey: body.apiKey || '',
    };

    return this._aiProvidersService.createProvider(org.id, payload);
  }

  /**
   * Update an AI provider
   * @param org - Organization from request context
   * @param id - Provider ID
   * @param body - Updated provider configuration
   * @returns Updated provider (API key is masked)
   */
  @Put(':id')
  @ApiOperation({
    summary: 'Update AI provider',
    description: 'Updates an existing AI provider configuration',
  })
  @ApiResponse({ status: 200, description: 'Provider updated successfully' })
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async updateProvider(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      type?: string;
      apiKey?: string;
      baseUrl?: string;
      customConfig?: string;
      enabled?: boolean;
    }
  ) {
    return this._aiProvidersService.updateProvider(org.id, id, body);
  }

  /**
   * Delete an AI provider
   * @param org - Organization from request context
   * @param id - Provider ID
   * @returns Success message
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete AI provider',
    description: 'Soft deletes an AI provider',
  })
  @ApiResponse({ status: 200, description: 'Provider deleted successfully' })
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async deleteProvider(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    await this._aiProvidersService.deleteProvider(org.id, id);
    return {
      success: true,
      message: 'AI provider deleted',
    };
  }

  /**
   * Test an AI provider configuration
   * @param org - Organization from request context
   * @param id - Provider ID
   * @returns Test result with status
   */
  @Post(':id/test')
  @ApiOperation({
    summary: 'Test AI provider',
    description: 'Tests the AI provider configuration by making an API call',
  })
  @ApiResponse({ status: 200, description: 'Test result' })
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests per minute (external API)
  async testProvider(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._aiProvidersService.testProvider(org.id, id);
  }

  /**
   * Discover available models for a provider
   * @param org - Organization from request context
   * @param id - Provider ID
   * @returns Discovered models
   */
  @Post(':id/discover-models')
  @ApiOperation({
    summary: 'Discover models',
    description: 'Fetches available models from the provider API',
  })
  @ApiResponse({ status: 200, description: 'Discovered models' })
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests per minute (external API)
  async discoverModels(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._aiProvidersService.discoverModels(org.id, id);
  }

  /**
   * Set a provider as the default for its type
   * @param org - Organization from request context
   * @param id - Provider ID
   * @returns Updated provider
   */
  @Post(':id/set-default')
  @ApiOperation({
    summary: 'Set as default',
    description: 'Sets this provider as the default for its type',
  })
  @ApiResponse({ status: 200, description: 'Provider set as default' })
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async setDefault(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    const provider = await this._aiProvidersService.setDefaultProvider(
      org.id,
      id
    );
    return {
      success: true,
      message: 'Provider set as default',
      provider,
    };
  }
}
