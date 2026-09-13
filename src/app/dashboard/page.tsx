'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import {
  Mail,
  CalendarDays,
  CheckSquare,
  Users,
  Megaphone,
  Calendar,
  ArrowRight,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  Home,
  Clock,
  Building2,
  ShieldCheck,
  Award,
} from 'lucide-react';

import { clientCache } from '@/lib/cache/clientCache';
import { getIndianDateString } from '@/lib/utils/date';

export default function DashboardPage() {
  const router = useRouter();
  const cachedStats = clientCache.get<any>('dashboard_stats');
  const [stats, setStats] = useState<any>(cachedStats || null);
  const [loading, setLoading] = useState(!cachedStats);
  const [marking, setMarking] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/dashboard/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        clientCache.set('dashboard_stats', undefined, data.stats);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    const handleAttendanceUpdate = (e: any) => {
      if (e.detail) {
        setStats((prev: any) => ({
          ...prev,
          todayAttendance: e.detail,
        }));
        clientCache.invalidate('dashboard_stats');
      }
    };

    window.addEventListener('attendance-updated', handleAttendanceUpdate);
    window.addEventListener('focus', fetchStats);
    return () => {
      window.removeEventListener('attendance-updated', handleAttendanceUpdate);
      window.removeEventListener('focus', fetchStats);
    };
  }, []);

  const handleMarkAttendance = async (status: string) => {
    setMarking(true);
    setStatusMessage(null);
    setShowConfirmModal(false);

    const today = getIndianDateString();
    const currentTimeIST = new Date().toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, status }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Instant optimistic update with zero lag
        const updatedRecord = data.record || {
          status,
          punch_time: currentTimeIST,
          date: today,
        };
        setStats((prev: any) => ({
          ...prev,
          todayAttendance: updatedRecord,
        }));
        clientCache.invalidate('dashboard_stats');
        setStatusMessage(`🎉 Attendance marked as ${status.replace('_', ' ')} for today.`);
        window.dispatchEvent(new CustomEvent('attendance-updated', { detail: updatedRecord }));
        await fetchStats();
      } else {
        setStatusMessage(data.error || 'Failed to mark attendance.');
      }
    } catch {
      setStatusMessage('Network connection error.');
    } finally {
      setMarking(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const currentStatus = stats?.todayAttendance?.status;
  const punchTime = stats?.todayAttendance?.punch_time;

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-blue-500/15">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Cruvels Internal Workplace OS</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {stats?.employee?.name || 'Cruvels Team Member'}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-blue-100 font-medium pt-1">
              <span>{stats?.employee?.designation || 'Team Member'}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {stats?.employee?.department_name || 'General Operations'}
              </span>
              {stats?.employee?.group_name && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full font-bold">
                    <Award className="h-3 w-3" />
                    Squad: {stats.employee.group_name} {stats.employee.is_group_leader ? '(Group Leader)' : ''}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/mail/compose')}
              className="rounded-2xl bg-white px-4 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-50 transition-all shadow-sm"
            >
              Compose Email
            </button>
            <button
              onClick={() => router.push('/leaves')}
              className="rounded-2xl bg-blue-700/70 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 transition-all border border-white/20"
            >
              Request Leave
            </button>
          </div>
        </div>

        {/* Daily Attendance & KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Daily Attendance Card */}
          <div className="rounded-3xl bg-white p-5 border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                <span>Today&apos;s Attendance</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </span>
            </div>

            <div className="text-center py-1">
              {currentStatus ? (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-800">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span>Marked as {currentStatus.replace('_', ' ')}</span>
                  </div>
                  {punchTime && (
                    <div className="text-[10px] text-emerald-700 font-mono font-medium">
                      Punched at {punchTime}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-center">
                  <span className="text-xs text-amber-700 font-bold">● Not marked yet today</span>
                </div>
              )}
            </div>

            {statusMessage && (
              <div className="text-[11px] text-center font-medium text-blue-600 bg-blue-50 py-1 rounded-lg">
                {statusMessage}
              </div>
            )}

            <div>
              {currentStatus ? (
                <button
                  disabled
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-400 cursor-not-allowed border border-slate-200"
                >
                  <ShieldCheck className="h-4 w-4 text-slate-400" />
                  <span>Attendance Recorded</span>
                </button>
              ) : (
                <button
                  disabled={marking}
                  onClick={() => setShowConfirmModal(true)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40 transition-all shadow-sm shadow-emerald-500/20"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Mark Present (Office)</span>
                </button>
              )}
            </div>
          </div>

          {/* Unread Mailbox Widget */}
          <div
            onClick={() => router.push('/mail/inbox')}
            className="rounded-3xl bg-white p-5 border border-slate-200 shadow-sm space-y-3 cursor-pointer hover:border-blue-300 transition-all group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <Mail className="h-4 w-4 text-blue-600" />
                <span>Mailbox</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </div>

            <div>
              <div className="text-3xl font-extrabold text-slate-900">
                {stats?.unreadEmails || 0}
              </div>
              <div className="text-xs text-slate-500 mt-1">Unread emails in inbox</div>
            </div>

            <div className="text-[11px] font-semibold text-blue-600 flex items-center gap-1">
              <span>View Mailbox Gateway</span>
              <ArrowRight className="h-3 w-3" />
            </div>
          </div>

          {/* Tasks & Productivity Widget */}
          <div
            onClick={() => router.push('/tasks')}
            className="rounded-3xl bg-white p-5 border border-slate-200 shadow-sm space-y-3 cursor-pointer hover:border-blue-300 transition-all group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <CheckSquare className="h-4 w-4 text-purple-600" />
                <span>Tasks Assigned</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-purple-600 transition-colors" />
            </div>

            <div>
              <div className="text-3xl font-extrabold text-slate-900">
                {stats?.pendingTasksCount || 0}
              </div>
              <div className="text-xs text-slate-500 mt-1">Active tasks pending</div>
            </div>

            <div className="text-[11px] font-semibold text-purple-600 flex items-center gap-1">
              <span>Open Kanban Board</span>
              <ArrowRight className="h-3 w-3" />
            </div>
          </div>

          {/* Leave Balances Widget */}
          <div
            onClick={() => router.push('/leaves')}
            className="rounded-3xl bg-white p-5 border border-slate-200 shadow-sm space-y-3 cursor-pointer hover:border-blue-300 transition-all group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <CalendarDays className="h-4 w-4 text-emerald-600" />
                <span>Time Off Balances</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
            </div>

            <div className="grid grid-cols-3 gap-1 text-center py-1">
              <div>
                <div className="text-lg font-bold text-slate-900">{stats?.leaveBalances?.casual ?? 12}</div>
                <div className="text-[9px] text-slate-400 uppercase font-bold">Casual</div>
              </div>
              <div>
                <div className="text-lg font-bold text-slate-900">{stats?.leaveBalances?.sick ?? 10}</div>
                <div className="text-[9px] text-slate-400 uppercase font-bold">Sick</div>
              </div>
              <div>
                <div className="text-lg font-bold text-slate-900">{stats?.leaveBalances?.annual ?? 15}</div>
                <div className="text-[9px] text-slate-400 uppercase font-bold">Annual</div>
              </div>
            </div>

            <div className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
              <span>Manage Leaves</span>
              <ArrowRight className="h-3 w-3" />
            </div>
          </div>
        </div>

        {/* Two Columns: Notice Board & Today's Schedule */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Company Notice Board Stream */}
          <div className="rounded-3xl bg-white p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                  <Megaphone className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">Notice Board Announcements</h2>
              </div>
              <button
                onClick={() => router.push('/notices')}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                View All
              </button>
            </div>

            <div className="space-y-3">
              {(!stats?.recentNotices || stats.recentNotices.length === 0) && (
                <div className="text-center py-6 text-xs text-slate-400 font-medium">
                  No company notices broadcasted yet.
                </div>
              )}
              {stats?.recentNotices?.map((notice: any) => (
                <div
                  key={notice.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-1.5 hover:border-slate-300 transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-slate-900 truncate">{notice.title}</span>
                    <span className="rounded-md bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-bold uppercase shrink-0">
                      {notice.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{notice.content}</p>
                  <div className="text-[10px] text-slate-400 font-medium">
                    Posted by {notice.author_name} • {new Date(notice.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Today's Schedule & Meetings */}
          <div className="rounded-3xl bg-white p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-200">
                  <Calendar className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">Today&apos;s Schedule & Shifts</h2>
              </div>
              <button
                onClick={() => router.push('/schedule')}
                className="text-xs font-semibold text-purple-600 hover:underline"
              >
                Full Calendar
              </button>
            </div>

            <div className="space-y-3">
              {(!stats?.todaySchedule || stats.todaySchedule.length === 0) && (
                <div className="text-center py-6 text-xs text-slate-400 font-medium">
                  No meetings or events scheduled for today.
                </div>
              )}
              {stats?.todaySchedule?.map((evt: any) => (
                <div
                  key={evt.id}
                  className="flex items-start justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-4 hover:border-purple-200 transition-all"
                >
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-900">{evt.title}</div>
                    <div className="text-[11px] text-slate-500">{evt.description}</div>
                    <div className="text-[10px] text-slate-400 font-medium">{evt.location}</div>
                  </div>
                  <span className="rounded-lg bg-purple-50 text-purple-700 px-2.5 py-1 text-[11px] font-mono font-bold shrink-0 border border-purple-200">
                    {new Date(evt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Attendance Punch Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4 border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Confirm Today&apos;s Attendance</h3>
                  <p className="text-xs text-slate-500">Attendance is locked once recorded.</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
                Are you sure you want to mark today&apos;s attendance as <strong>Present (Office)</strong> at <strong>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</strong>?
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={marking}
                  onClick={() => {
                    setShowConfirmModal(false);
                    handleMarkAttendance('PRESENT');
                  }}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  {marking ? 'Recording...' : 'Yes, Confirm Present'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
