import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import OpenAI from 'openai';
import { shuffle } from 'lodash';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { AIProviderManagerService } from './ai-provider-manager.service';
import { AIProviderDiscoveryService } from './ai-provider-discovery.service';
import { AITaskConfigService } from '../chat/ai-task-config.service';
import { AITaskType, AIRequestContext, AIProvider as LegacyAIProvider } from './interfaces/ai-provider.interface';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { AIProvider } from '@prisma/client';
import { validateBaseUrlOrDefault } from './url-validator';

// Legacy OpenAI client for backward compatibility (deprecated)
const legacyOpenai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-proj-',
  baseURL: process.env.OPENAI_BASE_URL,
});

const PicturePrompt = z.object({
  prompt: z.string(),
});

const VoicePrompt = z.object({
  voice: z.string(),
});

/**
 * Decrypted provider for internal use in OpenaiService
 * Contains sensitive information that should never be sent to the client
 */
interface DecryptedAIProvider {
  id: string;
  name: string;
  type: string;
  apiKey: string; // decrypted
  baseUrl?: string;
  customConfig?: string;
  enabled: boolean;
  isDefault: boolean;
  availableModels?: string;
}

@Injectable()
export class OpenaiService {
  private readonly logger = new Logger(OpenaiService.name);

  constructor(
    private readonly providerManager: AIProviderManagerService,
    private readonly discoveryService: AIProviderDiscoveryService,
    private readonly aiTaskConfig: AITaskConfigService
  ) {}

  /**
   * Execute an AI operation with automatic provider selection and retry logic
   * Now supports both legacy environment-based and database-based configuration
   * @param taskType - Type of task (image, text, video-slides, agent, smart, fast)
   * @param operation - The operation to execute with the selected provider
   * @param organizationId - Organization ID for database config lookup
   * @param context - Additional context for provider selection
   */
  private async executeWithProvider<T>(
    taskType: AITaskType,
    operation: (client: OpenAI, provider: DecryptedAIProvider, model: string) => Promise<T>,
    organizationId?: string,
    context: Partial<AIRequestContext> = {}
  ): Promise<T> {
    const requestContext: AIRequestContext = {
      taskType,
      ...context,
    };

    // Try to use database-configured provider first
    if (organizationId) {
      try {
        // Map legacy task types to new task types
        const mappedTaskType = this.mapLegacyTaskType(taskType);
        const provider = await this.aiTaskConfig.getTaskProvider(mappedTaskType, organizationId);

        if (provider && provider.enabled) {
          // Decrypt API key for internal use
          const decryptedKey = AuthService.fixedDecryption(provider.apiKey);
          const decryptedProvider: DecryptedAIProvider = {
            ...provider,
            apiKey: decryptedKey,
          };

          // Create OpenAI client with provider configuration
          const client = this.createClientForProvider(decryptedProvider);
          const model = provider.availableModels
            ? this.getModelFromConfig(provider.availableModels, this.aiTaskConfig.getModel(mappedTaskType, organizationId))
            : this.aiTaskConfig.getModel(mappedTaskType, organizationId);

          this.logger.debug(`Using database-configured provider '${provider.name}' for task '${taskType}'`);
          const result = await operation(client, decryptedProvider, model);

          return result;
        }
      } catch (error) {
        this.logger.warn(`Database provider lookup failed for '${taskType}': ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Fall back to legacy environment-based provider system
    const enabledProviders = this.discoveryService.getEnabledProviders();
    if (enabledProviders.size === 0) {
      // Fall back to legacy client if no new providers configured
      const legacyModel = taskType === 'smart' || taskType === 'agent' || taskType === 'video-slides' || taskType === 'image'
        ? (process.env.SMART_LLM || 'gpt-4.1')
        : (process.env.FAST_LLM || 'gpt-4o-mini');

      this.logger.debug(`Using legacy client for task '${taskType}' with model '${legacyModel}'`);
      return operation(legacyOpenai, { name: 'LEGACY', type: 'openai', apiKey: '', enabled: true, isDefault: false, id: '' } as DecryptedAIProvider, legacyModel);
    }

    // Wrap operation to convert from legacy AIProvider to DecryptedAIProvider
    const wrappedOperation = async (client: OpenAI, provider: LegacyAIProvider, model: string) => {
      // Convert legacy AIProvider to DecryptedAIProvider format
      const decryptedProvider: DecryptedAIProvider = {
        id: '', // Legacy providers don't have database IDs
        name: provider.name,
        type: 'openai', // Legacy providers are OpenAI-compatible
        apiKey: provider.key, // Already in plain text from environment
        baseUrl: provider.url,
        enabled: provider.enabled,
        isDefault: false,
        availableModels: undefined,
      };
      return operation(client, decryptedProvider, model);
    };

    return this.providerManager.executeWithRetry(wrappedOperation, requestContext);
  }

  /**
   * Map legacy task types to new task types
   * @param taskType - Legacy or new task type
   * @returns Mapped task type for database lookup
   */
  private mapLegacyTaskType(taskType: AITaskType): AITaskType {
    // Map 'smart' to appropriate task type
    if (taskType === 'smart') {
      // For smart tasks, prefer text generation but allow fallback
      return 'text';
    }
    // Map 'fast' to text generation (for social posts)
    if (taskType === 'fast') {
      return 'text';
    }
    // Already a new task type
    return taskType;
  }

  /**
   * Get model name from config with fallback
   * @param availableModelsJson - JSON string of available models
   * @param configuredModel - Configured model name
   * @returns Best available model
   */
  private getModelFromConfig(availableModelsJson: string, configuredModel: string): string {
    try {
      const availableModels = JSON.parse(availableModelsJson);
      if (Array.isArray(availableModels) && availableModels.length > 0) {
        // Use configured model if available, otherwise use first available
        return availableModels.includes(configuredModel) ? configuredModel : availableModels[0];
      }
    } catch {
      // Invalid JSON, use configured model
    }
    return configuredModel;
  }

  /**
   * Create OpenAI client for a specific provider
   * Handles both OpenAI and OpenAI-compatible providers
   * @param provider - Provider with decrypted API key
   * @returns Configured OpenAI client
   */
  private createClientForProvider(provider: DecryptedAIProvider): OpenAI {
    // For OpenAI-compatible providers, use the baseUrl
    // For Anthropic, we would need to use the Anthropic SDK (not supported here yet)
    const baseUrl = provider.type === 'openai'
      ? undefined // Use default OpenAI endpoint
      : validateBaseUrlOrDefault(provider.baseUrl, this.getDefaultBaseUrl(provider.type));

    return new OpenAI({
      apiKey: provider.apiKey,
      baseURL: baseUrl,
    });
  }

  /**
   * Get default base URL for a provider type
   * @param providerType - Type of provider
   * @returns Default base URL
   */
  private getDefaultBaseUrl(providerType: string): string {
    const defaults: Record<string, string> = {
      anthropic: 'https://api.anthropic.com', // Not compatible with OpenAI SDK
      gemini: 'https://generativelanguage.googleapis.com/openai/',
      ollama: 'http://localhost:11434/v1',
      together: 'https://api.together.xyz/v1',
      'openai-compatible': 'http://localhost:8000/v1',
    };
    return defaults[providerType] || '';
  }

  /**
   * Execute operation with fallback provider if primary fails
   * @param taskType - Type of task
   * @param operation - Operation to execute
   * @param organizationId - Organization ID
   * @param context - Additional context
   */
  private async executeWithFallback<T>(
    taskType: AITaskType,
    operation: (client: OpenAI, provider: DecryptedAIProvider, model: string) => Promise<T>,
    organizationId?: string,
    context: Partial<AIRequestContext> = {}
  ): Promise<T> {
    const mappedTaskType = this.mapLegacyTaskType(taskType);

    // Try primary provider first
    try {
      return await this.executeWithProvider(taskType, operation, organizationId, context);
    } catch (primaryError) {
      this.logger.warn(`Primary provider failed for task '${taskType}': ${primaryError instanceof Error ? primaryError.message : String(primaryError)}`);

      // Try fallback provider if organization is specified
      if (organizationId) {
        try {
          const fallbackProvider = await this.aiTaskConfig.getTaskFallbackProvider(mappedTaskType, organizationId);
          if (fallbackProvider && fallbackProvider.enabled) {
            const decryptedKey = AuthService.fixedDecryption(fallbackProvider.apiKey);
            const decryptedProvider: DecryptedAIProvider = {
              ...fallbackProvider,
              apiKey: decryptedKey,
            };

            const client = this.createClientForProvider(decryptedProvider);
            const model = this.aiTaskConfig.getFallbackModel(mappedTaskType, organizationId) ||
              this.getModelFromConfig(fallbackProvider.availableModels || '', 'gpt-4o-mini');

            this.logger.debug(`Using fallback provider '${fallbackProvider.name}' for task '${taskType}'`);
            return await operation(client, decryptedProvider, model);
          }
        } catch (fallbackError) {
          this.logger.error(`Fallback provider also failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
        }
      }

      // Re-throw original error if no fallback available
      throw primaryError;
    }
  }
  /**
   * Generate an image using configured AI provider
   * @param prompt - The image generation prompt
   * @param isUrl - Whether to return URL or base64 data
   * @param isVertical - Whether to generate vertical image
   * @param organizationId - Organization ID for database config lookup
   */
  async generateImage(prompt: string, isUrl: boolean, isVertical = false, organizationId?: string) {
    // Use executeWithFallback for automatic failover
    return this.executeWithFallback('image', async (client, provider, model) => {
      // For image generation, use dall-e-3 as default unless provider has specific model
      const imageModel = provider.type === 'openai' ? 'dall-e-3' : model;

      const generate = (
        await client.images.generate({
          prompt,
          response_format: isUrl ? 'url' : 'b64_json',
          model: imageModel,
          ...(isVertical ? { size: '1024x1792' } : {}),
        })
      ).data[0];

      return isUrl ? generate.url : generate.b64_json;
    }, organizationId);
  }

  /**
   * Generate a detailed prompt for image generation
   * @param prompt - Basic prompt to enhance
   * @param organizationId - Organization ID for database config lookup
   */
  async generatePromptForPicture(prompt: string, organizationId?: string) {
    return this.executeWithFallback('text', async (client, provider, model) => {
      const result = await client.chat.completions.parse({
        model,
        messages: [
          {
            role: 'system',
            content: `You are an assistant that take a description and style and generate a prompt that will be used later to generate images, make it a very long and descriptive explanation, and write a lot of things for the renderer like, if it's realistic describe the camera`,
          },
          {
            role: 'user',
            content: `prompt: ${prompt}`,
          },
        ],
        response_format: zodResponseFormat(PicturePrompt, 'picturePrompt'),
      });

      return result.choices[0].message.parsed?.prompt || '';
    }, organizationId);
  }

  /**
   * Generate voice text from social media post
   * @param prompt - Social media post content
   * @param organizationId - Organization ID for database config lookup
   */
  async generateVoiceFromText(prompt: string, organizationId?: string) {
    return this.executeWithFallback('video-slides', async (client, provider, model) => {
      const result = await client.chat.completions.parse({
        model,
        messages: [
          {
            role: 'system',
            content: `You are an assistant that takes a social media post and convert it to a normal human voice, to be later added to a character, when a person talk they don't use "-", and sometimes they add pause with "..." to make it sounds more natural, make sure you use a lot of pauses and make it sound like a real person`,
          },
          {
            role: 'user',
            content: `prompt: ${prompt}`,
          },
        ],
        response_format: zodResponseFormat(VoicePrompt, 'voice'),
      });

      return result.choices[0].message.parsed?.voice || '';
    }, organizationId);
  }

  /**
   * Generate social media posts from content
   * @param content - Source content to generate posts from
   * @param organizationId - Organization ID for database config lookup
   */
  async generatePosts(content: string, organizationId?: string) {
    return this.executeWithFallback('text', async (client, provider, model) => {
      const posts = (
        await Promise.all([
          client.chat.completions.create({
            messages: [
              {
                role: 'assistant',
                content:
                  'Generate a Twitter post from the content without emojis in the following JSON format: { "post": string } put it in an array with one element',
              },
              {
                role: 'user',
                content: content!,
              },
            ],
            n: 5,
            temperature: 1,
            model,
          }),
          client.chat.completions.create({
            messages: [
              {
                role: 'assistant',
                content:
                  'Generate a thread for social media in the following JSON format: Array<{ "post": string }> without emojis',
              },
              {
                role: 'user',
                content: content!,
              },
            ],
            n: 5,
            temperature: 1,
            model,
          }),
        ])
      ).flatMap((p) => p.choices);

      return shuffle(
        posts.map((choice) => {
          const { content } = choice.message;
          const start = content?.indexOf('[')!;
          const end = content?.lastIndexOf(']')!;
          try {
            return JSON.parse(
              '[' +
                content
                  ?.slice(start + 1, end)
                  .replace(/\n/g, ' ')
                  .replace(/ {2,}/g, ' ') +
                ']'
            );
          } catch (e) {
            return [];
          }
        })
      );
    }, organizationId);
  }

  /**
   * Extract article content from website text and generate posts
   * @param content - Full website text content
   * @param organizationId - Organization ID for database config lookup
   */
  async extractWebsiteText(content: string, organizationId?: string) {
    return this.executeWithFallback('text', async (client, provider, model) => {
      const websiteContent = await client.chat.completions.create({
        messages: [
          {
            role: 'assistant',
            content:
              'You take a full website text, and extract only the article content',
          },
          {
            role: 'user',
            content,
          },
        ],
        model,
      });

      const { content: articleContent } = websiteContent.choices[0].message;

      return this.generatePosts(articleContent!, organizationId);
    }, organizationId);
  }

  /**
   * Separate long content into multiple posts with character limits
   * @param content - Content to separate
   * @param len - Maximum character length per post
   * @param organizationId - Organization ID for database config lookup
   */
  async separatePosts(content: string, len: number, organizationId?: string) {
    const SeparatePostsPrompt = z.object({
      posts: z.array(z.string()),
    });

    const SeparatePostPrompt = z.object({
      post: z.string().max(len),
    });

    return this.executeWithFallback('text', async (client, provider, model) => {
      const posts =
        (
          await client.chat.completions.parse({
            model,
            messages: [
              {
                role: 'system',
                content: `You are an assistant that take a social media post and break it to a thread, each post must be minimum ${
                  len - 10
                } and maximum ${len} characters, keeping the exact wording and break lines, however make sure you split posts based on context`,
              },
              {
                role: 'user',
                content: content,
              },
            ],
            response_format: zodResponseFormat(
              SeparatePostsPrompt,
              'separatePosts'
            ),
          })
        ).choices[0].message.parsed?.posts || [];

      return {
        posts: await Promise.all(
          posts.map(async (post: string) => {
            if (post.length <= len) {
              return post;
            }

            let retries = 4;
            while (retries) {
              try {
                const result = await client.chat.completions.parse({
                  model,
                  messages: [
                    {
                      role: 'system',
                      content: `You are an assistant that take a social media post and shrink it to be maximum ${len} characters, keeping the exact wording and break lines`,
                    },
                    {
                      role: 'user',
                      content: post,
                    },
                  ],
                  response_format: zodResponseFormat(
                    SeparatePostPrompt,
                    'separatePost'
                  ),
                });
                return result.choices[0].message.parsed?.post || '';
              } catch (e) {
                retries--;
              }
            }

            return post;
          })
        ),
      };
    }, organizationId);
  }

  /**
   * Generate slides with image prompts and voice text from text content
   * Uses automatic provider selection with retry logic
   * @param text - Text content to convert to slides
   * @param organizationId - Organization ID for database config lookup
   */
  async generateSlidesFromText(text: string, organizationId?: string) {
    const message = `You are an assistant that takes a text and break it into slides, each slide should have an image prompt and voice text to be later used to generate a video and voice, image prompt should capture the essence of the slide and also have a back dark gradient on top, image prompt should not contain text in the picture, generate between 3-5 slides maximum`;

    return this.executeWithFallback('video-slides', async (client, provider, model) => {
      const result = await client.chat.completions.parse({
        model,
        messages: [
          {
            role: 'system',
            content: message,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        response_format: zodResponseFormat(
          z.object({
            slides: z.array(
              z.object({
                imagePrompt: z.string(),
                voiceText: z.string(),
              })
            ),
          }),
          'slides'
        ),
      });

      return result.choices[0].message.parsed?.slides || [];
    }, organizationId);
  }

  /**
   * Generate audio from text using OpenAI's text-to-speech API
   * Supports OpenAI and OpenAI-compatible endpoints with TTS capability
   * @param text - Text to convert to speech
   * @param voice - Voice ID (alloy, echo, fable, onyx, nova, shimmer)
   * @param model - TTS model (tts-1 or tts-1-hd)
   * @param organizationId - Organization ID for provider lookup
   * @returns Buffer containing the generated audio
   */
  async generateAudioFromText(
    text: string,
    voice: string = 'alloy',
    model: string = 'tts-1',
    organizationId?: string
  ): Promise<Buffer> {
    return this.executeWithFallback('video-slides', async (client, provider) => {
      try {
        // OpenAI TTS API: https://platform.openai.com/docs/api-reference/audio/createSpeech
        const response = await client.audio.speech.create({
          model: model as 'tts-1' | 'tts-1-hd',
          input: text,
          voice: voice as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
          response_format: 'mp3',
        });

        // Convert the response to a buffer
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } catch (error) {
        this.logger.error(`OpenAI TTS error: ${error instanceof Error ? error.message : String(error)}`);
        throw new Error(
          `TTS generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }, organizationId);
  }

  /**
   * Get available TTS voices for OpenAI and compatible providers
   * @returns Array of available voice IDs
   */
  getAvailableVoices(): string[] {
    // Standard OpenAI TTS voices
    // Most OpenAI-compatible endpoints support these same voices
    return ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
  }
}
