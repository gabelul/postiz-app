import { Logger } from '@nestjs/common';

/**
 * Centralized JSON parsing utility with error handling
 *
 * Provides safe JSON parsing with fallback values for database-stored JSON strings.
 * Logs warnings (with redacted values) when parsing fails to aid debugging.
 *
 * @example
 * ```typescript
 * import { safeJsonParse } from '@gitroom/nestjs-libraries/utils/json-parse';
 *
 * const config = safeJsonParse(dbRecord.value, {});
 * const limits = safeJsonParse(org.customLimits, defaultLimits);
 * ```
 */

/**
 * Safely parse a JSON string with fallback
 *
 * @template T - The expected return type
 * @param jsonString - The JSON string to parse (can be null, undefined, or invalid JSON)
 * @param fallback - The fallback value to return if parsing fails
 * @param context - Optional context string for logging (e.g., "org.customLimits")
 * @returns Parsed object or fallback value
 *
 * @example
 * ```typescript
 * const limits = safeJsonParse(org.customLimits, { channels: 5 }, 'organization.customLimits');
 * ```
 */
export function safeJsonParse<T>(
  jsonString: string | null | undefined,
  fallback: T,
  context?: string
): T {
  if (!jsonString) {
    return fallback;
  }

  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    // Log warning with redacted value for debugging
    const redacted = jsonString.length > 50
      ? `${jsonString.substring(0, 50)}... (${jsonString.length} chars total)`
      : jsonString;

    const ctx = context ? ` [${context}]` : '';
    Logger.warn(
      `Failed to parse JSON string, using fallback${ctx}. Value: "${redacted}", Error: ${error instanceof Error ? error.message : String(error)}`,
      'safeJsonParse'
    );

    return fallback;
  }
}

/**
 * Parse a JSON array or return empty array
 *
 * @template T - The array element type
 * @param jsonString - The JSON string to parse
 * @param context - Optional context string for logging
 * @returns Parsed array or empty array
 *
 * @example
 * ```typescript
 * const tags = safeJsonParseArray(post.tags, 'post.tags');
 * ```
 */
export function safeJsonParseArray<T>(
  jsonString: string | null | undefined,
  context?: string
): T[] {
  return safeJsonParse<T[]>(jsonString, [], context);
}

/**
 * Parse a JSON object or return empty object
 *
 * @template T - The expected object type
 * @param jsonString - The JSON string to parse
 * @param context - Optional context string for logging
 * @returns Parsed object or empty object
 *
 * @example
 * ```typescript
 * const config = safeJsonObject(provider.customConfig, 'ai-provider.config');
 * ```
 */
export function safeJsonObject<T extends Record<string, any> = Record<string, any>>(
  jsonString: string | null | undefined,
  context?: string
): T {
  return safeJsonParse<T>(jsonString, {} as T, context);
}
