import { Global, Module } from '@nestjs/common';
import { LoadToolsService } from '@gitroom/nestjs-libraries/chat/load.tools.service';
import { MastraService } from '@gitroom/nestjs-libraries/chat/mastra.service';
import { toolList } from '@gitroom/nestjs-libraries/chat/tools/tool.list';
import { AITaskConfigService } from '@gitroom/nestjs-libraries/chat/ai-task-config.service';
import { AIProviderAdapterFactory } from '@gitroom/nestjs-libraries/chat/ai-provider-adapter/ai-provider-adapter.factory';

/**
 * Chat Module
 * Provides AI agent and tool services for social media management
 * Includes support for multiple AI providers (OpenAI, Anthropic, custom OpenAI-compatible)
 */
@Global()
@Module({
  providers: [
    MastraService,
    LoadToolsService,
    AITaskConfigService,
    AIProviderAdapterFactory,
    ...toolList,
  ],
  get exports() {
    return this.providers;
  },
})
export class ChatModule {}
