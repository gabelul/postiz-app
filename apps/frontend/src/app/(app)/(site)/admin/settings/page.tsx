'use client';

/**
 * Admin Settings Management Page
 *
 * Allows superAdmins to:
 * - Manage system-wide settings as key-value pairs
 * - Configure subscription tier definitions and pricing
 * - Enable/disable system-wide feature flags
 * - Configure global AI provider settings
 *
 * Only accessible by superAdmins
 */

import { useState, useEffect } from 'react';

/**
 * Represents a system setting
 * Stores key-value configuration pairs with audit trail
 */
interface SystemSetting {
  id: string;
  key: string;
  value: string;
  description: string | null;
  updatedBy: string;
  updatedAt: string;
  createdAt: string;
}

/**
 * Represents a feature flag
 * System-wide toggles for enabling/disabling features
 */
interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string;
}

/**
 * Represents a subscription tier configuration
 * Defines limits and pricing for each tier level
 */
interface TierConfig {
  current: string;
  month_price: number;
  year_price: number;
  channels: number;
  posts_per_month: number;
  image_generation_count: number;
  image_generator: boolean;
  team_members: boolean;
  ai: boolean;
  public_api: boolean;
  webhooks: number;
  autoPost: boolean;
  generate_videos: number;
}

/**
 * Represents global AI provider configuration
 */
interface AIProviderConfig {
  key: string;
  config: Record<string, any>;
  description: string;
}

export default function AdminSettingsPage() {
  // ==================== State Management ====================

  // Tab navigation state
  const [activeTab, setActiveTab] = useState<'system' | 'tiers' | 'features' | 'ai'>('system');

  // System Settings state
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [newSetting, setNewSetting] = useState({ key: '', value: '', description: '' });
  const [editingSetting, setEditingSetting] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [editingDescription, setEditingDescription] = useState('');

  // Tier Management state
  const [tiers, setTiers] = useState<Record<string, TierConfig>>({});
  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [tierForm, setTierForm] = useState<Record<string, any>>({});

  // Feature Flags state
  const [features, setFeatures] = useState<FeatureFlag[]>([]);

  // AI Providers state
  const [aiProviders, setAiProviders] = useState<AIProviderConfig[]>([]);
  const [editingAI, setEditingAI] = useState<string | null>(null);
  const [aiForm, setAiForm] = useState<Record<string, any>>({});

  // Common state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ==================== Fetch Functions ====================

  /**
   * Load system settings from backend
   */
  const loadSystemSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/admin/settings/system', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to load system settings');
      const data = await response.json();
      setSettings(data.settings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load tier configurations from backend
   */
  const loadTiers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/admin/settings/tiers', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to load tier configurations');
      const data = await response.json();
      setTiers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load feature flags from backend
   */
  const loadFeatures = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/admin/settings/features', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to load feature flags');
      const data = await response.json();
      setFeatures(data.flags || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load global AI provider configurations from backend
   */
  const loadAIProviders = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/admin/settings/ai-providers/global', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to load AI provider configurations');
      const data = await response.json();
      setAiProviders(data.providers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // ==================== System Settings Actions ====================

  /**
   * Create or update a system setting
   */
  const saveSetting = async (key: string, value: string, description?: string) => {
    try {
      setError(null);

      // Determine if updating or creating
      const isUpdate = settings.some(s => s.key === key);
      const method = isUpdate ? 'PUT' : 'POST';
      const url = isUpdate ? `/api/admin/settings/system/${key}` : '/api/admin/settings/system';

      const body = isUpdate
        ? { value, description }
        : { key, value, description };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Failed to save setting');

      // Reload settings
      await loadSystemSettings();
      setNewSetting({ key: '', value: '', description: '' });
      setEditingSetting(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  /**
   * Delete a system setting
   */
  const deleteSetting = async (key: string) => {
    if (!window.confirm(`Delete setting "${key}"?`)) return;
    try {
      setError(null);
      const response = await fetch(`/api/admin/settings/system/${key}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to delete setting');
      await loadSystemSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // ==================== Tier Management Actions ====================

  /**
   * Update a tier configuration
   */
  const saveTier = async (tierName: string) => {
    try {
      setError(null);
      const response = await fetch(`/api/admin/settings/tiers/${tierName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tierForm),
      });
      if (!response.ok) throw new Error('Failed to save tier configuration');
      await loadTiers();
      setEditingTier(null);
      setTierForm({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  /**
   * Reset a tier to default configuration
   */
  const resetTier = async (tierName: string) => {
    if (!window.confirm(`Reset ${tierName} tier to default configuration?`)) return;
    try {
      setError(null);
      const response = await fetch(`/api/admin/settings/tiers/${tierName}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to reset tier');
      await loadTiers();
      setEditingTier(null);
      setTierForm({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // ==================== Feature Flags Actions ====================

  /**
   * Toggle a feature flag
   */
  const toggleFeature = async (featureName: string, currentState: boolean) => {
    try {
      setError(null);
      const response = await fetch(`/api/admin/settings/features/${featureName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentState }),
      });
      if (!response.ok) throw new Error('Failed to toggle feature');
      await loadFeatures();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // ==================== AI Provider Actions ====================

  /**
   * Save global AI provider configuration
   */
  const saveAIProvider = async (providerName: string) => {
    try {
      setError(null);
      const response = await fetch(`/api/admin/settings/ai-providers/global/${providerName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiForm),
      });
      if (!response.ok) throw new Error('Failed to save AI provider configuration');
      await loadAIProviders();
      setEditingAI(null);
      setAiForm({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // ==================== Effects ====================

  /**
   * Load data when tab changes
   */
  useEffect(() => {
    if (activeTab === 'system') loadSystemSettings();
    else if (activeTab === 'tiers') loadTiers();
    else if (activeTab === 'features') loadFeatures();
    else if (activeTab === 'ai') loadAIProviders();
  }, [activeTab]);

  // ==================== Render ====================

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">System Settings</h1>
        <p className="text-gray-600">Manage system-wide configuration, tiers, features, and AI providers</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          <p className="font-semibold">Error: {error}</p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="mb-8 border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('system')}
            className={`px-4 py-2 font-semibold border-b-2 transition ${
              activeTab === 'system'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            System Settings
          </button>
          <button
            onClick={() => setActiveTab('tiers')}
            className={`px-4 py-2 font-semibold border-b-2 transition ${
              activeTab === 'tiers'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Tier Configuration
          </button>
          <button
            onClick={() => setActiveTab('features')}
            className={`px-4 py-2 font-semibold border-b-2 transition ${
              activeTab === 'features'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Feature Flags
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`px-4 py-2 font-semibold border-b-2 transition ${
              activeTab === 'ai'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Global AI Providers
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8 text-gray-500">
          Loading settings...
        </div>
      )}

      {/* System Settings Tab */}
      {!loading && activeTab === 'system' && (
        <div className="space-y-6">
          {/* Add New Setting */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4">Add New Setting</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Setting Key</label>
                <input
                  type="text"
                  placeholder="e.g., billing.stripe_key"
                  value={newSetting.key}
                  onChange={(e) => setNewSetting({ ...newSetting, key: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Value</label>
                <input
                  type="text"
                  placeholder="Setting value"
                  value={newSetting.value}
                  onChange={(e) => setNewSetting({ ...newSetting, value: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Optional description"
                  value={newSetting.description}
                  onChange={(e) => setNewSetting({ ...newSetting, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <button
              onClick={() => saveSetting(newSetting.key, newSetting.value, newSetting.description)}
              disabled={!newSetting.key || !newSetting.value}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              Add Setting
            </button>
          </div>

          {/* Settings List */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-sm">Key</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">Value</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">Description</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {settings.length === 0 ? (
                    <tr className="border-b border-gray-100">
                      <td colSpan={4} className="py-8 px-4 text-center text-gray-500">
                        No settings configured
                      </td>
                    </tr>
                  ) : (
                    settings.map((setting) => (
                      <tr key={setting.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-4 text-sm font-mono">{setting.key}</td>
                        <td className="py-4 px-4 text-sm max-w-md truncate">
                          {editingSetting === setting.id ? (
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          ) : (
                            setting.value
                          )}
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-600">
                          {editingSetting === setting.id ? (
                            <input
                              type="text"
                              value={editingDescription}
                              onChange={(e) => setEditingDescription(e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          ) : (
                            setting.description || '-'
                          )}
                        </td>
                        <td className="py-4 px-4 text-sm flex gap-2">
                          {editingSetting === setting.id ? (
                            <>
                              <button
                                onClick={() => saveSetting(setting.key, editingValue, editingDescription)}
                                className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingSetting(null)}
                                className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setEditingSetting(setting.id);
                                  setEditingValue(setting.value);
                                  setEditingDescription(setting.description || '');
                                }}
                                className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteSetting(setting.key)}
                                className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tier Configuration Tab */}
      {!loading && activeTab === 'tiers' && (
        <div className="grid grid-cols-1 gap-6">
          {Object.entries(tiers).map(([tierName, config]) => (
            <div key={tierName} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">{tierName} Tier</h3>
                {editingTier !== tierName && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingTier(tierName);
                        setTierForm({ ...config });
                      }}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => resetTier(tierName)}
                      className="px-3 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                    >
                      Reset to Default
                    </button>
                  </div>
                )}
              </div>

              {editingTier === tierName ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Monthly Price</label>
                      <input
                        type="number"
                        value={tierForm.month_price || ''}
                        onChange={(e) => setTierForm({ ...tierForm, month_price: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Yearly Price</label>
                      <input
                        type="number"
                        value={tierForm.year_price || ''}
                        onChange={(e) => setTierForm({ ...tierForm, year_price: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Channels</label>
                      <input
                        type="number"
                        value={tierForm.channels || ''}
                        onChange={(e) => setTierForm({ ...tierForm, channels: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Posts Per Month</label>
                      <input
                        type="number"
                        value={tierForm.posts_per_month || ''}
                        onChange={(e) => setTierForm({ ...tierForm, posts_per_month: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Image Generation Count</label>
                      <input
                        type="number"
                        value={tierForm.image_generation_count || ''}
                        onChange={(e) => setTierForm({ ...tierForm, image_generation_count: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Video Generation Count</label>
                      <input
                        type="number"
                        value={tierForm.generate_videos || ''}
                        onChange={(e) => setTierForm({ ...tierForm, generate_videos: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Webhooks</label>
                      <input
                        type="number"
                        value={tierForm.webhooks || ''}
                        onChange={(e) => setTierForm({ ...tierForm, webhooks: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {['image_generator', 'team_members', 'ai', 'public_api', 'autoPost'].map((feature) => (
                      <label key={feature} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tierForm[feature] || false}
                          onChange={(e) => setTierForm({ ...tierForm, [feature]: e.target.checked })}
                          className="w-4 h-4 border border-gray-300 rounded"
                        />
                        <span className="text-sm capitalize">{feature.replace(/_/g, ' ')}</span>
                      </label>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => saveTier(tierName)}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Save Tier
                    </button>
                    <button
                      onClick={() => setEditingTier(null)}
                      className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div><span className="font-semibold">Monthly:</span> ${config.month_price}</div>
                  <div><span className="font-semibold">Yearly:</span> ${config.year_price}</div>
                  <div><span className="font-semibold">Channels:</span> {config.channels}</div>
                  <div><span className="font-semibold">Posts/Month:</span> {config.posts_per_month}</div>
                  <div><span className="font-semibold">Images:</span> {config.image_generation_count}</div>
                  <div><span className="font-semibold">Videos:</span> {config.generate_videos}</div>
                  <div><span className="font-semibold">Webhooks:</span> {config.webhooks}</div>
                  <div><span className="font-semibold">AI:</span> {config.ai ? '✓' : '✗'}</div>
                  <div><span className="font-semibold">Team:</span> {config.team_members ? '✓' : '✗'}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Feature Flags Tab */}
      {!loading && activeTab === 'features' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-sm">Feature</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">Description</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">Action</th>
                </tr>
              </thead>
              <tbody>
                {features.length === 0 ? (
                  <tr className="border-b border-gray-100">
                    <td colSpan={4} className="py-8 px-4 text-center text-gray-500">
                      No feature flags configured
                    </td>
                  </tr>
                ) : (
                  features.map((feature) => (
                    <tr key={feature.key} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4 text-sm font-mono">{feature.key}</td>
                      <td className="py-4 px-4 text-sm text-gray-600">{feature.description}</td>
                      <td className="py-4 px-4 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          feature.enabled
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {feature.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-sm">
                        <button
                          onClick={() => toggleFeature(feature.key, feature.enabled)}
                          className={`px-3 py-1 rounded text-xs font-semibold text-white ${
                            feature.enabled
                              ? 'bg-red-600 hover:bg-red-700'
                              : 'bg-green-600 hover:bg-green-700'
                          }`}
                        >
                          {feature.enabled ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Global AI Providers Tab */}
      {!loading && activeTab === 'ai' && (
        <div className="space-y-6">
          {aiProviders.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
              No global AI providers configured
            </div>
          ) : (
            aiProviders.map((provider) => (
              <div key={provider.key} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-lg font-bold">{provider.key}</h3>
                    <p className="text-sm text-gray-600">{provider.description}</p>
                  </div>
                  {editingAI !== provider.key && (
                    <button
                      onClick={() => {
                        setEditingAI(provider.key);
                        setAiForm(provider.config);
                      }}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {editingAI === provider.key ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Name</label>
                        <input
                          type="text"
                          value={aiForm.name || ''}
                          onChange={(e) => setAiForm({ ...aiForm, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Type</label>
                        <input
                          type="text"
                          value={aiForm.type || ''}
                          onChange={(e) => setAiForm({ ...aiForm, type: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Model</label>
                        <input
                          type="text"
                          value={aiForm.model || ''}
                          onChange={(e) => setAiForm({ ...aiForm, model: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={aiForm.default || false}
                            onChange={(e) => setAiForm({ ...aiForm, default: e.target.checked })}
                            className="w-4 h-4 border border-gray-300 rounded"
                          />
                          <span className="text-sm">Default Provider</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => saveAIProvider(provider.key.split('.').pop() || '')}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Save Configuration
                      </button>
                      <button
                        onClick={() => setEditingAI(null)}
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div><span className="font-semibold">Type:</span> {provider.config.type || '-'}</div>
                    <div><span className="font-semibold">Model:</span> {provider.config.model || '-'}</div>
                    <div><span className="font-semibold">Default:</span> {provider.config.default ? 'Yes' : 'No'}</div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
