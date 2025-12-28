'use client';

import { ReactNode } from 'react';
import {
  Check,
  X,
  ChevronDown,
  UserPlus,
  UserMinus,
  Building2,
  SlidersHorizontal,
  Upload,
  Download,
} from 'lucide-react';

/**
 * Props for BulkActionsBar component
 */
export interface BulkActionsBarProps {
  /** Number of selected items */
  selectedCount: number;
  /** Type of items being selected (users or organizations) */
  itemType: 'users' | 'organizations';
  /** Callback to clear selection */
  onClearSelection: () => void;
  /** Callback when bulk promote is clicked */
  onBulkPromote?: () => void;
  /** Callback when bulk demote is clicked */
  onBulkDemote?: () => void;
  /** Callback when bulk set tier is clicked */
  onBulkSetTier?: () => void;
  /** Callback when bulk set limits is clicked */
  onBulkSetLimits?: () => void;
  /** Callback when bulk import is clicked */
  onBulkImport?: () => void;
  /** Callback when bulk export is clicked */
  onBulkExport?: () => void;
  /** Additional actions to display */
  additionalActions?: ReactNode;
  /** Whether an operation is in progress */
  isOperating?: boolean;
  /** CSS class name */
  className?: string;
}

/**
 * Bulk Actions Bar Component
 *
 * Displays a fixed bar at the bottom of the screen when items are selected.
 * Shows selected count and available bulk actions.
 *
 * @example
 * ```tsx
 * <BulkActionsBar
 *   selectedCount={selectedIds.size}
 *   itemType="users"
 *   onClearSelection={() => setSelectedIds(new Set())}
 *   onBulkPromote={() => bulkPromote.mutate({ userIds: [...selectedIds], operation: 'promote' })}
 *   onBulkDemote={() => bulkDemote.mutate({ userIds: [...selectedIds], operation: 'demote' })}
 *   isOperating={bulkPromote.isPending || bulkDemote.isPending}
 * />
 * ```
 */
export function BulkActionsBar({
  selectedCount,
  itemType,
  onClearSelection,
  onBulkPromote,
  onBulkDemote,
  onBulkSetTier,
  onBulkSetLimits,
  onBulkImport,
  onBulkExport,
  additionalActions,
  isOperating = false,
  className = '',
}: BulkActionsBarProps) {
  // Don't render if nothing selected
  if (selectedCount === 0 && !onBulkImport && !onBulkExport) {
    return null;
  }

  const itemLabel = itemType === 'users' ? 'user' : 'organization';
  const pluralItemLabel = itemType === 'users' ? 'users' : 'organizations';

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 ${className}`}
      role="toolbar"
      aria-label={`Bulk actions for ${selectedCount} ${pluralItemLabel}`}
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Selection Info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg">
            <Check className="w-4 h-4" />
            <span className="font-semibold text-sm">
              {selectedCount} {selectedCount === 1 ? itemLabel : pluralItemLabel}{' '}
              selected
            </span>
          </div>
          <button
            onClick={onClearSelection}
            disabled={isOperating}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Clear selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* User-specific actions */}
          {itemType === 'users' && (
            <>
              {onBulkPromote && (
                <BulkActionButton
                  icon={UserPlus}
                  label="Promote"
                  onClick={onBulkPromote}
                  disabled={isOperating || selectedCount === 0}
                  color="green"
                  aria-label={`Promote ${selectedCount} users to superAdmin`}
                />
              )}
              {onBulkDemote && (
                <BulkActionButton
                  icon={UserMinus}
                  label="Demote"
                  onClick={onBulkDemote}
                  disabled={isOperating || selectedCount === 0}
                  color="red"
                  aria-label={`Demote ${selectedCount} users from superAdmin`}
                />
              )}
            </>
          )}

          {/* Organization-specific actions */}
          {itemType === 'organizations' && (
            <>
              {onBulkSetTier && (
                <BulkActionButton
                  icon={Building2}
                  label="Set Tier"
                  onClick={onBulkSetTier}
                  disabled={isOperating || selectedCount === 0}
                  color="purple"
                  aria-label={`Set tier for ${selectedCount} organizations`}
                />
              )}
              {onBulkSetLimits && (
                <BulkActionButton
                  icon={SlidersHorizontal}
                  label="Set Limits"
                  onClick={onBulkSetLimits}
                  disabled={isOperating || selectedCount === 0}
                  color="orange"
                  aria-label={`Set limits for ${selectedCount} organizations`}
                />
              )}
            </>
          )}

          {/* Import/Export - always available */}
          {onBulkImport && (
            <BulkActionButton
              icon={Upload}
              label="Import CSV"
              onClick={onBulkImport}
              disabled={isOperating}
              color="blue"
              aria-label="Import users from CSV"
            />
          )}
          {onBulkExport && (
            <BulkActionButton
              icon={Download}
              label="Export CSV"
              onClick={onBulkExport}
              disabled={isOperating}
              color="gray"
              aria-label="Export users to CSV"
            />
          )}

          {/* Additional actions */}
          {additionalActions}
        </div>
      </div>
    </div>
  );
}

/**
 * Props for BulkActionButton component
 */
interface BulkActionButtonProps {
  /** Icon component to display */
  icon: React.ComponentType<{ className?: string }>;
  /** Button label */
  label: string;
  /** Click handler */
  onClick: () => void;
  /** Whether button is disabled */
  disabled?: boolean;
  /** Color theme */
  color?: 'green' | 'red' | 'purple' | 'orange' | 'blue' | 'gray';
  /** ARIA label */
  'aria-label'?: string;
}

/**
 * Bulk Action Button Component
 *
 * Internal button component with color themes
 */
function BulkActionButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  color = 'gray',
  'aria-label': ariaLabel,
}: BulkActionButtonProps) {
  const colorClasses = {
    green: 'bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400',
    red: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-400',
    purple: 'bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-400',
    orange: 'bg-orange-600 text-white hover:bg-orange-700 disabled:bg-gray-400',
    blue: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400',
    gray: 'bg-gray-600 text-white hover:bg-gray-700 disabled:bg-gray-400',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed ${colorClasses[color]}`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}

/**
 * Props for BulkActionsDropdown component
 */
export interface BulkActionsDropdownProps {
  /** Dropdown trigger label */
  label?: string;
  /** Actions to display in dropdown */
  actions: Array<{
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    onClick: () => void;
    disabled?: boolean;
    color?: 'green' | 'red' | 'purple' | 'orange' | 'blue' | 'gray';
    'aria-label'?: string;
  }>;
  /** Whether dropdown is disabled */
  disabled?: boolean;
  /** CSS class name */
  className?: string;
}

/**
 * Bulk Actions Dropdown Component
 *
 * Displays a dropdown menu for bulk actions when there are many actions
 *
 * @example
 * ```tsx
 * <BulkActionsDropdown
 *   label="Actions"
 *   actions={[
 *     { label: 'Promote', icon: UserPlus, onClick: handlePromote, color: 'green' },
 *     { label: 'Demote', icon: UserMinus, onClick: handleDemote, color: 'red' },
 *   ]}
 * />
 * ```
 */
export function BulkActionsDropdown({
  label = 'Actions',
  actions,
  disabled = false,
  className = '',
}: BulkActionsDropdownProps) {
  return (
    <div className={`relative ${className}`}>
      <button
        disabled={disabled}
        className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        <span>{label}</span>
        <ChevronDown className="w-4 h-4" />
      </button>
    </div>
  );
}
