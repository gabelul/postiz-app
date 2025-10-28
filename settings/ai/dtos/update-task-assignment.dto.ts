/**
 * DTO for updating a task assignment
 * Maps a task type to a specific AI provider and model
 */
export class UpdateTaskAssignmentDto {
  /**
   * The provider ID to assign to this task
   */
  providerId: string;

  /**
   * The model name (e.g., 'gpt-4.1', 'claude-3-opus-20250219', 'dall-e-3')
   */
  model: string;

  /**
   * Optional fallback provider ID if the primary provider fails
   */
  fallbackProviderId?: string;

  /**
   * Optional fallback model name
   */
  fallbackModel?: string;
}
