/**
 * Service to manage per-task AI model and provider configuration
 * Allows assigning different AI providers/models for different tasks (image, text, video, etc.)
 */

import { Injectable, Logger } from '@nestjs/common';
import { IAITaskConfig, AITaskType } from './ai-provider-adapter/ai-provider-adapter.interface';

/**
 * Configuration for each task type
 * Specifies which provider and model to use for images, text, video generation, and the agent
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

  constructor() {
    this.logger.log('Initialized AITaskConfigService with per-task configurations');
    this.logConfiguration();
  }

  /**
   * Get configuration for a specific task type
   * @param taskType - The type of task (image, text, video-slides, agent)
   * @returns Configuration object with provider and model
   */
  getTaskConfig(taskType: AITaskType): IAITaskConfig {
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
   * @returns Provider name (e.g., 'openai', 'anthropic', 'custom')
   */
  getPrimaryProvider(taskType: AITaskType): string {
    return this.getTaskConfig(taskType).provider;
  }

  /**
   * Get the model to use for a task
   * @param taskType - The type of task
   * @returns Model identifier (e.g., 'gpt-4.1', 'dall-e-3', 'claude-3-opus')
   */
  getModel(taskType: AITaskType): string {
    return this.getTaskConfig(taskType).model;
  }

  /**
   * Get fallback provider for a task
   * @param taskType - The type of task
   * @returns Fallback provider name or undefined
   */
  getFallbackProvider(taskType: AITaskType): string | undefined {
    return this.getTaskConfig(taskType).fallbackProvider;
  }

  /**
   * Get fallback model for a task
   * @param taskType - The type of task
   * @returns Fallback model identifier or undefined
   */
  getFallbackModel(taskType: AITaskType): string | undefined {
    return this.getTaskConfig(taskType).fallbackModel;
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
   * @returns All configured tasks
   */
  getAllConfigs(): Record<AITaskType, IAITaskConfig> {
    return { ...this.taskConfigs };
  }

  /**
   * Check if a provider is configured for any task
   * @param providerName - The provider name to check
   * @returns true if provider is configured
   */
  isProviderConfigured(providerName: string): boolean {
    return Object.values(this.taskConfigs).some(
      (config) =>
        config.provider === providerName || config.fallbackProvider === providerName
    );
  }
}
