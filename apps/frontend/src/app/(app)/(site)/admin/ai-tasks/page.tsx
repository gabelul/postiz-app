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
 * - Searchable provider and model dropdowns
 * - Two provider selection strategies:
 *   - Fallback Mode: Primary provider with optional fallback
 *   - Round-Robin Mode: Multiple providers that rotate in order
 * - Visual task cards with icons and descriptions
 * - Drag-and-drop reordering for round-robin providers
 */

import { useState, useEffect, useCallback } from 'react';
import { ErrorBoundary } from '@gitroom/frontend/components/ui/error-boundary';
import { LoadingSkeleton, CardGridSkeleton } from '@gitroom/frontend/components/ui/loading-skeleton';
import { SearchableSelect } from '@gitroom/frontend/components/ui/searchable-select';
import { areYouSure } from '@gitroom/frontend/components/layout/new-modal';
import { useToaster } from '@gitroom/react/toaster/toaster';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Round-robin provider entry
 */
interface RoundRobinProvider {
  providerId: string;
  model: string;
}

/**
 * AI Provider with available models
 */
interface Provider {
  id: string;
  name: string;
  type: string;
  isDefault: boolean;
  models: string[];
}

/**
 * Task assignment configuration from API
 */
interface TaskAssignment {
  strategy: 'fallback' | 'round-robin';
  providerId: string | null;
  providerName: string | null;
  providerType: string | null;
  model: string | null;
  fallbackProviderId: string | null;
  fallbackProviderName: string | null;
  fallbackProviderType: string | null;
  fallbackModel: string | null;
  roundRobinProviders: RoundRobinProvider[] | null;
}

/**
 * Task type definition
 */
interface TaskType {
  key: string;
  label: string;
  description: string;
  icon: string;
  modelRecommendation?: string;
  assignment: TaskAssignment | null;
}

/**
 * API response data structure
 */
interface TaskData {
  taskTypes: TaskType[];
  providers: Provider[];
}

/**
 * Form data for a single task assignment
 */
interface TaskForm {
  strategy: 'fallback' | 'round-robin';
  providerId: string;
  model: string;
  fallbackProviderId: string;
  fallbackModel: string;
  roundRobinProviders: RoundRobinProvider[];
}

/**
 * All task forms indexed by task key
 */
interface TaskForms {
  [taskKey: string]: TaskForm;
}

// ============================================================================
// Main Component
// ============================================================================

function AdminAITasksPageContent() {
  const toaster = useToaster();

  // State
  const [data, setData] = useState<TaskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState<TaskForms>({});

  // ============================================================================
  // Data Fetching
  // ============================================================================

  /**
   * Fetch task assignments and available providers
   */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/settings/ai-tasks/with-providers');

      if (!response.ok) {
        throw new Error(`Failed to fetch task assignments: ${response.statusText}`);
      }

      const result = await response.json();
      setData(result);

      // Initialize form data from existing assignments
      const initialFormData: TaskForms = {};
      result.taskTypes.forEach((task: TaskType) => {
        if (task.assignment) {
          initialFormData[task.key] = {
            strategy: task.assignment.strategy || 'fallback',
            providerId: task.assignment.providerId || '',
            model: task.assignment.model || '',
            fallbackProviderId: task.assignment.fallbackProviderId || '',
            fallbackModel: task.assignment.fallbackModel || '',
            roundRobinProviders: task.assignment.roundRobinProviders || [],
          };
        } else {
          initialFormData[task.key] = {
            strategy: 'fallback',
            providerId: '',
            model: '',
            fallbackProviderId: '',
            fallbackModel: '',
            roundRobinProviders: [],
          };
        }
      });
      setFormData(initialFormData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toaster.show(message, 'warning');
      console.error('Error fetching task assignments:', err);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Save task assignment
   * @param taskType - The task type to save
   */
  const saveAssignment = useCallback(
    async (taskType: string) => {
      const form = formData[taskType];
      if (!form) return;

      // Validation based on strategy
      if (form.strategy === 'fallback') {
        if (!form.providerId || !form.model) {
          toaster.show('Please select a provider and model for this task', 'warning');
          return;
        }
        if (form.fallbackProviderId && !form.fallbackModel) {
          toaster.show('Please select a fallback model or clear the fallback provider', 'warning');
          return;
        }
      } else if (form.strategy === 'round-robin') {
        if (form.roundRobinProviders.length === 0) {
          toaster.show('Please add at least one provider to the round-robin rotation', 'warning');
          return;
        }
        // Validate all round-robin providers have models
        const missingModel = form.roundRobinProviders.some(rp => !rp.model);
        if (missingModel) {
          toaster.show('Please select a model for all providers in the rotation', 'warning');
          return;
        }
      }

      try {
        setSaving((prev) => ({ ...prev, [taskType]: true }));

        const payload: {
          providerId: string;
          model: string;
          strategy: string;
          fallbackProviderId?: string | null;
          fallbackModel?: string | null;
          roundRobinProviders?: RoundRobinProvider[];
        } = {
          providerId: form.strategy === 'fallback' ? form.providerId : form.roundRobinProviders[0]?.providerId || '',
          model: form.strategy === 'fallback' ? form.model : form.roundRobinProviders[0]?.model || '',
          strategy: form.strategy,
          roundRobinProviders: form.strategy === 'round-robin' ? form.roundRobinProviders : undefined,
          fallbackProviderId: form.strategy === 'fallback' ? (form.fallbackProviderId || null) : undefined,
          fallbackModel: form.strategy === 'fallback' ? (form.fallbackModel || null) : undefined,
        };

        const response = await fetch(`/api/admin/settings/ai-tasks/${taskType}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: response.statusText }));
          throw new Error(errorData.message || `Failed to save assignment: ${response.statusText}`);
        }

        await fetchData();
        toaster.show('Task assignment saved successfully', 'success');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        toaster.show(message, 'warning');
        console.error('Error saving assignment:', err);
      } finally {
        setSaving((prev) => {
          const updated = { ...prev };
          delete updated[taskType];
          return updated;
        });
      }
    },
    [formData, saving, fetchData, toaster] // eslint-disable-line react-hooks/exhaustive-deps
  );

  /**
   * Delete task assignment (revert to defaults)
   * @param taskType - The task type to delete
   * @param taskLabel - Human-readable task label for confirmation
   */
  const deleteAssignment = useCallback(
    async (taskType: string, taskLabel: string) => {
      const confirmed = await areYouSure({
        title: 'Remove Task Assignment',
        description: `Are you sure you want to remove the assignment for "${taskLabel}"? This will revert to default settings.`,
        approveLabel: 'Remove',
        cancelLabel: 'Cancel',
      });

      if (!confirmed) return;

      try {
        const response = await fetch(`/api/admin/settings/ai-tasks/${taskType}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error(`Failed to delete assignment: ${response.statusText}`);
        }

        await fetchData();
        toaster.show('Task assignment removed successfully', 'success');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        toaster.show(message, 'warning');
        console.error('Error deleting assignment:', err);
      }
    },
    [fetchData, toaster] // eslint-disable-line react-hooks/exhaustive-deps
  );

  /**
   * Get available models for a provider
   * @param providerId - Provider ID
   */
  const getProviderModels = useCallback(
    (providerId: string): string[] => {
      const provider = data?.providers.find((p) => p.id === providerId);
      return provider?.models || [];
    },
    [data]
  );

  /**
   * Update form data for a task
   * @param taskType - The task type
   * @param updates - Field updates to apply
   */
  const updateForm = useCallback((taskType: string, updates: Partial<TaskForm>) => {
    setFormData((prev) => {
      const current = prev[taskType];
      return {
        ...prev,
        [taskType]: {
          ...current,
          ...updates,
          // Reset dependent fields when provider changes
          ...(updates.providerId !== undefined ? { model: '' } : {}),
        },
      };
    });
  }, []);

  /**
   * Add a provider to round-robin rotation
   * @param taskType - The task type
   */
  const addRoundRobinProvider = useCallback((taskType: string) => {
    setFormData((prev) => {
      const current = prev[taskType];
      return {
        ...prev,
        [taskType]: {
          ...current,
          roundRobinProviders: [
            ...current.roundRobinProviders,
            { providerId: '', model: '' },
          ],
        },
      };
    });
  }, []);

  /**
   * Remove a provider from round-robin rotation
   * @param taskType - The task type
   * @param index - Index of provider to remove
   */
  const removeRoundRobinProvider = useCallback((taskType: string, index: number) => {
    setFormData((prev) => {
      const current = prev[taskType];
      return {
        ...prev,
        [taskType]: {
          ...current,
          roundRobinProviders: current.roundRobinProviders.filter((_, i) => i !== index),
        },
      };
    });
  }, []);

  /**
   * Update a round-robin provider entry
   * @param taskType - The task type
   * @param index - Index of provider to update
   * @param field - Field to update ('providerId' or 'model')
   * @param value - New value
   */
  const updateRoundRobinProvider = useCallback((
    taskType: string,
    index: number,
    field: 'providerId' | 'model',
    value: string
  ) => {
    setFormData((prev) => {
      const current = prev[taskType];
      const updated = [...current.roundRobinProviders];
      updated[index] = {
        ...updated[index],
        [field]: value,
        // Reset model when provider changes
        ...(field === 'providerId' ? { model: '' } : {}),
      };
      return {
        ...prev,
        [taskType]: {
          ...current,
          roundRobinProviders: updated,
        },
      };
    });
  }, []);

  /**
   * Move a provider in the round-robin list
   * @param taskType - The task type
   * @param index - Current index of provider
   * @param direction - 'up' or 'down'
   */
  const moveRoundRobinProvider = useCallback((
    taskType: string,
    index: number,
    direction: 'up' | 'down'
  ) => {
    setFormData((prev) => {
      const current = prev[taskType];
      const providers = [...current.roundRobinProviders];
      const newIndex = direction === 'up' ? index - 1 : index + 1;

      if (newIndex < 0 || newIndex >= providers.length) return prev;

      [providers[index], providers[newIndex]] = [providers[newIndex], providers[index]];

      return {
        ...prev,
        [taskType]: {
          ...current,
          roundRobinProviders: providers,
        },
      };
    });
  }, []);

  /**
   * Toggle task expansion
   * @param taskType - The task type to toggle
   */
  const toggleExpand = useCallback((taskType: string) => {
    setExpandedTasks((prev) => ({
      ...prev,
      [taskType]: !prev[taskType],
    }));
  }, []);

  // Load data on component mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get provider options for SearchableSelect
  const getProviderOptions = useCallback((): { value: string; label: string }[] => {
    if (!data) return [];
    return data.providers.map((p) => ({
      value: p.id,
      label: `${p.name} (${p.type})${p.isDefault ? ' - Default' : ''}`,
    }));
  }, [data]);

  // Get model options for SearchableSelect
  const getModelOptions = useCallback((providerId: string): { value: string; label: string }[] => {
    const models = getProviderModels(providerId);
    return models.map((m) => ({ value: m, label: m }));
  }, [getProviderModels]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="p-8">
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-newTextColor">
          AI Task Assignment
        </h1>
        <p className="text-textItemBlur">
          Configure which AI providers and models to use for different tasks.
          Choose between fallback mode or round-robin rotation.
        </p>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="py-8" role="status" aria-live="polite">
          <CardGridSkeleton cards={4} />
        </div>
      ) : !data ? (
        <div className="p-8 text-center text-red-400" role="alert">
          Failed to load task assignments. Please try refreshing the page.
        </div>
      ) : (
        <>
          {/* Task Cards */}
          <div className="space-y-4">
            {data.taskTypes.map((task) => {
              const form = formData[task.key] || {
                strategy: 'fallback',
                providerId: '',
                model: '',
                fallbackProviderId: '',
                fallbackModel: '',
                roundRobinProviders: [],
              };
              const isSaving = saving[task.key];
              const isExpanded = expandedTasks[task.key];

              // Get models for selected providers
              const primaryModels = form.providerId ? getProviderModels(form.providerId) : [];
              const fallbackModels = form.fallbackProviderId ? getProviderModels(form.fallbackProviderId) : [];

              // Get selected provider info for display
              const primaryProvider = data.providers.find((p) => p.id === form.providerId);
              const fallbackProvider = data.providers.find((p) => p.id === form.fallbackProviderId);

              // Get round-robin provider names for summary
              const roundRobinNames = form.roundRobinProviders
                .map((rp) => {
                  const p = data.providers.find((prov) => prov.id === rp.providerId);
                  return p ? `${p.name}/${rp.model}` : null;
                })
                .filter(Boolean) as string[];

              return (
                <div
                  key={task.key}
                  className="bg-newBgColorInner rounded-lg border border-newBorder overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Task Header */}
                  <button
                    type="button"
                    className="w-full p-6 cursor-pointer hover:bg-newBoxHover transition-colors text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                    onClick={() => toggleExpand(task.key)}
                    aria-expanded={isExpanded}
                    aria-controls={`task-config-${task.key}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-3xl" aria-hidden="true">{task.icon}</div>
                        <div>
                          <h3 className="text-lg font-bold text-newTextColor">{task.label}</h3>
                          <p className="text-sm text-textItemBlur">{task.description}</p>
                          {task.modelRecommendation && (
                            <p className="text-xs text-blue-400 mt-1">💡 {task.modelRecommendation}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {/* Current Assignment Summary */}
                        {task.assignment && (
                          <div className="text-right">
                            {task.assignment.strategy === 'round-robin' && roundRobinNames.length > 0 ? (
                              <>
                                <p className="text-sm font-medium text-newTextColor">
                                  Round-Robin ({roundRobinNames.length} providers)
                                </p>
                                <p className="text-xs text-textItemBlur">
                                  {roundRobinNames.slice(0, 2).join(' → ')}
                                  {roundRobinNames.length > 2 && ' ...'}
                                </p>
                              </>
                            ) : primaryProvider ? (
                              <>
                                <p className="text-sm font-medium text-newTextColor">
                                  {primaryProvider.name} / {form.model}
                                </p>
                                {fallbackProvider && form.fallbackModel && (
                                  <p className="text-xs text-textItemBlur">
                                    → Fallback: {fallbackProvider.name} / {form.fallbackModel}
                                  </p>
                                )}
                              </>
                            ) : null}
                          </div>
                        )}
                        <svg
                          className={`w-5 h-5 text-textItemBlur transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
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
                      role="region"
                      aria-label={`Configuration for ${task.label}`}
                    >
                      {/* Strategy Selection */}
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-newTextColor mb-3">
                          Provider Selection Strategy
                        </label>
                        <div className="flex gap-4">
                          <button
                            type="button"
                            onClick={() => updateForm(task.key, { strategy: 'fallback' })}
                            className={`
                              px-4 py-2 rounded-lg border transition-colors
                              ${form.strategy === 'fallback'
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'bg-newBgColorInner border-newBorder text-newTextColor hover:bg-newBoxHover'
                              }
                            `}
                          >
                            Fallback Mode
                          </button>
                          <button
                            type="button"
                            onClick={() => updateForm(task.key, { strategy: 'round-robin' })}
                            className={`
                              px-4 py-2 rounded-lg border transition-colors
                              ${form.strategy === 'round-robin'
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'bg-newBgColorInner border-newBorder text-newTextColor hover:bg-newBoxHover'
                              }
                            `}
                          >
                            Round-Robin Mode
                          </button>
                        </div>
                      </div>

                      {/* Fallback Mode Configuration */}
                      {form.strategy === 'fallback' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Primary Provider Selection */}
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-semibold text-newTextColor mb-3">Primary Provider</h4>
                              <label htmlFor={`primary-provider-${task.key}`} className="block text-sm font-medium text-newTextColor mb-2">
                                Provider
                              </label>
                              <SearchableSelect
                                value={form.providerId}
                                onChange={(value) => updateForm(task.key, { providerId: value })}
                                options={getProviderOptions()}
                                placeholder="Search providers..."
                              />
                            </div>

                            {form.providerId && primaryModels.length > 0 && (
                              <div>
                                <label htmlFor={`primary-model-${task.key}`} className="block text-sm font-medium text-newTextColor mb-2">
                                  Model
                                </label>
                                <SearchableSelect
                                  value={form.model}
                                  onChange={(value) => updateForm(task.key, { model: value })}
                                  options={getModelOptions(form.providerId)}
                                  placeholder="Search models..."
                                />
                              </div>
                            )}

                            {form.providerId && primaryModels.length === 0 && (
                              <p className="text-sm text-yellow-500" role="alert">
                                No models discovered. Run "Discover Models" on the provider.
                              </p>
                            )}
                          </div>

                          {/* Fallback Provider Selection */}
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-semibold text-newTextColor mb-3">Fallback Provider (Optional)</h4>
                              <label htmlFor={`fallback-provider-${task.key}`} className="block text-sm font-medium text-newTextColor mb-2">
                                Provider
                              </label>
                              <SearchableSelect
                                value={form.fallbackProviderId}
                                onChange={(value) => updateForm(task.key, { fallbackProviderId: value })}
                                options={getProviderOptions().filter((opt) => opt.value !== form.providerId)}
                                placeholder="No fallback (use default)"
                              />
                            </div>

                            {form.fallbackProviderId && fallbackModels.length > 0 && (
                              <div>
                                <label htmlFor={`fallback-model-${task.key}`} className="block text-sm font-medium text-newTextColor mb-2">
                                  Fallback Model
                                </label>
                                <SearchableSelect
                                  value={form.fallbackModel}
                                  onChange={(value) => updateForm(task.key, { fallbackModel: value })}
                                  options={getModelOptions(form.fallbackProviderId)}
                                  placeholder="Search models..."
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Round-Robin Mode Configuration */}
                      {form.strategy === 'round-robin' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-semibold text-newTextColor">
                              Round-Robin Providers ({form.roundRobinProviders.length})
                            </h4>
                            <button
                              type="button"
                              onClick={() => addRoundRobinProvider(task.key)}
                              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            >
                              + Add Provider
                            </button>
                          </div>

                          {form.roundRobinProviders.length === 0 ? (
                            <div className="text-center py-8 bg-newBgColorInner rounded-lg border border-dashed border-newBorder">
                              <p className="text-textItemBlur mb-2">No providers in rotation</p>
                              <button
                                type="button"
                                onClick={() => addRoundRobinProvider(task.key)}
                                className="text-blue-400 hover:text-blue-300"
                              >
                                + Add your first provider
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {form.roundRobinProviders.map((rp, index) => {
                                const provider = data.providers.find((p) => p.id === rp.providerId);
                                const models = provider ? getProviderModels(provider.id) : [];
                                const providerOptions = getProviderOptions().filter(
                                  (opt) => !form.roundRobinProviders.some((otherRp, otherIdx) =>
                                    otherIdx !== index && otherRp.providerId === opt.value
                                  )
                                );

                                return (
                                  <div
                                    key={index}
                                    className="flex items-start gap-3 p-4 bg-newBgColorInner rounded-lg border border-newBorder"
                                  >
                                    {/* Drag handle */}
                                    <div className="flex flex-col gap-1 pt-1">
                                      <button
                                        type="button"
                                        onClick={() => moveRoundRobinProvider(task.key, index, 'up')}
                                        disabled={index === 0}
                                        className="p-1 text-textItemBlur hover:text-newTextColor disabled:opacity-30 disabled:cursor-not-allowed"
                                        aria-label="Move up"
                                      >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path d="M12 19V5M5 12l7-7 7 7" />
                                        </svg>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => moveRoundRobinProvider(task.key, index, 'down')}
                                        disabled={index === form.roundRobinProviders.length - 1}
                                        className="p-1 text-textItemBlur hover:text-newTextColor disabled:opacity-30 disabled:cursor-not-allowed"
                                        aria-label="Move down"
                                      >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path d="M12 5v14M5 12l7 7 7-7" />
                                        </svg>
                                      </button>
                                    </div>

                                    {/* Rotation indicator */}
                                    <div className="flex-shrink-0 pt-1">
                                      <span className="text-lg font-bold text-blue-400">{index + 1}</span>
                                    </div>

                                    {/* Provider and model selects */}
                                    <div className="flex-1 grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-xs font-medium text-newTextColor mb-1">
                                          Provider
                                        </label>
                                        <SearchableSelect
                                          value={rp.providerId}
                                          onChange={(value) => updateRoundRobinProvider(task.key, index, 'providerId', value)}
                                          options={providerOptions}
                                          placeholder="Select provider..."
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-newTextColor mb-1">
                                          Model
                                        </label>
                                        <SearchableSelect
                                          value={rp.model}
                                          onChange={(value) => updateRoundRobinProvider(task.key, index, 'model', value)}
                                          options={models.map((m) => ({ value: m, label: m }))}
                                          placeholder="Select model..."
                                        />
                                      </div>
                                    </div>

                                    {/* Remove button */}
                                    <button
                                      type="button"
                                      onClick={() => removeRoundRobinProvider(task.key, index)}
                                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                                      aria-label="Remove provider"
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M18 6L6 18M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <p className="text-sm text-textItemBlur">
                            Providers will be used in the order shown above. The first provider is used first,
                            then the next, and so on. After the last provider, it cycles back to the first.
                          </p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-3 mt-6 pt-4 border-t border-newBorder">
                        <button
                          type="button"
                          onClick={() => saveAssignment(task.key)}
                          disabled={isSaving}
                          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-newColColor disabled:text-textItemBlur disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-newColColor"
                          aria-live="polite"
                        >
                          {isSaving ? 'Saving...' : 'Save Assignment'}
                        </button>
                        {task.assignment && (
                          <button
                            type="button"
                            onClick={() => deleteAssignment(task.key, task.label)}
                            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-newColColor"
                            aria-label={`Remove assignment for ${task.label}`}
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
          <div
            className="mt-8 bg-blue-500/10 rounded-lg border border-blue-500/20 p-6"
            role="region"
            aria-labelledby="info-box-title"
          >
            <h3 id="info-box-title" className="text-lg font-bold mb-3 text-blue-400">
              About AI Task Assignment
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-newTextColor mb-2">Fallback Mode</h4>
                <ul className="space-y-1 text-sm text-textItemBlur">
                  <li>• Primary provider is used first</li>
                  <li>• Fallback provider is used if primary fails</li>
                  <li>• Good for: Simple redundancy with a backup</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-newTextColor mb-2">Round-Robin Mode</h4>
                <ul className="space-y-1 text-sm text-textItemBlur">
                  <li>• Multiple providers rotate in sequence</li>
                  <li>• Distributes load across all providers</li>
                  <li>• Good for: Load balancing and cost optimization</li>
                </ul>
              </div>
            </div>
            <p className="mt-4 text-xs text-textItemBlur">
              Tip: Run "Discover Models" on the AI Providers page to see available models for each provider.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Export with Error Boundary
// ============================================================================

export default function AdminAITasksPage() {
  return (
    <ErrorBoundary
      onError={(error) => {
        console.error('AI Tasks page error:', error);
      }}
    >
      <AdminAITasksPageContent />
    </ErrorBoundary>
  );
}
