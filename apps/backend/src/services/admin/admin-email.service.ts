import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '@gitroom/nestjs-libraries/services/email.service';
import { AdminAuditService } from '@gitroom/backend/services/admin/admin-audit.service';

/**
 * Admin Email Notification Types
 *
 * Defines the types of admin action notifications that can be sent.
 */
export type AdminNotificationType =
  | 'USER_PROMOTE'
  | 'USER_DEMOTE'
  | 'USER_DELETE'
  | 'USER_SET_QUOTAS'
  | 'ORG_SET_TIER'
  | 'ORG_SET_LIMITS'
  | 'ORG_BYPASS_BILLING'
  | 'SETTING_UPDATE'
  | 'SETTING_TIER_UPDATE'
  | 'AI_PROVIDER_CREATE'
  | 'AI_PROVIDER_DELETE'
  | 'BULK_OPERATION';

/**
 * Admin Notification Data
 *
 * Contextual information for the notification.
 */
export interface AdminNotificationData {
  // Target entity information
  entityType: string;
  entityId: string;
  entityName?: string;

  // Action information
  action: string;
  adminEmail: string;

  // Optional: Details about changes
  changes?: Record<string, { before?: unknown; after?: unknown }>;

  // Optional: Additional context
  metadata?: Record<string, unknown>;
}

/**
 * Admin Email Service
 *
 * Manages email notifications for admin actions.
 *
 * Design Principles:
 * - Async notification pattern: actions enqueue notifications, don't send inline
 * - Email templates are generated dynamically based on notification type
 * - Respects user's email notification preferences (future)
 * - Falls back gracefully if email is not configured
 *
 * Usage:
 * ```typescript
 * await adminEmailService.notifyUserPromoted({
 *   entityType: 'USER',
 *   entityId: user.id,
 *   entityName: user.email,
 *   action: 'USER_PROMOTE',
 *   adminEmail: admin.email,
 * });
 * ```
 */
@Injectable()
export class AdminEmailService {
  private readonly logger = new Logger(AdminEmailService.name);

  constructor(
    private readonly _emailService: EmailService,
    private readonly _auditService: AdminAuditService
  ) {}

  /**
   * Send a notification for a user promotion
   * @param data - Notification data
   */
  async notifyUserPromoted(data: AdminNotificationData): Promise<void> {
    await this._sendNotification({
      ...data,
      subject: 'You have been promoted to SuperAdmin',
      template: this._getUserPromotedTemplate(data),
    });
  }

  /**
   * Send a notification for a user demotion
   * @param data - Notification data
   */
  async notifyUserDemoted(data: AdminNotificationData): Promise<void> {
    await this._sendNotification({
      ...data,
      subject: 'Your SuperAdmin privileges have been removed',
      template: this._getUserDemotedTemplate(data),
    });
  }

  /**
   * Send a notification for quota changes
   * @param data - Notification data
   */
  async notifyUserQuotasChanged(data: AdminNotificationData): Promise<void> {
    await this._sendNotification({
      ...data,
      subject: 'Your account quotas have been updated',
      template: this._getQuotasChangedTemplate(data),
    });
  }

  /**
   * Send a notification for organization tier changes
   * @param data - Notification data
   */
  async notifyOrgTierChanged(data: AdminNotificationData): Promise<void> {
    await this._sendNotification({
      ...data,
      subject: 'Your organization tier has been updated',
      template: this._getTierChangedTemplate(data),
    });
  }

  /**
   * Send a notification for organization limit changes
   * @param data - Notification data
   */
  async notifyOrgLimitsChanged(data: AdminNotificationData): Promise<void> {
    await this._sendNotification({
      ...data,
      subject: 'Your organization limits have been updated',
      template: this._getLimitsChangedTemplate(data),
    });
  }

  /**
   * Send a notification for billing bypass status change
   * @param data - Notification data
   */
  async notifyBillingBypassChanged(data: AdminNotificationData): Promise<void> {
    await this._sendNotification({
      ...data,
      subject: 'Your organization billing status has been updated',
      template: this._getBillingBypassTemplate(data),
    });
  }

  /**
   * Send a notification for system settings update
   * @param data - Notification data
   * @param adminEmails - List of admin emails to notify
   */
  async notifySettingsUpdated(
    data: AdminNotificationData,
    adminEmails: string[]
  ): Promise<void> {
    for (const email of adminEmails) {
      await this._sendNotification({
        ...data,
        recipientEmail: email,
        subject: 'System settings have been updated',
        template: this._getSettingsUpdatedTemplate(data),
      });
    }
  }

  /**
   * Send a notification for AI provider changes
   * @param data - Notification data
   * @param adminEmails - List of admin emails to notify
   */
  async notifyAIProviderChanged(
    data: AdminNotificationData,
    adminEmails: string[]
  ): Promise<void> {
    for (const email of adminEmails) {
      await this._sendNotification({
        ...data,
        recipientEmail: email,
        subject: 'AI provider configuration has been updated',
        template: this._getAIProviderChangedTemplate(data),
      });
    }
  }

  /**
   * Send a notification for bulk operations
   * @param data - Notification data
   * @param recipientEmail - Email to notify
   */
  async notifyBulkOperation(
    data: AdminNotificationData,
    recipientEmail: string
  ): Promise<void> {
    await this._sendNotification({
      ...data,
      recipientEmail,
      subject: 'Bulk operation completed',
      template: this._getBulkOperationTemplate(data),
    });
  }

  /**
   * Generic notification sender
   * @param data - Notification data with template
   */
  private async _sendNotification(data: AdminNotificationData & {
    subject: string;
    template: string;
    recipientEmail?: string;
  }): Promise<void> {
    try {
      // Check if email service is configured
      if (!this._emailService.hasProvider()) {
        this.logger.debug('Email service not configured, skipping notification');
        return;
      }

      // Determine recipient (if not specified, try to get from entity)
      let recipientEmail = data.recipientEmail;
      if (!recipientEmail && data.entityType === 'USER') {
        recipientEmail = data.entityName || data.entityId;
      }

      if (!recipientEmail) {
        this.logger.warn('No recipient email for notification');
        return;
      }

      // Send the email
      await this._emailService.sendEmail(
        recipientEmail,
        data.subject,
        data.template
      );

      this.logger.log(
        `Admin notification sent: ${data.action} to ${recipientEmail}`
      );
    } catch (error) {
      // Don't throw - notification failures shouldn't break admin operations
      this.logger.error(
        `Failed to send admin notification: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Template for user promotion notification
   */
  private _getUserPromotedTemplate(data: AdminNotificationData): string {
    return `
      <p>Hello,</p>
      <p>Your account has been promoted to <strong>SuperAdmin</strong>.</p>
      <p><strong>Details:</strong></p>
      <ul>
        <li>Action taken by: ${data.adminEmail}</li>
        <li>Date: ${new Date().toISOString()}</li>
      </ul>
      <p>If you did not expect this change, please contact your system administrator.</p>
    `;
  }

  /**
   * Template for user demotion notification
   */
  private _getUserDemotedTemplate(data: AdminNotificationData): string {
    return `
      <p>Hello,</p>
      <p>Your <strong>SuperAdmin</strong> privileges have been removed.</p>
      <p><strong>Details:</strong></p>
      <ul>
        <li>Action taken by: ${data.adminEmail}</li>
        <li>Date: ${new Date().toISOString()}</li>
      </ul>
      <p>If you believe this is an error, please contact your system administrator.</p>
    `;
  }

  /**
   * Template for quota changes notification
   */
  private _getQuotasChangedTemplate(data: AdminNotificationData): string {
    const changesHtml = data.changes
      ? Object.entries(data.changes)
          .map(([key, value]) => {
            const before = value.before !== undefined ? String(value.before) : 'default';
            const after = value.after !== undefined ? String(value.after) : 'default';
            return `<li>${key}: ${before} → ${after}</li>`;
          })
          .join('')
      : '<li>Quota preferences updated</li>';

    return `
      <p>Hello,</p>
      <p>Your account quotas have been updated.</p>
      <p><strong>Changes:</strong></p>
      <ul>${changesHtml}</ul>
      <p><strong>Details:</strong></p>
      <ul>
        <li>Action taken by: ${data.adminEmail}</li>
        <li>Date: ${new Date().toISOString()}</li>
      </ul>
    `;
  }

  /**
   * Template for tier change notification
   */
  private _getTierChangedTemplate(data: AdminNotificationData): string {
    const tierChange = data.changes?.subscriptionTier;
    const tierHtml = tierChange
      ? `<li>Tier: ${tierChange.before || 'None'} → ${tierChange.after}</li>`
      : '<li>Tier preferences updated</li>';

    return `
      <p>Hello,</p>
      <p>Your organization subscription tier has been updated.</p>
      <p><strong>Changes:</strong></p>
      <ul>${tierHtml}</ul>
      <p><strong>Details:</strong></p>
      <ul>
        <li>Organization: ${data.entityName || data.entityId}</li>
        <li>Action taken by: ${data.adminEmail}</li>
        <li>Date: ${new Date().toISOString()}</li>
      </ul>
    `;
  }

  /**
   * Template for limit changes notification
   */
  private _getLimitsChangedTemplate(data: AdminNotificationData): string {
    const changesHtml = data.changes
      ? Object.entries(data.changes)
          .filter(([key]) => key !== 'customLimits') // Don't show the raw JSON
          .map(([key, value]) => {
            const before = value.before !== undefined ? String(value.before) : 'default';
            const after = value.after !== undefined ? String(value.after) : 'default';
            return `<li>${key}: ${before} → ${after}</li>`;
          })
          .join('')
      : '<li>Limit preferences updated</li>';

    return `
      <p>Hello,</p>
      <p>Your organization limits have been updated.</p>
      <p><strong>Changes:</strong></p>
      <ul>${changesHtml}</ul>
      <p><strong>Details:</strong></p>
      <ul>
        <li>Organization: ${data.entityName || data.entityId}</li>
        <li>Action taken by: ${data.adminEmail}</li>
        <li>Date: ${new Date().toISOString()}</li>
      </ul>
    `;
  }

  /**
   * Template for billing bypass change notification
   */
  private _getBillingBypassTemplate(data: AdminNotificationData): string {
    const bypassChange = data.changes?.bypassBilling;
    const status =
      bypassChange?.after === true
        ? 'enabled'
        : bypassChange?.after === false
          ? 'disabled'
          : 'updated';

    return `
      <p>Hello,</p>
      <p>Your organization billing bypass has been <strong>${status}</strong>.</p>
      <p><strong>Details:</strong></p>
      <ul>
        <li>Organization: ${data.entityName || data.entityId}</li>
        <li>Action taken by: ${data.adminEmail}</li>
        <li>Date: ${new Date().toISOString()}</li>
      </ul>
      <p><strong>Note:</strong> Billing bypass allows your organization to use features without payment verification. This is typically used for internal or testing organizations.</p>
    `;
  }

  /**
   * Template for system settings update notification
   */
  private _getSettingsUpdatedTemplate(data: AdminNotificationData): string {
    return `
      <p>Hello,</p>
      <p>System settings have been updated.</p>
      <p><strong>Details:</strong></p>
      <ul>
        <li>Setting: ${data.entityName || data.entityId}</li>
        <li>Action: ${data.action}</li>
        <li>Action taken by: ${data.adminEmail}</li>
        <li>Date: ${new Date().toISOString()}</li>
      </ul>
    `;
  }

  /**
   * Template for AI provider change notification
   */
  private _getAIProviderChangedTemplate(data: AdminNotificationData): string {
    return `
      <p>Hello,</p>
      <p>AI provider configuration has been updated.</p>
      <p><strong>Details:</strong></p>
      <ul>
        <li>Provider: ${data.entityName || data.entityId}</li>
        <li>Action: ${data.action}</li>
        <li>Action taken by: ${data.adminEmail}</li>
        <li>Date: ${new Date().toISOString()}</li>
      </ul>
    `;
  }

  /**
   * Template for bulk operation notification
   */
  private _getBulkOperationTemplate(data: AdminNotificationData): string {
    return `
      <p>Hello,</p>
      <p>A bulk operation has been completed.</p>
      <p><strong>Details:</strong></p>
      <ul>
        <li>Operation: ${data.action}</li>
        <li>Entity type: ${data.entityType}</li>
        <li>Action taken by: ${data.adminEmail}</li>
        <li>Date: ${new Date().toISOString()}</li>
      </ul>
      ${data.metadata ? `<p><strong>Additional Info:</strong> ${JSON.stringify(data.metadata)}</p>` : ''}
    `;
  }

  /**
   * Get list of admin emails
   *
   * Returns email addresses of all superAdmins.
   * Useful for sending notifications about system changes.
   *
   * @returns Array of admin email addresses
   */
  async getAdminEmails(): Promise<string[]> {
    try {
      // This would query for all superAdmins
      // For now, return empty array - implement when needed
      return [];
    } catch (error) {
      this.logger.error('Failed to get admin emails');
      return [];
    }
  }

  /**
   * Check if notifications are enabled
   *
   * In the future, this would check system settings or user preferences.
   * For now, notifications are enabled if email service is configured.
   *
   * @returns true if notifications are enabled
   */
  areNotificationsEnabled(): boolean {
    return this._emailService.hasProvider();
  }
}
