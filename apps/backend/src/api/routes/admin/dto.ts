import {
  IsString,
  IsBoolean,
  IsOptional,
  IsObject,
  IsIn,
  Min,
  IsNotEmpty,
  Max,
} from 'class-validator';

/**
 * DTO for pagination with optional search
 * Used for list endpoints that support searching and pagination
 */
export class PaginationWithSearchDto {
  @IsOptional()
  @IsString()
  @Min(0)
  take?: string;

  @IsOptional()
  @IsString()
  @Min(0)
  skip?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

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
  @IsIn(['FREE', 'STANDARD', 'PRO', 'TEAM', 'ULTIMATE'], {
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

  /**
   * isDefault is required with a default value of false.
   * When omitted in the request body, class-validator will use the default.
   * This is intentional - new providers should not be default unless explicitly set.
   */
  @IsBoolean()
  isDefault: boolean = false;

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
