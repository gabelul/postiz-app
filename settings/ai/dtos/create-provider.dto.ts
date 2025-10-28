/**
 * DTO for creating a new AI provider configuration
 */
export class CreateProviderDto {
  /**
   * Display name for the provider (e.g., "My OpenAI", "Production Claude")
   */
  name: string;

  /**
   * Provider type: 'openai', 'anthropic', 'gemini', 'ollama', 'together', 'openai-compatible'
   */
  type: string;

  /**
   * API key for the provider (encrypted when stored)
   */
  apiKey: string;

  /**
   * Base URL for custom endpoints (optional, mainly for OpenAI-compatible providers)
   */
  baseUrl?: string;

  /**
   * Custom configuration in JSON format (optional, for provider-specific settings)
   */
  customConfig?: string;

  /**
   * Whether this is the default provider for new tasks
   */
  isDefault?: boolean;
}
