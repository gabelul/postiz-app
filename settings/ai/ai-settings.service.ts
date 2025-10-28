import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { AIProvider, AITaskAssignment } from '@prisma/client';

/**
 * Service for managing AI provider configurations and task assignments
 * Handles CRUD operations for AI providers and task-to-provider mappings
 */
@Injectable()
export class AISettingsService {
  constructor(private _prisma: PrismaService) {}

  /**
   * Get all AI providers for an organization
   * @param organizationId - Organization ID
   * @returns Array of AI providers
   */
  async getProviders(organizationId: string): Promise<AIProvider[]> {
    return this._prisma.aIProvider.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get a specific AI provider by ID
   * @param organizationId - Organization ID
   * @param providerId - Provider ID
   * @returns AI provider details
   */
  async getProvider(organizationId: string, providerId: string): Promise<AIProvider | null> {
    return this._prisma.aIProvider.findFirst({
      where: {
        id: providerId,
        organizationId,
        deletedAt: null,
      },
    });
  }

  /**
   * Create a new AI provider configuration
   * @param organizationId - Organization ID
   * @param data - Provider configuration data
   * @returns Created AI provider
   */
  async createProvider(
    organizationId: string,
    data: {
      name: string;
      type: string;
      apiKey: string;
      baseUrl?: string;
      customConfig?: string;
      isDefault?: boolean;
    }
  ): Promise<AIProvider> {
    return this._prisma.aIProvider.create({
      data: {
        organizationId,
        ...data,
      },
    });
  }

  /**
   * Update an AI provider configuration
   * @param organizationId - Organization ID
   * @param providerId - Provider ID
   * @param data - Updated provider data
   * @returns Updated AI provider
   * @throws NotFoundException if provider not found for this organization
   */
  async updateProvider(
    organizationId: string,
    providerId: string,
    data: Partial<{
      name: string;
      type: string;
      apiKey: string;
      baseUrl: string;
      customConfig: string;
      enabled: boolean;
      isDefault: boolean;
      availableModels: string;
      testStatus: string;
      testError: string;
      lastTestedAt: Date;
    }>
  ): Promise<AIProvider> {
    // Verify provider exists and belongs to this organization
    const provider = await this._prisma.aIProvider.findFirst({
      where: {
        id: providerId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!provider) {
      throw new NotFoundException(`Provider not found`);
    }

    return this._prisma.aIProvider.update({
      where: {
        id: providerId,
      },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Soft delete an AI provider
   * @param organizationId - Organization ID
   * @param providerId - Provider ID
   * @returns Deleted AI provider
   * @throws NotFoundException if provider not found for this organization
   * @throws BadRequestException if provider is still assigned to tasks
   */
  async deleteProvider(organizationId: string, providerId: string): Promise<AIProvider> {
    // Verify provider exists and belongs to this organization
    const provider = await this._prisma.aIProvider.findFirst({
      where: {
        id: providerId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!provider) {
      throw new NotFoundException(`Provider not found`);
    }

    // Check if provider is assigned to any tasks
    const tasksUsingProvider = await this._prisma.aITaskAssignment.findMany({
      where: {
        OR: [
          { providerId },
          { fallbackProviderId: providerId },
        ],
      },
      select: {
        taskType: true,
      },
    });

    if (tasksUsingProvider.length > 0) {
      throw new BadRequestException(
        `Provider is currently assigned to tasks: ${tasksUsingProvider.map((t) => t.taskType).join(', ')}. Please reassign these tasks before deleting.`
      );
    }

    return this._prisma.aIProvider.update({
      where: {
        id: providerId,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Get task assignments for an organization
   * @param organizationId - Organization ID
   * @returns Array of task assignments with provider details
   */
  async getTaskAssignments(organizationId: string): Promise<
    (AITaskAssignment & {
      provider: AIProvider;
      fallbackProvider: AIProvider | null;
    })[]
  > {
    return this._prisma.aITaskAssignment.findMany({
      where: {
        organizationId,
      },
      include: {
        provider: true,
        fallbackProvider: true,
      },
      orderBy: {
        taskType: 'asc',
      },
    });
  }

  /**
   * Get a specific task assignment
   * @param organizationId - Organization ID
   * @param taskType - Task type (image, text, video-slides, agent)
   * @returns Task assignment with provider details
   */
  async getTaskAssignment(organizationId: string, taskType: string) {
    return this._prisma.aITaskAssignment.findFirst({
      where: {
        organizationId,
        taskType,
      },
      include: {
        provider: true,
        fallbackProvider: true,
      },
    });
  }

  /**
   * Update a task assignment
   * @param organizationId - Organization ID
   * @param taskType - Task type
   * @param data - Assignment data
   * @returns Updated task assignment
   */
  async updateTaskAssignment(
    organizationId: string,
    taskType: string,
    data: {
      providerId: string;
      model: string;
      fallbackProviderId?: string | null;
      fallbackModel?: string;
    }
  ): Promise<AITaskAssignment> {
    // Check if assignment exists
    const existing = await this._prisma.aITaskAssignment.findFirst({
      where: {
        organizationId,
        taskType,
      },
    });

    if (existing) {
      // Update existing assignment
      return this._prisma.aITaskAssignment.update({
        where: {
          id: existing.id,
        },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new assignment
      return this._prisma.aITaskAssignment.create({
        data: {
          organizationId,
          taskType,
          ...data,
        },
      });
    }
  }

  /**
   * Update provider test status
   * @param organizationId - Organization ID
   * @param providerId - Provider ID
   * @param testStatus - Test status (SUCCESS, FAILED)
   * @param testError - Optional error message
   * @returns Updated provider
   * @throws NotFoundException if provider not found for this organization
   */
  async updateProviderTestStatus(
    organizationId: string,
    providerId: string,
    testStatus: 'SUCCESS' | 'FAILED',
    testError?: string
  ): Promise<AIProvider> {
    // Verify provider exists and belongs to this organization
    const provider = await this._prisma.aIProvider.findFirst({
      where: {
        id: providerId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!provider) {
      throw new NotFoundException(`Provider not found`);
    }

    return this._prisma.aIProvider.update({
      where: {
        id: providerId,
      },
      data: {
        testStatus,
        testError: testError || null,
        lastTestedAt: new Date(),
      },
    });
  }

  /**
   * Validate provider configuration by testing it
   * This method should be called with actual API calls to verify the provider works
   * @param provider - Provider configuration
   * @returns Validation result
   */
  async validateProvider(provider: AIProvider): Promise<{
    valid: boolean;
    error?: string;
    availableModels?: string[];
  }> {
    try {
      // This is a placeholder - actual validation would call the provider API
      // For now, we just check that the API key is not empty
      if (!provider.apiKey) {
        return { valid: false, error: 'API key is required' };
      }

      // In the real implementation, we would:
      // 1. Call the provider's API to verify the key
      // 2. Get available models
      // 3. Return the results

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
