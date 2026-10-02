'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import {
  User as UserIcon,
  Mail,
  Shield,
  Key,
  CheckCircle2,
  AlertCircle,
  Building2,
  Phone,
  Sparkles,
  Save,
  AtSign,
  Eye,
  EyeOff,
  Check,
  X,
} from 'lucide-react';
import { AuthSessionUser, Employee } from '@/lib/db/types';
import { clearTabSession } from '@/lib/auth/client-session';
import { clientCache } from '@/lib/cache/clientCache';

function ProfileContent() {
  const searchParams = useSearchParams();
  const forcePassword = searchParams.get('force') === 'password';
  const [user, setUser] = useState<AuthSessionUser | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile editable fields
  const [phone, setPhone] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [tagline, setTagline] = useState('');

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password visibility toggles
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        if (data.employee) {
          setEmployee(data.employee);
          setPhone(data.employee.phone || '');
          setPersonalEmail(data.employee.personal_email || '');
          setTagline(data.employee.tagline || '');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setError(null);
    setNotification(null);

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          personalEmail,
          tagline,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setNotification('Profile details updated successfully!');
        if (data.employee) setEmployee(data.employee);
        setTimeout(() => setNotification(null), 4000);
      } else {
        setError(data.error || 'Failed to update profile.');
      }
    } catch {
      setError('Network error while saving profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingPassword(true);
    setError(null);
    setNotification(null);

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      setUpdatingPassword(false);
      return;
    }

    if (newPassword.length < 10) {
      setError('Password must be at least 10 characters and include upper, lower, and a number.');
      setUpdatingPassword(false);
      return;
    }

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (forcePassword) {
          clearTabSession();
          clientCache.clear();
          await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
          window.location.href = '/login?message=password_updated';
          return;
        }
        setNotification('Password changed successfully! Your session is renewed.');
        setTimeout(() => setNotification(null), 4000);
      } else {
        setError(data.error || 'Failed to update password.');
      }
    } catch {
      setError('Network error while updating password.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
            <UserIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Account Profile & Settings</h1>
            <p className="text-xs text-slate-500">Manage your profile tagline, contact details, and security credentials</p>
          </div>
        </div>

        {forcePassword && (
          <div className="flex items-center gap-3.5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 shadow-sm">
            <Shield className="h-6 w-6 text-amber-600 shrink-0" />
            <div>
              <div className="font-bold text-sm">Password Change Required to Access Account</div>
              <div className="mt-0.5 text-slate-700">
                Your administrator has reset your password. You must set a new personal password before you can access the Cruvels workspace. Once updated, you will be redirected to log in with your new password.
              </div>
            </div>
          </div>
        )}

        {/* Notifications & Error Alerts */}
        {notification && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{notification}</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 animate-in fade-in">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Profile Card Summary */}
        <div className="rounded-3xl bg-white p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-2xl font-extrabold text-white shadow-md">
                {user?.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  {user?.name}
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 uppercase border border-blue-200">
                    {user?.role}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 font-mono mt-0.5">@{user?.username}</p>
                {tagline && <p className="text-xs text-blue-600 font-medium mt-1">“{tagline}”</p>}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 px-4 py-2.5 border border-slate-200 text-xs">
              <span className="text-slate-400 font-medium">Designation: </span>
              <span className="font-bold text-slate-900">{employee?.designation || 'Cruvels Team Member'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-xs">
            <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200 space-y-2">
              <div className="text-[10px] font-bold uppercase text-slate-400">Assigned Work Email (Locked)</div>
              <div className="font-mono font-bold text-slate-900 text-sm flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-600" />
                <span>{user?.primaryAlias}</span>
              </div>
              <p className="text-[11px] text-slate-500">
                All work dispatches and team communications route strictly through this company address.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200 space-y-2">
              <div className="text-[10px] font-bold uppercase text-slate-400">Department & Squad</div>
              <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4 text-purple-600" />
                <span>{employee?.department_name || 'Engineering'} • {employee?.group_name || 'General Squad'}</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Employee ID: {employee?.employee_code || 'CRUV-001'}
              </p>
            </div>
          </div>
        </div>

        {/* Profile Customization Form (Hidden during forced password setup) */}
        {!forcePassword && (
        <div className="rounded-3xl bg-white p-6 border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Personal Details & Contact</h3>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-xl text-xs">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Professional Tagline / Status</label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. Full-Stack Engineer • Core Platform Squad"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">Visible to team members in the squad directory.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Mobile / Phone Number</label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 pl-9 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Personal Recovery Email</label>
                <div className="relative">
                  <AtSign className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="email"
                    value={personalEmail}
                    onChange={(e) => setPersonalEmail(e.target.value)}
                    placeholder="personal@gmail.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 pl-9 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="glow-btn-primary flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{savingProfile ? 'Saving Details...' : 'Save Profile Details'}</span>
            </button>
          </form>
        </div>
        )}

        {/* Change Password Card */}
        <div className="rounded-3xl bg-white p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Key className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Update Account Password</h3>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md text-xs">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 pr-10 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  tabIndex={-1}
                  aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">New Password (min 10 chars)</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new strong password"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 pr-10 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  tabIndex={-1}
                  aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password requirement badges */}
              {newPassword.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className={`flex items-center gap-1 ${newPassword.length >= 10 ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                    {newPassword.length >= 10 ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-slate-300 ml-1 mr-0.5" />}
                    10+ characters
                  </span>
                  <span className={`flex items-center gap-1 ${/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                    {/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-slate-300 ml-1 mr-0.5" />}
                    Upper & lowercase
                  </span>
                  <span className={`flex items-center gap-1 ${/[0-9]/.test(newPassword) ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                    {/[0-9]/.test(newPassword) ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-slate-300 ml-1 mr-0.5" />}
                    At least 1 number
                  </span>
                  <span className={`flex items-center gap-1 ${newPassword.toLowerCase() !== 'password123!' && newPassword.toLowerCase() !== 'password123' ? 'text-emerald-600 font-medium' : 'text-rose-500 font-medium'}`}>
                    {newPassword.toLowerCase() !== 'password123!' && newPassword.toLowerCase() !== 'password123' ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    Not default password
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password to verify"
                  className={`w-full rounded-xl border p-2.5 pr-10 text-slate-900 focus:bg-white focus:outline-none transition-all ${
                    confirmPassword.length > 0 && newPassword !== confirmPassword
                      ? 'border-rose-300 bg-rose-50/30 focus:border-rose-500'
                      : newPassword.length > 0 && confirmPassword.length > 0 && newPassword === confirmPassword
                      ? 'border-emerald-300 bg-emerald-50/20 focus:border-emerald-500'
                      : 'border-slate-200 bg-slate-50 focus:border-blue-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1 font-medium">
                  <X className="h-3 w-3" /> Passwords do not match
                </p>
              )}
              {newPassword.length > 0 && confirmPassword.length > 0 && newPassword === confirmPassword && (
                <p className="mt-1 text-[11px] text-emerald-600 flex items-center gap-1 font-medium">
                  <Check className="h-3 w-3" /> Passwords match
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={updatingPassword}
              className="glow-btn-primary flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-50"
            >
              <Key className="h-4 w-4" />
              <span>
                {updatingPassword
                  ? 'Updating Password...'
                  : forcePassword
                  ? 'Update Password & Return to Login'
                  : 'Change Password'}
              </span>
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}
