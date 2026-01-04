'use client';

/**
 * Admin AI Task Assignments Page
 *
 * Allows superAdmins to configure which AI providers and models to use for different tasks:
 * - Image Generation (DALL-E, Stable Diffusion)
 * - Text Generation (social media posts, content writing)
 * - Video Slides (image prompts and voice text)
 * - Agent / Copilot (AI assistant)
 *
 * Features:
 * - Select primary provider and model for each task
 * - Configure fallback provider and model
 * - Visual task cards with icons and descriptions
 * - Provider and model dropdowns with discovered models
 */

import { useState, useEffect } from 'react';

interface Provider {
  id: string;
  name: string;
  type: string;
  isDefault: boolean;
  models: string[];
}

interface TaskAssignment {
  providerId: string | null;
  providerName: string | null;
  providerType: string | null;
  model: string | null;
  fallbackProviderId: string | null;
  fallbackProviderName: string | null;
  fallbackProviderType: string | null;
  fallbackModel: string | null;
}

interface TaskType {
  key: string;
  label: string;
  description: string;
  icon: string;
  assignment: TaskAssignment | null;
}

interface TaskData {
  taskTypes: TaskType[];
  providers: Provider[];
}

export default function AdminAITasksPage() {
  const [data, setData] = useState<TaskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  // Form state for each task
  const [formData, setFormData] = useState<Record<string, {
    providerId: string;
    model: string;
    fallbackProviderId: string;
    fallbackModel: string;
  }>>({});

  /**
   * Fetch task assignments and available providers
   */
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/admin/settings/ai-tasks/with-providers');

      if (!response.ok) {
        throw new Error(`Failed to fetch task assignments: ${response.statusText}`);
      }

      const result = await response.json();
      setData(result);

      // Initialize form data from existing assignments
      const initialFormData: Record<string, any> = {};
      result.taskTypes.forEach((task: TaskType) => {
        if (task.assignment) {
          initialFormData[task.key] = {
            providerId: task.assignment.providerId || '',
            model: task.assignment.model || '',
            fallbackProviderId: task.assignment.fallbackProviderId || '',
            fallbackModel: task.assignment.fallbackModel || '',
          };
        } else {
          initialFormData[task.key] = {
            providerId: '',
            model: '',
            fallbackProviderId: '',
            fallbackModel: '',
          };
        }
      });
      setFormData(initialFormData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Error fetching task assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Save task assignment
   * @param taskType - The task type to save
   */
  const saveAssignment = async (taskType: string) => {
    const form = formData[taskType];
    if (!form?.providerId || !form?.model) {
      setError('Please select a provider and model for this task');
      return;
    }

    // Validate that if fallback provider is selected, model is also selected
    if (form.fallbackProviderId && !form.fallbackModel) {
      setError('Please select a fallback model or clear the fallback provider');
      return;
    }

    try {
      setSaving({ ...saving, [taskType]: true });
      setError(null);

      const payload: any = {
        providerId: form.providerId,
        model: form.model,
      };

      // Include fallback fields even if empty to allow clearing
      // Explicitly use null to clear fallback, undefined to leave unchanged
      if (form.fallbackProviderId || form.fallbackProviderId === '') {
        payload.fallbackProviderId = form.fallbackProviderId || null;
      }
      if (form.fallbackModel || form.fallbackModel === '') {
        payload.fallbackModel = form.fallbackModel || null;
      }

      const response = await fetch(`/api/admin/settings/ai-tasks/${taskType}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to save assignment: ${response.statusText}`);
      }

      await fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Error saving assignment:', err);
    } finally {
      setSaving((prev) => {
        const updated = { ...prev };
        delete updated[taskType];
        return updated;
      });
    }
  };

  /**
   * Delete task assignment (revert to defaults)
   * @param taskType - The task type to delete
   */
  const deleteAssignment = async (taskType: string) => {
    if (!window.confirm('Remove this assignment and revert to default settings?')) {
      return;
    }

    try {
      setError(null);
      const response = await fetch(`/api/admin/settings/ai-tasks/${taskType}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete assignment: ${response.statusText}`);
      }

      await fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Error deleting assignment:', err);
    }
  };

  /**
   * Get available models for a provider
   * @param providerId - Provider ID
   */
  const getProviderModels = (providerId: string): string[] => {
    const provider = data?.providers.find((p) => p.id === providerId);
    return provider?.models || [];
  };

  /**
   * Update form data for a task
   * @param taskType - The task type
   * @param field - Form field to update
   * @param value - New value
   */
  const updateForm = (taskType: string, field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [taskType]: {
        ...prev[taskType],
        [field]: value,
        // Reset dependent fields when provider changes
        ...(field === 'providerId' ? { model: '' } : {}),
        ...(field === 'fallbackProviderId' ? { fallbackModel: '' } : {}),
      },
    }));
  };

  /**
   * Toggle task expansion
   * @param taskType - The task type to toggle
   */
  const toggleExpand = (taskType: string) => {
    setExpandedTasks((prev) => ({
      ...prev,
      [taskType]: !prev[taskType],
    }));
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center text-textItemBlur py-12">
          Loading AI task assignments...
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8">
        <div className="text-center text-red-400 py-12">
          Failed to load task assignments
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-newTextColor">AI Task Assignment</h1>
        <p className="text-textItemBlur">
          Configure which AI providers and models to use for different tasks.
          Set up fallback providers for redundancy.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          <p className="font-semibold">Error: {error}</p>
        </div>
      )}

      {/* Task Cards */}
      <div className="space-y-4">
        {data.taskTypes.map((task) => {
          const form = formData[task.key] || {
            providerId: '',
            model: '',
            fallbackProviderId: '',
            fallbackModel: '',
          };
          const isSaving = saving[task.key];
          const isExpanded = expandedTasks[task.key];

          // Get models for selected providers
          const primaryModels = form.providerId ? getProviderModels(form.providerId) : [];
          const fallbackModels = form.fallbackProviderId ? getProviderModels(form.fallbackProviderId) : [];

          // Get selected provider info for display
          const primaryProvider = data.providers.find((p) => p.id === form.providerId);
          const fallbackProvider = data.providers.find((p) => p.id === form.fallbackProviderId);

          return (
            <div
              key={task.key}
              className="bg-newBgColorInner rounded-lg border border-newBorder overflow-hidden"
            >
              {/* Task Header */}
              <button
                type="button"
                className="w-full p-6 cursor-pointer hover:bg-newBoxHover transition-colors text-left"
                onClick={() => toggleExpand(task.key)}
                aria-expanded={isExpanded}
                aria-controls={`task-config-${task.key}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-3xl">{task.icon}</div>
                    <div>
                      <h3 className="text-lg font-bold text-newTextColor">{task.label}</h3>
                      <p className="text-sm text-textItemBlur">{task.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {/* Current Assignment Summary */}
                    {task.assignment && primaryProvider && (
                      <div className="text-right">
                        <p className="text-sm font-medium text-newTextColor">
                          {primaryProvider.name} / {form.model}
                        </p>
                        {fallbackProvider && form.fallbackModel && (
                          <p className="text-xs text-textItemBlur">
                            → Fallback: {fallbackProvider.name} / {form.fallbackModel}
                          </p>
                        )}
                      </div>
                    )}
                    <svg
                      className={`w-5 h-5 text-textItemBlur transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>
              </button>

              {/* Expanded Configuration */}
              {isExpanded && (
                <div
                  id={`task-config-${task.key}`}
                  className="border-t border-newBorder p-6 bg-newColColor"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Primary Provider Selection */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold text-newTextColor mb-3">Primary Provider</h4>
                        <label className="block text-sm font-medium text-newTextColor mb-2">
                          Provider
                        </label>
                        <select
                          value={form.providerId}
                          onChange={(e) => updateForm(task.key, 'providerId', e.target.value)}
                          className="w-full px-4 py-2 border border-newBorder rounded-lg bg-newBgColorInner text-newTextColor focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select a provider...</option>
                          {data.providers.map((provider) => (
                            <option key={provider.id} value={provider.id}>
                              {provider.name} ({provider.type})
                              {provider.isDefault ? ' - Default' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {form.providerId && primaryModels.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-newTextColor mb-2">
                            Model
                          </label>
                          <select
                            value={form.model}
                            onChange={(e) => updateForm(task.key, 'model', e.target.value)}
                            className="w-full px-4 py-2 border border-newBorder rounded-lg bg-newBgColorInner text-newTextColor focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select a model...</option>
                            {primaryModels.map((model) => (
                              <option key={model} value={model}>
                                {model}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {form.providerId && primaryModels.length === 0 && (
                        <p className="text-sm text-yellow-500">
                          No models discovered. Run "Discover Models" on the provider.
                        </p>
                      )}
                    </div>

                    {/* Fallback Provider Selection */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold text-newTextColor mb-3">Fallback Provider (Optional)</h4>
                        <label className="block text-sm font-medium text-newTextColor mb-2">
                          Provider
                        </label>
                        <select
                          value={form.fallbackProviderId}
                          onChange={(e) => updateForm(task.key, 'fallbackProviderId', e.target.value)}
                          className="w-full px-4 py-2 border border-newBorder rounded-lg bg-newBgColorInner text-newTextColor focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">No fallback (use default)</option>
                          {data.providers
                            .filter((p) => p.id !== form.providerId)
                            .map((provider) => (
                              <option key={provider.id} value={provider.id}>
                                {provider.name} ({provider.type})
                              </option>
                            ))}
                        </select>
                      </div>

                      {form.fallbackProviderId && fallbackModels.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-newTextColor mb-2">
                            Fallback Model
                          </label>
                          <select
                            value={form.fallbackModel}
                            onChange={(e) => updateForm(task.key, 'fallbackModel', e.target.value)}
                            className="w-full px-4 py-2 border border-newBorder rounded-lg bg-newBgColorInner text-newTextColor focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select a model...</option>
                            {fallbackModels.map((model) => (
                              <option key={model} value={model}>
                                {model}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 mt-6 pt-4 border-t border-newBorder">
                    <button
                      type="button"
                      onClick={() => saveAssignment(task.key)}
                      disabled={isSaving || !form.providerId || !form.model}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-newColColor disabled:text-textItemBlur disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {isSaving ? 'Saving...' : 'Save Assignment'}
                    </button>
                    {task.assignment && (
                      <button
                        type="button"
                        onClick={() => deleteAssignment(task.key)}
                        className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        Remove Assignment
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info Box */}
      <div className="mt-8 bg-blue-500/10 rounded-lg border border-blue-500/20 p-6">
        <h3 className="text-lg font-bold mb-3 text-blue-400">About AI Task Assignment</h3>
        <ul className="space-y-2 text-sm text-textItemBlur">
          <li>• <strong>Primary Provider:</strong> The first AI provider/model used for the task</li>
          <li>• <strong>Fallback Provider:</strong> Used if the primary provider fails or times out</li>
          <li>• <strong>Model Selection:</strong> Choose from discovered models or configure defaults</li>
          <li>• <strong>No Assignment:</strong> If no assignment is set, system defaults are used</li>
        </ul>
        <p className="mt-4 text-xs text-textItemBlur">
          Tip: Run "Discover Models" on the AI Providers page to see available models for each provider.
        </p>
      </div>
    </div>
  );
}
