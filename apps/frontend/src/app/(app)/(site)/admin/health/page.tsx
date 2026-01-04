'use client';

import { useSystemHealth, useAiProviderHealth, useDatabaseHealth } from '@gitroom/frontend/hooks/admin/use-admin-health';
import type { SystemHealth, AiProviderStatus } from '@gitroom/frontend/hooks/admin/use-admin-health';

/**
 * Health status badge component
 */
function HealthBadge({ status }: { status: 'healthy' | 'degraded' | 'unhealthy' }) {
  const styles = {
    healthy: 'bg-green-500/20 text-green-400 border-green-500/30',
    degraded: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    unhealthy: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}
    >
      {status === 'healthy' && (
        <>
          <span className="w-2 h-2 mr-1.5 bg-green-500 rounded-full animate-pulse" />
          Healthy
        </>
      )}
      {status === 'degraded' && (
        <>
          <span className="w-2 h-2 mr-1.5 bg-yellow-500 rounded-full" />
          Degraded
        </>
      )}
      {status === 'unhealthy' && (
        <>
          <span className="w-2 h-2 mr-1.5 bg-red-500 rounded-full" />
          Unhealthy
        </>
      )}
    </span>
  );
}

/**
 * Metric card component
 */
function MetricCard({
  title,
  value,
  unit,
  status,
  icon,
}: {
  title: string;
  value: number | string;
  unit?: string;
  status?: 'healthy' | 'degraded' | 'unhealthy';
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-newBgColorInner rounded-lg shadow-sm p-4 border border-newBorder">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-newColColor rounded-lg">{icon}</div>
          <div>
            <p className="text-sm text-textItemBlur">{title}</p>
            <p className="text-2xl font-semibold text-newTextColor">
              {typeof value === 'number' ? value.toLocaleString() : value}
              {unit && <span className="text-sm text-textItemBlur ml-1">{unit}</span>}
            </p>
          </div>
        </div>
        {status && <HealthBadge status={status} />}
      </div>
    </div>
  );
}

/**
 * Heap memory usage bar component
 *
 * Displays V8 heap memory utilization (not system/process memory).
 * This is the JavaScript heap allocated by Node.js, not total process RSS.
 */
function MemoryBar({ used, total, percentage }: { used: number; total: number; percentage: number }) {
  const getColor = (pct: number) => {
    if (pct < 50) return 'bg-green-500';
    if (pct < 75) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-newBgColorInner rounded-lg shadow-sm p-4 border border-newBorder">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-newTextColor">Heap Memory Usage</p>
        <p className="text-sm text-textItemBlur">
          {used} MB / {total} MB
        </p>
      </div>
      <div className="w-full bg-newColColor rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full transition-all duration-300 ${getColor(percentage)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-textItemBlur mt-1">{percentage.toFixed(1)}% used (V8 heap)</p>
    </div>
  );
}

/**
 * AI Provider status card
 */
function AiProviderCard({ provider }: { provider: AiProviderStatus }) {
  return (
    <div
      key={provider.provider}
      className="bg-newBgColorInner rounded-lg shadow-sm p-3 border border-newBorder flex items-center justify-between"
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-2 h-2 rounded-full ${
            provider.configured ? 'bg-green-500' : 'bg-gray-500'
          }`}
        />
        <div>
          <p className="text-sm font-medium text-newTextColor capitalize">
            {provider.provider}
          </p>
          <p className="text-xs text-textItemBlur">
            {provider.configured ? 'Configured' : 'Not configured'}
            {provider.errorCount > 0 && ` • ${provider.errorCount} errors`}
          </p>
        </div>
      </div>
      {provider.lastUsed && (
        <p className="text-xs text-textItemBlur">
          {new Date(provider.lastUsed).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

export default function AdminHealthPage() {
  const {
    data: systemHealth,
    isLoading: healthLoading,
    error: healthError,
    refetch: refetchHealth,
  } = useSystemHealth();

  const {
    data: aiProviders,
    isLoading: aiLoading,
    error: aiError,
    refetch: refetchAi,
  } = useAiProviderHealth();

  const {
    data: dbHealth,
    isLoading: dbLoading,
    error: dbError,
    refetch: refetchDb,
  } = useDatabaseHealth();

  if (healthLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-newTextColor" />
      </div>
    );
  }

  if (healthError || !systemHealth) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
        <p className="text-red-400">Failed to load health metrics</p>
      </div>
    );
  }

  // Calculate uptime in readable format
  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-newTextColor">System Health</h1>
          <p className="text-textItemBlur mt-1">
            Monitor system performance and resource usage
          </p>
        </div>
        <button
          onClick={() => {
            refetchHealth();
            refetchAi();
            refetchDb();
          }}
          className="px-4 py-2 bg-newBgColorInner border border-newBorder rounded-lg text-sm font-medium text-newTextColor hover:bg-newBoxHover transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Overall Status */}
      <div className="bg-newBgColorInner rounded-lg shadow-sm p-6 border border-newBorder">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-textItemBlur">Overall System Status</p>
            <div className="flex items-center gap-3 mt-1">
              <HealthBadge status={systemHealth.status} />
              <p className="text-sm text-textItemBlur">
                Uptime: {formatUptime(systemHealth.uptime)}
              </p>
            </div>
          </div>
          <p className="text-xs text-textItemBlur">
            Last updated: {new Date(systemHealth.timestamp).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Users"
          value={systemHealth.stats.totalUsers}
          icon={<UserIcon />}
        />
        <MetricCard
          title="Organizations"
          value={systemHealth.stats.totalOrganizations}
          icon={<BuildingIcon />}
        />
        <MetricCard
          title="Posts"
          value={systemHealth.stats.totalPosts}
          icon={<DocumentIcon />}
        />
        <MetricCard
          title="Subscriptions"
          value={systemHealth.stats.totalSubscriptions}
          icon={<CreditCardIcon />}
        />
      </div>

      {/* Heap Memory and Database */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MemoryBar
          used={systemHealth.heapMemory.used}
          total={systemHealth.heapMemory.total}
          percentage={systemHealth.heapMemory.percentage}
        />
        <MetricCard
          title="Database Latency"
          value={systemHealth.database.latency || 0}
          unit="ms"
          status={
            (systemHealth.database.latency || 0) < 100
              ? 'healthy'
              : (systemHealth.database.latency || 0) < 500
              ? 'degraded'
              : 'unhealthy'
          }
          icon={<DatabaseIcon />}
        />
      </div>

      {/* AI Providers */}
      <div className="bg-newBgColorInner rounded-lg shadow-sm border border-newBorder">
        <div className="p-4 border-b border-newBorder">
          <h2 className="text-lg font-semibold text-newTextColor">AI Providers</h2>
          <p className="text-sm text-textItemBlur mt-1">
            Status of configured AI providers
          </p>
        </div>
        <div className="p-4">
          {aiLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-newTextColor" />
            </div>
          ) : aiError ? (
            <p className="text-red-400 text-sm">Failed to load AI provider status</p>
          ) : aiProviders && aiProviders.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {aiProviders.map((provider) => (
                <AiProviderCard key={provider.provider} provider={provider} />
              ))}
            </div>
          ) : (
            <p className="text-textItemBlur text-sm">No AI providers configured</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Simple icons (using SVG-like components)
function UserIcon() {
  return (
    <svg className="w-5 h-5 text-newTextColor" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg className="w-5 h-5 text-newTextColor" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
      />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg className="w-5 h-5 text-newTextColor" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function CreditCardIcon() {
  return (
    <svg className="w-5 h-5 text-newTextColor" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
      />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg className="w-5 h-5 text-newTextColor" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
      />
    </svg>
  );
}
