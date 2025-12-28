import { AdminQueryProvider } from '@gitroom/frontend/lib/admin-query-client';
import { ReactNode } from 'react';

/**
 * Admin Panel Layout
 *
 * Provides React Query context for all admin pages.
 * This allows using optimistic updates and better data fetching
 * while keeping SWR for the rest of the application.
 *
 * @param children - Child pages (dashboard, users, organizations, etc.)
 *
 * @example
 * // Routes wrapped by this layout:
 * // /admin - Dashboard
 * // /admin/users - User management
 * // /admin/organizations - Organization management
 * // /admin/settings - System settings
 * // /admin/ai-providers - AI provider configuration
 */
export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AdminQueryProvider>{children}</AdminQueryProvider>;
}
