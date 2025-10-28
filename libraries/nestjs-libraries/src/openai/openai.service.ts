import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { shuffle } from 'lodash';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { AIProviderManagerService } from './ai-provider-manager.service';
import { AIProviderDiscoveryService } from './ai-provider-discovery.service';
import { AITaskType, AIRequestContext } from './interfaces/ai-provider.interface';

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

@Injectable()
export class OpenaiService {
  constructor(
    private readonly providerManager: AIProviderManagerService,
    private readonly discoveryService: AIProviderDiscoveryService
  ) {}

  /**
   * Execute an AI operation with automatic provider selection and retry logic
   * @param taskType - Type of task (smart for complex tasks, fast for simple tasks)
   * @param operation - The operation to execute with the selected provider
   * @param context - Additional context for provider selection
   */
  private async executeWithProvider<T>(
    taskType: AITaskType,
    operation: (client: OpenAI, provider: any, model: string) => Promise<T>,
    context: Partial<AIRequestContext> = {}
  ): Promise<T> {
    const requestContext: AIRequestContext = {
      taskType,
      ...context,
    };

    // Check if we have any configured providers
    const enabledProviders = this.discoveryService.getEnabledProviders();
    if (enabledProviders.size === 0) {
      // Fall back to legacy client if no new providers configured
      const legacyModel = taskType === 'smart'
        ? (process.env.SMART_LLM || 'gpt-4.1')
        : (process.env.FAST_LLM || 'gpt-4o-mini');

      return operation(legacyOpenai, { name: 'LEGACY' }, legacyModel);
    }

    return this.providerManager.executeWithRetry(operation, requestContext);
  }
  /**
   * Generate an image using DALL-E
   * @param prompt - The image generation prompt
   * @param isUrl - Whether to return URL or base64 data
   * @param isVertical - Whether to generate vertical image
   */
  async generateImage(prompt: string, isUrl: boolean, isVertical = false) {
    // Image generation typically requires smart models/providers
    return this.executeWithProvider('smart', async (client, provider, model) => {
      const generate = (
        await client.images.generate({
          prompt,
          response_format: isUrl ? 'url' : 'b64_json',
          model: 'dall-e-3',
          ...(isVertical ? { size: '1024x1792' } : {}),
        })
      ).data[0];

      return isUrl ? generate.url : generate.b64_json;
    });
  }

  /**
   * Generate a detailed prompt for image generation
   * @param prompt - Basic prompt to enhance
   */
  async generatePromptForPicture(prompt: string) {
    return this.executeWithProvider('smart', async (client, provider, model) => {
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
    });
  }

  /**
   * Generate voice text from social media post
   * @param prompt - Social media post content
   */
  async generateVoiceFromText(prompt: string) {
    return this.executeWithProvider('smart', async (client, provider, model) => {
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
    });
  }

  /**
   * Generate social media posts from content
   * @param content - Source content to generate posts from
   */
  async generatePosts(content: string) {
    return this.executeWithProvider('fast', async (client, provider, model) => {
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
    });
  }
  /**
   * Extract article content from website text and generate posts
   * @param content - Full website text content
   */
  async extractWebsiteText(content: string) {
    return this.executeWithProvider('fast', async (client, provider, model) => {
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

      return this.generatePosts(articleContent!);
    });
  }

  /**
   * Separate long content into multiple posts with character limits
   * @param content - Content to separate
   * @param len - Maximum character length per post
   */
  async separatePosts(content: string, len: number) {
    const SeparatePostsPrompt = z.object({
      posts: z.array(z.string()),
    });

    const SeparatePostPrompt = z.object({
      post: z.string().max(len),
    });

    return this.executeWithProvider('smart', async (client, provider, model) => {
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
          posts.map(async (post: any) => {
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
    });
  }

  /**
   * Generate slides with image prompts and voice text from text content
   * Uses automatic provider selection with retry logic
   * @param text - Text content to convert to slides
   */
  async generateSlidesFromText(text: string) {
    const message = `You are an assistant that takes a text and break it into slides, each slide should have an image prompt and voice text to be later used to generate a video and voice, image prompt should capture the essence of the slide and also have a back dark gradient on top, image prompt should not contain text in the picture, generate between 3-5 slides maximum`;

    return this.executeWithProvider('smart', async (client, provider, model) => {
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
    });
  }
}
