/**
 * Interface for AI provider adapters
 * Allows support for multiple AI providers (OpenAI, Anthropic, custom OpenAI-compatible services)
 */

/**
 * Represents an AI provider adapter that can be used for various tasks
 */
export interface IAIProviderAdapter {
  /**
   * Name of the provider (e.g., 'openai', 'anthropic', 'custom')
   */
  readonly providerName: string;

  /**
   * Get the underlying client for this provider
   * Returns the native client (e.g., OpenAI instance, Anthropic instance)
   */
  getClient(): any;

  /**
   * Check if this adapter can perform image generation
   */
  supportsImageGeneration(): boolean;

  /**
   * Check if this adapter can perform text generation
   */
  supportsTextGeneration(): boolean;

  /**
   * Get available models for this provider
   * @param taskType - Type of task ('image', 'text', 'video', etc.)
   */
  getAvailableModels(taskType: 'image' | 'text' | 'video-slides'): string[];

  /**
   * Get the default model for a specific task type
   */
  getDefaultModel(taskType: 'image' | 'text' | 'video-slides'): string;

  /**
   * Validate that required configuration is present
   */
  validateConfiguration(): { valid: boolean; errors: string[] };
}

/**
 * Configuration for a specific AI task
 */
export interface IAITaskConfig {
  /**
   * Type of task (image, text, video-slides, agent, or legacy smart/fast)
   */
  taskType: 'image' | 'text' | 'video-slides' | 'agent' | 'smart' | 'fast';

  /**
   * Primary provider to use (e.g., 'openai', 'anthropic', 'custom')
   * This is the provider type for backward compatibility
   * @deprecated Use providerId instead
   */
  provider: string;

  /**
   * Primary provider ID to use
   * This is the database ID of the AIProvider record
   */
  providerId?: string;

  /**
   * Model to use (e.g., 'gpt-4.1', 'claude-3-opus', 'dall-e-3')
   */
  model: string;

  /**
   * Fallback provider if primary unavailable
   * @deprecated Use fallbackProviderId instead
   */
  fallbackProvider?: string;

  /**
   * Fallback provider ID if primary unavailable
   */
  fallbackProviderId?: string;

  /**
   * Fallback model if primary unavailable
   */
  fallbackModel?: string;
}

/**
 * Provider configuration loaded from environment or database
 */
export interface IProviderConfig {
  /**
   * Type of provider (openai, anthropic, custom)
   */
  type: 'openai' | 'anthropic' | 'custom';

  /**
   * API key for authentication
   */
  apiKey: string;

  /**
   * Base URL (mainly for custom/OpenAI-compatible providers)
   */
  baseUrl?: string;

  /**
   * Additional custom configuration
   */
  customConfig?: Record<string, any>;
}

/**
 * Response from image generation
 */
export interface IImageGenerationResponse {
  url?: string;
  base64?: string;
  error?: string;
}

/**
 * Response from text generation
 */
export interface ITextGenerationResponse {
  text: string;
  model: string;
  finishReason?: string;
}

/**
 * Task type for model selection
 *
 * New types (for per-task AI configuration):
 * - 'image': Image generation (DALL-E, Stable Diffusion)
 * - 'text': Text generation (social posts, content writing)
 * - 'video-slides': Video slides generation (prompts and voice text)
 * - 'agent': AI assistant and chat functionality
 *
 * Legacy types (mapped to new types in OpenaiService):
 * - 'smart': Complex tasks, maps to 'text'
 * - 'fast': Simple tasks, maps to 'text'
 */
export type AITaskType = 'image' | 'text' | 'video-slides' | 'agent' | 'smart' | 'fast';
