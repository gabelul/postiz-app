import { z } from 'zod';

/**
 * Zod Validation Schemas for Admin Panel
 *
 * Provides runtime type validation for all admin-related DTOs.
 * Used to validate request bodies and query parameters before processing.
 */

/**
 * Custom quotas schema for users
 * Allows admins to override system-wide quotas for specific users
 */
export const CustomQuotasSchema = z
  .object({
    posts_per_month: z.number().int().min(0).optional(),
    image_generation_count: z.number().int().min(0).optional(),
    generate_videos: z.number().int().min(0).optional(),
    channels: z.number().int().min(0).optional(),
    webhooks: z.number().int().min(0).optional(),
    team_members: z.number().int().min(0).optional(),
  })
  .strict();

/**
 * Custom limits schema for organizations
 * Allows admins to override system-wide limits for specific organizations
 */
export const CustomLimitsSchema = z
  .object({
    channels: z.number().int().min(0).optional(),
    posts_per_month: z.number().int().min(0).optional(),
    image_generation_count: z.number().int().min(0).optional(),
    generate_videos: z.number().int().min(0).optional(),
    team_members: z.number().int().min(0).optional(),
    webhooks: z.number().int().min(0).optional(),
  })
  .strict();

/**
 * Tier configuration schema
 * Validates tier overrides that can be set via admin panel
 */
export const TierConfigSchema = z
  .object({
    current: z.enum(['FREE', 'STANDARD', 'PRO', 'TEAM', 'ULTIMATE']).optional(),
    month_price: z.number().min(0).optional(),
    year_price: z.number().min(0).optional(),
    channels: z.number().int().min(0).optional(),
    posts_per_month: z.number().int().min(0).optional(),
    image_generation_count: z.number().int().min(0).optional(),
    image_generator: z.boolean().optional(),
    team_members: z.boolean().optional(),
    ai: z.boolean().optional(),
    public_api: z.boolean().optional(),
    webhooks: z.number().int().min(0).optional(),
    autoPost: z.boolean().optional(),
    generate_videos: z.number().int().min(0).optional(),
  })
  .strict();

/**
 * Email settings schema
 * Validates SMTP configuration for the admin panel email settings
 */
export const EmailSettingsSchema = z
  .object({
    // SMTP configuration
    smtp_host: z.string().min(1).max(255).optional(),
    smtp_port: z.number().int().min(1).max(65535).optional(),
    smtp_secure: z.boolean().optional(),
    smtp_user: z.string().email().optional(),
    smtp_pass: z.string().min(1).optional(), // Will be encrypted before storage

    // Email configuration
    from_address: z.string().email().optional(),
    from_name: z.string().min(1).max(255).optional(),

    // Settings
    enabled: z.boolean().optional(),
  })
  .strict();

/**
 * Pagination with search schema
 * Common schema for paginated list endpoints with optional search
 */
export const PaginationWithSearchSchema = z
  .object({
    take: z.string().regex(/^\d+$/).transform(Number).optional(),
    skip: z.string().regex(/^\d+$/).transform(Number).optional(),
    search: z.string().max(100).optional(),
  })
  .strict();

/**
 * Pagination with date range schema
 * Extends pagination with date filtering for reports
 */
export const PaginationWithDateRangeSchema = z
  .object({
    take: z.string().regex(/^\d+$/).transform(Number).optional(),
    skip: z.string().regex(/^\d+$/).transform(Number).optional(),
    search: z.string().max(100).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  })
  .strict();

/**
 * Audit log query schema
 * Validates query parameters for audit log filtering
 */
export const AuditLogQuerySchema = z
  .object({
    action: z.string().max(100).optional(),
    entityType: z.string().max(50).optional(),
    entityId: z.string().uuid().optional(),
    adminId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    offset: z.coerce.number().int().min(0).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  })
  .strict();

/**
 * Bulk operation schema
 * Validates bulk operation requests
 */
export const BulkOperationSchema = z
  .object({
    // Array of entity IDs to operate on
    ids: z.array(z.string().uuid()).min(1).max(1000),

    // Operation to perform
    operation: z.enum(['promote', 'demote', 'delete', 'set_tier', 'set_limits']),

    // Optional operation-specific parameters
    tier: z.enum(['FREE', 'STANDARD', 'PRO', 'TEAM', 'ULTIMATE']).optional(),
    limits: CustomLimitsSchema.optional(),
    quotas: CustomQuotasSchema.optional(),

    // Dry run mode - preview changes without applying
    dryRun: z.boolean().default(false),
  })
  .strict();

/**
 * AI Provider configuration schema
 * Validates AI provider settings
 */
export const AIProviderSchema = z
  .object({
    name: z.string().min(1).max(255),
    type: z.enum(['openai', 'anthropic', 'openai-compatible', 'openrouter', 'gemini', 'ollama']),
    apiKey: z.string().min(1), // Will be encrypted before storage
    baseUrl: z.string().url().optional(),
    customConfig: z.string().optional(), // JSON string for provider-specific settings
    enabled: z.boolean().optional(),
  })
  .strict();

/**
 * AI Provider update schema
 * Same as create but all fields optional
 */
export const AIProviderUpdateSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    type: z.enum(['openai', 'anthropic', 'openai-compatible', 'openrouter', 'gemini', 'ollama']).optional(),
    apiKey: z.string().min(1).optional(),
    baseUrl: z.string().url().optional(),
    customConfig: z.string().optional(),
    enabled: z.boolean().optional(),
  })
  .strict();

/**
 * Maintenance task schema
 * Validates maintenance task configuration
 */
export const MaintenanceTaskSchema = z
  .object({
    name: z.string().min(1).max(100),
    displayName: z.string().min(1).max(255),
    description: z.string().max(1000).optional(),
    cronSchedule: z.string().min(1), // Cron expression
    enabled: z.boolean().optional(),
    config: z.string().optional(), // JSON string for task-specific config
  })
  .strict();

/**
 * Webhook configuration schema
 * Validates admin webhook settings
 */
export const AdminWebhookSchema = z
  .object({
    name: z.string().min(1).max(255),
    url: z.string().url(),
    events: z.array(z.string()).min(1),
    enabled: z.boolean().optional(),
    secret: z.string().min(16).optional(), // Webhook secret for signature verification
  })
  .strict();

/**
 * System setting schema
 * Validates system setting updates
 */
export const SystemSettingSchema = z
  .object({
    key: z.string().min(1).max(255),
    value: z.string().max(10000), // Value will be encrypted if sensitive
    description: z.string().max(500).optional(),
  })
  .strict();

/**
 * Type inference helpers
 * Export inferred TypeScript types from Zod schemas
 */
export type CustomQuotas = z.infer<typeof CustomQuotasSchema>;
export type CustomLimits = z.infer<typeof CustomLimitsSchema>;
export type TierConfig = z.infer<typeof TierConfigSchema>;
export type EmailSettings = z.infer<typeof EmailSettingsSchema>;
export type PaginationWithSearch = z.infer<typeof PaginationWithSearchSchema>;
export type AuditLogQuery = z.infer<typeof AuditLogQuerySchema>;
export type BulkOperation = z.infer<typeof BulkOperationSchema>;
export type AIProvider = z.infer<typeof AIProviderSchema>;
export type AIProviderUpdate = z.infer<typeof AIProviderUpdateSchema>;
export type MaintenanceTask = z.infer<typeof MaintenanceTaskSchema>;
export type AdminWebhook = z.infer<typeof AdminWebhookSchema>;
export type SystemSetting = z.infer<typeof SystemSettingSchema>;

/**
 * Validation helper functions
 * Use these to validate data and throw formatted errors
 */

/**
 * Validate data against a schema and return typed result
 * @param schema - The Zod schema to validate against
 * @param data - The data to validate
 * @returns Validated and typed data
 * @throws BadRequestException with detailed error message
 */
export function validateSchema<T extends z.ZodType>(
  schema: T,
  data: unknown
): z.infer<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    // Format Zod errors into a readable format
    const errors = result.error.errors.map((err) => ({
      path: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));

    throw new Error(
      `Validation failed: ${errors.map((e) => `${e.path} (${e.message})`).join(', ')}`
    );
  }

  return result.data;
}

/**
 * Safely parse JSON with schema validation
 * @param schema - The Zod schema to validate against
 * @param jsonString - The JSON string to parse and validate
 * @returns Validated and typed data
 * @throws Error if JSON is invalid or doesn't match schema
 */
export function parseJsonWithSchema<T extends z.ZodType>(
  schema: T,
  jsonString: string
): z.infer<T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (error) {
    throw new Error('Invalid JSON format');
  }

  return validateSchema(schema, parsed);
}
