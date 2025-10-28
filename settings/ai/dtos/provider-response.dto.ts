/**
 * Safe response DTO for AI Provider
 * Masks sensitive information before sending to frontend
 */
export class ProviderResponseDto {
  /**
   * Unique identifier
   */
  id: string;

  /**
   * Organization ID
   */
  organizationId: string;

  /**
   * Display name for the provider
   */
  name: string;

  /**
   * Provider type (openai, anthropic, gemini, etc.)
   */
  type: string;

  /**
   * Masked API key - shows only last 4 characters
   * Format: ***...XXXX
   */
  apiKey: string; // Masked

  /**
   * Custom base URL (for OpenAI-compatible, Gemini, Ollama, etc.)
   */
  baseUrl?: string;

  /**
   * Whether provider is enabled
   */
  enabled: boolean;

  /**
   * Whether this is the default provider
   */
  isDefault: boolean;

  /**
   * Available models (discovered or cached)
   */
  availableModels?: string[];

  /**
   * Last test status
   */
  testStatus?: string;

  /**
   * Test error message (if test failed)
   */
  testError?: string;

  /**
   * When the provider was last tested
   */
  lastTestedAt?: Date;

  /**
   * When the provider was created
   */
  createdAt: Date;

  /**
   * When the provider was last updated
   */
  updatedAt: Date;

  /**
   * When the provider was deleted (soft delete)
   */
  deletedAt?: Date;
}

/**
 * Mask API key for safe display
 * Shows only the last 4 characters
 * @param apiKey - Full API key (encrypted or plaintext)
 * @returns Masked key like "***...abc123"
 */
export function maskApiKey(apiKey?: string): string {
  if (!apiKey) {
    return '***...';
  }
  if (apiKey.length <= 4) {
    return '***...';
  }
  const last4 = apiKey.slice(-4);
  return `***...${last4}`;
}
