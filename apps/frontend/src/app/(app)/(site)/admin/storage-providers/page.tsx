'use client';

/**
 * Admin Storage Providers Page
 *
 * Allows superAdmins to:
 * - Configure storage backend (where files are uploaded)
 * - Support 5 storage provider types:
 *   1. Local - File system storage
 *   2. Cloudflare R2 - S3-compatible cloud storage
 *   3. S3-Compatible - AWS S3, MinIO, DigitalOcean, Backblaze, Wasabi
 *   4. FTP - Standard FTP and FTPS (FTP over SSL/TLS)
 *   5. SFTP - Secure FTP over SSH with password or key authentication
 * - Test connectivity to verify configuration
 * - View current storage usage
 * - Manage storage per organization
 *
 * Only accessible by superAdmins
 */

import { useState, useEffect } from 'react';

/**
 * Represents a storage provider configuration
 */
interface StorageProvider {
  id: string;
  type: 'LOCAL' | 'CLOUDFLARE_R2' | 'S3_COMPATIBLE' | 'FTP' | 'SFTP';
  name: string;
  isActive: boolean;
  config: Record<string, any>;
  usageGB?: number;
  lastTestedAt?: string;
  testStatus?: 'success' | 'error' | 'pending';
  testError?: string;
}

/**
 * Provider type definitions and their configuration fields
 */
const PROVIDER_TYPES: Record<string, {
  label: string;
  description: string;
  fields: Array<{
    key: string;
    label: string;
    type: string;
    required: boolean;
    placeholder: string;
  }>;
}> = {
  LOCAL: {
    label: 'Local Storage',
    description: 'Store files on the server file system',
    fields: [
      {
        key: 'path',
        label: 'Upload Path',
        type: 'text',
        required: true,
        placeholder: '/uploads',
      },
    ],
  },
  CLOUDFLARE_R2: {
    label: 'Cloudflare R2',
    description: 'S3-compatible cloud storage by Cloudflare',
    fields: [
      {
        key: 'accountId',
        label: 'Account ID',
        type: 'text',
        required: true,
        placeholder: 'Your Cloudflare account ID',
      },
      {
        key: 'bucketName',
        label: 'Bucket Name',
        type: 'text',
        required: true,
        placeholder: 'your-bucket-name',
      },
      {
        key: 'accessKeyId',
        label: 'Access Key ID',
        type: 'password',
        required: true,
        placeholder: 'R2 access key ID',
      },
      {
        key: 'secretAccessKey',
        label: 'Secret Access Key',
        type: 'password',
        required: true,
        placeholder: 'R2 secret access key',
      },
      {
        key: 'region',
        label: 'Region',
        type: 'text',
        required: false,
        placeholder: 'auto (or specific region)',
      },
    ],
  },
  S3_COMPATIBLE: {
    label: 'S3-Compatible',
    description: 'AWS S3, MinIO, DigitalOcean Spaces, Backblaze B2, Wasabi, etc.',
    fields: [
      {
        key: 'endpoint',
        label: 'Endpoint URL',
        type: 'text',
        required: true,
        placeholder: 'https://s3.amazonaws.com or https://minio.example.com',
      },
      {
        key: 'bucketName',
        label: 'Bucket Name',
        type: 'text',
        required: true,
        placeholder: 'your-bucket-name',
      },
      {
        key: 'accessKeyId',
        label: 'Access Key ID',
        type: 'password',
        required: true,
        placeholder: 'AWS/provider access key',
      },
      {
        key: 'secretAccessKey',
        label: 'Secret Access Key',
        type: 'password',
        required: true,
        placeholder: 'AWS/provider secret access key',
      },
      {
        key: 'region',
        label: 'Region',
        type: 'text',
        required: false,
        placeholder: 'us-east-1 (or your provider region)',
      },
      {
        key: 'useSSL',
        label: 'Use SSL/TLS',
        type: 'checkbox',
        required: false,
        placeholder: 'Always enabled for security',
      },
    ],
  },
  FTP: {
    label: 'FTP Storage',
    description: 'Standard FTP and FTPS (FTP over SSL/TLS)',
    fields: [
      {
        key: 'host',
        label: 'FTP Host',
        type: 'text',
        required: true,
        placeholder: 'ftp.example.com or 192.168.1.1',
      },
      {
        key: 'port',
        label: 'Port',
        type: 'number',
        required: false,
        placeholder: '21 (default) or 990 (FTPS)',
      },
      {
        key: 'username',
        label: 'Username',
        type: 'text',
        required: true,
        placeholder: 'ftp_user',
      },
      {
        key: 'password',
        label: 'Password',
        type: 'password',
        required: true,
        placeholder: 'FTP password',
      },
      {
        key: 'remotePath',
        label: 'Remote Path',
        type: 'text',
        required: false,
        placeholder: '/uploads or /public_html/uploads',
      },
      {
        key: 'useFTPS',
        label: 'Use FTPS (SSL/TLS)',
        type: 'checkbox',
        required: false,
        placeholder: 'Secure FTP connection',
      },
    ],
  },
  SFTP: {
    label: 'SFTP Storage',
    description: 'Secure FTP over SSH with password or key authentication',
    fields: [
      {
        key: 'host',
        label: 'SFTP Host',
        type: 'text',
        required: true,
        placeholder: 'sftp.example.com or 192.168.1.1',
      },
      {
        key: 'port',
        label: 'Port',
        type: 'number',
        required: false,
        placeholder: '22 (default SSH port)',
      },
      {
        key: 'username',
        label: 'Username',
        type: 'text',
        required: true,
        placeholder: 'sftp_user',
      },
      {
        key: 'authType',
        label: 'Authentication Type',
        type: 'select',
        required: true,
        placeholder: 'password or privateKey',
      },
      {
        key: 'password',
        label: 'Password (if using password auth)',
        type: 'password',
        required: false,
        placeholder: 'SSH password',
      },
      {
        key: 'privateKey',
        label: 'Private Key (if using key auth)',
        type: 'textarea',
        required: false,
        placeholder: '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----',
      },
      {
        key: 'remotePath',
        label: 'Remote Path',
        type: 'text',
        required: false,
        placeholder: '/uploads or /home/user/uploads',
      },
    ],
  },
};

export default function AdminStorageProvidersPage() {
  // ==================== State Management ====================

  const [providers, setProviders] = useState<StorageProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('LOCAL');
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);

  // ==================== Fetch Functions ====================

  /**
   * Load storage providers from backend
   */
  const loadProviders = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/admin/storage-providers', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to load storage providers');
      const data = await response.json();
      setProviders(data.providers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // ==================== Provider Actions ====================

  /**
   * Save or update a storage provider
   */
  const saveProvider = async (name: string) => {
    try {
      setError(null);
      const isUpdate = editingProviderId !== null;
      const method = isUpdate ? 'PUT' : 'POST';
      const url = isUpdate
        ? `/api/admin/storage-providers/${editingProviderId}`
        : '/api/admin/storage-providers';

      const body = {
        name,
        type: selectedType,
        config: formData,
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Failed to save storage provider');

      await loadProviders();
      setEditingProviderId(null);
      setFormData({});
      setSelectedType('LOCAL');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  /**
   * Delete a storage provider
   */
  const deleteProvider = async (providerId: string) => {
    if (!window.confirm('Delete this storage provider?')) return;
    try {
      setError(null);
      const response = await fetch(`/api/admin/storage-providers/${providerId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to delete storage provider');
      await loadProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  /**
   * Test connectivity to storage provider
   */
  const testProvider = async (providerId: string) => {
    try {
      setError(null);
      setTestingProviderId(providerId);
      const response = await fetch(`/api/admin/storage-providers/${providerId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Storage provider test failed');
      await loadProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setTestingProviderId(null);
    }
  };

  /**
   * Set provider as active
   */
  const activateProvider = async (providerId: string) => {
    try {
      setError(null);
      const response = await fetch(`/api/admin/storage-providers/${providerId}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to activate storage provider');
      await loadProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // ==================== Effects ====================

  useEffect(() => {
    loadProviders();
  }, []);

  // ==================== Render ====================

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-newTextColor">Storage Providers</h1>
        <p className="text-textItemBlur">Configure file storage backend (Local, S3, FTP, SFTP, Cloudflare R2)</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          <p className="font-semibold">Error: {error}</p>
        </div>
      )}

      {/* Add New Provider Form */}
      {editingProviderId === null && (
        <div className="bg-newBgColorInner rounded-lg border border-newBorder p-6 mb-8">
          <h2 className="text-xl font-bold mb-4 text-newTextColor">Add New Storage Provider</h2>

          {/* Provider Type Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-newTextColor">Provider Type</label>
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setFormData({});
              }}
              className="w-full md:w-1/3 px-3 py-2 border border-newBorder rounded-lg text-sm bg-newBgColorInner text-newTextColor"
            >
              {Object.entries(PROVIDER_TYPES).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-textItemBlur mt-1">
              {PROVIDER_TYPES[selectedType]?.description}
            </p>
          </div>

          {/* Provider Configuration Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1 text-newTextColor">Provider Name</label>
              <input
                type="text"
                placeholder="e.g., Production Storage"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-newBorder rounded-lg text-sm bg-newBgColorInner text-newTextColor placeholder:text-textItemBlur"
              />
            </div>

            {PROVIDER_TYPES[selectedType]?.fields.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium mb-1 text-newTextColor">
                  {field.label}
                  {field.required && <span className="text-red-500">*</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    placeholder={field.placeholder}
                    value={formData[field.key] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-newBorder rounded-lg text-sm font-mono bg-newBgColorInner text-newTextColor placeholder:text-textItemBlur"
                  />
                ) : field.type === 'checkbox' ? (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData[field.key] || false}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.checked })}
                      className="w-4 h-4 border border-newBorder rounded"
                    />
                    <span className="text-sm text-newTextColor">{field.label}</span>
                  </label>
                ) : field.type === 'select' ? (
                  <select
                    value={formData[field.key] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                    className="w-full px-3 py-2 border border-newBorder rounded-lg text-sm bg-newBgColorInner text-newTextColor"
                  >
                    <option value="">Select...</option>
                    <option value="password">Password</option>
                    <option value="privateKey">Private Key</option>
                  </select>
                ) : (
                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={formData[field.key] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                    className="w-full px-3 py-2 border border-newBorder rounded-lg text-sm bg-newBgColorInner text-newTextColor placeholder:text-textItemBlur"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => saveProvider(formData.name)}
              disabled={!formData.name || loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-newColColor disabled:text-textItemBlur"
            >
              Add Provider
            </button>
            <button
              onClick={() => {
                setSelectedType('LOCAL');
                setFormData({});
              }}
              className="px-4 py-2 bg-newColColor text-newTextColor rounded-lg hover:bg-newBoxHover"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8 text-textItemBlur">
          Loading storage providers...
        </div>
      )}

      {/* Providers List */}
      {!loading && (
        <div className="grid grid-cols-1 gap-6">
          {providers.length === 0 ? (
            <div className="bg-newBgColorInner rounded-lg border border-newBorder p-8 text-center text-textItemBlur">
              No storage providers configured. Add one to get started.
            </div>
          ) : (
            providers.map((provider) => (
              <div
                key={provider.id}
                className={`bg-newBgColorInner rounded-lg border-2 p-6 ${
                  provider.isActive ? 'border-green-500 bg-green-500/10' : 'border-newBorder'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-bold text-newTextColor">{provider.name}</h3>
                      {provider.isActive && (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-semibold">
                          ACTIVE
                        </span>
                      )}
                      <span className="px-2 py-1 bg-newColColor text-textItemBlur rounded text-xs">
                        {PROVIDER_TYPES[provider.type]?.label || provider.type}
                      </span>
                    </div>
                    {provider.usageGB && (
                      <p className="text-sm text-textItemBlur">
                        Storage Used: <span className="font-semibold text-newTextColor">{provider.usageGB.toFixed(2)} GB</span>
                      </p>
                    )}
                    {provider.testStatus && (
                      <p className={`text-sm mt-1 ${
                        provider.testStatus === 'success'
                          ? 'text-green-500'
                          : provider.testStatus === 'error'
                          ? 'text-red-500'
                          : 'text-textItemBlur'
                      }`}>
                        Test Status: {provider.testStatus}
                        {provider.testError && ` - ${provider.testError}`}
                        {provider.lastTestedAt && ` (${new Date(provider.lastTestedAt).toLocaleDateString()})`}
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 flex-wrap justify-end">
                    {!provider.isActive && (
                      <button
                        onClick={() => activateProvider(provider.id)}
                        className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                      >
                        Activate
                      </button>
                    )}
                    <button
                      onClick={() => testProvider(provider.id)}
                      disabled={testingProviderId === provider.id}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:bg-newColColor disabled:text-textItemBlur"
                    >
                      {testingProviderId === provider.id ? 'Testing...' : 'Test'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingProviderId(provider.id);
                        setSelectedType(provider.type);
                        setFormData(provider.config);
                      }}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteProvider(provider.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Configuration Display */}
                <div className="mt-4 pt-4 border-t border-newBorder">
                  <h4 className="text-sm font-semibold mb-2 text-newTextColor">Configuration</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-textItemBlur">
                    {Object.entries(provider.config).map(([key, value]) => (
                      <div key={key}>
                        <span className="font-semibold text-newTextColor capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>{' '}
                        {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value).substring(0, 50)}
                        {String(value).length > 50 && '...'}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Provider Types Reference */}
      <div className="mt-12 bg-blue-500/10 rounded-lg border border-blue-500/20 p-6">
        <h3 className="font-bold text-blue-400 mb-4">Storage Provider Types</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-300">
          <div>
            <h4 className="font-semibold mb-1 text-newTextColor">Local Storage</h4>
            <p>Store files on your server. Good for small-medium deployments.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-1 text-newTextColor">Cloudflare R2</h4>
            <p>S3-compatible cloud storage. Competitive pricing, unlimited egress.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-1 text-newTextColor">S3-Compatible</h4>
            <p>AWS S3, MinIO, DigitalOcean Spaces, Backblaze B2, Wasabi, etc.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-1 text-newTextColor">FTP/FTPS</h4>
            <p>Standard FTP with optional SSL/TLS encryption for secure transfer.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-1 text-newTextColor">SFTP</h4>
            <p>Secure FTP over SSH. Supports both password and key-based authentication.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
