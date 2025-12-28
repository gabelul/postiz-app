import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { AIProvider, Prisma } from '@prisma/client';
import OpenAI from 'openai';

/**
 * AI Provider with decrypted API key for internal use
 * Extends AIProvider but explicitly marks apiKey as decrypted string
 */
interface DecryptedAIProvider extends Omit<AIProvider, 'apiKey'> {
  apiKey: string; // decrypted API key
}

/**
 * AI Providers Service
 *
 * Manages AI provider configurations including:
 * - CRUD operations for AI providers
 * - API key encryption/decryption
 * - Provider testing
 * - Model discovery
 */
@Injectable()
export class AIProvidersService {
  private readonly logger = new Logger(AIProvidersService.name);

  constructor(
    private readonly _prismaService: PrismaService,
  ) {}

  /**
   * Get all AI providers for an organization
   * @param organizationId - Organization ID
   * @returns Array of AI providers (with masked API keys)
   */
  async getProviders(organizationId: string): Promise<AIProvider[]> {
    const providers = await this._prismaService.aIProvider.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Mask API keys for security
    return providers.map((p) => this.maskApiKey(p));
  }

  /**
   * Get a single AI provider by ID
   * @param organizationId - Organization ID
   * @param providerId - Provider ID
   * @returns AI provider with masked API key
   * @throws NotFoundException if provider not found
   */
  async getProvider(
    organizationId: string,
    providerId: string
  ): Promise<AIProvider> {
    const provider = await this._prismaService.aIProvider.findFirst({
      where: {
        id: providerId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!provider) {
      throw new NotFoundException(`AI provider with ID ${providerId} not found`);
    }

    return this.maskApiKey(provider);
  }

  /**
   * Get provider with decrypted API key for internal use
   * @param organizationId - Organization ID
   * @param providerId - Provider ID
   * @returns AI provider with decrypted API key
   */
  async getProviderInternal(
    organizationId: string,
    providerId: string
  ): Promise<DecryptedAIProvider> {
    const provider = await this._prismaService.aIProvider.findFirst({
      where: {
        id: providerId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!provider) {
      throw new NotFoundException(`AI provider with ID ${providerId} not found`);
    }

    // Decrypt API key for internal use with error handling
    try {
      const decryptedKey = AuthService.fixedDecryption(provider.apiKey);
      return {
        ...provider,
        apiKey: decryptedKey,
      };
    } catch (error) {
      this.logger.error(
        `Failed to decrypt API key for provider ${providerId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw new Error('Failed to decrypt provider API key. The key may be corrupted.');
    }
  }

  /**
   * Create a new AI provider
   * @param organizationId - Organization ID
   * @param data - Provider data
   * @returns Created provider with masked API key
   */
  async createProvider(
    organizationId: string,
    data: {
      name: string;
      type: string;
      apiKey: string;
      baseUrl?: string;
      customConfig?: string;
    }
  ): Promise<AIProvider> {
    // Encrypt API key before storing with error handling
    let encryptedKey: string;
    try {
      encryptedKey = AuthService.fixedEncryption(data.apiKey);
    } catch (error) {
      this.logger.error(
        `Failed to encrypt API key: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw new Error('Failed to encrypt API key. Check your JWT_SECRET configuration.');
    }

    // If this is the first provider, make it default
    const existingCount = await this._prismaService.aIProvider.count({
      where: { organizationId, deletedAt: null },
    });

    const provider = await this._prismaService.aIProvider.create({
      data: {
        organizationId,
        name: data.name,
        type: data.type,
        apiKey: encryptedKey,
        baseUrl: data.baseUrl,
        customConfig: data.customConfig,
        isDefault: existingCount === 0,
      },
    });

    this.logger.log(`Created AI provider ${provider.id} for org ${organizationId}`);
    return this.maskApiKey(provider);
  }

  /**
   * Update an existing AI provider
   * @param organizationId - Organization ID
   * @param providerId - Provider ID
   * @param data - Updated provider data
   * @returns Updated provider with masked API key
   */
  async updateProvider(
    organizationId: string,
    providerId: string,
    data: {
      name?: string;
      type?: string;
      apiKey?: string;
      baseUrl?: string;
      customConfig?: string;
      enabled?: boolean;
    }
  ): Promise<AIProvider> {
    // Verify provider exists
    await this.getProvider(organizationId, providerId);

    // Prepare update data
    const updateData: Prisma.AIProviderUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.baseUrl !== undefined) updateData.baseUrl = data.baseUrl;
    if (data.customConfig !== undefined) updateData.customConfig = data.customConfig;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;

    // Encrypt new API key if provided with error handling
    if (data.apiKey !== undefined) {
      try {
        updateData.apiKey = AuthService.fixedEncryption(data.apiKey);
      } catch (error) {
        this.logger.error(
          `Failed to encrypt API key: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        throw new Error('Failed to encrypt API key. Check your JWT_SECRET configuration.');
      }
    }

    const provider = await this._prismaService.aIProvider.update({
      where: { id: providerId },
      data: updateData,
    });

    this.logger.log(`Updated AI provider ${providerId}`);
    return this.maskApiKey(provider);
  }

  /**
   * Delete an AI provider (soft delete)
   * @param organizationId - Organization ID
   * @param providerId - Provider ID
   */
  async deleteProvider(organizationId: string, providerId: string): Promise<void> {
    // Verify provider exists
    await this.getProvider(organizationId, providerId);

    await this._prismaService.aIProvider.update({
      where: { id: providerId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Deleted AI provider ${providerId}`);
  }

  /**
   * Test a provider configuration
   * @param organizationId - Organization ID
   * @param providerId - Provider ID
   * @returns Test result with success status
   */
  async testProvider(
    organizationId: string,
    providerId: string
  ): Promise<{ valid: boolean; error?: string; models?: string[] }> {
    try {
      const provider = await this.getProviderInternal(organizationId, providerId);

      // Create OpenAI client with provider's configuration
      const client = new OpenAI({
        apiKey: provider.apiKey,
        baseURL: provider.baseUrl || undefined,
      });

      // Test with a simple models list request
      const response = await client.models.list();

      // Update provider with test success
      await this._prismaService.aIProvider.update({
        where: { id: providerId },
        data: {
          testStatus: 'SUCCESS',
          testError: null,
          lastTestedAt: new Date(),
        },
      });

      return {
        valid: true,
        models: response.data.map((m) => m.id).slice(0, 50), // Limit to 50 models
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Update provider with test failure
      await this._prismaService.aIProvider.update({
        where: { id: providerId },
        data: {
          testStatus: 'FAILED',
          testError: errorMessage,
          lastTestedAt: new Date(),
        },
      });

      this.logger.error(`Provider test failed: ${errorMessage}`);
      return { valid: false, error: errorMessage };
    }
  }

  /**
   * Discover available models for a provider
   * @param organizationId - Organization ID
   * @param providerId - Provider ID
   * @returns Discovered models
   */
  async discoverModels(
    organizationId: string,
    providerId: string
  ): Promise<{ success: boolean; models: string[]; error?: string }> {
    try {
      const provider = await this.getProviderInternal(organizationId, providerId);

      const client = new OpenAI({
        apiKey: provider.apiKey,
        baseURL: provider.baseUrl || undefined,
      });

      const response = await client.models.list();
      const models = response.data.map((m) => m.id);

      // Update provider with discovered models
      await this._prismaService.aIProvider.update({
        where: { id: providerId },
        data: {
          availableModels: JSON.stringify(models),
        },
      });

      this.logger.log(`Discovered ${models.length} models for provider ${providerId}`);
      return { success: true, models };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Model discovery failed: ${errorMessage}`);
      return { success: false, models: [], error: errorMessage };
    }
  }

  /**
   * Set a provider as the default for its type
   * Uses a transaction to prevent race conditions
   * @param organizationId - Organization ID
   * @param providerId - Provider ID
   * @returns Updated provider
   */
  async setDefaultProvider(
    organizationId: string,
    providerId: string
  ): Promise<AIProvider> {
    // Use transaction to prevent race condition - ensure only one provider is default at a time
    return this._prismaService.$transaction(async (tx) => {
      const provider = await tx.aIProvider.findFirst({
        where: {
          id: providerId,
          organizationId,
          deletedAt: null,
        },
      });

      if (!provider) {
        throw new NotFoundException(`AI provider with ID ${providerId} not found`);
      }

      // Unset isDefault for all providers of the same type within the transaction
      await tx.aIProvider.updateMany({
        where: {
          organizationId,
          type: provider.type,
          deletedAt: null,
        },
        data: { isDefault: false },
      });

      // Set this provider as default within the same transaction
      const updated = await tx.aIProvider.update({
        where: { id: providerId },
        data: { isDefault: true },
      });

      this.logger.log(`Set provider ${providerId} as default for type ${provider.type}`);
      return this.maskApiKey(updated);
    });
  }

  /**
   * Mask API key for client responses
   * @param provider - Provider with full API key
   * @returns Provider with masked API key
   */
  private maskApiKey(provider: AIProvider): AIProvider {
    return {
      ...provider,
      apiKey: provider.apiKey ? '***REDACTED***' : '',
    };
  }
}
