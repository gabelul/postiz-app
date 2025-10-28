import { Injectable, Logger } from '@nestjs/common';
import { AIProvider } from '@prisma/client';

/**
 * Service for discovering and caching available models from AI providers
 * Provides methods to fetch model lists from various AI provider APIs
 */
@Injectable()
export class ModelDiscoveryService {
  private readonly logger = new Logger(ModelDiscoveryService.name);

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
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${provider.apiKey}`,
        },
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

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${provider.apiKey}`,
        },
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

      const response = await fetch(url);

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

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${provider.apiKey}`,
        },
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

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${provider.apiKey}`,
        },
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
