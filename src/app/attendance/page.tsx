'use client';

import React, { useEffect, useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import {
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  Search,
  Users,
  User,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { AttendanceRecord, AttendanceStatus } from '@/lib/db/types';
import { getIndianDateString } from '@/lib/utils/date';
import { clientCache } from '@/lib/cache/clientCache';

export default function AttendancePage() {
  const todayStr = getIndianDateString();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [todayNotes, setTodayNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmStatus, setConfirmStatus] = useState<AttendanceStatus | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'my' | 'team'>('my');
  const [currentTime, setCurrentTime] = useState<string>('');

  // Live IST Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchAttendance = async () => {
    try {
      const [attRes, meRes] = await Promise.all([
        fetch('/api/attendance'),
        fetch('/api/auth/me'),
      ]);
      if (attRes.ok) {
        const data = await attRes.json();
        setRecords(data.records || []);
      }
      if (meRes.ok) {
        const meData = await meRes.json();
        setCurrentUser(meData.user || null);
        if (meData.user?.role === 'admin' || meData.user?.role === 'manager') {
          setActiveTab('my');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();

    const handleAttendanceUpdate = (e: any) => {
      if (e.detail) {
        setRecords((prev) => {
          const exists = prev.some((r) => r.id === e.detail.id);
          if (exists) return prev.map((r) => (r.id === e.detail.id ? e.detail : r));
          return [e.detail, ...prev];
        });
      }
    };

    window.addEventListener('attendance-updated', handleAttendanceUpdate);
    return () => window.removeEventListener('attendance-updated', handleAttendanceUpdate);
  }, []);

  const handleMarkAttendance = async (status: AttendanceStatus) => {
    setSubmitting(true);
    setError(null);
    setNotification(null);
    setConfirmStatus(null);

    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: todayStr,
          status,
          notes: todayNotes,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        clientCache.invalidate('dashboard_stats');
        setNotification(`🎉 Attendance for today recorded as ${status.replace('_', ' ')}.`);

        // Optimistically add/update record
        if (data.record) {
          setRecords((prev) => {
            const exists = prev.some((r) => r.id === data.record.id || r.date === data.record.date);
            if (exists) return prev.map((r) => (r.date === data.record.date ? data.record : r));
            return [data.record, ...prev];
          });
          // Broadcast to dashboard and all open views
          window.dispatchEvent(new CustomEvent('attendance-updated', { detail: data.record }));
        }

        setTodayNotes('');
        setTimeout(() => setNotification(null), 5000);
      } else {
        setError(data.error || 'Failed to record attendance.');
      }
    } catch {
      setError('Network connection error.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-bold border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Present (Office)
          </span>
        );
      case 'HALF_DAY':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 text-purple-700 px-3 py-1 text-xs font-bold border border-purple-200">
            <Clock className="h-3.5 w-3.5 text-purple-600" />
            Half Day
          </span>
        );
      case 'ON_LEAVE':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-700 px-3 py-1 text-xs font-bold border border-amber-200">
            <Calendar className="h-3.5 w-3.5 text-amber-600" />
            On Leave
          </span>
        );
      case 'ABSENT':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 text-rose-700 px-3 py-1 text-xs font-bold border border-rose-200">
            <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
            Absent
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-slate-100 text-slate-700 px-3 py-1 text-xs font-bold border border-slate-200">
            {status}
          </span>
        );
    }
  };

  // Check today's punch record
  const todayRecord = records.find((r) => r.date === todayStr);
  const isTodayLocked = Boolean(todayRecord);

  // Filter records
  const myRecords = records.filter((r) => !currentUser || r.employee_name === currentUser.name || r.marked_by_id === currentUser.id);
  const displayedRecords = activeTab === 'team' && (currentUser?.role === 'admin' || currentUser?.role === 'manager') ? records : myRecords;

  const filteredRecords = displayedRecords.filter((r) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return r.employee_name.toLowerCase().includes(q) || r.date.includes(q) || (r.notes && r.notes.toLowerCase().includes(q));
    }
    return true;
  });

  // Calculate Metrics
  const totalLogged = myRecords.length;
  const presentCount = myRecords.filter((r) => r.status === 'PRESENT').length;
  const halfDayCount = myRecords.filter((r) => r.status === 'HALF_DAY').length;
  const onLeaveCount = myRecords.filter((r) => r.status === 'ON_LEAVE').length;
  const absentCount = myRecords.filter((r) => r.status === 'ABSENT').length;
  const attendanceRate = totalLogged > 0 ? Math.round(((presentCount + halfDayCount * 0.5) / totalLogged) * 100) : 100;

  const isAdminOrLead = currentUser?.role === 'admin' || currentUser?.role === 'manager' || currentUser?.isGroupLeader;

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Main Header with IST Live Clock */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-blue-500/15">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Cruvels Internal Workforce System</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Attendance & Presence Hub
            </h1>
            <p className="text-xs text-blue-100 font-medium max-w-xl leading-relaxed">
              Verify daily shift presence, track performance metrics, and view immutable timestamp logs.
            </p>
          </div>

          {/* Live Indian Standard Time Badge */}
          <div className="flex flex-col items-start sm:items-end bg-white/15 backdrop-blur-md border border-white/20 px-4 py-3 rounded-2xl shrink-0">
            <div className="flex items-center gap-1.5 text-blue-100 text-[11px] font-medium">
              <Clock className="h-3.5 w-3.5 text-blue-200" />
              <span>Indian Standard Time (IST)</span>
            </div>
            <div className="text-lg sm:text-xl font-mono font-extrabold tracking-tight text-white mt-0.5">
              {currentTime || 'Loading...'}
            </div>
            <div className="text-[11px] text-blue-200 font-medium">
              Today: {new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>

        {/* Feedback Notifications */}
        {notification && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 shadow-sm animate-in fade-in">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span className="font-bold">{notification}</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 shadow-sm animate-in fade-in">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            <span className="font-bold">{error}</span>
          </div>
        )}

        {/* Daily Punch Card */}
        <div className="rounded-3xl bg-white p-6 sm:p-7 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-blue-600" />
                Today&apos;s Attendance Punch
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isTodayLocked
                  ? `Attendance for today (${todayStr}) is recorded and immutably locked.`
                  : `Please mark your attendance for today (${todayStr}). Requires one-click confirmation.`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 border border-blue-200">
                Date: {todayStr}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="h-24 w-full rounded-2xl bg-slate-100 animate-pulse flex items-center justify-center text-xs font-semibold text-slate-400">
              Checking attendance status...
            </div>
          ) : isTodayLocked ? (
            <div className="rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-500/20">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-emerald-950">
                      Attendance Recorded for Today
                    </span>
                    <span className="rounded-full bg-emerald-200/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-900 border border-emerald-300">
                      Locked
                    </span>
                  </div>
                  <div className="text-xs text-emerald-800 mt-0.5 font-medium">
                    Status: <strong>{todayRecord?.status.replace('_', ' ')}</strong>
                    {todayRecord?.punch_time && ` • Punched at ${todayRecord.punch_time} IST`}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-bold bg-white px-3.5 py-2 rounded-xl border border-emerald-200 shadow-sm">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Verified Timestamp
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  disabled={submitting}
                  onClick={() => setConfirmStatus('PRESENT')}
                  className="group flex flex-col items-center justify-center gap-2 rounded-2xl bg-emerald-50/70 border border-emerald-200 p-5 text-emerald-900 hover:bg-emerald-100 hover:border-emerald-300 hover:shadow-md transition-all font-bold text-xs cursor-pointer"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm group-hover:scale-105 transition-transform">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-extrabold">Present (Office)</span>
                  <span className="text-[11px] text-emerald-700 font-normal">Standard shift punch</span>
                </button>

                <button
                  disabled={submitting}
                  onClick={() => setConfirmStatus('HALF_DAY')}
                  className="group flex flex-col items-center justify-center gap-2 rounded-2xl bg-purple-50/70 border border-purple-200 p-5 text-purple-900 hover:bg-purple-100 hover:border-purple-300 hover:shadow-md transition-all font-bold text-xs cursor-pointer"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white shadow-sm group-hover:scale-105 transition-transform">
                    <Clock className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-extrabold">Half Day</span>
                  <span className="text-[11px] text-purple-700 font-normal">Partial shift punch</span>
                </button>

                <button
                  disabled={submitting}
                  onClick={() => setConfirmStatus('ON_LEAVE')}
                  className="group flex flex-col items-center justify-center gap-2 rounded-2xl bg-amber-50/70 border border-amber-200 p-5 text-amber-900 hover:bg-amber-100 hover:border-amber-300 hover:shadow-md transition-all font-bold text-xs cursor-pointer"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600 text-white shadow-sm group-hover:scale-105 transition-transform">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-extrabold">On Leave</span>
                  <span className="text-[11px] text-amber-700 font-normal">Approved day off</span>
                </button>

                <button
                  disabled={submitting}
                  onClick={() => setConfirmStatus('ABSENT')}
                  className="group flex flex-col items-center justify-center gap-2 rounded-2xl bg-rose-50/70 border border-rose-200 p-5 text-rose-900 hover:bg-rose-100 hover:border-rose-300 hover:shadow-md transition-all font-bold text-xs cursor-pointer"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 text-white shadow-sm group-hover:scale-105 transition-transform">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-extrabold">Absent</span>
                  <span className="text-[11px] text-rose-700 font-normal">Unplanned absence</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Confirmation Modal */}
        {confirmStatus && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl space-y-4 border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 shrink-0">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">Confirm Today&apos;s Attendance</h3>
                  <p className="text-xs text-slate-500">Date: {todayStr}</p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-700 space-y-2 border border-slate-200">
                <p className="leading-relaxed">
                  Are you sure you want to record today&apos;s attendance as{' '}
                  <strong className="text-blue-700 font-bold">{confirmStatus.replace('_', ' ')}</strong> at{' '}
                  <strong className="font-mono text-slate-900">{currentTime || 'current time'} IST</strong>?
                </p>
                <p className="text-[11px] text-slate-500 italic">
                  ⚠️ Note: Once confirmed, this status will be locked for today and cannot be modified.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setConfirmStatus(null)}
                  className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={submitting}
                  onClick={() => handleMarkAttendance(confirmStatus)}
                  className="glow-btn-primary rounded-xl px-5 py-2.5 text-xs font-bold text-white transition-all shadow-md shadow-blue-500/20"
                >
                  {submitting ? 'Recording...' : 'Yes, Confirm & Lock'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Presence Performance Metrics KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-3xl bg-white p-5 border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Attendance Rate</span>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {attendanceRate}%
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${attendanceRate}%` }}
              />
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 border border-slate-200 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Present Days</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {presentCount} <span className="text-xs text-slate-400 font-normal">/ {totalLogged} logs</span>
            </div>
            <p className="text-[11px] text-emerald-700 font-medium">On-site verified punches</p>
          </div>

          <div className="rounded-3xl bg-white p-5 border border-slate-200 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Half Days</span>
              <Clock className="h-4 w-4 text-purple-600" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {halfDayCount}
            </div>
            <p className="text-[11px] text-purple-700 font-medium">Partial shifts recorded</p>
          </div>

          <div className="rounded-3xl bg-white p-5 border border-slate-200 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Leaves / Absent</span>
              <Calendar className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {onLeaveCount + absentCount}
            </div>
            <p className="text-[11px] text-amber-700 font-medium">Off-duty or absent logs</p>
          </div>
        </div>

        {/* History & Timeline Table */}
        <div className="rounded-3xl bg-white p-6 sm:p-7 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Attendance Timeline & Logs
              </h2>
              <p className="text-xs text-slate-500">Historical records of daily presence and verified timestamps</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Role-based Tab Switcher for Admins/Leads */}
              {isAdminOrLead && (
                <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
                  <button
                    onClick={() => setActiveTab('my')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                      activeTab === 'my'
                        ? 'bg-white text-slate-900 shadow-sm font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <User className="h-3.5 w-3.5" />
                    <span>My Logs</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('team')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                      activeTab === 'team'
                        ? 'bg-white text-slate-900 shadow-sm font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>Team Roster</span>
                  </button>
                </div>
              )}

              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search date, name, status..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-xl border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none w-56 sm:w-64"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Employee Name</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Punch Timestamp</th>
                  <th className="px-5 py-3.5">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-slate-400 font-medium">
                      Loading attendance logs...
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <CalendarCheck className="h-8 w-8 text-slate-300" />
                        <span className="font-semibold text-slate-600">No attendance records found</span>
                        <span className="text-xs text-slate-400">Your presence logs will appear here as soon as you record attendance.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-slate-900 font-mono text-[11px]">
                        {r.date}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-800">
                        {r.employee_name}
                      </td>
                      <td className="px-5 py-3.5">{getStatusBadge(r.status)}</td>
                      <td className="px-5 py-3.5 font-mono text-slate-700 text-[11px]">
                        {r.punch_time ? (
                          <span className="inline-flex items-center gap-1 text-slate-800 font-bold">
                            <Clock className="h-3 w-3 text-blue-600" />
                            {r.punch_time} IST
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                          <ShieldCheck className="h-3 w-3 text-emerald-600" />
                          Logged & Secured
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
