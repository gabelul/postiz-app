'use client';

import { Metadata } from 'next';
import { useCallback, useState } from 'react';
import {
  useAdminStats,
  useRefreshCache,
  useAdminActivity,
} from '@gitroom/frontend/hooks/admin/use-admin-stats';
import { StatsCard, StatsGrid } from '@gitroom/frontend/components/admin/stats-card';
import { ActivityTimeline } from '@gitroom/frontend/components/admin/activity-timeline';
import {
  Users,
  Building2,
  CreditCard,
  Activity,
  RefreshCw,
  Layers,
  HeartPulse,
} from 'lucide-react';

/**
 * Admin Dashboard Page
 *
 * Main admin page that displays dashboard statistics and overview.
 * Shows:
 * - Total users, organizations, subscriptions
 * - Recent posts metrics
 * - Recent admin activity timeline
 * - Navigation to other admin sections
 *
 * Only accessible by superAdmins.
 *
 * Features:
 * - Real-time stats from backend API
 * - Cache refresh functionality
 * - Activity timeline with recent admin actions
 * - Responsive grid layout
 */
export default function AdminDashboardPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { data: stats, isLoading, error, refetch } = useAdminStats();
  const { refetch: refetchActivity } = useAdminActivity(10);
  const refreshCache = useRefreshCache();

  /**
   * Handle manual cache refresh
   * Forces recalculation of dashboard statistics
   * The mutation's onSuccess will invalidate queries and trigger refetch
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshCache.mutateAsync(undefined);
      // Also refetch activity timeline
      refetchActivity();
    } catch {
      // Error handling is done by the mutation
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshCache, refetchActivity]);

  /**
   * Format number for display (adds commas)
   */
  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  /**
   * Get cache status indicator
   */
  const getCacheStatus = () => {
    if (!stats) return null;
    const { cached, lastRefresh } = stats.cacheStatus;
    if (cached && lastRefresh) {
      const refreshTime = new Date(lastRefresh);
      const now = new Date();
      const diffMs = now.getTime() - refreshTime.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      return (
        <span className="text-xs text-gray-500">
          Updated {diffMins === 0 ? 'just now' : `${diffMins}m ago`}
        </span>
      );
    }
    return null;
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">System administration and management</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          aria-label="Refresh dashboard statistics"
          aria-busy={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw
            className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
          />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg"
        >
          <p className="text-red-800">
            Failed to load dashboard stats.{' '}
            <button
              onClick={() => refetch()}
              className="underline font-medium hover:text-red-900"
              aria-label="Retry loading dashboard statistics"
            >
              Try again
            </button>
          </p>
        </div>
      )}

      {/* Dashboard Stats Grid */}
      <StatsGrid>
        <StatsCard
          title="Total Users"
          value={stats ? formatNumber(stats.totalUsers) : '--'}
          icon={Users}
          subtitle={stats ? 'Registered users' : 'Loading...'}
          color="blue"
          isLoading={isLoading}
        />
        <StatsCard
          title="Total Organizations"
          value={stats ? formatNumber(stats.totalOrganizations) : '--'}
          icon={Building2}
          subtitle={stats ? 'Active workspaces' : 'Loading...'}
          color="purple"
          isLoading={isLoading}
        />
        <StatsCard
          title="Active Subscriptions"
          value={stats ? formatNumber(stats.activeSubscriptions) : '--'}
          icon={CreditCard}
          subtitle={stats ? 'Paid subscriptions' : 'Loading...'}
          color="green"
          isLoading={isLoading}
        />
        <StatsCard
          title="Posts (24h)"
          value={stats ? formatNumber(stats.totalPostsLast24Hours) : '--'}
          icon={Activity}
          subtitle={
            stats
              ? `${formatNumber(stats.totalPostsLast30Days)} last 30 days`
              : 'Loading...'
          }
          color="orange"
          isLoading={isLoading}
        />
      </StatsGrid>

      {/* Cache Status */}
      {stats && !isLoading && (
        <div className="mb-8 flex items-center gap-2">
          <span className="text-sm text-gray-600">Cache Status:</span>
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              stats.cacheStatus.cached
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-green-100 text-green-800'
            }`}
          >
            {stats.cacheStatus.cached ? 'Cached' : 'Live'}
          </span>
          {getCacheStatus()}
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Navigation Links - Takes 2 columns */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <a
            href="/admin/users"
            className="block p-6 bg-blue-50 border-l-4 border-blue-500 rounded-lg hover:bg-blue-100 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-blue-900">Manage Users</h3>
            </div>
            <p className="text-sm text-blue-700">
              View and manage user accounts, promote/demote admins
            </p>
            <div className="mt-3 text-xs text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              View Users →
            </div>
          </a>

          <a
            href="/admin/organizations"
            className="block p-6 bg-purple-50 border-l-4 border-purple-500 rounded-lg hover:bg-purple-100 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="w-5 h-5 text-purple-600" />
              <h3 className="font-bold text-purple-900">Manage Organizations</h3>
            </div>
            <p className="text-sm text-purple-700">
              Force subscription tiers, set limits, manage billing
            </p>
            <div className="mt-3 text-xs text-purple-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              View Organizations →
            </div>
          </a>

          <a
            href="/admin/ai-providers"
            className="block p-6 bg-green-50 border-l-4 border-green-500 rounded-lg hover:bg-green-100 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <Activity className="w-5 h-5 text-green-600" />
              <h3 className="font-bold text-green-900">AI Provider Settings</h3>
            </div>
            <p className="text-sm text-green-700">
              Configure global AI providers and settings
            </p>
            <div className="mt-3 text-xs text-green-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              Configure AI →
            </div>
          </a>

          <a
            href="/admin/settings"
            className="block p-6 bg-orange-50 border-l-4 border-orange-500 rounded-lg hover:bg-orange-100 transition-colors group"
          >
            <h3 className="font-bold text-orange-900 mb-2">System Settings</h3>
            <p className="text-sm text-orange-700">
              System configuration, tiers, and feature flags
            </p>
            <div className="mt-3 text-xs text-orange-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              View Settings →
            </div>
          </a>

          <a
            href="/admin/storage-providers"
            className="block p-6 bg-red-50 border-l-4 border-red-500 rounded-lg hover:bg-red-100 transition-colors group"
          >
            <h3 className="font-bold text-red-900 mb-2">Storage Providers</h3>
            <p className="text-sm text-red-700">
              Configure file storage (Local, S3, FTP, SFTP, Cloudflare R2)
            </p>
            <div className="mt-3 text-xs text-red-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              Configure Storage →
            </div>
          </a>

          <a
            href="/admin/bulk-operations"
            className="block p-6 bg-indigo-50 border-l-4 border-indigo-500 rounded-lg hover:bg-indigo-100 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-indigo-900">Bulk Operations</h3>
            </div>
            <p className="text-sm text-indigo-700">
              CSV import/export, bulk promote/demote, bulk tier changes
            </p>
            <div className="mt-3 text-xs text-indigo-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              Bulk Actions →
            </div>
          </a>

          {/* Health Monitoring */}
          <a
            href="/admin/health"
            className="block p-6 bg-rose-50 border-l-4 border-rose-500 rounded-lg hover:bg-rose-100 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <HeartPulse className="w-5 h-5 text-rose-600" />
              <h3 className="font-bold text-rose-900">System Health</h3>
            </div>
            <p className="text-sm text-rose-700">
              Monitor system performance, memory, database, and AI providers
            </p>
            <div className="mt-3 text-xs text-rose-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              Health Status →
            </div>
          </a>
        </div>

        {/* Activity Timeline - Takes 1 column */}
        <div className="lg:col-span-1">
          <ActivityTimeline limit={10} onRetry={refetchActivity} />
        </div>
      </div>
    </div>
  );
}
