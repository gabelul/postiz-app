'use client';

import { useAdminActivity } from '@gitroom/frontend/hooks/admin/use-admin-stats';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

// Extend dayjs with relativeTime plugin
dayjs.extend(relativeTime);

/**
 * Activity Timeline Item Props
 */
interface ActivityTimelineProps {
  /**
   * Number of activity items to display
   * @default 10
   */
  limit?: number;

  /**
   * CSS class name for custom styling
   */
  className?: string;

  /**
   * Optional refetch function for retry functionality
   */
  onRetry?: () => void;
}

/**
 * Activity Timeline Component
 *
 * Displays recent admin actions in a timeline format.
 * Shows action type, affected entity, admin who performed it,
 * and relative time.
 *
 * @example
 * ```tsx
 * <ActivityTimeline limit={15} />
 * ```
 */
export function ActivityTimeline({
  limit = 10,
  className = '',
  onRetry,
}: ActivityTimelineProps) {
  const { data: activities, isLoading, error } = useAdminActivity(limit);

  /**
   * Get action display text with color
   * Uses opacity-based colors for dark mode compatibility
   */
  const getActionDisplay = (action: string) => {
    const actionMap: Record<string, { text: string; color: string }> = {
      USER_PROMOTE: { text: 'Promoted User', color: 'text-green-500' },
      USER_DEMOTE: { text: 'Demoted User', color: 'text-orange-500' },
      USER_SET_QUOTAS: { text: 'Updated User Quotas', color: 'text-blue-500' },
      ORG_SET_TIER: { text: 'Changed Tier', color: 'text-purple-500' },
      ORG_SET_LIMITS: { text: 'Updated Limits', color: 'text-blue-500' },
      ORG_BYPASS_BILLING: { text: 'Updated Billing', color: 'text-yellow-500' },
      SETTING_UPDATE: { text: 'Updated Setting', color: 'text-gray-400' },
      AI_PROVIDER_CREATE: { text: 'Added AI Provider', color: 'text-green-500' },
      AI_PROVIDER_DELETE: { text: 'Removed AI Provider', color: 'text-red-500' },
    };
    return (
      actionMap[action] || { text: action, color: 'text-gray-400' }
    );
  };

  /**
   * Get entity type icon/color
   * Uses opacity-based backgrounds for dark mode compatibility
   */
  const getEntityDisplay = (entityType: string) => {
    const entityMap: Record<string, { text: string; bg: string }> = {
      USER: { text: 'User', bg: 'bg-blue-500/20 text-blue-400' },
      ORGANIZATION: { text: 'Org', bg: 'bg-purple-500/20 text-purple-400' },
      SETTING: { text: 'Setting', bg: 'bg-gray-500/20 text-gray-400' },
      AI_PROVIDER: { text: 'AI', bg: 'bg-green-500/20 text-green-400' },
    };
    return entityMap[entityType] || { text: entityType, bg: 'bg-gray-500/10 text-gray-400' };
  };

  if (isLoading) {
    return (
      <div className={`bg-newBgColorInner rounded-lg border border-newBorder p-6 ${className}`}>
        <h3 className="text-lg font-semibold mb-4 text-newTextColor">Recent Activity</h3>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-2 h-2 bg-newColColor rounded-full mt-2 animate-pulse" />
              <div className="flex-1">
                <div className="h-4 bg-newColColor rounded w-3/4 animate-pulse mb-2" />
                <div className="h-3 bg-newColColor/50 rounded w-1/2 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-newBgColorInner rounded-lg border border-newBorder p-6 ${className}`}>
        <h3 className="text-lg font-semibold mb-4 text-newTextColor">Recent Activity</h3>
        <p className="text-textItemBlur text-sm">
          Failed to load activity.{' '}
          {onRetry ? (
            <button
              onClick={onRetry}
              className="text-blue-500 hover:underline"
              aria-label="Retry loading activity"
            >
              Retry
            </button>
          ) : (
            <button
              onClick={() => window.location.reload()}
              className="text-blue-500 hover:underline"
              aria-label="Reload page to retry loading activity"
            >
              Reload Page
            </button>
          )}
        </p>
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className={`bg-newBgColorInner rounded-lg border border-newBorder p-6 ${className}`}>
        <h3 className="text-lg font-semibold mb-4 text-newTextColor">Recent Activity</h3>
        <p className="text-textItemBlur text-sm">No recent activity to display.</p>
      </div>
    );
  }

  return (
    <div className={`bg-newBgColorInner rounded-lg border border-newBorder p-6 ${className}`}>
      <h3 className="text-lg font-semibold mb-4 text-newTextColor">Recent Activity</h3>
      <div className="space-y-4">
        {activities.map((activity, index) => {
          const actionDisplay = getActionDisplay(activity.action);
          const entityDisplay = getEntityDisplay(activity.entityType);

          return (
            <div key={activity.id} className="flex items-start gap-3">
              {/* Timeline indicator */}
              <div className="relative">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                {index < activities.length - 1 && (
                  <div className="absolute top-4 left-1 w-0.5 h-8 bg-newBorder" />
                )}
              </div>

              {/* Activity content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Entity type badge */}
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${entityDisplay.bg}`}
                  >
                    {entityDisplay.text}
                  </span>

                  {/* Action */}
                  <span className={`text-sm font-medium ${actionDisplay.color}`}>
                    {actionDisplay.text}
                  </span>
                </div>

                {/* Entity name */}
                <p className="text-sm text-newTextColor truncate mt-1">
                  {activity.entityName}
                </p>

                {/* Admin and time */}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-textItemBlur">
                    by {activity.adminEmail}
                  </span>
                  <span className="text-textItemBlur/50">•</span>
                  <span className="text-xs text-textItemBlur">
                    {dayjs(activity.createdAt).fromNow()}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Compact Activity Timeline
 *
 * Smaller version for sidebar/card display.
 * Shows only activity count and most recent item.
 */
export function CompactActivityTimeline({ className = '' }: { className?: string }) {
  const { data: activities } = useAdminActivity(5);

  if (!activities || activities.length === 0) {
    return null;
  }

  const latest = activities[0];
  const actionDisplay = latest.action
    .toLowerCase()
    .replace(/_/g, ' ');

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-newTextColor">Recent Activity</span>
        <span className="text-xs text-textItemBlur">{activities.length} items</span>
      </div>
      <p className="text-sm text-newTextColor truncate">
        <span className="font-medium">{actionDisplay}</span> - {latest.entityName}
      </p>
      <p className="text-xs text-textItemBlur mt-1">
        {dayjs(latest.createdAt).fromNow()}
      </p>
    </div  >
  );
}
