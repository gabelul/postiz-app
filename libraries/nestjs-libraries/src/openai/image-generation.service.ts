import { Injectable, Logger } from '@nestjs/common';
import { AITaskConfigService } from '../chat/ai-task-config.service';
import { OpenaiService } from './openai.service';
import { FalService } from './fal.service';
import { DEFAULT_MODELS, AIProviderType } from '../dtos/ai/ai-provider.types';

/**
 * Image generation models available per provider type
 * Extracted from DEFAULT_MODELS to avoid duplication
 */
const IMAGE_MODELS: Record<AIProviderType, string[]> = {
  openai: DEFAULT_MODELS.openai.filter(m => m.startsWith('dall-e')),
  anthropic: [],
  gemini: DEFAULT_MODELS.gemini.filter(m => m.includes('image') || m.includes('imagen')),
  ollama: [],
  together: [],
  'openai-compatible': DEFAULT_MODELS['openai-compatible'].filter(m => m.startsWith('dall-e')),
  fal: DEFAULT_MODELS.fal,
  elevenlabs: [],
};

/**
 * Image generation options
 */
export interface ImageGenerationOptions {
  /** Whether to return URL (true) or base64 (false) */
  isUrl?: boolean;
  /** Whether to generate vertical (9:16) or horizontal (16:9) image */
  isVertical?: boolean;
  /** Custom model override (optional) */
  model?: string;
}

/**
 * Generic Image Generation Service
 * Routes image generation requests to the configured provider based on organization settings
 *
 * Supported providers:
 * - OpenAI (DALL-E 2/3)
 * - FAL (Ideogram, FLUX, Stable Diffusion, etc.)
 * - OpenAI-compatible endpoints (that support image generation)
 * - Gemini (via image generation endpoints)
 *
 * Fallback behavior:
 * 1. Primary provider from organization config
 * 2. Fallback provider from organization config
 * 3. Environment variable defaults
 */
@Injectable()
export class ImageGenerationService {
  private readonly logger = new Logger(ImageGenerationService.name);

  constructor(
    private readonly aiTaskConfig: AITaskConfigService,
    private readonly openaiService: OpenaiService,
    private readonly falService: FalService
  ) {}

  /**
   * Generate an image from text prompt using the configured provider
   * @param prompt - Text description of the image to generate
   * @param organizationId - Organization ID for provider lookup
   * @param options - Generation options
   * @returns Image URL or base64 string depending on options.isUrl
   */
  async generateImage(
    prompt: string,
    organizationId: string | undefined,
    options: ImageGenerationOptions = {}
  ): Promise<string> {
    const { isUrl = true, isVertical = false, model } = options;

    // Get the configured provider for this organization
    // If organizationId is undefined, getTaskProvider will return null
    const provider = organizationId
      ? await this.aiTaskConfig.getTaskProvider('image', organizationId)
      : null;

    if (!provider) {
      // No provider configured - fall back to OpenAI service
      // which has its own environment variable fallback logic
      this.logger.debug('No image provider configured, using OpenAI service with env fallback');
      return this.openaiService.generateImage(prompt, isUrl, isVertical, organizationId);
    }

    this.logger.debug(
      `Generating image with provider: ${provider.name} (${provider.type}), model: ${model || 'default'}`
    );

    // Route to the appropriate service based on provider type
    switch (provider.type) {
      case 'fal':
        // FAL uses different models (ideogram/v2, fast-sdxl, etc.)
        return this.falService.generateImageFromText(
          model || 'ideogram/v2',
          prompt,
          isVertical,
          organizationId
        );

      case 'openai':
      case 'openai-compatible':
      case 'gemini':
      case 'together':
      case 'ollama':
        // OpenAI-compatible providers use the OpenAI service
        return this.openaiService.generateImage(prompt, isUrl, isVertical, organizationId);

      default:
        // Try to use OpenAI service as fallback for unknown types
        this.logger.warn(`Unknown provider type ${provider.type}, attempting OpenAI-compatible route`);
        return this.openaiService.generateImage(prompt, isUrl, isVertical, organizationId);
    }
  }

  /**
   * Get available image generation models for the organization's configured provider
   * @param organizationId - Organization ID for provider lookup
   * @returns Array of available model identifiers
   */
  async getAvailableModels(organizationId: string | undefined): Promise<string[]> {
    const provider = organizationId
      ? await this.aiTaskConfig.getTaskProvider('image', organizationId)
      : null;

    if (!provider) {
      // Return default OpenAI DALL-E models when no provider is configured
      return IMAGE_MODELS.openai;
    }

    // Return models from IMAGE_MODELS based on provider type
    return IMAGE_MODELS[provider.type] || [];
  }
}
