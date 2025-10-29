import {
  Logger,
  Controller,
  Get,
  Post,
  Req,
  Res,
  Query,
  Param,
} from '@nestjs/common';
import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNodeHttpEndpoint,
  copilotRuntimeNextJSAppRouterEndpoint,
} from '@copilotkit/runtime';
import OpenAI from 'openai';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { AIProviderManagerService } from '@gitroom/nestjs-libraries/openai/ai-provider-manager.service';
import { AIProviderDiscoveryService } from '@gitroom/nestjs-libraries/openai/ai-provider-discovery.service';
import { MastraAgent } from '@ag-ui/mastra';
import { MastraService } from '@gitroom/nestjs-libraries/chat/mastra.service';
import { Request, Response } from 'express';
import { RuntimeContext } from '@mastra/core/di';
import { CheckPolicies } from '@gitroom/backend/services/auth/permissions/permissions.ability';
import { AuthorizationActions, Sections } from '@gitroom/backend/services/auth/permissions/permission.exception.class';

/**
 * Context type for Mastra agent runtime
 */
export type ChannelsContext = {
  integrations: string;
  organization: string;
  ui: string;
};

@Controller('/copilot')
export class CopilotController {
  constructor(
    private _subscriptionService: SubscriptionService,
    private readonly providerManager: AIProviderManagerService,
    private readonly discoveryService: AIProviderDiscoveryService,
    private _mastraService: MastraService
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

    // Create OpenAI client with dynamic configuration
    const openaiClient = new OpenAI({
      apiKey,
      baseURL,
    });

    const copilotRuntimeHandler = copilotRuntimeNodeHttpEndpoint({
      endpoint: '/copilot/chat',
      runtime: new CopilotRuntime(),
      serviceAdapter: new OpenAIAdapter({
        // @ts-ignore - OpenAI type signature mismatch with CopilotKit runtime
        openai: openaiClient,
        model,
      }),
    });

    return copilotRuntimeHandler(req, res);
  }

  @Post('/agent')
  @CheckPolicies([AuthorizationActions.Create, Sections.AI])
  async agent(
    @Req() req: Request,
    @Res() res: Response,
    @GetOrgFromRequest() organization: Organization
  ) {
    if (
      process.env.OPENAI_API_KEY === undefined ||
      process.env.OPENAI_API_KEY === ''
    ) {
      Logger.warn('OpenAI API key not set, chat functionality will not work');
      return;
    }
    const mastra = await this._mastraService.mastra();
    const runtimeContext = new RuntimeContext<ChannelsContext>();
    runtimeContext.set(
      'integrations',
      req?.body?.variables?.properties?.integrations || []
    );

    runtimeContext.set('organization', JSON.stringify(organization));
    runtimeContext.set('ui', 'true');

    const agents = MastraAgent.getLocalAgents({
      resourceId: organization.id,
      mastra,
      // @ts-ignore
      runtimeContext,
    });

    const runtime = new CopilotRuntime({
      agents,
    });

    const copilotRuntimeHandler = copilotRuntimeNextJSAppRouterEndpoint({
      endpoint: '/copilot/agent',
      runtime,
      // properties: req.body.variables.properties,
      serviceAdapter: new OpenAIAdapter({
        model: 'gpt-4.1',
      }),
    });

    return copilotRuntimeHandler.handleRequest(req, res);
  }

  @Get('/credits')
  calculateCredits(
    @GetOrgFromRequest() organization: Organization,
    @Query('type') type: 'ai_images' | 'ai_videos'
  ) {
    return this._subscriptionService.checkCredits(
      organization,
      type || 'ai_images'
    );
  }

  @Get('/:thread/list')
  @CheckPolicies([AuthorizationActions.Create, Sections.AI])
  async getMessagesList(
    @GetOrgFromRequest() organization: Organization,
    @Param('thread') threadId: string
  ): Promise<any> {
    const mastra = await this._mastraService.mastra();
    const memory = await mastra.getAgent('postiz').getMemory();
    try {
      return await memory.query({
        resourceId: organization.id,
        threadId,
      });
    } catch (err) {
      return { messages: [] };
    }
  }

  @Get('/list')
  @CheckPolicies([AuthorizationActions.Create, Sections.AI])
  async getList(@GetOrgFromRequest() organization: Organization) {
    const mastra = await this._mastraService.mastra();
    // @ts-ignore
    const memory = await mastra.getAgent('postiz').getMemory();
    const list = await memory.getThreadsByResourceIdPaginated({
      resourceId: organization.id,
      perPage: 100000,
      page: 0,
      orderBy: 'createdAt',
      sortDirection: 'DESC',
    });

    return {
      threads: list.threads.map((p) => ({
        id: p.id,
        title: p.title,
      })),
    };
  }
}
