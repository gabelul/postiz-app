'use client';

import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

/**
 * Bulk Operation Result
 *
 * Summary of a bulk operation execution
 */
export interface BulkOperationResult {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: Array<{ id: string; message: string }>;
}

/**
 * Bulk User Operation Request
 */
export interface BulkUserOperationRequest {
  userIds: string[];
  operation: 'promote' | 'demote' | 'set_quotas' | 'reset_quotas';
  quotas?: Record<string, unknown>;
}

/**
 * Bulk Organization Operation Request
 */
export interface BulkOrganizationOperationRequest {
  organizationIds: string[];
  operation: 'set_tier' | 'set_limits' | 'reset_limits' | 'toggle_billing';
  // Tier values match Prisma SubscriptionTier enum (FREE is special case with no subscription)
  tier?: 'FREE' | 'STANDARD' | 'PRO' | 'TEAM' | 'ULTIMATE';
  limits?: Record<string, unknown>;
  bypassBilling?: boolean;
}

/**
 * CSV Import Result
 */
export interface CsvImportResult {
  totalRows: number;
  imported: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

/**
 * Query key factory for bulk operations
 */
export const bulkOperationsKeys = {
  all: ['admin', 'bulk'] as const,
  export: (params: { take?: number; skip?: number; search?: string }) =>
    [...bulkOperationsKeys.all, 'export', params] as const,
};

/**
 * Hook to bulk promote users to superAdmin
 *
 * @param options - React Query options
 * @returns Mutation result
 *
 * @example
 * ```tsx
 * const bulkPromote = useBulkPromoteUsers();
 *
 * bulkPromote.mutate(
 *   { userIds: ['id1', 'id2'], operation: 'promote' },
 *   { onSuccess: () => toast.success('Users promoted') }
 * );
 * ```
 */
export function useBulkPromoteUsers(
  options?: Omit<
    UseMutationOptions<BulkOperationResult, Error, BulkUserOperationRequest>,
    'mutationFn' | 'mutationKey'
  >
) {
  const fetch = useFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['admin', 'bulk', 'users', 'promote'],
    mutationFn: async (body: BulkUserOperationRequest) => {
      const response = await fetch('/api/admin/bulk/users/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to promote users');
      }
      return response.json() as Promise<BulkOperationResult>;
    },
    onSuccess: (data, variables, ctx) => {
      // Invalidate users list queries
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      // Invalidate dashboard stats
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      options?.onSuccess?.(data, variables, ctx);
    },
    ...options,
  });
}

/**
 * Hook to bulk demote users from superAdmin
 *
 * @param options - React Query options
 * @returns Mutation result
 */
export function useBulkDemoteUsers(
  options?: Omit<
    UseMutationOptions<BulkOperationResult, Error, BulkUserOperationRequest>,
    'mutationFn' | 'mutationKey'
  >
) {
  const fetch = useFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['admin', 'bulk', 'users', 'demote'],
    mutationFn: async (body: BulkUserOperationRequest) => {
      const response = await fetch('/api/admin/bulk/users/demote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to demote users');
      }
      return response.json() as Promise<BulkOperationResult>;
    },
    onSuccess: (data, variables, ctx) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      options?.onSuccess?.(data, variables, ctx);
    },
    ...options,
  });
}

/**
 * Hook to bulk set organization tier
 *
 * @param options - React Query options
 * @returns Mutation result
 */
export function useBulkSetOrganizationTier(
  options?: Omit<
    UseMutationOptions<
      BulkOperationResult,
      Error,
      BulkOrganizationOperationRequest
    >,
    'mutationFn' | 'mutationKey'
  >
) {
  const fetch = useFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['admin', 'bulk', 'organizations', 'tier'],
    mutationFn: async (body: BulkOrganizationOperationRequest) => {
      const response = await fetch('/api/admin/bulk/organizations/tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to set organization tier');
      }
      return response.json() as Promise<BulkOperationResult>;
    },
    onSuccess: (data, variables, ctx) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      options?.onSuccess?.(data, variables, ctx);
    },
    ...options,
  });
}

/**
 * Hook to bulk set organization limits
 *
 * @param options - React Query options
 * @returns Mutation result
 */
export function useBulkSetOrganizationLimits(
  options?: Omit<
    UseMutationOptions<
      BulkOperationResult,
      Error,
      BulkOrganizationOperationRequest
    >,
    'mutationFn' | 'mutationKey'
  >
) {
  const fetch = useFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['admin', 'bulk', 'organizations', 'limits'],
    mutationFn: async (body: BulkOrganizationOperationRequest) => {
      const response = await fetch('/api/admin/bulk/organizations/limits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to set organization limits');
      }
      return response.json() as Promise<BulkOperationResult>;
    },
    onSuccess: (data, variables, ctx) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      options?.onSuccess?.(data, variables, ctx);
    },
    ...options,
  });
}

/**
 * Hook to import users from CSV
 *
 * @param options - React Query options
 * @returns Mutation result
 *
 * @example
 * ```tsx
 * const importUsers = useBulkImportUsers();
 *
 * importUsers.mutate(
 *   { content: csvContent },
 *   { onSuccess: (data) => console.log(`Imported ${data.imported} users`) }
 * );
 * ```
 */
export function useBulkImportUsers(
  options?: Omit<
    UseMutationOptions<CsvImportResult, Error, { content: string }>,
    'mutationFn' | 'mutationKey'
  >
) {
  const fetch = useFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['admin', 'bulk', 'users', 'import'],
    mutationFn: async (body: { content: string }) => {
      const response = await fetch('/api/admin/bulk/users/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to import users');
      }
      return response.json() as Promise<CsvImportResult>;
    },
    onSuccess: (data, variables, ctx) => {
      // Invalidate users list after import
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      options?.onSuccess?.(data, variables, ctx);
    },
    ...options,
  });
}

/**
 * Hook to export users to CSV
 *
 * @param options - React Query options
 * @returns Mutation result that returns CSV content and filename
 */
export function useBulkExportUsers(
  options?: Omit<
    UseMutationOptions<
      { csv: string; filename: string },
      Error,
      { take?: number; skip?: number; search?: string }
    >,
    'mutationFn' | 'mutationKey'
  >
) {
  const fetch = useFetch();

  return useMutation({
    mutationKey: ['admin', 'bulk', 'users', 'export'],
    mutationFn: async (params: {
      take?: number;
      skip?: number;
      search?: string;
    }) => {
      const queryParams = new URLSearchParams();
      if (params.take) queryParams.append('take', String(params.take));
      if (params.skip) queryParams.append('skip', String(params.skip));
      if (params.search) queryParams.append('search', params.search);

      const response = await fetch(
        `/api/admin/bulk/users/export?${queryParams.toString()}`
      );
      if (!response.ok) {
        throw new Error('Failed to export users');
      }
      return response.json() as Promise<{ csv: string; filename: string }>;
    },
    ...options,
  });
}

/**
 * Trigger browser download of CSV content
 *
 * @param csv - CSV content
 * @param filename - Filename for download
 *
 * @example
 * ```tsx
 * const exportUsers = useBulkExportUsers();
 *
 * exportUsers.mutate(
 *   { take: 1000, skip: 0 },
 *   {
 *     onSuccess: (data) => {
 *       downloadCsv(data.csv, data.filename);
 *     }
 *   }
 * );
 * ```
 */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  try {
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
  } finally {
    // Always cleanup, even if click throws
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
