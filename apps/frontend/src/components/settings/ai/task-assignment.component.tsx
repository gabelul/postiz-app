'use client';

import React, { useState } from 'react';

/**
 * Component for assigning AI providers and models to different tasks
 * Allows users to configure:
 * - Image generation (DALL-E, etc.)
 * - Text generation (GPT, Claude, etc.)
 * - Video slide generation
 * - AI Agent (Mastra)
 * With fallback provider support
 */
export function TaskAssignmentPanel({
  tasks,
  providers,
  onUpdate,
}: {
  tasks: any[];
  providers: any[];
  onUpdate: () => void;
}) {
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Task type configurations with descriptions
   */
  const taskTypes = [
    {
      type: 'image',
      label: 'Image Generation',
      description: 'Used for generating images with DALL-E or other image models',
    },
    {
      type: 'text',
      label: 'Text Generation',
      description: 'Used for generating posts, captions, and text content',
    },
    {
      type: 'video-slides',
      label: 'Video Slides',
      description: 'Used for generating slide content and narration for videos',
    },
    {
      type: 'agent',
      label: 'AI Agent',
      description: 'Used for the Mastra AI agent for complex reasoning tasks',
    },
  ];

  /**
   * Get provider label with type
   * Returns a safe label even if provider is undefined
   * @param provider - Provider object with name and type
   * @returns Formatted provider label
   */
  function getProviderLabel(provider: any): string {
    if (!provider) {
      return 'Unknown Provider';
    }
    return `${provider.name || 'Unknown'} (${provider.type || 'unknown'})`;
  }

  /**
   * Start editing a task
   * Handles both existing tasks and new task configurations
   * @param task - Task assignment to edit, or null for new configuration
   * @param taskType - Task type to edit (required when task is null)
   */
  function startEditing(task: any, taskType?: string) {
    const type = task?.taskType || taskType;
    if (!type) return; // Safety check

    setEditingTask(type);
    setFormData({
      [type]: {
        // Use provider.id if task exists and has provider, otherwise use empty string
        providerId: task?.provider?.id || '',
        model: task?.model || '',
        fallbackProviderId: task?.fallbackProvider?.id || '',
        fallbackModel: task?.fallbackModel || '',
      },
    });
    setError(null);
  }

  /**
   * Handle form field changes
   */
  function handleChange(
    taskType: string,
    field: string,
    value: any
  ) {
    setFormData((prev) => ({
      ...prev,
      [taskType]: {
        ...prev[taskType],
        [field]: value,
      },
    }));
  }

  /**
   * Save task assignment
   */
  async function handleSave(taskType: string) {
    try {
      setError(null);
      const data = formData[taskType];

      if (!data.providerId) {
        throw new Error('Provider is required');
      }
      if (!data.model.trim()) {
        throw new Error('Model name is required');
      }

      setIsSaving(true);

      const payload: any = {
        providerId: data.providerId,
        model: data.model.trim(),
      };

      if (data.fallbackProviderId) {
        payload.fallbackProviderId = data.fallbackProviderId;
        if (data.fallbackModel.trim()) {
          payload.fallbackModel = data.fallbackModel.trim();
        }
      }

      const response = await fetch(
        `/api/settings/ai/tasks/${taskType}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update task assignment');
      }

      setEditingTask(null);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Get models for a provider (this is a simple implementation)
   * In a real app, you might fetch available models from the provider
   */
  function getModelsForProvider(providerId: string): string[] {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return [];

    // Parse available models if stored
    if (provider.availableModels) {
      try {
        return JSON.parse(provider.availableModels);
      } catch {
        return [];
      }
    }

    // Return default models based on type
    const modelsByType: Record<string, string[]> = {
      openai: ['gpt-4.1', 'gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo', 'dall-e-3', 'dall-e-2'],
      anthropic: [
        'claude-3-opus-20250219',
        'claude-3-5-sonnet-20241022',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
      ],
      gemini: ['gemini-2.0-flash', 'gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'],
      ollama: ['mistral', 'llama2', 'neural-chat', 'dolphin-mixtral'],
      together: [
        'meta-llama/Llama-3-70b-chat-hf',
        'mistralai/Mixtral-8x22B-Instruct',
      ],
    };

    return modelsByType[provider.type] || [];
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <div className="grid gap-4">
        {taskTypes.map((taskType) => {
          const task = tasks.find((t) => t.taskType === taskType.type);
          const isEditing = editingTask === taskType.type;
          const data = formData[taskType.type] || {};

          return (
            <div
              key={taskType.type}
              className="p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900"
            >
              <h3 className="font-semibold text-lg mb-1">{taskType.label}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {taskType.description}
              </p>

              {isEditing ? (
                <div className="space-y-4">
                  {/* Primary Provider */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Provider <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={data.providerId || ''}
                      onChange={(e) =>
                        handleChange(taskType.type, 'providerId', e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                    >
                      <option value="">Select a provider</option>
                      {providers
                        .filter((p) => p.enabled)
                        .map((provider) => (
                          <option key={provider.id} value={provider.id}>
                            {getProviderLabel(provider)}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Model */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Model <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={data.model || ''}
                      onChange={(e) =>
                        handleChange(taskType.type, 'model', e.target.value)
                      }
                      placeholder="e.g., gpt-4.1, claude-3-opus-20250219"
                      list={`models-${taskType.type}`}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                    />
                    {data.providerId && (
                      <datalist id={`models-${taskType.type}`}>
                        {getModelsForProvider(data.providerId).map((model) => (
                          <option key={model} value={model} />
                        ))}
                      </datalist>
                    )}
                  </div>

                  {/* Fallback Provider */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Fallback Provider (Optional)
                    </label>
                    <select
                      value={data.fallbackProviderId || ''}
                      onChange={(e) =>
                        handleChange(
                          taskType.type,
                          'fallbackProviderId',
                          e.target.value
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                    >
                      <option value="">None</option>
                      {providers
                        .filter((p) => p.id !== data.providerId && p.enabled)
                        .map((provider) => (
                          <option key={provider.id} value={provider.id}>
                            {getProviderLabel(provider)}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Fallback Model */}
                  {data.fallbackProviderId && (
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Fallback Model
                      </label>
                      <input
                        type="text"
                        value={data.fallbackModel || ''}
                        onChange={(e) =>
                          handleChange(
                            taskType.type,
                            'fallbackModel',
                            e.target.value
                          )
                        }
                        placeholder="e.g., gpt-4o-mini"
                        list={`fallback-models-${taskType.type}`}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                      />
                      {data.fallbackProviderId && (
                        <datalist id={`fallback-models-${taskType.type}`}>
                          {getModelsForProvider(
                            data.fallbackProviderId
                          ).map((model) => (
                            <option key={model} value={model} />
                          ))}
                        </datalist>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingTask(null)}
                      className="flex-1 px-3 py-2 bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSave(taskType.type)}
                      disabled={isSaving}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  {task ? (
                    <div className="space-y-2 mb-4">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Provider
                        </p>
                        <p className="font-mono text-sm">
                          {getProviderLabel(task.provider)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Model
                        </p>
                        <p className="font-mono text-sm">{task.model}</p>
                      </div>
                      {task.fallbackProvider && (
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Fallback
                          </p>
                          <p className="font-mono text-sm">
                            {getProviderLabel(task.fallbackProvider)}/{task.fallbackModel}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 mb-4">Not configured</p>
                  )}

                  <button
                    onClick={() => startEditing(task, taskType.type)}
                    className="px-4 py-2 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/40 transition-colors"
                  >
                    {task ? 'Edit' : 'Configure'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
