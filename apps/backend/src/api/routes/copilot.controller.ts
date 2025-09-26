import { Logger, Controller, Get, Post, Req, Res, Query } from '@nestjs/common';
import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNestEndpoint,
} from '@copilotkit/runtime';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { AIProviderManagerService } from '@gitroom/nestjs-libraries/openai/ai-provider-manager.service';
import { AIProviderDiscoveryService } from '@gitroom/nestjs-libraries/openai/ai-provider-discovery.service';

@Controller('/copilot')
export class CopilotController {
  constructor(
    private _subscriptionService: SubscriptionService,
    private readonly providerManager: AIProviderManagerService,
    private readonly discoveryService: AIProviderDiscoveryService
  ) {}
  /**
   * Handle copilot chat requests with dynamic AI provider selection
   */
  @Post('/chat')
  chat(@Req() req: Request, @Res() res: Response) {
    // Check if any AI providers are configured
    const enabledProviders = this.discoveryService.getEnabledProviders();
    const hasLegacyKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== '';

    if (enabledProviders.size === 0 && !hasLegacyKey) {
      Logger.warn('No AI providers configured, chat functionality will not work');
      return;
    }

    // Determine task type based on request
    const isSimpleTask = req?.body?.variables?.data?.metadata?.requestType === 'TextareaCompletion';
    const taskType = isSimpleTask ? 'fast' : 'smart';

    // Get the appropriate provider and model
    let apiKey: string;
    let baseURL: string | undefined;
    let model: string;

    if (enabledProviders.size > 0) {
      // Use new provider system
      const provider = this.providerManager.getNextProvider({ taskType });
      if (provider) {
        apiKey = provider.key;
        baseURL = provider.url;
        model = this.providerManager.getModelForTask(provider, taskType);
      } else {
        Logger.error('No available AI provider found');
        return;
      }
    } else {
      // Fall back to legacy configuration
      apiKey = process.env.OPENAI_API_KEY!;
      baseURL = process.env.OPENAI_BASE_URL;
      model = isSimpleTask
        ? (process.env.FAST_LLM || 'gpt-4o-mini')
        : (process.env.SMART_LLM || 'gpt-4.1');
    }

    const copilotRuntimeHandler = copilotRuntimeNestEndpoint({
      endpoint: '/copilot/chat',
      runtime: new CopilotRuntime(),
      serviceAdapter: new OpenAIAdapter({
        apiKey,
        baseURL,
        model,
      }),
    });

    // @ts-ignore
    return copilotRuntimeHandler(req, res);
  }

  @Get('/credits')
  calculateCredits(
    @GetOrgFromRequest() organization: Organization,
    @Query('type') type: 'ai_images' | 'ai_videos',
  ) {
    return this._subscriptionService.checkCredits(organization, type || 'ai_images');
  }
}
