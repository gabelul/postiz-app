'use client';

import { useState, useCallback } from 'react';

/**
 * Reusable hook for managing form state with type safety
 * Prevents the Record<string, any> anti-pattern
 *
 * @template T - The form data interface type
 * @param initialData - The initial form data
 *
 * @example
 * interface MyForm {
 *   name: string;
 *   email: string;
 *   age: number;
 * }
 *
 * const { data, updateField, setData, reset } = useFormState<MyForm>({
 *   name: '',
 *   email: '',
 *   age: 0,
 * });
 */
export function useFormState<T extends Record<string, any>>(initialData: T) {
  const [data, setData] = useState<T>(initialData);

  /**
   * Update a single field in the form data
   * Type-safe - only allows keys that exist in T
   *
   * @param field - The field key to update
   * @param value - The new value for the field
   */
  const updateField = useCallback(
    <K extends keyof T>(field: K, value: T[K]) => {
      setData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  /**
   * Update multiple fields at once
   * Useful for resetting form or patching partial updates
   *
   * @param updates - Partial object with fields to update
   */
  const updateFields = useCallback(
    (updates: Partial<T>) => {
      setData((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  /**
   * Reset form to initial data or custom data
   *
   * @param customData - Optional custom data to reset to (defaults to initialData)
   */
  const reset = useCallback(
    (customData?: T) => {
      setData(customData ?? initialData);
    },
    [initialData]
  );

  return {
    data,
    updateField,
    updateFields,
    setData,
    reset,
  };
}
