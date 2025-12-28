import nodemailer from 'nodemailer';
import { EmailInterface } from '@gitroom/nestjs-libraries/emails/email.interface';

/**
 * SMTP Configuration
 *
 * Configuration options for creating a dynamic SMTP transporter.
 */
export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

/**
 * Dynamic NodeMailer Provider
 *
 * Creates a nodemailer transporter with custom SMTP configuration.
 * Unlike the static NodeMailerProvider, this can be instantiated
 * with dynamic configuration from SystemSettings.
 *
 * This enables admin-configurable email settings without requiring
 * environment variable changes or server restarts.
 */
export class DynamicNodeMailerProvider implements EmailInterface {
  name = 'nodemailer-dynamic';
  validateEnvKeys: string[] = []; // No env keys required for dynamic provider

  private transporter: nodemailer.Transporter;

  /**
   * Constructor
   * @param config - SMTP configuration
   */
  constructor(config: SmtpConfig) {
    // Create transporter with provided config
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }

  /**
   * Verify the SMTP configuration
   *
   * Tests the connection to the SMTP server to verify credentials are correct.
   *
   * @returns Verification result
   */
  async verify(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.transporter.verify();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send an email
   *
   * @param to - Recipient email address
   * @param subject - Email subject
   * @param html - Email HTML content
   * @param emailFromName - Sender name
   * @param emailFromAddress - Sender email address
   * @param replyTo - Optional reply-to address
   * @returns Send result
   */
  async sendEmail(
    to: string,
    subject: string,
    html: string,
    emailFromName: string,
    emailFromAddress: string,
    replyTo?: string
  ) {
    const sends = await this.transporter.sendMail({
      from: `${emailFromName} <${emailFromAddress}>`,
      to: to,
      subject: subject,
      text: html,
      html: html,
      replyTo: replyTo,
    });

    return sends;
  }
}
