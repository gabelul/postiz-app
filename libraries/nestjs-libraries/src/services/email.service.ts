import { Injectable, Logger } from '@nestjs/common';
import { EmailInterface } from '@gitroom/nestjs-libraries/emails/email.interface';
import { ResendProvider } from '@gitroom/nestjs-libraries/emails/resend.provider';
import { EmptyProvider } from '@gitroom/nestjs-libraries/emails/empty.provider';
import { NodeMailerProvider } from '@gitroom/nestjs-libraries/emails/node.mailer.provider';
import { DynamicNodeMailerProvider } from '@gitroom/nestjs-libraries/emails/node-mailer-dynamic.provider';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { EncryptedSettingsService } from '@gitroom/backend/services/admin/encrypted-settings.service';

/**
 * Cached Email Provider
 *
 * Stores a provider instance with its configuration hash and expiry time.
 */
interface CachedProvider {
  provider: EmailInterface;
  configHash: string;
  expiresAt: Date;
}

/**
 * Email Configuration
 *
 * Configuration loaded from SystemSettings for dynamic email providers.
 */
interface EmailConfig {
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_pass: string; // Encrypted
  from_address: string;
  from_name: string;
  enabled: boolean;
}

/**
 * Email Service
 *
 * Handles email sending with support for:
 * - Environment-based configuration (legacy)
 * - Dynamic database configuration (admin panel)
 * - Config caching (5-minute TTL)
 * - Multiple provider types (resend, nodemailer, dynamic SMTP)
 *
 * Configuration priority:
 * 1. Database config (email.* in SystemSettings) - if enabled
 * 2. Environment variables (EMAIL_*) - fallback
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  // Cached provider from env-based config
  private envProvider: EmailInterface | null = null;

  // Cached dynamic provider from database config
  private cachedDynamicProvider: CachedProvider | null = null;

  // Cache TTL in milliseconds (default: 5 minutes)
  private readonly cacheTtl: number =
    parseInt(process.env.EMAIL_CONFIG_CACHE_TTL || '300', 10) * 1000;

  constructor(
    private readonly _prismaService?: PrismaService,
    private readonly _encryptedSettings?: EncryptedSettingsService
  ) {
    // Initialize with env-based provider if available
    if (process.env.EMAIL_PROVIDER) {
      this.envProvider = this.selectProvider(process.env.EMAIL_PROVIDER);
      this.logger.log(
        `Email service initialized with env provider: ${this.envProvider.name}`
      );
    } else {
      this.envProvider = new EmptyProvider();
      this.logger.warn('No EMAIL_PROVIDER configured, using empty provider');
    }
  }

  /**
   * Check if a non-empty provider is configured
   * @returns true if a real email provider is available
   */
  hasProvider(): boolean {
    return !(
      this.envProvider instanceof EmptyProvider && !this.cachedDynamicProvider
    );
  }

  /**
   * Select a provider by name (for env-based configuration)
   * @param provider - Provider name (resend, nodemailer)
   * @returns Email provider instance
   */
  selectProvider(provider: string): EmailInterface {
    switch (provider) {
      case 'resend':
        return new ResendProvider();
      case 'nodemailer':
        return new NodeMailerProvider();
      default:
        return new EmptyProvider();
    }
  }

  /**
   * Load email configuration from SystemSettings
   * @returns Email configuration or null if not found
   */
  private async loadConfigFromDatabase(): Promise<EmailConfig | null> {
    if (!this._prismaService) {
      return null;
    }

    try {
      const settings = await this._prismaService.systemSettings.findMany({
        where: {
          key: {
            startsWith: 'email.',
          },
        },
      });

      if (settings.length === 0) {
        return null;
      }

      // Build config object
      const config: Record<string, any> = {};
      for (const setting of settings) {
        const key = setting.key.replace('email.', '');
        config[key] = setting.value;
      }

      // Check if enabled
      if (config.enabled !== 'true') {
        return null;
      }

      // Validate required fields
      if (
        !config.smtp_host ||
        !config.smtp_port ||
        !config.smtp_user ||
        !config.smtp_pass ||
        !config.from_address ||
        !config.from_name
      ) {
        this.logger.warn('Incomplete email configuration in database');
        return null;
      }

      return {
        smtp_host: config.smtp_host,
        smtp_port: parseInt(config.smtp_port, 10),
        smtp_secure: config.smtp_secure === 'true',
        smtp_user: config.smtp_user,
        smtp_pass: config.smtp_pass,
        from_address: config.from_address,
        from_name: config.from_name,
        enabled: config.enabled === 'true',
      };
    } catch (error) {
      this.logger.error(
        `Failed to load email config from database: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return null;
    }
  }

  /**
   * Get or create the dynamic email provider
   * Uses cached provider if still valid, otherwise creates new one
   * @returns Email provider
   */
  private async getDynamicProvider(): Promise<EmailInterface> {
    const now = new Date();

    // Check cache validity
    if (
      this.cachedDynamicProvider &&
      this.cachedDynamicProvider.expiresAt > now
    ) {
      return this.cachedDynamicProvider.provider;
    }

    // Load config from database
    const config = await this.loadConfigFromDatabase();

    if (!config) {
      // No database config, use env-based provider
      return this.envProvider || new EmptyProvider();
    }

    // Create config hash for cache key
    const configHash = JSON.stringify({
      host: config.smtp_host,
      port: config.smtp_port,
      secure: config.smtp_secure,
      user: config.smtp_user,
      // Don't include password in hash to avoid constant re-creation
    });

    // Check if config changed (even if cache not expired)
    if (
      this.cachedDynamicProvider &&
      this.cachedDynamicProvider.configHash === configHash &&
      this.cachedDynamicProvider.expiresAt > now
    ) {
      return this.cachedDynamicProvider.provider;
    }

    // Decrypt password
    let decryptedPass: string;
    try {
      if (!this._encryptedSettings) {
        this.logger.warn('EncryptedSettingsService not available');
        return this.envProvider || new EmptyProvider();
      }
      decryptedPass = this._encryptedSettings.decrypt(config.smtp_pass);
    } catch (error) {
      this.logger.error('Failed to decrypt SMTP password');
      return this.envProvider || new EmptyProvider();
    }

    // Create new dynamic provider
    const provider = new DynamicNodeMailerProvider({
      host: config.smtp_host,
      port: config.smtp_port,
      secure: config.smtp_secure,
      user: config.smtp_user,
      pass: decryptedPass,
    });

    // Cache the provider
    this.cachedDynamicProvider = {
      provider,
      configHash,
      expiresAt: new Date(now.getTime() + this.cacheTtl),
    };

    this.logger.log('Created new dynamic email provider from database config');
    return provider;
  }

  /**
   * Get the current email provider
   *优先级: Database config > Env config > Empty provider
   * @returns Email provider
   */
  private async getProvider(): Promise<EmailInterface> {
    // Try database config first (if PrismaService is available)
    if (this._prismaService) {
      const dynamicProvider = await this.getDynamicProvider();
      if (!(dynamicProvider instanceof EmptyProvider)) {
        return dynamicProvider;
      }
    }

    // Fall back to env-based provider
    return this.envProvider || new EmptyProvider();
  }

  /**
   * Verify the email configuration
   *
   * Tests the current email provider configuration.
   * Useful for the admin panel test email endpoint.
   *
   * @returns Verification result
   */
  async verify(): Promise<{ success: boolean; error?: string; provider?: string }> {
    try {
      const provider = await this.getProvider();

      if (provider instanceof EmptyProvider) {
        return {
          success: false,
          error: 'No email provider configured',
          provider: 'none',
        };
      }

      if (provider instanceof DynamicNodeMailerProvider) {
        return {
          ...(await provider.verify()),
          provider: 'dynamic-smtp',
        };
      }

      // For other providers (resend), assume valid if configured
      return {
        success: true,
        provider: provider.name,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Invalidate the config cache
   *
   * Forces a reload of email configuration on next send.
   * Useful after updating settings in the admin panel.
   */
  clearCache(): void {
    this.cachedDynamicProvider = null;
    this.logger.log('Email config cache cleared');
  }

  /**
   * Send an email
   *
   * @param to - Recipient email address
   * @param subject - Email subject
   * @param html - Email HTML content
   * @param replyTo - Optional reply-to address
   */
  async sendEmail(
    to: string,
    subject: string,
    html: string,
    replyTo?: string
  ): Promise<void> {
    // Validate email
    if (to.indexOf('@') === -1) {
      this.logger.warn(`Invalid email address: ${to}`);
      return;
    }

    // Get provider (database config takes precedence over env)
    const provider = await this.getProvider();

    // Get sender info (database config takes precedence)
    let fromName = process.env.EMAIL_FROM_NAME || 'Postiz';
    let fromAddress = process.env.EMAIL_FROM_ADDRESS || 'noreply@postiz.com';

    // Try to get sender info from database config
    const dbConfig = await this.loadConfigFromDatabase();
    if (dbConfig) {
      fromName = dbConfig.from_name;
      fromAddress = dbConfig.from_address;
    }

    if (!fromAddress) {
      this.logger.warn('Email sender address not configured');
      return;
    }

    // Wrap HTML in styled template
    const modifiedHtml = `
    <div style="
        background: linear-gradient(to bottom right, #e6f2ff, #f0e6ff);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
    ">
        <div style="
            background-color: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(4px);
            border-radius: 0.5rem;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            max-width: 48rem;
            width: 100%;
            padding: 2rem;
        ">
            <h1 style="
                font-size: 1.875rem;
                font-weight: bold;
                margin-bottom: 1.5rem;
                text-align: left;
                color: #1f2937;
            ">${subject}</h1>

            <div style="
                margin-bottom: 2rem;
                color: #374151;
            ">
                ${html}
            </div>

            <div style="
                display: flex;
                align-items: center;
                border-top: 1px solid #e5e7eb;
                padding-top: 1.5rem;
            ">
                <div>
                    <h2 style="
                        font-size: 1.25rem;
                        font-weight: 600;
                        color: #1f2937;
                        margin: 0;
                    ">${fromName}</h2>
                </div>
            </div>
        </div>
    </div>
    `;

    try {
      const result = await provider.sendEmail(
        to,
        subject,
        modifiedHtml,
        fromName,
        fromAddress,
        replyTo
      );
      this.logger.log(`Email sent to ${to}:`, result);
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}:`, err);
      throw err;
    }
  }
}
