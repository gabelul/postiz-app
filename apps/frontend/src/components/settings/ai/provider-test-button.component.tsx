'use client';

import React, { useState } from 'react';

/**
 * Button component for testing AI provider connectivity and configuration
 * Tests the provider and updates test status
 */
export function ProviderTestButton({
  providerId,
  onSuccess,
}: {
  providerId: string;
  onSuccess?: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ valid: boolean; error?: string } | null>(null);
  const [showResult, setShowResult] = useState(false);

  /**
   * Test the provider configuration
   */
  async function handleTest() {
    try {
      setIsLoading(true);
      setResult(null);

      const response = await fetch(
        `/api/settings/ai/providers/${providerId}/test`,
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
          valid: false,
          error: data.error || 'Provider test failed',
        });
      } else {
        setResult({
          valid: data.valid,
          error: data.error,
        });
      }

      setShowResult(true);

      // Auto-hide success message after 3 seconds
      if (data.valid) {
        setTimeout(() => {
          setShowResult(false);
        }, 3000);
      }

      // Refresh parent component
      onSuccess?.();
    } catch (err) {
      setResult({
        valid: false,
        error: err instanceof Error ? err.message : 'Test failed',
      });
      setShowResult(true);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleTest}
        disabled={isLoading}
        className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-50"
      >
        {isLoading ? 'Testing...' : 'Test'}
      </button>

      {/* Test Result Popup */}
      {showResult && result && (
        <div
          className={`absolute top-full mt-2 right-0 p-3 rounded-lg shadow-lg whitespace-nowrap z-10 ${
            result.valid
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}
        >
          <p
            className={`text-sm ${
              result.valid
                ? 'text-green-800 dark:text-green-400'
                : 'text-red-800 dark:text-red-400'
            }`}
          >
            {result.valid ? '✓ Provider working' : '✗ ' + (result.error || 'Test failed')}
          </p>
        </div>
      )}
    </div>
  );
}
