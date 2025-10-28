import { Module } from '@nestjs/common';
import { AISettingsService } from './ai-settings.service';
import { AISettingsController } from './ai-settings.controller';
import { ModelDiscoveryService } from './model-discovery.service';

/**
 * Module for AI settings management
 * Provides controllers and services for managing AI provider configurations
 * and task-to-provider assignments, including model discovery
 */
@Module({
  controllers: [AISettingsController],
  providers: [AISettingsService, ModelDiscoveryService],
  exports: [AISettingsService, ModelDiscoveryService], // Export services for use in other modules
})
export class AISettingsModule {}
