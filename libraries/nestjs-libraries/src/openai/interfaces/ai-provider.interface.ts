/**
 * Interface for AI provider configuration
 */
export interface AIProvider {
  /** Provider identifier (e.g., 'OPENAI', 'OPENROUTER', 'AZURE') */
  name: string;

  /** Base URL for the API endpoint (optional, uses provider default if not set) */
  url?: string;

  /** API key for authentication */
  key: string;

  /** Model name for complex tasks (image prompts, voice conversion, slides) */
  smartModel: string;

  /** Model name for simple tasks (post generation, text extraction) */
  fastModel: string;

  /** Whether this provider is currently enabled */
  enabled: boolean;

  /** Weight for weighted rotation strategy (default: 1) */
  weight?: number;

  // Runtime statistics
  /** Total number of requests made to this provider */
  requestCount?: number;

  /** Total number of errors from this provider */
  errorCount?: number;

  /** Average response time in milliseconds */
  avgResponseTime?: number;

  /** Timestamp of last successful request */
  lastUsed?: Date;

  /** Whether provider is currently healthy */
  isHealthy?: boolean;
}

/**
 * Task types for model selection
 */
export type AITaskType = 'smart' | 'fast';

/**
 * Provider rotation strategies
 */
export type AIRotationStrategy = 'round-robin' | 'random' | 'weighted' | 'failover';

/**
 * Configuration for AI provider manager
 */
export interface AIProviderManagerConfig {
  /** Rotation strategy to use */
  rotationStrategy: AIRotationStrategy;

  /** Whether to retry with next provider on failure */
  retryOnFailure: boolean;

  /** Maximum number of retries across providers */
  maxRetries: number;

  /** Timeout for health checks in milliseconds */
  healthCheckTimeout?: number;

  /** Interval for health checks in milliseconds */
  healthCheckInterval?: number;
}

/**
 * Provider statistics for monitoring
 */
export interface AIProviderStats {
  name: string;
  requestCount: number;
  errorCount: number;
  successRate: number;
  avgResponseTime: number;
  lastUsed?: Date;
  isHealthy: boolean;
  enabled: boolean;
}

/**
 * Request context for provider selection
 */
export interface AIRequestContext {
  /** Type of task being performed */
  taskType: AITaskType;

  /** Optional provider preference */
  preferredProvider?: string;

  /** Whether this is a retry attempt */
  isRetry?: boolean;

  /** Previous providers that failed (for retry logic) */
  failedProviders?: string[];

  /** Request metadata */
  metadata?: Record<string, any>;
}