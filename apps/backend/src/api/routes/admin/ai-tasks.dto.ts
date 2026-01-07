import { IsString, IsNotEmpty, IsOptional, ValidateIf, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * DTO for round-robin provider entry
 * Used in round-robin mode to specify a provider and model in the rotation
 */
export class RoundRobinProviderDto {
  /**
   * Provider ID for round-robin rotation
   */
  @ApiProperty({
    description: 'Provider ID for round-robin rotation',
    example: 'cm5abc123def456',
  })
  @IsString()
  @IsNotEmpty()
  providerId: string;

  /**
   * Model name to use with this provider
   */
  @ApiProperty({
    description: 'Model name to use (e.g., gpt-4.1, claude-3-opus)',
    example: 'gpt-4.1',
  })
  @IsString()
  @IsNotEmpty()
  model: string;
}

/**
 * Strategy type for provider selection
 * - fallback: Primary provider with optional fallback
 * - round-robin: Multiple providers that rotate in order
 */
export const STRATEGY_TYPES = ['fallback', 'round-robin'] as const;
export type StrategyType = typeof STRATEGY_TYPES[number];

/**
 * DTO for setting/updating an AI task assignment
 * Validates provider and model selection for specific task types
 *
 * Supports two strategies:
 * - fallback: Primary provider with optional fallback provider
 * - round-robin: Multiple providers that rotate in sequence
 */
export class SetTaskAssignmentDto {
  /**
   * Strategy for provider selection
   * - fallback: Use primary provider, fall back to fallback if primary fails
   * - round-robin: Rotate through multiple providers in order
   */
  @ApiPropertyOptional({
    description: 'Provider selection strategy',
    enum: STRATEGY_TYPES,
    default: 'fallback',
  })
  @IsEnum(STRATEGY_TYPES)
  @IsOptional()
  strategy?: StrategyType;

  /**
   * Primary provider ID to use for the task
   * Required for both fallback and round-robin strategies
   * For round-robin, this is the first provider in the rotation
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
   * Required for both fallback and round-robin strategies
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
   * Only used when strategy is 'fallback'
   * Used when primary provider fails
   */
  @ApiPropertyOptional({
    description: 'Fallback provider ID (only for fallback strategy)',
    example: 'cm5xyz789ghi012',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  fallbackProviderId?: string;

  /**
   * Fallback model name
   * Required when fallbackProviderId is provided (fallback strategy)
   */
  @ApiPropertyOptional({
    description: 'Fallback model name (only for fallback strategy)',
    example: 'gpt-4o-mini',
    nullable: true,
  })
  @IsString()
  @ValidateIf((o) => o.strategy === 'fallback' || (!o.strategy && o.fallbackProviderId))
  @IsNotEmpty({
    message: 'Fallback model is required when fallback provider is specified',
  })
  fallbackModel?: string;

  /**
   * Array of providers for round-robin rotation
   * Only used when strategy is 'round-robin'
   * Includes providerId and model for each provider in the rotation
   */
  @ApiPropertyOptional({
    description: 'Providers for round-robin rotation (only for round-robin strategy)',
    type: [RoundRobinProviderDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoundRobinProviderDto)
  @IsOptional()
  roundRobinProviders?: RoundRobinProviderDto[];
}

/**
 * Valid task types for AI task assignments
 */
export const VALID_TASK_TYPES = ['image', 'text', 'video-slides', 'agent'] as const;
export type ValidTaskType = typeof VALID_TASK_TYPES[number];
