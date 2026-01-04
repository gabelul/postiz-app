'use client';

/**
 * Admin Users Management Page
 *
 * Allows superAdmins to:
 * - View all users in the system with search and pagination
 * - Promote users to superAdmin (grant full admin access)
 * - Demote superAdmins to regular users (with safeguards against last admin)
 * - Set custom quotas for users (override system-wide defaults)
 * - View user details and organization memberships
 * - Search and filter users by email or name
 *
 * Only accessible by superAdmins
 */

import { useState, useEffect } from 'react';

/**
 * Represents a user in the system
 * Includes admin status, organizations, and custom quotas
 */
interface User {
  id: string;
  email: string;
  name: string | null;
  isSuperAdmin: boolean;
  createdAt: string;
  organizations: Array<{
    id: string;
    organization: {
      id: string;
      name: string;
    };
  }>;
  customQuotas?: Record<string, any>;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [pageSize] = useState(20);
  const [editingQuotas, setEditingQuotas] = useState<string | null>(null);
  const [quotasForm, setQuotasForm] = useState<Record<string, any>>({});
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [demotingId, setDemotingId] = useState<string | null>(null);

  /**
   * Fetch users from backend with pagination and search
   * Loads user list, total count, and user details
   */
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        take: String(pageSize),
        skip: String((page - 1) * pageSize),
        ...(search && { search }),
      });

      const response = await fetch(`/api/admin/users?${params}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.statusText}`);
      }

      const data = await response.json();
      setUsers(data.users || []);
      setTotalUsers(data.total || 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Promote a user to superAdmin status
   * Grants full administrative access to system
   */
  const handlePromoteToAdmin = async (userId: string) => {
    try {
      setPromotingId(userId);
      setError(null);

      const response = await fetch(`/api/admin/users/${userId}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to promote user: ${response.statusText}`);
      }

      await fetchUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Error promoting user:', err);
    } finally {
      setPromotingId(null);
    }
  };

  /**
   * Demote a superAdmin to regular user
   * Prevents demoting the last superAdmin
   */
  const handleDemoteFromAdmin = async (userId: string) => {
    if (!window.confirm('Are you sure you want to demote this admin? They will lose all admin privileges.')) {
      return;
    }

    try {
      setDemotingId(userId);
      setError(null);

      const response = await fetch(`/api/admin/users/${userId}/demote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to demote user: ${response.statusText}`);
      }

      await fetchUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Error demoting user:', err);
    } finally {
      setDemotingId(null);
    }
  };

  /**
   * Save custom quotas for a user
   * Overrides system-wide quotas for specific user
   */
  const handleSaveQuotas = async (userId: string) => {
    try {
      setError(null);

      const response = await fetch(`/api/admin/users/${userId}/quotas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quotasForm),
      });

      if (!response.ok) {
        throw new Error(`Failed to save quotas: ${response.statusText}`);
      }

      setEditingQuotas(null);
      setQuotasForm({});
      await fetchUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Error saving quotas:', err);
    }
  };

  /**
   * Reset custom quotas for a user
   * Reverts to system-wide defaults
   */
  const handleResetQuotas = async (userId: string) => {
    if (!window.confirm('Reset this user to system quotas?')) {
      return;
    }

    try {
      setError(null);

      const response = await fetch(`/api/admin/users/${userId}/quotas/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to reset quotas: ${response.statusText}`);
      }

      await fetchUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Error resetting quotas:', err);
    }
  };

  /**
   * Load users on component mount and when search/page changes
   */
  useEffect(() => {
    fetchUsers();
  }, [search, page]);

  const totalPages = Math.ceil(totalUsers / pageSize);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-newTextColor">User Management</h1>
        <p className="text-textItemBlur">Manage user accounts, roles, and custom quotas</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          <p className="font-semibold">Error: {error}</p>
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by email or name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full px-4 py-2 border border-newBorder rounded-lg bg-newBgColorInner text-newTextColor focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-textItemBlur"
        />
      </div>

      {/* Users Table */}
      <div className="bg-newBgColorInner rounded-lg border border-newBorder overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-newColColor border-b border-newBorder">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-sm text-newTextColor">Email</th>
                <th className="text-left py-3 px-4 font-semibold text-sm text-newTextColor">Name</th>
                <th className="text-left py-3 px-4 font-semibold text-sm text-newTextColor">Organizations</th>
                <th className="text-left py-3 px-4 font-semibold text-sm text-newTextColor">Role</th>
                <th className="text-left py-3 px-4 font-semibold text-sm text-newTextColor">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="border-b border-newBorder">
                  <td colSpan={5} className="py-8 px-4 text-center text-textItemBlur">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr className="border-b border-newBorder">
                  <td colSpan={5} className="py-8 px-4 text-center text-textItemBlur">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-b border-newBorder hover:bg-newBoxHover">
                    <td className="py-4 px-4 text-sm text-newTextColor">{user.email}</td>
                    <td className="py-4 px-4 text-sm text-newTextColor">{user.name || '-'}</td>
                    <td className="py-4 px-4 text-sm">
                      {user.organizations.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {user.organizations.slice(0, 2).map((org) => (
                            <span key={org.id} className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                              {org.organization.name}
                            </span>
                          ))}
                          {user.organizations.length > 2 && (
                            <span className="px-2 py-1 text-textItemBlur text-xs">
                              +{user.organizations.length - 2} more
                            </span>
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-4 px-4 text-sm">
                      {user.isSuperAdmin ? (
                        <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs font-semibold">
                          SuperAdmin
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-newColColor text-textItemBlur rounded text-xs">
                          Regular User
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-sm">
                      <div className="flex gap-2 flex-wrap">
                        {!user.isSuperAdmin ? (
                          <button
                            onClick={() => handlePromoteToAdmin(user.id)}
                            disabled={promotingId === user.id}
                            className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:bg-newColColor disabled:text-textItemBlur"
                          >
                            {promotingId === user.id ? 'Promoting...' : 'Promote'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDemoteFromAdmin(user.id)}
                            disabled={demotingId === user.id}
                            className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:bg-newColColor disabled:text-textItemBlur"
                          >
                            {demotingId === user.id ? 'Demoting...' : 'Demote'}
                          </button>
                        )}

                        {editingQuotas === user.id ? (
                          <button
                            onClick={() => {
                              setEditingQuotas(null);
                              setQuotasForm({});
                            }}
                            className="px-3 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                          >
                            Close
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingQuotas(user.id);
                              setQuotasForm(user.customQuotas || {});
                            }}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                          >
                            Quotas
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Quotas Modal */}
        {editingQuotas && (
          <div className="p-6 border-t border-newBorder bg-newColColor">
            <h3 className="text-lg font-bold mb-4 text-newTextColor">
              Custom Quotas for {users.find((u) => u.id === editingQuotas)?.email}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-newTextColor mb-1">Posts Per Month</label>
                <input
                  type="number"
                  value={quotasForm.posts_per_month || ''}
                  onChange={(e) =>
                    setQuotasForm({
                      ...quotasForm,
                      posts_per_month: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                  placeholder="Leave empty for system default"
                  className="w-full px-3 py-2 border border-newBorder rounded-lg bg-newBgColorInner text-newTextColor focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-textItemBlur"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-newTextColor mb-1">Channels</label>
                <input
                  type="number"
                  value={quotasForm.channels || ''}
                  onChange={(e) =>
                    setQuotasForm({
                      ...quotasForm,
                      channels: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                  placeholder="Leave empty for system default"
                  className="w-full px-3 py-2 border border-newBorder rounded-lg bg-newBgColorInner text-newTextColor focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-textItemBlur"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-newTextColor mb-1">Image Generation Count</label>
                <input
                  type="number"
                  value={quotasForm.image_generation_count || ''}
                  onChange={(e) =>
                    setQuotasForm({
                      ...quotasForm,
                      image_generation_count: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                  placeholder="Leave empty for system default"
                  className="w-full px-3 py-2 border border-newBorder rounded-lg bg-newBgColorInner text-newTextColor focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-textItemBlur"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-newTextColor mb-1">Team Members</label>
                <input
                  type="number"
                  value={quotasForm.team_members || ''}
                  onChange={(e) =>
                    setQuotasForm({
                      ...quotasForm,
                      team_members: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                  placeholder="Leave empty for system default"
                  className="w-full px-3 py-2 border border-newBorder rounded-lg bg-newBgColorInner text-newTextColor focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-textItemBlur"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleSaveQuotas(editingQuotas)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Quotas
              </button>
              <button
                onClick={() => handleResetQuotas(editingQuotas)}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Reset to Defaults
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-newBorder rounded-lg bg-newBgColorInner text-newTextColor disabled:opacity-50 disabled:cursor-not-allowed hover:bg-newBoxHover"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-newTextColor">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border border-newBorder rounded-lg bg-newBgColorInner text-newTextColor disabled:opacity-50 disabled:cursor-not-allowed hover:bg-newBoxHover"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
