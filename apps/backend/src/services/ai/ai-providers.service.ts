import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { AIProvider, Prisma } from '@prisma/client';
import OpenAI from 'openai';
import { URL } from 'url';
import { resolve as dnsResolve } from 'node:dns/promises';

/**
 * AI Provider with decrypted API key for internal use
 * Extends AIProvider but explicitly marks apiKey as decrypted string
 */
interface DecryptedAIProvider extends Omit<AIProvider, 'apiKey'> {
  apiKey: string; // decrypted API key
}

/**
 * AI Providers Service
 *
 * Manages AI provider configurations including:
 * - CRUD operations for AI providers
 * - API key encryption/decryption
 * - Provider testing
 * - Model discovery
 */
@Injectable()
export class AIProvidersService {
  private readonly logger = new Logger(AIProvidersService.name);

  // Patterns that should never be allowed in production
  // Note: localhost is allowed in development for Ollama and other local providers
  private readonly BLOCKED_PATTERNS = [
    '169.254.169.254', // AWS metadata endpoint
    'metadata.google.internal', // GCP metadata endpoint
    '100.100.100.200', // GKE metadata endpoint
    '0.0.0.0',
    '[::]',
  ];

  // Provider types that explicitly allow localhost
  private readonly LOCALHOST_ALLOWED_TYPES = ['ollama', 'openai-compatible'];

  constructor(
    private readonly _prismaService: PrismaService,
  ) {}

  /**
   * Validate baseUrl to prevent SSRF attacks including DNS rebinding
   * @param baseUrl - The base URL to validate
   * @param providerType - The provider type (for localhost exceptions)
   * @returns Validation result with error message if invalid
   */
  private async validateBaseUrl(baseUrl: string | undefined, providerType?: string): Promise<{ valid: boolean; error?: string }> {
    if (!baseUrl) {
      return { valid: true }; // Empty baseUrl is fine (will use default)
    }

    try {
      const url = new URL(baseUrl);
      const hostname = url.hostname.toLowerCase();

      // Check for patterns that are NEVER allowed (metadata endpoints)
      for (const blocked of this.BLOCKED_PATTERNS) {
        if (hostname === blocked || hostname.endsWith(`.${blocked}`)) {
          return {
            valid: false,
            error: `Base URL hostname "${hostname}" is not allowed for security reasons`,
          };
        }
      }

      // Check for localhost/127.0.0.1 - only allowed in specific cases
      const isLocalhost = hostname === 'localhost' ||
                           hostname === '127.0.0.1' ||
                           hostname.startsWith('127.0.0.') ||
                           hostname === '::1';

      if (isLocalhost) {
        // Allow localhost in development mode
        if (process.env.NODE_ENV !== 'production') {
          return { valid: true };
        }

        // Allow localhost for specific provider types (Ollama, local instances)
        if (providerType && this.LOCALHOST_ALLOWED_TYPES.includes(providerType)) {
          return { valid: true };
        }

        return {
          valid: false,
          error: `Localhost URLs are not allowed in production. For local AI providers like Ollama, run them behind a proper API gateway.`,
        };
      }

      // Check if hostname is an IP literal (IPv4 or IPv6)
      // If it's already an IP, validate it directly without DNS lookup
      if (this.isPrivateIP(hostname)) {
        return {
          valid: false,
          error: `Base URL hostname is a private IP address (${hostname}), which is not allowed for security reasons`,
        };
      }

      // DNS resolution check to prevent DNS rebinding attacks
      // This ensures a hostname that looks legitimate doesn't resolve to a private IP
      // We check both A (IPv4) and AAAA (IPv6) records
      const isProduction = process.env.NODE_ENV === 'production';
      let hasValidDnsRecord = false;
      let hasNonTransientDnsError = false;

      // Check A records (IPv4)
      try {
        const aRecords = await dnsResolve(hostname, 'A');
        for (const record of aRecords) {
          hasValidDnsRecord = true;
          if (this.isPrivateIP(record)) {
            return {
              valid: false,
              error: `Base URL hostname resolves to a private IP address (${record}), which is not allowed for security reasons`,
            };
          }
        }
      } catch (dnsError) {
        const errorCode = (dnsError as any).code;
        // ENODATA/ENOTFOUND means "no records of this type" - not an error, just no A records
        // Other errors (SERVFAIL, timeout, etc.) are suspicious
        if (errorCode !== 'ENODATA' && errorCode !== 'ENOENT') {
          if (isProduction) {
            hasNonTransientDnsError = true;
            this.logger.error(`DNS A resolution failed for ${hostname} (denied for security): ${dnsError instanceof Error ? dnsError.message : 'Unknown error'}`);
          }
        }
        // In development, log but don't fail on ENODATA
        if (!isProduction) {
          this.logger.warn(`DNS A resolution failed for ${hostname}: ${dnsError instanceof Error ? dnsError.message : 'Unknown error'}`);
        }
      }

      // Check AAAA records (IPv6)
      try {
        const aaaaRecords = await dnsResolve(hostname, 'AAAA');
        for (const record of aaaaRecords) {
          hasValidDnsRecord = true;
          if (this.isPrivateIP(record)) {
            return {
              valid: false,
              error: `Base URL hostname resolves to a private IPv6 address (${record}), which is not allowed for security reasons`,
            };
          }
        }
      } catch (dnsError) {
        const errorCode = (dnsError as any).code;
        // ENODATA/ENOTFOUND means "no records of this type" - not an error, just no AAAA records
        if (errorCode !== 'ENODATA' && errorCode !== 'ENOENT') {
          if (isProduction) {
            hasNonTransientDnsError = true;
            this.logger.error(`DNS AAAA resolution failed for ${hostname} (denied for security): ${dnsError instanceof Error ? dnsError.message : 'Unknown error'}`);
          }
        }
        // In development, log but don't fail on ENODATA
        if (!isProduction) {
          this.logger.warn(`DNS AAAA resolution failed for ${hostname}: ${dnsError instanceof Error ? dnsError.message : 'Unknown error'}`);
        }
      }

      // In production, fail closed only if:
      // 1. We had a non-transient DNS error (SERVFAIL, timeout, etc.), OR
      // 2. Neither A nor AAAA records exist (hostname doesn't resolve)
      if (isProduction) {
        if (hasNonTransientDnsError) {
          return {
            valid: false,
            error: `DNS resolution failed for ${hostname}. The hostname must resolve to a public IP address.`,
          };
        }
        if (!hasValidDnsRecord) {
          return {
            valid: false,
            error: `DNS resolution failed for ${hostname}. The hostname must resolve to a public IP address.`,
          };
        }
      }

      // For non-localhost URLs, ensure HTTPS is used in production
      if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
        // Allow HTTP for known local development domains only
        const isDevDomain = hostname.endsWith('.local') || hostname.endsWith('.localhost');
        if (!isDevDomain) {
          return {
            valid: false,
            error: `Base URL must use HTTPS in production`,
          };
        }
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Invalid base URL format: ${baseUrl}`,
      };
    }
  }

  /**
   * Check if an IP address is in a private/reserved range
   * @param ip - IP address string to check
   * @returns true if IP is private/reserved
   */
  private isPrivateIP(ip: string): boolean {
    const parts = ip.split('.');
    if (parts.length === 4) {
      const [a, b] = parts.map(Number);
      // RFC 1918 private ranges + RFC 3927 link-local + loopback
      return (a === 10) || // 10.0.0.0/8
             (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
             (a === 192 && b === 168) || // 192.168.0.0/16
             (a === 127) || // Loopback (127.0.0.0/8)
             (a === 169 && b === 254) || // Link-local (169.254.0.0/16)
             (a === 0); // "this" network (0.0.0.0/8)
    }

    // IPv6 address checks
    if (ip.includes(':')) {
      const ipLower = ip.toLowerCase();

      // IPv4-mapped IPv6 address (::ffff:0:0/96)
      // Format: ::ffff:w.x.y.z or ::ffff:xxxx:xxxx where last 32 bits are IPv4
      // This is a critical SSRF protection check - an attacker could use ::ffff:127.0.0.1
      // to bypass the IPv4 loopback check
      if (ipLower.startsWith('::ffff:') || ipLower.startsWith('0:0:0:0:0:ffff:')) {
        // Extract the IPv4 portion from the mapped address
        // Format ::ffff:127.0.0.1 or compressed ::ffff:7f00:1 (dotted-quad notation)
        const match = ip.match(/::ffff:([\d.]+)|::ffff:([0-9a-f]+):([0-9a-f]+)$/i);
        if (match) {
          // Dotted-quad format (::ffff:127.0.0.1)
          if (match[1]) {
            return this.isPrivateIP(match[1]);
          }
          // Hex format (::ffff:7f00:1) - convert to IPv4
          if (match[2] && match[3]) {
            const high = parseInt(match[2], 16);
            const low = parseInt(match[3], 16);
            const ipv4 = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
            return this.isPrivateIP(ipv4);
          }
        }
        // Conservative approach: reject all IPv4-mapped addresses if parsing fails
        return true;
      }

      // ULA (fc00::/7) - fc00 to fdff
      if (ipLower.startsWith('fc') || ipLower.startsWith('fd')) {
        return true;
      }
      // Link-local (fe80::/10) - fe80 to febf
      // Check if starts with 'fe' and the third hex digit is 8-9 or a-b
      if (ipLower.startsWith('fe')) {
        const thirdChar = ipLower.charAt(2);
        if (thirdChar === '8' || thirdChar === '9' || thirdChar === 'a' || thirdChar === 'b') {
          return true;
        }
      }
      // Loopback and unspecified
      return ip === '::1' || ip === '::';
    }

    return false;
  }

  /**
   * Get all AI providers for an organization
   * @param organizationId - Organization ID
   * @returns Array of AI providers (with masked API keys)
   */
  async getProviders(organizationId: string): Promise<AIProvider[]> {
    const providers = await this._prismaService.aIProvider.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Mask API keys for security
    return providers.map((p) => this.maskApiKey(p));
  }

  /**
   * Get a single AI provider by ID
   * @param organizationId - Organization ID
   * @param providerId - Provider ID
   * @returns AI provider with masked API key
   * @throws NotFoundException if provider not found
   */
  async getProvider(
    organizationId: string,
    providerId: string
  ): Promise<AIProvider> {
    const provider = await this._prismaService.aIProvider.findFirst({
      where: {
        id: providerId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!provider) {
      throw new NotFoundException('AI provider not found');
    }

    return this.maskApiKey(provider);
  }

  /**
   * Get provider with decrypted API key for internal use
   * @param organizationId - Organization ID
   * @param providerId - Provider ID
   * @returns AI provider with decrypted API key
   */
  async getProviderInternal(
    organizationId: string,
    providerId: string
  ): Promise<DecryptedAIProvider> {
    const provider = await this._prismaService.aIProvider.findFirst({
      where: {
        id: providerId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!provider) {
      throw new NotFoundException('AI provider not found');
    }

    // Decrypt API key for internal use with error handling
    try {
      const decryptedKey = AuthService.fixedDecryption(provider.apiKey);
      return {
        ...provider,
        apiKey: decryptedKey,
      };
    } catch (error) {
      this.logger.error(
        `Failed to decrypt API key for provider ${providerId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw new Error('Failed to decrypt provider API key. The key may be corrupted.');
    }
  }

  /**
   * Create a new AI provider
   * @param organizationId - Organization ID
   * @param data - Provider data
   * @returns Created provider with masked API key
   */
  async createProvider(
    organizationId: string,
    data: {
      name: string;
      type: string;
      apiKey: string;
      baseUrl?: string;
      customConfig?: string;
    }
  ): Promise<AIProvider> {
    // Validate baseUrl for SSRF protection (pass provider type for localhost exceptions)
    if (data.baseUrl) {
      const urlValidation = await this.validateBaseUrl(data.baseUrl, data.type);
      if (!urlValidation.valid) {
        throw new BadRequestException(urlValidation.error);
      }
    }

    // Encrypt API key before storing with error handling
    let encryptedKey: string;
    try {
      encryptedKey = AuthService.fixedEncryption(data.apiKey);
    } catch (error) {
      this.logger.error(
        `Failed to encrypt API key: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw new Error('Failed to encrypt API key. Check your JWT_SECRET configuration.');
    }

    // Use a transaction to prevent race condition on isDefault
    // This ensures only one provider can be marked as default when multiple are created concurrently
    const provider = await this._prismaService.$transaction(async (tx) => {
      // Check count within transaction for consistency
      const existingCount = await tx.aIProvider.count({
        where: { organizationId, deletedAt: null },
      });

      return tx.aIProvider.create({
        data: {
          organizationId,
          name: data.name,
          type: data.type,
          apiKey: encryptedKey,
          baseUrl: data.baseUrl,
          customConfig: data.customConfig,
          isDefault: existingCount === 0,
        },
      });
    });

    this.logger.log(`Created AI provider ${provider.id} for org ${organizationId}`);
    return this.maskApiKey(provider);
  }

  /**
   * Update an existing AI provider
   * @param organizationId - Organization ID
   * @param providerId - Provider ID
   * @param data - Updated provider data
   * @returns Updated provider with masked API key
   */
  async updateProvider(
    organizationId: string,
    providerId: string,
    data: {
      name?: string;
      type?: string;
      apiKey?: string;
      baseUrl?: string;
      customConfig?: string;
      enabled?: boolean;
    }
  ): Promise<AIProvider> {
    // Get existing provider to know its type for baseUrl validation
    const existingProvider = await this.getProviderInternal(organizationId, providerId);
    const providerType = data.type || existingProvider.type;

    // Validate baseUrl for SSRF protection (pass provider type for localhost exceptions)
    if (data.baseUrl !== undefined && data.baseUrl !== null) {
      const urlValidation = await this.validateBaseUrl(data.baseUrl, providerType);
      if (!urlValidation.valid) {
        throw new BadRequestException(urlValidation.error);
      }
    }

    // Prepare update data
    const updateData: Prisma.AIProviderUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.baseUrl !== undefined) updateData.baseUrl = data.baseUrl;
    if (data.customConfig !== undefined) updateData.customConfig = data.customConfig;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;

    // Encrypt new API key if provided with error handling
    // Only update if apiKey is a non-empty string (empty string means "keep existing")
    if (data.apiKey !== undefined && data.apiKey.length > 0) {
      try {
        updateData.apiKey = AuthService.fixedEncryption(data.apiKey);
      } catch (error) {
        this.logger.error(
          `Failed to encrypt API key: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        throw new Error('Failed to encrypt API key. Check your JWT_SECRET configuration.');
      }
    }

    const provider = await this._prismaService.aIProvider.update({
      where: { id: providerId },
      data: updateData,
    });

    this.logger.log(`Updated AI provider ${providerId}`);
    return this.maskApiKey(provider);
  }

  /**
   * Delete an AI provider (soft delete)
   * @param organizationId - Organization ID
   * @param providerId - Provider ID
   */
  async deleteProvider(organizationId: string, providerId: string): Promise<void> {
    // Verify provider exists
    await this.getProvider(organizationId, providerId);

    await this._prismaService.aIProvider.update({
      where: { id: providerId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Deleted AI provider ${providerId}`);
  }

  /**
   * Test a provider configuration
   * @param organizationId - Organization ID
   * @param providerId - Provider ID
   * @returns Test result with success status
   */
  async testProvider(
    organizationId: string,
    providerId: string
  ): Promise<{ valid: boolean; error?: string; models?: string[] }> {
    try {
      const provider = await this.getProviderInternal(organizationId, providerId);

      // Create OpenAI client with provider's configuration
      const client = new OpenAI({
        apiKey: provider.apiKey,
        baseURL: provider.baseUrl || undefined,
      });

      // Test with a simple models list request
      const response = await client.models.list();

      // Update provider with test success
      await this._prismaService.aIProvider.update({
        where: { id: providerId },
        data: {
          testStatus: 'SUCCESS',
          testError: null,
          lastTestedAt: new Date(),
        },
      });

      return {
        valid: true,
        models: response.data.map((m) => m.id).slice(0, 50), // Limit to 50 models
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Update provider with test failure
      await this._prismaService.aIProvider.update({
        where: { id: providerId },
        data: {
          testStatus: 'FAILED',
          testError: errorMessage,
          lastTestedAt: new Date(),
        },
      });

      this.logger.error(`Provider test failed: ${errorMessage}`);
      return { valid: false, error: errorMessage };
    }
  }

  /**
   * Discover available models for a provider
   * @param organizationId - Organization ID
   * @param providerId - Provider ID
   * @returns Discovered models
   */
  async discoverModels(
    organizationId: string,
    providerId: string
  ): Promise<{ success: boolean; models: string[]; error?: string }> {
    try {
      const provider = await this.getProviderInternal(organizationId, providerId);

      const client = new OpenAI({
        apiKey: provider.apiKey,
        baseURL: provider.baseUrl || undefined,
      });

      const response = await client.models.list();
      const models = response.data.map((m) => m.id);

      // Update provider with discovered models
      await this._prismaService.aIProvider.update({
        where: { id: providerId },
        data: {
          availableModels: JSON.stringify(models),
        },
      });

      this.logger.log(`Discovered ${models.length} models for provider ${providerId}`);
      return { success: true, models };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Model discovery failed: ${errorMessage}`);
      return { success: false, models: [], error: errorMessage };
    }
  }

  /**
   * Set a provider as the default for its type
   * Uses a transaction to prevent race conditions
   * @param organizationId - Organization ID
   * @param providerId - Provider ID
   * @returns Updated provider
   */
  async setDefaultProvider(
    organizationId: string,
    providerId: string
  ): Promise<AIProvider> {
    // Use transaction to prevent race condition - ensure only one provider is default at a time
    return this._prismaService.$transaction(async (tx) => {
      const provider = await tx.aIProvider.findFirst({
        where: {
          id: providerId,
          organizationId,
          deletedAt: null,
        },
      });

      if (!provider) {
        throw new NotFoundException('AI provider not found');
      }

      // Unset isDefault for all providers of the same type within the transaction
      await tx.aIProvider.updateMany({
        where: {
          organizationId,
          type: provider.type,
          deletedAt: null,
        },
        data: { isDefault: false },
      });

      // Set this provider as default within the same transaction
      const updated = await tx.aIProvider.update({
        where: { id: providerId },
        data: { isDefault: true },
      });

      this.logger.log(`Set provider ${providerId} as default for type ${provider.type}`);
      return this.maskApiKey(updated);
    });
  }

  /**
   * Mask API key for client responses
   * Shows format: sk_***abcd (last 4 chars visible for verification)
   * @param provider - Provider with full API key
   * @returns Provider with masked API key
   */
  private maskApiKey(provider: AIProvider): AIProvider {
    if (!provider.apiKey || provider.apiKey.length === 0) {
      return {
        ...provider,
        apiKey: '',
      };
    }

    // Show format: sk_***abcd (last 4 chars visible)
    const lastFour = provider.apiKey.slice(-4);
    const prefix = provider.apiKey.startsWith('sk-') ? 'sk-' : provider.apiKey.startsWith('sk_') ? 'sk_' : '';

    return {
      ...provider,
      apiKey: `${prefix}***${lastFour}`,
    };
  }
}
