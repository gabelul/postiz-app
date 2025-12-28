import {
  IsString,
  IsBoolean,
  IsOptional,
  IsObject,
  IsEnum,
  Min,
  IsNotEmpty,
  IsArray,
  ValidateIf,
} from 'class-validator';

/**
 * DTO for setting bypass billing
 */
export class SetBypassBillingDto {
  @IsBoolean()
  bypass!: boolean;
}

/**
 * DTO for setting custom organization limits
 */
export class SetCustomLimitsDto {
  @IsOptional()
  @Min(0)
  channels?: number;

  @IsOptional()
  @Min(0)
  posts_per_month?: number;

  @IsOptional()
  @Min(0)
  image_generation_count?: number;

  @IsOptional()
  @Min(0)
  generate_videos?: number;

  @IsOptional()
  @Min(0)
  team_members?: number;

  @IsOptional()
  @Min(0)
  webhooks?: number;
}

/**
 * DTO for setting subscription tier
 */
export class SetSubscriptionTierDto {
  @IsEnum(['FREE', 'STANDARD', 'PRO', 'TEAM', 'ULTIMATE'], {
    message: 'Tier must be one of: FREE, STANDARD, PRO, TEAM, ULTIMATE',
  })
  tier!: 'FREE' | 'STANDARD' | 'PRO' | 'TEAM' | 'ULTIMATE';
}

/**
 * DTO for system settings
 */
export class CreateSystemSettingDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsString()
  @IsNotEmpty()
  value!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateSystemSettingDto {
  @IsString()
  @IsNotEmpty()
  value!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

/**
 * DTO for feature flags
 */
export class ToggleFeatureDto {
  @IsBoolean()
  enabled!: boolean;
}

/**
 * DTO for AI provider configuration
 */
export class ConfigureAiProviderDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsBoolean()
  @default(false)
  isDefault?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}

/**
 * DTO for user quotas (extends limits DTO)
 */
export class SetUserQuotasDto {
  @IsOptional()
  @Min(0)
  posts_per_month?: number;

  @IsOptional()
  @Min(0)
  image_generation_count?: number;

  @IsOptional()
  @Min(0)
  generate_videos?: number;

  @IsOptional()
  @Min(0)
  channels?: number;
}
