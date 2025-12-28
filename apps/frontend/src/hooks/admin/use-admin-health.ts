'use client';

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

/**
 * System health metrics
 */
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  database: {
    status: 'connected' | 'disconnected';
    latency?: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  stats: {
    totalUsers: number;
    totalOrganizations: number;
    totalPosts: number;
    totalSubscriptions: number;
  };
}

/**
 * AI Provider health status
 */
export interface AiProviderStatus {
  provider: string;
  configured: boolean;
  lastUsed?: string;
  errorCount: number;
}

/**
 * Database health check result
 */
export interface DatabaseHealth {
  status: string;
  latency: number;
}

/**
 * Query key factory for health monitoring
 */
export const healthKeys = {
  all: ['admin', 'health'] as const,
  system: () => [...healthKeys.all, 'system'] as const,
  aiProviders: () => [...healthKeys.all, 'ai-providers'] as const,
  database: () => [...healthKeys.all, 'database'] as const,
};

/**
 * Hook to get system health metrics
 *
 * @param options - React Query options
 * @returns System health query result
 *
 * @example
 * ```tsx
 * const { data: health, isLoading } = useSystemHealth({
 *   refetchInterval: 30000, // Refresh every 30 seconds
 * });
 * ```
 */
export function useSystemHealth(
  options?: Omit<UseQueryOptions<SystemHealth, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: healthKeys.system(),
    queryFn: async () => {
      const response = await fetch('/api/admin/health');
      if (!response.ok) {
        throw new Error('Failed to fetch system health');
      }
      return response.json() as Promise<SystemHealth>;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    ...options,
  });
}

/**
 * Hook to get AI provider health status
 *
 * @param options - React Query options
 * @returns AI provider status query result
 */
export function useAiProviderHealth(
  options?: Omit<UseQueryOptions<AiProviderStatus[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: healthKeys.aiProviders(),
    queryFn: async () => {
      const response = await fetch('/api/admin/health/ai-providers');
      if (!response.ok) {
        throw new Error('Failed to fetch AI provider health');
      }
      return response.json() as Promise<AiProviderStatus[]>;
    },
    refetchInterval: 60000, // Refresh every minute
    ...options,
  });
}

/**
 * Hook to check database health
 *
 * @param options - React Query options
 * @returns Database health query result
 */
export function useDatabaseHealth(
  options?: Omit<UseQueryOptions<DatabaseHealth, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: healthKeys.database(),
    queryFn: async () => {
      const response = await fetch('/api/admin/health/database');
      if (!response.ok) {
        throw new Error('Failed to check database health');
      }
      return response.json() as Promise<DatabaseHealth>;
    },
    refetchInterval: 15000, // Refresh every 15 seconds
    ...options,
  });
}
