/**
 * Factory for creating AI provider adapters
 * Handles instantiation of appropriate adapters based on provider type
 */

import { Injectable, Logger } from '@nestjs/common';
import { IAIProviderAdapter } from './ai-provider-adapter.interface';
import { OpenAIAdapter } from './openai-adapter';
import { OpenAICompatibleAdapter } from './openai-compatible-adapter';
import { AnthropicAdapter } from './anthropic-adapter';

/**
 * Factory service to create and manage AI provider adapters
 * Supports OpenAI, Anthropic, and OpenAI-compatible providers
 */
@Injectable()
export class AIProviderAdapterFactory {
  private readonly logger = new Logger(AIProviderAdapterFactory.name);
  private adapters: Map<string, IAIProviderAdapter> = new Map();

  /**
   * Create or get a cached adapter for a provider
   * @param provider - Provider name (openai, anthropic, openai-compatible)
   * @param customConfig - Optional custom configuration
   * @returns Adapter instance
   */
  createAdapter(
    provider: string,
    customConfig?: {
      apiKey?: string;
      baseUrl?: string;
      providerName?: string;
    }
  ): IAIProviderAdapter {
    // Check if we already have this adapter cached
    const cacheKey = `${provider}:${customConfig?.baseUrl || 'default'}`;
    if (this.adapters.has(cacheKey)) {
      return this.adapters.get(cacheKey)!;
    }

    let adapter: IAIProviderAdapter;

    switch (provider) {
      case 'openai':
        adapter = this.createOpenAIAdapter(customConfig);
        break;

      case 'anthropic':
        adapter = this.createAnthropicAdapter(customConfig);
        break;

      case 'openai-compatible':
      case 'custom':
        adapter = this.createOpenAICompatibleAdapter(customConfig);
        break;

      case 'gemini':
        // Gemini can be accessed via OpenAI-compatible format
        adapter = this.createGeminiAdapter(customConfig);
        break;

      case 'ollama':
        // Ollama is OpenAI-compatible
        adapter = this.createOllamaAdapter(customConfig);
        break;

      case 'together':
        // Together AI is OpenAI-compatible
        adapter = this.createTogetherAdapter(customConfig);
        break;

      default:
        this.logger.warn(`Unknown provider: ${provider}, defaulting to OpenAI`);
        adapter = this.createOpenAIAdapter(customConfig);
    }

    // Cache the adapter
    this.adapters.set(cacheKey, adapter);
    this.logger.debug(`Created and cached adapter for ${cacheKey}`);

    return adapter;
  }

  /**
   * Create OpenAI adapter
   */
  private createOpenAIAdapter(customConfig?: {
    apiKey?: string;
    baseUrl?: string;
  }): OpenAIAdapter {
    const apiKey =
      customConfig?.apiKey ||
      process.env.OPENAI_API_KEY ||
      process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('OpenAI API key not found. Set OPENAI_API_KEY environment variable.');
    }

    return new OpenAIAdapter(apiKey, customConfig?.baseUrl);
  }

  /**
   * Create Anthropic adapter
   */
  private createAnthropicAdapter(customConfig?: {
    apiKey?: string;
  }): AnthropicAdapter {
    const apiKey =
      customConfig?.apiKey || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error(
        'Anthropic API key not found. Set ANTHROPIC_API_KEY environment variable.'
      );
    }

    return new AnthropicAdapter(apiKey);
  }

  /**
   * Create OpenAI-compatible adapter for generic custom providers
   */
  private createOpenAICompatibleAdapter(customConfig?: {
    apiKey?: string;
    baseUrl?: string;
    providerName?: string;
  }): OpenAICompatibleAdapter {
    const apiKey =
      customConfig?.apiKey ||
      process.env.OPENAI_COMPATIBLE_API_KEY ||
      process.env.CUSTOM_API_KEY;

    const baseUrl =
      customConfig?.baseUrl || process.env.OPENAI_COMPATIBLE_BASE_URL;

    if (!apiKey || !baseUrl) {
      throw new Error(
        'OpenAI-compatible provider requires API_KEY and BASE_URL. ' +
          'Set OPENAI_COMPATIBLE_API_KEY and OPENAI_COMPATIBLE_BASE_URL environment variables.'
      );
    }

    return new OpenAICompatibleAdapter(
      apiKey,
      baseUrl,
      customConfig?.providerName || 'custom'
    );
  }

  /**
   * Create adapter for Gemini via OpenAI-compatible format
   */
  private createGeminiAdapter(customConfig?: {
    apiKey?: string;
    baseUrl?: string;
  }): OpenAICompatibleAdapter {
    const apiKey = customConfig?.apiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('Gemini API key not found. Set GEMINI_API_KEY environment variable.');
    }

    // Gemini's OpenAI-compatible endpoint
    const baseUrl =
      customConfig?.baseUrl ||
      process.env.GEMINI_BASE_URL ||
      'https://generativelanguage.googleapis.com/openai/';

    return new OpenAICompatibleAdapter(apiKey, baseUrl, 'gemini');
  }

  /**
   * Create adapter for Ollama (local models)
   */
  private createOllamaAdapter(customConfig?: {
    baseUrl?: string;
  }): OpenAICompatibleAdapter {
    const apiKey = 'ollama'; // Ollama doesn't require a real API key

    const baseUrl =
      customConfig?.baseUrl ||
      process.env.OLLAMA_BASE_URL ||
      'http://localhost:11434/v1';

    return new OpenAICompatibleAdapter(apiKey, baseUrl, 'ollama');
  }

  /**
   * Create adapter for Together AI
   */
  private createTogetherAdapter(customConfig?: {
    apiKey?: string;
    baseUrl?: string;
  }): OpenAICompatibleAdapter {
    const apiKey =
      customConfig?.apiKey || process.env.TOGETHER_API_KEY;

    if (!apiKey) {
      throw new Error(
        'Together AI API key not found. Set TOGETHER_API_KEY environment variable.'
      );
    }

    const baseUrl =
      customConfig?.baseUrl ||
      process.env.TOGETHER_BASE_URL ||
      'https://api.together.xyz/v1';

    return new OpenAICompatibleAdapter(apiKey, baseUrl, 'together');
  }

  /**
   * Clear the adapter cache
   * Useful for testing or switching configurations
   */
  clearCache(): void {
    this.adapters.clear();
    this.logger.debug('Adapter cache cleared');
  }

  /**
   * Get the list of available providers
   */
  getAvailableProviders(): string[] {
    return [
      'openai',
      'anthropic',
      'openai-compatible',
      'gemini',
      'ollama',
      'together',
    ];
  }

  /**
   * Get information about a provider
   */
  getProviderInfo(provider: string): { name: string; description: string } {
    const providers: Record<string, { name: string; description: string }> = {
      openai: {
        name: 'OpenAI',
        description: 'GPT models and DALL-E image generation',
      },
      anthropic: {
        name: 'Anthropic',
        description: 'Claude models for text generation',
      },
      'openai-compatible': {
        name: 'OpenAI-Compatible',
        description: 'Any OpenAI-compatible API endpoint',
      },
      gemini: {
        name: 'Google Gemini',
        description: 'Gemini models via OpenAI-compatible format',
      },
      ollama: {
        name: 'Ollama',
        description: 'Local models running on Ollama',
      },
      together: {
        name: 'Together AI',
        description: 'Together AI models for inference',
      },
    };

    return (
      providers[provider] || {
        name: provider,
        description: 'Unknown provider',
      }
    );
  }
}
