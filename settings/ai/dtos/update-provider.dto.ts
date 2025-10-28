import {
  IsString,
  IsOptional,
  IsBoolean,
  MinLength,
  ValidateIf,
  IsJSON,
} from 'class-validator';

/**
 * DTO for updating an AI provider configuration
 * All fields are optional - only provided fields will be updated
 * Validates inputs for security and data integrity
 */
export class UpdateProviderDto {
  /**
   * Display name for the provider (e.g., "My OpenAI", "Production Claude")
   * Optional - can be omitted to keep existing value
   * Must be minimum 3 characters if provided
   */
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  /**
   * API key for the provider (encrypted when stored)
   * Optional - can be omitted to keep existing value
   * When provided, must be minimum 1 character
   * Only required validation for non-Ollama providers
   */
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.apiKey !== undefined && o.type !== 'ollama')
  @MinLength(1)
  apiKey?: string;

  /**
   * Base URL for custom endpoints (optional, mainly for OpenAI-compatible and Ollama providers)
   * If provided, must be a valid URL (HTTPS for remote, HTTP for localhost)
   */
  @IsOptional()
  @IsString()
  baseUrl?: string;

  /**
   * Custom configuration in JSON format (optional, for provider-specific settings)
   * Must be valid JSON if provided
   */
  @IsOptional()
  @IsString()
  @IsJSON()
  customConfig?: string;

  /**
   * Whether this provider is enabled and can be used
   * Optional - can be omitted to keep existing value
   */
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /**
   * Whether this is the default provider for new task assignments
   * Optional - can be omitted to keep existing value
   */
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
