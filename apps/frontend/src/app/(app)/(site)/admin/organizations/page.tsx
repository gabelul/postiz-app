'use client';

import { useState, useEffect } from 'react';

interface Organization {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  bypassBilling: boolean;
  customLimits: Record<string, any> | null;
  userCount: number;
  currentTier: string;
  totalChannels: number;
}

export default function AdminOrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalOrgs, setTotalOrgs] = useState(0);
  const [pageSize] = useState(20);
  const [editingLimits, setEditingLimits] = useState<string | null>(null);
  const [limitsForm, setLimitsForm] = useState<Record<string, any>>({});

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        take: String(pageSize),
        skip: String((page - 1) * pageSize),
        ...(search && { search }),
      });

      const response = await fetch(`/api/admin/organizations?${params}`);
      if (!response.ok) throw new Error(`Failed to fetch organizations`);

      const data = await response.json();
      setOrganizations(data.organizations || []);
      setTotalOrgs(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const setTier = async (orgId: string, tier: string) => {
    try {
      setError(null);
      const response = await fetch(`/api/admin/organizations/${orgId}/tier`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      if (!response.ok) throw new Error('Failed to set tier');
      await fetchOrganizations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const toggleBypassBilling = async (orgId: string, current: boolean) => {
    try {
      setError(null);
      const response = await fetch(`/api/admin/organizations/${orgId}/bypass-billing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bypass: !current }),
      });
      if (!response.ok) throw new Error('Failed to toggle billing bypass');
      await fetchOrganizations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const saveLimits = async (orgId: string) => {
    try {
      setError(null);
      const response = await fetch(`/api/admin/organizations/${orgId}/limits`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(limitsForm),
      });
      if (!response.ok) throw new Error('Failed to save limits');
      setEditingLimits(null);
      setLimitsForm({});
      await fetchOrganizations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const makeUnlimited = async (orgId: string) => {
    if (!window.confirm('Make this organization unlimited?')) return;
    try {
      setError(null);
      const response = await fetch(`/api/admin/organizations/${orgId}/make-unlimited`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed');
      await fetchOrganizations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, [search, page]);

  const totalPages = Math.ceil(totalOrgs / pageSize);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-newTextColor">Organization Management</h1>
        <p className="text-textItemBlur">Manage organizations, tiers, billing, and custom limits</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          <p className="font-semibold">Error: {error}</p>
        </div>
      )}

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search organizations..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full px-4 py-2 border border-newBorder rounded-lg bg-newBgColorInner text-newTextColor focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-textItemBlur"
        />
      </div>

      <div className="bg-newBgColorInner rounded-lg border border-newBorder overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-newColColor border-b border-newBorder">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-sm text-newTextColor">Organization</th>
                <th className="text-left py-3 px-4 font-semibold text-sm text-newTextColor">Tier</th>
                <th className="text-left py-3 px-4 font-semibold text-sm text-newTextColor">Users</th>
                <th className="text-left py-3 px-4 font-semibold text-sm text-newTextColor">Billing Bypass</th>
                <th className="text-left py-3 px-4 font-semibold text-sm text-newTextColor">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="border-b border-newBorder">
                  <td colSpan={5} className="py-8 px-4 text-center text-textItemBlur">Loading...</td>
                </tr>
              ) : organizations.length === 0 ? (
                <tr className="border-b border-newBorder">
                  <td colSpan={5} className="py-8 px-4 text-center text-textItemBlur">No organizations found</td>
                </tr>
              ) : (
                organizations.map((org) => (
                  <tr key={org.id} className="border-b border-newBorder hover:bg-newBoxHover">
                    <td className="py-4 px-4 text-sm font-semibold text-newTextColor">{org.name}</td>
                    <td className="py-4 px-4 text-sm">
                      <select
                        value={org.currentTier}
                        onChange={(e) => setTier(org.id, e.target.value)}
                        className="px-2 py-1 border border-newBorder rounded text-xs bg-newBgColorInner text-newTextColor"
                      >
                        <option>FREE</option>
                        <option>STANDARD</option>
                        <option>PRO</option>
                        <option>TEAM</option>
                        <option>ULTIMATE</option>
                      </select>
                    </td>
                    <td className="py-4 px-4 text-sm text-newTextColor">{org.userCount}</td>
                    <td className="py-4 px-4 text-sm">
                      <button
                        onClick={() => toggleBypassBilling(org.id, org.bypassBilling)}
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          org.bypassBilling
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            : 'bg-newColColor text-textItemBlur hover:bg-newBoxHover'
                        }`}
                      >
                        {org.bypassBilling ? 'ON' : 'OFF'}
                      </button>
                    </td>
                    <td className="py-4 px-4 text-sm flex gap-1">
                      {editingLimits === org.id ? (
                        <button
                          onClick={() => {
                            setEditingLimits(null);
                            setLimitsForm({});
                          }}
                          className="px-2 py-1 bg-gray-600 text-white rounded text-xs"
                        >
                          Close
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingLimits(org.id);
                            setLimitsForm(org.customLimits || {});
                          }}
                          className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                        >
                          Limits
                        </button>
                      )}
                      <button
                        onClick={() => makeUnlimited(org.id)}
                        className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                      >
                        Unlimited
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {editingLimits && (
          <div className="p-6 border-t border-newBorder bg-newColColor">
            <h3 className="font-bold mb-4 text-newTextColor">Custom Limits for {organizations.find((o) => o.id === editingLimits)?.name}</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-newTextColor">Channels</label>
                <input
                  type="number"
                  value={limitsForm.channels || ''}
                  onChange={(e) => setLimitsForm({ ...limitsForm, channels: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full px-3 py-2 border border-newBorder rounded text-sm bg-newBgColorInner text-newTextColor"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-newTextColor">Posts Per Month</label>
                <input
                  type="number"
                  value={limitsForm.posts_per_month || ''}
                  onChange={(e) => setLimitsForm({ ...limitsForm, posts_per_month: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full px-3 py-2 border border-newBorder rounded text-sm bg-newBgColorInner text-newTextColor"
                />
              </div>
            </div>
            <button onClick={() => saveLimits(editingLimits)} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">
              Save Limits
            </button>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-newBorder rounded bg-newBgColorInner text-newTextColor disabled:opacity-50 hover:bg-newBoxHover"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-newTextColor">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border border-newBorder rounded bg-newBgColorInner text-newTextColor disabled:opacity-50 hover:bg-newBoxHover"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
