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
  ShieldCheck,
  Sliders,
  Copy,
  Check,
  Crown,
  Briefcase,
  Zap,
  GraduationCap,
  Database,
  Trash2,
  HardDrive,
  Eye,
  EyeOff,
  Filter,
} from 'lucide-react';
import Link from 'next/link';
import AdminNavRail from '@/components/admin/AdminNavRail';
import { AuditLog, UserRole } from '@/lib/db/types';
import { clientCache } from '@/lib/cache/clientCache';

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

const ROLE_CONFIG: Record<
  UserRole,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    pillClass: string;
    description: string;
  }
> = {
  admin: {
    label: 'Admin',
    icon: Crown,
    pillClass:
      'border-purple-200 dark:border-purple-800/80 bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300',
    description: 'Master access to configuration, security policies, and user provisioning.',
  },
  manager: {
    label: 'Manager',
    icon: Briefcase,
    pillClass:
      'border-indigo-200 dark:border-indigo-800/80 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300',
    description: 'Departmental oversight, attendance approvals, and team management.',
  },
  team_lead: {
    label: 'Team Lead',
    icon: Zap,
    pillClass:
      'border-amber-200 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300',
    description: 'Sprint planning, project squad coordination, and peer reviews.',
  },
  employee: {
    label: 'Employee',
    icon: Users,
    pillClass:
      'border-blue-200 dark:border-blue-800/80 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300',
    description: 'Standard workplace access: tasks, schedules, notices, and internal mail.',
  },
  intern: {
    label: 'Intern',
    icon: GraduationCap,
    pillClass:
      'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
    description: 'Restricted zero-trust access: assigned alias mail only, no cross-querying.',
  },
};

export default function AdminDashboardPage() {
  const router = useRouter();

  const [stats, setStats] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      return clientCache.get<any>('admin_stats') || null;
    }
    return null;
  });
  const [users, setUsers] = useState<AdminUserItem[]>(() => {
    if (typeof window !== 'undefined') {
      return clientCache.get<AdminUserItem[]>('admin_users') || [];
    }
    return [];
  });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    if (typeof window !== 'undefined') {
      return clientCache.get<AuditLog[]>('admin_audit_logs') || [];
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      return !clientCache.get<any>('admin_stats');
    }
    return true;
  });
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Search & Filter state
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole | 'disabled'>('all');
  const [auditFilter, setAuditFilter] = useState('');

  // Copy feedback
  const [copiedAlias, setCopiedAlias] = useState<string | null>(null);

  // Modal States - Provision User
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createUsername, setCreateUsername] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createAlias, setCreateAlias] = useState('');
  const [createRole, setCreateRole] = useState<UserRole>('employee');
  const [creatingUser, setCreatingUser] = useState(false);

  // Assign Alias Modal State
  const [aliasModalUser, setAliasModalUser] = useState<AdminUserItem | null>(null);
  const [newAliasAddress, setNewAliasAddress] = useState('');
  const [assigningAlias, setAssigningAlias] = useState(false);

  // Password Reset Modal State
  const [resetModalUser, setResetModalUser] = useState<AdminUserItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  // Role Elevation Modal State
  const [roleModalUser, setRoleModalUser] = useState<AdminUserItem | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('employee');
  const [updatingRole, setUpdatingRole] = useState(false);

  // Storage & Maintenance State
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
        clientCache.set('admin_stats', undefined, statsData.stats);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || []);
        clientCache.set('admin_users', undefined, usersData.users || []);
      }

      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setAuditLogs(auditData.logs || []);
        clientCache.set('admin_audit_logs', undefined, auditData.logs || []);
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

  const handleCopyAlias = (email: string) => {
    navigator.clipboard?.writeText(email);
    setCopiedAlias(email);
    setTimeout(() => setCopiedAlias(null), 2000);
  };

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

  const handleRoleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleModalUser) return;
    setUpdatingRole(true);

    try {
      const res = await fetch(`/api/admin/users/${roleModalUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selectedRole }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification(`Role for @${roleModalUser.username} elevated to ${selectedRole.toUpperCase()}.`);
        setRoleModalUser(null);
        fetchAdminData();
        setTimeout(() => setNotification(null), 4000);
      } else {
        setError(data.error || 'Failed to update role.');
      }
    } catch {
      setError('Network error updating user role.');
    } finally {
      setUpdatingRole(false);
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
        setNotification(`User @${createUsername} provisioned with role ${createRole.toUpperCase()}`);
        setShowCreateModal(false);
        setCreateName('');
        setCreateUsername('');
        setCreatePassword('');
        setCreateAlias('');
        setCreateRole('employee');
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
        setNotification(`Password reset successfully for @${resetModalUser.username}. Active sessions revoked.`);
        setResetModalUser(null);
        setNewPassword('');
        fetchAdminData();
        setTimeout(() => setNotification(null), 4000);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to reset password.');
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

  // User Filtering Logic
  const filteredUsers = users.filter((u) => {
    // Role filter
    if (roleFilter === 'disabled' && u.status !== 'disabled') return false;
    if (roleFilter !== 'all' && roleFilter !== 'disabled' && u.role !== roleFilter) return false;

    // Search query
    const query = userSearch.toLowerCase();
    if (!query) return true;
    return (
      u.name.toLowerCase().includes(query) ||
      u.username.toLowerCase().includes(query) ||
      u.aliases.some((a) => a.email_address.toLowerCase().includes(query))
    );
  });

  // User Counts by Category
  const activeCount = users.filter((u) => u.status === 'active').length;
  const adminCount = users.filter((u) => u.role === 'admin').length;
  const managerCount = users.filter((u) => u.role === 'manager' || u.role === 'team_lead').length;
  const employeeCount = users.filter((u) => u.role === 'employee' || u.role === 'intern').length;
  const disabledCount = users.filter((u) => u.status === 'disabled').length;

  const filteredAudits = auditFilter
    ? auditLogs.filter((l) => l.action.toLowerCase().includes(auditFilter.toLowerCase()))
    : auditLogs;

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Dedicated 10-Section Navigation Rail */}
        <AdminNavRail />

        {/* Unified Command Header */}
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-7 shadow-xs">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-600 shadow-md shadow-purple-500/20">
                <Shield className="h-7 w-7 text-white" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    Cruvels Administration & Security Center
                  </h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 dark:bg-purple-950/60 px-3 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 uppercase tracking-widest">
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
                    Zero-Trust Root
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
                  Centralized identity management, role elevation, email alias routing matrices, and real-time security
                  audit telemetry.
                </p>
              </div>
            </div>

            {/* Quick Action Suite */}
            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
              <Link
                href="/admin/attendance-compliance"
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-white dark:hover:bg-slate-800 transition-all shadow-2xs"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
                <span>Compliance</span>
              </Link>

              <Link
                href="/admin/acknowledgements"
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-white dark:hover:bg-slate-800 transition-all shadow-2xs"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span>Acknowledgements</span>
              </Link>

              <Link
                href="/admin/settings"
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-white dark:hover:bg-slate-800 transition-all shadow-2xs"
              >
                <Sliders className="h-3.5 w-3.5 text-purple-500" />
                <span>Settings</span>
              </Link>

              <button
                onClick={handleTriggerSync}
                disabled={syncing}
                title="Synchronize all inbound and outbound email aliases"
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-white dark:hover:bg-slate-800 transition-all shadow-2xs disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-blue-500 ${syncing ? 'animate-spin' : ''}`} />
                <span>Sync Mail</span>
              </button>

              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-purple-600/20 hover:opacity-95 transition-all cursor-pointer active:scale-95"
              >
                <UserPlus className="h-4 w-4" />
                <span>+ Provision User</span>
              </button>
            </div>
          </div>
        </div>

        {/* Notifications & System Alerts */}
        {notification && (
          <div className="flex items-center justify-between rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-xs text-emerald-800 dark:text-emerald-300 shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-semibold">{notification}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-950 dark:hover:text-emerald-200 text-xs font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-between rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-4 text-xs text-rose-800 dark:text-rose-300 shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span className="font-semibold">{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-rose-700 dark:text-rose-400 hover:text-rose-950 dark:hover:text-rose-200 text-xs font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Security & Workforce Pulse (Actionable Operational Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Active Workforce */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 p-5 shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:border-blue-300 dark:hover:border-blue-700 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Workforce Health
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/60">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 dark:text-white">{users.length}</span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {users.length > 0 ? `${Math.round((activeCount / users.length) * 100)}% Active` : '0%'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {activeCount} active • {disabledCount} suspended accounts
              </p>
            </div>
          </div>

          {/* Card 2: Privileged Access */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 p-5 shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:border-purple-300 dark:hover:border-purple-700 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Privileged Access
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/60">
                <Crown className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-purple-600 dark:text-purple-400">{adminCount}</span>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Root Admins</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                +{managerCount} managers & squad team leads
              </p>
            </div>
          </div>

          {/* Card 3: Mail Routing Aliases */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 p-5 shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:border-emerald-300 dark:hover:border-emerald-700 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Email Inbound Matrix
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/60">
                <Mail className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {stats?.totalAliases || users.length}
                </span>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Active Aliases</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono truncate">
                @cruvels.com domain mapping
              </p>
            </div>
          </div>

          {/* Card 4: Security Telemetry */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 p-5 shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:border-amber-300 dark:hover:border-amber-700 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Security Ledger
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/60">
                <Activity className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{auditLogs.length}</span>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Audit Events</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Immutable zero-trust logging active</p>
            </div>
          </div>
        </div>

        {/* User Directory & Role Assignment Section */}
        <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-xs border border-slate-200 dark:border-slate-800 space-y-5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  User Accounts & Role Assignments
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Manage login privileges, assigned aliases, and instant password resets
                </p>
              </div>
            </div>

            <div className="relative w-full md:w-72">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search by name, handle, or alias..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2 pl-9 pr-4 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-purple-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 border-b border-slate-100 dark:border-slate-800/80">
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 select-none ${
                roleFilter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              All Users ({users.length})
            </button>
            <button
              onClick={() => setRoleFilter('admin')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 select-none ${
                roleFilter === 'admin'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30'
              }`}
            >
              Admins ({adminCount})
            </button>
            <button
              onClick={() => setRoleFilter('manager')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 select-none ${
                roleFilter === 'manager'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30'
              }`}
            >
              Managers ({users.filter((u) => u.role === 'manager').length})
            </button>
            <button
              onClick={() => setRoleFilter('team_lead')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 select-none ${
                roleFilter === 'team_lead'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30'
              }`}
            >
              Team Leads ({users.filter((u) => u.role === 'team_lead').length})
            </button>
            <button
              onClick={() => setRoleFilter('employee')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 select-none ${
                roleFilter === 'employee'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30'
              }`}
            >
              Employees ({users.filter((u) => u.role === 'employee').length})
            </button>
            <button
              onClick={() => setRoleFilter('intern')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 select-none ${
                roleFilter === 'intern'
                  ? 'bg-slate-700 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Interns ({users.filter((u) => u.role === 'intern').length})
            </button>
            <button
              onClick={() => setRoleFilter('disabled')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 select-none ${
                roleFilter === 'disabled'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30'
              }`}
            >
              Disabled ({disabledCount})
            </button>
          </div>

          {/* Mobile Card View (< md) */}
          <div className="md:hidden space-y-3">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs">
                No users found matching current filters.
              </div>
            ) : (
              filteredUsers.map((u) => {
                const RoleIcon = ROLE_CONFIG[u.role]?.icon || Users;
                return (
                  <div
                    key={u.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4 space-y-3.5 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-sm font-bold text-white shadow-sm">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-sm">{u.name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">@{u.username}</div>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold shrink-0 ${
                          u.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                            : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            u.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                        {u.status}
                      </span>
                    </div>

                    {/* Email Aliases */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Inbound Email Aliases
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {u.aliases.map((alias) => {
                          const isCopied = copiedAlias === alias.email_address;
                          return (
                            <button
                              key={alias.id}
                              onClick={() => handleCopyAlias(alias.email_address)}
                              title="Click to copy alias"
                              className="group inline-flex items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 text-[11px] font-mono font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                            >
                              <span>{alias.email_address}</span>
                              {isCopied ? (
                                <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <Copy className="h-2.5 w-2.5 text-blue-400 opacity-60 group-hover:opacity-100" />
                              )}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => {
                            setAliasModalUser(u);
                            setNewAliasAddress('');
                          }}
                          className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-400 dark:hover:border-purple-600 transition-colors"
                        >
                          + Alias
                        </button>
                      </div>
                    </div>

                    {/* Role & Last Login */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-xs">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                          Role
                        </div>
                        <button
                          onClick={() => {
                            setRoleModalUser(u);
                            setSelectedRole(u.role);
                          }}
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-bold uppercase tracking-wider shadow-2xs hover:opacity-90 transition-all ${
                            ROLE_CONFIG[u.role]?.pillClass
                          }`}
                        >
                          <RoleIcon className="h-3.5 w-3.5" />
                          <span>{ROLE_CONFIG[u.role]?.label || u.role}</span>
                        </button>
                      </div>

                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                          Last Activity
                        </div>
                        <div className="text-slate-600 dark:text-slate-400 text-xs font-medium pt-1">
                          {u.last_login_at
                            ? new Date(u.last_login_at).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Never'}
                        </div>
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                      <button
                        onClick={() => {
                          setResetModalUser(u);
                          setNewPassword('');
                        }}
                        className="flex-1 min-h-[40px] flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-300 dark:hover:border-purple-700 shadow-2xs transition-colors"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        <span>Reset Password</span>
                      </button>

                      <button
                        onClick={() => handleToggleStatus(u)}
                        className={`flex-1 min-h-[40px] flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold shadow-2xs transition-all ${
                          u.status === 'active'
                            ? 'border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60'
                            : 'border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                        }`}
                      >
                        {u.status === 'active' ? (
                          <>
                            <UserX className="h-3.5 w-3.5" />
                            <span>Disable</span>
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-3.5 w-3.5" />
                            <span>Enable</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table View (>= md) */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">User Identity</th>
                  <th className="px-5 py-3.5">Assigned Email Aliases</th>
                  <th className="px-5 py-3.5">Elevated Role</th>
                  <th className="px-5 py-3.5">Account Status</th>
                  <th className="px-5 py-3.5">Last Login</th>
                  <th className="px-5 py-3.5 text-right">Security Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400 dark:text-slate-500 font-sans text-xs">
                      No users found matching current filters.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const RoleIcon = ROLE_CONFIG[u.role]?.icon || Users;
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors">
                        {/* User Identity */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-xs font-bold text-white shadow-xs">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white text-xs">{u.name}</div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                @{u.username}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Assigned Aliases */}
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap items-center gap-1.5 max-w-sm">
                            {u.aliases.map((alias) => {
                              const isCopied = copiedAlias === alias.email_address;
                              return (
                                <button
                                  key={alias.id}
                                  onClick={() => handleCopyAlias(alias.email_address)}
                                  title="Click to copy email alias"
                                  className="group inline-flex items-center gap-1 rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 text-[11px] font-mono font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 shadow-2xs transition-colors"
                                >
                                  <span>{alias.email_address}</span>
                                  {isCopied ? (
                                    <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                  ) : (
                                    <Copy className="h-2.5 w-2.5 text-blue-400 opacity-60 group-hover:opacity-100" />
                                  )}
                                </button>
                              );
                            })}
                            <button
                              onClick={() => {
                                setAliasModalUser(u);
                                setNewAliasAddress('');
                              }}
                              title="Assign another company email alias"
                              className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-400 dark:hover:border-purple-600 transition-colors"
                            >
                              + Alias
                            </button>
                          </div>
                        </td>

                        {/* Role Badge (Click to elevate/modify) */}
                        <td className="px-5 py-4">
                          <button
                            onClick={() => {
                              setRoleModalUser(u);
                              setSelectedRole(u.role);
                            }}
                            title="Click to change account role"
                            className={`group inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider shadow-2xs hover:scale-[1.02] transition-all cursor-pointer ${
                              ROLE_CONFIG[u.role]?.pillClass
                            }`}
                          >
                            <RoleIcon className="h-3.5 w-3.5" />
                            <span>{ROLE_CONFIG[u.role]?.label || u.role}</span>
                            <span className="text-[9px] opacity-40 group-hover:opacity-100 font-normal">✎</span>
                          </button>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                              u.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
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

                        {/* Last Login */}
                        <td className="px-5 py-4 text-slate-500 dark:text-slate-400 font-medium">
                          {u.last_login_at
                            ? new Date(u.last_login_at).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Never'}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setResetModalUser(u);
                                setNewPassword('');
                              }}
                              title="Reset Password & Invalidate Active Sessions"
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-300 dark:hover:border-purple-700 shadow-2xs transition-colors"
                            >
                              <KeyRound className="h-3 w-3 text-purple-500" />
                              <span>Reset</span>
                            </button>

                            <button
                              onClick={() => handleToggleStatus(u)}
                              title={u.status === 'active' ? 'Disable Account Access' : 'Enable Account Access'}
                              className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-bold shadow-2xs transition-all ${
                                u.status === 'active'
                                  ? 'border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60'
                                  : 'border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                              }`}
                            >
                              {u.status === 'active' ? (
                                <>
                                  <UserX className="h-3 w-3" />
                                  <span>Disable</span>
                                </>
                              ) : (
                                <>
                                  <UserCheck className="h-3 w-3" />
                                  <span>Enable</span>
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Real-time Security Audit Stream */}
        <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-xs border border-slate-200 dark:border-slate-800 space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Security Audit Trail (Immutable)
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Forensic audit trail capturing authentication events, access changes, and mail transactions
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setAuditFilter('')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold border transition-all ${
                  !auditFilter
                    ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                All Events
              </button>
              <button
                onClick={() => setAuditFilter('LOGIN')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold border transition-all ${
                  auditFilter === 'LOGIN'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                Logins
              </button>
              <button
                onClick={() => setAuditFilter('ADMIN')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold border transition-all ${
                  auditFilter === 'ADMIN'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                Admin Privileges
              </button>
            </div>
          </div>

          {/* Desktop Audit Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 max-h-[360px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800 z-10">
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Action Type</th>
                  <th className="px-5 py-3">Target Resource</th>
                  <th className="px-5 py-3">Context Metadata</th>
                  <th className="px-5 py-3">Client Origin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 font-mono text-[11px]">
                {filteredAudits.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400 dark:text-slate-500 font-sans text-xs">
                      No security audit events recorded.
                    </td>
                  </tr>
                ) : (
                  filteredAudits.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/60 transition-colors">
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
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
                              ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                              : log.action.includes('ADMIN')
                              ? 'bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                              : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-800 dark:text-slate-200 font-semibold font-sans">
                        {log.resource_type || '-'}
                      </td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {JSON.stringify(log.metadata || {})}
                      </td>
                      <td className="px-5 py-3 text-slate-400 dark:text-slate-500 whitespace-nowrap">
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
        <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-xs border border-slate-200 dark:border-slate-800 space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
                <HardDrive className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Free-Tier Storage & Server Optimization
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Supabase & Vercel capacity monitoring with on-demand data pruning to maintain zero-cost tier for 50+
                  users
                </p>
              </div>
            </div>

            {storageStats && (
              <div className="flex items-center gap-2 rounded-2xl bg-purple-50 dark:bg-purple-950/40 px-3.5 py-1.5 border border-purple-200 dark:border-purple-800 text-xs font-bold text-purple-800 dark:text-purple-300">
                <span>Free Tier Used:</span>
                <span className="font-mono text-purple-600 dark:text-purple-400">
                  {storageStats.supabaseFreeTierCapacityPct}
                </span>
                <span className="text-slate-400 dark:text-slate-500 font-normal">
                  ({storageStats.estimatedStorageFormatted})
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Users & Staff</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                {storageStats?.totalEmployees || users.length}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Inbox Emails</div>
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                {storageStats?.inboxCount || 0}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Sent Emails</div>
              <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                {storageStats?.sentCount || 0}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Attachments</div>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {storageStats?.totalAttachments || 0}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Tasks</div>
              <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                {storageStats?.totalTasks || 0}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Audit Logs</div>
              <div className="text-lg font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                {storageStats?.totalAuditLogs || auditLogs.length}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="text-slate-500 dark:text-slate-400 text-[11px]">
              Tip: Attachment binaries are streamed on-demand to protect server memory and eliminate storage fees.
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePurge('audit_logs', 30)}
                disabled={purging}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
              >
                <Database className="h-3.5 w-3.5 text-purple-500" />
                <span>{purging ? 'Purging...' : 'Purge Audit Logs (>30d)'}</span>
              </button>

              <button
                onClick={() => handlePurge('old_messages', 90)}
                disabled={purging}
                className="flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-all disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                <span>{purging ? 'Purging...' : 'Purge Old Mails (>90d)'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* MODAL 1: Provision New User Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-7 shadow-2xl space-y-5 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
                    <UserPlus className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Provision User Account</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Create login and assign primary email alias</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateUserSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="e.g. Rohan Sharma"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-slate-900 dark:text-white placeholder-slate-400 focus:border-purple-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">
                      Username
                    </label>
                    <input
                      type="text"
                      required
                      value={createUsername}
                      onChange={(e) => setCreateUsername(e.target.value)}
                      placeholder="e.g. rohan"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-slate-900 dark:text-white placeholder-slate-400 focus:border-purple-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">
                      Account Role
                    </label>
                    <select
                      value={createRole}
                      onChange={(e) => setCreateRole(e.target.value as UserRole)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-slate-900 dark:text-white focus:border-purple-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none capitalize"
                    >
                      <option value="employee">Employee</option>
                      <option value="intern">Intern</option>
                      <option value="team_lead">Team Lead</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">
                    Assigned Company Email Alias
                  </label>
                  <input
                    type="text"
                    required
                    value={createAlias}
                    onChange={(e) => setCreateAlias(e.target.value)}
                    placeholder="e.g. rohan@cruvels.com"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-slate-900 dark:text-white placeholder-slate-400 focus:border-purple-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                      Initial Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setCreatePassword('Password123!')}
                      className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline font-semibold"
                    >
                      Use Default (Password123!)
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showCreatePassword ? 'text' : 'password'}
                      required
                      value={createPassword}
                      onChange={(e) => setCreatePassword(e.target.value)}
                      placeholder="Min. 10 characters"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 pr-10 text-slate-900 dark:text-white focus:border-purple-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreatePassword(!showCreatePassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 shadow-2xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingUser}
                    className="rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-purple-600/20 hover:bg-purple-700 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {creatingUser ? 'Provisioning...' : 'Provision Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: Assign Alias Modal */}
        {aliasModalUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Mail className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  Assign Alias to @{aliasModalUser.username}
                </h3>
                <button
                  onClick={() => setAliasModalUser(null)}
                  className="rounded-lg p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAssignAliasSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1.5 font-semibold uppercase tracking-wider text-[10px]">
                    New Company Email Address
                  </label>
                  <input
                    type="text"
                    required
                    value={newAliasAddress}
                    onChange={(e) => setNewAliasAddress(e.target.value)}
                    placeholder="e.g. rohan.sharma@cruvels.com"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-slate-900 dark:text-white placeholder-slate-400 focus:border-purple-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none font-mono"
                  />
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                    Will automatically append @cruvels.com if omitted.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setAliasModalUser(null)}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={assigningAlias}
                    className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700 shadow-md shadow-purple-600/20 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {assigningAlias ? 'Assigning...' : 'Assign Alias'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: Reset Password Modal (Instant Session Revocation + Mandatory Change Gate) */}
        {resetModalUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  Reset Credentials for @{resetModalUser.username}
                </h3>
                <button
                  onClick={() => {
                    setResetModalUser(null);
                    setNewPassword('');
                  }}
                  className="rounded-lg p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-3 text-[11px] text-amber-900 dark:text-amber-300 leading-relaxed">
                <strong>Zero-Trust Session Invalidation:</strong> Saving immediately logs out @{resetModalUser.username}{' '}
                from all active browsers and locks access until they choose a new password upon next sign-in.
              </div>

              <form onSubmit={handleResetPasswordSubmit} className="space-y-4 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                      New Temporary Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setNewPassword('Password123!')}
                      className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline font-bold"
                    >
                      Use Default (Password123!)
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showResetPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter min. 10 chars or click default"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 pr-10 text-slate-900 dark:text-white focus:border-purple-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setResetModalUser(null);
                      setNewPassword('');
                    }}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resettingPassword}
                    className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700 shadow-md shadow-purple-600/20 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {resettingPassword ? 'Resetting & Revoking...' : 'Reset & Log Out User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 4: Role Elevation / Change Modal */}
        {roleModalUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-2xl space-y-5 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
                    <Crown className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Elevate Role for @{roleModalUser.username}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Select new organizational permission tier
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setRoleModalUser(null)}
                  className="rounded-lg p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleRoleModalSubmit} className="space-y-4 text-xs">
                <div className="space-y-2">
                  {(['admin', 'manager', 'team_lead', 'employee', 'intern'] as UserRole[]).map((roleKey) => {
                    const cfg = ROLE_CONFIG[roleKey];
                    const Icon = cfg.icon;
                    const isSelected = selectedRole === roleKey;
                    return (
                      <label
                        key={roleKey}
                        onClick={() => setSelectedRole(roleKey)}
                        className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-purple-500 bg-purple-50/60 dark:bg-purple-950/40 shadow-xs'
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <input
                          type="radio"
                          name="roleSelection"
                          value={roleKey}
                          checked={isSelected}
                          onChange={() => setSelectedRole(roleKey)}
                          className="mt-0.5 text-purple-600 focus:ring-purple-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Icon className={`h-3.5 w-3.5 ${isSelected ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'}`} />
                            <span className="font-bold text-slate-900 dark:text-white capitalize">{cfg.label}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                            {cfg.description}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setRoleModalUser(null)}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingRole}
                    className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700 shadow-md shadow-purple-600/20 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {updatingRole ? 'Updating Role...' : 'Save Role Assignment'}
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
