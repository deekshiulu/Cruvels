'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import {
  Shield,
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Mail,
  RefreshCw,
  Activity,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Search,
  Award,
} from 'lucide-react';
import { AuditLog, UserRole } from '@/lib/db/types';

interface AdminUserItem {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  status: 'active' | 'disabled' | 'suspended';
  created_at: string;
  last_login_at?: string | null;
  aliases: { id: string; email_address: string; is_active: boolean }[];
}

export default function AdminDashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Search & Filter state
  const [userSearch, setUserSearch] = useState('');
  const [auditFilter, setAuditFilter] = useState('');

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createUsername, setCreateUsername] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createAlias, setCreateAlias] = useState('');
  const [createRole, setCreateRole] = useState<UserRole>('intern');
  const [creatingUser, setCreatingUser] = useState(false);

  // Assign Alias Modal State
  const [aliasModalUser, setAliasModalUser] = useState<AdminUserItem | null>(null);
  const [newAliasAddress, setNewAliasAddress] = useState('');
  const [assigningAlias, setAssigningAlias] = useState(false);

  // Password Reset Modal State
  const [resetModalUser, setResetModalUser] = useState<AdminUserItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [storageStats, setStorageStats] = useState<any>(null);
  const [purging, setPurging] = useState(false);

  const fetchAdminData = useCallback(async () => {
    try {
      const [statsRes, usersRes, auditRes, storageRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/users'),
        fetch('/api/admin/audit-logs?limit=50'),
        fetch('/api/admin/maintenance'),
      ]);

      if (statsRes.status === 403 || usersRes.status === 403) {
        alert('Access denied. Administrator privileges required.');
        router.push('/dashboard');
        return;
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || []);
      }

      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setAuditLogs(auditData.logs || []);
      }

      if (storageRes.ok) {
        const storageData = await storageRes.json();
        setStorageStats(storageData.stats || null);
      }
    } catch {
      setError('Failed to load administrator telemetry.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  const handlePurge = async (target: 'audit_logs' | 'trash_messages' | 'old_messages', days: number) => {
    if (!confirm(`Are you sure you want to purge ${target.replace('_', ' ')} older than ${days} days?`)) return;
    setPurging(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, daysThreshold: days }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification(data.message);
        if (data.stats) setStorageStats(data.stats);
        fetchAdminData();
        setTimeout(() => setNotification(null), 5000);
      } else {
        setError(data.error || 'Purge operation failed.');
      }
    } catch {
      setError('Network error during storage maintenance.');
    } finally {
      setPurging(false);
    }
  };

  const handleChangeRole = async (user: AdminUserItem, newRole: UserRole) => {
    if (!confirm(`Are you sure you want to change @${user.username}'s role to ${newRole.toUpperCase()}?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification(`Role for @${user.username} updated to ${newRole.toUpperCase()}.`);
        fetchAdminData();
        setTimeout(() => setNotification(null), 4000);
      } else {
        setError(data.error || 'Failed to update role.');
      }
    } catch {
      setError('Network error updating user role.');
    }
  };

  const handleToggleStatus = async (user: AdminUserItem) => {
    const nextStatus = user.status === 'active' ? 'disabled' : 'active';
    const actionName = nextStatus === 'disabled' ? 'disable' : 'enable';
    if (!confirm(`Are you sure you want to ${actionName} user @${user.username}?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setNotification(`User @${user.username} is now ${nextStatus}.`);
        fetchAdminData();
        setTimeout(() => setNotification(null), 4000);
      } else {
        setError(data.error || 'Failed to update status.');
      }
    } catch {
      setError('Failed to update user status.');
    }
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName,
          username: createUsername,
          password: createPassword,
          role: createRole,
          initialAlias: createAlias.includes('@') ? createAlias : `${createAlias}@cruvels.com`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to create user.');
      } else {
        setNotification(`User @${createUsername} created with role ${createRole.toUpperCase()}`);
        setShowCreateModal(false);
        setCreateName('');
        setCreateUsername('');
        setCreateAlias('');
        setCreateRole('intern');
        fetchAdminData();
        setTimeout(() => setNotification(null), 4000);
      }
    } catch {
      setError('Network error during user creation.');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleAssignAliasSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aliasModalUser || !newAliasAddress) return;
    setAssigningAlias(true);

    try {
      const formattedAlias = newAliasAddress.includes('@') ? newAliasAddress : `${newAliasAddress}@cruvels.com`;
      const res = await fetch(`/api/admin/users/${aliasModalUser.id}/alias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailAddress: formattedAlias }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to assign alias.');
      } else {
        setNotification(`Alias ${formattedAlias} successfully assigned to @${aliasModalUser.username}`);
        setAliasModalUser(null);
        setNewAliasAddress('');
        fetchAdminData();
        setTimeout(() => setNotification(null), 4000);
      }
    } catch {
      setError('Network error assigning alias.');
    } finally {
      setAssigningAlias(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser) return;
    setResettingPassword(true);

    try {
      const res = await fetch(`/api/admin/users/${resetModalUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });

      if (res.ok) {
        setNotification(`Password reset successfully for @${resetModalUser.username}`);
        setResetModalUser(null);
        setNewPassword('');
        fetchAdminData();
        setTimeout(() => setNotification(null), 4000);
      }
    } catch {
      setError('Failed to reset password.');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleTriggerSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/mail/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setNotification(`Email sync complete: ${data.data?.ingestedCount || 0} messages ingested.`);
        fetchAdminData();
        setTimeout(() => setNotification(null), 4000);
      } else {
        setError(data.error || 'Sync failed.');
      }
    } finally {
      setSyncing(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.aliases.some((a) => a.email_address.toLowerCase().includes(userSearch.toLowerCase()))
  );

  const filteredAudits = auditFilter
    ? auditLogs.filter((l) => l.action.toLowerCase().includes(auditFilter.toLowerCase()))
    : auditLogs;

  return (
    <AppShell>
      <div className="space-y-8 max-w-7xl mx-auto">
        {/* Top Navigation Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-md">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
                Cruvels Administration & Security Center
                <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200 uppercase tracking-wider">
                  Admin Master
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Role elevation, user directory, email alias routing, and immutable security audit logs
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleTriggerSync}
              disabled={syncing}
              className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 shadow-sm transition-all disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              <span>Trigger Mail Sync</span>
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="glow-btn-primary flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white tracking-wide shadow-sm"
            >
              <UserPlus className="h-4 w-4" />
              <span>Provision User</span>
            </button>
          </div>
        </div>

        {/* Notifications */}
        {notification && (
          <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{notification}</span>
            </div>
            <button onClick={() => setNotification(null)} className="text-emerald-700 hover:text-emerald-950 text-xs font-bold">
              Dismiss
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span className="font-semibold">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-700 hover:text-rose-950 text-xs font-bold">
              Dismiss
            </button>
          </div>
        )}

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Users</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-0.5">{users.length}</div>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <UserCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Active Accounts</div>
              <div className="text-2xl font-extrabold text-emerald-600 mt-0.5">
                {users.filter((u) => u.status === 'active').length}
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 border border-purple-100">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Admins & Leads</div>
              <div className="text-2xl font-extrabold text-purple-600 mt-0.5">
                {users.filter((u) => u.role === 'admin' || u.role === 'manager' || u.role === 'team_lead').length}
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 border border-purple-100">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Assigned Aliases</div>
              <div className="text-2xl font-extrabold text-purple-600 mt-0.5">{stats?.totalAliases || users.length}</div>
            </div>
          </div>
        </div>

        {/* User Directory & Role Assignment Section */}
        <div className="rounded-3xl bg-white p-6 sm:p-7 shadow-sm space-y-5 border border-slate-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Users className="h-5 w-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900 tracking-tight">User Accounts & Role Assignments</h2>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Filter users or aliases..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">User Profile</th>
                  <th className="px-5 py-3.5">Assigned Email Alias(es)</th>
                  <th className="px-5 py-3.5">Assigned Role</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Last Login</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-xs font-bold text-white shadow-sm">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{u.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">@{u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {u.aliases.map((alias) => (
                          <span
                            key={alias.id}
                            className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-mono font-semibold text-blue-700 shadow-sm"
                          >
                            {alias.email_address}
                          </span>
                        ))}
                        <button
                          onClick={() => {
                            setAliasModalUser(u);
                            setNewAliasAddress('');
                          }}
                          title="Assign Another Email Alias"
                          className="rounded-lg border border-dashed border-slate-300 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:text-blue-600 hover:border-blue-400 transition-colors"
                        >
                          + Alias
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <select
                        value={u.role}
                        onChange={(e) => handleChangeRole(u, e.target.value as UserRole)}
                        className={`rounded-lg border px-2 py-1 text-[11px] font-bold uppercase tracking-wider focus:outline-none ${
                          u.role === 'admin'
                            ? 'border-purple-200 bg-purple-50 text-purple-700'
                            : u.role === 'manager'
                            ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                            : u.role === 'team_lead'
                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                            : 'border-blue-200 bg-blue-50 text-blue-700'
                        }`}
                      >
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="team_lead">Team Lead (GL)</option>
                        <option value="employee">Employee</option>
                        <option value="intern">Intern</option>
                      </select>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${
                          u.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            u.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                        {u.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500 font-medium">
                      {u.last_login_at
                        ? new Date(u.last_login_at).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Never'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setResetModalUser(u);
                            setNewPassword('');
                          }}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:text-blue-600 hover:border-blue-300 shadow-sm transition-colors"
                        >
                          Reset Pwd
                        </button>

                        <button
                          onClick={() => handleToggleStatus(u)}
                          className={`rounded-xl px-3 py-1.5 text-[11px] font-bold shadow-sm transition-all ${
                            u.status === 'active'
                              ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                              : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {u.status === 'active' ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Real-time Security Audit Stream */}
        <div className="rounded-3xl bg-white p-6 sm:p-7 shadow-sm space-y-5 border border-slate-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Activity className="h-5 w-5 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Security Audit Trail (Immutable)</h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setAuditFilter('')}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold border transition-all ${
                  !auditFilter ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-sm' : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                All Events
              </button>
              <button
                onClick={() => setAuditFilter('LOGIN')}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold border transition-all ${
                  auditFilter === 'LOGIN' ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-sm' : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                Logins
              </button>
              <button
                onClick={() => setAuditFilter('ADMIN')}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold border transition-all ${
                  auditFilter === 'ADMIN' ? 'bg-purple-50 text-purple-700 border-purple-300 shadow-sm' : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                Admin Actions
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 max-h-[380px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 z-10">
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Action Type</th>
                  <th className="px-5 py-3">Resource Target</th>
                  <th className="px-5 py-3">Context Metadata</th>
                  <th className="px-5 py-3">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-mono text-[11px]">
                {filteredAudits.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400 font-sans text-xs">
                      No security audit events recorded.
                    </td>
                  </tr>
                ) : (
                  filteredAudits.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            log.action.includes('FAILED') || log.action.includes('DENIED')
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : log.action.includes('ADMIN')
                              ? 'bg-purple-100 text-purple-700 border border-purple-200'
                              : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-800 font-semibold">{log.resource_type || '-'}</td>
                      <td className="px-5 py-3 text-slate-500 max-w-xs truncate">
                        {JSON.stringify(log.metadata || {})}
                      </td>
                      <td className="px-5 py-3 text-slate-400 whitespace-nowrap">
                        {log.ip_address || '127.0.0.1'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Storage Maintenance & Free-Tier Capacity */}
        <div className="rounded-3xl bg-white p-6 sm:p-7 shadow-sm space-y-5 border border-slate-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Shield className="h-5 w-5 text-purple-600" />
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Free-Tier Storage & Server Optimization
                </h2>
                <p className="text-xs text-slate-500">
                  Supabase & Vercel capacity monitoring with on-demand data pruning to maintain zero-cost tier for 50+ users
                </p>
              </div>
            </div>

            {storageStats && (
              <div className="flex items-center gap-2 rounded-2xl bg-purple-50 px-3.5 py-1.5 border border-purple-200 text-xs font-bold text-purple-800">
                <span>Free Tier Used:</span>
                <span className="font-mono text-purple-600">{storageStats.supabaseFreeTierCapacityPct}</span>
                <span className="text-slate-400 font-normal">({storageStats.estimatedStorageFormatted})</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div className="rounded-2xl bg-slate-50 p-3 border border-slate-200 text-center">
              <div className="text-[10px] font-semibold text-slate-400 uppercase">Users & Staff</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{storageStats?.totalEmployees || users.length}</div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-3 border border-slate-200 text-center">
              <div className="text-[10px] font-semibold text-slate-400 uppercase">Inbox Emails</div>
              <div className="text-lg font-bold text-blue-600 mt-0.5">{storageStats?.inboxCount || 0}</div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-3 border border-slate-200 text-center">
              <div className="text-[10px] font-semibold text-slate-400 uppercase">Sent Emails</div>
              <div className="text-lg font-bold text-indigo-600 mt-0.5">{storageStats?.sentCount || 0}</div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-3 border border-slate-200 text-center">
              <div className="text-[10px] font-semibold text-slate-400 uppercase">Attachments</div>
              <div className="text-lg font-bold text-emerald-600 mt-0.5">{storageStats?.totalAttachments || 0}</div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-3 border border-slate-200 text-center">
              <div className="text-[10px] font-semibold text-slate-400 uppercase">Tasks</div>
              <div className="text-lg font-bold text-amber-600 mt-0.5">{storageStats?.totalTasks || 0}</div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-3 border border-slate-200 text-center">
              <div className="text-[10px] font-semibold text-slate-400 uppercase">Audit Logs</div>
              <div className="text-lg font-bold text-purple-600 mt-0.5">{storageStats?.totalAuditLogs || auditLogs.length}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
            <div className="text-slate-500 text-[11px]">
              Tip: Attachment binaries are streamed on-demand to protect server memory and eliminate storage fees.
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePurge('audit_logs', 30)}
                disabled={purging}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-all disabled:opacity-50"
              >
                {purging ? 'Purging...' : 'Purge Audit Logs (>30d)'}
              </button>

              <button
                onClick={() => handlePurge('old_messages', 90)}
                disabled={purging}
                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 font-semibold text-rose-700 hover:bg-rose-100 transition-all disabled:opacity-50"
              >
                {purging ? 'Purging...' : 'Purge Old Mails (>90d)'}
              </button>
            </div>
          </div>
        </div>

        {/* Provision New User Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl space-y-5 border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-blue-600" />
                  Provision User Account
                </h3>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-700">
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateUserSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-600 mb-1.5 font-semibold uppercase tracking-wider text-[10px]">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="e.g. Rohan Sharma"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1.5 font-semibold uppercase tracking-wider text-[10px]">
                      Login Username
                    </label>
                    <input
                      type="text"
                      required
                      value={createUsername}
                      onChange={(e) => setCreateUsername(e.target.value)}
                      placeholder="e.g. rohan"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1.5 font-semibold uppercase tracking-wider text-[10px]">
                      Account Role
                    </label>
                    <select
                      value={createRole}
                      onChange={(e) => setCreateRole(e.target.value as UserRole)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none capitalize"
                    >
                      <option value="intern">Intern</option>
                      <option value="employee">Employee</option>
                      <option value="team_lead">Team Lead (GL)</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 mb-1.5 font-semibold uppercase tracking-wider text-[10px]">
                    Assigned Company Email Alias
                  </label>
                  <input
                    type="text"
                    required
                    value={createAlias}
                    onChange={(e) => setCreateAlias(e.target.value)}
                    placeholder="e.g. rohan@cruvels.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1.5 font-semibold uppercase tracking-wider text-[10px]">
                    Initial Password
                  </label>
                  <input
                    type="password"
                    required
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 shadow-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingUser}
                    className="glow-btn-primary rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-50"
                  >
                    {creatingUser ? 'Provisioning...' : 'Provision Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Assign Alias Modal */}
        {aliasModalUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4 border border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-600" />
                Assign Email Alias to @{aliasModalUser.username}
              </h3>

              <form onSubmit={handleAssignAliasSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-600 mb-1.5 font-semibold uppercase tracking-wider text-[10px]">
                    New Company Email Address
                  </label>
                  <input
                    type="text"
                    required
                    value={newAliasAddress}
                    onChange={(e) => setNewAliasAddress(e.target.value)}
                    placeholder="e.g. rohan.sharma@cruvels.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none font-mono"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setAliasModalUser(null)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 shadow-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={assigningAlias}
                    className="glow-btn-primary rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm disabled:opacity-50"
                  >
                    {assigningAlias ? 'Assigning...' : 'Assign Alias'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reset Password Modal */}
        {resetModalUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4 border border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-purple-600" />
                Reset Password for @{resetModalUser.username}
              </h3>

              <form onSubmit={handleResetPasswordSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-600 mb-1.5 font-semibold uppercase tracking-wider text-[10px]">
                    New Temporary Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:border-purple-500 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setResetModalUser(null)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 shadow-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resettingPassword}
                    className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700 shadow-sm disabled:opacity-50"
                  >
                    {resettingPassword ? 'Updating...' : 'Save New Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
