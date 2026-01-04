import { OpenaiService } from '@gitroom/nestjs-libraries/openai/openai.service';
import {
  ExposeVideoFunction,
  URL,
  Video,
  VideoAbstract,
} from '@gitroom/nestjs-libraries/videos/video.interface';
import { chunk } from 'lodash';
import Transloadit from 'transloadit';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import { Readable } from 'stream';
import { parseBuffer } from 'music-metadata';
import { stringifySync } from 'subtitle';

import pLimit from 'p-limit';
import { ImageGenerationService } from '@gitroom/nestjs-libraries/openai/image-generation.service';
import { TTSService } from '@gitroom/nestjs-libraries/openai/tts.service';
import { IsString } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
const limit = pLimit(2);

const transloadit = new Transloadit({
  authKey: process.env.TRANSLOADIT_AUTH || 'just empty text',
  authSecret: process.env.TRANSLOADIT_SECRET || 'just empty text',
});

async function getAudioDuration(buffer: Buffer): Promise<number> {
  const metadata = await parseBuffer(buffer, 'audio/mpeg');
  return metadata.format.duration || 0;
}

class ImagesSlidesParams {
  @JSONSchema({
    description: 'Elevenlabs voice id, use a special tool to get it, this is a required filed',
  })
  @IsString()
  voice: string;

  @JSONSchema({
    description: 'Simple string of the prompt, not a json',
  })
  @IsString()
  prompt: string;
}

@Video({
  identifier: 'image-text-slides',
  title: 'Image Text Slides',
  description: 'Generate videos slides from images and text, Don\'t break down the slides, provide only the first slide information',
  placement: 'text-to-image',
  tools: [{ functionName: 'loadVoices', output: 'voice id' }],
  dto: ImagesSlidesParams,
  trial: true,
  available:
    !!process.env.ELEVENSLABS_API_KEY &&
    !!process.env.TRANSLOADIT_AUTH &&
    !!process.env.TRANSLOADIT_SECRET &&
    !!process.env.OPENAI_API_KEY &&
    !!process.env.FAL_KEY,
})
export class ImagesSlides extends VideoAbstract<ImagesSlidesParams> {
  override dto = ImagesSlidesParams;
  private storage = UploadFactory.createStorage();
  constructor(
    private _openaiService: OpenaiService,
    private _imageGenerationService: ImageGenerationService,
    private _ttsService: TTSService
  ) {
    super();
  }

  /**
   * Process video slides generation from text
   * @param output - Video orientation (vertical or horizontal)
   * @param customParams - Slide parameters (prompt and voice)
   * @param organizationId - Organization ID for AI provider selection
   * @returns URL of the generated video
   */
  async process(
    output: 'vertical' | 'horizontal',
    customParams: ImagesSlidesParams,
    organizationId?: string
  ): Promise<URL> {
    const list = await this._openaiService.generateSlidesFromText(
      customParams.prompt,
      organizationId
    );

    // Enforce maximum slide count to prevent unbounded operations
    const maxSlides = 5;
    const slidesToProcess = list.slice(0, maxSlides);

    if (list.length > maxSlides) {
      console.warn(`LLM returned ${list.length} slides, limiting to ${maxSlides} for performance and cost reasons`);
    }

    // Generate images and audio for each slide in parallel
    // This significantly improves performance compared to sequential processing
    const slidePromises = slidesToProcess.map(async (current, index) => {
      // Generate image and audio in parallel for each slide
      const [imageResult, audioBuffer] = await Promise.all([
        // Image generation
        (async () => {
          try {
            return {
              len: 0,
              url: await this._imageGenerationService.generateImage(
                current.imagePrompt,
                organizationId, // Pass undefined (not empty string) for env fallback
                {
                  isUrl: true,
                  isVertical: output === 'vertical',
                  model: 'ideogram/v2', // Default model, will be overridden by provider config
                }
              ),
            };
          } catch (error) {
            throw new Error(`Failed to generate image for slide: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        })(),
        // Audio generation with concurrency limiting
        (async () => {
          try {
            return await limit(() =>
              this._ttsService.generateAudio(
                current.voiceText,
                customParams.voice,
                organizationId // Pass undefined (not empty string) for env fallback
              )
            );
          } catch (error) {
            throw new Error(`Failed to generate audio for slide: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        })(),
      ]);

      // Upload audio to storage
      const { path } = await this.storage.uploadFile({
        buffer: audioBuffer,
        mimetype: 'audio/mp3',
        size: audioBuffer.length,
        path: '',
        fieldname: '',
        destination: '',
        stream: new Readable(),
        filename: '',
        originalname: '',
        encoding: '',
      });

      return {
        image: imageResult,
        audio: {
          len: await getAudioDuration(audioBuffer),
          url:
            path.indexOf('http') === -1
              ? process.env.FRONTEND_URL +
                '/' +
                process.env.NEXT_PUBLIC_UPLOAD_STATIC_DIRECTORY +
                path
              : path,
        },
      };
    });

    // Wait for all slides to complete processing
    const slideResults = await Promise.all(slidePromises);

    // Flatten results into the format expected by downstream code
    const allPromises: Array<{ len: number; url: string }> = [];
    for (const result of slideResults) {
      allPromises.push(result.image, result.audio);
    }

    const generated = allPromises;

    const split = chunk(generated, 2);

    const srt = stringifySync(
      slidesToProcess
        .reduce((all, current, index) => {
          const start = all.length ? all[all.length - 1].end : 0;
          const end = start + split[index][1].len * 1000 + 1000;
          all.push({
            start: start,
            end: end,
            text: current.voiceText,
          });

          return all;
        }, [] as { start: number; end: number; text: string }[])
        .map((item) => ({
          type: 'cue',
          data: item,
        })),
      { format: 'SRT' }
    );

    const { results } = await transloadit.createAssembly({
      uploads: {
        'subtitles.srt': srt,
      },
      waitForCompletion: true,
      params: {
        steps: {
          ...split.reduce((all, current, index) => {
            all[`image${index}`] = {
              robot: '/http/import',
              url: current[0].url,
            };
            all[`audio${index}`] = {
              robot: '/http/import',
              url: current[1].url,
            };
            all[`merge${index}`] = {
              use: [
                {
                  name: `image${index}`,
                  as: 'image',
                },
                {
                  name: `audio${index}`,
                  as: 'audio',
                },
              ],
              robot: '/video/merge',
              duration: current[1].len + 1,
              audio_delay: 0.5,
              preset: 'hls-1080p',
              resize_strategy: 'min_fit',
              loop: true,
            };
            return all;
          }, {} as any),
          concatenated: {
            robot: '/video/concat',
            result: false,
            video_fade_seconds: 0.5,
            use: split.map((p, index) => ({
              name: `merge${index}`,
              as: `video_${index + 1}`,
            })),
          },
          subtitled: {
            robot: '/video/subtitle',
            result: true,
            preset: 'hls-1080p',
            use: {
              bundle_steps: true,
              steps: [
                {
                  name: 'concatenated',
                  as: 'video',
                },
                {
                  name: ':original',
                  as: 'subtitles',
                },
              ],
            },
            position: 'center',
            font_size: 8,
            subtitles_type: 'burned',
          },
        },
      },
    });

    return results.subtitled[0].url;
  }

  @ExposeVideoFunction()
  async loadVoices(data: any) {
    // Extract organizationId from data if available for provider-aware voice lookup
    const organizationId = data?.organizationId;

    // Use TTS service for provider-aware voice listing
    // Returns voices from the configured provider (OpenAI, ElevenLabs, etc.)
    const voices = await this._ttsService.getVoices(organizationId || '');

    return {
      voices: voices.map((voice) => ({
        id: voice.id,
        name: voice.name,
        preview_url: voice.preview_url,
      })),
    };
  }
}
