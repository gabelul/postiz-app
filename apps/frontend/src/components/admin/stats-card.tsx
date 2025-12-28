'use client';

import { LucideIcon } from 'lucide-react';

/**
 * Stats Card Props
 */
export interface StatsCardProps {
  /**
   * Card title/label
   */
  title: string;

  /**
   * Main value to display
   */
  value: number | string;

  /**
   * Optional icon component
   */
  icon?: LucideIcon;

  /**
   * Optional subtitle/description
   */
  subtitle?: string;

  /**
   * Color theme for the card
   * @default 'blue'
   */
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';

  /**
   * Whether to show loading state
   */
  isLoading?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Color theme configurations
 */
const colorThemes: Record<
  Exclude<StatsCardProps['color'], undefined>,
  { bg: string; border: string; icon: string }
> = {
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'text-blue-600',
  },
  green: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: 'text-green-600',
  },
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    icon: 'text-purple-600',
  },
  orange: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    icon: 'text-orange-600',
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'text-red-600',
  },
};

/**
 * Stats Card Component
 *
 * Displays a single statistic with title, value, icon, and optional subtitle.
 * Used throughout the admin dashboard for consistent metric display.
 *
 * @example
 * ```tsx
 * <StatsCard
 *   title="Total Users"
 *   value={1234}
 *   icon={Users}
 *   subtitle="+12% from last month"
 *   color="blue"
 * />
 * ```
 */
export function StatsCard({
  title,
  value,
  icon: Icon,
  subtitle,
  color = 'blue',
  isLoading = false,
  className = '',
}: StatsCardProps) {
  const theme = colorThemes[color];

  if (isLoading) {
    return (
      <div
        className={`bg-white p-6 rounded-lg border border-gray-200 ${className}`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
          {Icon && (
            <div className="w-8 h-8 bg-gray-200 rounded-lg animate-pulse" />
          )}
        </div>
        <div className="h-8 bg-gray-200 rounded w-16 animate-pulse mb-2" />
        <div className="h-3 bg-gray-100 rounded w-32 animate-pulse" />
      </div>
    );
  }

  return (
    <div
      className={`bg-white p-6 rounded-lg border border-gray-200 hover:shadow-sm transition-shadow ${className}`}
    >
      <div className="flex items-start justify-between mb-4">
        <span className="text-gray-600 text-sm font-medium">{title}</span>
        {Icon && (
          <div className={`p-2 rounded-lg ${theme.bg} ${theme.icon}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
      {subtitle && <p className="text-gray-500 text-xs">{subtitle}</p>}
    </div>
  );
}

/**
 * Stats Grid Component
 *
 * Container for multiple stat cards with consistent spacing.
 *
 * @example
 * ```tsx
 * <StatsGrid>
 *   <StatsCard title="Users" value={100} icon={Users} />
 *   <StatsCard title="Orgs" value={50} icon={Building} />
 * </StatsGrid>
 * ```
 */
export function StatsGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {children}
    </div>
  );
}
