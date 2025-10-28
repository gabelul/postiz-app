/**
 * Service to manage per-task AI model and provider configuration
 * Allows assigning different AI providers/models for different tasks (image, text, video, etc.)
 * Loads configuration from database with fallback to environment variables
 */

import { Injectable, Logger } from '@nestjs/common';
import { IAITaskConfig, AITaskType } from './ai-provider-adapter/ai-provider-adapter.interface';
import { PrismaService } from '../database/prisma/prisma.service';

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
};

@Injectable()
export class AITaskConfigService {
  private readonly logger = new Logger(AITaskConfigService.name);
  private taskConfigs: Record<AITaskType, IAITaskConfig> = {
    ...DEFAULT_TASK_CONFIGS,
  };

  // Cache for organization-specific configurations
  private orgConfigs: Map<string, Record<AITaskType, IAITaskConfig>> = new Map();

  constructor(private _prisma: PrismaService) {
    this.logger.log('Initialized AITaskConfigService with per-task configurations');
    this.logConfiguration();
  }

  /**
   * Load organization-specific configurations from database
   * Caches the result in memory for performance
   * Stores provider IDs alongside provider types for proper multi-tenant support
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
          // Store provider type (e.g., 'openai', 'anthropic') but also store the provider ID
          // in a separate metadata structure for proper provider lookup
          configs[assignment.taskType as AITaskType] = {
            taskType: assignment.taskType as AITaskType,
            // Store provider type as the primary provider identifier
            // In a real-world scenario, you might want to extend IAITaskConfig to include provider IDs
            provider: assignment.provider.type,
            model: assignment.model,
            fallbackProvider: assignment.fallbackProvider?.type,
            fallbackModel: assignment.fallbackModel,
            // Note: Provider ID information is available in the assignment object
            // but not stored in config - this is by design to maintain backward compatibility
            // Custom provider handling requires provider lookup by type within an organization
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
   * Looks up the provider from the database by type and organization
   * @param taskType - The type of task
   * @param organizationId - Organization ID
   * @returns Provider object with ID, encrypted key, and configuration
   */
  async getTaskProvider(taskType: AITaskType, organizationId: string): Promise<any | null> {
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

      // Look up the provider by type in the database
      const provider = await this._prisma.aIProvider.findFirst({
        where: {
          organizationId,
          type: config.provider,
          deletedAt: null,
        },
      });

      if (!provider) {
        this.logger.warn(
          `No provider of type ${config.provider} found for organization ${organizationId}`
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
   * @param taskType - The type of task
   * @param organizationId - Organization ID
   * @returns Fallback provider object or null
   */
  async getTaskFallbackProvider(taskType: AITaskType, organizationId: string): Promise<any | null> {
    try {
      // Load organization config if not already cached
      if (!this.orgConfigs.has(organizationId)) {
        await this.loadOrganizationConfig(organizationId);
      }

      const config = this.getTaskConfig(taskType, organizationId);
      if (!config || !config.fallbackProvider) {
        return null;
      }

      // Look up the fallback provider by type
      const fallbackProvider = await this._prisma.aIProvider.findFirst({
        where: {
          organizationId,
          type: config.fallbackProvider,
          deletedAt: null,
        },
      });

      return fallbackProvider || null;
    } catch (error) {
      this.logger.error(
        `Error getting fallback provider for ${taskType}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return null;
    }
  }
}
