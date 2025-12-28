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

  // Timeout for API calls (10 seconds)
  private readonly FETCH_TIMEOUT_MS = 10000;

  /**
   * Validate a URL to prevent SSRF attacks
   * Blocks internal/private network access and invalid protocols
   * @param urlString - URL to validate
   * @returns Validated URL
   * @throws BadRequestException if URL is invalid or blocked
   */
  private validateUrl(urlString: string): URL {
    try {
      const url = new URL(urlString);

      // Only allow HTTP(S) requests
      if (!['https:', 'http:'].includes(url.protocol)) {
        throw new BadRequestException(`Invalid protocol: ${url.protocol}. Only HTTPS and HTTP are allowed.`);
      }

      // SSRF Protection: Block internal/private network access
      const hostname = url.hostname.toLowerCase();

      // Block localhost variations
      const localhostPatterns = ['localhost', '127.0.0.1', '[::1]', '0.0.0.0', '0localhost'];
      if (localhostPatterns.some((pattern) => hostname === pattern || hostname.startsWith(pattern + '.'))) {
        throw new BadRequestException('Access to localhost is not allowed');
      }

      // Block private IP ranges (IPv4)
      if (this.isPrivateIP(hostname)) {
        throw new BadRequestException('Access to private IP addresses is not allowed');
      }

      // Block internal TLDs
      if (hostname.endsWith('.local') || hostname.endsWith('.internal')) {
        throw new BadRequestException('Access to internal domains is not allowed');
      }

      // Block cloud metadata endpoints (critical for SSRF prevention)
      const blockedEndpoints = [
        '169.254.169.254', // AWS/Azure/GCP metadata
        'metadata.google.internal', // GCP
        '100.100.100.200', // Alibaba Cloud
        'metadata.server', // DigitalOcean
      ];
      if (blockedEndpoints.some((endpoint) => hostname === endpoint || hostname.endsWith(endpoint))) {
        throw new BadRequestException('Access to cloud metadata endpoints is not allowed');
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
   * Check if a hostname is a private IP address
   * @param hostname - Hostname to check
   * @returns true if hostname is a private IP
   */
  private isPrivateIP(hostname: string): boolean {
    // IPv4 private ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8
    const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Pattern);

    if (match) {
      const [, first, second] = match.map(Number);

      // 10.0.0.0/8
      if (first === 10) return true;

      // 172.16.0.0/12 (172.16-31)
      if (first === 172 && second >= 16 && second <= 31) return true;

      // 192.168.0.0/16
      if (first === 192 && second === 168) return true;

      // 127.0.0.0/8 (loopback - already handled but double-check)
      if (first === 127) return true;
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
  async discoverModels(provider: AIProvider & { decryptedApiKey?: string }): Promise<string[]> {
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
        `Failed to discover models for provider ${provider.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return [];
    }
  }

  /**
   * Discover OpenAI models via their API
   * Requires decrypted API key - will not fall back to encrypted key
   * @param provider - OpenAI provider configuration with decrypted key
   * @returns Array of available model names
   * @throws BadRequestException if decrypted API key is not available
   */
  private async discoverOpenAIModels(provider: AIProvider & { decryptedApiKey?: string }): Promise<string[]> {
    try {
      // CRITICAL: Must use decrypted key, never fallback to encrypted key
      const apiKey = provider.decryptedApiKey;

      if (!apiKey && provider.type !== 'ollama') {
        // OpenAI always requires an API key
        throw new BadRequestException('API key is required but was not provided decrypted');
      }

      const headers: Record<string, string> = {};
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await this.safeFetch('https://api.openai.com/v1/models', headers);

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
  private async discoverAnthropicModels(provider: AIProvider & { decryptedApiKey?: string }): Promise<string[]> {
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
   * Requires decrypted API key - will not fall back to encrypted key
   * @param provider - Gemini provider configuration with decrypted key
   * @returns Array of available model names
   * @throws BadRequestException if decrypted API key is not available
   */
  private async discoverGeminiModels(provider: AIProvider & { decryptedApiKey?: string }): Promise<string[]> {
    try {
      const baseUrl = provider.baseUrl || 'https://generativelanguage.googleapis.com/openai/';
      const url = `${baseUrl}v1/models`;

      // CRITICAL: Must use decrypted key, never fallback to encrypted key
      const apiKey = provider.decryptedApiKey;

      if (!apiKey) {
        // Gemini always requires an API key
        throw new BadRequestException('API key is required but was not provided decrypted');
      }

      const headers: Record<string, string> = {};
      headers['Authorization'] = `Bearer ${apiKey}`;

      const response = await this.safeFetch(url, headers);

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
  private async discoverOllamaModels(provider: AIProvider & { decryptedApiKey?: string }): Promise<string[]> {
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
   * Requires decrypted API key - will not fall back to encrypted key
   * @param provider - Together AI provider configuration with decrypted key
   * @returns Array of available model names
   * @throws BadRequestException if decrypted API key is not available
   */
  private async discoverTogetherModels(provider: AIProvider & { decryptedApiKey?: string }): Promise<string[]> {
    try {
      const baseUrl = provider.baseUrl || 'https://api.together.xyz';
      const url = `${baseUrl}/v1/models`;

      // CRITICAL: Must use decrypted key, never fallback to encrypted key
      const apiKey = provider.decryptedApiKey;

      if (!apiKey) {
        // Together AI always requires an API key
        throw new BadRequestException('API key is required but was not provided decrypted');
      }

      const headers: Record<string, string> = {};
      headers['Authorization'] = `Bearer ${apiKey}`;

      const response = await this.safeFetch(url, headers);

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
   * Requires decrypted API key - will not fall back to encrypted key
   * @param provider - OpenAI-compatible provider configuration with decrypted key
   * @returns Array of available model names
   * @throws BadRequestException if decrypted API key is not available (unless keyless)
   */
  private async discoverOpenAICompatibleModels(provider: AIProvider & { decryptedApiKey?: string }): Promise<string[]> {
    try {
      if (!provider.baseUrl) {
        throw new Error('Base URL is required for OpenAI-compatible providers');
      }

      const url = `${provider.baseUrl}/models`;

      // CRITICAL: Must use decrypted key, never fallback to encrypted key
      const apiKey = provider.decryptedApiKey;

      // OpenAI-compatible providers may support keyless auth (e.g., local deployments)
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await this.safeFetch(url, headers);

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
