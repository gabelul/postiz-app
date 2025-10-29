/**
 * Anthropic provider adapter
 * Supports Claude models from Anthropic
 */

import { Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { IAIProviderAdapter } from './ai-provider-adapter.interface';

/**
 * Anthropic adapter for Claude models
 * Supports Claude 3 Opus, Sonnet, Haiku and future models
 */
export class AnthropicAdapter implements IAIProviderAdapter {
  private readonly logger = new Logger(AnthropicAdapter.name);
  private client: Anthropic;

  readonly providerName = 'anthropic';

  /**
   * Initialize Anthropic adapter
   * @param apiKey - Anthropic API key
   */
  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Anthropic API key is required');
    }

    this.client = new Anthropic({
      apiKey,
    });

    this.logger.debug('Anthropic adapter initialized for Claude models');
  }

  /**
   * Get the underlying Anthropic client
   */
  getClient(): Anthropic {
    return this.client;
  }

  /**
   * Anthropic does not support image generation directly
   * Use Vision API for image analysis instead
   */
  supportsImageGeneration(): boolean {
    return false;
  }

  /**
   * Check if Anthropic supports text generation
   */
  supportsTextGeneration(): boolean {
    return true;
  }

  /**
   * Get available Claude models
   * @param taskType - Type of task
   */
  getAvailableModels(taskType: 'image' | 'text' | 'video-slides'): string[] {
    // Claude is good for all text-based tasks
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20250219',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ];
  }

  /**
   * Get the default Claude model
   */
  getDefaultModel(taskType: 'image' | 'text' | 'video-slides'): string {
    // Claude 3.5 Sonnet is the recommended model for most tasks
    return 'claude-3-5-sonnet-20241022';
  }

  /**
   * Validate Anthropic configuration
   */
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.client) {
      errors.push('Anthropic client not initialized');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate text using Claude
   * @param model - Model to use
   * @param messages - Message history
   */
  async generateText(
    model: string,
    messages: Array<{ role: string; content: string }>
  ): Promise<string> {
    try {
      this.logger.debug(`Generating text with Claude model: ${model}`);

      const response = await this.client.messages.create({
        model,
        max_tokens: 4096,
        messages: messages as Anthropic.MessageParam[],
      });

      // Extract text content from response
      const content = response.content[0];
      if (content.type === 'text') {
        return content.text;
      }

      return '';
    } catch (error) {
      this.logger.error(`Failed to generate text with Claude: ${error}`);
      throw error;
    }
  }

  /**
   * Parse structured output with Claude
   * Uses Claude's native JSON mode for structured generation
   * @param model - Model to use
   * @param messages - Message history
   * @param responseFormat - Schema for response format
   */
  async parseStructured(
    model: string,
    messages: Array<{ role: string; content: string }>,
    responseFormat: any
  ): Promise<any> {
    try {
      this.logger.debug(`Parsing structured output with Claude model: ${model}`);

      // Claude doesn't have direct response_format like OpenAI
      // Instead, we use JSON mode by requesting JSON in the system prompt
      const systemPrompt = `You are a helpful assistant that responds with valid JSON.
Your response must be a valid JSON object that matches the following schema:
${typeof responseFormat === 'string' ? responseFormat : JSON.stringify(responseFormat, null, 2)}

Respond ONLY with valid JSON, no additional text.`;

      const response = await this.client.messages.create({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: messages as Anthropic.MessageParam[],
      });

      // Extract and parse JSON from response
      const content = response.content[0];
      if (content.type === 'text') {
        try {
          return JSON.parse(content.text);
        } catch (parseError) {
          this.logger.warn(
            `Failed to parse Claude response as JSON, returning raw text`
          );
          return { text: content.text };
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to parse structured output with Claude: ${error}`);
      throw error;
    }
  }

  /**
   * Analyze an image using Claude's Vision API
   * @param model - Model to use
   * @param imageUrl - URL of the image to analyze
   * @param prompt - Analysis prompt
   */
  async analyzeImage(
    model: string,
    imageUrl: string,
    prompt: string
  ): Promise<string> {
    try {
      this.logger.debug(`Analyzing image with Claude model: ${model}`);

      // Download image and convert to base64
      const imageBuffer = await this.downloadImageAsBase64(imageUrl);

      // Determine media type from URL or default to jpeg
      const mediaType = this.getMediaType(imageUrl);

      const response = await this.client.messages.create({
        model,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: imageBuffer,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        return content.text;
      }

      return '';
    } catch (error) {
      this.logger.error(`Failed to analyze image with Claude: ${error}`);
      throw error;
    }
  }

  /**
   * Download an image from URL and convert to base64
   * @param imageUrl - URL of the image
   * @returns Base64 encoded image string
   */
  private async downloadImageAsBase64(imageUrl: string): Promise<string> {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      return Buffer.from(buffer).toString('base64');
    } catch (error) {
      this.logger.error(`Failed to download image from ${imageUrl}: ${error}`);
      throw error;
    }
  }

  /**
   * Determine media type from image URL
   * @param imageUrl - URL of the image
   * @returns Media type (e.g., 'image/jpeg', 'image/png')
   */
  private getMediaType(
    imageUrl: string
  ): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
    const url = new URL(imageUrl);
    const pathname = url.pathname.toLowerCase();

    if (pathname.endsWith('.png')) return 'image/png';
    if (pathname.endsWith('.gif')) return 'image/gif';
    if (pathname.endsWith('.webp')) return 'image/webp';
    // Default to jpeg
    return 'image/jpeg';
  }
}
