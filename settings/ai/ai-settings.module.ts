import { Module } from '@nestjs/common';
import { AISettingsService } from './ai-settings.service';
import { AISettingsController } from './ai-settings.controller';

/**
 * Module for AI settings management
 * Provides controllers and services for managing AI provider configurations
 * and task-to-provider assignments
 */
@Module({
  controllers: [AISettingsController],
  providers: [AISettingsService],
  exports: [AISettingsService], // Export service for use in other modules
})
export class AISettingsModule {}
