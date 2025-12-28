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
 * Organization List Item
 *
 * Simplified organization info for list display.
 */
export interface OrganizationListItem {
  id: string;
  name: string;
  identifier: string;
  subscriptionTier: string;
  customLimits: unknown;
  bypassBilling: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    users: number;
    posts: number;
  };
}

/**
 * Organization Details
 *
 * Complete organization information with all settings.
 */
export interface OrganizationDetails {
  id: string;
  name: string;
  identifier: string;
  subscriptionTier: string;
  customLimits: unknown;
  bypassBilling: boolean;
  createdAt: string;
  updatedAt: string;
  users: Array<{
    id: string;
    role: string;
    user: {
      id: string;
      email: string;
      name: string | null;
    };
  }>;
  _count: {
    users: number;
    posts: number;
  };
}

/**
 * Organizations List Response
 */
export interface OrganizationsListResponse {
  organizations: OrganizationListItem[];
  total: number;
  skip: number;
  take: number;
}

/**
 * Organization Query Filters
 */
export interface OrganizationsQueryParams {
  take?: number;
  skip?: number;
  search?: string;
  tier?: string;
}

/**
 * Set Tier Request
 */
export interface SetTierRequest {
  tier: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
}

/**
 * Set Limits Request
 */
export interface SetLimitsRequest {
  [key: string]: unknown;
}

/**
 * Mutation response for organization actions
 */
interface OrganizationMutationResponse {
  success: boolean;
  message: string;
  organization: OrganizationListItem;
}

/**
 * Query key factory for organization queries
 */
export const adminOrganizationsKeys = {
  all: ['admin', 'organizations'] as const,
  list: (params: OrganizationsQueryParams) =>
    [...adminOrganizationsKeys.all, 'list', params] as const,
  detail: (id: string) =>
    [...adminOrganizationsKeys.all, 'detail', id] as const,
};

/**
 * Hook to fetch organizations list with pagination
 *
 * @param params - Query parameters (take, skip, search, tier)
 * @param options - React Query options
 * @returns Organizations list query result
 */
export function useAdminOrganizations(
  params: OrganizationsQueryParams = {},
  options?: Omit<
    UseQueryOptions<OrganizationsListResponse>,
    'queryKey' | 'queryFn'
  >
) {
  const fetch = useFetch();

  const queryParams = new URLSearchParams();
  if (params.take) queryParams.append('take', String(params.take));
  if (params.skip) queryParams.append('skip', String(params.skip));
  if (params.search) queryParams.append('search', params.search);
  if (params.tier) queryParams.append('tier', params.tier);

  return useQuery({
    queryKey: adminOrganizationsKeys.list(params),
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/organizations?${queryParams.toString()}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch organizations');
      }
      return response.json() as Promise<OrganizationsListResponse>;
    },
    staleTime: 30000,
    ...options,
  });
}

/**
 * Hook to fetch single organization details
 *
 * @param orgId - Organization ID to fetch
 * @param options - React Query options
 * @returns Organization detail query result
 */
export function useAdminOrganization(
  orgId: string,
  options?: Omit<
    UseQueryOptions<OrganizationDetails>,
    'queryKey' | 'queryFn'
  >
) {
  const fetch = useFetch();

  return useQuery({
    queryKey: adminOrganizationsKeys.detail(orgId),
    queryFn: async () => {
      const response = await fetch(`/api/admin/organizations/${orgId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch organization');
      }
      return response.json() as Promise<OrganizationDetails>;
    },
    enabled: !!orgId,
    staleTime: 60000,
    ...options,
  });
}

/**
 * Hook to set organization subscription tier
 *
 * @param options - React Query options
 * @returns Mutation result
 */
export function useSetOrganizationTier(
  options?: Omit<
    UseMutationOptions<
      OrganizationMutationResponse,
      Error,
      { orgId: string; tier: SetTierRequest['tier'] }
    >,
    'mutationFn' | 'mutationKey'
  >
) {
  const fetch = useFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['admin', 'organizations', 'set-tier'],
    mutationFn: async ({ orgId, tier }) => {
      const response = await fetch(`/api/admin/organizations/${orgId}/tier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to set tier');
      }
      return response.json() as Promise<OrganizationMutationResponse>;
    },
    onSuccess: (data, variables, ctx) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      queryClient.invalidateQueries({
        queryKey: adminOrganizationsKeys.detail(variables.orgId),
      });
      options?.onSuccess?.(data, variables, ctx);
    },
    ...options,
  });
}

/**
 * Hook to set custom limits for an organization
 *
 * @param options - React Query options
 * @returns Mutation result
 */
export function useSetOrganizationLimits(
  options?: Omit<
    UseMutationOptions<
      OrganizationMutationResponse,
      Error,
      { orgId: string; limits: SetLimitsRequest }
    >,
    'mutationFn' | 'mutationKey'
  >
) {
  const fetch = useFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['admin', 'organizations', 'set-limits'],
    mutationFn: async ({ orgId, limits }) => {
      const response = await fetch(
        `/api/admin/organizations/${orgId}/limits`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(limits),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to set limits');
      }
      return response.json() as Promise<OrganizationMutationResponse>;
    },
    onSuccess: (data, variables, ctx) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      queryClient.invalidateQueries({
        queryKey: adminOrganizationsKeys.detail(variables.orgId),
      });
      options?.onSuccess?.(data, variables, ctx);
    },
    ...options,
  });
}

/**
 * Hook to toggle billing bypass for an organization
 *
 * @param options - React Query options
 * @returns Mutation result
 */
export function useToggleBillingBypass(
  options?: Omit<
    UseMutationOptions<
      OrganizationMutationResponse,
      Error,
      { orgId: string; bypass: boolean }
    >,
    'mutationFn' | 'mutationKey'
  >
) {
  const fetch = useFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['admin', 'organizations', 'toggle-billing'],
    mutationFn: async ({ orgId, bypass }) => {
      const response = await fetch(
        `/api/admin/organizations/${orgId}/billing-bypass`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bypass }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to toggle billing bypass');
      }
      return response.json() as Promise<OrganizationMutationResponse>;
    },
    onSuccess: (data, variables, ctx) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      queryClient.invalidateQueries({
        queryKey: adminOrganizationsKeys.detail(variables.orgId),
      });
      options?.onSuccess?.(data, variables, ctx);
    },
    ...options,
  });
}

/**
 * Hook to reset organization limits to tier defaults
 *
 * @param options - React Query options
 * @returns Mutation result
 */
export function useResetOrganizationLimits(
  options?: Omit<
    UseMutationOptions<OrganizationMutationResponse, Error, string>,
    'mutationFn' | 'mutationKey'
  >
) {
  const fetch = useFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['admin', 'organizations', 'reset-limits'],
    mutationFn: async (orgId: string) => {
      const response = await fetch(
        `/api/admin/organizations/${orgId}/limits/reset`,
        { method: 'POST' }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to reset limits');
      }
      return response.json() as Promise<OrganizationMutationResponse>;
    },
    onSuccess: (data, variables, ctx) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      queryClient.invalidateQueries({
        queryKey: adminOrganizationsKeys.detail(variables),
      });
      options?.onSuccess?.(data, variables, ctx);
    },
    ...options,
  });
}
