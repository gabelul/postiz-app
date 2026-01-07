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
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AdminGuard } from '@gitroom/nestjs-libraries/guards/admin.guard';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { AITaskConfigService } from '@gitroom/nestjs-libraries/chat/ai-task-config.service';
import { SetTaskAssignmentDto, VALID_TASK_TYPES, ValidTaskType } from './ai-tasks.dto';

/**
 * Admin AI Task Assignments Controller
 *
 * Manages AI provider to task type assignments.
 * All endpoints require superAdmin privileges (protected by AdminGuard).
 *
 * Provides CRUD operations for task assignments including:
 * - Image generation (dall-e-3, stable-diffusion, etc.)
 * - Text generation (gpt-4, claude, etc.)
 * - Video slides generation
 * - Agent/Copilot tasks
 *
 * Each task can have:
 * - Primary provider and model
 * - Fallback provider and model (optional)
 */
@ApiTags('Admin - AI Task Assignments')
@Controller('/api/admin/settings/ai-tasks')
@UseGuards(AdminGuard)
export class AdminAITasksController {
  private readonly logger = new Logger(AdminAITasksController.name);

  constructor(
    private readonly _prisma: PrismaService,
    private readonly _aiTaskConfig: AITaskConfigService,
  ) {}

  /**
   * Get all task assignments for an organization
   * @param org - Organization from request context
   * @returns List of task assignments with provider details
   */
  @Get()
  @ApiOperation({
    summary: 'List all task assignments',
    description: 'Returns all AI task assignments configured for the organization',
  })
  @ApiResponse({ status: 200, description: 'List of task assignments' })
  async getTaskAssignments(@GetOrgFromRequest() org: Organization) {
    const assignments = await this._prisma.aITaskAssignment.findMany({
      where: {
        organizationId: org.id,
      },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            type: true,
            isDefault: true,
          },
        },
        fallbackProvider: {
          select: {
            id: true,
            name: true,
            type: true,
            isDefault: true,
          },
        },
      },
      orderBy: { taskType: 'asc' },
    });

    return {
      assignments: assignments.map((a) => ({
        id: a.id,
        taskType: a.taskType,
        provider: a.provider,
        model: a.model,
        fallbackProvider: a.fallbackProvider,
        fallbackModel: a.fallbackModel,
      })),
    };
  }

  /**
   * Get task assignments grouped by task type
   * Returns a structure suitable for the UI with all task types
   * @param org - Organization from request context
   * @returns Task assignments with available providers and models
   */
  @Get('with-providers')
  @ApiOperation({
    summary: 'Get task assignments with available providers',
    description: 'Returns task assignments along with available providers and their models',
  })
  @ApiResponse({ status: 200, description: 'Task assignments with providers' })
  async getTasksWithProviders(@GetOrgFromRequest() org: Organization) {
    // Get all providers for this org
    const providers = await this._prisma.aIProvider.findMany({
      where: {
        organizationId: org.id,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        type: true,
        availableModels: true,
        isDefault: true,
      },
    });

    // Parse available models for each provider
    const providersWithModels = providers.map((p) => {
      let models = [];
      try {
        models = p.availableModels
          ? JSON.parse(p.availableModels)
          : getDefaultModelsForType(p.type);
      } catch (e) {
        models = getDefaultModelsForType(p.type);
      }
      return {
        ...p,
        models,
      };
    });

    // Get existing assignments
    const assignments = await this._prisma.aITaskAssignment.findMany({
      where: { organizationId: org.id },
      include: {
        provider: true,
        fallbackProvider: true,
      },
    });

    const assignmentMap = new Map(
      assignments.map((a) => [a.taskType, a])
    );

    // Task type definitions
    const taskTypes = [
      {
        key: 'image',
        label: 'Image Generation',
        description: 'DALL-E, Stable Diffusion for image creation',
        modelRecommendation: 'Image models: dall-e-3, dall-e-2, stable-diffusion',
        icon: '🖼️',
      },
      {
        key: 'text',
        label: 'Text Generation',
        description: 'Social media posts, content writing',
        modelRecommendation: 'Text models: gpt-4.1, gpt-4o, claude-3-5-sonnet, gemini-2.0-flash',
        icon: '📝',
      },
      {
        key: 'video-slides',
        label: 'Video Slides',
        description: 'Generate image prompts and voice text for videos (uses text LLM)',
        modelRecommendation: 'Text models: gpt-4.1, gpt-4o, claude-3-5-sonnet (creates slide structure, not images directly)',
        icon: '🎬',
      },
      {
        key: 'agent',
        label: 'Agent / Copilot',
        description: 'AI assistant and chat functionality',
        modelRecommendation: 'Text models: gpt-4.1, claude-3-5-sonnet, gemini-2.0-flash',
        icon: '🤖',
      },
    ];

    return {
      taskTypes: taskTypes.map((tt) => {
        const assignment = assignmentMap.get(tt.key);
        return {
          ...tt,
          assignment: assignment
            ? {
                strategy: assignment.strategy || 'fallback',
                providerId: assignment.providerId,
                providerName: assignment.provider.name,
                providerType: assignment.provider.type,
                model: assignment.model,
                fallbackProviderId: assignment.fallbackProviderId,
                fallbackProviderName: assignment.fallbackProvider?.name,
                fallbackProviderType: assignment.fallbackProvider?.type,
                fallbackModel: assignment.fallbackModel,
                roundRobinProviders: this._parseJsonSafely(assignment.roundRobinProviders),
              }
            : null,
        };
      }),
      providers: providersWithModels,
    };
  }

  /**
   * Get a single task assignment by task type
   * @param org - Organization from request context
   * @param taskType - The task type (image, text, video-slides, agent)
   * @returns Task assignment details
   */
  @Get(':taskType')
  @ApiOperation({
    summary: 'Get task assignment',
    description: 'Returns details of a specific task assignment',
  })
  @ApiResponse({ status: 200, description: 'Task assignment details' })
  async getTaskAssignment(
    @GetOrgFromRequest() org: Organization,
    @Param('taskType') taskType: string
  ) {
    const assignment = await this._prisma.aITaskAssignment.findFirst({
      where: {
        organizationId: org.id,
        taskType,
      },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            type: true,
            isDefault: true,
            testStatus: true,
            lastTestedAt: true,
          },
        },
        fallbackProvider: {
          select: {
            id: true,
            name: true,
            type: true,
            isDefault: true,
            testStatus: true,
            lastTestedAt: true,
          },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException('Task assignment not found');
    }

    return assignment;
  }

  /**
   * Create or update a task assignment
   * @param org - Organization from request context
   * @param taskType - The task type
   * @param body - Assignment data with DTO validation
   * @returns Created/updated assignment
   */
  @Put(':taskType')
  @ApiOperation({
    summary: 'Set task assignment',
    description: 'Creates or updates a task assignment with provider and model',
  })
  @ApiResponse({ status: 200, description: 'Assignment saved successfully' })
  async setTaskAssignment(
    @GetOrgFromRequest() org: Organization,
    @Param('taskType') taskType: string,
    @Body() body: SetTaskAssignmentDto
  ) {
    // Validate task type using the constant from DTO
    if (!VALID_TASK_TYPES.includes(taskType as ValidTaskType)) {
      throw new BadRequestException(`Invalid task type: ${taskType}. Valid types: ${VALID_TASK_TYPES.join(', ')}`);
    }

    // Validate provider exists and is enabled
    const provider = await this._prisma.aIProvider.findFirst({
      where: {
        id: body.providerId,
        organizationId: org.id,
        deletedAt: null,
        enabled: true, // Only allow enabled providers
      },
    });

    if (!provider) {
      throw new NotFoundException('Primary provider not found or not enabled');
    }

    // Validate model availability
    if (provider.availableModels) {
      try {
        const models = JSON.parse(provider.availableModels);
        if (Array.isArray(models) && models.length > 0 && !models.includes(body.model)) {
          // We throw a BadRequest but might want to allow it with a warning in some loose-schema cases
          // For now, strict validation is better to prevent runtime errors
          throw new BadRequestException(`Model '${body.model}' is not available for this provider. Available models: ${models.join(', ')}`);
        }
      } catch (e) {
        // formatting error in DB, ignore validation
      }
    }

    // Validate fallback provider if provided (not null or empty string)
    // null explicitly clears the fallback, undefined leaves it unchanged
    // Only validate for fallback strategy
    if (body.strategy !== 'round-robin' && body.fallbackProviderId && body.fallbackProviderId !== null) {
      const fallback = await this._prisma.aIProvider.findFirst({
        where: {
          id: body.fallbackProviderId,
          organizationId: org.id,
          deletedAt: null,
          enabled: true, // Only allow enabled providers as fallback
        },
      });

      if (!fallback) {
        throw new NotFoundException('Fallback provider not found or not enabled');
      }

      // Validate fallback model if provided
      if (body.fallbackModel && body.fallbackModel !== null && fallback.availableModels) {
        try {
          const models = JSON.parse(fallback.availableModels);
          if (Array.isArray(models) && models.length > 0 && !models.includes(body.fallbackModel)) {
            throw new BadRequestException(`Fallback model '${body.fallbackModel}' is not available for the fallback provider. Available models: ${models.join(', ')}`);
          }
        } catch (e) {
          // If parsing fails, ignore validation
        }
      }
    }

    // Validate round-robin providers if provided
    // Normalize null to empty array for consistent handling
    const rrProviders = Array.isArray(body.roundRobinProviders) ? body.roundRobinProviders : [];
    if (body.strategy === 'round-robin') {
      if (rrProviders.length === 0) {
        throw new BadRequestException('Round-robin strategy requires at least one provider');
      }

      // Batch query: Fetch all providers at once instead of N sequential queries
      const providerIds = rrProviders.map((rp) => rp.providerId);
      const batchedProviders = await this._prisma.aIProvider.findMany({
        where: {
          id: { in: providerIds },
          organizationId: org.id,
          deletedAt: null,
          enabled: true,
        },
      });

      // Create a map for efficient lookup
      const providerMap = new Map(batchedProviders.map((p) => [p.id, p]));

      for (const rp of rrProviders) {
        const rpProvider = providerMap.get(rp.providerId);

        if (!rpProvider) {
          throw new NotFoundException(`Round-robin provider '${rp.providerId}' not found or not enabled`);
        }

        // Validate model availability
        if (rpProvider.availableModels) {
          try {
            const models = JSON.parse(rpProvider.availableModels);
            if (Array.isArray(models) && models.length > 0 && !models.includes(rp.model)) {
              throw new BadRequestException(`Model '${rp.model}' is not available for provider ${rpProvider.name}. Available models: ${models.join(', ')}`);
            }
          } catch (e) {
            // formatting error in DB, ignore validation
          }
        }
      }
    }

    // Prepare update data - handle null values for clearing fallback
    const updateData: {
      providerId: string;
      model: string;
      fallbackProviderId?: string | null;
      fallbackModel?: string | null;
      strategy?: string;
      roundRobinProviders?: string | null;
    } = {
      providerId: body.providerId,
      model: body.model,
    };

    // Only set strategy if explicitly provided
    // This prevents accidentally overwriting existing strategy on partial updates
    if (body.strategy !== undefined) {
      updateData.strategy = body.strategy;
    }

    // Only include fallback fields if they are explicitly provided
    // null means clear the fallback, undefined means don't change
    if (body.fallbackProviderId !== undefined) {
      updateData.fallbackProviderId = body.fallbackProviderId || null;
    }
    if (body.fallbackModel !== undefined) {
      updateData.fallbackModel = body.fallbackModel || null;
    }

    // Handle round-robin providers - use normalized rrProviders array
    if (body.roundRobinProviders !== undefined) {
      updateData.roundRobinProviders = rrProviders.length > 0
        ? JSON.stringify(rrProviders)
        : null;
    }

    // Use Prisma's atomic upsert to handle race conditions
    // The composite unique key (organizationId, taskType) ensures atomicity
    const assignment = await this._prisma.aITaskAssignment.upsert({
      where: {
        organizationId_taskType: {
          organizationId: org.id,
          taskType,
        },
      },
      update: updateData,
      create: {
        organizationId: org.id,
        taskType,
        providerId: body.providerId,
        model: body.model,
        strategy: body.strategy || 'fallback',
        fallbackProviderId: body.fallbackProviderId || null,
        fallbackModel: body.fallbackModel || null,
        roundRobinProviders: rrProviders.length > 0
          ? JSON.stringify(rrProviders)
          : null,
      },
    });

    // Clear the organization cache so new config takes effect
    this._aiTaskConfig.clearOrganizationCache(org.id);

    return {
      success: true,
      message: 'Task assignment updated',
      assignment,
    };
  }

  /**
   * Delete a task assignment
   * @param org - Organization from request context
   * @param taskType - The task type to delete
   * @returns Success message
   */
  @Delete(':taskType')
  @ApiOperation({
    summary: 'Delete task assignment',
    description: 'Removes a task assignment (will fall back to defaults)',
  })
  @ApiResponse({ status: 200, description: 'Assignment deleted successfully' })
  async deleteTaskAssignment(
    @GetOrgFromRequest() org: Organization,
    @Param('taskType') taskType: string
  ) {
    const assignment = await this._prisma.aITaskAssignment.findFirst({
      where: {
        organizationId: org.id,
        taskType,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Task assignment not found');
    }

    await this._prisma.aITaskAssignment.delete({
      where: { id: assignment.id },
    });

    // Clear the organization cache
    this._aiTaskConfig.clearOrganizationCache(org.id);

    return {
      success: true,
      message: 'Task assignment deleted',
    };
  }

  /**
   * Safely parse JSON string
   * Returns null if parsing fails or input is empty
   * @param jsonString - JSON string to parse
   * @returns Parsed object or null
   */
  private _parseJsonSafely(jsonString: string | null): any {
    if (!jsonString) {
      return null;
    }
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      // Log error but don't crash - return null on parse failure
      this.logger.error(`Failed to parse JSON: ${e}`);
      return null;
    }
  }
}

/**
 * Get default models for a provider type
 * Used when no models are discovered yet
 */
function getDefaultModelsForType(providerType: string): string[] {
  const defaults: Record<string, string[]> = {
    openai: [
      'gpt-4.1',
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-3.5-turbo',
      'dall-e-3',
      'dall-e-2',
    ],
    anthropic: [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
    ],
    gemini: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    ollama: ['llama3.2', 'llama3.1', 'mistral', 'codellama'],
    together: [
      'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
      'mistralai/Mistral-7B-Instruct-v0.3',
    ],
    'openai-compatible': [
      'gpt-4.1',
      'gpt-4o-mini',
      'gpt-3.5-turbo',
      'dall-e-3',
    ],
  };

  return defaults[providerType] || ['gpt-4.1', 'gpt-4o-mini'];
}
