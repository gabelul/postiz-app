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
   * Uses the system.lastCacheRefresh timestamp to show how fresh the data is
   */
  const getCacheStatus = () => {
    if (!stats?.system?.lastCacheRefresh) return null;
    const refreshTime = new Date(stats.system.lastCacheRefresh);
    const now = new Date();
    const diffMs = now.getTime() - refreshTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    return (
      <span className="text-xs text-gray-500">
        Updated {diffMins === 0 ? 'just now' : `${diffMins}m ago`}
      </span>
    );
  };

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2 text-newTextColor">Admin Dashboard</h1>
          <p className="text-textItemBlur">System administration and management</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          aria-label="Refresh dashboard statistics"
          aria-busy={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-newBgColorInner border border-newBorder rounded-lg hover:bg-newBoxHover disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-newTextColor"
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
          className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-lg"
        >
          <p className="text-red-400">
            Failed to load dashboard stats.{' '}
            <button
              onClick={() => refetch()}
              className="underline font-medium hover:text-red-300"
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
          value={stats ? formatNumber(stats.users.total) : '--'}
          icon={Users}
          subtitle={stats ? `${formatNumber(stats.users.activeThisMonth)} active this month` : 'Loading...'}
          color="blue"
          isLoading={isLoading}
        />
        <StatsCard
          title="Total Organizations"
          value={stats ? formatNumber(stats.organizations.total) : '--'}
          icon={Building2}
          subtitle={stats ? `${formatNumber(stats.organizations.activeThisMonth)} active this month` : 'Loading...'}
          color="purple"
          isLoading={isLoading}
        />
        <StatsCard
          title="Paid Subscriptions"
          value={stats ? formatNumber(stats.subscriptions.paid) : '--'}
          icon={CreditCard}
          subtitle={stats ? `${formatNumber(stats.subscriptions.trial)} trials` : 'Loading...'}
          color="green"
          isLoading={isLoading}
        />
        <StatsCard
          title="Posts This Month"
          value={stats ? formatNumber(stats.posts.publishedThisMonth) : '--'}
          icon={Activity}
          subtitle={
            stats
              ? `${formatNumber(stats.posts.scheduled)} scheduled`
              : 'Loading...'
          }
          color="orange"
          isLoading={isLoading}
        />
      </StatsGrid>

      {/* Cache Status */}
      {stats && !isLoading && (
        <div className="mb-8 flex items-center gap-2">
          <span className="text-sm text-textItemBlur">Last Updated:</span>
          {getCacheStatus()}
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Navigation Links - Takes 2 columns */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href="/admin/users"
            className="block p-6 bg-blue-500/10 border-l-4 border-blue-500 rounded-lg hover:bg-blue-500/20 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-blue-500" />
              <h3 className="font-bold text-blue-400">Manage Users</h3>
            </div>
            <p className="text-sm text-textItemBlur">
              View and manage user accounts, promote/demote admins
            </p>
            <div className="mt-3 text-xs text-blue-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              View Users →
            </div>
          </a>

          <a
            href="/admin/organizations"
            className="block p-6 bg-purple-500/10 border-l-4 border-purple-500 rounded-lg hover:bg-purple-500/20 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="w-5 h-5 text-purple-500" />
              <h3 className="font-bold text-purple-400">Manage Organizations</h3>
            </div>
            <p className="text-sm text-textItemBlur">
              Force subscription tiers, set limits, manage billing
            </p>
            <div className="mt-3 text-xs text-purple-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              View Organizations →
            </div>
          </a>

          <a
            href="/admin/ai-providers"
            className="block p-6 bg-green-500/10 border-l-4 border-green-500 rounded-lg hover:bg-green-500/20 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <Activity className="w-5 h-5 text-green-500" />
              <h3 className="font-bold text-green-400">AI Provider Settings</h3>
            </div>
            <p className="text-sm text-textItemBlur">
              Configure global AI providers and settings
            </p>
            <div className="mt-3 text-xs text-green-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              Configure AI →
            </div>
          </a>

          <a
            href="/admin/ai-tasks"
            className="block p-6 bg-teal-500/10 border-l-4 border-teal-500 rounded-lg hover:bg-teal-500/20 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <Layers className="w-5 h-5 text-teal-500" />
              <h3 className="font-bold text-teal-400">AI Task Assignment</h3>
            </div>
            <p className="text-sm text-textItemBlur">
              Assign AI models to tasks with fallback strategy
            </p>
            <div className="mt-3 text-xs text-teal-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              Assign Models →
            </div>
          </a>

          <a
            href="/admin/settings"
            className="block p-6 bg-orange-500/10 border-l-4 border-orange-500 rounded-lg hover:bg-orange-500/20 transition-colors group"
          >
            <h3 className="font-bold text-orange-400 mb-2">System Settings</h3>
            <p className="text-sm text-textItemBlur">
              System configuration, tiers, and feature flags
            </p>
            <div className="mt-3 text-xs text-orange-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              View Settings →
            </div>
          </a>

          <a
            href="/admin/storage-providers"
            className="block p-6 bg-red-500/10 border-l-4 border-red-500 rounded-lg hover:bg-red-500/20 transition-colors group"
          >
            <h3 className="font-bold text-red-400 mb-2">Storage Providers</h3>
            <p className="text-sm text-textItemBlur">
              Configure file storage (Local, S3, FTP, SFTP, Cloudflare R2)
            </p>
            <div className="mt-3 text-xs text-red-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              Configure Storage →
            </div>
          </a>

          <a
            href="/admin/bulk-operations"
            className="block p-6 bg-indigo-500/10 border-l-4 border-indigo-500 rounded-lg hover:bg-indigo-500/20 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <Layers className="w-5 h-5 text-indigo-500" />
              <h3 className="font-bold text-indigo-400">Bulk Operations</h3>
            </div>
            <p className="text-sm text-textItemBlur">
              CSV import/export, bulk promote/demote, bulk tier changes
            </p>
            <div className="mt-3 text-xs text-indigo-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              Bulk Actions →
            </div>
          </a>

          {/* Health Monitoring */}
          <a
            href="/admin/health"
            className="block p-6 bg-rose-500/10 border-l-4 border-rose-500 rounded-lg hover:bg-rose-500/20 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <HeartPulse className="w-5 h-5 text-rose-500" />
              <h3 className="font-bold text-rose-400">System Health</h3>
            </div>
            <p className="text-sm text-textItemBlur">
              Monitor system performance, memory, database, and AI providers
            </p>
            <div className="mt-3 text-xs text-rose-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
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
