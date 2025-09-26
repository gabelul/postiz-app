import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { AIProvider, AITaskType, AIRequestContext, AIProviderStats } from './interfaces/ai-provider.interface';
import { AIProviderDiscoveryService } from './ai-provider-discovery.service';

/**
 * Service that manages multiple AI providers with rotation, load balancing, and failover
 * Handles provider selection, client creation, and request routing
 */
@Injectable()
export class AIProviderManagerService {
  private readonly logger = new Logger(AIProviderManagerService.name);
  private currentRoundRobinIndex = 0;
  private clients: Map<string, OpenAI> = new Map();

  constructor(private readonly discoveryService: AIProviderDiscoveryService) {
    this.initializeClients();
  }

  /**
   * Initialize OpenAI clients for all discovered providers
   */
  private initializeClients(): void {
    const providers = this.discoveryService.getProviders();

    for (const [name, provider] of providers) {
      if (provider.enabled) {
        try {
          const client = new OpenAI({
            apiKey: provider.key,
            baseURL: provider.url,
          });

          this.clients.set(name, client);
          this.logger.log(`Initialized OpenAI client for provider '${name}'`);
        } catch (error) {
          this.logger.error(`Failed to initialize client for provider '${name}': ${error.message}`);
          this.discoveryService.setProviderHealth(name, false);
        }
      }
    }

    this.logger.log(`Initialized ${this.clients.size} AI provider clients`);
  }

  /**
   * Get the next provider based on the configured rotation strategy
   */
  public getNextProvider(context: AIRequestContext = { taskType: 'smart' }): AIProvider | null {
    const enabledProviders = Array.from(this.discoveryService.getEnabledProviders().values());

    if (enabledProviders.length === 0) {
      this.logger.error('No enabled AI providers available');
      return null;
    }

    // Filter out previously failed providers for retry attempts
    const availableProviders = context.isRetry && context.failedProviders
      ? enabledProviders.filter(p => !context.failedProviders!.includes(p.name))
      : enabledProviders;

    if (availableProviders.length === 0) {
      this.logger.warn('No available providers after filtering failed ones');
      return enabledProviders[0]; // Fallback to any enabled provider
    }

    // Handle preferred provider
    if (context.preferredProvider) {
      const preferred = availableProviders.find(p => p.name === context.preferredProvider);
      if (preferred) {
        return preferred;
      }
    }

    const config = this.discoveryService.getConfig();

    switch (config.rotationStrategy) {
      case 'round-robin':
        return this.getRoundRobinProvider(availableProviders);

      case 'random':
        return this.getRandomProvider(availableProviders);

      case 'weighted':
        return this.getWeightedProvider(availableProviders);

      case 'failover':
        return this.getFailoverProvider(availableProviders);

      default:
        return availableProviders[0];
    }
  }

  /**
   * Get provider using round-robin strategy
   */
  private getRoundRobinProvider(providers: AIProvider[]): AIProvider {
    const provider = providers[this.currentRoundRobinIndex % providers.length];
    this.currentRoundRobinIndex = (this.currentRoundRobinIndex + 1) % providers.length;
    return provider;
  }

  /**
   * Get provider using random selection
   */
  private getRandomProvider(providers: AIProvider[]): AIProvider {
    const randomIndex = Math.floor(Math.random() * providers.length);
    return providers[randomIndex];
  }

  /**
   * Get provider using weighted selection
   */
  private getWeightedProvider(providers: AIProvider[]): AIProvider {
    const totalWeight = providers.reduce((sum, p) => sum + (p.weight || 1), 0);
    let random = Math.random() * totalWeight;

    for (const provider of providers) {
      random -= (provider.weight || 1);
      if (random <= 0) {
        return provider;
      }
    }

    return providers[0]; // Fallback
  }

  /**
   * Get provider using failover strategy (primary with fallbacks)
   */
  private getFailoverProvider(providers: AIProvider[]): AIProvider {
    // Sort by weight (higher weight = higher priority)
    const sortedProviders = [...providers].sort((a, b) => (b.weight || 1) - (a.weight || 1));

    // Return the first healthy provider
    for (const provider of sortedProviders) {
      if (provider.isHealthy) {
        return provider;
      }
    }

    // If no healthy providers, return the first one
    return sortedProviders[0];
  }

  /**
   * Get OpenAI client for a specific provider
   */
  public getClient(providerName: string): OpenAI | null {
    const client = this.clients.get(providerName);
    if (!client) {
      this.logger.error(`No client found for provider '${providerName}'`);
      return null;
    }
    return client;
  }

  /**
   * Get model name for a specific task type and provider
   */
  public getModelForTask(provider: AIProvider, taskType: AITaskType): string {
    return taskType === 'smart' ? provider.smartModel : provider.fastModel;
  }

  /**
   * Execute a request with automatic provider selection and retry logic
   */
  public async executeWithRetry<T>(
    operation: (client: OpenAI, provider: AIProvider, model: string) => Promise<T>,
    context: AIRequestContext
  ): Promise<T> {
    const config = this.discoveryService.getConfig();
    const maxRetries = config.maxRetries;
    const failedProviders: string[] = [];
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const requestContext: AIRequestContext = {
        ...context,
        isRetry: attempt > 0,
        failedProviders: [...failedProviders],
      };

      const provider = this.getNextProvider(requestContext);
      if (!provider) {
        throw new Error('No available AI providers');
      }

      const client = this.getClient(provider.name);
      if (!client) {
        failedProviders.push(provider.name);
        continue;
      }

      const model = this.getModelForTask(provider, context.taskType);
      const startTime = Date.now();

      try {
        this.logger.debug(`Attempting request with provider '${provider.name}' (attempt ${attempt + 1})`);

        const result = await operation(client, provider, model);

        // Record successful request
        const responseTime = Date.now() - startTime;
        this.discoveryService.updateProviderStats(provider.name, responseTime, false);

        this.logger.debug(`Request successful with provider '${provider.name}' in ${responseTime}ms`);
        return result;

      } catch (error) {
        lastError = error as Error;
        const responseTime = Date.now() - startTime;

        // Record failed request
        this.discoveryService.updateProviderStats(provider.name, responseTime, true);
        failedProviders.push(provider.name);

        this.logger.warn(
          `Request failed with provider '${provider.name}' (attempt ${attempt + 1}): ${lastError.message}`
        );

        // If this is the last attempt or retry is disabled, throw the error
        if (attempt >= maxRetries || !config.retryOnFailure) {
          break;
        }

        // Add a small delay before retry
        if (attempt < maxRetries) {
          await this.delay(1000 * (attempt + 1)); // Exponential backoff
        }
      }
    }

    // All retries exhausted
    this.logger.error(`All retry attempts exhausted. Failed providers: ${failedProviders.join(', ')}`);
    throw lastError || new Error('Request failed after all retry attempts');
  }

  /**
   * Get statistics for all providers
   */
  public getProviderStats(): AIProviderStats[] {
    const providers = this.discoveryService.getProviders();
    return Array.from(providers.values()).map(provider => ({
      name: provider.name,
      requestCount: provider.requestCount || 0,
      errorCount: provider.errorCount || 0,
      successRate: this.calculateSuccessRate(provider),
      avgResponseTime: provider.avgResponseTime || 0,
      lastUsed: provider.lastUsed,
      isHealthy: provider.isHealthy || false,
      enabled: provider.enabled,
    }));
  }

  /**
   * Calculate success rate for a provider
   */
  private calculateSuccessRate(provider: AIProvider): number {
    const total = provider.requestCount || 0;
    const errors = provider.errorCount || 0;

    if (total === 0) return 100;
    return Math.round(((total - errors) / total) * 100);
  }

  /**
   * Perform health check on all providers
   */
  public async performHealthCheck(): Promise<void> {
    const providers = this.discoveryService.getProviders();

    for (const [name, provider] of providers) {
      if (!provider.enabled) continue;

      const client = this.getClient(name);
      if (!client) continue;

      try {
        // Simple health check - try to list models (lightweight operation)
        await Promise.race([
          client.models.list(),
          this.timeout(10000), // 10 second timeout
        ]);

        this.discoveryService.setProviderHealth(name, true);
        this.logger.debug(`Health check passed for provider '${name}'`);

      } catch (error) {
        this.discoveryService.setProviderHealth(name, false);
        this.logger.warn(`Health check failed for provider '${name}': ${error.message}`);
      }
    }
  }

  /**
   * Reload providers and reinitialize clients
   */
  public reloadProviders(): void {
    this.clients.clear();
    this.discoveryService.reloadProviders();
    this.initializeClients();
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Utility method for timeouts
   */
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), ms)
    );
  }
}