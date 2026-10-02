'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import {
  Mail,
  CalendarDays,
  CheckSquare,
  Megaphone,
  Calendar as CalendarIcon,
  ArrowRight,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Building2,
  ShieldCheck,
  Award,
  Zap,
  StickyNote,
  HardDrive,
  Users,
  Clock,
  Send,
  Plus,
  Compass,
  Check,
  AlertCircle,
  FileText,
  MapPin,
} from 'lucide-react';

import { clientCache } from '@/lib/cache/clientCache';
import { getIndianDateString } from '@/lib/utils/date';
import { AuthSessionUser } from '@/lib/db/types';

// Subtle Topographic Contour Wave SVG background for cards
function TopoWaveSvg({ color = '#3B82F6', opacity = 0.2 }: { color?: string; opacity?: number }) {
  const gradId = `grad-${color.replace('#', '')}`;
  return (
    <svg
      className="absolute right-0 bottom-0 w-64 h-36 pointer-events-none transition-opacity duration-300 select-none"
      style={{ opacity }}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 300 150"
      preserveAspectRatio="none"
    >
      <path
        d="M0,120 Q80,60 160,110 T300,80 L300,150 L0,150 Z"
        fill={`url(#${gradId})`}
      />
      <path
        d="M-20,100 Q80,40 180,95 T320,60"
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        opacity="0.8"
      />
      <path
        d="M-20,120 Q90,65 190,115 T320,85"
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        opacity="0.5"
      />
      <path
        d="M-20,140 Q100,90 200,135 T320,110"
        fill="none"
        stroke={color}
        strokeWidth="1"
        opacity="0.3"
      />
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.09" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  // User session
  const [currentUser, setCurrentUser] = useState<AuthSessionUser | null>(() => {
    if (typeof window !== 'undefined') {
      return clientCache.get<AuthSessionUser>('session_user') || null;
    }
    return null;
  });

  // Telemetry stats
  const cachedStats = clientCache.get<any>('dashboard_stats');
  const [stats, setStats] = useState<any>(cachedStats || null);
  const [loading, setLoading] = useState(!cachedStats);

  // Attendance Punch State
  const [marking, setMarking] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Interactive Calendar Navigation
  const [calendarDate, setCalendarDate] = useState(() => new Date());

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

    // Check user session
    if (!currentUser) {
      fetch('/api/auth/me')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.user) {
            setCurrentUser(d.user);
            clientCache.set('session_user', undefined, d.user);
          }
        })
        .catch(() => {});
    }

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

  // Real attendance status
  const todayAttendance = stats?.todayAttendance;
  const isPunched = Boolean(todayAttendance?.status);
  const currentStatus = todayAttendance?.status;
  const punchTime = todayAttendance?.punch_time;

  // Real employee profile data
  const employee = stats?.employee;
  const displayName = employee?.name || currentUser?.name || 'Cruvels Team Member';
  const designation = employee?.designation || (currentUser?.role === 'admin' ? 'Administrator' : 'Team Member');
  const departmentName = employee?.department_name || 'Engineering & Operations';
  const squadName = employee?.group_name;

  // Real Indian Date Display
  const todayDateFormatted = new Date().toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Calendar calculations
  const currentYear = calendarDate.getFullYear();
  const currentMonth = calendarDate.getMonth();
  const monthName = calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1; // Mon = 0
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const todayDateNumber = new Date().getDate();
  const isCurrentMonthView =
    new Date().getMonth() === currentMonth && new Date().getFullYear() === currentYear;

  const calendarDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < adjustedFirstDay; i++) {
      days.push({ dayNumber: null, isCurrent: false, hasDot: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        dayNumber: d,
        isCurrent: isCurrentMonthView && d === todayDateNumber,
        hasDot: (stats?.todaySchedule || []).length > 0 && d === todayDateNumber,
      });
    }
    return days;
  }, [adjustedFirstDay, daysInMonth, isCurrentMonthView, todayDateNumber, stats?.todaySchedule]);

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1560px] mx-auto pb-12">
        {/* ── 1. Hero Banner: Workplace OS ─────────────────────── */}
        <div
          className="relative overflow-hidden rounded-2xl border border-slate-800/80 p-6 sm:p-7 shadow-[0_4px_30px_rgba(0,0,0,0.5)] bg-slate-950 dark-banner"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(6, 12, 19, 0.96) 0%, rgba(8, 16, 26, 0.88) 55%, rgba(10, 22, 36, 0.6) 100%), url('/hero-mountain.jpg')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 35%',
          }}
        >
          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2.5 max-w-2xl">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold bg-blue-950/80 text-blue-300 border border-blue-500/30 shadow-[0_0_12px_rgba(59,130,246,0.15)]">
                <img src="/cruvels-logo-transparent.png" alt="Cruvels Logo" className="h-4 w-4 object-contain" />
                <span>Cruvels Workplace OS</span>
              </div>

              {/* Headline */}
              <h1
                className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white"
                style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: '#FFFFFF' }}
              >
                Welcome back, {displayName} 👋
              </h1>

              <p className="text-xs sm:text-sm text-slate-300">
                Here&apos;s what&apos;s happening with your workspace today.
              </p>

              {/* Dynamic Identity Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-semibold">
                <span className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 bg-slate-900/80 text-slate-300 border border-slate-700/60 backdrop-blur-xs">
                  <Users className="h-3.5 w-3.5 text-slate-400" />
                  <span>{designation}</span>
                </span>
                <span className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 bg-slate-900/80 text-slate-300 border border-slate-700/60 backdrop-blur-xs">
                  <Building2 className="h-3.5 w-3.5 text-blue-400" />
                  <span>{departmentName}</span>
                </span>
                {squadName && (
                  <span className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 bg-amber-950/60 text-amber-300 border border-amber-500/40 backdrop-blur-xs">
                    <Award className="h-3.5 w-3.5 text-amber-400" />
                    <span>Squad: {squadName}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Quick Header Actions */}
            <div className="flex flex-col items-start lg:items-end justify-between gap-4 shrink-0">
              <div className="text-left lg:text-right max-w-xs">
                <p className="text-xs italic text-slate-300/90 font-medium leading-relaxed">
                  &ldquo;Better systems. Happier people. A stronger tomorrow.&rdquo;
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push('/mail/compose')}
                  className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 transition-all shadow-md cursor-pointer"
                >
                  <Mail className="h-4 w-4 text-cyan-400" />
                  <span>Compose Email</span>
                </button>
                <button
                  onClick={() => router.push('/leaves')}
                  className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-[0_0_18px_rgba(37,99,235,0.35)] cursor-pointer"
                >
                  <CalendarIcon className="h-4 w-4" />
                  <span>Request Leave</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── 2. Primary KPI Metric Cards (4 Cards) ──────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Today's Attendance (Live Dynamic) */}
          <div
            className="relative overflow-hidden rounded-2xl p-5 border flex flex-col justify-between transition-all"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--line)',
              boxShadow: 'var(--shadow)',
            }}
          >
            <TopoWaveSvg color="var(--teal)" opacity={0.15} />
            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-xl"
                    style={{ background: 'var(--teal-wash)', color: 'var(--teal)' }}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold" style={{ color: 'var(--ink)' }}>Today&apos;s Attendance</h3>
                    <p className="text-[10px] font-medium" style={{ color: 'var(--muted)' }}>{todayDateFormatted}</p>
                  </div>
                </div>
                <button
                  onClick={() => router.push('/attendance')}
                  className="text-[10px] font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
                  style={{ color: 'var(--teal)' }}
                >
                  <span>Logs</span>
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>

              {/* Status Display / Live Punch State */}
              {isPunched ? (
                <div
                  className="rounded-xl p-3 flex items-center gap-3 shadow-inner"
                  style={{ background: 'var(--teal-wash)', border: '1px solid var(--line-soft)' }}
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{ background: 'var(--teal)', color: '#FFFFFF' }}
                  >
                    <Check className="h-4 w-4 stroke-[3]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-black tracking-wide" style={{ color: 'var(--teal-ink)' }}>
                      Marked as {currentStatus?.replace('_', ' ')}
                    </div>
                    {punchTime && (
                      <div className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--muted)' }}>
                        Punched at {punchTime}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className="rounded-xl p-3 flex items-center gap-3"
                  style={{ background: 'var(--amber-wash)', border: '1px solid rgba(217,119,6,0.2)' }}
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{ background: 'rgba(217,119,6,0.15)', color: 'var(--amber)' }}
                  >
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold" style={{ color: 'var(--amber)' }}>
                      Not marked yet today
                    </div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
                      Check in to record attendance
                    </div>
                  </div>
                </div>
              )}

              {statusMessage && (
                <div
                  className="text-[11px] text-center font-medium rounded-lg py-1"
                  style={{ background: 'var(--teal-wash)', color: 'var(--teal-ink)', border: '1px solid var(--line-soft)' }}
                >
                  {statusMessage}
                </div>
              )}
            </div>

            <div className="relative z-10 pt-3">
              {isPunched ? (
                <button
                  disabled
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold cursor-default"
                  style={{ background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--line-soft)' }}
                >
                  <ShieldCheck className="h-3.5 w-3.5" style={{ color: 'var(--teal)' }} />
                  <span>Attendance Recorded</span>
                </button>
              ) : (
                <button
                  disabled={marking}
                  onClick={() => setShowConfirmModal(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold text-white transition-all shadow-sm cursor-pointer disabled:opacity-50"
                  style={{ background: 'var(--teal)' }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Mark Present (Office)</span>
                </button>
              )}
            </div>
          </div>

          {/* Card 2: Mailbox */}
          <div
            onClick={() => router.push('/mail/inbox')}
            className="relative overflow-hidden rounded-2xl p-5 border flex flex-col justify-between transition-all cursor-pointer group"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--line)',
              boxShadow: 'var(--shadow)',
            }}
          >
            <TopoWaveSvg color="var(--teal)" opacity={0.15} />
            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-xl"
                    style={{ background: 'var(--teal-wash)', color: 'var(--teal)' }}
                  >
                    <Mail className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-bold" style={{ color: 'var(--ink)' }}>Mailbox</h3>
                </div>
                <ChevronRight className="h-4 w-4 transition-all group-hover:translate-x-0.5" style={{ color: 'var(--muted)' }} />
              </div>

              <div>
                <div
                  className="text-3xl font-black"
                  style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}
                >
                  {stats?.unreadEmails ?? 0}
                </div>
                <p className="text-xs mt-0.5 font-medium" style={{ color: 'var(--muted)' }}>Unread emails in Inbox</p>
              </div>
            </div>

            <div className="relative z-10 pt-3 flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--teal)' }}>
              <span>View Mailbox Gateway</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 3: Tasks Assigned */}
          <div
            onClick={() => router.push('/tasks')}
            className="relative overflow-hidden rounded-2xl p-5 border flex flex-col justify-between transition-all cursor-pointer group"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--line)',
              boxShadow: 'var(--shadow)',
            }}
          >
            <TopoWaveSvg color="#8b5cf6" opacity={0.15} />
            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    <CheckSquare className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-bold" style={{ color: 'var(--ink)' }}>Tasks Assigned</h3>
                </div>
                <ChevronRight className="h-4 w-4 transition-all group-hover:translate-x-0.5" style={{ color: 'var(--muted)' }} />
              </div>

              <div>
                <div
                  className="text-3xl font-black"
                  style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}
                >
                  {stats?.pendingTasksCount ?? 0}
                </div>
                <p className="text-xs mt-0.5 font-medium" style={{ color: 'var(--muted)' }}>Active tasks pending</p>
              </div>
            </div>

            <div className="relative z-10 pt-3 flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400">
              <span>Open Kanban Board</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 4: Time Off Balances */}
          <div
            onClick={() => router.push('/leaves')}
            className="relative overflow-hidden rounded-2xl p-5 border flex flex-col justify-between transition-all cursor-pointer group"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--line)',
              boxShadow: 'var(--shadow)',
            }}
          >
            <TopoWaveSvg color="var(--teal)" opacity={0.15} />
            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-xl"
                    style={{ background: 'var(--teal-wash)', color: 'var(--teal)' }}
                  >
                    <CalendarDays className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-bold" style={{ color: 'var(--ink)' }}>Time Off Balances</h3>
                </div>
                <span className="text-base">🌴</span>
              </div>

              <div className="grid grid-cols-3 gap-2 py-1">
                <div>
                  <div className="text-2xl font-black" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
                    {stats?.leaveBalances?.casual ?? 0}
                  </div>
                  <div className="text-[11px] font-bold" style={{ color: 'var(--muted)' }}>Casual</div>
                </div>
                <div>
                  <div className="text-2xl font-black" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
                    {stats?.leaveBalances?.sick ?? 0}
                  </div>
                  <div className="text-[11px] font-bold" style={{ color: 'var(--muted)' }}>Sick</div>
                </div>
                <div>
                  <div className="text-2xl font-black" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
                    {stats?.leaveBalances?.annual ?? 0}
                  </div>
                  <div className="text-[11px] font-bold" style={{ color: 'var(--muted)' }}>Annual</div>
                </div>
              </div>
            </div>

            <div className="relative z-10 pt-3 flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--teal)' }}>
              <span>Manage Leaves</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>

        {/* ── 3. Quick Actions Hub & Monthly Calendar ────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Quick Actions (6 Interactive Action Tiles) */}
          <div
            className="lg:col-span-7 rounded-2xl border p-6 flex flex-col justify-between transition-all"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--line)',
              boxShadow: 'var(--shadow)',
            }}
          >
            <div>
              <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: 'var(--line-soft)' }}>
                <div className="flex items-center gap-2.5">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-xl"
                    style={{ background: 'var(--teal-wash)', color: 'var(--teal)' }}
                  >
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>Quick Actions Hub</h3>
                    <p className="text-[11px]" style={{ color: 'var(--muted)' }}>One-click shortcuts to key workspace functions</p>
                  </div>
                </div>
              </div>

              {/* 2x3 Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                <button
                  onClick={() => router.push('/mail/compose')}
                  className="flex flex-col items-start p-3.5 rounded-xl border transition-all text-left group cursor-pointer hover:border-blue-500/50"
                  style={{
                    background: 'var(--surface-2)',
                    borderColor: 'var(--line-soft)',
                  }}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl mb-2 group-hover:scale-105 transition-transform"
                    style={{ background: 'var(--teal-wash)', color: 'var(--teal)' }}
                  >
                    <Mail className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold" style={{ color: 'var(--ink)' }}>
                    Compose Email
                  </span>
                  <span className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>Send from alias</span>
                </button>

                <button
                  onClick={() => router.push('/tasks')}
                  className="flex flex-col items-start p-3.5 rounded-xl border transition-all text-left group cursor-pointer hover:border-blue-500/50"
                  style={{
                    background: 'var(--surface-2)',
                    borderColor: 'var(--line-soft)',
                  }}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl mb-2 group-hover:scale-105 transition-transform"
                    style={{ background: 'var(--teal-wash)', color: 'var(--teal)' }}
                  >
                    <CheckSquare className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold" style={{ color: 'var(--ink)' }}>
                    Create Task
                  </span>
                  <span className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>Kanban board</span>
                </button>

                <button
                  onClick={() => router.push('/notes')}
                  className="flex flex-col items-start p-3.5 rounded-xl border transition-all text-left group cursor-pointer hover:border-amber-500/50"
                  style={{
                    background: 'var(--surface-2)',
                    borderColor: 'var(--line-soft)',
                  }}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 mb-2 group-hover:scale-105 transition-transform">
                    <StickyNote className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold" style={{ color: 'var(--ink)' }}>
                    Add Note
                  </span>
                  <span className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>Private scratchpad</span>
                </button>

                <button
                  onClick={() => router.push('/drive')}
                  className="flex flex-col items-start p-3.5 rounded-xl border transition-all text-left group cursor-pointer hover:border-blue-500/50"
                  style={{
                    background: 'var(--surface-2)',
                    borderColor: 'var(--line-soft)',
                  }}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl mb-2 group-hover:scale-105 transition-transform"
                    style={{ background: 'var(--teal-wash)', color: 'var(--teal)' }}
                  >
                    <HardDrive className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold" style={{ color: 'var(--ink)' }}>
                    Google Drive
                  </span>
                  <span className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>Files & assets</span>
                </button>

                <button
                  onClick={() => router.push('/employees')}
                  className="flex flex-col items-start p-3.5 rounded-xl border transition-all text-left group cursor-pointer hover:border-purple-500/50"
                  style={{
                    background: 'var(--surface-2)',
                    borderColor: 'var(--line-soft)',
                  }}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 mb-2 group-hover:scale-105 transition-transform">
                    <Users className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold" style={{ color: 'var(--ink)' }}>
                    Directory
                  </span>
                  <span className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>Team members</span>
                </button>

                <button
                  onClick={() => router.push('/leaves')}
                  className="flex flex-col items-start p-3.5 rounded-xl border transition-all text-left group cursor-pointer hover:border-blue-500/50"
                  style={{
                    background: 'var(--surface-2)',
                    borderColor: 'var(--line-soft)',
                  }}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl mb-2 group-hover:scale-105 transition-transform"
                    style={{ background: 'var(--teal-wash)', color: 'var(--teal)' }}
                  >
                    <CalendarDays className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold" style={{ color: 'var(--ink)' }}>
                    Request Leave
                  </span>
                  <span className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>Apply for time off</span>
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Monthly Calendar */}
          <div
            className="lg:col-span-5 rounded-2xl border p-6 flex flex-col justify-between transition-all"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--line)',
              boxShadow: 'var(--shadow)',
            }}
          >
            <div>
              <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: 'var(--line-soft)' }}>
                <div className="flex items-center gap-2.5">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-xl"
                    style={{ background: 'var(--teal-wash)', color: 'var(--teal)' }}
                  >
                    <CalendarIcon className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>Calendar</h3>
                </div>
                <button
                  onClick={() => router.push('/schedule')}
                  className="text-xs font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  style={{ color: 'var(--teal)' }}
                >
                  <span>Full Schedule</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              {/* Month Navigation */}
              <div className="flex items-center justify-between mt-4 px-1">
                <span className="text-xs font-bold" style={{ color: 'var(--ink)' }}>{monthName}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      setCalendarDate(new Date(currentYear, currentMonth - 1, 1))
                    }
                    className="p-1 rounded-lg transition-colors cursor-pointer"
                    style={{ color: 'var(--muted)' }}
                    title="Previous Month"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() =>
                      setCalendarDate(new Date(currentYear, currentMonth + 1, 1))
                    }
                    className="p-1 rounded-lg transition-colors cursor-pointer"
                    style={{ color: 'var(--muted)' }}
                    title="Next Month"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Days Header */}
              <div className="grid grid-cols-7 gap-1 mt-3 text-center text-[10px] font-bold" style={{ color: 'var(--muted)' }}>
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
                <span>Sun</span>
              </div>

              {/* Days Grid Numbers */}
              <div className="grid grid-cols-7 gap-1 mt-1 text-center text-xs">
                {calendarDays.map((item, idx) => (
                  <div
                    key={idx}
                    className={`h-7 flex flex-col items-center justify-center rounded-lg relative ${
                      item.isCurrent
                        ? 'text-white font-black shadow-sm'
                        : item.dayNumber
                        ? 'hover:bg-[var(--surface-hover)] cursor-pointer'
                        : 'text-transparent pointer-events-none'
                    }`}
                    style={
                      item.isCurrent
                        ? { background: 'var(--teal)' }
                        : item.dayNumber
                        ? { color: 'var(--ink)' }
                        : {}
                    }
                    onClick={() => {
                      if (item.dayNumber) router.push('/schedule');
                    }}
                  >
                    <span>{item.dayNumber || ''}</span>
                    {item.hasDot && !item.isCurrent && (
                      <span className="h-1 w-1 rounded-full absolute bottom-0.5" style={{ background: 'var(--teal)' }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── 4. Notice Board & Today's Schedule (Real Dynamic Data) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Notice Board */}
          <div
            className="rounded-2xl border p-6 flex flex-col justify-between transition-all"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--line)',
              boxShadow: 'var(--shadow)',
            }}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--line-soft)' }}>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    <Megaphone className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>Notice Board</h3>
                    <p className="text-[11px]" style={{ color: 'var(--muted)' }}>Company broadcasts & announcements</p>
                  </div>
                </div>
                <button
                  onClick={() => router.push('/notices')}
                  className="text-xs font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  style={{ color: 'var(--teal)' }}
                >
                  <span>View All</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              {/* Dynamic Notices List */}
              <div className="space-y-3">
                {(!stats?.recentNotices || stats.recentNotices.length === 0) && (
                  <div className="text-center py-8 text-xs" style={{ color: 'var(--muted)' }}>
                    No active company notices broadcasted yet.
                  </div>
                )}
                {stats?.recentNotices?.map((notice: any) => (
                  <div
                    key={notice.id}
                    onClick={() => router.push('/notices')}
                    className="rounded-xl p-4 border transition-all cursor-pointer space-y-1.5 hover:border-blue-500/50"
                    style={{
                      background: 'var(--surface-2)',
                      borderColor: 'var(--line-soft)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs truncate" style={{ color: 'var(--ink)' }}>{notice.title}</span>
                      <span
                        className="rounded px-2 py-0.5 text-[10px] font-bold shrink-0"
                        style={{ background: 'var(--teal-wash)', color: 'var(--teal-ink)', border: '1px solid var(--line-soft)' }}
                      >
                        {notice.category}
                      </span>
                    </div>
                    <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: 'var(--ink-2)' }}>{notice.content}</p>
                    <div className="text-[10px] pt-1 flex items-center gap-2" style={{ color: 'var(--muted)' }}>
                      <span>Posted by {notice.author_name}</span>
                      <span>•</span>
                      <span>{new Date(notice.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Today's Schedule */}
          <div
            className="rounded-2xl border p-6 flex flex-col justify-between transition-all"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--line)',
              boxShadow: 'var(--shadow)',
            }}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--line-soft)' }}>
                <div className="flex items-center gap-2.5">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-xl"
                    style={{ background: 'var(--teal-wash)', color: 'var(--teal)' }}
                  >
                    <CalendarIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>Today&apos;s Schedule</h3>
                    <p className="text-[11px]" style={{ color: 'var(--muted)' }}>Upcoming meetings and calendar events</p>
                  </div>
                </div>
                <button
                  onClick={() => router.push('/schedule')}
                  className="text-xs font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  style={{ color: 'var(--teal)' }}
                >
                  <span>Full Schedule</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              {/* Dynamic Schedule List */}
              <div className="space-y-3">
                {(!stats?.todaySchedule || stats.todaySchedule.length === 0) && (
                  <div className="text-center py-8 text-xs" style={{ color: 'var(--muted)' }}>
                    No scheduled meetings or events for today.
                  </div>
                )}
                {stats?.todaySchedule?.map((evt: any) => (
                  <div
                    key={evt.id}
                    onClick={() => router.push('/schedule')}
                    className="flex items-start justify-between rounded-xl p-4 border transition-all cursor-pointer hover:border-blue-500/50"
                    style={{
                      background: 'var(--surface-2)',
                      borderColor: 'var(--line-soft)',
                    }}
                  >
                    <div className="space-y-1 min-w-0 pr-3">
                      <div className="text-xs font-bold truncate" style={{ color: 'var(--ink)' }}>{evt.title}</div>
                      {evt.description && (
                        <div className="text-[11px] truncate" style={{ color: 'var(--ink-2)' }}>{evt.description}</div>
                      )}
                      {evt.location && (
                        <div className="text-[10px] flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                          <MapPin className="h-3 w-3" style={{ color: 'var(--teal)' }} />
                          <span>{evt.location}</span>
                        </div>
                      )}
                    </div>
                    <span
                      className="rounded-lg px-2.5 py-1 text-[11px] font-bold shrink-0 font-mono"
                      style={{ background: 'var(--teal-wash)', color: 'var(--teal-ink)', border: '1px solid var(--line-soft)' }}
                    >
                      {new Date(evt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Attendance Confirm Modal ───────────────────── */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in bg-black/60">
            <div
              className="w-full max-w-sm rounded-2xl p-6 space-y-4 shadow-2xl border"
              style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: 'var(--teal-wash)', color: 'var(--teal)' }}
                >
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
                    Confirm Today&apos;s Attendance
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>Attendance is locked once recorded.</p>
                </div>
              </div>
              <p
                className="text-xs leading-relaxed rounded-xl p-3 border"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--line-soft)', color: 'var(--ink-2)' }}
              >
                Are you sure you want to mark today&apos;s attendance as <strong>Present (Office)</strong> at{' '}
                <strong>
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                </strong>?
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                  style={{ color: 'var(--muted)' }}
                >
                  Cancel
                </button>
                <button
                  disabled={marking}
                  onClick={() => {
                    setShowConfirmModal(false);
                    handleMarkAttendance('PRESENT');
                  }}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-white transition-all shadow-md cursor-pointer"
                  style={{ background: 'var(--teal)' }}
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
