'use client';

import { Metadata } from 'next';
import { AIProvidersPage } from '@gitroom/frontend/components/settings/ai/ai-providers.component';

/**
 * AI Providers Settings Page
 * Allows users to manage AI providers and task assignments
 */
export default function AISettingsPage() {
  return (
    <div className="flex flex-col gap-8 pb-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">AI Providers</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Configure and manage AI providers for different tasks
        </p>
      </div>

      <AIProvidersPage />
    </div>
  );
}
