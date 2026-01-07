/**
 * Service to manage per-task AI model and provider configuration
 * Allows assigning different AI providers/models for different tasks (image, text, video, etc.)
 * Loads configuration from database with fallback to environment variables
 */

import { Injectable, Logger } from '@nestjs/common';
import { IAITaskConfig, AITaskType } from './ai-provider-adapter/ai-provider-adapter.interface';
import { PrismaService } from '../database/prisma/prisma.service';
import { AIProvider } from '@prisma/client';

/**
 * AI Provider database record with decrypted API key
 * For internal use only - never send this to clients
 */
export interface DecryptedAIProvider extends Omit<AIProvider, 'apiKey'> {
  apiKey: string; // decrypted API key
}

/**
 * Configuration for each task type
 * Specifies which provider and model to use for images, text, video generation, and the agent
 * These are fallback defaults if no configuration is found in the database
 */
const DEFAULT_TASK_CONFIGS: Record<AITaskType, IAITaskConfig> = {
  image: {
    taskType: 'image',
    provider: process.env.AI_IMAGE_PROVIDER || 'openai',
    model: process.env.AI_IMAGE_MODEL || 'dall-e-3',
    fallbackProvider: process.env.AI_IMAGE_FALLBACK_PROVIDER || 'openai-compatible',
    fallbackModel: process.env.AI_IMAGE_FALLBACK_MODEL || 'dall-e-3',
  },
  text: {
    taskType: 'text',
    provider: process.env.AI_TEXT_PROVIDER || 'openai',
    model: process.env.AI_TEXT_MODEL || 'gpt-4.1',
    fallbackProvider: process.env.AI_TEXT_FALLBACK_PROVIDER || 'openai',
    fallbackModel: process.env.AI_TEXT_FALLBACK_MODEL || 'gpt-4o-mini',
  },
  'video-slides': {
    taskType: 'video-slides',
    provider: process.env.AI_VIDEO_SLIDES_PROVIDER || 'openai',
    model: process.env.AI_VIDEO_SLIDES_MODEL || 'gpt-4.1',
    fallbackProvider: process.env.AI_VIDEO_SLIDES_FALLBACK_PROVIDER || 'openai',
    fallbackModel: process.env.AI_VIDEO_SLIDES_FALLBACK_MODEL || 'gpt-4o-mini',
  },
  agent: {
    taskType: 'agent',
    provider: process.env.AI_AGENT_PROVIDER || 'openai',
    model: process.env.AI_AGENT_MODEL || 'gpt-4.1',
    fallbackProvider: process.env.AI_AGENT_FALLBACK_PROVIDER || 'openai',
    fallbackModel: process.env.AI_AGENT_FALLBACK_MODEL || 'gpt-4o-mini',
  },
  // Legacy task types (mapped to 'text' in OpenaiService)
  smart: {
    taskType: 'smart',
    provider: process.env.AI_TEXT_PROVIDER || 'openai',
    model: process.env.SMART_LLM || 'gpt-4.1',
    fallbackProvider: process.env.AI_TEXT_FALLBACK_PROVIDER || 'openai',
    fallbackModel: process.env.AI_TEXT_FALLBACK_MODEL || 'gpt-4o-mini',
  },
  fast: {
    taskType: 'fast',
    provider: process.env.AI_TEXT_PROVIDER || 'openai',
    model: process.env.FAST_LLM || 'gpt-4o-mini',
    fallbackProvider: process.env.AI_TEXT_FALLBACK_PROVIDER || 'openai',
    fallbackModel: process.env.AI_TEXT_FALLBACK_MODEL || 'gpt-4o-mini',
  },
};

@Injectable()
export class AITaskConfigService {
  private readonly logger = new Logger(AITaskConfigService.name);
  private taskConfigs: Record<AITaskType, IAITaskConfig> = {
    ...DEFAULT_TASK_CONFIGS,
  };

  // Cache for organization-specific configurations
  private orgConfigs: Map<string, Record<AITaskType, IAITaskConfig>> = new Map();

  // Track round-robin index per organization and task type
  // Key format: "organizationId:taskType"
  private roundRobinIndex: Map<string, number> = new Map();

  constructor(private _prisma: PrismaService) {
    this.logger.log('Initialized AITaskConfigService with per-task configurations');
    this.logConfiguration();
  }

  /**
   * Get the next provider index for round-robin rotation
   * Increments the counter for the next call
   * @param organizationId - Organization ID
   * @param taskType - Task type
   * @param totalProviders - Total number of providers in rotation
   * @returns Current index to use
   */
  private getRoundRobinIndex(organizationId: string, taskType: string, totalProviders: number): number {
    const key = `${organizationId}:${taskType}`;
    const currentIndex = this.roundRobinIndex.get(key) || 0;
    const nextIndex = (currentIndex + 1) % totalProviders;
    this.roundRobinIndex.set(key, nextIndex);
    return currentIndex;
  }

  /**
   * Clear round-robin indices for an organization
   * Call this when configuration changes
   * @param organizationId - Organization ID
   */
  private clearRoundRobinIndex(organizationId: string): void {
    const prefix = `${organizationId}:`;
    for (const key of this.roundRobinIndex.keys()) {
      if (key.startsWith(prefix)) {
        this.roundRobinIndex.delete(key);
      }
    }
  }

  /**
   * Load organization-specific configurations from database
   * Caches the result in memory for performance
   * Stores provider IDs for precise provider lookup
   * @param organizationId - Organization ID
   */
  async loadOrganizationConfig(organizationId: string): Promise<void> {
    try {
      // Check cache first
      if (this.orgConfigs.has(organizationId)) {
        return;
      }

      // Load from database
      const assignments = await this._prisma.aITaskAssignment.findMany({
        where: { organizationId },
        include: {
          provider: true,
          fallbackProvider: true,
        },
      });

      const configs: Record<AITaskType, IAITaskConfig> = {
        ...DEFAULT_TASK_CONFIGS,
      };

      // Convert database assignments to config format
      for (const assignment of assignments) {
        if (assignment.taskType in configs) {
          // Parse round-robin providers from JSON if present
          let roundRobinProviders: Array<{ providerId: string; model: string }> | undefined;
          if (assignment.strategy === 'round-robin' && assignment.roundRobinProviders) {
            try {
              roundRobinProviders = JSON.parse(assignment.roundRobinProviders);
            } catch (e) {
              this.logger.warn(
                `Failed to parse roundRobinProviders for ${assignment.taskType}: ${e instanceof Error ? e.message : 'Unknown error'}`
              );
            }
          }

          // Store provider ID for precise lookup, with provider type as fallback
          configs[assignment.taskType as AITaskType] = {
            taskType: assignment.taskType as AITaskType,
            provider: assignment.provider.type, // Keep for backward compatibility
            providerId: assignment.providerId, // Store provider ID
            model: assignment.model,
            fallbackProvider: assignment.fallbackProvider?.type, // Keep for backward compatibility
            fallbackProviderId: assignment.fallbackProviderId || undefined, // Store fallback provider ID
            fallbackModel: assignment.fallbackModel,
            strategy: (assignment.strategy as 'fallback' | 'round-robin') || 'fallback',
            roundRobinProviders,
          };
        }
      }

      // Cache the config
      this.orgConfigs.set(organizationId, configs);
      this.logger.log(
        `Loaded configuration for organization ${organizationId} with ${assignments.length} task assignments`
      );
    } catch (error) {
      this.logger.warn(
        `Failed to load organization config for ${organizationId}, using defaults: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      // Fall back to defaults if database is unavailable
      this.orgConfigs.set(organizationId, { ...DEFAULT_TASK_CONFIGS });
    }
  }

  /**
   * Clear cached configuration for an organization
   * Call this after updating provider settings
   * @param organizationId - Organization ID
   */
  clearOrganizationCache(organizationId: string): void {
    this.orgConfigs.delete(organizationId);
    this.clearRoundRobinIndex(organizationId); // Also clear round-robin indices
    this.logger.log(`Cleared configuration cache for organization: ${organizationId}`);
  }

  /**
   * Get configuration for a specific task type
   * Supports both global (environment variable) and organization-specific (database) configurations
   * @param taskType - The type of task (image, text, video-slides, agent)
   * @param organizationId - Optional organization ID for org-specific config
   * @returns Configuration object with provider and model
   */
  getTaskConfig(taskType: AITaskType, organizationId?: string): IAITaskConfig {
    // If organization ID is provided, check cached org config first
    if (organizationId && this.orgConfigs.has(organizationId)) {
      const orgConfigs = this.orgConfigs.get(organizationId)!;
      return orgConfigs[taskType] || DEFAULT_TASK_CONFIGS[taskType];
    }

    // Fall back to global config
    const config = this.taskConfigs[taskType];
    if (!config) {
      this.logger.warn(`No configuration found for task type: ${taskType}, using default`);
      return DEFAULT_TASK_CONFIGS[taskType] || DEFAULT_TASK_CONFIGS.text;
    }
    return config;
  }

  /**
   * Get the primary provider for a task
   * @param taskType - The type of task
   * @param organizationId - Optional organization ID for org-specific config
   * @returns Provider name (e.g., 'openai', 'anthropic', 'custom')
   */
  getPrimaryProvider(taskType: AITaskType, organizationId?: string): string {
    return this.getTaskConfig(taskType, organizationId).provider;
  }

  /**
   * Get the model to use for a task
   * @param taskType - The type of task
   * @param organizationId - Optional organization ID for org-specific config
   * @returns Model identifier (e.g., 'gpt-4.1', 'dall-e-3', 'claude-3-opus')
   */
  getModel(taskType: AITaskType, organizationId?: string): string {
    return this.getTaskConfig(taskType, organizationId).model;
  }

  /**
   * Get fallback provider for a task
   * @param taskType - The type of task
   * @param organizationId - Optional organization ID for org-specific config
   * @returns Fallback provider name or undefined
   */
  getFallbackProvider(taskType: AITaskType, organizationId?: string): string | undefined {
    return this.getTaskConfig(taskType, organizationId).fallbackProvider;
  }

  /**
   * Get fallback model for a task
   * @param taskType - The type of task
   * @param organizationId - Optional organization ID for org-specific config
   * @returns Fallback model identifier or undefined
   */
  getFallbackModel(taskType: AITaskType, organizationId?: string): string | undefined {
    return this.getTaskConfig(taskType, organizationId).fallbackModel;
  }

  /**
   * Update configuration for a specific task at runtime
   * Useful for testing or dynamic configuration changes
   * @param taskType - The type of task
   * @param config - New configuration
   */
  updateTaskConfig(taskType: AITaskType, config: Partial<IAITaskConfig>): void {
    this.taskConfigs[taskType] = {
      ...this.taskConfigs[taskType],
      ...config,
    };
    this.logger.log(`Updated configuration for task type: ${taskType}`);
  }

  /**
   * Log current configuration (useful for debugging)
   */
  private logConfiguration(): void {
    const configs = Object.entries(this.taskConfigs).map(([taskType, config]) => ({
      taskType,
      provider: config.provider,
      model: config.model,
      fallback: config.fallbackProvider ? `${config.fallbackProvider}:${config.fallbackModel}` : 'none',
    }));

    this.logger.log('Task-specific AI configurations:');
    configs.forEach((cfg) => {
      this.logger.log(
        `  ${cfg.taskType}: ${cfg.provider}/${cfg.model} (fallback: ${cfg.fallback})`
      );
    });
  }

  /**
   * Get all task configurations
   * @param organizationId - Optional organization ID for org-specific config
   * @returns All configured tasks
   */
  getAllConfigs(organizationId?: string): Record<AITaskType, IAITaskConfig> {
    if (organizationId && this.orgConfigs.has(organizationId)) {
      return { ...this.orgConfigs.get(organizationId)! };
    }
    return { ...this.taskConfigs };
  }

  /**
   * Check if a provider is configured for any task
   * @param providerName - The provider name to check
   * @param organizationId - Optional organization ID for org-specific config
   * @returns true if provider is configured
   */
  isProviderConfigured(providerName: string, organizationId?: string): boolean {
    const configs = this.getAllConfigs(organizationId);
    return Object.values(configs).some(
      (config) =>
        config.provider === providerName || config.fallbackProvider === providerName
    );
  }

  /**
   * Get the actual provider object for a task (with ID and encrypted key)
   * First checks strategy (round-robin vs fallback), then looks up provider
   * @param taskType - The type of task
   * @param organizationId - Organization ID
   * @returns Provider object with ID, encrypted key, and configuration
   */
  async getTaskProvider(taskType: AITaskType, organizationId: string): Promise<AIProvider | null> {
    try {
      // Load organization config if not already cached
      if (!this.orgConfigs.has(organizationId)) {
        await this.loadOrganizationConfig(organizationId);
      }

      const config = this.getTaskConfig(taskType, organizationId);
      if (!config) {
        this.logger.warn(`No provider configured for task type: ${taskType}`);
        return null;
      }

      // Check if round-robin strategy is configured
      if (config.strategy === 'round-robin') {
        return this.getRoundRobinProvider(taskType, organizationId);
      }

      // Fallback strategy: continue with existing logic
      // First try to lookup by provider ID (if available in config)
      // This ensures the exact provider selected in the UI is used
      if (config.providerId) {
        const provider = await this._prisma.aIProvider.findFirst({
          where: {
            id: config.providerId,
            organizationId,
            deletedAt: null,
            enabled: true, // Only return enabled providers
          },
        });

        if (provider) {
          return provider;
        }

        // Provider ID was specified but not found (maybe deleted or disabled?)
        this.logger.warn(
          `Provider with ID ${config.providerId} not found or not enabled for organization ${organizationId}, falling back to type-based lookup`
        );
      }

      // Fall back to type-based lookup for backward compatibility
      // Order by isDefault DESC to prefer the default provider, then by creation date
      const provider = await this._prisma.aIProvider.findFirst({
        where: {
          organizationId,
          type: config.provider,
          deletedAt: null,
          enabled: true, // Only return enabled providers
        },
        orderBy: [
          { isDefault: 'desc' }, // Prefer default providers
          { createdAt: 'desc' }, // Then use newer providers
        ],
      });

      if (!provider) {
        this.logger.warn(
          `No enabled provider of type ${config.provider} found for organization ${organizationId}`
        );
        return null;
      }

      return provider;
    } catch (error) {
      this.logger.error(
        `Error getting task provider for ${taskType}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return null;
    }
  }

  /**
   * Get the fallback provider object for a task
   * First tries to lookup by fallbackProviderId (if available), then falls back to type-based lookup
   * @param taskType - The type of task
   * @param organizationId - Organization ID
   * @returns Fallback provider object or null
   */
  async getTaskFallbackProvider(taskType: AITaskType, organizationId: string): Promise<AIProvider | null> {
    try {
      // Load organization config if not already cached
      if (!this.orgConfigs.has(organizationId)) {
        await this.loadOrganizationConfig(organizationId);
      }

      const config = this.getTaskConfig(taskType, organizationId);
      if (!config) {
        return null;
      }

      // First try to lookup by fallback provider ID (if available)
      if (config.fallbackProviderId) {
        const fallbackProvider = await this._prisma.aIProvider.findFirst({
          where: {
            id: config.fallbackProviderId,
            organizationId,
            deletedAt: null,
            enabled: true, // Only return enabled providers
          },
        });

        if (fallbackProvider) {
          return fallbackProvider;
        }

        // Fallback provider ID was specified but not found (maybe deleted or disabled?)
        this.logger.warn(
          `Fallback provider with ID ${config.fallbackProviderId} not found or not enabled for organization ${organizationId}, falling back to type-based lookup`
        );
      }

      // Fall back to type-based lookup for backward compatibility
      if (!config.fallbackProvider) {
        return null;
      }

      // Order by isDefault DESC to prefer the default provider, then by creation date
      const fallbackProvider = await this._prisma.aIProvider.findFirst({
        where: {
          organizationId,
          type: config.fallbackProvider,
          deletedAt: null,
          enabled: true, // Only return enabled providers
        },
        orderBy: [
          { isDefault: 'desc' }, // Prefer default providers
          { createdAt: 'desc' }, // Then use newer providers
        ],
      });

      return fallbackProvider || null;
    } catch (error) {
      this.logger.error(
        `Error getting fallback provider for ${taskType}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return null;
    }
  }

  /**
   * Get a provider using round-robin rotation strategy
   * Rotates through configured providers on each call
   * @param taskType - The type of task
   * @param organizationId - Organization ID
   * @returns Provider object or null
   */
  async getRoundRobinProvider(taskType: AITaskType, organizationId: string): Promise<AIProvider | null> {
    try {
      // Load organization config if not already cached
      if (!this.orgConfigs.has(organizationId)) {
        await this.loadOrganizationConfig(organizationId);
      }

      const config = this.getTaskConfig(taskType, organizationId);

      // Check if round-robin is configured
      if (config.strategy !== 'round-robin' || !config.roundRobinProviders || config.roundRobinProviders.length === 0) {
        this.logger.warn(
          `Round-robin not configured for task ${taskType}, falling back to default provider lookup`
        );
        return this.getTaskProvider(taskType, organizationId);
      }

      // Get current index and increment for next call
      const currentIndex = this.getRoundRobinIndex(
        organizationId,
        taskType,
        config.roundRobinProviders.length
      );

      const selectedProvider = config.roundRobinProviders[currentIndex];
      if (!selectedProvider) {
        this.logger.error(`Invalid round-robin index ${currentIndex} for task ${taskType}`);
        return null;
      }

      // Fetch the provider from database
      const provider = await this._prisma.aIProvider.findFirst({
        where: {
          id: selectedProvider.providerId,
          organizationId,
          deletedAt: null,
          enabled: true,
        },
      });

      if (!provider) {
        this.logger.warn(
          `Round-robin provider ${selectedProvider.providerId} not found or not enabled, trying next provider`
        );
        // Try next provider in rotation by calling ourselves recursively
        // Note: This will increment the index again, skipping the unavailable provider
        return this.getRoundRobinProvider(taskType, organizationId);
      }

      this.logger.log(
        `Round-robin: Using provider ${provider.name} (${provider.type}) for task ${taskType} (index ${currentIndex + 1}/${config.roundRobinProviders.length})`
      );

      return provider;
    } catch (error) {
      this.logger.error(
        `Error getting round-robin provider for ${taskType}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return null;
    }
  }
}
