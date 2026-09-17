'use client';

import React, { useEffect, useState, useMemo } from 'react';
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
  ChevronLeft,
  ChevronRight,
  Plus,
  Info,
  CalendarDays,
  Flame,
  Check,
  X,
  Laptop,
  RefreshCw,
  Video,
  ExternalLink,
  Globe,
} from 'lucide-react';
import {
  AttendanceRecord,
  AttendanceStatus,
  ScheduleEvent,
  LeaveRequest,
  INDIAN_HOLIDAYS_2026,
  PublicHolidayDefinition,
  UserCalendarIntegration,
} from '@/lib/db/types';
import { getIndianDateString } from '@/lib/utils/date';
import { clientCache } from '@/lib/cache/clientCache';

export default function AttendancePage() {
  const todayStr = getIndianDateString();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [scheduleEvents, setScheduleEvents] = useState<ScheduleEvent[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // View state: 'calendar' or 'table'
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar');

  // Calendar Navigation State
  const [calendarDate, setCalendarDate] = useState<Date>(() => new Date());
  const [selectedDayDetails, setSelectedDayDetails] = useState<{
    dateStr: string;
    dayNum: number;
    weekday: string;
    record?: AttendanceRecord;
    holiday?: { name: string; type: string; description: string };
    event?: ScheduleEvent;
    events?: ScheduleEvent[];
    leave?: LeaveRequest;
    isWeekend: boolean;
    isToday: boolean;
    isFuture: boolean;
  } | null>(null);

  // Calendar External Sync Modal State
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [integrations, setIntegrations] = useState<UserCalendarIntegration[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [newIntegrationProvider, setNewIntegrationProvider] = useState<'google' | 'microsoft'>('google');
  const [newIntegrationEmail, setNewIntegrationEmail] = useState('');
  const [newIntegrationUrl, setNewIntegrationUrl] = useState('');
  const [submittingIntegration, setSubmittingIntegration] = useState(false);

  // Add Holiday Modal State
  const [showAddHolidayModal, setShowAddHolidayModal] = useState(false);
  const [newHolidayTitle, setNewHolidayTitle] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState(todayStr);
  const [newHolidayType, setNewHolidayType] = useState<'holiday' | 'event'>('holiday');
  const [newHolidayDesc, setNewHolidayDesc] = useState('');
  const [submittingHoliday, setSubmittingHoliday] = useState(false);

  // Punch state
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

  const fetchData = async () => {
    try {
      const [attRes, meRes, schedRes, leaveRes, intRes] = await Promise.all([
        fetch('/api/attendance'),
        fetch('/api/auth/me'),
        fetch('/api/schedule'),
        fetch('/api/leaves'),
        fetch('/api/calendar/integrations'),
      ]);

      if (attRes.ok) {
        const data = await attRes.json();
        setRecords(data.records || []);
      }
      if (meRes.ok) {
        const meData = await meRes.json();
        setCurrentUser(meData.user || null);
      }
      if (schedRes.ok) {
        const schedData = await schedRes.json();
        setScheduleEvents(schedData.events || []);
      }
      if (leaveRes.ok) {
        const leaveData = await leaveRes.json();
        setLeaves(leaveData.leaves || []);
      }
      if (intRes.ok) {
        const intData = await intRes.json();
        setIntegrations(intData.integrations || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerSync = async (isSample = false) => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sample: isSample }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification(data.message || 'Calendars synced successfully!');
        const [schedRes, intRes] = await Promise.all([
          fetch('/api/schedule'),
          fetch('/api/calendar/integrations'),
        ]);
        if (schedRes.ok) {
          const s = await schedRes.json();
          setScheduleEvents(s.events || []);
        }
        if (intRes.ok) {
          const i = await intRes.json();
          setIntegrations(i.integrations || []);
        }
        setTimeout(() => setNotification(null), 5000);
      } else {
        setError(data.error || 'Failed to sync calendar.');
      }
    } catch {
      setError('Network connection error while syncing calendars.');
    } finally {
      setSyncing(false);
    }
  };

  const handleAddIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingIntegration(true);
    setError(null);
    try {
      const res = await fetch('/api/calendar/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: newIntegrationProvider,
          accountEmail: newIntegrationEmail.trim(),
          feedUrl: newIntegrationUrl.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification(`${newIntegrationProvider === 'google' ? 'Google Calendar' : 'Microsoft Teams'} feed connected!`);
        setNewIntegrationEmail('');
        setNewIntegrationUrl('');
        fetchData();
        setTimeout(() => setNotification(null), 4000);
      } else {
        setError(data.error || 'Failed to connect calendar feed.');
      }
    } catch {
      setError('Network error while saving integration.');
    } finally {
      setSubmittingIntegration(false);
    }
  };

  const handleDeleteIntegration = async (id: string) => {
    try {
      const res = await fetch(`/api/calendar/integrations?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setIntegrations((prev) => prev.filter((i) => i.id !== id));
        setNotification('Calendar disconnected.');
        setTimeout(() => setNotification(null), 3000);
      }
    } catch {}
  };

  useEffect(() => {
    fetchData();

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

        if (data.record) {
          setRecords((prev) => {
            const exists = prev.some((r) => r.id === data.record.id || r.date === data.record.date);
            if (exists) return prev.map((r) => (r.date === data.record.date ? data.record : r));
            return [data.record, ...prev];
          });
          window.dispatchEvent(new CustomEvent('attendance-updated', { detail: data.record }));
        }

        setTodayNotes('');
        setSelectedDayDetails(null);
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

  const handleCreateHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayTitle.trim() || !newHolidayDate) return;

    setSubmittingHoliday(true);
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newHolidayTitle.trim(),
          description: newHolidayDesc.trim() || 'Company Holiday',
          eventType: newHolidayType,
          startTime: `${newHolidayDate}T09:00:00.000Z`,
          endTime: `${newHolidayDate}T18:00:00.000Z`,
          location: 'Cruvels HQ & Remote',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.event) {
        setScheduleEvents((prev) => [...prev, data.event]);
        setNotification(`🎌 Added holiday: "${newHolidayTitle}" on ${newHolidayDate}.`);
        setShowAddHolidayModal(false);
        setNewHolidayTitle('');
        setNewHolidayDesc('');
        setTimeout(() => setNotification(null), 5000);
      } else {
        setError(data.error || 'Failed to create holiday event.');
      }
    } catch {
      setError('Network error saving holiday.');
    } finally {
      setSubmittingHoliday(false);
    }
  };

  // Calendar Navigation Handlers
  const handlePrevMonth = () => {
    setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleJumpToToday = () => {
    setCalendarDate(new Date());
  };

  // Compute Calendar Days & Insights for selected month
  const calendarYear = calendarDate.getFullYear();
  const calendarMonth = calendarDate.getMonth(); // 0-indexed

  const monthName = calendarDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  // Map of date string -> Public Holiday
  const holidayMap = useMemo(() => {
    const map = new Map<string, { name: string; type: string; description: string }>();
    // Pre-loaded Indian national holidays
    for (const h of INDIAN_HOLIDAYS_2026) {
      map.set(h.date, { name: h.name, type: h.type, description: h.description });
    }
    // Dynamic schedule events of type 'holiday'
    for (const ev of scheduleEvents) {
      if (ev.event_type === 'holiday') {
        const d = ev.start_time.split('T')[0];
        map.set(d, { name: ev.title, type: 'company', description: ev.description });
      }
    }
    return map;
  }, [scheduleEvents]);

  // Map of date string -> Approved Leaves for current user
  const approvedLeavesMap = useMemo(() => {
    const map = new Map<string, LeaveRequest>();
    for (const l of leaves) {
      if (l.status === 'APPROVED') {
        // Mark all dates in range
        const start = new Date(l.start_date);
        const end = new Date(l.end_date);
        for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
          const dStr = dt.toISOString().split('T')[0];
          map.set(dStr, l);
        }
      }
    }
    return map;
  }, [leaves]);

  // Current user's records map
  const myRecords = records.filter(
    (r) => !currentUser || r.employee_name === currentUser.name || r.marked_by_id === currentUser.id
  );

  const myRecordsMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const r of myRecords) {
      map.set(r.date, r);
    }
    return map;
  }, [myRecords]);

  // Calendar Grid Cells Generation
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();

    const cells: Array<{
      dayNum: number | null;
      dateStr: string;
      isCurrentMonth: boolean;
      isWeekend: boolean;
      isToday: boolean;
      isFuture: boolean;
      record?: AttendanceRecord;
      holiday?: { name: string; type: string; description: string };
      event?: ScheduleEvent;
      events?: ScheduleEvent[];
      leave?: LeaveRequest;
      weekday: string;
    }> = [];

    // Empty lead cells
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({
        dayNum: null,
        dateStr: '',
        isCurrentMonth: false,
        isWeekend: false,
        isToday: false,
        isFuture: false,
        weekday: '',
      });
    }

    // Days in current month
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dateObj = new Date(calendarYear, calendarMonth, day);
      const dayOfWeek = dateObj.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const yyyy = calendarYear;
      const mm = String(calendarMonth + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const isToday = dateStr === todayStr;
      const isFuture = dateStr > todayStr;

      const record = myRecordsMap.get(dateStr);
      const holiday = holidayMap.get(dateStr);
      const leave = approvedLeavesMap.get(dateStr);
      const dayEvents = scheduleEvents.filter((e) => e.start_time.startsWith(dateStr) && e.event_type !== 'holiday');
      const event = dayEvents[0];

      const weekday = dateObj.toLocaleDateString('en-IN', { weekday: 'long' });

      cells.push({
        dayNum: day,
        dateStr,
        isCurrentMonth: true,
        isWeekend,
        isToday,
        isFuture,
        record,
        holiday,
        event,
        events: dayEvents,
        leave,
        weekday,
      });
    }

    return cells;
  }, [calendarYear, calendarMonth, todayStr, myRecordsMap, holidayMap, approvedLeavesMap, scheduleEvents]);

  // Monthly Telemetry & Insights Calculation
  const monthlyInsights = useMemo(() => {
    let daysInMonth = 0;
    let workingDays = 0;
    let presentDays = 0;
    let halfDays = 0;
    let leaveDays = 0;
    let holidaysCount = 0;
    let absentDays = 0;
    let elapsedWorkingDays = 0;

    for (const cell of calendarDays) {
      if (!cell.isCurrentMonth || !cell.dayNum) continue;
      daysInMonth++;

      const isHoliday = Boolean(cell.holiday);
      if (isHoliday) holidaysCount++;

      const isWorkingDay = !cell.isWeekend && !isHoliday;
      if (isWorkingDay) {
        workingDays++;
        if (!cell.isFuture) elapsedWorkingDays++;
      }

      if (cell.record) {
        if (cell.record.status === 'PRESENT' || cell.record.status === 'WORK_FROM_HOME') {
          presentDays++;
        } else if (cell.record.status === 'HALF_DAY') {
          halfDays++;
        } else if (cell.record.status === 'ON_LEAVE') {
          leaveDays++;
        } else if (cell.record.status === 'ABSENT') {
          absentDays++;
        }
      } else if (cell.leave) {
        leaveDays++;
      } else if (!cell.isFuture && isWorkingDay && !cell.isToday) {
        // Unmarked past weekday treated as absent/unverified
        absentDays++;
      }
    }

    const attendanceScore =
      elapsedWorkingDays > 0
        ? Math.min(100, Math.round(((presentDays + halfDays * 0.5) / Math.max(1, elapsedWorkingDays)) * 100))
        : 100;

    return {
      daysInMonth,
      workingDays,
      presentDays,
      halfDays,
      leaveDays,
      holidaysCount,
      absentDays,
      attendanceScore,
    };
  }, [calendarDays]);

  const todayRecord = records.find((r) => r.date === todayStr);
  const isTodayLocked = Boolean(todayRecord);

  const displayedRecords =
    activeTab === 'team' && (currentUser?.role === 'admin' || currentUser?.role === 'manager')
      ? records
      : myRecords;

  const filteredRecords = displayedRecords.filter((r) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        r.employee_name.toLowerCase().includes(q) ||
        r.date.includes(q) ||
        (r.notes && r.notes.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const isAdminOrLead =
    currentUser?.role === 'admin' || currentUser?.role === 'manager' || currentUser?.isGroupLeader;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-bold border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Present (Office)
          </span>
        );
      case 'WORK_FROM_HOME':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-xs font-bold border border-blue-200">
            <Laptop className="h-3.5 w-3.5 text-blue-600" />
            Work From Home
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

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
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
              Verify daily shift presence, view interactive monthly attendance calendar, and monitor holiday schedules.
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
              Today:{' '}
              {new Date().toLocaleDateString('en-IN', {
                timeZone: 'Asia/Kolkata',
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
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
                Record your presence for {todayStr}. Once logged, your timestamp is sealed under zero-trust governance.
              </p>
            </div>

            {isTodayLocked && todayRecord && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Status for Today:</span>
                {getStatusBadge(todayRecord.status)}
              </div>
            )}
          </div>

          {isTodayLocked ? (
            <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Your presence for today has been recorded successfully</span>
                </div>
                <p className="text-xs text-slate-500">
                  Logged at <span className="font-mono font-bold text-slate-700">{todayRecord?.punch_time} IST</span>
                  {todayRecord?.notes && ` • Notes: "${todayRecord.notes}"`}
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-100/60 text-emerald-800 px-3 py-1.5 text-xs font-semibold shrink-0">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Zero-Trust Locked</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Shift Notes / Work Location (Optional)
                </label>
                <input
                  type="text"
                  value={todayNotes}
                  onChange={(e) => setTodayNotes(e.target.value)}
                  placeholder="e.g., Working on Core Platform feature, Office Desk #14"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>

              {/* Punch Actions */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleMarkAttendance('PRESENT')}
                  className="glow-btn-primary flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-50 transition-all"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Punch In: Present (Office)</span>
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleMarkAttendance('WORK_FROM_HOME')}
                  className="flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-200 px-4 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100 shadow-xs disabled:opacity-50 transition-all"
                >
                  <Laptop className="h-4 w-4 text-blue-600" />
                  <span>Punch In: Work From Home</span>
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleMarkAttendance('HALF_DAY')}
                  className="flex items-center gap-2 rounded-xl bg-purple-50 border border-purple-200 px-4 py-2.5 text-xs font-bold text-purple-700 hover:bg-purple-100 shadow-xs disabled:opacity-50 transition-all"
                >
                  <Clock className="h-4 w-4 text-purple-600" />
                  <span>Half Day</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* View Mode Switcher Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center rounded-2xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                viewMode === 'calendar'
                  ? 'bg-white text-blue-700 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="h-4 w-4" />
              <span>Interactive Calendar & Insights</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-blue-700 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarCheck className="h-4 w-4" />
              <span>History & Timeline Logs</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowSyncModal(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-blue-600 ${syncing ? 'animate-spin' : ''}`} />
              <span>Sync Google / Teams</span>
            </button>

            {/* Admin / Manager Add Holiday Action */}
            {isAdminOrLead && (
              <button
                onClick={() => setShowAddHolidayModal(true)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:from-emerald-700 hover:to-teal-700 transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>+ Add Company Holiday / Event</span>
              </button>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VIEW 1: INTERACTIVE ATTENDANCE & HOLIDAY CALENDAR */}
        {/* ========================================================================= */}
        {viewMode === 'calendar' && (
          <div className="space-y-6">
            {/* Immediate Monthly Telemetry & Insights Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-xs space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Month Days</span>
                <div className="text-xl font-extrabold text-slate-900">{monthlyInsights.daysInMonth}</div>
                <p className="text-[10px] text-slate-500">{monthlyInsights.workingDays} working days</p>
              </div>

              <div className="rounded-2xl bg-emerald-50/60 p-4 border border-emerald-200 shadow-xs space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Days Present</span>
                <div className="text-xl font-extrabold text-emerald-800">{monthlyInsights.presentDays}</div>
                <p className="text-[10px] text-emerald-600">Office & WFH verified</p>
              </div>

              <div className="rounded-2xl bg-purple-50/60 p-4 border border-purple-200 shadow-xs space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Half Days</span>
                <div className="text-xl font-extrabold text-purple-800">{monthlyInsights.halfDays}</div>
                <p className="text-[10px] text-purple-600">Partial attendance</p>
              </div>

              <div className="rounded-2xl bg-amber-50/60 p-4 border border-amber-200 shadow-xs space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Approved Leaves</span>
                <div className="text-xl font-extrabold text-amber-800">{monthlyInsights.leaveDays}</div>
                <p className="text-[10px] text-amber-600">Sanctioned time off</p>
              </div>

              <div className="rounded-2xl bg-teal-50/60 p-4 border border-teal-200 shadow-xs space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">Holidays</span>
                <div className="text-xl font-extrabold text-teal-800">{monthlyInsights.holidaysCount}</div>
                <p className="text-[10px] text-teal-600">National & company</p>
              </div>

              <div className="rounded-2xl bg-blue-50/60 p-4 border border-blue-200 shadow-xs space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Attendance Score</span>
                <div className="text-xl font-extrabold text-blue-800">{monthlyInsights.attendanceScore}%</div>
                <div className="w-full bg-blue-200 rounded-full h-1.5 mt-1 overflow-hidden">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all"
                    style={{ width: `${monthlyInsights.attendanceScore}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Calendar Main Container */}
            <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-6 sm:p-7 space-y-6">
              {/* Calendar Month Navigation Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                    {monthName}
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 px-2.5 py-0.5 text-xs font-bold border border-blue-200">
                    <Calendar className="h-3 w-3" />
                    Interactive Calendar
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleJumpToToday}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-xs"
                  >
                    Today
                  </button>
                  <button
                    onClick={handlePrevMonth}
                    className="rounded-xl border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-xs"
                    title="Previous Month"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleNextMonth}
                    className="rounded-xl border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-xs"
                    title="Next Month"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Legend Badges */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-semibold text-slate-600 bg-slate-50/70 p-3 rounded-2xl border border-slate-100">
                <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Legend:</span>
                <span className="flex items-center gap-1.5 text-emerald-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Present (Office)
                </span>
                <span className="flex items-center gap-1.5 text-blue-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  Work From Home
                </span>
                <span className="flex items-center gap-1.5 text-purple-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-purple-500" />
                  Half Day
                </span>
                <span className="flex items-center gap-1.5 text-amber-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  Approved Leave
                </span>
                <span className="flex items-center gap-1.5 text-teal-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
                  Public / Company Holiday
                </span>
                <span className="flex items-center gap-1.5 text-rose-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                  Absent / Unmarked
                </span>
              </div>

              {/* 7-Day Grid Headers */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center text-xs font-extrabold uppercase tracking-wider text-slate-400 pb-1">
                <div>Sun</div>
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div>Sat</div>
              </div>

              {/* Calendar Grid Days */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {calendarDays.map((cell, idx) => {
                  if (!cell.isCurrentMonth || !cell.dayNum) {
                    return (
                      <div
                        key={`empty-${idx}`}
                        className="min-h-[85px] sm:min-h-[105px] rounded-2xl bg-slate-50/40 border border-slate-100/60 p-2 opacity-30"
                      />
                    );
                  }

                  const hasHoliday = Boolean(cell.holiday);
                  const hasRecord = Boolean(cell.record);
                  const hasLeave = Boolean(cell.leave);

                  // Card styling based on day status
                  let cardBg = 'bg-white hover:bg-slate-50/70 border-slate-200';
                  if (cell.isToday) {
                    cardBg = 'bg-blue-50/30 border-blue-400 ring-2 ring-blue-500/20';
                  } else if (hasHoliday) {
                    cardBg = 'bg-teal-50/40 border-teal-200 hover:bg-teal-50/70';
                  } else if (cell.isWeekend) {
                    cardBg = 'bg-slate-50/60 border-slate-200/60 text-slate-400';
                  }

                  return (
                    <div
                      key={cell.dateStr}
                      onClick={() =>
                        setSelectedDayDetails({
                          dateStr: cell.dateStr,
                          dayNum: cell.dayNum!,
                          weekday: cell.weekday,
                          record: cell.record,
                          holiday: cell.holiday,
                          event: cell.event,
                          events: cell.events,
                          leave: cell.leave,
                          isWeekend: cell.isWeekend,
                          isToday: cell.isToday,
                          isFuture: cell.isFuture,
                        })
                      }
                      className={`min-h-[85px] sm:min-h-[105px] rounded-2xl border p-2.5 sm:p-3 flex flex-col justify-between cursor-pointer transition-all duration-150 shadow-2xs ${cardBg}`}
                    >
                      {/* Top Day Number & Today indicator */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs sm:text-sm font-bold ${
                            cell.isToday
                              ? 'flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white font-extrabold shadow-xs'
                              : cell.isWeekend
                              ? 'text-slate-400'
                              : 'text-slate-800'
                          }`}
                        >
                          {cell.dayNum}
                        </span>

                        {cell.isToday && (
                          <span className="hidden sm:inline-block text-[9px] font-extrabold uppercase tracking-widest text-blue-600">
                            Today
                          </span>
                        )}
                      </div>

                      {/* Status Badges on Calendar Day */}
                      <div className="space-y-1 my-1">
                        {/* 1. Public / Company Holiday */}
                        {hasHoliday && (
                          <div
                            className="truncate rounded-md bg-teal-100 text-teal-800 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold border border-teal-200"
                            title={cell.holiday?.name}
                          >
                            🎌 {cell.holiday?.name}
                          </div>
                        )}

                        {/* 2. Attendance Status */}
                        {hasRecord && (
                          <div>
                            {cell.record?.status === 'PRESENT' && (
                              <div className="truncate rounded-md bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold border border-emerald-200">
                                ✓ Present
                              </div>
                            )}
                            {cell.record?.status === 'WORK_FROM_HOME' && (
                              <div className="truncate rounded-md bg-blue-100 text-blue-800 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold border border-blue-200">
                                💻 WFH
                              </div>
                            )}
                            {cell.record?.status === 'HALF_DAY' && (
                              <div className="truncate rounded-md bg-purple-100 text-purple-800 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold border border-purple-200">
                                ⏱ Half Day
                              </div>
                            )}
                            {cell.record?.status === 'ON_LEAVE' && (
                              <div className="truncate rounded-md bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold border border-amber-200">
                                🏖 On Leave
                              </div>
                            )}
                            {cell.record?.status === 'ABSENT' && (
                              <div className="truncate rounded-md bg-rose-100 text-rose-800 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold border border-rose-200">
                                ✕ Absent
                              </div>
                            )}
                          </div>
                        )}

                        {/* 3. Approved Leave without explicit punch record */}
                        {!hasRecord && hasLeave && (
                          <div className="truncate rounded-md bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold border border-amber-200">
                            🏖 Approved Leave
                          </div>
                        )}

                        {/* 4. Past Unmarked Weekday */}
                        {!hasRecord && !hasHoliday && !hasLeave && !cell.isWeekend && !cell.isFuture && !cell.isToday && (
                          <div className="truncate rounded-md bg-rose-50 text-rose-600 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold border border-rose-200/60">
                            ✕ Unmarked
                          </div>
                        )}

                        {/* 5. External & Internal Scheduled Meetings */}
                        {cell.events && cell.events.length > 0 && (
                          <div className="space-y-0.5 pt-0.5">
                            {cell.events.slice(0, 2).map((ev: ScheduleEvent) => {
                              const isGoogle = ev.source === 'google' || ev.sync_provider === 'google';
                              const isTeams = ev.source === 'microsoft' || ev.sync_provider === 'microsoft';
                              return (
                                <div
                                  key={ev.id}
                                  className={`truncate rounded px-1.5 py-0.5 text-[8.5px] font-bold border flex items-center gap-1 ${
                                    isGoogle
                                      ? 'bg-amber-50/90 text-amber-900 border-amber-200'
                                      : isTeams
                                      ? 'bg-indigo-50/90 text-indigo-900 border-indigo-200'
                                      : 'bg-blue-50/90 text-blue-900 border-blue-200'
                                  }`}
                                  title={`${ev.title}${ev.location ? ` (${ev.location})` : ''}`}
                                >
                                  {isGoogle ? '🌐 Meet' : isTeams ? '👥 Teams' : '📅 Sync'}
                                  <span className="truncate">{ev.title}</span>
                                </div>
                              );
                            })}
                            {cell.events.length > 2 && (
                              <div className="text-[8px] font-bold text-slate-500 pl-0.5">
                                +{cell.events.length - 2} more
                              </div>
                            )}
                          </div>
                        )}

                        {/* 6. Weekend Off */}
                        {cell.isWeekend && !hasRecord && !hasHoliday && (!cell.events || cell.events.length === 0) && (
                          <span className="text-[10px] text-slate-300 font-medium hidden sm:inline-block">
                            Weekend
                          </span>
                        )}
                      </div>

                      {/* Bottom Time Stamp Indicator */}
                      <div className="text-[9px] font-mono text-slate-400 truncate">
                        {cell.record?.punch_time ? `${cell.record.punch_time}` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: LOG RECORDS TABLE */}
        {/* ========================================================================= */}
        {viewMode === 'table' && (
          <div className="rounded-3xl bg-white p-6 sm:p-7 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Attendance Timeline & Logs
                </h2>
                <p className="text-xs text-slate-500">Historical records of daily presence and verified timestamps</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
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
                          <span className="text-xs text-slate-400">
                            Your presence logs will appear here as soon as you record attendance.
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-slate-900 font-mono text-[11px]">{r.date}</td>
                        <td className="px-5 py-3.5 font-semibold text-slate-800">{r.employee_name}</td>
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
        )}

        {/* ========================================================================= */}
        {/* DAY DETAILS INSPECTOR MODAL */}
        {/* ========================================================================= */}
        {selectedDayDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600">
                    Day Details
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {selectedDayDetails.weekday}, {selectedDayDetails.dateStr}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedDayDetails(null)}
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Status Section */}
              <div className="space-y-3 text-xs">
                {/* Holiday Info */}
                {selectedDayDetails.holiday && (
                  <div className="rounded-2xl bg-teal-50 border border-teal-200 p-3.5 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-teal-900">
                      <span>🎌</span>
                      <span>{selectedDayDetails.holiday.name}</span>
                    </div>
                    <p className="text-[11px] text-teal-700">{selectedDayDetails.holiday.description}</p>
                  </div>
                )}

                {/* Approved Leave Info */}
                {selectedDayDetails.leave && (
                  <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-amber-900">
                      <Calendar className="h-4 w-4 text-amber-600" />
                      <span>Approved {selectedDayDetails.leave.leave_type} Leave</span>
                    </div>
                    <p className="text-[11px] text-amber-700">Reason: {selectedDayDetails.leave.reason}</p>
                  </div>
                )}

                {/* Attendance Record */}
                {selectedDayDetails.record ? (
                  <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-500">Attendance Status:</span>
                      {getStatusBadge(selectedDayDetails.record.status)}
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Punch Timestamp:</span>
                      <span className="font-mono font-bold text-slate-800">
                        {selectedDayDetails.record.punch_time} IST
                      </span>
                    </div>
                    {selectedDayDetails.record.notes && (
                      <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-500">Notes:</span>{' '}
                        {selectedDayDetails.record.notes}
                      </div>
                    )}
                  </div>
                ) : (
                  !selectedDayDetails.holiday &&
                  !selectedDayDetails.leave && (
                    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-center space-y-1">
                      <div className="text-slate-700 font-bold">
                        {selectedDayDetails.isWeekend
                          ? 'Weekend / Non-Working Day'
                          : selectedDayDetails.isFuture
                          ? 'Upcoming Calendar Date'
                          : 'Unmarked Attendance'}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {selectedDayDetails.isToday
                          ? 'You haven’t punched in for today yet.'
                          : selectedDayDetails.isFuture
                          ? 'Attendance cannot be logged in advance.'
                          : 'No presence recorded for this working day.'}
                      </p>
                    </div>
                  )
                )}

                {/* Quick Punch if Today and not yet recorded */}
                {selectedDayDetails.isToday && !isTodayLocked && (
                  <div className="pt-2 space-y-2">
                    <span className="block text-[11px] font-bold text-slate-700">Record Today&apos;s Presence:</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleMarkAttendance('PRESENT')}
                        className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-all text-center"
                      >
                        Present (Office)
                      </button>
                      <button
                        onClick={() => handleMarkAttendance('WORK_FROM_HOME')}
                        className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-all text-center"
                      >
                        Work From Home
                      </button>
                    </div>
                  </div>
                )}

                {/* 4. Scheduled Meetings & External Sync */}
                {selectedDayDetails.events && selectedDayDetails.events.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Scheduled Meetings ({selectedDayDetails.events.length})
                    </span>
                    <div className="space-y-2">
                      {selectedDayDetails.events.map((ev) => {
                        const isGoogle = ev.source === 'google' || ev.sync_provider === 'google';
                        const isTeams = ev.source === 'microsoft' || ev.sync_provider === 'microsoft';
                        const startTimeFormatted = new Date(ev.start_time).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                        const endTimeFormatted = new Date(ev.end_time).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        });

                        return (
                          <div
                            key={ev.id}
                            className={`rounded-2xl p-3 border space-y-1.5 ${
                              isGoogle
                                ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                                : isTeams
                                ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950'
                                : 'bg-blue-50/70 border-blue-200 text-blue-950'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-xs">{ev.title}</span>
                              <span
                                className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                                  isGoogle
                                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                                    : isTeams
                                    ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                                    : 'bg-blue-100 text-blue-800 border-blue-300'
                                }`}
                              >
                                {isGoogle ? 'Google Meet' : isTeams ? 'MS Teams' : 'Internal'}
                              </span>
                            </div>

                            <div className="text-[11px] opacity-80 flex items-center gap-3">
                              <span>🕒 {startTimeFormatted} - {endTimeFormatted}</span>
                              {ev.location && <span>📍 {ev.location}</span>}
                            </div>

                            {ev.description && (
                              <p className="text-[11px] opacity-75 line-clamp-2">{ev.description}</p>
                            )}

                            {ev.meeting_link && (
                              <div className="pt-1">
                                <a
                                  href={ev.meeting_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold text-white shadow-xs transition-all ${
                                    isGoogle
                                      ? 'bg-emerald-600 hover:bg-emerald-700'
                                      : isTeams
                                      ? 'bg-indigo-600 hover:bg-indigo-700'
                                      : 'bg-blue-600 hover:bg-blue-700'
                                  }`}
                                >
                                  <Video className="h-3.5 w-3.5" />
                                  <span>{isGoogle ? 'Join Google Meet' : isTeams ? 'Join Teams Meeting' : 'Join Call'}</span>
                                  <ExternalLink className="h-3 w-3 opacity-75" />
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setSelectedDayDetails(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ADD HOLIDAY / COMPANY EVENT MODAL */}
        {/* ========================================================================= */}
        {showAddHolidayModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-teal-600">
                    Management Schedule
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Add Holiday / Company Event
                  </h3>
                </div>
                <button
                  onClick={() => setShowAddHolidayModal(false)}
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateHoliday} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Holiday / Event Title</label>
                  <input
                    type="text"
                    required
                    value={newHolidayTitle}
                    onChange={(e) => setNewHolidayTitle(e.target.value)}
                    placeholder="e.g., Company Annual Foundation Day, Diwali Off"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={newHolidayDate}
                      onChange={(e) => setNewHolidayDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-900 focus:border-teal-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Type</label>
                    <select
                      value={newHolidayType}
                      onChange={(e) => setNewHolidayType(e.target.value as any)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-900 focus:border-teal-500 focus:outline-none"
                    >
                      <option value="holiday">Public / Company Holiday</option>
                      <option value="event">Company Event</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={newHolidayDesc}
                    onChange={(e) => setNewHolidayDesc(e.target.value)}
                    placeholder="Provide details or notes about this holiday or schedule event..."
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs font-medium text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:outline-none resize-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddHolidayModal(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingHoliday || !newHolidayTitle.trim()}
                    className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 transition-all"
                  >
                    {submittingHoliday ? 'Saving...' : 'Add to Calendar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* CALENDAR EXTERNAL SYNC & INTEGRATION MODAL */}
        {/* ========================================================================= */}
        {showSyncModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="w-full max-w-xl rounded-3xl bg-white p-6 sm:p-7 shadow-xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600">
                    External Calendar Protocols
                  </span>
                  <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <Globe className="h-5 w-5 text-blue-600" />
                    <span>Google Calendar & Microsoft Teams Sync</span>
                  </h3>
                </div>
                <button
                  onClick={() => setShowSyncModal(false)}
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Instant 1-Click Quick Demo Sync Action */}
              <div className="rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-blue-200/80 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-blue-600" />
                      <span>1-Click Test Sync (Google Meet & Teams Standups)</span>
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Instantly sync sample recurring Google Meet and MS Teams team syncs for testing right now.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={syncing}
                    onClick={() => handleTriggerSync(true)}
                    className="shrink-0 flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    <span>{syncing ? 'Syncing...' : 'Sync Sample Feeds'}</span>
                  </button>
                </div>
              </div>

              {/* Connected Feeds List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Your Connected Calendars</span>
                  <button
                    type="button"
                    disabled={syncing}
                    onClick={() => handleTriggerSync(false)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
                    <span>Sync All Active Feeds</span>
                  </button>
                </div>

                {integrations.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                    No custom external calendar feeds configured yet. Add your Google or Microsoft iCal URL below.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {integrations.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-2xl border border-slate-200 p-3 bg-slate-50/50"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">
                            {item.provider === 'google' ? '🌐' : '👥'}
                          </span>
                          <div>
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{item.provider === 'google' ? 'Google Calendar' : 'Microsoft Teams / 365'}</span>
                              <span className="rounded-full bg-emerald-100 text-emerald-800 text-[9px] px-2 py-0.2 font-bold">
                                Active
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 truncate max-w-[280px]">
                              {item.account_email || item.feed_url}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteIntegration(item.id)}
                          className="rounded-xl p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Disconnect Calendar"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Custom Feed Form */}
              <form onSubmit={handleAddIntegration} className="rounded-2xl border border-slate-200 p-4 space-y-3 bg-slate-50/70">
                <span className="block text-xs font-bold text-slate-900">Connect a New Calendar Feed</span>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewIntegrationProvider('google')}
                    className={`rounded-xl border p-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      newIntegrationProvider === 'google'
                        ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>🌐 Google Calendar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewIntegrationProvider('microsoft')}
                    className={`rounded-xl border p-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      newIntegrationProvider === 'microsoft'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-800 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>👥 Microsoft Teams</span>
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700">Account Email (Optional)</label>
                  <input
                    type="email"
                    value={newIntegrationEmail}
                    onChange={(e) => setNewIntegrationEmail(e.target.value)}
                    placeholder={newIntegrationProvider === 'google' ? 'you@gmail.com' : 'you@company.onmicrosoft.com'}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Private iCal / ICS Feed URL <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="url"
                    required
                    value={newIntegrationUrl}
                    onChange={(e) => setNewIntegrationUrl(e.target.value)}
                    placeholder={
                      newIntegrationProvider === 'google'
                        ? 'https://calendar.google.com/calendar/ical/.../basic.ics'
                        : 'https://outlook.office365.com/owa/calendar/.../reachcalendar.ics'
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono text-[11px]"
                  />
                  <p className="text-[10px] text-slate-500">
                    {newIntegrationProvider === 'google'
                      ? 'Google Calendar: Settings -> Integrate calendar -> Secret address in iCal format'
                      : 'Outlook/Teams: Settings -> Calendar -> Shared calendars -> Publish a calendar -> ICS link'}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submittingIntegration}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-black text-white px-4 py-2.5 text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {submittingIntegration ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <span>Connect & Ingest Calendar</span>
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
