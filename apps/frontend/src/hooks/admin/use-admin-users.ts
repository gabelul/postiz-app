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
 * User Organization Reference
 *
 * Nested organization data for user list display.
 */
export interface UserOrganization {
  id: string;
  role: string;
  disabled: boolean;
  organization: {
    id: string;
    name: string;
  };
}

/**
 * User Model
 *
 * Complete user information including organizations.
 */
export interface User {
  id: string;
  email: string;
  name: string | null;
  lastName: string | null;
  bio: string | null;
  pictureId: string | null;
  isSuperAdmin: boolean;
  customQuotas: unknown;
  lastOnline: string | null;
  connectedAccount: boolean;
  createdAt: string;
  updatedAt: string;
  activated: boolean;
  marketplace: boolean;
  organizations: UserOrganization[];
}

/**
 * User List Item
 *
 * Simplified user info for list display.
 */
export interface UserListItem {
  id: string;
  email: string;
  name: string | null;
  isSuperAdmin: boolean;
  createdAt: string;
  organizations: UserOrganization[];
}

/**
 * Users List Response
 *
 * Paginated response from users list endpoint.
 */
export interface UsersListResponse {
  users: UserListItem[];
  total: number;
  skip: number;
  take: number;
}

/**
 * User Query Filters
 *
 * Options for filtering/paginating users.
 */
export interface UsersQueryParams {
  take?: number;
  skip?: number;
  search?: string;
}

/**
 * Quota Update Request
 *
 * Custom quotas to apply to a user.
 */
export interface SetUserQuotasRequest {
  [key: string]: unknown;
}

/**
 * Mutation response for promote/demote actions
 */
interface UserMutationResponse {
  success: boolean;
  message: string;
  user: UserListItem;
}

/**
 * Query key factory for user queries
 */
export const adminUsersKeys = {
  all: ['admin', 'users'] as const,
  list: (params: UsersQueryParams) =>
    [...adminUsersKeys.all, 'list', params] as const,
  detail: (id: string) => [...adminUsersKeys.all, 'detail', id] as const,
};

/**
 * Hook to fetch users list with pagination
 *
 * @param params - Query parameters (take, skip, search)
 * @param options - React Query options
 * @returns Users list query result
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useAdminUsers({ take: 20, skip: 0 });
 * ```
 */
export function useAdminUsers(
  params: UsersQueryParams = {},
  options?: Omit<
    UseQueryOptions<UsersListResponse>,
    'queryKey' | 'queryFn'
  >
) {
  const fetch = useFetch();

  const queryParams = new URLSearchParams();
  if (params.take) queryParams.append('take', String(params.take));
  if (params.skip) queryParams.append('skip', String(params.skip));
  if (params.search) queryParams.append('search', params.search);

  return useQuery({
    queryKey: adminUsersKeys.list(params),
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/users?${queryParams.toString()}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      return response.json() as Promise<UsersListResponse>;
    },
    staleTime: 30000,
    ...options,
  });
}

/**
 * Hook to fetch single user details
 *
 * @param userId - User ID to fetch
 * @param options - React Query options
 * @returns User detail query result
 */
export function useAdminUser(
  userId: string,
  options?: Omit<UseQueryOptions<User>, 'queryKey' | 'queryFn'>
) {
  const fetch = useFetch();

  return useQuery({
    queryKey: adminUsersKeys.detail(userId),
    queryFn: async () => {
      const response = await fetch(`/api/admin/users/${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch user');
      }
      return response.json() as Promise<User>;
    },
    enabled: !!userId,
    staleTime: 60000,
    ...options,
  });
}

/**
 * Hook to promote user to superAdmin
 *
 * @param options - React Query options
 * @returns Mutation result
 *
 * @example
 * ```tsx
 * const promoteUser = usePromoteUser();
 *
 * promoteUser.mutate(userId, {
 *   onSuccess: () => {
 *     toast.success('User promoted to superAdmin');
 *   }
 * });
 * ```
 */
export function usePromoteUser(
  options?: Omit<
    UseMutationOptions<UserMutationResponse, Error, string>,
    'mutationFn' | 'mutationKey'
  >
) {
  const fetch = useFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['admin', 'users', 'promote'],
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/admin/users/${userId}/promote`, {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to promote user');
      }
      return response.json() as Promise<UserMutationResponse>;
    },
    onSuccess: (data, variables, ctx) => {
      // Invalidate users list queries
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      // Invalidate specific user query
      queryClient.invalidateQueries({
        queryKey: adminUsersKeys.detail(variables),
      });
      // Invalidate dashboard stats (admin count may have changed)
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      options?.onSuccess?.(data, variables, ctx);
    },
    ...options,
  });
}

/**
 * Hook to demote user from superAdmin
 *
 * @param options - React Query options
 * @returns Mutation result
 */
export function useDemoteUser(
  options?: Omit<
    UseMutationOptions<UserMutationResponse, Error, string>,
    'mutationFn' | 'mutationKey'
  >
) {
  const fetch = useFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['admin', 'users', 'demote'],
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/admin/users/${userId}/demote`, {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to demote user');
      }
      return response.json() as Promise<UserMutationResponse>;
    },
    onSuccess: (data, variables, ctx) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({
        queryKey: adminUsersKeys.detail(variables),
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      options?.onSuccess?.(data, variables, ctx);
    },
    ...options,
  });
}

/**
 * Hook to set custom quotas for a user
 *
 * @param options - React Query options
 * @returns Mutation result
 */
export function useSetUserQuotas(
  options?: Omit<
    UseMutationOptions<
      { success: boolean; message: string; user: User },
      Error,
      { userId: string; quotas: SetUserQuotasRequest }
    >,
    'mutationFn' | 'mutationKey'
  >
) {
  const fetch = useFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['admin', 'users', 'set-quotas'],
    mutationFn: async ({ userId, quotas }) => {
      const response = await fetch(`/api/admin/users/${userId}/quotas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quotas),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to set quotas');
      }
      return response.json() as Promise<{
        success: boolean;
        message: string;
        user: User;
      }>;
    },
    onSuccess: (data, variables, ctx) => {
      queryClient.invalidateQueries({
        queryKey: adminUsersKeys.detail(variables.userId),
      });
      options?.onSuccess?.(data, variables, ctx);
    },
    ...options,
  });
}

/**
 * Hook to reset user quotas to system defaults
 *
 * @param options - React Query options
 * @returns Mutation result
 */
export function useResetUserQuotas(
  options?: Omit<
    UseMutationOptions<
      { success: boolean; message: string; user: User },
      Error,
      string
    >,
    'mutationFn' | 'mutationKey'
  >
) {
  const fetch = useFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['admin', 'users', 'reset-quotas'],
    mutationFn: async (userId: string) => {
      const response = await fetch(
        `/api/admin/users/${userId}/quotas/reset`,
        { method: 'POST' }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to reset quotas');
      }
      return response.json() as Promise<{
        success: boolean;
        message: string;
        user: User;
      }>;
    },
    onSuccess: (data, variables, ctx) => {
      queryClient.invalidateQueries({
        queryKey: adminUsersKeys.detail(variables),
      });
      options?.onSuccess?.(data, variables, ctx);
    },
    ...options,
  });
}
