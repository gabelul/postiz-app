import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import crypto from 'crypto';

/**
 * Encrypted Settings Service
 *
 * Provides secure storage and retrieval of sensitive configuration values
 * such as SMTP passwords, API keys, and webhook secrets.
 *
 * Uses envelope encryption with a dedicated ENCRYPTION_KEY (or falls back to JWT_SECRET).
 * Sensitive values are encrypted before storing in SystemSettings and decrypted
 * only when needed internally - never returned to the frontend.
 */
@Injectable()
export class EncryptedSettingsService {
  private readonly logger = new Logger(EncryptedSettingsService.name);
  private readonly algorithm = 'aes-256-cbc';
  private readonly encryptionKey: Buffer;
  private readonly keyPrefix = 'encrypted:'; // Prefix to identify encrypted values

  constructor(private readonly _prismaService: PrismaService) {
    // Get encryption key from ENCRYPTION_KEY or fall back to JWT_SECRET
    const keySource = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;

    if (!keySource) {
      throw new Error(
        'ENCRYPTION_KEY or JWT_SECRET must be set for encrypted settings'
      );
    }

    // Derive a 32-byte key from the secret
    this.encryptionKey = crypto.createHash('sha256').update(keySource).digest();
  }

  /**
   * Encrypt a plaintext value
   * @param plaintext - The value to encrypt
   * @returns Hex-encoded encrypted value with prefix
   */
  encrypt(plaintext: string): string {
    try {
      // Generate a random IV for each encryption (better security than fixed IV)
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Return format: encrypted:hexiv:hexencrypted
      return `${this.keyPrefix}${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      this.logger.error(
        `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw new BadRequestException('Failed to encrypt value');
    }
  }

  /**
   * Decrypt an encrypted value
   * @param encryptedValue - The encrypted value (with or without prefix)
   * @returns Decrypted plaintext
   * @throws BadRequestException if decryption fails
   */
  decrypt(encryptedValue: string): string {
    try {
      // Remove prefix if present
      const value = encryptedValue.startsWith(this.keyPrefix)
        ? encryptedValue.slice(this.keyPrefix.length)
        : encryptedValue;

      // Split IV and encrypted data
      const [ivHex, encrypted] = value.split(':');

      if (!ivHex || !encrypted) {
        throw new Error('Invalid encrypted value format');
      }

      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error(
        `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw new BadRequestException('Failed to decrypt value');
    }
  }

  /**
   * Check if a value is encrypted (has the encrypted prefix)
   * @param value - The value to check
   * @returns True if the value is encrypted
   */
  isEncrypted(value: string): boolean {
    return value?.startsWith(this.keyPrefix) ?? false;
  }

  /**
   * Mask a value for frontend display
   * Shows only the last 4 characters for verification purposes
   * @param value - The value to mask (plaintext or encrypted)
   * @returns Masked value (e.g., "********" or "sk_***1234")
   */
  mask(value: string): string {
    if (!value || value.length === 0) {
      return '';
    }

    // If encrypted, we can't show partial - just show masking
    if (this.isEncrypted(value)) {
      return '********';
    }

    // For plaintext values, show last 4 chars if available
    const lastFour = value.slice(-4);
    const prefix = value.startsWith('sk-') ? 'sk-' : value.startsWith('sk_') ? 'sk_' : '';

    return `${prefix}***${lastFour}`;
  }

  /**
   * Store an encrypted setting
   * @param key - The setting key
   * @param value - The plaintext value to encrypt and store
   * @param description - Optional description
   * @param updatedBy - User ID who is updating the setting
   */
  async setEncryptedSetting(
    key: string,
    value: string,
    description?: string,
    updatedBy?: string
  ): Promise<void> {
    const encryptedValue = this.encrypt(value);

    await this._prismaService.systemSettings.upsert({
      where: { key },
      update: {
        value: encryptedValue,
        description,
        updatedBy,
      },
      create: {
        key,
        value: encryptedValue,
        description,
        updatedBy,
      },
    });

    this.logger.log(`Encrypted setting ${key} updated`);
  }

  /**
   * Retrieve and decrypt a setting
   * @param key - The setting key
   * @returns Decrypted value or null if not found
   */
  async getDecryptedSetting(key: string): Promise<string | null> {
    const setting = await this._prismaService.systemSettings.findUnique({
      where: { key },
    });

    if (!setting) {
      return null;
    }

    // If not encrypted (legacy setting), return as-is
    if (!this.isEncrypted(setting.value)) {
      this.logger.warn(`Setting ${key} is not encrypted, consider migrating`);
      return setting.value;
    }

    return this.decrypt(setting.value);
  }

  /**
   * Retrieve a setting with masked value (for frontend)
   * @param key - The setting key
   * @returns Object with masked value or null if not found
   */
  async getMaskedSetting(
    key: string
  ): Promise<{ key: string; value: string; masked: boolean } | null> {
    const setting = await this._prismaService.systemSettings.findUnique({
      where: { key },
    });

    if (!setting) {
      return null;
    }

    const isEncrypted = this.isEncrypted(setting.value);
    return {
      key: setting.key,
      value: this.mask(setting.value),
      masked: true,
    };
  }

  /**
   * Batch get multiple settings with masked values
   * @param keys - Array of setting keys
   * @returns Object mapping keys to masked values
   */
  async getMaskedSettings(
    keys: string[]
  ): Promise<Record<string, { value: string; exists: boolean }>> {
    const settings = await this._prismaService.systemSettings.findMany({
      where: {
        key: { in: keys },
      },
    });

    const result: Record<string, { value: string; exists: boolean }> = {};

    // Initialize all keys as not existing
    for (const key of keys) {
      result[key] = { value: '', exists: false };
    }

    // Fill in existing settings
    for (const setting of settings) {
      result[setting.key] = {
        value: this.mask(setting.value),
        exists: true,
      };
    }

    return result;
  }

  /**
   * Migrate existing plaintext settings to encrypted
   * @param keys - Array of setting keys to migrate
   * @returns Number of settings migrated
   */
  async migrateToEncrypted(keys: string[]): Promise<number> {
    let migrated = 0;

    for (const key of keys) {
      const setting = await this._prismaService.systemSettings.findUnique({
        where: { key },
      });

      if (!setting || this.isEncrypted(setting.value)) {
        continue;
      }

      // Re-encrypt with new value
      await this.setEncryptedSetting(key, setting.value, setting.description);
      migrated++;
    }

    this.logger.log(`Migrated ${migrated} settings to encrypted storage`);
    return migrated;
  }

  /**
   * Decrypt multiple settings at once
   * @param settings - Array of {key, value} objects
   * @returns Array of {key, decryptedValue} objects
   */
  decryptSettings(settings: Array<{ key: string; value: string }>): Array<{
    key: string;
    decryptedValue: string;
  }> {
    return settings.map((setting) => ({
      key: setting.key,
      decryptedValue: this.isEncrypted(setting.value)
        ? this.decrypt(setting.value)
        : setting.value,
    }));
  }

  /**
   * Validate encryption key integrity
   * @returns True if encryption/decryption works correctly
   */
  validateEncryption(): boolean {
    try {
      const testValue = 'test-validation-value';
      const encrypted = this.encrypt(testValue);
      const decrypted = this.decrypt(encrypted);

      return decrypted === testValue;
    } catch (error) {
      this.logger.error(
        `Encryption validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return false;
    }
  }
}
