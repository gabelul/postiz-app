'use client';

import React, { useState } from 'react';

/**
 * Button component for discovering available models from an AI provider
 * Fetches the list of models supported by the provider and stores them
 */
export function DiscoverModelsButton({
  providerId,
  onSuccess,
}: {
  providerId: string;
  onSuccess?: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; models?: string[]; error?: string } | null>(null);
  const [showResult, setShowResult] = useState(false);

  /**
   * Discover available models from the provider
   */
  async function handleDiscover() {
    try {
      setIsLoading(true);
      setResult(null);

      const response = await fetch(
        `/api/settings/ai/providers/${providerId}/discover-models`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setResult({
          success: false,
          error: data.error || 'Model discovery failed',
        });
      } else {
        setResult({
          success: data.success,
          models: data.models,
          error: data.error,
        });
      }

      setShowResult(true);

      // Auto-hide success message after 5 seconds
      if (data.success) {
        setTimeout(() => {
          setShowResult(false);
        }, 5000);
      }

      // Refresh parent component
      onSuccess?.();
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : 'Discovery failed',
      });
      setShowResult(true);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleDiscover}
        disabled={isLoading}
        className="px-3 py-1 text-sm bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded hover:bg-purple-200 dark:hover:bg-purple-900/40 transition-colors disabled:opacity-50"
      >
        {isLoading ? 'Discovering...' : 'Discover Models'}
      </button>

      {/* Discovery Result Popup */}
      {showResult && result && (
        <div
          className={`absolute top-full mt-2 right-0 p-3 rounded-lg shadow-lg z-10 max-w-xs ${
            result.success
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}
        >
          <p
            className={`text-sm font-medium ${
              result.success
                ? 'text-green-800 dark:text-green-400'
                : 'text-red-800 dark:text-red-400'
            }`}
          >
            {result.success ? `✓ Found ${result.models?.length || 0} models` : '✗ ' + (result.error || 'Discovery failed')}
          </p>
          {result.success && result.models && result.models.length > 0 && (
            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              <p className="font-medium mb-1">Models:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {result.models.slice(0, 5).map((model) => (
                  <li key={model}>{model}</li>
                ))}
                {result.models.length > 5 && (
                  <li>+ {result.models.length - 5} more</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
