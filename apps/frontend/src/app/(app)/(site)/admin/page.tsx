'use client';

import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';

/**
 * Admin Dashboard Page
 *
 * Main admin page that displays dashboard statistics and overview.
 * Shows:
 * - Total users
 * - Total organizations
 * - System health
 * - Recent activity
 *
 * Only accessible by superAdmins
 */

export default function AdminDashboardPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">System administration and management</p>
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Stats Cards */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-gray-600 text-sm font-medium mb-2">Total Users</div>
          <div className="text-3xl font-bold">--</div>
          <p className="text-gray-500 text-xs mt-2">Loading...</p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-gray-600 text-sm font-medium mb-2">Total Organizations</div>
          <div className="text-3xl font-bold">--</div>
          <p className="text-gray-500 text-xs mt-2">Loading...</p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-gray-600 text-sm font-medium mb-2">Active Subscriptions</div>
          <div className="text-3xl font-bold">--</div>
          <p className="text-gray-500 text-xs mt-2">Loading...</p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-gray-600 text-sm font-medium mb-2">System Status</div>
          <div className="text-3xl font-bold text-green-600">●</div>
          <p className="text-gray-500 text-xs mt-2">Operational</p>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <a
          href="/admin/users"
          className="block p-6 bg-blue-50 border-l-4 border-blue-500 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <h3 className="font-bold text-blue-900 mb-2">Manage Users</h3>
          <p className="text-sm text-blue-700">View and manage user accounts, promote/demote admins</p>
        </a>

        <a
          href="/admin/organizations"
          className="block p-6 bg-purple-50 border-l-4 border-purple-500 rounded-lg hover:bg-purple-100 transition-colors"
        >
          <h3 className="font-bold text-purple-900 mb-2">Manage Organizations</h3>
          <p className="text-sm text-purple-700">Force subscription tiers, set limits, manage billing</p>
        </a>

        <a
          href="/admin/ai-providers"
          className="block p-6 bg-green-50 border-l-4 border-green-500 rounded-lg hover:bg-green-100 transition-colors"
        >
          <h3 className="font-bold text-green-900 mb-2">AI Provider Settings</h3>
          <p className="text-sm text-green-700">Configure global AI providers and settings</p>
        </a>

        <a
          href="/admin/settings"
          className="block p-6 bg-orange-50 border-l-4 border-orange-500 rounded-lg hover:bg-orange-100 transition-colors"
        >
          <h3 className="font-bold text-orange-900 mb-2">System Settings</h3>
          <p className="text-sm text-orange-700">System configuration, tiers, and feature flags</p>
        </a>

        <a
          href="/admin/storage-providers"
          className="block p-6 bg-red-50 border-l-4 border-red-500 rounded-lg hover:bg-red-100 transition-colors"
        >
          <h3 className="font-bold text-red-900 mb-2">Storage Providers</h3>
          <p className="text-sm text-red-700">Configure file storage (Local, S3, FTP, SFTP, Cloudflare R2)</p>
        </a>
      </div>
    </div>
  );
}
