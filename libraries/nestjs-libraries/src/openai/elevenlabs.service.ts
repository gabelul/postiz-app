import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AITaskConfigService } from '../chat/ai-task-config.service';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { validateBaseUrlOrDefault } from './url-validator';
import pLimit from 'p-limit';

const limit = pLimit(2);

/**
 * Decrypted ElevenLabs provider for internal use
 * Contains sensitive information that should never be sent to the client
 */
interface DecryptedElevenLabsProvider {
  id: string;
  name: string;
  type: string;
  apiKey: string; // decrypted
  baseUrl?: string;
  enabled: boolean;
}

/**
 * ElevenLabs Service
 * Provides text-to-speech voice generation via ElevenLabs API
 * Supports organization-specific provider configuration with fallback to environment variable
 *
 * Note: Some custom OpenAI-compatible endpoints also offer TTS capabilities.
 * Those can be configured as 'openai-compatible' providers with voice support.
 */
@Injectable()
export class ElevenLabsService {
  private readonly logger = new Logger(ElevenLabsService.name);

  // Default voice model to use
  private static readonly DEFAULT_MODEL = 'eleven_multilingual_v2';

  constructor(
    private readonly aiTaskConfig: AITaskConfigService
  ) {}

  /**
   * Get the configured ElevenLabs provider for an organization
   * Falls back to environment variable if no database provider is configured
   * @param organizationId - Organization ID for provider lookup
   * @returns Decrypted provider configuration or null
   */
  private async getProvider(organizationId?: string): Promise<DecryptedElevenLabsProvider | null> {
    // Try database-configured provider first
    // We look for an 'elevenlabs' type provider specifically for voice generation
    if (organizationId) {
      try {
        const provider = await this.aiTaskConfig.getTaskProvider('video-slides', organizationId);

        // Check if it's an ElevenLabs provider
        if (provider && provider.type === 'elevenlabs' && provider.enabled) {
          const decryptedKey = AuthService.fixedDecryption(provider.apiKey);
          return {
            id: provider.id,
            name: provider.name,
            type: provider.type,
            apiKey: decryptedKey,
            baseUrl: provider.baseUrl || undefined,
            enabled: provider.enabled,
          };
        }
      } catch (error) {
        this.logger.warn(`ElevenLabs provider lookup failed for org ${organizationId}, falling back to env var`);
      }
    }

    // Fall back to environment variable (global configuration)
    // Note: We support both the correct ELEVENLABS_API_KEY and legacy ELEVENSLABS_API_KEY for backward compatibility
    const envKey = process.env.ELEVENLABS_API_KEY || process.env.ELEVENSLABS_API_KEY;
    if (envKey) {
      const baseUrl = validateBaseUrlOrDefault(
        process.env.ELEVENLABS_BASE_URL,
        'https://api.elevenlabs.io'
      );
      return {
        id: 'env-fallback',
        name: 'ElevenLabs (Environment)',
        type: 'elevenlabs',
        apiKey: envKey,
        baseUrl,
        enabled: true,
      };
    }

    return null;
  }

  /**
   * Generate audio from text using ElevenLabs TTS API
   * @param voiceId - ElevenLabs voice ID to use
   * @param text - Text to convert to speech
   * @param organizationId - Organization ID for provider configuration lookup
   * @param model - ElevenLabs model to use (defaults to eleven_multilingual_v2)
   * @param outputFormat - Audio output format (defaults to mp3_44100_128)
   * @returns Buffer containing the generated audio
   * @throws NotFoundException if no ElevenLabs provider is configured
   */
  async generateAudioFromText(
    voiceId: string,
    text: string,
    organizationId?: string,
    model: string = ElevenLabsService.DEFAULT_MODEL,
    outputFormat: string = 'mp3_44100_128'
  ): Promise<Buffer> {
    const provider = await this.getProvider(organizationId);

    if (!provider) {
      throw new NotFoundException(
        'No ElevenLabs provider configured. Please add an ElevenLabs provider in the AI providers settings or set ELEVENSLABS_API_KEY environment variable.'
      );
    }

    const baseUrl = validateBaseUrlOrDefault(provider.baseUrl, 'https://api.elevenlabs.io');
    const apiUrl = `${baseUrl}/v1/text-to-speech/${voiceId}?output_format=${outputFormat}`;

    try {
      const response = await limit(() =>
        fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': provider.apiKey,
          },
          body: JSON.stringify({
            text: text,
            model_id: model,
          }),
        })
      );

      // Validate response before processing
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      this.logger.error(`ElevenLabs API error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * List available voices from ElevenLabs
   * @param organizationId - Organization ID for provider configuration lookup
   * @returns Array of available voices with id, name, and preview_url
   * @throws NotFoundException if no ElevenLabs provider is configured
   */
  async getVoices(organizationId?: string): Promise<Array<{ id: string; name: string; preview_url?: string }>> {
    const provider = await this.getProvider(organizationId);

    if (!provider) {
      throw new NotFoundException(
        'No ElevenLabs provider configured. Please add an ElevenLabs provider in the AI providers settings or set ELEVENSLABS_API_KEY environment variable.'
      );
    }

    const baseUrl = validateBaseUrlOrDefault(provider.baseUrl, 'https://api.elevenlabs.io');
    const apiUrl = `${baseUrl}/v2/voices?page_size=40&category=premade`;

    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': provider.apiKey,
        },
      });

      // Validate response before processing
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`ElevenLabs voices API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      return data.voices.map((voice: any) => ({
        id: voice.voice_id,
        name: voice.name,
        preview_url: voice.preview_url,
      }));
    } catch (error) {
      this.logger.error(`ElevenLabs voices API error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
