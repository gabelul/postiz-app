'use client';

import { useState, useCallback } from 'react';

/**
 * Result type for API calls
 */
export interface ApiCallResult<T> {
  data: T | null;
  error: string | null;
}

/**
 * Reusable hook for handling API calls with consistent error handling
 * Provides loading state, error state, and standardized execution
 *
 * @example
 * const { execute, error, loading, data, clearError } = useApiCall();
 *
 * const handleSubmit = async () => {
 *   const result = await execute(async () => {
 *     const response = await fetch('/api/data');
 *     return await response.json();
 *   });
 *
 *   if (result) {
 *     console.log(result.data);
 *   }
 * };
 */
export function useApiCall<T = any>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);

  /**
   * Execute an async function with error handling
   *
   * @param asyncFn - The async function to execute
   * @param showToast - Optional callback to show toast notifications
   * @returns The result data or null if error occurred
   */
  const execute = useCallback(
    async (
      asyncFn: () => Promise<T>,
      options?: {
        onSuccess?: (data: T) => void;
        onError?: (error: string) => void;
        successMessage?: string;
      }
    ): Promise<ApiCallResult<T>> => {
      setLoading(true);
      setError(null);
      setData(null);

      try {
        const result = await asyncFn();
        setData(result);
        options?.onSuccess?.(result);
        return { data: result, error: null };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        options?.onError?.(message);
        return { data: null, error: message };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Clear the current error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Clear all state (loading, error, data)
   */
  const clearAll = useCallback(() => {
    setLoading(false);
    setError(null);
    setData(null);
  }, []);

  return {
    execute,
    loading,
    error,
    data,
    clearError,
    clearAll,
  };
}

/**
 * Hook for API calls that mutate data
 * Extends useApiCall with additional convenience methods
 */
export function useMutationApiCall<T = any, TVariables = any>() {
  const baseApiCall = useApiCall<T>();

  /**
   * Execute a mutation with variables
   *
   * @param mutationFn - Function that takes variables and returns a Promise
   * @param options - Optional callbacks for success/error
   */
  const mutate = useCallback(
    async (
      mutationFn: (variables: TVariables) => Promise<T>,
      variables?: TVariables,
      options?: {
        onSuccess?: (data: T) => void;
        onError?: (error: string) => void;
        successMessage?: string;
      }
    ): Promise<ApiCallResult<T>> => {
      return baseApiCall.execute(() => mutationFn(variables as TVariables), options);
    },
    [baseApiCall]
  );

  return {
    ...baseApiCall,
    mutate,
  };
}
