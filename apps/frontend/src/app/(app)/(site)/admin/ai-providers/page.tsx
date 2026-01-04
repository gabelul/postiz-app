'use client';

/**
 * Admin AI Providers Configuration Page
 *
 * Allows superAdmins to:
 * - View and manage all configured AI providers (OpenAI, Anthropic, Gemini, Ollama, Together AI, FAL, ElevenLabs, custom endpoints)
 * - Add new providers with API keys and custom base URLs
 * - Discover available models for each provider
 * - Test provider connectivity and configuration
 * - Set default provider for different AI tasks
 * - Enable/disable specific providers
 * - Configure custom endpoints for OpenAI-compatible APIs
 *
 * Supports providers:
 * - OpenAI (GPT-4, GPT-3.5-turbo, DALL-E)
 * - Anthropic (Claude models)
 * - Google Gemini (via OpenAI-compatible API)
 * - Ollama (local LLMs)
 * - Together AI (open-source models)
 * - OpenAI-compatible (custom endpoints)
 * - FAL.ai (image generation: Ideogram, FLUX, Stable Diffusion)
 * - ElevenLabs (text-to-speech voice generation)
 *
 * Only accessible by superAdmins
 */

import { useState, useEffect } from 'react';

interface AIProvider {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'together' | 'openai-compatible' | 'fal' | 'elevenlabs';
  apiKey: string;
  baseUrl?: string;
  isDefault: boolean;
  testStatus?: 'success' | 'failed' | 'pending';
  testError?: string;
  availableModels?: string | null; // Stored as JSON string in database
  createdAt: string;
}

export default function AdminAIProvidersPage() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [discoveringId, setDiscoveringId] = useState<string | null>(null);

  /**
   * Form state for adding/editing providers
   * Includes validation and error handling
   */
  const [formData, setFormData] = useState<{
    name: string;
    type: 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'together' | 'openai-compatible' | 'fal' | 'elevenlabs';
    apiKey: string;
    baseUrl: string;
  }>({
    name: '',
    type: 'openai',
    apiKey: '',
    baseUrl: '',
  });

  /**
   * Parse available models from JSON string (as stored in database)
   * Returns empty array if null, undefined, or invalid JSON
   */
  const parseAvailableModels = (modelsJson: string | null | undefined): string[] => {
    if (!modelsJson) return [];
    try {
      const parsed = JSON.parse(modelsJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  /**
   * Provider type descriptions, default URLs, and capabilities
   * Capabilities indicate which AI features the provider supports
   */
  const providerTypes: Record<
    string,
    {
      label: string;
      description: string;
      defaultUrl: string;
      requiresKey: boolean;
      capabilities: string[];
    }
  > = {
    openai: {
      label: 'OpenAI',
      description: 'GPT-4, GPT-3.5-turbo, DALL-E, TTS models',
      defaultUrl: 'https://api.openai.com/v1',
      requiresKey: true,
      capabilities: ['text', 'image', 'tts'],
    },
    anthropic: {
      label: 'Anthropic',
      description: 'Claude models (Claude-3, etc.) - Text only',
      defaultUrl: 'https://api.anthropic.com',
      requiresKey: true,
      capabilities: ['text'],
    },
    gemini: {
      label: 'Google Gemini',
      description: 'Gemini Pro models - Text, Image generation, TTS',
      defaultUrl: 'https://generativelanguage.googleapis.com/openai/',
      requiresKey: true,
      capabilities: ['text', 'image', 'tts'],
    },
    ollama: {
      label: 'Ollama',
      description: 'Local LLM server - Text only (depends on model)',
      defaultUrl: 'http://localhost:11434/v1',
      requiresKey: false,
      capabilities: ['text'],
    },
    together: {
      label: 'Together AI',
      description: 'Open-source models - Text, Image generation',
      defaultUrl: 'https://api.together.xyz/v1',
      requiresKey: true,
      capabilities: ['text', 'image', 'tts'],
    },
    'openai-compatible': {
      label: 'Custom OpenAI-Compatible',
      description: 'Any OpenAI-compatible endpoint - capabilities vary',
      defaultUrl: 'http://localhost:8000/v1',
      requiresKey: false,
      capabilities: ['text', 'image', 'tts'],
    },
    fal: {
      label: 'FAL.ai',
      description: 'Image generation via FAL API (Ideogram, FLUX, Stable Diffusion)',
      defaultUrl: 'https://fal.run',
      requiresKey: true,
      capabilities: ['image'],
    },
    elevenlabs: {
      label: 'ElevenLabs',
      description: 'Text-to-speech voice generation API - TTS only',
      defaultUrl: 'https://api.elevenlabs.io',
      requiresKey: true,
      capabilities: ['tts'],
    },
  };

  /**
   * Fetch all configured AI providers from backend
   * Loads provider list with test status and available models
   */
  const fetchProviders = async () => {
    try {
      // Only show loading message on initial load, not on refresh
      if (!initialLoadDone) {
        setLoading(true);
      }
      setError(null);
      const response = await fetch('/api/admin/settings/ai-providers', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch providers: ${response.statusText}`);
      }

      const data = await response.json();
      setProviders(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Error fetching providers:', err);
    } finally {
      setLoading(false);
      setInitialLoadDone(true);
    }
  };

  /**
   * Add or update an AI provider configuration
   * Validates input and sends to backend
   */
  const handleSaveProvider = async () => {
    // Validate required fields
    if (!formData.name.trim()) {
      setError('Provider name is required');
      return;
    }

    if (
      providerTypes[formData.type as keyof typeof providerTypes].requiresKey &&
      !formData.apiKey.trim()
    ) {
      setError(`API key is required for ${formData.type}`);
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        name: formData.name,
        type: formData.type,
        apiKey: formData.apiKey,
        baseUrl:
          formData.baseUrl ||
          providerTypes[formData.type as keyof typeof providerTypes].defaultUrl,
      };

      const method = editingId ? 'PUT' : 'POST';
      const url = editingId
        ? `/api/admin/settings/ai-providers/${editingId}`
        : '/api/admin/settings/ai-providers';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to save provider: ${response.statusText}`);
      }

      // Reset form and refresh list
      setFormData({ name: '', type: 'openai', apiKey: '', baseUrl: '' });
      setEditingId(null);
      setShowAddForm(false);
      await fetchProviders();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Error saving provider:', err);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Test AI provider connectivity and configuration
   * Validates API key and endpoint are working correctly
   */
  const handleTestProvider = async (providerId: string) => {
    // Prevent duplicate test calls
    if (testingId === providerId) return;

    // Remove focus from button to prevent visual flicker
    (document.activeElement as HTMLElement)?.blur();

    try {
      setTestingId(providerId);
      setError(null);

      const response = await fetch(
        `/api/admin/settings/ai-providers/${providerId}/test`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Test failed: ${response.statusText}`);
      }

      // Refresh providers to show updated test status
      await fetchProviders();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Error testing provider:', err);
    } finally {
      setTestingId(null);
    }
  };

  /**
   * Discover available models for a specific AI provider
   * Queries the provider API for list of available models
   */
  const handleDiscoverModels = async (providerId: string) => {
    try {
      setDiscoveringId(providerId);
      setError(null);

      const response = await fetch(
        `/api/admin/settings/ai-providers/${providerId}/discover-models`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Model discovery failed: ${response.statusText}`);
      }

      // Refresh providers to show newly discovered models
      await fetchProviders();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Error discovering models:', err);
    } finally {
      setDiscoveringId(null);
    }
  };

  /**
   * Delete an AI provider configuration
   * Removes provider and all associated task assignments
   */
  const handleDeleteProvider = async (providerId: string) => {
    if (!window.confirm('Are you sure you want to delete this provider?')) {
      return;
    }

    try {
      setError(null);
      const response = await fetch(`/api/admin/settings/ai-providers/${providerId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete provider: ${response.statusText}`);
      }

      // Refresh list
      await fetchProviders();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Error deleting provider:', err);
    }
  };

  /**
   * Set a provider as default for all AI tasks
   * Only one provider can be default at a time
   */
  const handleSetDefault = async (providerId: string) => {
    try {
      setError(null);
      const response = await fetch(
        `/api/admin/settings/ai-providers/${providerId}/set-default`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to set default: ${response.statusText}`);
      }

      // Refresh list
      await fetchProviders();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Error setting default:', err);
    }
  };

  /**
   * Load providers on component mount
   */
  useEffect(() => {
    fetchProviders();
  }, []);

  return (
    <div className="p-8">
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-newTextColor">AI Provider Configuration</h1>
        <p className="text-textItemBlur">
          Manage AI providers, API keys, custom endpoints, and model discovery
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          <p className="font-semibold">Error: {error}</p>
        </div>
      )}

      {/* Add Provider Button */}
      {!showAddForm && !editingId && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowAddForm(true);
          }}
          className="mb-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          + Add Provider
        </button>
      )}

      {/* Add/Edit Provider Form */}
      {(showAddForm || editingId) && (
        <div className="mb-8 bg-newBgColorInner rounded-lg border border-newBorder p-6">
          <h2 className="text-xl font-bold mb-6 text-newTextColor">
            {editingId ? 'Edit Provider' : 'Add New Provider'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Provider Name */}
            <div>
              <label className="block text-sm font-medium text-newTextColor mb-2">
                Provider Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., My OpenAI Prod, Test Anthropic"
                className="w-full px-4 py-2 border border-newBorder rounded-lg bg-newBgColorInner text-newTextColor focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-textItemBlur"
              />
            </div>

            {/* Provider Type */}
            <div>
              <label className="block text-sm font-medium text-newTextColor mb-2">
                Provider Type
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as typeof formData.type,
                    baseUrl: '', // Reset URL when changing type
                  })
                }
                className="w-full px-4 py-2 border border-newBorder rounded-lg bg-newBgColorInner text-newTextColor focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(providerTypes).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>

            {/* API Key */}
            <div>
              <label className="block text-sm font-medium text-newTextColor mb-2">
                API Key
                {!providerTypes[formData.type as keyof typeof providerTypes].requiresKey ? (
                  <span className="text-textItemBlur text-xs font-normal ml-2">(optional)</span>
                ) : editingId ? (
                  <span className="text-yellow-500 text-xs font-normal ml-2">(leave empty to keep existing)</span>
                ) : null}
              </label>
              <input
                type="password"
                value={formData.apiKey}
                onChange={(e) =>
                  setFormData({ ...formData, apiKey: e.target.value })
                }
                placeholder={
                  editingId
                    ? 'Enter new API key (leave empty to keep existing)'
                    : providerTypes[formData.type as keyof typeof providerTypes].requiresKey
                    ? 'Enter your API key'
                    : 'Enter API key (if required by provider)'
                }
                className="w-full px-4 py-2 border border-newBorder rounded-lg bg-newBgColorInner text-newTextColor focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-textItemBlur"
              />
              {editingId && (
                <p className="text-xs text-textItemBlur mt-1">
                  For security, the existing API key is not displayed. Leave this field empty to keep the current key, or enter a new one to change it.
                </p>
              )}
              {!providerTypes[formData.type as keyof typeof providerTypes].requiresKey && !editingId && (
                <p className="text-xs text-textItemBlur mt-1">
                  This provider type doesn't require an API key by default, but you may provide one if needed.
                </p>
              )}
            </div>

            {/* Base URL */}
            <div>
              <label className="block text-sm font-medium text-newTextColor mb-2">
                Base URL{' '}
                <span className="text-textItemBlur text-xs">(optional)</span>
              </label>
              <input
                type="text"
                value={formData.baseUrl}
                onChange={(e) =>
                  setFormData({ ...formData, baseUrl: e.target.value })
                }
                placeholder={
                  providerTypes[formData.type].defaultUrl
                }
                className="w-full px-4 py-2 border border-newBorder rounded-lg bg-newBgColorInner text-newTextColor focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-textItemBlur"
              />
              <p className="text-xs text-textItemBlur mt-1">
                Default: {providerTypes[formData.type].defaultUrl}
              </p>
            </div>
          </div>

          {/* Form Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSaveProvider();
              }}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-newColColor disabled:text-textItemBlur disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {saving ? 'Saving...' : editingId ? 'Update Provider' : 'Add Provider'}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowAddForm(false);
                setEditingId(null);
                setFormData({ name: '', type: 'openai', apiKey: '', baseUrl: '' });
              }}
              className="px-6 py-2 bg-newColColor text-newTextColor rounded-lg hover:bg-newBoxHover transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Providers List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading && !showAddForm && !editingId ? (
          <div className="col-span-full p-8 text-center text-textItemBlur">
            Loading AI providers...
          </div>
        ) : providers.length === 0 ? (
          <div className="col-span-full p-8 text-center text-textItemBlur">
            No AI providers configured yet. Add one to get started.
          </div>
        ) : (
          providers.map((provider) => {
            const parsedModels = parseAvailableModels(provider.availableModels);

            return (
            <div
              key={provider.id}
              className="bg-newBgColorInner rounded-lg border border-newBorder p-6 hover:shadow-md transition-shadow"
            >
              {/* Provider Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-newTextColor">{provider.name}</h3>
                  <p className="text-sm text-textItemBlur">
                    {
                      providerTypes[provider.type as keyof typeof providerTypes]
                        .label
                    }
                  </p>
                </div>

                {/* Status Badge */}
                <div className="ml-4">
                  {provider.isDefault ? (
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-semibold">
                      Default
                    </span>
                  ) : provider.testStatus === 'success' ? (
                    <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-semibold">
                      Connected
                    </span>
                  ) : provider.testStatus === 'failed' ? (
                    <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-semibold">
                      Failed
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-newColColor text-textItemBlur rounded-full text-xs font-semibold">
                      Not Tested
                    </span>
                  )}
                </div>
              </div>

              {/* Provider Details */}
              {provider.baseUrl && (
                <p className="text-xs text-textItemBlur mb-3">
                  <span className="font-semibold">Endpoint:</span> {provider.baseUrl}
                </p>
              )}

              {/* Available Models */}
              {parsedModels.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-newTextColor mb-2">
                    Available Models ({parsedModels.length}):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {parsedModels.slice(0, 5).map((model) => (
                      <span
                        key={model}
                        className="px-2 py-1 bg-newColColor text-textItemBlur rounded text-xs"
                      >
                        {model}
                      </span>
                    ))}
                    {parsedModels.length > 5 && (
                      <span className="px-2 py-1 text-newTextColor text-xs font-semibold">
                        +{parsedModels.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Test Error Message */}
              {provider.testError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
                  <p className="font-semibold">Test Error:</p>
                  <p>{provider.testError}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  {!provider.isDefault && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSetDefault(provider.id);
                      }}
                      className="flex-1 px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      Set as Default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleTestProvider(provider.id);
                    }}
                    disabled={testingId === provider.id}
                    className="flex-1 px-3 py-2 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 transition-colors font-medium disabled:bg-newColColor disabled:text-textItemBlur disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  >
                    {testingId === provider.id ? 'Testing...' : 'Test'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDiscoverModels(provider.id);
                  }}
                  disabled={discoveringId === provider.id}
                  className="w-full px-3 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 transition-colors font-medium disabled:bg-newColColor disabled:text-textItemBlur disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {discoveringId === provider.id
                    ? 'Discovering...'
                    : 'Discover Models'}
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Pre-populate form with existing provider data for editing
                      setFormData({
                        name: provider.name,
                        type: provider.type,
                        apiKey: '', // Don't pre-fill API key for security - user must re-enter
                        baseUrl: provider.baseUrl || providerTypes[provider.type]?.defaultUrl || '',
                      });
                      setEditingId(provider.id);
                      setShowAddForm(true);
                    }}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteProvider(provider.id);
                    }}
                    className="flex-1 px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
            );
          })
        )}
      </div>

      {/* Provider Type Reference */}
      {!showAddForm && !editingId && (
        <div className="mt-12 bg-blue-500/10 rounded-lg border border-blue-500/20 p-6">
          <h3 className="text-lg font-bold mb-4 text-blue-400">
            Supported Provider Types
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(providerTypes).map(([key, config]) => (
              <div key={key} className="bg-newBgColorInner rounded p-4 border border-blue-500/20">
                <h4 className="font-bold text-sm mb-1 text-newTextColor">{config.label}</h4>
                <p className="text-xs text-textItemBlur mb-2">
                  {config.description}
                </p>
                <p className="text-xs text-textItemBlur">
                  <span className="font-semibold">Default URL:</span>{' '}
                  {config.defaultUrl}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
