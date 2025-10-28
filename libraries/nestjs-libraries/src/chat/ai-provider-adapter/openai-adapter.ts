/**
 * OpenAI provider adapter
 * Wraps OpenAI client for use with the unified AI provider system
 */

import { Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { IAIProviderAdapter } from './ai-provider-adapter.interface';

/**
 * OpenAI adapter that supports GPT models and DALL-E image generation
 */
export class OpenAIAdapter implements IAIProviderAdapter {
  private readonly logger = new Logger(OpenAIAdapter.name);
  private client: OpenAI;

  readonly providerName = 'openai';

  /**
   * Initialize OpenAI adapter
   * @param apiKey - OpenAI API key
   * @param baseUrl - Optional custom base URL for OpenAI-compatible services
   */
  constructor(apiKey: string, baseUrl?: string) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    // Create OpenAI client with provided configuration
    this.client = new OpenAI({
      apiKey,
      ...(baseUrl && { baseURL: baseUrl }),
    });

    this.logger.debug(
      `OpenAI adapter initialized${baseUrl ? ` with custom base URL: ${baseUrl}` : ''}`
    );
  }

  /**
   * Get the underlying OpenAI client
   */
  getClient(): OpenAI {
    return this.client;
  }

  /**
   * Check if OpenAI supports image generation (DALL-E)
   */
  supportsImageGeneration(): boolean {
    return true;
  }

  /**
   * Check if OpenAI supports text generation
   */
  supportsTextGeneration(): boolean {
    return true;
  }

  /**
   * Get available models for OpenAI
   * @param taskType - Type of task
   */
  getAvailableModels(taskType: 'image' | 'text' | 'video-slides'): string[] {
    switch (taskType) {
      case 'image':
        return ['dall-e-3', 'dall-e-2'];
      case 'text':
      case 'video-slides':
        return [
          'gpt-4.1',
          'gpt-4-turbo',
          'gpt-4',
          'gpt-4o',
          'gpt-4o-mini',
          'gpt-3.5-turbo',
        ];
      default:
        return [];
    }
  }

  /**
   * Get the default model for a task type
   */
  getDefaultModel(taskType: 'image' | 'text' | 'video-slides'): string {
    switch (taskType) {
      case 'image':
        return 'dall-e-3';
      case 'text':
      case 'video-slides':
        return 'gpt-4.1';
      default:
        return 'gpt-4.1';
    }
  }

  /**
   * Validate OpenAI configuration
   */
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.client) {
      errors.push('OpenAI client not initialized');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate an image using DALL-E
   * @param prompt - Image generation prompt
   * @param model - Model to use (dall-e-3 or dall-e-2)
   * @param isUrl - Whether to return URL or base64
   */
  async generateImage(
    prompt: string,
    model: string = 'dall-e-3',
    isUrl: boolean = true
  ): Promise<string | null> {
    try {
      this.logger.debug(`Generating image with model: ${model}`);

      const response = await this.client.images.generate({
        prompt,
        model,
        response_format: isUrl ? 'url' : 'b64_json',
        ...(model === 'dall-e-3' && { size: '1024x1024' }),
      });

      const image = response.data[0];
      if (isUrl) {
        return image.url || null;
      } else {
        return image.b64_json || null;
      }
    } catch (error) {
      this.logger.error(`Failed to generate image: ${error}`);
      throw error;
    }
  }

  /**
   * Generate text using GPT models
   * @param model - Model to use
   * @param messages - Message history
   */
  async generateText(
    model: string,
    messages: Array<{ role: string; content: string }>
  ): Promise<string> {
    try {
      this.logger.debug(`Generating text with model: ${model}`);

      const response = await this.client.chat.completions.create({
        model,
        messages: messages as OpenAI.ChatCompletionMessageParam[],
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      this.logger.error(`Failed to generate text: ${error}`);
      throw error;
    }
  }

  /**
   * Parse structured output using GPT
   * @param model - Model to use
   * @param messages - Message history
   * @param responseFormat - Zod schema for response format
   */
  async parseStructured(
    model: string,
    messages: Array<{ role: string; content: string }>,
    responseFormat: any
  ): Promise<any> {
    try {
      this.logger.debug(`Parsing structured output with model: ${model}`);

      const response = await this.client.chat.completions.parse({
        model,
        messages: messages as OpenAI.ChatCompletionMessageParam[],
        response_format: responseFormat,
      });

      return response.choices[0]?.message?.parsed || null;
    } catch (error) {
      this.logger.error(`Failed to parse structured output: ${error}`);
      throw error;
    }
  }
}
