'use client';

/**
 * Admin Bulk Operations Page
 *
 * Allows superAdmins to perform bulk administrative operations:
 * - Import users from CSV file
 * - Export users to CSV file
 * - Bulk promote/demote users
 * - Bulk set organization tier
 * - Bulk set organization limits
 *
 * Only accessible by superAdmins
 */

import { useState, useCallback, useRef } from 'react';
import {
  Upload,
  Download,
  FileUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
} from 'lucide-react';
import {
  useBulkPromoteUsers,
  useBulkDemoteUsers,
  useBulkSetOrganizationTier,
  useBulkSetOrganizationLimits,
  useBulkImportUsers,
  useBulkExportUsers,
  downloadCsv,
  type BulkOperationResult,
  type CsvImportResult,
} from '@gitroom/frontend/hooks/admin/use-admin-bulk-operations';

/**
 * Operation state for modal display
 */
interface OperationState {
  type: 'promote' | 'demote' | 'set_tier' | 'set_limits' | 'import';
  inProgress: boolean;
  result?: BulkOperationResult | CsvImportResult;
  error?: string;
}

/**
 * Tier options for organizations
 */
const TIER_OPTIONS = [
  { value: 'FREE', label: 'Free', color: 'bg-gray-100 text-gray-800' },
  { value: 'STARTER', label: 'Starter', color: 'bg-blue-100 text-blue-800' },
  { value: 'PRO', label: 'Pro', color: 'bg-purple-100 text-purple-800' },
  { value: 'ENTERPRISE', label: 'Enterprise', color: 'bg-green-100 text-green-800' },
] as const;

export default function BulkOperationsPage() {
  const [operation, setOperation] = useState<OperationState>({
    type: 'promote',
    inProgress: false,
  });
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [selectedOrgIds, setSelectedOrgIds] = useState<Set<string>>(new Set());
  const [csvContent, setCsvContent] = useState<string>('');
  const [selectedTier, setSelectedTier] = useState<'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE'>('FREE');
  const [limitsForm, setLimitsForm] = useState<Record<string, unknown>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bulk operation mutations
  const bulkPromote = useBulkPromoteUsers();
  const bulkDemote = useBulkDemoteUsers();
  const bulkSetTier = useBulkSetOrganizationTier();
  const bulkSetLimits = useBulkSetOrganizationLimits();
  const bulkImport = useBulkImportUsers();
  const bulkExport = useBulkExportUsers();

  /**
   * Handle file upload for CSV import
   * Reads file content and validates size
   */
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (10MB limit)
    if (file.size > 10_000_000) {
      setOperation({
        type: 'import',
        inProgress: false,
        error: 'File too large. Maximum size is 10MB.',
      });
      return;
    }

    // Check file type
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setOperation({
        type: 'import',
        inProgress: false,
        error: 'Invalid file type. Please upload a CSV file.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvContent(content);
    };
    reader.onerror = () => {
      setOperation({
        type: 'import',
        inProgress: false,
        error: 'Failed to read file. Please try again.',
      });
    };
    reader.readAsText(file);
  }, []);

  /**
   * Execute bulk import users from CSV
   */
  const handleBulkImport = useCallback(async () => {
    if (!csvContent.trim()) {
      setOperation({
        type: 'import',
        inProgress: false,
        error: 'Please select a CSV file first.',
      });
      return;
    }

    setOperation({ type: 'import', inProgress: true });

    try {
      const result = await bulkImport.mutateAsync({ content: csvContent });
      setOperation({ type: 'import', inProgress: false, result });
      // Clear file input after successful import
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setCsvContent('');
    } catch (error) {
      setOperation({
        type: 'import',
        inProgress: false,
        error: error instanceof Error ? error.message : 'Import failed',
      });
    }
  }, [csvContent, bulkImport]);

  /**
   * Execute bulk export users to CSV
   */
  const handleBulkExport = useCallback(async () => {
    try {
      const data = await bulkExport.mutateAsync({ take: 10000, skip: 0 });
      downloadCsv(data.csv, data.filename);
    } catch (error) {
      setOperation({
        type: 'promote',
        inProgress: false,
        error: error instanceof Error ? error.message : 'Export failed',
      });
    }
  }, [bulkExport]);

  /**
   * Execute bulk promote operation
   */
  const handleBulkPromote = useCallback(async () => {
    if (selectedUserIds.size === 0) {
      setOperation({
        type: 'promote',
        inProgress: false,
        error: 'Please select at least one user.',
      });
      return;
    }

    setOperation({ type: 'promote', inProgress: true });

    try {
      const result = await bulkPromote.mutateAsync({
        userIds: Array.from(selectedUserIds),
        operation: 'promote',
      });
      setOperation({ type: 'promote', inProgress: false, result });
      setSelectedUserIds(new Set());
    } catch (error) {
      setOperation({
        type: 'promote',
        inProgress: false,
        error: error instanceof Error ? error.message : 'Operation failed',
      });
    }
  }, [selectedUserIds, bulkPromote]);

  /**
   * Execute bulk demote operation
   */
  const handleBulkDemote = useCallback(async () => {
    if (selectedUserIds.size === 0) {
      setOperation({
        type: 'demote',
        inProgress: false,
        error: 'Please select at least one user.',
      });
      return;
    }

    setOperation({ type: 'demote', inProgress: true });

    try {
      const result = await bulkDemote.mutateAsync({
        userIds: Array.from(selectedUserIds),
        operation: 'demote',
      });
      setOperation({ type: 'demote', inProgress: false, result });
      setSelectedUserIds(new Set());
    } catch (error) {
      setOperation({
        type: 'demote',
        inProgress: false,
        error: error instanceof Error ? error.message : 'Operation failed',
      });
    }
  }, [selectedUserIds, bulkDemote]);

  /**
   * Execute bulk set tier operation
   */
  const handleBulkSetTier = useCallback(async () => {
    if (selectedOrgIds.size === 0) {
      setOperation({
        type: 'set_tier',
        inProgress: false,
        error: 'Please select at least one organization.',
      });
      return;
    }

    setOperation({ type: 'set_tier', inProgress: true });

    try {
      const result = await bulkSetTier.mutateAsync({
        organizationIds: Array.from(selectedOrgIds),
        operation: 'set_tier',
        tier: selectedTier,
      });
      setOperation({ type: 'set_tier', inProgress: false, result });
      setSelectedOrgIds(new Set());
    } catch (error) {
      setOperation({
        type: 'set_tier',
        inProgress: false,
        error: error instanceof Error ? error.message : 'Operation failed',
      });
    }
  }, [selectedOrgIds, selectedTier, bulkSetTier]);

  /**
   * Execute bulk set limits operation
   */
  const handleBulkSetLimits = useCallback(async () => {
    if (selectedOrgIds.size === 0) {
      setOperation({
        type: 'set_limits',
        inProgress: false,
        error: 'Please select at least one organization.',
      });
      return;
    }

    setOperation({ type: 'set_limits', inProgress: true });

    try {
      const result = await bulkSetLimits.mutateAsync({
        organizationIds: Array.from(selectedOrgIds),
        operation: 'set_limits',
        limits: limitsForm,
      });
      setOperation({ type: 'set_limits', inProgress: false, result });
      setSelectedOrgIds(new Set());
      setLimitsForm({});
    } catch (error) {
      setOperation({
        type: 'set_limits',
        inProgress: false,
        error: error instanceof Error ? error.message : 'Operation failed',
      });
    }
  }, [selectedOrgIds, limitsForm, bulkSetLimits]);

  /**
   * Close operation result modal
   */
  const closeOperationModal = useCallback(() => {
    setOperation({ type: 'promote', inProgress: false });
  }, []);

  /**
   * Format operation result for display
   */
  const renderOperationResult = () => {
    if (!operation.result) return null;

    const isImport = operation.type === 'import';
    // Type guard: check if result has 'totalRows' property (CsvImportResult)
    const isCsvImportResult = (result: any): result is CsvImportResult =>
      'totalRows' in result;

    const total = isCsvImportResult(operation.result)
      ? operation.result.totalRows
      : operation.result.total;
    const succeeded = isCsvImportResult(operation.result)
      ? operation.result.imported
      : operation.result.succeeded;
    const failed = operation.result.failed;
    const errors = operation.result.errors;

    return (
      <div className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{total}</div>
            <div className="text-sm text-gray-600">Total</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-700">{succeeded}</div>
            <div className="text-sm text-green-600">Succeeded</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-700">{failed}</div>
            <div className="text-sm text-red-600">Failed</div>
          </div>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="max-h-60 overflow-y-auto">
            <h4 className="font-semibold text-sm text-gray-700 mb-2">Errors:</h4>
            <ul className="space-y-1">
              {errors.map((error, index) => (
                <li key={index} className="text-sm text-red-600 flex gap-2">
                  <span>
                    {'row' in error ? `Row ${error.row}` : 'id' in error ? error.id : 'Unknown'}
                    {': '}
                  </span>
                  <span>{error.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Bulk Operations</h1>
        <p className="text-gray-600">
          Perform administrative operations on multiple users or organizations at once
        </p>
      </div>

      {/* CSV Import/Export Section */}
      <section className="mb-8 bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <FileUp className="w-5 h-5 text-blue-600" />
          CSV Import / Export
        </h2>
        <p className="text-gray-600 mb-4">
          Import users in bulk from a CSV file or export existing users to CSV.
        </p>

        {/* CSV Format Info */}
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-sm text-gray-700 mb-2">
            Expected CSV Format:
          </h3>
          <code className="text-sm bg-gray-200 px-2 py-1 rounded">
            email,name,isSuperAdmin,customQuotas
          </code>
          <p className="text-xs text-gray-600 mt-2">
            Only <strong>email</strong> is required. customQuotas should be a JSON string.
          </p>
        </div>

        {/* File Upload */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-64">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              disabled={operation.inProgress}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Upload CSV file"
            />
          </div>
          <button
            onClick={handleBulkImport}
            disabled={!csvContent || operation.inProgress}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            aria-label="Import users from CSV"
          >
            <Upload className="w-4 h-4" />
            {operation.inProgress && operation.type === 'import'
              ? 'Importing...'
              : 'Import CSV'}
          </button>
          <button
            onClick={handleBulkExport}
            disabled={operation.inProgress}
            className="flex items-center gap-2 px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            aria-label="Export users to CSV"
          >
            <Download className="w-4 h-4" />
            {operation.inProgress && operation.type === 'promote'
              ? 'Exporting...'
              : 'Export CSV'}
          </button>
        </div>

        {/* File info */}
        {csvContent && (
          <div className="mt-3 text-sm text-gray-600">
            Selected: {csvContent.split('\n').length} rows
          </div>
        )}
      </section>

      {/* Quick User Operations Section */}
      <section className="mb-8 bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold mb-4">Quick Bulk User Operations</h2>
        <p className="text-gray-600 mb-4">
          Select user IDs below to perform bulk operations (max 100 users at once).
        </p>

        {/* User ID Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            User IDs (comma-separated, max 100)
          </label>
          <textarea
            value={Array.from(selectedUserIds).join(',')}
            onChange={(e) => {
              const ids = e.target.value
                .split(',')
                .map((id) => id.trim())
                .filter(Boolean);
              setSelectedUserIds(new Set(ids));
            }}
            disabled={operation.inProgress}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
            placeholder="user-id-1, user-id-2, user-id-3..."
            aria-label="Enter user IDs for bulk operations"
          />
          <div className="mt-1 text-sm text-gray-600">
            {selectedUserIds.size} user{selectedUserIds.size !== 1 ? 's' : ''} selected
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleBulkPromote}
            disabled={selectedUserIds.size === 0 || operation.inProgress}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            aria-label="Bulk promote users to superAdmin"
          >
            Promote to SuperAdmin
          </button>
          <button
            onClick={handleBulkDemote}
            disabled={selectedUserIds.size === 0 || operation.inProgress}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            aria-label="Bulk demote users from superAdmin"
          >
            Demote from SuperAdmin
          </button>
          <button
            onClick={() => setSelectedUserIds(new Set())}
            disabled={operation.inProgress}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Clear user selection"
          >
            Clear Selection
          </button>
        </div>
      </section>

      {/* Quick Organization Operations Section */}
      <section className="mb-8 bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold mb-4">Quick Bulk Organization Operations</h2>
        <p className="text-gray-600 mb-4">
          Select organization IDs below to perform bulk operations (max 100 organizations at once).
        </p>

        {/* Organization ID Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Organization IDs (comma-separated, max 100)
          </label>
          <textarea
            value={Array.from(selectedOrgIds).join(',')}
            onChange={(e) => {
              const ids = e.target.value
                .split(',')
                .map((id) => id.trim())
                .filter(Boolean);
              setSelectedOrgIds(new Set(ids));
            }}
            disabled={operation.inProgress}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
            placeholder="org-id-1, org-id-2, org-id-3..."
            aria-label="Enter organization IDs for bulk operations"
          />
          <div className="mt-1 text-sm text-gray-600">
            {selectedOrgIds.size} organization{selectedOrgIds.size !== 1 ? 's' : ''} selected
          </div>
        </div>

        {/* Set Tier */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Subscription Tier
          </label>
          <div className="flex flex-wrap gap-2">
            {TIER_OPTIONS.map((tier) => (
              <button
                key={tier.value}
                onClick={() => setSelectedTier(tier.value as any)}
                disabled={operation.inProgress}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedTier === tier.value
                    ? tier.color
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                aria-label={`Set tier to ${tier.label}`}
              >
                {tier.label}
              </button>
            ))}
          </div>
        </div>

        {/* Set Limits */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Custom Limits (JSON format)
          </label>
          <input
            type="text"
            value={JSON.stringify(limitsForm)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value || '{}');
                setLimitsForm(parsed);
              } catch {
                // Invalid JSON, don't update
              }
            }}
            disabled={operation.inProgress}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
            placeholder='{"posts_per_month": 500}'
            aria-label="Enter custom limits as JSON"
          />
          <p className="text-xs text-gray-600 mt-1">
            Example: {`{"posts_per_month": 500, "channels": 10}`}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleBulkSetTier}
            disabled={selectedOrgIds.size === 0 || operation.inProgress}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            aria-label="Bulk set organization tier"
          >
            Set Tier ({selectedTier})
          </button>
          <button
            onClick={handleBulkSetLimits}
            disabled={selectedOrgIds.size === 0 || operation.inProgress}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            aria-label="Bulk set organization limits"
          >
            Set Limits
          </button>
          <button
            onClick={() => setSelectedOrgIds(new Set())}
            disabled={operation.inProgress}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Clear organization selection"
          >
            Clear Selection
          </button>
        </div>
      </section>

      {/* Operation Result Modal */}
      {(operation.result || operation.error) && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal
          aria-labelledby="operation-result-title"
        >
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex items-start justify-between mb-4">
              <h3
                id="operation-result-title"
                className="text-lg font-bold flex items-center gap-2"
              >
                {operation.error ? (
                  <>
                    <XCircle className="w-5 h-5 text-red-600" />
                    Operation Failed
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    Operation Complete
                  </>
                )}
              </h3>
              <button
                onClick={closeOperationModal}
                className="p-1 hover:bg-gray-100 rounded-lg"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {operation.error ? (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-red-800">{operation.error}</p>
              </div>
            ) : (
              renderOperationResult()
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={closeOperationModal}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In Progress Overlay */}
      {operation.inProgress && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-40"
          role="status"
          aria-live="polite"
          aria-busy
        >
          <div className="bg-white rounded-lg shadow-xl p-6 flex items-center gap-4">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="font-medium">Processing operation...</span>
          </div>
        </div>
      )}
    </div>
  );
}
