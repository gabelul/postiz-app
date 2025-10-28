'use client';

import React, { useState } from 'react';

/**
 * Form data for adding a new AI provider
 * All string fields allow empty values for keyless providers
 */
interface ProviderFormData {
  name: string;
  type: string;
  apiKey: string;
  baseUrl: string;
  customConfig: string;
  isDefault: boolean;
}

/**
 * Modal component for adding a new AI provider
 * Allows users to configure provider details including:
 * - Name, Type, API Key
 * - Optional: Base URL (for custom/compatible providers)
 * - Optional: Custom configuration (JSON)
 */
export function AddProviderModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState<ProviderFormData>({
    name: '',
    type: 'openai',
    apiKey: '',
    baseUrl: '',
    customConfig: '',
    isDefault: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Provider type options with descriptions
   */
  const providerTypes = [
    {
      value: 'openai',
      label: 'OpenAI',
      description: 'GPT models and DALL-E for image generation',
    },
    {
      value: 'anthropic',
      label: 'Anthropic (Claude)',
      description: 'Claude models for advanced reasoning and text generation',
    },
    {
      value: 'gemini',
      label: 'Google Gemini',
      description: 'Gemini models via OpenAI-compatible API',
    },
    {
      value: 'ollama',
      label: 'Ollama (Local)',
      description: 'Run models locally - free, no API key needed',
    },
    {
      value: 'together',
      label: 'Together AI',
      description: 'Open-source models hosted on Together',
    },
    {
      value: 'openai-compatible',
      label: 'OpenAI Compatible',
      description: 'Any OpenAI-compatible API endpoint',
    },
  ];

  /**
   * Handle form field changes
   */
  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      setFormData((prev) => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  }

  /**
   * Handle form submission
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      // Validate required fields
      if (!formData.name.trim()) {
        throw new Error('Provider name is required');
      }

      // Keyless providers: ollama and openai-compatible
      const keylessProviders = ['ollama', 'openai-compatible'];
      if (!formData.apiKey.trim() && !keylessProviders.includes(formData.type)) {
        throw new Error('API key is required for this provider type');
      }

      setIsSubmitting(true);

      // Prepare data for API
      const payload: {
        name: string;
        type: string;
        apiKey?: string;
        baseUrl?: string;
        customConfig?: string;
        isDefault: boolean;
      } = {
        name: formData.name.trim(),
        type: formData.type,
        apiKey: formData.apiKey.trim() || undefined,
        baseUrl: formData.baseUrl.trim() || undefined,
        isDefault: formData.isDefault,
      };

      // Only include customConfig if provided
      if (formData.customConfig.trim()) {
        try {
          JSON.parse(formData.customConfig);
          payload.customConfig = formData.customConfig.trim();
        } catch {
          throw new Error('Custom configuration must be valid JSON');
        }
      }

      // Remove undefined values
      Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);

      const response = await fetch('/api/settings/ai/providers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create provider');
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">Add AI Provider</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Provider Name */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Provider Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., My OpenAI, Production Claude"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>

          {/* Provider Type */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Provider Type <span className="text-red-600">*</span>
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              {providerTypes.map((pt) => (
                <option key={pt.value} value={pt.value}>
                  {pt.label} - {pt.description}
                </option>
              ))}
            </select>
          </div>

          {/* API Key */}
          {!['ollama', 'openai-compatible'].includes(formData.type) && (
            <div>
              <label className="block text-sm font-medium mb-2">
                API Key <span className="text-red-600">*</span>
              </label>
              <input
                type="password"
                name="apiKey"
                value={formData.apiKey}
                onChange={handleChange}
                placeholder="Your API key (encrypted)"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
              />
              <p className="text-xs text-gray-500 mt-1">
                Your API key is encrypted and never stored in plain text
              </p>
            </div>
          )}

          {/* Base URL (for compatible/custom providers) */}
          {['gemini', 'ollama', 'together', 'openai-compatible'].includes(
            formData.type
          ) && (
            <div>
              <label className="block text-sm font-medium mb-2">Base URL</label>
              <input
                type="url"
                name="baseUrl"
                value={formData.baseUrl}
                onChange={handleChange}
                placeholder="e.g., https://api.example.com/v1"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
          )}

          {/* Custom Configuration */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Custom Configuration (JSON)
            </label>
            <textarea
              name="customConfig"
              value={formData.customConfig}
              onChange={handleChange}
              placeholder='e.g., {"model_prefix": "gpt-", "timeout": 30}'
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 font-mono text-xs"
            />
          </div>

          {/* Default Provider */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isDefault"
              id="isDefault"
              checked={formData.isDefault}
              onChange={handleChange}
              className="w-4 h-4"
            />
            <label htmlFor="isDefault" className="text-sm">
              Set as default provider for new tasks
            </label>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Provider'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
