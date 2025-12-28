import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AdminGuard } from '@gitroom/nestjs-libraries/guards/admin.guard';
import { EncryptedSettingsService } from '@gitroom/backend/services/admin/encrypted-settings.service';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { User } from '@prisma/client';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Throttle } from '@nestjs/throttler';
import {
  EmailSettingsSchema,
  type EmailSettings,
} from '@gitroom/backend/validations/admin.schema';
import { EmailService } from '@gitroom/nestjs-libraries/services/email.service';

/**
 * Email Settings Response
 *
 * Returns email settings with sensitive values masked.
 */
export type EmailSettingsResponse = Omit<
  EmailSettings,
  'smtp_pass' | 'enabled'
> & {
  smtp_pass: string; // Masked password
  has_smtp_pass: boolean; // Whether a password is set
  enabled?: boolean;
};

/**
 * Admin Email Settings Controller
 *
 * Manages SMTP email configuration for admin notifications.
 * All endpoints require superAdmin privileges (protected by AdminGuard).
 *
 * Security:
 * - SMTP passwords are encrypted before storage using EncryptedSettingsService
 * - Passwords are never returned in plaintext - only masked versions shown
 * - EmailService reads config dynamically from SystemSettings
 *
 * @see AdminGuard
 * @see EncryptedSettingsService
 * @see EmailService
 */
@ApiTags('Admin - Email Settings')
@Controller('/api/admin/email-settings')
@UseGuards(AdminGuard)
export class AdminEmailSettingsController {
  /**
   * Constructor
   * @param _prismaService - Prisma database service
   * @param _encryptedSettings - Encryption service for sensitive values
   * @param _emailService - Email service for testing and cache management
   */
  constructor(
    private readonly _prismaService: PrismaService,
    private readonly _encryptedSettings: EncryptedSettingsService,
    private readonly _emailService: EmailService
  ) {}

  /**
   * Get current email settings
   *
   * Returns email configuration with sensitive values masked.
   *
   * @returns Email settings with masked password
   *
   * @example
   * GET /api/admin/email-settings
   */
  @Get()
  @ApiOperation({
    summary: 'Get email settings',
    description: 'Retrieve current email configuration (passwords are masked)',
  })
  @ApiResponse({
    status: 200,
    description: 'Email settings with masked password',
    schema: {
      type: 'object',
      properties: {
        smtp_host: { type: 'string' },
        smtp_port: { type: 'number' },
        smtp_secure: { type: 'boolean' },
        smtp_user: { type: 'string' },
        smtp_pass: { type: 'string', description: 'Masked password' },
        has_smtp_pass: { type: 'boolean' },
        from_address: { type: 'string' },
        from_name: { type: 'string' },
        enabled: { type: 'boolean' },
      },
    },
  })
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute
  async getEmailSettings(): Promise<EmailSettingsResponse> {
    const settings = await this._prismaService.systemSettings.findMany({
      where: {
        key: {
          startsWith: 'email.',
        },
      },
    });

    // Build settings object from database
    const emailSettings: Record<string, any> = {};
    for (const setting of settings) {
      const key = setting.key.replace('email.', '');
      emailSettings[key] = setting.value;
    }

    // Check if encrypted password exists
    const encryptedPass = emailSettings.smtp_pass;
    const hasPassword = !!encryptedPass;

    return {
      smtp_host: emailSettings.smtp_host || '',
      smtp_port: emailSettings.smtp_port ? parseInt(emailSettings.smtp_port, 10) : 587,
      smtp_secure: emailSettings.smtp_secure === 'true',
      smtp_user: emailSettings.smtp_user || '',
      smtp_pass: this._encryptedSettings.mask(encryptedPass || ''),
      has_smtp_pass: hasPassword,
      from_address: emailSettings.from_address || '',
      from_name: emailSettings.from_name || '',
      enabled: emailSettings.enabled === 'true',
    };
  }

  /**
   * Update email settings
   *
   * Stores email configuration in SystemSettings.
   * SMTP password is encrypted before storage.
   *
   * @param body - Email settings to save
   * @param user - Authenticated user (for audit trail)
   * @returns Updated settings with masked password
   *
   * @example
   * POST /api/admin/email-settings
   * {
   *   "smtp_host": "smtp.gmail.com",
   *   "smtp_port": 587,
   *   "smtp_secure": false,
   *   "smtp_user": "noreply@example.com",
   *   "smtp_pass": "actual-password-here",
   *   "from_address": "noreply@example.com",
   *   "from_name": "Postiz",
   *   "enabled": true
   * }
   */
  @Post()
  @ApiOperation({
    summary: 'Update email settings',
    description:
      'Save email configuration. SMTP password is encrypted before storage.',
  })
  @ApiResponse({
    status: 200,
    description: 'Settings saved successfully',
  })
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async updateEmailSettings(
    @Body() body: Partial<EmailSettings>,
    @GetUserFromRequest() user: User
  ): Promise<EmailSettingsResponse> {
    // Validate against Zod schema
    const validated = EmailSettingsSchema.partial().safeParse(body);
    if (!validated.success) {
      const errors = validated.error.errors.map(
        (e) => `${e.path.join('.')}: ${e.message}`
      );
      throw new BadRequestException(`Validation failed: ${errors.join(', ')}`);
    }

    // Store each setting individually
    const settingsMap: Record<string, string> = {};

    if (body.smtp_host !== undefined) settingsMap.smtp_host = body.smtp_host;
    if (body.smtp_port !== undefined)
      settingsMap.smtp_port = body.smtp_port.toString();
    if (body.smtp_secure !== undefined)
      settingsMap.smtp_secure = body.smtp_secure.toString();
    if (body.smtp_user !== undefined) settingsMap.smtp_user = body.smtp_user;
    if (body.from_address !== undefined)
      settingsMap.from_address = body.from_address;
    if (body.from_name !== undefined) settingsMap.from_name = body.from_name;
    if (body.enabled !== undefined) settingsMap.enabled = body.enabled.toString();

    // Encrypt password before storing
    if (body.smtp_pass !== undefined && body.smtp_pass.length > 0) {
      settingsMap.smtp_pass = this._encryptedSettings.encrypt(body.smtp_pass);
    }

    // Upsert all settings
    for (const [key, value] of Object.entries(settingsMap)) {
      await this._prismaService.systemSettings.upsert({
        where: { key: `email.${key}` },
        update: {
          value,
          updatedBy: user.id,
        },
        create: {
          key: `email.${key}`,
          value,
          description: `Email configuration: ${key}`,
          updatedBy: user.id,
        },
      });
    }

    // Clear EmailService cache to force reload with new settings
    this._emailService.clearCache();

    // Return updated settings with masked password
    return this.getEmailSettings();
  }

  /**
   * Send a test email
   *
   * Sends a test email to the authenticated user's email address
   * to verify SMTP configuration is working.
   *
   * @param user - Authenticated user (email used as recipient)
   * @returns Test result
   *
   * @example
   * POST /api/admin/email-settings/test
   */
  @Post('test')
  @ApiOperation({
    summary: 'Send test email',
    description:
      'Sends a test email to verify SMTP configuration is working correctly',
  })
  @ApiResponse({
    status: 200,
    description: 'Test email sent successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests per minute (external API)
  async sendTestEmail(@GetUserFromRequest() user: User): Promise<{
    success: boolean;
    message: string;
  }> {
    // First verify the email configuration
    const verification = await this._emailService.verify();

    if (!verification.success) {
      return {
        success: false,
        message: `Email configuration verification failed: ${verification.error || 'Unknown error'}`,
      };
    }

    // Send test email
    try {
      await this._emailService.sendEmail(
        user.email,
        'Postiz Email Test',
        '<p>This is a test email from Postiz. Your email configuration is working correctly!</p>'
      );

      return {
        success: true,
        message: `Test email sent successfully to ${user.email}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to send test email: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Clear email settings
   *
   * Removes all email configuration from SystemSettings.
   * Useful for resetting to defaults or when switching providers.
   *
   * @returns Success response
   *
   * @example
   * POST /api/admin/email-settings/clear
   */
  @Post('clear')
  @ApiOperation({
    summary: 'Clear email settings',
    description: 'Remove all email configuration (resets to defaults)',
  })
  @ApiResponse({
    status: 200,
    description: 'Email settings cleared',
  })
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async clearEmailSettings(): Promise<{
    success: boolean;
    message: string;
  }> {
    // Delete all email.* settings
    await this._prismaService.systemSettings.deleteMany({
      where: {
        key: {
          startsWith: 'email.',
        },
      },
    });

    // Clear EmailService cache
    this._emailService.clearCache();

    return {
      success: true,
      message: 'Email settings cleared successfully',
    };
  }
}
