'use client';

import clsx from 'clsx';

/**
 * Loading Skeleton Component
 * Provides visual placeholder during content loading
 *
 * Improves perceived performance by showing skeleton layout
 * that matches the expected content structure
 *
 * @example
 * // Card skeleton
 * <LoadingSkeleton className="h-32 w-full rounded-lg" />
 *
 * // Text skeleton
 * <LoadingSkeleton className="h-4 w-3/4 mb-2" />
 * <LoadingSkeleton className="h-4 w-1/2" />
 *
 * @example
 * // Table row skeleton
 * <div className="flex gap-4 p-4 border-b">
 *   <LoadingSkeleton className="h-10 w-10 rounded-full" />
 *   <LoadingSkeleton className="h-4 flex-1" />
 *   <LoadingSkeleton className="h-8 w-20" />
 * </div>
 */
export function LoadingSkeleton({
  className,
  count = 1,
  pulse = true,
}: {
  /** Additional CSS classes for styling */
  className?: string;
  /** Number of skeleton items to render */
  count?: number;
  /** Whether to apply pulse animation */
  pulse?: boolean;
}) {
  const skeletonClass = clsx(
    'bg-tableBorder rounded',
    pulse && 'animate-pulse',
    className
  );

  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={skeletonClass} />
      ))}
    </>
  );
}

/**
 * Table Skeleton Component
 * Specifically designed for table row placeholders
 */
export function TableSkeleton({
  rows = 5,
  columns = 4,
  className,
}: {
  /** Number of skeleton rows */
  rows?: number;
  /** Number of skeleton columns */
  columns?: number;
  /** Additional container CSS classes */
  className?: string;
}) {
  return (
    <div className={clsx('w-full', className)}>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex gap-4 p-4 border-b border-tableBorder animate-pulse"
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <LoadingSkeleton
              key={colIndex}
              className={clsx(
                'h-4 rounded',
                // Make first column wider (usually ID or checkbox)
                colIndex === 0 ? 'w-16' :
                // Last column is actions
                colIndex === columns - 1 ? 'w-24 ml-auto' :
                'flex-1'
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Card Grid Skeleton Component
 * For card-based layouts like dashboards
 */
export function CardGridSkeleton({
  cards = 4,
  className,
}: {
  /** Number of skeleton cards */
  cards?: number;
  /** Additional container CSS classes */
  className?: string;
}) {
  return (
    <div className={clsx('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6', className)}>
      {Array.from({ length: cards }).map((_, index) => (
        <div key={index} className="bg-third border border-tableBorder rounded-lg p-6">
          <LoadingSkeleton className="h-6 w-3/4 mb-4" />
          <LoadingSkeleton className="h-4 w-1/2 mb-6" />
          <LoadingSkeleton className="h-32 w-full rounded mb-4" />
          <div className="flex gap-2">
            <LoadingSkeleton className="h-8 flex-1 rounded" />
            <LoadingSkeleton className="h-8 flex-1 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
