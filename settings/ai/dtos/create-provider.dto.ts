import {
  IsString,
  IsNotEmpty,
  IsDefined,
  IsOptional,
  IsBoolean,
  MinLength,
  IsIn,
  ValidateIf,
} from 'class-validator';

/**
 * DTO for creating a new AI provider configuration
 * Validates all inputs to ensure data integrity and security
 * Supports both authenticated and keyless providers (e.g., Ollama)
 */
export class CreateProviderDto {
  /**
   * Display name for the provider (e.g., "My OpenAI", "Production Claude", "Local Ollama")
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
   * Required for most providers (openai, anthropic, gemini, together)
   * Optional for keyless providers (ollama, openai-compatible with localhost)
   * When provided, must be minimum 1 character to allow flexibility
   *
   * @ValidateIf - Only validated if provider requires authentication
   */
  @IsString()
  @ValidateIf((o) => o.type !== 'ollama')
  @IsNotEmpty()
  @MinLength(1)
  apiKey?: string;

  /**
   * Base URL for custom endpoints (optional, mainly for OpenAI-compatible and Ollama providers)
   * If provided, must be a valid URL (HTTPS for remote, HTTP for localhost)
   * Example: 'http://localhost:11434' for Ollama
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
