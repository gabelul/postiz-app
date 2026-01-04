import { IsString, IsNotEmpty, IsOptional, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for setting/updating an AI task assignment
 * Validates provider and model selection for specific task types
 */
export class SetTaskAssignmentDto {
  /**
   * Primary provider ID to use for the task
   * Must be a valid, enabled provider for the organization
   */
  @ApiProperty({
    description: 'Primary provider ID for the task',
    example: 'cm5abc123def456',
  })
  @IsString()
  @IsNotEmpty()
  providerId: string;

  /**
   * Model name to use with the primary provider
   * Must be an available model for the selected provider
   */
  @ApiProperty({
    description: 'Model name to use (e.g., gpt-4.1, claude-3-opus)',
    example: 'gpt-4.1',
  })
  @IsString()
  @IsNotEmpty()
  model: string;

  /**
   * Optional fallback provider ID
   * Used when primary provider fails
   * Empty string clears the fallback, undefined leaves it unchanged
   */
  @ApiPropertyOptional({
    description: 'Fallback provider ID (optional)',
    example: 'cm5xyz789ghi012',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  fallbackProviderId?: string;

  /**
   * Fallback model name
   * Required when fallbackProviderId is provided
   */
  @ApiPropertyOptional({
    description: 'Fallback model name',
    example: 'gpt-4o-mini',
    nullable: true,
  })
  @IsString()
  @ValidateIf((o) => o.fallbackProviderId && o.fallbackProviderId.length > 0)
  @IsNotEmpty({
    message: 'Fallback model is required when fallback provider is specified',
  })
  fallbackModel?: string;
}

/**
 * Valid task types for AI task assignments
 */
export const VALID_TASK_TYPES = ['image', 'text', 'video-slides', 'agent'] as const;
export type ValidTaskType = typeof VALID_TASK_TYPES[number];
