'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

/**
 * Dashboard Statistics
 *
 * System-wide metrics displayed on admin dashboard.
 * Matches the backend DashboardStats response structure.
 */
export interface DashboardStats {
  users: {
    total: number;
    superAdmins: number;
    activeThisMonth: number;
  };
  organizations: {
    total: number;
    withBillingBypass: number;
    activeThisMonth: number;
  };
  subscriptions: {
    total: number;
    byTier: Record<string, number>;
    trial: number;
    paid: number;
  };
  posts: {
    total: number;
    publishedThisMonth: number;
    scheduled: number;
    errors: number;
  };
  integrations: {
    total: number;
    active: number;
  };
  aiProviders: {
    total: number;
    active: number;
  };
  system: {
    version: string;
    uptime: number;
    lastCacheRefresh: string;
  };
}

/**
 * Activity Item
 *
 * Recent admin action for activity timeline.
 */
export interface ActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityName: string;
  adminEmail: string;
  createdAt: string;
}

/**
 * Query key factory for dashboard stats queries
 *
 * Ensures consistent cache keys across the application.
 */
export const adminStatsKeys = {
  all: ['admin', 'stats'] as const,
  dashboard: () => [...adminStatsKeys.all, 'dashboard'] as const,
  activity: (limit: number = 10) =>
    [...adminStatsKeys.all, 'activity', limit] as const,
};

/**
 * Hook to fetch dashboard statistics
 *
 * @param options - React Query options
 * @returns Dashboard stats query result
 *
 * @example
 * ```tsx
 * const { data: stats, isLoading, error } = useAdminStats();
 * if (isLoading) return <Spinner />;
 * if (error) return <ErrorMessage />;
 * return <div>Total Users: {stats.totalUsers}</div>;
 * ```
 */
export function useAdminStats(
  options?: Omit<UseQueryOptions<DashboardStats>, 'queryKey' | 'queryFn'>
) {
  const fetch = useFetch();

  return useQuery({
    queryKey: adminStatsKeys.dashboard(),
    queryFn: async () => {
      const response = await fetch('/api/admin/dashboard/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats');
      }
      return response.json() as Promise<DashboardStats>;
    },
    staleTime: 30000, // 30 seconds
    retry: 1,
    ...options,
  });
}

/**
 * Hook to fetch recent activity
 *
 * @param limit - Number of activity items to fetch (default: 10)
 * @param options - React Query options
 * @returns Activity query result
 */
export function useAdminActivity(
  limit: number = 10,
  options?: Omit<UseQueryOptions<ActivityItem[]>, 'queryKey' | 'queryFn'>
) {
  const fetch = useFetch();

  return useQuery({
    queryKey: adminStatsKeys.activity(limit),
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/dashboard/activity?limit=${limit}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch activity');
      }
      return response.json() as Promise<ActivityItem[]>;
    },
    staleTime: 15000, // 15 seconds - activity changes frequently
    retry: 1,
    ...options,
  });
}

/**
 * Hook to refresh dashboard cache
 *
 * Forces a recalculation of cached statistics.
 * Use after making significant changes that affect dashboard numbers.
 *
 * @param options - React Query options
 * @returns Mutation result
 *
 * @example
 * ```tsx
 * const refreshCache = useRefreshCache();
 *
 * const handleRefresh = () => {
 *   refreshCache.mutate(undefined, {
 *     onSuccess: () => {
 *       toast.success('Dashboard cache refreshed');
 *     }
 *   });
 * };
 * ```
 */
export function useRefreshCache(
  options?: Omit<
    UseMutationOptions<void, Error, void>,
    'mutationFn' | 'mutationKey'
  >
) {
  const fetch = useFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['admin', 'stats', 'refresh'],
    mutationFn: async () => {
      const response = await fetch('/api/admin/dashboard/stats/refresh', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to refresh cache');
      }
    },
    onSuccess: (...args) => {
      // Invalidate dashboard query to fetch fresh data
      queryClient.invalidateQueries({ queryKey: adminStatsKeys.dashboard() });
      options?.onSuccess?.(...args);
    },
    ...options,
  });
}
