/**
 * Shared TypeScript types for AI Provider configuration
 * Can be imported by both frontend and backend applications
 * Provides type safety for API requests and responses
 */

/**
 * Supported AI provider types
 */
export type AIProviderType =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'ollama'
  | 'together'
  | 'openai-compatible'
  | 'fal'
  | 'elevenlabs';

/**
 * Task types that can be assigned to different AI providers
 */
export type AITaskType = 'image' | 'text' | 'video-slides' | 'agent';

/**
 * Test status for provider configuration
 */
export type ProviderTestStatus = 'SUCCESS' | 'FAILED' | undefined;

/**
 * Response DTO for AI Provider
 * Contains provider configuration with masked API key for security
 */
export interface IProviderResponse {
  /**
   * Unique identifier for the provider
   */
  id: string;

  /**
   * Organization that owns this provider
   */
  organizationId: string;

  /**
   * Display name for the provider
   * Example: "My OpenAI", "Production Claude"
   */
  name: string;

  /**
   * Provider type (openai, anthropic, gemini, etc.)
   */
  type: AIProviderType;

  /**
   * Masked API key - shows only last 4 characters for security
   * Format: ***...XXXX
   */
  apiKey: string;

  /**
   * Custom base URL for the provider (optional)
   * Used for OpenAI-compatible, Gemini, Ollama, etc.
   */
  baseUrl?: string;

  /**
   * Whether the provider is enabled and can be used
   */
  enabled: boolean;

  /**
   * Whether this is the default provider for new task assignments
   */
  isDefault: boolean;

  /**
   * Available models from this provider (discovered via API)
   */
  availableModels?: string[];

  /**
   * Last test result status
   */
  testStatus?: ProviderTestStatus;

  /**
   * Error message from last test failure
   */
  testError?: string;

  /**
   * When the provider was last tested
   */
  lastTestedAt?: Date;

  /**
   * When the provider was created
   */
  createdAt: Date;

  /**
   * When the provider was last updated
   */
  updatedAt: Date;

  /**
   * When the provider was deleted (soft delete)
   */
  deletedAt?: Date;
}

/**
 * Request DTO for creating a new AI provider
 */
export interface ICreateProviderRequest {
  /**
   * Display name for the provider
   */
  name: string;

  /**
   * Provider type
   */
  type: AIProviderType;

  /**
   * API key for authentication
   */
  apiKey: string;

  /**
   * Optional base URL for custom endpoints
   */
  baseUrl?: string;

  /**
   * Optional custom configuration in JSON format
   */
  customConfig?: string;

  /**
   * Whether this should be the default provider
   */
  isDefault?: boolean;
}

/**
 * Request DTO for updating a task assignment
 */
export interface IUpdateTaskAssignmentRequest {
  /**
   * Provider ID to assign to this task
   */
  providerId: string;

  /**
   * Model to use for this task
   */
  model: string;

  /**
   * Optional fallback provider ID
   */
  fallbackProviderId?: string;

  /**
   * Optional fallback model
   */
  fallbackModel?: string;
}

/**
 * Task assignment response
 */
export interface ITaskAssignment {
  /**
   * Unique identifier for the assignment
   */
  id: string;

  /**
   * Organization that owns this assignment
   */
  organizationId: string;

  /**
   * Type of task being assigned
   */
  taskType: AITaskType;

  /**
   * Primary provider ID
   */
  providerId: string;

  /**
   * Model to use for this task
   */
  model: string;

  /**
   * Fallback provider ID (optional)
   */
  fallbackProviderId?: string;

  /**
   * Fallback model (optional)
   */
  fallbackModel?: string;

  /**
   * When the assignment was created
   */
  createdAt: Date;

  /**
   * When the assignment was last updated
   */
  updatedAt: Date;

  /**
   * Associated provider object (optional, includes full provider details)
   */
  provider?: IProviderResponse;

  /**
   * Associated fallback provider object (optional)
   */
  fallbackProvider?: IProviderResponse;
}

/**
 * Result of provider/model discovery
 */
export interface IDiscoveryResult {
  /**
   * Whether discovery was successful
   */
  success: boolean;

  /**
   * List of discovered models
   */
  models?: string[];

  /**
   * Error message if discovery failed
   */
  error?: string;

  /**
   * Human-readable message about the discovery result
   */
  message?: string;
}

/**
 * Provider test result
 */
export interface IProviderTestResult {
  /**
   * Whether the provider passed validation
   */
  valid: boolean;

  /**
   * Error message if validation failed
   */
  error?: string;

  /**
   * Available models from this provider
   */
  models?: string[];

  /**
   * If testing a specific model, the model name
   */
  model?: string;

  /**
   * Whether the model was tested
   */
  tested?: boolean;

  /**
   * Provider name
   */
  provider?: string;

  /**
   * Task type (if from task assignment test)
   */
  taskType?: AITaskType;
}

/**
 * Default models for each provider type
 * Used as fallback when model discovery is not available
 */
export const DEFAULT_MODELS: Record<AIProviderType, string[]> = {
  openai: [
    'gpt-4.1',
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-3.5-turbo',
    'dall-e-3',
    'dall-e-2',
  ],
  anthropic: [
    'claude-3-opus-20250219',
    'claude-3-5-sonnet-20241022',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
  ],
  gemini: [
    'gemini-2.0-flash',
    'gemini-2.0-flash-exp',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
  ],
  ollama: [
    'mistral',
    'llama2',
    'neural-chat',
    'dolphin-mixtral',
  ],
  together: [
    'meta-llama/Llama-3-70b-chat-hf',
    'mistralai/Mixtral-8x22B-Instruct',
  ],
  'openai-compatible': [],
  fal: [
    'ideogram/v2',
    'fast-sdxl',
    'fast-flux',
    'flux-pro',
    'stable-diffusion-v3',
  ],
  elevenlabs: [
    'eleven_multilingual_v2',
    'eleven_turbo_v2',
    'eleven_monolingual_v1',
  ],
};

/**
 * Provider configuration for a specific task
 */
export interface ITaskConfiguration {
  /**
   * Task type
   */
  taskType: AITaskType;

  /**
   * Primary provider name
   */
  provider: string;

  /**
   * Model identifier
   */
  model: string;

  /**
   * Fallback provider (optional)
   */
  fallbackProvider?: string;

  /**
   * Fallback model (optional)
   */
  fallbackModel?: string;
}
