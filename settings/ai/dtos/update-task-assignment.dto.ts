import {
  IsString,
  IsNotEmpty,
  IsDefined,
  IsOptional,
  MinLength,
} from 'class-validator';

/**
 * DTO for updating a task assignment
 * Maps a task type to a specific AI provider and model
 * Validates all inputs to ensure valid provider and model references
 */
export class UpdateTaskAssignmentDto {
  /**
   * The provider ID to assign to this task
   * Must be a non-empty string (UUID format)
   */
  @IsString()
  @IsDefined()
  @IsNotEmpty()
  providerId: string;

  /**
   * The model name (e.g., 'gpt-4.1', 'claude-3-opus-20250219', 'dall-e-3')
   * Must be a non-empty string with minimum 3 characters
   */
  @IsString()
  @IsDefined()
  @IsNotEmpty()
  @MinLength(3)
  model: string;

  /**
   * Optional fallback provider ID if the primary provider fails
   * Must be a valid provider ID if provided
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  fallbackProviderId?: string;

  /**
   * Optional fallback model name
   * Must be a non-empty string with minimum 3 characters if provided
   */
  @IsOptional()
  @IsString()
  @MinLength(3)
  fallbackModel?: string;
}
