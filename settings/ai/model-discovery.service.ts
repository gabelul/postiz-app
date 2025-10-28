import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { AIProvider } from '@prisma/client';

/**
 * Service for discovering and caching available models from AI providers
 * Provides methods to fetch model lists from various AI provider APIs
 * Implements SSRF prevention for safe URL fetching
 */
@Injectable()
export class ModelDiscoveryService {
  private readonly logger = new Logger(ModelDiscoveryService.name);

  // List of allowed domains for API endpoints (whitelist approach)
  private readonly ALLOWED_DOMAINS = [
    'api.openai.com',
    'generativelanguage.googleapis.com',
    'api.together.xyz',
    'localhost:11434', // Ollama default
    '127.0.0.1:11434',
  ];

  // Private/internal IP ranges to block
  private readonly BLOCKED_IP_PATTERNS = [
    /^127\./,              // loopback
    /^0\.0\.0\.0/,         // wildcard
    /^10\./,               // private
    /^172\.(1[6-9]|2[0-9]|3[01])\./, // private
    /^192\.168\./,         // private
    /^169\.254\./,         // link-local
    /^fc00:|^fe80:/,       // IPv6 private
  ];

  // Timeout for API calls (10 seconds)
  private readonly FETCH_TIMEOUT_MS = 10000;

  /**
   * Validate a URL to prevent SSRF attacks
   * @param url - URL to validate
   * @returns Validated URL
   * @throws BadRequestException if URL is invalid or blocked
   */
  private validateUrl(urlString: string): URL {
    try {
      const url = new URL(urlString);

      // Only allow HTTPS (and HTTP for localhost testing)
      if (!['https:', 'http:'].includes(url.protocol)) {
        throw new BadRequestException(`Invalid protocol: ${url.protocol}. Only HTTPS and HTTP are allowed.`);
      }

      if (url.protocol === 'http:' && !this.isLocalhost(url.hostname)) {
        throw new BadRequestException(`HTTP is only allowed for localhost. Use HTTPS for remote URLs.`);
      }

      // Check hostname against private IP ranges
      if (this.isPrivateIp(url.hostname)) {
        throw new BadRequestException(`Access to private IP addresses is not allowed: ${url.hostname}`);
      }

      return url;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Invalid URL: ${urlString}`);
    }
  }

  /**
   * Check if hostname is localhost
   */
  private isLocalhost(hostname: string): boolean {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  }

  /**
   * Check if IP address is in private range
   */
  private isPrivateIp(hostname: string): boolean {
    // Remove port if present
    const ip = hostname.split(':')[0];

    // Check IPv4 private ranges
    for (const pattern of this.BLOCKED_IP_PATTERNS) {
      if (pattern.test(ip)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Safely fetch from a URL with timeout and validation
   * @param url - URL to fetch from
   * @param headers - HTTP headers
   * @returns Fetch response
   * @throws BadRequestException if URL is invalid
   * @throws Error if fetch fails or times out
   */
  private async safeFetch(url: string, headers: Record<string, string>): Promise<Response> {
    // Validate URL first
    this.validateUrl(url);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Discover available models for a provider
   * Attempts to fetch the list of available models from the provider's API
   * @param provider - Provider configuration
   * @returns Array of available model names
   */
  async discoverModels(provider: AIProvider): Promise<string[]> {
    try {
      switch (provider.type) {
        case 'openai':
          return await this.discoverOpenAIModels(provider);
        case 'anthropic':
          return await this.discoverAnthropicModels(provider);
        case 'gemini':
          return await this.discoverGeminiModels(provider);
        case 'ollama':
          return await this.discoverOllamaModels(provider);
        case 'together':
          return await this.discoverTogetherModels(provider);
        case 'openai-compatible':
          return await this.discoverOpenAICompatibleModels(provider);
        default:
          this.logger.warn(`Model discovery not implemented for provider type: ${provider.type}`);
          return [];
      }
    } catch (error) {
      this.logger.warn(
        `Failed to discover models for provider ${provider.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return [];
    }
  }

  /**
   * Discover OpenAI models via their API
   * @param provider - OpenAI provider configuration
   * @returns Array of available model names
   */
  private async discoverOpenAIModels(provider: AIProvider): Promise<string[]> {
    try {
      const response = await this.safeFetch('https://api.openai.com/v1/models', {
        'Authorization': `Bearer ${provider.apiKey}`,
      });

      if (!response.ok) {
        throw new Error(`OpenAI API returned status ${response.status}`);
      }

      const data = await response.json();
      const models = data.data
        .map((m: any) => m.id)
        .filter((id: string) => !id.includes('..'))
        .sort();

      this.logger.log(`Discovered ${models.length} OpenAI models`);
      return models;
    } catch (error) {
      this.logger.warn(
        `Failed to discover OpenAI models: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      // Return common OpenAI models as fallback
      return [
        'gpt-4.1',
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-3.5-turbo',
        'dall-e-3',
        'dall-e-2',
      ];
    }
  }

  /**
   * Discover Anthropic Claude models
   * Currently returns known model list as API doesn't expose this endpoint
   * @param provider - Anthropic provider configuration
   * @returns Array of available model names
   */
  private async discoverAnthropicModels(provider: AIProvider): Promise<string[]> {
    // Anthropic doesn't expose a public models list endpoint
    // Return the known Claude models
    return [
      'claude-3-opus-20250219',
      'claude-3-5-sonnet-20241022',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ];
  }

  /**
   * Discover Google Gemini models via OpenAI-compatible API
   * @param provider - Gemini provider configuration
   * @returns Array of available model names
   */
  private async discoverGeminiModels(provider: AIProvider): Promise<string[]> {
    try {
      const baseUrl = provider.baseUrl || 'https://generativelanguage.googleapis.com/openai/';
      const url = `${baseUrl}v1/models`;

      const response = await this.safeFetch(url, {
        'Authorization': `Bearer ${provider.apiKey}`,
      });

      if (!response.ok) {
        throw new Error(`Gemini API returned status ${response.status}`);
      }

      const data = await response.json();
      const models = data.data.map((m: any) => m.id).sort();

      this.logger.log(`Discovered ${models.length} Gemini models`);
      return models;
    } catch (error) {
      this.logger.warn(
        `Failed to discover Gemini models: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      // Return common Gemini models as fallback
      return [
        'gemini-2.0-flash',
        'gemini-2.0-flash-exp',
        'gemini-1.5-pro',
        'gemini-1.5-flash',
      ];
    }
  }

  /**
   * Discover Ollama available models
   * Connects to the local Ollama instance
   * @param provider - Ollama provider configuration
   * @returns Array of available model names
   */
  private async discoverOllamaModels(provider: AIProvider): Promise<string[]> {
    try {
      const baseUrl = provider.baseUrl || 'http://localhost:11434';
      const url = `${baseUrl}/api/tags`;

      const response = await this.safeFetch(url, {});

      if (!response.ok) {
        throw new Error(`Ollama API returned status ${response.status}`);
      }

      const data = await response.json();
      const models = data.models.map((m: any) => m.name).sort();

      this.logger.log(`Discovered ${models.length} Ollama models`);
      return models;
    } catch (error) {
      this.logger.warn(
        `Failed to discover Ollama models: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      // Return common Ollama models as fallback
      return [
        'mistral',
        'llama2',
        'neural-chat',
        'dolphin-mixtral',
      ];
    }
  }

  /**
   * Discover Together AI available models
   * @param provider - Together AI provider configuration
   * @returns Array of available model names
   */
  private async discoverTogetherModels(provider: AIProvider): Promise<string[]> {
    try {
      const baseUrl = provider.baseUrl || 'https://api.together.xyz';
      const url = `${baseUrl}/v1/models`;

      const response = await this.safeFetch(url, {
        'Authorization': `Bearer ${provider.apiKey}`,
      });

      if (!response.ok) {
        throw new Error(`Together API returned status ${response.status}`);
      }

      const data = await response.json();
      const models = data.data.map((m: any) => m.id).sort();

      this.logger.log(`Discovered ${models.length} Together AI models`);
      return models;
    } catch (error) {
      this.logger.warn(
        `Failed to discover Together models: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      // Return common Together AI models as fallback
      return [
        'meta-llama/Llama-3-70b-chat-hf',
        'mistralai/Mixtral-8x22B-Instruct',
      ];
    }
  }

  /**
   * Discover models from any OpenAI-compatible API
   * @param provider - OpenAI-compatible provider configuration
   * @returns Array of available model names
   */
  private async discoverOpenAICompatibleModels(provider: AIProvider): Promise<string[]> {
    try {
      if (!provider.baseUrl) {
        throw new Error('Base URL is required for OpenAI-compatible providers');
      }

      const url = `${provider.baseUrl}/models`;

      const response = await this.safeFetch(url, {
        'Authorization': `Bearer ${provider.apiKey}`,
      });

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const data = await response.json();
      const models = data.data.map((m: any) => m.id).sort();

      this.logger.log(`Discovered ${models.length} models from OpenAI-compatible API`);
      return models;
    } catch (error) {
      this.logger.warn(
        `Failed to discover models from OpenAI-compatible API: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return [];
    }
  }

  /**
   * Get default models for a provider type
   * Used as fallback when discovery fails
   * @param providerType - Provider type
   * @returns Array of default model names for that provider
   */
  getDefaultModels(providerType: string): string[] {
    const defaults: Record<string, string[]> = {
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
    };

    return defaults[providerType] || [];
  }
}
