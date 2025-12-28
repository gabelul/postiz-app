'use client';

import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

/**
 * Admin Query Client Provider
 *
 * Provides React Query client for admin panel only.
 * This allows using optimistic updates and better data fetching
 * while keeping SWR for the rest of the application.
 *
 * Usage:
 * ```tsx
 * <AdminQueryProvider>
 *   <YourAdminComponent />
 * </AdminQueryProvider>
 * ```
 *
 * @see https://tanstack.com/query/latest/docs/react/overview
 */

/**
 * Admin-specific query client configuration
 *
 * Configured for admin panel use cases:
 * - Stale time of 30 seconds for data
 * - Retry once on failure
 * - Refetch on window focus (admins may have multiple tabs)
 * - Optimistic update support
 */
const adminQueryConfig = {
  queries: {
    staleTime: 30000, // 30 seconds
    retry: 1,
    refetchOnWindowFocus: true,
  },
};

/**
 * Create a new QueryClient instance with admin configuration
 *
 * @returns Configured QueryClient instance
 */
export function createAdminQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: adminQueryConfig,
  });
}

/**
 * Admin Query Provider Component
 *
 * Wraps admin pages with React Query provider.
 * Uses a single instance per component tree to avoid duplication.
 *
 * @param props - Component props
 * @param props.children - Child components to wrap
 *
 * @example
 * ```tsx
 * // In admin/layout.tsx
 * import { AdminQueryProvider } from '@gitroom/frontend/lib/admin-query-client';
 *
 * export default function AdminLayout({ children }) {
 *   return <AdminQueryProvider>{children}</AdminQueryProvider>;
 * }
 * ```
 */
export function AdminQueryProvider({ children }: { children: ReactNode }) {
  // Create QueryClient instance per provider to avoid state sharing issues
  const [queryClient] = useState(() => createAdminQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
