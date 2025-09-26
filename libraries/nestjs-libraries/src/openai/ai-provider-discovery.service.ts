import { Injectable, Logger } from '@nestjs/common';
import { AIProvider, AIProviderManagerConfig, AIRotationStrategy } from './interfaces/ai-provider.interface';

/**
 * Service responsible for discovering and configuring AI providers from environment variables
 * Scans for AI_*_KEY patterns to automatically detect available providers
 */
@Injectable()
export class AIProviderDiscoveryService {
  private readonly logger = new Logger(AIProviderDiscoveryService.name);
  private providers: Map<string, AIProvider> = new Map();
  private config: AIProviderManagerConfig;

  constructor() {
    this.loadGlobalConfig();
    this.discoverProviders();
  }

  /**
   * Load global AI configuration from environment variables
   */
  private loadGlobalConfig(): void {
    this.config = {
      rotationStrategy: this.parseRotationStrategy(process.env.AI_ROTATION || 'round-robin'),
      retryOnFailure: process.env.AI_RETRY_FAILED !== 'false',
      maxRetries: parseInt(process.env.AI_MAX_RETRIES || '3', 10),
      healthCheckTimeout: 30000, // 30 seconds
      healthCheckInterval: 300000, // 5 minutes
    };

    this.logger.log(`AI Provider Manager configured with strategy: ${this.config.rotationStrategy}`);
  }

  /**
   * Parse rotation strategy from string with validation
   */
  private parseRotationStrategy(strategy: string): AIRotationStrategy {
    const validStrategies: AIRotationStrategy[] = ['round-robin', 'random', 'weighted', 'failover'];

    if (validStrategies.includes(strategy as AIRotationStrategy)) {
      return strategy as AIRotationStrategy;
    }

    this.logger.warn(`Invalid rotation strategy '${strategy}', defaulting to 'round-robin'`);
    return 'round-robin';
  }

  /**
   * Automatically discover AI providers from environment variables
   * Looks for AI_*_KEY pattern to identify available providers
   */
  public discoverProviders(): void {
    const env = process.env;
    const providerPattern = /^AI_([A-Z][A-Z0-9_]*)_KEY$/;
    const discoveredProviders: string[] = [];

    // Scan environment for AI provider keys
    for (const [key, value] of Object.entries(env)) {
      const match = key.match(providerPattern);
      if (match && value) {
        const providerName = match[1];
        try {
          this.loadProvider(providerName);
          discoveredProviders.push(providerName);
        } catch (error) {
          this.logger.error(`Failed to load provider '${providerName}': ${error.message}`);
        }
      }
    }

    // Add backward compatibility provider if OPENAI_API_KEY exists and no AI_OPENAI_KEY
    this.addBackwardCompatibilityProvider();

    this.logger.log(`Discovered ${this.providers.size} AI providers: ${Array.from(this.providers.keys()).join(', ')}`);

    if (this.providers.size === 0) {
      this.logger.warn('No AI providers configured! Please set at least one AI_*_KEY environment variable.');
    }
  }

  /**
   * Load a specific provider configuration from environment variables
   */
  private loadProvider(name: string): void {
    const prefix = `AI_${name}`;
    const key = process.env[`${prefix}_KEY`];

    if (!key) {
      throw new Error(`API key not found for provider ${name}`);
    }

    const provider: AIProvider = {
      name,
      url: process.env[`${prefix}_URL`] || this.getDefaultUrl(name),
      key,
      smartModel: process.env[`${prefix}_SMART`] || this.getDefaultSmartModel(name),
      fastModel: process.env[`${prefix}_FAST`] || this.getDefaultFastModel(name),
      enabled: process.env[`${prefix}_ENABLED`] !== 'false',
      weight: parseInt(process.env[`${prefix}_WEIGHT`] || '1', 10),
      requestCount: 0,
      errorCount: 0,
      avgResponseTime: 0,
      isHealthy: true,
    };

    this.providers.set(name, provider);

    this.logger.log(`Loaded AI provider '${name}': ${provider.enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Add backward compatibility support for legacy OPENAI_API_KEY
   */
  private addBackwardCompatibilityProvider(): void {
    const legacyKey = process.env.OPENAI_API_KEY;

    // Only add if OPENAI_API_KEY exists and AI_OPENAI_KEY doesn't exist
    if (legacyKey && !process.env.AI_OPENAI_KEY && !this.providers.has('OPENAI')) {
      const provider: AIProvider = {
        name: 'OPENAI',
        url: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        key: legacyKey,
        smartModel: process.env.SMART_LLM || 'gpt-4.1',
        fastModel: process.env.FAST_LLM || 'gpt-4o-mini',
        enabled: true,
        weight: 1,
        requestCount: 0,
        errorCount: 0,
        avgResponseTime: 0,
        isHealthy: true,
      };

      this.providers.set('OPENAI', provider);
      this.logger.log('Added backward compatibility provider for OPENAI_API_KEY');
    }
  }

  /**
   * Get default URL for known providers
   */
  private getDefaultUrl(providerName: string): string | undefined {
    const defaults: Record<string, string> = {
      'OPENAI': 'https://api.openai.com/v1',
      'OPENROUTER': 'https://openrouter.ai/api/v1',
      'GROQ': 'https://api.groq.com/openai/v1',
      'TOGETHER': 'https://api.together.xyz/v1',
      'PERPLEXITY': 'https://api.perplexity.ai',
    };

    return defaults[providerName];
  }

  /**
   * Get default smart model for known providers
   */
  private getDefaultSmartModel(providerName: string): string {
    const defaults: Record<string, string> = {
      'OPENAI': 'gpt-4.1',
      'OPENROUTER': 'anthropic/claude-3.5-sonnet',
      'AZURE': 'gpt-4',
      'GROQ': 'mixtral-8x7b-32768',
      'TOGETHER': 'mistralai/Mixtral-8x22B-Instruct-v0.1',
      'PERPLEXITY': 'llama-3.1-sonar-large-128k-online',
    };

    return defaults[providerName] || 'gpt-4';
  }

  /**
   * Get default fast model for known providers
   */
  private getDefaultFastModel(providerName: string): string {
    const defaults: Record<string, string> = {
      'OPENAI': 'gpt-4o-mini',
      'OPENROUTER': 'anthropic/claude-3-haiku',
      'AZURE': 'gpt-35-turbo',
      'GROQ': 'llama3-8b-8192',
      'TOGETHER': 'meta-llama/Llama-3-8b-chat-hf',
      'PERPLEXITY': 'llama-3.1-sonar-small-128k-online',
    };

    return defaults[providerName] || 'gpt-3.5-turbo';
  }

  /**
   * Get all discovered providers
   */
  public getProviders(): Map<string, AIProvider> {
    return new Map(this.providers);
  }

  /**
   * Get enabled providers only
   */
  public getEnabledProviders(): Map<string, AIProvider> {
    const enabled = new Map<string, AIProvider>();

    for (const [name, provider] of this.providers) {
      if (provider.enabled && provider.isHealthy) {
        enabled.set(name, provider);
      }
    }

    return enabled;
  }

  /**
   * Get a specific provider by name
   */
  public getProvider(name: string): AIProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Get global configuration
   */
  public getConfig(): AIProviderManagerConfig {
    return { ...this.config };
  }

  /**
   * Update provider statistics
   */
  public updateProviderStats(name: string, responseTime: number, isError: boolean = false): void {
    const provider = this.providers.get(name);
    if (!provider) return;

    provider.requestCount = (provider.requestCount || 0) + 1;
    provider.lastUsed = new Date();

    if (isError) {
      provider.errorCount = (provider.errorCount || 0) + 1;
      // Mark as unhealthy if error rate is too high (>50% of last 10 requests)
      if (provider.requestCount >= 10 && provider.errorCount / provider.requestCount > 0.5) {
        provider.isHealthy = false;
        this.logger.warn(`Provider '${name}' marked as unhealthy due to high error rate`);
      }
    } else {
      // Update average response time
      const currentAvg = provider.avgResponseTime || 0;
      const count = provider.requestCount - (provider.errorCount || 0);
      provider.avgResponseTime = (currentAvg * (count - 1) + responseTime) / count;
    }
  }

  /**
   * Mark provider as healthy or unhealthy
   */
  public setProviderHealth(name: string, isHealthy: boolean): void {
    const provider = this.providers.get(name);
    if (provider) {
      provider.isHealthy = isHealthy;
      this.logger.log(`Provider '${name}' health status: ${isHealthy ? 'healthy' : 'unhealthy'}`);
    }
  }

  /**
   * Reload providers from environment (useful for testing or dynamic config)
   */
  public reloadProviders(): void {
    this.providers.clear();
    this.loadGlobalConfig();
    this.discoverProviders();
  }
}