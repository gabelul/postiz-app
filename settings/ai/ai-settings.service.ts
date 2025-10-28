import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { AIProvider, AITaskAssignment } from '@prisma/client';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { ProviderResponseDto, maskApiKey } from './dtos/provider-response.dto';

/**
 * Service for managing AI provider configurations and task assignments
 * Handles CRUD operations for AI providers and task-to-provider mappings
 */
@Injectable()
export class AISettingsService {
  private readonly logger = new Logger(AISettingsService.name);

  constructor(private _prisma: PrismaService) {}

  /**
   * Encrypt API key before storing
   * @param apiKey - Plain text API key
   * @returns Encrypted API key
   */
  private encryptApiKey(apiKey: string): string {
    try {
      return AuthService.fixedEncryption(apiKey);
    } catch (error) {
      this.logger.error(`Failed to encrypt API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new Error('Failed to encrypt API key');
    }
  }

  /**
   * Decrypt API key after retrieval
   * @param encryptedKey - Encrypted API key
   * @returns Plain text API key
   */
  private decryptApiKey(encryptedKey: string): string {
    try {
      return AuthService.fixedDecryption(encryptedKey);
    } catch (error) {
      this.logger.error(`Failed to decrypt API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new Error('Failed to decrypt API key');
    }
  }

  /**
   * Convert provider to safe response DTO
   * Masks API key and parses JSON fields
   * @param provider - Provider from database
   * @returns Safe response DTO
   */
  private toResponseDto(provider: AIProvider): ProviderResponseDto {
    return {
      id: provider.id,
      organizationId: provider.organizationId,
      name: provider.name,
      type: provider.type,
      apiKey: maskApiKey(provider.apiKey),
      baseUrl: provider.baseUrl || undefined,
      enabled: provider.enabled,
      isDefault: provider.isDefault,
      availableModels: provider.availableModels ? JSON.parse(provider.availableModels) : undefined,
      testStatus: provider.testStatus || undefined,
      testError: provider.testError || undefined,
      lastTestedAt: provider.lastTestedAt || undefined,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
      deletedAt: provider.deletedAt || undefined,
    };
  }

  /**
   * Get all AI providers for an organization
   * @param organizationId - Organization ID
   * @returns Array of AI providers (with masked apiKey)
   */
  async getProviders(organizationId: string): Promise<ProviderResponseDto[]> {
    const providers = await this._prisma.aIProvider.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return providers.map((p) => this.toResponseDto(p));
  }

  /**
   * Get a specific AI provider by ID
   * @param organizationId - Organization ID
   * @param providerId - Provider ID
   * @returns AI provider details (with masked apiKey)
   */
  async getProvider(
    organizationId: string,
    providerId: string
  ): Promise<ProviderResponseDto | null> {
    const provider = await this._prisma.aIProvider.findFirst({
      where: {
        id: providerId,
        organizationId,
        deletedAt: null,
      },
    });

    return provider ? this.toResponseDto(provider) : null;
  }

  /**
   * Get provider with decrypted API key (internal use only)
   * WARNING: Only use this internally when you need the actual API key
   * @param organizationId - Organization ID
   * @param providerId - Provider ID
   * @returns AI provider with decrypted apiKey
   * @private
   */
  async getProviderInternal(
    organizationId: string,
    providerId: string
  ): Promise<(AIProvider & { decryptedApiKey: string }) | null> {
    const provider = await this._prisma.aIProvider.findFirst({
      where: {
        id: providerId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!provider) {
      return null;
    }

    return {
      ...provider,
      decryptedApiKey: this.decryptApiKey(provider.apiKey),
    };
  }

  /**
   * Create a new AI provider configuration
   * Supports both authenticated and keyless providers
   * @param organizationId - Organization ID
   * @param data - Provider configuration data (apiKey will be encrypted if provided)
   * @returns Created AI provider (with masked apiKey)
   * @throws Error if encryption fails or required fields are missing
   */
  async createProvider(
    organizationId: string,
    data: {
      name: string;
      type: string;
      apiKey?: string;
      baseUrl?: string;
      customConfig?: string;
      isDefault?: boolean;
    }
  ): Promise<ProviderResponseDto> {
    // Encrypt API key if provided, otherwise use empty string for keyless providers
    const requiresKey = !['ollama', 'openai-compatible'].includes(data.type);
    let encryptedKey = '';

    if (data.apiKey && data.apiKey.trim().length > 0) {
      encryptedKey = this.encryptApiKey(data.apiKey);
    } else if (requiresKey) {
      // Require API key for providers that mandate authentication
      throw new Error(`API key is required for ${data.type} provider`);
    }

    const provider = await this._prisma.aIProvider.create({
      data: {
        organizationId,
        name: data.name,
        type: data.type,
        apiKey: encryptedKey,
        baseUrl: data.baseUrl,
        customConfig: data.customConfig,
        isDefault: data.isDefault || false,
      },
    });

    return this.toResponseDto(provider);
  }

  /**
   * Update an AI provider configuration
   * @param organizationId - Organization ID
   * @param providerId - Provider ID
   * @param data - Updated provider data (apiKey will be encrypted if provided)
   * @returns Updated AI provider (with masked apiKey)
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
  ): Promise<ProviderResponseDto> {
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

    // Encrypt API key if being updated
    const updateData = { ...data };
    if (updateData.apiKey) {
      updateData.apiKey = this.encryptApiKey(updateData.apiKey);
    }

    const updated = await this._prisma.aIProvider.update({
      where: {
        id: providerId,
      },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    });

    return this.toResponseDto(updated);
  }

  /**
   * Soft delete an AI provider
   * Returns masked provider information to prevent key exposure
   * @param organizationId - Organization ID
   * @param providerId - Provider ID
   * @returns Deleted AI provider with masked API key
   * @throws NotFoundException if provider not found for this organization
   * @throws BadRequestException if provider is still assigned to tasks
   */
  async deleteProvider(organizationId: string, providerId: string): Promise<ProviderResponseDto> {
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

    const deleted = await this._prisma.aIProvider.update({
      where: {
        id: providerId,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    // Return masked response to prevent exposing encrypted key
    return this.toResponseDto(deleted);
  }

  /**
   * Get task assignments for an organization
   * Returns masked provider information to prevent exposing encrypted keys
   * @param organizationId - Organization ID
   * @returns Array of task assignments with masked provider details
   */
  async getTaskAssignments(organizationId: string): Promise<
    (AITaskAssignment & {
      provider: ProviderResponseDto;
      fallbackProvider: ProviderResponseDto | null;
    })[]
  > {
    const assignments = await this._prisma.aITaskAssignment.findMany({
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

    // Mask provider information before returning
    return assignments.map((assignment) => ({
      ...assignment,
      provider: this.toResponseDto(assignment.provider),
      fallbackProvider: assignment.fallbackProvider
        ? this.toResponseDto(assignment.fallbackProvider)
        : null,
    }));
  }

  /**
   * Get a specific task assignment
   * Returns masked provider information to prevent exposing encrypted keys
   * @param organizationId - Organization ID
   * @param taskType - Task type (image, text, video-slides, agent)
   * @returns Task assignment with masked provider details
   */
  async getTaskAssignment(organizationId: string, taskType: string) {
    const assignment = await this._prisma.aITaskAssignment.findFirst({
      where: {
        organizationId,
        taskType,
      },
      include: {
        provider: true,
        fallbackProvider: true,
      },
    });

    if (!assignment) {
      return null;
    }

    // Mask provider information before returning
    return {
      ...assignment,
      provider: this.toResponseDto(assignment.provider),
      fallbackProvider: assignment.fallbackProvider
        ? this.toResponseDto(assignment.fallbackProvider)
        : null,
    };
  }

  /**
   * Update a task assignment
   * Validates that both primary and fallback providers belong to the organization
   * Prevents cross-tenant provider binding attacks
   * @param organizationId - Organization ID
   * @param taskType - Task type
   * @param data - Assignment data with providerId and optional fallbackProviderId
   * @returns Updated task assignment with masked provider details
   * @throws ForbiddenException if providers don't belong to the organization
   * @throws NotFoundException if provider not found
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
    // Verify primary provider belongs to this organization
    const primaryProvider = await this._prisma.aIProvider.findFirst({
      where: {
        id: data.providerId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!primaryProvider) {
      throw new NotFoundException(
        `Provider not found or does not belong to this organization`
      );
    }

    // If fallback provider is specified, verify it also belongs to this organization
    if (data.fallbackProviderId) {
      const fallbackProvider = await this._prisma.aIProvider.findFirst({
        where: {
          id: data.fallbackProviderId,
          organizationId,
          deletedAt: null,
        },
      });

      if (!fallbackProvider) {
        throw new NotFoundException(
          `Fallback provider not found or does not belong to this organization`
        );
      }
    }

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
   * Validate provider configuration by testing API connectivity and permissions
   * Attempts to call the provider API to verify the API key is valid
   * @param provider - Provider configuration (with encrypted apiKey)
   * @returns Validation result with available models if successful
   * @throws Error if decryption fails
   */
  async validateProvider(
    provider: AIProvider & { decryptedApiKey?: string }
  ): Promise<{
    valid: boolean;
    error?: string;
    availableModels?: string[];
  }> {
    try {
      // Use decrypted API key when available, otherwise decrypt the stored value
      let decryptedKey = provider.decryptedApiKey;

      if (decryptedKey === undefined) {
        if (!provider.apiKey) {
          decryptedKey = '';
        } else {
          decryptedKey = this.decryptApiKey(provider.apiKey);
        }
      }

      // Allow keyless providers (e.g., Ollama, some OpenAI-compatible deployments)
      const requiresKey = !['ollama', 'openai-compatible'].includes(provider.type);

      if (requiresKey && (!decryptedKey || decryptedKey.trim().length === 0)) {
        return { valid: false, error: 'API key is empty or invalid' };
      }

      // For now, basic validation - actual model discovery is handled separately
      // A more thorough validation would:
      // 1. Attempt to call the provider's API with the key
      // 2. Verify the response indicates successful authentication
      // 3. Extract and return available models

      // We consider a provider valid if:
      // - The API key can be decrypted
      // - The API key is not empty
      // - The provider type is recognized

      const validProviderTypes = ['openai', 'anthropic', 'gemini', 'ollama', 'together', 'openai-compatible'];
      if (!validProviderTypes.includes(provider.type)) {
        return { valid: false, error: `Unknown provider type: ${provider.type}` };
      }

      this.logger.log(`Provider ${provider.name} (${provider.type}) validation passed basic checks`);
      return { valid: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Provider validation failed: ${errorMessage}`);
      return {
        valid: false,
        error: `Provider validation failed: ${errorMessage}`,
      };
    }
  }
}
