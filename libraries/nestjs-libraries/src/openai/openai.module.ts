import { Module } from '@nestjs/common';
import { OpenaiService } from './openai.service';
import { AIProviderDiscoveryService } from './ai-provider-discovery.service';
import { AIProviderManagerService } from './ai-provider-manager.service';
import { ExtractContentService } from './extract.content.service';
import { FalService } from './fal.service';

/**
 * OpenAI module that provides AI services with multi-provider support
 * Includes automatic provider discovery and rotation capabilities
 */
@Module({
  providers: [
    // Core AI provider services
    AIProviderDiscoveryService,
    AIProviderManagerService,

    // AI service implementations
    OpenaiService,
    ExtractContentService,
    FalService,
  ],
  exports: [
    // Export services for use in other modules
    OpenaiService,
    AIProviderDiscoveryService,
    AIProviderManagerService,
    ExtractContentService,
    FalService,
  ],
})
export class OpenaiModule {}