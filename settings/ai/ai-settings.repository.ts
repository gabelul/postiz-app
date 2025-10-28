import { Injectable } from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { AIProvider, AITaskAssignment } from '@prisma/client';

/**
 * Repository for AI settings data access
 * Handles all database operations for AI providers and task assignments
 */
@Injectable()
export class AISettingsRepository {
  constructor(private _prisma: PrismaService) {}

  /**
   * Find a provider by organization and name
   * @param organizationId - Organization ID
   * @param name - Provider name
   * @returns Provider or null if not found
   */
  async findProviderByName(organizationId: string, name: string): Promise<AIProvider | null> {
    return this._prisma.aIProvider.findFirst({
      where: {
        organizationId,
        name,
        deletedAt: null,
      },
    });
  }

  /**
   * Find all providers by type for an organization
   * @param organizationId - Organization ID
   * @param type - Provider type (e.g., 'openai', 'anthropic')
   * @returns Array of providers
   */
  async findProvidersByType(organizationId: string, type: string): Promise<AIProvider[]> {
    return this._prisma.aIProvider.findMany({
      where: {
        organizationId,
        type,
        deletedAt: null,
      },
    });
  }

  /**
   * Find default provider for an organization
   * @param organizationId - Organization ID
   * @returns Default provider or null
   */
  async findDefaultProvider(organizationId: string): Promise<AIProvider | null> {
    return this._prisma.aIProvider.findFirst({
      where: {
        organizationId,
        isDefault: true,
        deletedAt: null,
      },
    });
  }

  /**
   * Get enabled providers for an organization
   * @param organizationId - Organization ID
   * @returns Array of enabled providers
   */
  async findEnabledProviders(organizationId: string): Promise<AIProvider[]> {
    return this._prisma.aIProvider.findMany({
      where: {
        organizationId,
        enabled: true,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Count providers for an organization
   * @param organizationId - Organization ID
   * @returns Count of providers
   */
  async countProviders(organizationId: string): Promise<number> {
    return this._prisma.aIProvider.count({
      where: {
        organizationId,
        deletedAt: null,
      },
    });
  }

  /**
   * Check if a provider is in use by any task assignment
   * @param providerId - Provider ID
   * @returns True if provider is in use
   */
  async isProviderInUse(providerId: string): Promise<boolean> {
    const count = await this._prisma.aITaskAssignment.count({
      where: {
        OR: [
          { providerId },
          { fallbackProviderId: providerId },
        ],
      },
    });
    return count > 0;
  }

  /**
   * Get all task assignments using a specific provider
   * @param providerId - Provider ID
   * @returns Array of task assignments
   */
  async findTaskAssignmentsByProvider(providerId: string): Promise<AITaskAssignment[]> {
    return this._prisma.aITaskAssignment.findMany({
      where: {
        OR: [
          { providerId },
          { fallbackProviderId: providerId },
        ],
      },
    });
  }

  /**
   * Get task type configuration including provider info
   * @param organizationId - Organization ID
   * @param taskType - Task type
   * @returns Complete task configuration
   */
  async getTaskConfiguration(organizationId: string, taskType: string) {
    return this._prisma.aITaskAssignment.findFirst({
      where: {
        organizationId,
        taskType,
      },
      include: {
        provider: true,
        fallbackProvider: true,
      },
    });
  }

  /**
   * Find providers that were recently tested
   * @param organizationId - Organization ID
   * @param hours - Hours back to look (default 24)
   * @returns Array of recently tested providers
   */
  async findRecentlyTestedProviders(
    organizationId: string,
    hours: number = 24
  ): Promise<AIProvider[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this._prisma.aIProvider.findMany({
      where: {
        organizationId,
        lastTestedAt: {
          gte: since,
        },
      },
      orderBy: {
        lastTestedAt: 'desc',
      },
    });
  }

  /**
   * Find providers with failing tests
   * @param organizationId - Organization ID
   * @returns Array of providers with failed tests
   */
  async findFailedProviders(organizationId: string): Promise<AIProvider[]> {
    return this._prisma.aIProvider.findMany({
      where: {
        organizationId,
        testStatus: 'FAILED',
        deletedAt: null,
      },
      orderBy: {
        lastTestedAt: 'desc',
      },
    });
  }

  /**
   * Bulk update providers with test results
   * @param updates - Array of updates with provider ID and test status
   * @returns Number of updated providers
   */
  async bulkUpdateTestResults(
    updates: Array<{
      providerId: string;
      testStatus: 'SUCCESS' | 'FAILED';
      testError?: string;
    }>
  ): Promise<number> {
    const promises = updates.map((update) =>
      this._prisma.aIProvider.update({
        where: { id: update.providerId },
        data: {
          testStatus: update.testStatus,
          testError: update.testError || null,
          lastTestedAt: new Date(),
        },
      })
    );

    const results = await Promise.allSettled(promises);
    return results.filter((r) => r.status === 'fulfilled').length;
  }
}
