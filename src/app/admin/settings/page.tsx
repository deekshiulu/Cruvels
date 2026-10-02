'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import AdminNavRail from '@/components/admin/AdminNavRail';
import {
  Sliders,
  Clock,
  Calendar,
  Bell,
  CheckSquare,
  Shield,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Lock,
  Globe,
} from 'lucide-react';
import { SystemSettings, PublicHolidayDefinition, DEFAULT_SYSTEM_SETTINGS } from '@/lib/db/types';

const DAYS_OF_WEEK = [
  { id: 1, label: 'Monday', short: 'Mon' },
  { id: 2, label: 'Tuesday', short: 'Tue' },
  { id: 3, label: 'Wednesday', short: 'Wed' },
  { id: 4, label: 'Thursday', short: 'Thu' },
  { id: 5, label: 'Friday', short: 'Fri' },
  { id: 6, label: 'Saturday', short: 'Sat' },
  { id: 7, label: 'Sunday', short: 'Sun' },
];

export default function AdminSystemSettingsPage() {
  const router = useRouter();

  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'attendance' | 'reminders' | 'tasks' | 'holidays' | 'portal'>('attendance');

  // New holiday modal/form state
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayType, setHolidayType] = useState<'national' | 'company' | 'optional'>('national');
  const [holidayDesc, setHolidayDesc] = useState('');
  const [addingHoliday, setAddingHoliday] = useState(false);
  const [syncingHolidays, setSyncingHolidays] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/settings');
      if (res.status === 403) {
        alert('Access denied. Administrator privileges required.');
        router.push('/dashboard');
        return;
      }
      const data = await res.json();
      if (res.ok && data.success && data.settings) {
        setSettings(data.settings);
      } else {
        setError(data.error || 'Failed to load system settings.');
      }
    } catch {
      setError('Network error while connecting to system settings API.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSaveSettings = async () => {
    setSaving(true);
    setError(null);
    setNotification(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSettings(data.settings);
        setNotification('System configuration successfully saved and applied.');
        setTimeout(() => setNotification(null), 5000);
      } else {
        setError(data.error || 'Failed to update system settings.');
      }
    } catch {
      setError('Network error during settings persistence.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm('Are you sure you want to reset all portal rules and deadlines to factory defaults?')) {
      return;
    }
    setResetting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_defaults' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSettings(data.settings);
        setNotification('System settings restored to platform defaults.');
        setTimeout(() => setNotification(null), 5000);
      } else {
        setError(data.error || 'Failed to reset settings.');
      }
    } catch {
      setError('Network error during reset operation.');
    } finally {
      setResetting(false);
    }
  };

  const handleToggleWorkingDay = (dayId: number) => {
    const currentDays = settings.attendanceRules?.workingDays || [1, 2, 3, 4, 5];
    let nextDays: number[];
    if (currentDays.includes(dayId)) {
      if (currentDays.length === 1) {
        alert('At least one working day must remain configured.');
        return;
      }
      nextDays = currentDays.filter((d) => d !== dayId);
    } else {
      nextDays = [...currentDays, dayId].sort();
    }
    setSettings({
      ...settings,
      attendanceRules: {
        ...settings.attendanceRules,
        workingDays: nextDays,
      },
    });
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayName.trim() || !holidayDate) {
      alert('Holiday name and date are required.');
      return;
    }
    setAddingHoliday(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_holiday',
          holiday: {
            name: holidayName.trim(),
            date: holidayDate,
            type: holidayType,
            description: holidayDesc.trim() || holidayName.trim(),
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSettings({
          ...settings,
          holidays: data.holidays,
        });
        setShowAddHoliday(false);
        setHolidayName('');
        setHolidayDate('');
        setHolidayDesc('');
        setNotification(`Holiday "${holidayName}" successfully registered.`);
        setTimeout(() => setNotification(null), 4000);
      } else {
        setError(data.error || 'Failed to add holiday.');
      }
    } catch {
      setError('Network error while adding holiday.');
    } finally {
      setAddingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (date: string, name: string) => {
    if (!confirm(`Delete holiday "${name}" on ${date}?`)) return;
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_holiday',
          date,
          name,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSettings({
          ...settings,
          holidays: data.holidays,
        });
        setNotification(`Holiday "${name}" removed.`);
        setTimeout(() => setNotification(null), 4000);
      } else {
        setError(data.error || 'Failed to delete holiday.');
      }
    } catch {
      setError('Network error while deleting holiday.');
    }
  };

  const handleSyncGoogleHolidays = async () => {
    setSyncingHolidays(true);
    setError(null);
    try {
      const res = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_holidays' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification(data.message || 'Google Calendar Public Holidays synced!');
        fetchSettings();
        setTimeout(() => setNotification(null), 4000);
      } else {
        setError(data.error || 'Failed to sync Google Calendar holidays.');
      }
    } catch {
      setError('Network error syncing Google Calendar holidays.');
    } finally {
      setSyncingHolidays(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Top 10-Section Navigation Rail */}
        <AdminNavRail currentTab="settings" />

        {/* Page Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-md text-white">
              <Sliders className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
                Dynamic System Settings
                <span className="rounded-full bg-purple-100 dark:bg-purple-900/40 px-2.5 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 uppercase tracking-wider">
                  Live Engine
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Configure attendance cutoffs, working days, reminder timing, task intervals, and public holidays
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleResetDefaults}
              disabled={resetting || saving || loading}
              className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-all disabled:opacity-50"
            >
              <RotateCcw className={`h-4 w-4 ${resetting ? 'animate-spin' : ''}`} />
              <span>Reset Factory Defaults</span>
            </button>

            <button
              onClick={handleSaveSettings}
              disabled={saving || loading}
              className="flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-purple-700 transition-all disabled:opacity-50"
            >
              <Save className={`h-4 w-4 ${saving ? 'animate-spin' : ''}`} />
              <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </div>

        {/* Notifications & Feedback */}
        {notification && (
          <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800/50 p-4 text-xs text-emerald-800 dark:text-emerald-300 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{notification}</span>
            </div>
            <button onClick={() => setNotification(null)} className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800/50 p-4 text-xs text-rose-800 dark:text-rose-300 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span className="font-semibold">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-700 dark:text-rose-400 font-bold hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Settings Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'attendance'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>Attendance Rules</span>
          </button>

          <button
            onClick={() => setActiveTab('reminders')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'reminders'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Bell className="h-4 w-4" />
            <span>Reminder Timing</span>
          </button>

          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'tasks'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <CheckSquare className="h-4 w-4" />
            <span>Task Intervals</span>
          </button>

          <button
            onClick={() => setActiveTab('holidays')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'holidays'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>Holiday Calendar ({settings.holidays?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('portal')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'portal'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Globe className="h-4 w-4" />
            <span>Portal Metadata</span>
          </button>
        </div>

        {/* Tab 1: Attendance Compliance Rules */}
        {activeTab === 'attendance' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Attendance Punch Cutoff & Grace Rules</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Define daily marking deadline in IST and the late grace period duration
                  </p>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold">
                  <Shield className="h-3.5 w-3.5" />
                  <span>Dynamic Engine Active</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Marking Deadline */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Marking Deadline (IST 24-Hour)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      pattern="^([01]\d|2[0-3]):[0-5]\d$"
                      value={settings.attendanceRules?.markingDeadline || '10:00'}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          attendanceRules: {
                            ...settings.attendanceRules,
                            markingDeadline: e.target.value,
                          },
                        })
                      }
                      className="w-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="10:00"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {['09:30', '10:00', '10:30', '11:00'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() =>
                            setSettings({
                              ...settings,
                              attendanceRules: {
                                ...settings.attendanceRules,
                                markingDeadline: preset,
                              },
                            })
                          }
                          className={`text-xs px-2.5 py-1.5 rounded-lg border font-semibold transition-all ${
                            settings.attendanceRules?.markingDeadline === preset
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Punches recorded after this time will be classified as <strong>MARKED LATE</strong>.
                  </p>
                </div>

                {/* Grace Period Duration */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Late Grace Period (Minutes)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={0}
                      max={240}
                      value={settings.attendanceRules?.gracePeriodMinutes ?? 30}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          attendanceRules: {
                            ...settings.attendanceRules,
                            gracePeriodMinutes: parseInt(e.target.value, 10) || 0,
                          },
                        })
                      }
                      className="w-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="text-xs font-semibold text-slate-500">Minutes</span>
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Punches up to {settings.attendanceRules?.gracePeriodMinutes ?? 30}m past deadline are allowed with late warning.
                  </p>
                </div>
              </div>

              {/* Working Days Selector */}
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Configured Working Days
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => {
                    const isSelected = settings.attendanceRules?.workingDays?.includes(day.id);
                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => handleToggleWorkingDay(day.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                          isSelected
                            ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-current opacity-70" />
                        <span>{day.label}</span>
                        {isSelected && <span className="text-[10px] opacity-80">(Active)</span>}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Compliance evaluation and automated reminders trigger strictly on these selected days.
                </p>
              </div>

              {/* Advanced Policies & Approver Roles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Correction Approver Authority
                  </label>
                  <select
                    value={settings.attendanceRules?.correctionApproverRole || 'admin'}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        attendanceRules: {
                          ...settings.attendanceRules,
                          correctionApproverRole: e.target.value as any,
                        },
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="admin">System Administrators Only</option>
                    <option value="group_leader">Assigned Squad Leaders & POCs</option>
                    <option value="manager">Department Managers & Admins</option>
                  </select>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Who possesses review and resolution authority over submitted attendance correction tickets.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Zero-Trust Security Safeguards
                  </label>
                  <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
                    <Lock className="h-5 w-5 text-amber-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                        Direct Self-Editing Locked
                      </div>
                      <div className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                        Mandated by compliance policy § 1.1. Regular employees cannot alter past punches without formal ticket review.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Reminder Timing */}
        {activeTab === 'reminders' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-sm space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Automated Compliance Reminder Schedule</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Configure timing offsets for pre-deadline morning nudges and final cutoff notifications
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  First Morning Reminder (T-30m)
                </label>
                <input
                  type="text"
                  pattern="^([01]\d|2[0-3]):[0-5]\d$"
                  value={settings.reminderTiming?.first_reminder || '09:30'}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      reminderTiming: {
                        ...settings.reminderTiming,
                        first_reminder: e.target.value,
                      },
                    })
                  }
                  className="w-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 dark:text-white"
                  placeholder="09:30"
                />
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Friendly prompt to remind interns that attendance marking is open.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Second Cutoff Reminder (Deadline T-0m)
                </label>
                <input
                  type="text"
                  pattern="^([01]\d|2[0-3]):[0-5]\d$"
                  value={settings.reminderTiming?.second_reminder || '10:00'}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      reminderTiming: {
                        ...settings.reminderTiming,
                        second_reminder: e.target.value,
                      },
                    })
                  }
                  className="w-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 dark:text-white"
                  placeholder="10:00"
                />
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Urgent alert dispatched to employees who have not yet recorded attendance.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.reminderTiming?.deadline_warning ?? true}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      reminderTiming: {
                        ...settings.reminderTiming,
                        deadline_warning: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4 rounded text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Enable High-Priority Deadline Warning Alerts</span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Dispatches high-priority drawer and desktop notifications with immediate action link to punch attendance.
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Tab 3: Task Reminder Intervals */}
        {activeTab === 'tasks' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-sm space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Task Reminders & Workload Automation (§ 9.2)</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Automated reminder timing for unacknowledged assignments, approaching deadlines, and blocked tickets
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Unacknowledged Task Alert Threshold (Hours)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={settings.taskReminderIntervals?.unacknowledged_hours ?? 24}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        taskReminderIntervals: {
                          ...settings.taskReminderIntervals,
                          unacknowledged_hours: parseInt(e.target.value, 10) || 24,
                        },
                      })
                    }
                    className="w-32 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 dark:text-white"
                  />
                  <span className="text-xs font-semibold text-slate-500">Hours after assignment</span>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Assignees who haven&apos;t acknowledged task receipt within this time receive an escalation reminder.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Overdue Escalation Threshold (Hours)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={72}
                    value={settings.taskReminderIntervals?.overdue_escalation_hours ?? 12}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        taskReminderIntervals: {
                          ...settings.taskReminderIntervals,
                          overdue_escalation_hours: parseInt(e.target.value, 10) || 12,
                        },
                      })
                    }
                    className="w-32 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 dark:text-white"
                  />
                  <span className="text-xs font-semibold text-slate-500">Hours after due date</span>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Tasks remaining incomplete past due date trigger escalation alerts to both assignee and assigned POC.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Holiday Calendar Manager */}
        {activeTab === 'holidays' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Corporate & National Holiday Calendar</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Holidays automatically exempt interns and employees from attendance marking requirements
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSyncGoogleHolidays}
                    disabled={syncingHolidays}
                    className="flex items-center gap-2 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 px-3.5 py-2 text-xs font-bold text-purple-700 dark:text-purple-300 shadow-sm hover:bg-purple-100 dark:hover:bg-purple-900/60 transition-all disabled:opacity-50"
                  >
                    <RotateCcw className={`h-4 w-4 ${syncingHolidays ? 'animate-spin' : ''}`} />
                    <span>{syncingHolidays ? 'Syncing...' : 'Sync Google Calendar Holidays'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAddHoliday(true)}
                    className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-purple-700 transition-all"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Holiday</span>
                  </button>
                </div>
              </div>

              {/* Add Holiday Dialog / Form */}
              {showAddHoliday && (
                <form
                  onSubmit={handleAddHoliday}
                  className="p-5 rounded-2xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 space-y-4 animate-in fade-in"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-purple-900 dark:text-purple-200 uppercase tracking-wider">
                      Register New Holiday
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowAddHoliday(false)}
                      className="text-xs font-semibold text-purple-700 dark:text-purple-400 hover:underline"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                        Holiday Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={holidayName}
                        onChange={(e) => setHolidayName(e.target.value)}
                        placeholder="e.g. Founders Day"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                        Date (YYYY-MM-DD) *
                      </label>
                      <input
                        type="date"
                        required
                        value={holidayDate}
                        onChange={(e) => setHolidayDate(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                        Holiday Classification *
                      </label>
                      <select
                        value={holidayType}
                        onChange={(e) => setHolidayType(e.target.value as any)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
                      >
                        <option value="national">National Holiday</option>
                        <option value="company">Company Holiday</option>
                        <option value="optional">Optional / Restricted Holiday</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      Description / Notes
                    </label>
                    <input
                      type="text"
                      value={holidayDesc}
                      onChange={(e) => setHolidayDesc(e.target.value)}
                      placeholder="Brief note or celebration details"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddHoliday(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addingHoliday}
                      className="px-4 py-2 rounded-xl bg-purple-600 text-xs font-bold text-white hover:bg-purple-700"
                    >
                      {addingHoliday ? 'Registering...' : 'Confirm & Add'}
                    </button>
                  </div>
                </form>
              )}

              {/* Holidays Table / Card View */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                {/* Mobile Card View (< md) */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {(settings.holidays || []).length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No holidays scheduled yet.
                    </div>
                  ) : (
                    (settings.holidays || []).map((holiday) => (
                      <div key={`${holiday.date}-${holiday.name}`} className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-sm text-slate-900 dark:text-white">{holiday.name}</div>
                            <div className="font-mono text-xs text-slate-500 dark:text-slate-400 mt-0.5">{holiday.date}</div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 ${
                              holiday.type === 'national'
                                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                                : holiday.type === 'company'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {holiday.type}
                          </span>
                        </div>

                        {holiday.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">{holiday.description}</p>
                        )}

                        <div className="pt-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleDeleteHoliday(holiday.date, holiday.name)}
                            className="min-h-[44px] px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-bold text-xs inline-flex items-center gap-1.5"
                          >
                            <Trash2 className="h-4 w-4" /> Remove Holiday
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Desktop Table View (>= md) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Holiday Name</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                      {(settings.holidays || []).map((holiday) => (
                        <tr key={`${holiday.date}-${holiday.name}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">{holiday.name}</td>
                          <td className="px-4 py-3.5 font-mono text-slate-600 dark:text-slate-400">{holiday.date}</td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                holiday.type === 'national'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                                  : holiday.type === 'company'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                  : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {holiday.type}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">{holiday.description || '—'}</td>
                          <td className="px-4 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteHoliday(holiday.date, holiday.name)}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                              title="Delete Holiday"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Portal Metadata */}
        {activeTab === 'portal' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-sm space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Portal Identity & Operational Contacts</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Customize internal portal title, branding labels, and escalation contacts
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Portal Name
                </label>
                <input
                  type="text"
                  value={settings.portalName || 'Cruvels Workplace OS'}
                  onChange={(e) => setSettings({ ...settings, portalName: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Support & Operations Escalation Email
                </label>
                <input
                  type="email"
                  value={settings.supportEmail || 'ops@cruvels.com'}
                  onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
