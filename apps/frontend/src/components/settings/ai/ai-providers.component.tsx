'use client';

import React, { useState, useEffect } from 'react';
import type {
  IProviderResponse,
  ITaskAssignment,
} from '@gitroom/nestjs-libraries/dtos/ai/ai-provider.types';
import { AIProvidersList } from './ai-providers-list.component';
import { AddProviderModal } from './add-provider-modal.component';
import { TaskAssignmentPanel } from './task-assignment.component';

/**
 * Main AI Providers Management Page Component
 * Displays:
 * - List of configured AI providers
 * - Button to add new providers
 * - Task assignments configuration
 */
export function AIProvidersPage() {
  const [providers, setProviders] = useState<IProviderResponse[]>([]);
  const [tasks, setTasks] = useState<ITaskAssignment[]>([]);
  const [isAddingProvider, setIsAddingProvider] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  /**
   * Load providers and task assignments from API
   */
  async function loadData() {
    try {
      setIsLoading(true);
      setError(null);

      const [providersRes, tasksRes] = await Promise.all([
        fetch('/api/settings/ai/providers'),
        fetch('/api/settings/ai/tasks'),
      ]);

      if (!providersRes.ok || !tasksRes.ok) {
        throw new Error('Failed to load AI settings');
      }

      const providersData = (await providersRes.json()) as IProviderResponse[];
      const tasksData = (await tasksRes.json()) as ITaskAssignment[];

      setProviders(providersData);
      setTasks(tasksData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
      console.error('Error loading AI settings:', err);
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Handle provider deletion
   */
  async function handleDeleteProvider(providerId: string) {
    try {
      const response = await fetch(`/api/settings/ai/providers/${providerId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete provider');
      }

      // Reload data
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete provider');
    }
  }

  /**
   * Handle new provider added
   */
  function handleProviderAdded() {
    setIsAddingProvider(false);
    loadData();
  }

  /**
   * Handle task assignment updated
   */
  function handleTaskAssignmentUpdated() {
    loadData();
  }

  return (
    <div className="space-y-8">
      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Providers Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Providers</h2>
          <button
            onClick={() => setIsAddingProvider(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Provider
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="text-gray-500">Loading providers...</div>
          </div>
        ) : providers.length === 0 ? (
          <div className="p-6 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No AI providers configured yet
            </p>
            <button
              onClick={() => setIsAddingProvider(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add First Provider
            </button>
          </div>
        ) : (
          <AIProvidersList
            providers={providers}
            onDelete={handleDeleteProvider}
            onRefresh={loadData}
          />
        )}
      </div>

      {/* Task Assignments Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Task Assignments</h2>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="text-gray-500">Loading task assignments...</div>
          </div>
        ) : (
          <TaskAssignmentPanel
            tasks={tasks}
            providers={providers}
            onUpdate={handleTaskAssignmentUpdated}
          />
        )}
      </div>

      {/* Add Provider Modal */}
      {isAddingProvider && (
        <AddProviderModal
          onClose={() => setIsAddingProvider(false)}
          onSuccess={handleProviderAdded}
        />
      )}
    </div>
  );
}
