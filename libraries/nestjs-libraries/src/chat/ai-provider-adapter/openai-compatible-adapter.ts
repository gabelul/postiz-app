/**
 * OpenAI-compatible provider adapter
 * Supports any service with OpenAI-compatible API (e.g., Gemini via OpenAI format, local models, etc.)
 */

import { Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { IAIProviderAdapter } from './ai-provider-adapter.interface';

/**
 * Adapter for OpenAI-compatible services
 * Supports:
 * - Gemini via OpenAI-compatible endpoint
 * - Custom local models (Ollama, LM Studio, etc.)
 * - Other OpenAI-compatible APIs (TogetherAI, Anyscale, etc.)
 */
export class OpenAICompatibleAdapter implements IAIProviderAdapter {
  private readonly logger = new Logger(OpenAICompatibleAdapter.name);
  private client: OpenAI;
  private readonly baseUrl: string;
  private readonly providerNameValue: string;

  readonly providerName = 'openai-compatible';

  /**
   * Initialize OpenAI-compatible adapter
   * @param apiKey - API key for the service
   * @param baseUrl - Base URL of the service (e.g., https://api.gemini.com/v1)
   * @param providerName - Name of the provider for logging (e.g., 'gemini', 'ollama', 'together')
   */
  constructor(apiKey: string, baseUrl: string, providerName: string = 'custom') {
    if (!apiKey) {
      throw new Error('API key is required for OpenAI-compatible provider');
    }

    if (!baseUrl) {
      throw new Error('Base URL is required for OpenAI-compatible provider');
    }

    this.baseUrl = baseUrl;
    this.providerNameValue = providerName;

    // Create OpenAI client with custom endpoint
    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
    });

    this.logger.debug(
      `OpenAI-compatible adapter initialized for ${providerName} at ${baseUrl}`
    );
  }

  /**
   * Get the underlying OpenAI client
   */
  getClient(): OpenAI {
    return this.client;
  }

  /**
   * Check if this adapter supports image generation
   * Note: Image generation support depends on the specific implementation
   */
  supportsImageGeneration(): boolean {
    // OpenAI-compatible providers may or may not support images
    // For Gemini: use Gemini-specific API, not OpenAI-compatible
    return this.providerNameValue !== 'gemini';
  }

  /**
   * Check if this adapter supports text generation
   */
  supportsTextGeneration(): boolean {
    return true;
  }

  /**
   * Get available models for this provider
   * Note: Model availability depends on the specific implementation
   * @param taskType - Type of task
   */
  getAvailableModels(taskType: 'image' | 'text' | 'video-slides'): string[] {
    switch (this.providerNameValue) {
      case 'gemini':
        // Gemini models via OpenAI format
        if (taskType === 'image') {
          return []; // Gemini uses its own image API
        }
        return [
          'gemini-2.0-flash',
          'gemini-2.0-flash-exp',
          'gemini-1.5-pro',
          'gemini-1.5-flash',
        ];

      case 'ollama':
        // Ollama local models - user-defined
        return [
          'llama2',
          'mistral',
          'neural-chat',
          'dolphin-mixtral',
          'orca-mini',
        ];

      case 'together':
        // TogetherAI models
        return [
          'meta-llama/Llama-2-70b-chat-hf',
          'meta-llama/Llama-2-13b-chat-hf',
          'mistralai/Mistral-7B-Instruct-v0.1',
        ];

      default:
        // Generic OpenAI-compatible
        return ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'];
    }
  }

  /**
   * Get the default model for a task type
   */
  getDefaultModel(taskType: 'image' | 'text' | 'video-slides'): string {
    switch (this.providerNameValue) {
      case 'gemini':
        return 'gemini-2.0-flash';
      case 'ollama':
        return 'mistral';
      case 'together':
        return 'meta-llama/Llama-2-70b-chat-hf';
      default:
        return 'gpt-3.5-turbo';
    }
  }

  /**
   * Validate configuration
   */
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.client) {
      errors.push('Client not initialized');
    }

    if (!this.baseUrl) {
      errors.push('Base URL not configured');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate text using the compatible provider
   * @param model - Model to use
   * @param messages - Message history
   */
  async generateText(
    model: string,
    messages: Array<{ role: string; content: string }>
  ): Promise<string> {
    try {
      this.logger.debug(
        `Generating text with ${this.providerNameValue} model: ${model}`
      );

      const response = await this.client.chat.completions.create({
        model,
        messages: messages as OpenAI.ChatCompletionMessageParam[],
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      this.logger.error(
        `Failed to generate text with ${this.providerNameValue}: ${error}`
      );
      throw error;
    }
  }

  /**
   * Parse structured output
   * @param model - Model to use
   * @param messages - Message history
   * @param responseFormat - Response format schema
   */
  async parseStructured(
    model: string,
    messages: Array<{ role: string; content: string }>,
    responseFormat: any
  ): Promise<any> {
    try {
      this.logger.debug(
        `Parsing structured output with ${this.providerNameValue} model: ${model}`
      );

      // Some OpenAI-compatible providers don't support response_format
      // Fall back to manual parsing if needed
      try {
        const response = await this.client.chat.completions.parse({
          model,
          messages: messages as OpenAI.ChatCompletionMessageParam[],
          response_format: responseFormat,
        });

        return response.choices[0]?.message?.parsed || null;
      } catch (parseError) {
        // If structured parsing fails, try without response_format
        this.logger.warn(
          `Structured parsing not supported by ${this.providerNameValue}, attempting fallback`
        );

        const response = await this.client.chat.completions.create({
          model,
          messages: messages as OpenAI.ChatCompletionMessageParam[],
        });

        return response.choices[0]?.message?.content || null;
      }
    } catch (error) {
      this.logger.error(
        `Failed to parse structured output with ${this.providerNameValue}: ${error}`
      );
      throw error;
    }
  }

  /**
   * Get provider information
   */
  getProviderInfo(): {
    name: string;
    baseUrl: string;
    supportsImages: boolean;
  } {
    return {
      name: this.providerNameValue,
      baseUrl: this.baseUrl,
      supportsImages: this.supportsImageGeneration(),
    };
  }
}
