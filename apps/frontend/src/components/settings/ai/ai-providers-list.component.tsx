'use client';

import React, { useState } from 'react';
import type { IProviderResponse } from '@gitroom/nestjs-libraries/dtos/ai/ai-provider.types';
import { ProviderTestButton } from './provider-test-button.component';
import { DiscoverModelsButton } from './discover-models-button.component';

/**
 * Component for displaying and managing the list of AI providers
 * Shows provider details and provides actions like test and delete
 */
export function AIProvidersList({
  providers,
  onDelete,
  onRefresh,
}: {
  providers: IProviderResponse[];
  onDelete: (providerId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle provider deletion with confirmation
   */
  async function handleDelete(providerId: string) {
    if (!window.confirm('Are you sure you want to delete this provider?')) {
      return;
    }

    try {
      setDeletingId(providerId);
      setError(null);
      await onDelete(providerId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete provider');
    } finally {
      setDeletingId(null);
    }
  }

  /**
   * Get provider type display name
   */
  function getProviderTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      openai: 'OpenAI',
      anthropic: 'Anthropic (Claude)',
      gemini: 'Google Gemini',
      ollama: 'Ollama (Local)',
      together: 'Together AI',
      'openai-compatible': 'OpenAI Compatible',
    };
    return labels[type] || type;
  }

  /**
   * Get test status badge
   */
  function getTestStatusBadge(provider: IProviderResponse) {
    if (!provider.lastTestedAt) {
      return <span className="text-xs text-gray-500">Not tested</span>;
    }

    if (provider.testStatus === 'SUCCESS') {
      return (
        <span className="text-xs text-green-600 dark:text-green-400">
          ✓ Tested {new Date(provider.lastTestedAt).toLocaleDateString()}
        </span>
      );
    }

    if (provider.testStatus === 'FAILED') {
      return (
        <span className="text-xs text-red-600 dark:text-red-400">
          ✗ Failed {new Date(provider.lastTestedAt).toLocaleDateString()}
        </span>
      );
    }

    return null;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <div className="grid gap-4">
        {providers.map((provider) => (
          <div
            key={provider.id}
            className="p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{provider.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {getProviderTypeLabel(provider.type)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {provider.enabled ? (
                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-xs rounded">
                    Enabled
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-400 text-xs rounded">
                    Disabled
                  </span>
                )}

                {provider.isDefault && (
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 text-xs rounded">
                    Default
                  </span>
                )}
              </div>
            </div>

            {/* Provider Details */}
            <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
              {provider.baseUrl && (
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Base URL</p>
                  <p className="text-xs font-mono text-gray-500 break-all">{provider.baseUrl}</p>
                </div>
              )}

              <div>
                <p className="text-gray-600 dark:text-gray-400">Test Status</p>
                {getTestStatusBadge(provider)}
              </div>
            </div>

            {/* Error message if test failed */}
            {provider.testError && (
              <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-700 dark:text-red-300 border border-red-100 dark:border-red-900/50">
                {provider.testError}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <ProviderTestButton
                providerId={provider.id}
                onSuccess={onRefresh}
              />

              <DiscoverModelsButton
                providerId={provider.id}
                onSuccess={onRefresh}
              />

              <button
                onClick={() => handleDelete(provider.id)}
                disabled={deletingId === provider.id}
                className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50"
              >
                {deletingId === provider.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
