import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AITaskConfigService } from '../chat/ai-task-config.service';
import { OpenaiService } from './openai.service';
import { ElevenLabsService } from './elevenlabs.service';

/**
 * TTS voice information
 */
export interface TTSVoice {
  id: string;
  name: string;
  preview_url?: string;
}

/**
 * TTS generation options
 */
export interface TTSOptions {
  /** Voice model override (optional) */
  model?: string;
  /** Output format (default: mp3_44100_128 for ElevenLabs) */
  outputFormat?: string;
}

/**
 * Generic Text-to-Speech Service
 * Routes TTS requests to the configured provider based on organization settings
 *
 * Supported providers:
 * - OpenAI (tts-1, tts-1-hd models)
 * - OpenAI-compatible endpoints (that support TTS)
 * - ElevenLabs (eleven_multilingual_v2, etc.)
 *
 * Voice IDs:
 * - OpenAI: alloy, echo, fable, onyx, nova, shimmer
 * - ElevenLabs: Voice IDs from the ElevenLabs API
 *
 * Fallback behavior:
 * 1. Primary provider from organization config (video-slides task)
 * 2. Fallback provider from organization config
 * 3. Environment variable defaults
 */
@Injectable()
export class TTSService {
  private readonly logger = new Logger(TTSService.name);

  // Default OpenAI voice to use if no specific voice is provided
  private static readonly DEFAULT_OPENAI_VOICE = 'alloy';
  private static readonly DEFAULT_OPENAI_MODEL = 'tts-1';

  constructor(
    private readonly aiTaskConfig: AITaskConfigService,
    private readonly openaiService: OpenaiService,
    private readonly elevenLabsService: ElevenLabsService
  ) {}

  /**
   * Generate audio from text using the configured provider
   * @param text - Text to convert to speech
   * @param voice - Voice ID (provider-specific)
   * @param organizationId - Organization ID for provider lookup
   * @param options - Generation options
   * @returns Buffer containing the generated audio
   */
  async generateAudio(
    text: string,
    voice: string,
    organizationId: string | undefined,
    options: TTSOptions = {}
  ): Promise<Buffer> {
    const { model, outputFormat } = options;

    // Get the configured provider for this organization
    // We use 'video-slides' task type since TTS is used in that context
    const provider = organizationId
      ? await this.aiTaskConfig.getTaskProvider('video-slides', organizationId)
      : null;

    if (!provider) {
      // No provider configured - need to determine which service to use
      // Try to detect based on voice ID format, otherwise default to OpenAI
      if (this.isElevenLabsVoiceId(voice)) {
        this.logger.debug('No TTS provider configured, using ElevenLabs service with env fallback');
        return this.elevenLabsService.generateAudioFromText(
          voice,
          text,
          organizationId,
          model || 'eleven_multilingual_v2',
          outputFormat || 'mp3_44100_128'
        );
      }

      // Default to OpenAI TTS (supports alloy, echo, fable, onyx, nova, shimmer)
      this.logger.debug('No TTS provider configured, using OpenAI service with env fallback');
      return this.openaiService.generateAudioFromText(
        text,
        voice,
        model || TTSService.DEFAULT_OPENAI_MODEL,
        organizationId
      );
    }

    this.logger.debug(
      `Generating TTS with provider: ${provider.name} (${provider.type}), voice: ${voice}`
    );

    // Route to the appropriate service based on provider type
    switch (provider.type) {
      case 'elevenlabs':
        // ElevenLabs uses its own API format
        return this.elevenLabsService.generateAudioFromText(
          voice,
          text,
          organizationId,
          model || 'eleven_multilingual_v2',
          outputFormat || 'mp3_44100_128'
        );

      case 'openai':
      case 'openai-compatible':
      case 'gemini':
      case 'together':
      case 'ollama':
        // OpenAI and compatible providers use the OpenAI TTS API
        // Check if voice is an ElevenLabs voice ID (looks like a UUID)
        if (this.isElevenLabsVoiceId(voice)) {
          // Voice ID looks like ElevenLabs, but we're using OpenAI provider
          // Fall back to default OpenAI voice with a warning
          this.logger.warn(
            `ElevenLabs voice ID detected with ${provider.type} provider, using default voice instead`
          );
          return this.openaiService.generateAudioFromText(
            text,
            TTSService.DEFAULT_OPENAI_VOICE,
            TTSService.DEFAULT_OPENAI_MODEL,
            organizationId
          );
        }

        // Use the voice directly (it's an OpenAI voice name)
        return this.openaiService.generateAudioFromText(
          text,
          voice,
          model || TTSService.DEFAULT_OPENAI_MODEL,
          organizationId
        );

      default:
        // Unknown provider type - try OpenAI as fallback
        this.logger.warn(
          `Unknown provider type ${provider.type} for TTS, attempting OpenAI-compatible route`
        );
        return this.openaiService.generateAudioFromText(
          text,
          this.isElevenLabsVoiceId(voice) ? TTSService.DEFAULT_OPENAI_VOICE : voice,
          TTSService.DEFAULT_OPENAI_MODEL,
          organizationId
        );
    }
  }

  /**
   * Get available voices for the organization's configured provider
   * @param organizationId - Organization ID for provider lookup
   * @returns Array of available voices
   */
  async getVoices(organizationId: string | undefined): Promise<TTSVoice[]> {
    const provider = organizationId
      ? await this.aiTaskConfig.getTaskProvider('video-slides', organizationId)
      : null;

    if (!provider) {
      // Return OpenAI voices as default
      return this.getOpenAIVoices();
    }

    // Return voices based on provider type
    switch (provider.type) {
      case 'elevenlabs':
        const voices = await this.elevenLabsService.getVoices(organizationId);
        return voices;

      case 'openai':
      case 'openai-compatible':
      case 'gemini':
      case 'together':
      case 'ollama':
        return this.getOpenAIVoices();

      default:
        return this.getOpenAIVoices();
    }
  }

  /**
   * Get OpenAI TTS voices
   * @returns Array of OpenAI voice definitions
   */
  private getOpenAIVoices(): TTSVoice[] {
    return [
      { id: 'alloy', name: 'Alloy' },
      { id: 'echo', name: 'Echo' },
      { id: 'fable', name: 'Fable' },
      { id: 'onyx', name: 'Onyx' },
      { id: 'nova', name: 'Nova' },
      { id: 'shimmer', name: 'Shimmer' },
    ];
  }

  /**
   * Check if a voice ID appears to be an ElevenLabs voice ID
   * ElevenLabs voice IDs are typically UUIDs or contain specific patterns
   * @param voiceId - Voice ID to check
   * @returns true if the voice ID looks like an ElevenLabs voice
   */
  private isElevenLabsVoiceId(voiceId: string): boolean {
    // ElevenLabs voice IDs are typically UUIDs (e.g., "21m00Tcm4TlvDq8ikWAM")
    // or contain patterns like "eleven_multilingual_v2"
    return (
      voiceId.length > 20 || // Longer than typical OpenAI voice names
      voiceId.includes('_') || // Contains underscores (OpenAI voices don't)
      /^[\w-]{20,}$/.test(voiceId) // Long alphanumeric string with possible hyphens
    );
  }

  /**
   * Detect which provider type a voice ID belongs to
   * @param voiceId - Voice ID to check
   * @returns 'elevenlabs' or 'openai'
   */
  detectVoiceProviderType(voiceId: string): 'elevenlabs' | 'openai' {
    return this.isElevenLabsVoiceId(voiceId) ? 'elevenlabs' : 'openai';
  }
}
