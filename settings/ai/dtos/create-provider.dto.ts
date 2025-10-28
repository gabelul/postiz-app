import {
  IsString,
  IsNotEmpty,
  IsDefined,
  IsOptional,
  IsBoolean,
  MinLength,
  IsIn,
  IsUrl,
} from 'class-validator';

/**
 * DTO for creating a new AI provider configuration
 * Validates all inputs to ensure data integrity and security
 */
export class CreateProviderDto {
  /**
   * Display name for the provider (e.g., "My OpenAI", "Production Claude")
   * Must be a non-empty string with minimum 3 characters
   */
  @IsString()
  @IsDefined()
  @IsNotEmpty()
  @MinLength(3)
  name: string;

  /**
   * Provider type: 'openai', 'anthropic', 'gemini', 'ollama', 'together', 'openai-compatible'
   * Must be one of the supported provider types
   */
  @IsString()
  @IsDefined()
  @IsIn(['openai', 'anthropic', 'gemini', 'ollama', 'together', 'openai-compatible'])
  type: string;

  /**
   * API key for the provider (encrypted when stored)
   * Must be a non-empty string with minimum 10 characters
   */
  @IsString()
  @IsDefined()
  @IsNotEmpty()
  @MinLength(10)
  apiKey: string;

  /**
   * Base URL for custom endpoints (optional, mainly for OpenAI-compatible providers)
   * If provided, must be a valid HTTPS URL (HTTP allowed for localhost)
   */
  @IsOptional()
  @IsString()
  baseUrl?: string;

  /**
   * Custom configuration in JSON format (optional, for provider-specific settings)
   * If provided, must be a valid JSON string
   */
  @IsOptional()
  @IsString()
  customConfig?: string;

  /**
   * Whether this is the default provider for new tasks
   * Must be a boolean if provided
   */
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
