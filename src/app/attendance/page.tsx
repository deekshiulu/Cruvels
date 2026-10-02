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
  FilePenLine,
} from 'lucide-react';
import {
  AttendanceRecord,
  AttendanceStatus,
  ScheduleEvent,
  LeaveRequest,
  AttendanceCorrectionRequest,
  INDIAN_HOLIDAYS_2026,
  PublicHolidayDefinition,
  UserCalendarIntegration,
} from '@/lib/db/types';
import { getIndianDateString } from '@/lib/utils/date';
import { clientCache } from '@/lib/cache/clientCache';

export default function AttendancePage() {
  const todayStr = getIndianDateString();
  const [records, setRecords] = useState<AttendanceRecord[]>(() => {
    if (typeof window !== 'undefined') {
      return clientCache.get<AttendanceRecord[]>('attendance_records') || [];
    }
    return [];
  });
  const [scheduleEvents, setScheduleEvents] = useState<ScheduleEvent[]>(() => {
    if (typeof window !== 'undefined') {
      return clientCache.get<ScheduleEvent[]>('attendance_schedule_events') || [];
    }
    return [];
  });
  const [leaves, setLeaves] = useState<LeaveRequest[]>(() => {
    if (typeof window !== 'undefined') {
      return clientCache.get<LeaveRequest[]>('attendance_leaves') || [];
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      return !clientCache.get<AttendanceRecord[]>('attendance_records');
    }
    return true;
  });

  // View state: 'calendar', 'table', or 'corrections'
  const [viewMode, setViewMode] = useState<'calendar' | 'table' | 'corrections'>('calendar');

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

  // Attendance Correction Modal State (§ 3)
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionDate, setCorrectionDate] = useState(todayStr);
  const [correctionRequestedStatus, setCorrectionRequestedStatus] = useState<AttendanceStatus>('PRESENT');
  const [correctionReason, setCorrectionReason] = useState('');
  const [submittingCorrection, setSubmittingCorrection] = useState(false);
  const [corrections, setCorrections] = useState<AttendanceCorrectionRequest[]>([]);

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
      const [attRes, meRes, schedRes, leaveRes, intRes, corRes] = await Promise.all([
        fetch('/api/attendance'),
        fetch('/api/auth/me'),
        fetch('/api/schedule'),
        fetch('/api/leaves'),
        fetch('/api/calendar/integrations'),
        fetch('/api/attendance/corrections'),
      ]);

      if (attRes.ok) {
        const data = await attRes.json();
        setRecords(data.records || []);
        clientCache.set('attendance_records', undefined, data.records || []);
      }
      if (meRes.ok) {
        const meData = await meRes.json();
        setCurrentUser(meData.user || null);
      }
      if (schedRes.ok) {
        const schedData = await schedRes.json();
        setScheduleEvents(schedData.events || []);
        clientCache.set('attendance_schedule_events', undefined, schedData.events || []);
      }
      if (leaveRes.ok) {
        const leaveData = await leaveRes.json();
        setLeaves(leaveData.leaves || []);
        clientCache.set('attendance_leaves', undefined, leaveData.leaves || []);
      }
      if (intRes.ok) {
        const intData = await intRes.json();
        setIntegrations(intData.integrations || []);
      }
      if (corRes && corRes.ok) {
        const corData = await corRes.json();
        setCorrections(corData.corrections || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionReason.trim() || correctionReason.trim().length < 5) {
      setError('Please provide a valid justification (at least 5 characters).');
      return;
    }
    try {
      setSubmittingCorrection(true);
      setError(null);
      const res = await fetch('/api/attendance/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: correctionDate,
          requested_status: correctionRequestedStatus,
          reason: correctionReason,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification('Attendance correction request submitted for supervisor review.');
        setShowCorrectionModal(false);
        setCorrectionReason('');
        fetchData();
        setTimeout(() => setNotification(null), 4000);
      } else {
        setError(data.error || 'Failed to submit correction request.');
      }
    } catch {
      setError('Network error while submitting correction.');
    } finally {
      setSubmittingCorrection(false);
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
        <div className="rounded-xl p-6 sm:p-7 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4" style={{ borderBottom: '1px solid var(--line-soft)' }}>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--ink)' }}>
                <CalendarCheck className="h-5 w-5" style={{ color: 'var(--teal)' }} />
                Today&apos;s Attendance Punch
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                Record your presence for {todayStr}. Once logged, your timestamp is sealed under zero-trust governance.
              </p>
            </div>

            {isTodayLocked && todayRecord && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Status for Today:</span>
                {getStatusBadge(todayRecord.status)}
              </div>
            )}
          </div>

          {isTodayLocked ? (
            <div className="rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--ink)' }}>
                  <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--teal)' }} />
                  <span>Your presence for today has been recorded successfully</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  Logged at <span className="font-mono font-bold" style={{ color: 'var(--ink)' }}>{todayRecord?.punch_time} IST</span>
                  {todayRecord?.notes && ` • Notes: "${todayRecord.notes}"`}
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shrink-0" style={{ background: 'var(--teal-wash)', color: 'var(--teal-ink)' }}>
                <ShieldCheck className="h-4 w-4" style={{ color: 'var(--teal)' }} />
                <span>Zero-Trust Locked</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--ink-2)' }}>
                  Shift Notes / Work Location (Optional)
                </label>
                <input
                  type="text"
                  value={todayNotes}
                  onChange={(e) => setTodayNotes(e.target.value)}
                  placeholder="e.g., Working on Core Platform feature, Office Desk #14"
                  className="w-full rounded-lg px-3.5 py-2 text-xs font-medium focus:outline-none transition-all"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                />
              </div>

              {/* Punch Actions */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleMarkAttendance('PRESENT')}
                  className="btn-primary inline-flex items-center gap-2 touch-manipulation active:scale-95 min-h-[44px] px-5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Punch In: Present (Office)</span>
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleMarkAttendance('WORK_FROM_HOME')}
                  className="btn-ghost inline-flex items-center gap-2 touch-manipulation active:scale-95 min-h-[44px] px-5"
                  style={{ borderColor: 'var(--teal)', color: 'var(--teal)' }}
                >
                  <Laptop className="h-4 w-4" />
                  <span>Punch In: Work From Home</span>
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleMarkAttendance('HALF_DAY')}
                  className="btn-ghost inline-flex items-center gap-2 touch-manipulation active:scale-95 min-h-[44px] px-5"
                  style={{ borderColor: 'var(--violet)', color: 'var(--violet)' }}
                >
                  <Clock className="h-4 w-4" />
                  <span>Half Day</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Attendance Compliance & Workplace Policy Banner */}
        <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3" style={{ borderBottom: '1px solid var(--line-soft)' }}>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl" style={{ background: 'var(--teal-wash)', color: 'var(--teal)' }}>
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--ink)' }}>
                  Workforce Attendance Compliance & Policy SLA
                </h3>
                <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                  Standard marking window: 09:00 AM – 10:00 AM IST • Grace period allowed up to 10:30 AM
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold" style={{
                background: monthlyInsights.attendanceScore >= 90 ? 'var(--teal-wash)' : monthlyInsights.attendanceScore >= 75 ? 'var(--amber-wash)' : 'var(--rose-wash)',
                color: monthlyInsights.attendanceScore >= 90 ? 'var(--teal-ink)' : monthlyInsights.attendanceScore >= 75 ? 'var(--amber)' : 'var(--rose)',
                border: `1px solid ${monthlyInsights.attendanceScore >= 90 ? 'var(--teal)' : monthlyInsights.attendanceScore >= 75 ? 'var(--amber)' : 'var(--rose)'}`,
              }}>
                {monthlyInsights.attendanceScore}% Compliance SLA
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
            <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}>
              <span className="text-[10px] font-bold uppercase block" style={{ color: 'var(--muted)' }}>Monthly Score</span>
              <span className="text-base font-extrabold" style={{ color: 'var(--teal)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                {monthlyInsights.attendanceScore}%
              </span>
              <span className="text-[10px] block" style={{ color: 'var(--muted)' }}>Punctuality Rate</span>
            </div>

            <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}>
              <span className="text-[10px] font-bold uppercase block" style={{ color: 'var(--muted)' }}>Present Days</span>
              <span className="text-base font-extrabold" style={{ color: 'var(--ink)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                {monthlyInsights.presentDays}
              </span>
              <span className="text-[10px] block" style={{ color: 'var(--muted)' }}>Recorded On-Time</span>
            </div>

            <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}>
              <span className="text-[10px] font-bold uppercase block" style={{ color: 'var(--muted)' }}>Approved Leaves</span>
              <span className="text-base font-extrabold" style={{ color: 'var(--amber)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                {monthlyInsights.leaveDays}
              </span>
              <span className="text-[10px] block" style={{ color: 'var(--muted)' }}>Authorized Off</span>
            </div>

            <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}>
              <span className="text-[10px] font-bold uppercase block" style={{ color: 'var(--muted)' }}>Working Days</span>
              <span className="text-base font-extrabold" style={{ color: 'var(--ink)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                {monthlyInsights.workingDays}
              </span>
              <span className="text-[10px] block" style={{ color: 'var(--muted)' }}>This Month</span>
            </div>
          </div>
        </div>

        {/* View Mode Switcher Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center rounded-lg p-1 text-xs font-bold" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-2 px-4 py-2 rounded transition-all cursor-pointer ${
                viewMode === 'calendar' ? 'tab-btn-active' : 'tab-btn-inactive'
              }`}
            >
              <CalendarDays className="h-4 w-4" />
              <span>Interactive Calendar & Insights</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-2 px-4 py-2 rounded transition-all cursor-pointer ${
                viewMode === 'table' ? 'tab-btn-active' : 'tab-btn-inactive'
              }`}
            >
              <CalendarCheck className="h-4 w-4" />
              <span>History & Timeline Logs</span>
            </button>
            <button
              onClick={() => setViewMode('corrections')}
              className={`flex items-center gap-2 px-4 py-2 rounded transition-all cursor-pointer ${
                viewMode === 'corrections' ? 'tab-btn-active' : 'tab-btn-inactive'
              }`}
            >
              <FilePenLine className="h-4 w-4" />
              <span>Correction Requests ({corrections.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setCorrectionDate(todayStr);
                setShowCorrectionModal(true);
              }}
              className="btn-ghost text-xs font-bold inline-flex items-center gap-1.5"
              style={{ borderColor: 'var(--amber)', color: 'var(--amber)' }}
            >
              <FilePenLine className="h-3.5 w-3.5" />
              <span>Request Correction</span>
            </button>

            <button
              onClick={() => setShowSyncModal(true)}
              className="btn-ghost text-xs font-bold"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} style={{ color: 'var(--teal)' }} />
              <span>Sync Google / Teams</span>
            </button>

            {/* Admin / Manager Add Holiday Action */}
            {isAdminOrLead && (
              <button
                onClick={() => setShowAddHolidayModal(true)}
                className="btn-primary text-xs font-bold"
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
              <div className="rounded-xl p-4 space-y-1" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Total Month Days</span>
                <div className="text-xl font-extrabold" style={{ color: 'var(--ink)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>{monthlyInsights.daysInMonth}</div>
                <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{monthlyInsights.workingDays} working days</p>
              </div>

              <div className="rounded-xl p-4 space-y-1" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--teal)' }}>Days Present</span>
                <div className="text-xl font-extrabold" style={{ color: 'var(--teal)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>{monthlyInsights.presentDays}</div>
                <p className="text-[10px]" style={{ color: 'var(--muted)' }}>Office & WFH verified</p>
              </div>

              <div className="rounded-xl p-4 space-y-1" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--violet)' }}>Half Days</span>
                <div className="text-xl font-extrabold" style={{ color: 'var(--violet)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>{monthlyInsights.halfDays}</div>
                <p className="text-[10px]" style={{ color: 'var(--muted)' }}>Partial attendance</p>
              </div>

              <div className="rounded-xl p-4 space-y-1" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--amber)' }}>Approved Leaves</span>
                <div className="text-xl font-extrabold" style={{ color: 'var(--amber)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>{monthlyInsights.leaveDays}</div>
                <p className="text-[10px]" style={{ color: 'var(--muted)' }}>Sanctioned time off</p>
              </div>

              <div className="rounded-xl p-4 space-y-1" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--teal)' }}>Holidays</span>
                <div className="text-xl font-extrabold" style={{ color: 'var(--teal)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>{monthlyInsights.holidaysCount}</div>
                <p className="text-[10px]" style={{ color: 'var(--muted)' }}>National & company</p>
              </div>

              <div className="rounded-xl p-4 space-y-1" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Attendance Score</span>
                <div className="text-xl font-extrabold" style={{ color: 'var(--teal)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>{monthlyInsights.attendanceScore}%</div>
                <div className="w-full rounded-full h-1.5 mt-1 overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{ background: 'var(--teal)', width: `${monthlyInsights.attendanceScore}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Calendar Main Container */}
            <div className="rounded-2xl p-6 sm:p-7 space-y-6" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
              {/* Calendar Month Navigation Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg sm:text-xl font-extrabold tracking-tight" style={{ color: 'var(--ink)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                    {monthName}
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded px-2.5 py-0.5 text-xs font-bold tag-teal">
                    <Calendar className="h-3 w-3" />
                    Interactive Calendar
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleJumpToToday}
                    className="btn-ghost text-xs font-semibold px-3 py-1.5"
                  >
                    Today
                  </button>
                  <button
                    onClick={handlePrevMonth}
                    className="btn-ghost p-1.5"
                    title="Previous Month"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleNextMonth}
                    className="btn-ghost p-1.5"
                    title="Next Month"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Legend Badges */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-semibold p-3 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)', color: 'var(--muted)' }}>
                <span className="font-bold uppercase text-[10px] tracking-wider" style={{ color: 'var(--muted)' }}>Legend:</span>
                <span className="flex items-center gap-1.5" style={{ color: 'var(--teal)' }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--teal)' }} />
                  Present (Office)
                </span>
                <span className="flex items-center gap-1.5" style={{ color: 'var(--teal-ink)' }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--teal)' }} />
                  Work From Home
                </span>
                <span className="flex items-center gap-1.5" style={{ color: 'var(--violet)' }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--violet)' }} />
                  Half Day
                </span>
                <span className="flex items-center gap-1.5" style={{ color: 'var(--amber)' }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--amber)' }} />
                  Approved Leave
                </span>
                <span className="flex items-center gap-1.5" style={{ color: 'var(--teal)' }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--teal)' }} />
                  Public / Company Holiday
                </span>
                <span className="flex items-center gap-1.5" style={{ color: 'var(--rose)' }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--rose)' }} />
                  Absent / Unmarked
                </span>
              </div>

              {/* 7-Day Grid Headers */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center text-xs font-extrabold uppercase tracking-wider pb-1" style={{ color: 'var(--muted)' }}>
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
                        className="min-h-[85px] sm:min-h-[105px] rounded-xl p-2 opacity-20"
                        style={{ background: 'var(--paper)', border: '1px solid var(--line-soft)' }}
                      />
                    );
                  }

                  const hasHoliday = Boolean(cell.holiday);
                  const hasRecord = Boolean(cell.record);
                  const hasLeave = Boolean(cell.leave);

                  // Card styling based on day status — using SOLID tokens, ZERO muddy opacity
                  let cellStyle: React.CSSProperties = {
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                  };
                  if (cell.isToday) {
                    cellStyle = {
                      background: 'var(--surface)',
                      border: '2px solid var(--teal)',
                      boxShadow: '0 0 0 1px var(--teal)',
                    };
                  } else if (hasHoliday) {
                    cellStyle = {
                      background: 'var(--teal-wash)',
                      border: '1px solid var(--teal)',
                    };
                  } else if (cell.isWeekend) {
                    cellStyle = {
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-soft)',
                    };
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
                      className="min-h-[85px] sm:min-h-[105px] rounded-xl p-2.5 sm:p-3 flex flex-col justify-between cursor-pointer transition-all duration-150"
                      style={cellStyle}
                    >
                      {/* Top Day Number & Today indicator */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs sm:text-sm font-bold ${
                            cell.isToday
                              ? 'flex h-6 w-6 items-center justify-center rounded-full text-white font-extrabold'
                              : ''
                          }`}
                          style={
                            cell.isToday
                              ? { background: 'var(--teal)', color: '#ffffff' }
                              : cell.isWeekend
                              ? { color: 'var(--muted)' }
                              : { color: 'var(--ink)' }
                          }
                        >
                          {cell.dayNum}
                        </span>

                        {cell.isToday && (
                          <span className="hidden sm:inline-block text-[9px] font-extrabold uppercase tracking-widest" style={{ color: 'var(--teal)' }}>
                            Today
                          </span>
                        )}
                      </div>

                      {/* Status Badges on Calendar Day */}
                      <div className="space-y-1 my-1">
                        {/* 1. Public / Company Holiday */}
                        {hasHoliday && (
                          <div
                            className="truncate rounded px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold"
                            style={{ background: 'var(--teal-wash)', color: 'var(--teal-ink)', border: '1px solid var(--line-soft)' }}
                            title={cell.holiday?.name}
                          >
                            🎌 {cell.holiday?.name}
                          </div>
                        )}

                        {/* 2. Attendance Status */}
                        {hasRecord && (
                          <div>
                            {cell.record?.status === 'PRESENT' && (
                              <div className="truncate rounded px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold" style={{ background: 'var(--teal-wash)', color: 'var(--teal-ink)' }}>
                                ✓ Present
                              </div>
                            )}
                            {cell.record?.status === 'WORK_FROM_HOME' && (
                              <div className="truncate rounded px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold" style={{ background: 'var(--teal-wash)', color: 'var(--teal-ink)' }}>
                                💻 WFH
                              </div>
                            )}
                            {cell.record?.status === 'HALF_DAY' && (
                              <div className="truncate rounded px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold" style={{ background: 'var(--violet-wash)', color: 'var(--violet)' }}>
                                ⏱ Half Day
                              </div>
                            )}
                            {cell.record?.status === 'ON_LEAVE' && (
                              <div className="truncate rounded px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold" style={{ background: 'var(--amber-wash)', color: 'var(--amber)' }}>
                                🏖 On Leave
                              </div>
                            )}
                            {cell.record?.status === 'ABSENT' && (
                              <div className="truncate rounded px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold" style={{ background: 'var(--rose-wash)', color: 'var(--rose)' }}>
                                ✕ Absent
                              </div>
                            )}
                          </div>
                        )}

                        {/* 3. Approved Leave without explicit punch record */}
                        {!hasRecord && hasLeave && (
                          <div className="truncate rounded px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold" style={{ background: 'var(--amber-wash)', color: 'var(--amber)' }}>
                            🏖 Approved Leave
                          </div>
                        )}

                        {/* 4. Past Unmarked Weekday */}
                        {!hasRecord && !hasHoliday && !hasLeave && !cell.isWeekend && !cell.isFuture && !cell.isToday && (
                          <div className="truncate rounded px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold" style={{ background: 'var(--rose-wash)', color: 'var(--rose)' }}>
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
                                  className="truncate rounded px-1.5 py-0.5 text-[8.5px] font-bold flex items-center gap-1"
                                  style={
                                    isGoogle
                                      ? { background: 'var(--amber-wash)', color: 'var(--amber)', border: '1px solid var(--line-soft)' }
                                      : isTeams
                                      ? { background: 'var(--violet-wash)', color: 'var(--violet)', border: '1px solid var(--line-soft)' }
                                      : { background: 'var(--teal-wash)', color: 'var(--teal-ink)', border: '1px solid var(--line-soft)' }
                                  }
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
          <div className="rounded-xl p-6 sm:p-7 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
                  Attendance Timeline & Logs
                </h2>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Historical records of daily presence and verified timestamps</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {isAdminOrLead && (
                  <div className="flex items-center rounded-lg p-1 text-xs font-semibold" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                    <button
                      onClick={() => setActiveTab('my')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all cursor-pointer ${
                        activeTab === 'my' ? 'tab-btn-active' : 'tab-btn-inactive'
                      }`}
                    >
                      <User className="h-3.5 w-3.5" />
                      <span>My Logs</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('team')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all cursor-pointer ${
                        activeTab === 'team' ? 'tab-btn-active' : 'tab-btn-inactive'
                      }`}
                    >
                      <Users className="h-3.5 w-3.5" />
                      <span>Team Roster</span>
                    </button>
                  </div>
                )}

                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5" style={{ color: 'var(--muted)' }} />
                  <input
                    type="text"
                    placeholder="Search date, name, status..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none w-56 sm:w-64"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                  />
                </div>
              </div>
            </div>

            {/* Mobile Card-based View (< md) */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800 rounded-lg overflow-hidden" style={{ border: '1px solid var(--line)' }}>
              {loading ? (
                <div className="text-center py-10 font-medium text-xs" style={{ color: 'var(--muted)', background: 'var(--surface)' }}>
                  Loading attendance logs...
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="text-center py-10 p-4" style={{ color: 'var(--muted)', background: 'var(--surface)' }}>
                  <CalendarCheck className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--muted)' }} />
                  <span className="font-semibold text-xs block" style={{ color: 'var(--ink)' }}>No attendance records found</span>
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>
                    Your presence logs will appear here as soon as you record attendance.
                  </span>
                </div>
              ) : (
                filteredRecords.map((r) => (
                  <div key={`m-${r.id}`} className="p-4 space-y-2.5" style={{ background: 'var(--surface)' }}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs" style={{ color: 'var(--ink)' }}>{r.date}</span>
                      {getStatusBadge(r.status)}
                    </div>
                    <div className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{r.employee_name}</div>
                    <div className="flex items-center justify-between text-[11px] pt-1" style={{ borderTop: '1px solid var(--line-soft)' }}>
                      <span className="inline-flex items-center gap-1 font-medium" style={{ color: 'var(--muted)' }}>
                        <Clock className="h-3 w-3" style={{ color: 'var(--teal)' }} />
                        {r.punch_time ? `${r.punch_time} IST` : 'No punch recorded'}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: 'var(--teal)' }}>
                        <ShieldCheck className="h-3 w-3" /> Logged & Secured
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto rounded-lg" style={{ border: '1px solid var(--line)' }}>
              <table className="w-full text-left text-xs">
                <thead className="font-bold uppercase tracking-wider text-[10px]" style={{ background: 'var(--surface-2)', color: 'var(--muted)', borderBottom: '1px solid var(--line)' }}>
                  <tr>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Employee Name</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Punch Timestamp</th>
                    <th className="px-5 py-3.5">Verification</th>
                  </tr>
                </thead>
                <tbody className="text-xs" style={{ background: 'var(--surface)' }}>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 font-medium" style={{ color: 'var(--muted)' }}>
                        Loading attendance logs...
                      </td>
                    </tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10" style={{ color: 'var(--muted)' }}>
                        <div className="flex flex-col items-center gap-2">
                          <CalendarCheck className="h-8 w-8" style={{ color: 'var(--muted)' }} />
                          <span className="font-semibold" style={{ color: 'var(--ink)' }}>No attendance records found</span>
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>
                            Your presence logs will appear here as soon as you record attendance.
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((r) => (
                      <tr key={r.id} className="transition-colors" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                        <td className="px-5 py-3.5 font-bold font-mono text-[11px]" style={{ color: 'var(--ink)' }}>{r.date}</td>
                        <td className="px-5 py-3.5 font-semibold" style={{ color: 'var(--ink)' }}>{r.employee_name}</td>
                        <td className="px-5 py-3.5">{getStatusBadge(r.status)}</td>
                        <td className="px-5 py-3.5 font-mono text-[11px]" style={{ color: 'var(--muted)' }}>
                          {r.punch_time ? (
                            <span className="inline-flex items-center gap-1 font-bold" style={{ color: 'var(--ink)' }}>
                              <Clock className="h-3 w-3" style={{ color: 'var(--teal)' }} />
                              {r.punch_time} IST
                            </span>
                          ) : (
                            <span>—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold" style={{ background: 'var(--teal-wash)', color: 'var(--teal-ink)' }}>
                            <ShieldCheck className="h-3 w-3" style={{ color: 'var(--teal)' }} />
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
        {/* VIEW 3: ATTENDANCE CORRECTION REQUESTS (§ 3) */}
        {/* ========================================================================= */}
        {viewMode === 'corrections' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
              <div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>My Attendance Correction Requests</h3>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  Submit corrections for missed or misclassified historical dates. Requests require supervisor or admin approval.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCorrectionDate(todayStr);
                  setShowCorrectionModal(true);
                }}
                className="btn-primary text-xs font-bold inline-flex items-center gap-1.5 shrink-0"
              >
                <FilePenLine className="h-4 w-4" />
                <span>+ New Correction Request</span>
              </button>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
              {/* Mobile Card-based View (< md) */}
              <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {corrections.length === 0 ? (
                  <div className="py-8 text-center text-xs p-4" style={{ color: 'var(--muted)' }}>
                    You have not submitted any attendance correction requests.
                  </div>
                ) : (
                  corrections.map((cor) => (
                    <div key={`mc-${cor.id}`} className="p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs" style={{ color: 'var(--ink)' }}>{cor.date}</span>
                        {cor.status === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200">
                            <Clock className="h-3 w-3" /> Pending Review
                          </span>
                        )}
                        {cor.status === 'APPROVED' && (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                            <Check className="h-3 w-3" /> Approved
                          </span>
                        )}
                        {cor.status === 'REJECTED' && (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200">
                            <X className="h-3 w-3" /> Rejected
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400">Requested:</span>
                        {getStatusBadge(cor.requested_status)}
                      </div>
                      <div className="text-xs italic" style={{ color: 'var(--ink-2)' }}>
                        &ldquo;{cor.reason}&rdquo;
                      </div>
                      {cor.reviewed_by_name && (
                        <div className="text-[11px] pt-1 text-slate-500" style={{ borderTop: '1px solid var(--line-soft)' }}>
                          Reviewed by <span className="font-semibold">{cor.reviewed_by_name}</span>: {cor.review_notes || 'Approved'}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Table View (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--line)' }}>
                      <th className="px-5 py-3.5 font-bold" style={{ color: 'var(--muted)' }}>Target Date</th>
                      <th className="px-5 py-3.5 font-bold" style={{ color: 'var(--muted)' }}>Current Status</th>
                      <th className="px-5 py-3.5 font-bold" style={{ color: 'var(--muted)' }}>Requested Status</th>
                      <th className="px-5 py-3.5 font-bold" style={{ color: 'var(--muted)' }}>Reason / Justification</th>
                      <th className="px-5 py-3.5 font-bold" style={{ color: 'var(--muted)' }}>Review Status</th>
                      <th className="px-5 py-3.5 font-bold" style={{ color: 'var(--muted)' }}>Reviewer Feedback</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--line-soft)' }}>
                    {corrections.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center" style={{ color: 'var(--muted)' }}>
                          You have not submitted any attendance correction requests.
                        </td>
                      </tr>
                    ) : (
                      corrections.map((cor) => (
                        <tr key={cor.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="px-5 py-3.5 font-mono font-bold" style={{ color: 'var(--ink)' }}>{cor.date}</td>
                          <td className="px-5 py-3.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {cor.current_status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {getStatusBadge(cor.requested_status)}
                          </td>
                          <td className="px-5 py-3.5 max-w-xs" style={{ color: 'var(--ink)' }}>
                            &ldquo;{cor.reason}&rdquo;
                          </td>
                          <td className="px-5 py-3.5">
                            {cor.status === 'PENDING' && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200">
                                <Clock className="h-3 w-3" /> Pending Review
                              </span>
                            )}
                            {cor.status === 'APPROVED' && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                                <Check className="h-3 w-3" /> Approved
                              </span>
                            )}
                            {cor.status === 'REJECTED' && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200">
                                <X className="h-3 w-3" /> Rejected
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--muted)' }}>
                            {cor.reviewed_by_name ? (
                              <div>
                                <span className="font-semibold" style={{ color: 'var(--ink)' }}>{cor.reviewed_by_name}</span>
                                {cor.review_notes && <p className="italic text-[11px]">&ldquo;{cor.review_notes}&rdquo;</p>}
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DAY DETAILS INSPECTOR MODAL */}
        {/* ========================================================================= */}
        {selectedDayDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in" style={{ background: 'rgba(10, 20, 25, 0.5)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-md rounded-xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
              <div className="flex items-center justify-between pb-3" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--teal)' }}>
                    Day Details
                  </span>
                  <h3 className="text-base font-extrabold" style={{ color: 'var(--ink)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                    {selectedDayDetails.weekday}, {selectedDayDetails.dateStr}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedDayDetails(null)}
                  className="rounded-lg p-1.5 transition-colors"
                  style={{ color: 'var(--muted)' }}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Status Section */}
              <div className="space-y-3 text-xs">
                {/* Holiday Info */}
                {selectedDayDetails.holiday && (
                  <div className="rounded-lg p-3.5 space-y-1" style={{ background: 'var(--teal-wash)', border: '1px solid var(--line-soft)' }}>
                    <div className="flex items-center gap-2 font-bold" style={{ color: 'var(--teal-ink)' }}>
                      <span>🎌</span>
                      <span>{selectedDayDetails.holiday.name}</span>
                    </div>
                    <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{selectedDayDetails.holiday.description}</p>
                  </div>
                )}

                {/* Approved Leave Info */}
                {selectedDayDetails.leave && (
                  <div className="rounded-lg p-3.5 space-y-1" style={{ background: 'var(--amber-wash)', border: '1px solid var(--line-soft)' }}>
                    <div className="flex items-center gap-2 font-bold" style={{ color: 'var(--amber)' }}>
                      <Calendar className="h-4 w-4" style={{ color: 'var(--amber)' }} />
                      <span>Approved {selectedDayDetails.leave.leave_type} Leave</span>
                    </div>
                    <p className="text-[11px]" style={{ color: 'var(--muted)' }}>Reason: {selectedDayDetails.leave.reason}</p>
                  </div>
                )}

                {/* Attendance Record */}
                {selectedDayDetails.record ? (
                  <div className="rounded-lg p-4 space-y-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold" style={{ color: 'var(--muted)' }}>Attendance Status:</span>
                      {getStatusBadge(selectedDayDetails.record.status)}
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span style={{ color: 'var(--muted)' }}>Punch Timestamp:</span>
                      <span className="font-mono font-bold" style={{ color: 'var(--ink)' }}>
                        {selectedDayDetails.record.punch_time} IST
                      </span>
                    </div>
                    {selectedDayDetails.record.notes && (
                      <div className="pt-2 text-[11px]" style={{ borderTop: '1px solid var(--line-soft)', color: 'var(--muted)' }}>
                        <span className="font-semibold">Notes:</span>{' '}
                        {selectedDayDetails.record.notes}
                      </div>
                    )}
                  </div>
                ) : (
                  !selectedDayDetails.holiday &&
                  !selectedDayDetails.leave && (
                    <div className="rounded-lg p-4 text-center space-y-1" style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}>
                      <div className="font-bold" style={{ color: 'var(--ink)' }}>
                        {selectedDayDetails.isWeekend
                          ? 'Weekend / Non-Working Day'
                          : selectedDayDetails.isFuture
                          ? 'Upcoming Calendar Date'
                          : 'Unmarked Attendance'}
                      </div>
                      <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
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
                    <span className="block text-[11px] font-bold" style={{ color: 'var(--ink)' }}>Record Today&apos;s Presence:</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleMarkAttendance('PRESENT')}
                        className="btn-primary justify-center text-xs"
                      >
                        Present (Office)
                      </button>
                      <button
                        onClick={() => handleMarkAttendance('WORK_FROM_HOME')}
                        className="btn-ghost justify-center text-xs"
                        style={{ borderColor: 'var(--teal)', color: 'var(--teal)' }}
                      >
                        Work From Home
                      </button>
                    </div>
                  </div>
                )}

                {/* 4. Scheduled Meetings & External Sync */}
                {selectedDayDetails.events && selectedDayDetails.events.length > 0 && (
                  <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--line-soft)' }}>
                    <span className="block text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
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
                            className="rounded-lg p-3 space-y-1.5"
                            style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-xs" style={{ color: 'var(--ink)' }}>{ev.title}</span>
                              <span
                                className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded"
                                style={
                                  isGoogle
                                    ? { background: 'var(--amber-wash)', color: 'var(--amber)' }
                                    : isTeams
                                    ? { background: 'var(--violet-wash)', color: 'var(--violet)' }
                                    : { background: 'var(--teal-wash)', color: 'var(--teal-ink)' }
                                }
                              >
                                {isGoogle ? 'Google Meet' : isTeams ? 'MS Teams' : 'Internal'}
                              </span>
                            </div>

                            <div className="text-[11px] flex items-center gap-3" style={{ color: 'var(--muted)' }}>
                              <span>🕒 {startTimeFormatted} - {endTimeFormatted}</span>
                              {ev.location && <span>📍 {ev.location}</span>}
                            </div>

                            {ev.description && (
                              <p className="text-[11px] line-clamp-2" style={{ color: 'var(--muted)' }}>{ev.description}</p>
                            )}

                            {ev.meeting_link && (
                              <div className="pt-1">
                                <a
                                  href={ev.meeting_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn-primary text-xs inline-flex items-center gap-1.5 px-3 py-1 rounded"
                                >
                                  <Video className="h-3.5 w-3.5" />
                                  <span>{isGoogle ? 'Join Google Meet' : isTeams ? 'Join Teams Meeting' : 'Join Call'}</span>
                                  <ExternalLink className="h-3 w-3" />
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

              <div className="pt-2 flex items-center justify-between gap-2">
                {!selectedDayDetails.isFuture && (
                  <button
                    onClick={() => {
                      setCorrectionDate(selectedDayDetails.dateStr);
                      setSelectedDayDetails(null);
                      setShowCorrectionModal(true);
                    }}
                    className="btn-ghost text-xs font-bold inline-flex items-center gap-1.5"
                    style={{ borderColor: 'var(--amber)', color: 'var(--amber)' }}
                  >
                    <FilePenLine className="h-3.5 w-3.5" />
                    <span>Request Correction</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedDayDetails(null)}
                  className="btn-ghost text-xs font-bold ml-auto"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in" style={{ background: 'rgba(10, 20, 25, 0.5)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-md rounded-xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
              <div className="flex items-center justify-between pb-3" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--teal)' }}>
                    Management Schedule
                  </span>
                  <h3 className="text-base font-extrabold" style={{ color: 'var(--ink)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                    Add Holiday / Company Event
                  </h3>
                </div>
                <button
                  onClick={() => setShowAddHolidayModal(false)}
                  className="rounded-lg p-1.5 transition-colors"
                  style={{ color: 'var(--muted)' }}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateHoliday} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold mb-1" style={{ color: 'var(--ink-2)' }}>Holiday / Event Title</label>
                  <input
                    type="text"
                    required
                    value={newHolidayTitle}
                    onChange={(e) => setNewHolidayTitle(e.target.value)}
                    placeholder="e.g., Company Annual Foundation Day, Diwali Off"
                    className="w-full rounded-lg px-3 py-2 text-xs font-medium focus:outline-none"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1" style={{ color: 'var(--ink-2)' }}>Date</label>
                    <input
                      type="date"
                      required
                      value={newHolidayDate}
                      onChange={(e) => setNewHolidayDate(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-xs font-medium focus:outline-none"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-1" style={{ color: 'var(--ink-2)' }}>Type</label>
                    <select
                      value={newHolidayType}
                      onChange={(e) => setNewHolidayType(e.target.value as any)}
                      className="w-full rounded-lg px-3 py-2 text-xs font-medium focus:outline-none"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                    >
                      <option value="holiday">Public / Company Holiday</option>
                      <option value="event">Company Event</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold mb-1" style={{ color: 'var(--ink-2)' }}>Description</label>
                  <textarea
                    rows={3}
                    value={newHolidayDesc}
                    onChange={(e) => setNewHolidayDesc(e.target.value)}
                    placeholder="Provide details or notes about this holiday or schedule event..."
                    className="w-full rounded-lg p-3 text-xs font-medium focus:outline-none resize-none"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddHolidayModal(false)}
                    className="btn-ghost text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingHoliday || !newHolidayTitle.trim()}
                    className="btn-primary text-xs font-bold"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in" style={{ background: 'rgba(10, 20, 25, 0.5)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-xl rounded-xl p-6 sm:p-7 space-y-5 max-h-[90vh] overflow-y-auto" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
              <div className="flex items-center justify-between pb-3.5" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--teal)' }}>
                    External Calendar Protocols
                  </span>
                  <h3 className="text-lg font-extrabold flex items-center gap-2" style={{ color: 'var(--ink)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                    <Globe className="h-5 w-5" style={{ color: 'var(--teal)' }} />
                    <span>Google Calendar & Microsoft Teams Sync</span>
                  </h3>
                </div>
                <button
                  onClick={() => setShowSyncModal(false)}
                  className="rounded-lg p-1.5 transition-colors cursor-pointer"
                  style={{ color: 'var(--muted)' }}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Instant 1-Click Quick Demo Sync Action */}
              <div className="rounded-lg p-4 space-y-2.5" style={{ background: 'var(--teal-wash)', border: '1px solid var(--line-soft)' }}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--ink)' }}>
                      <Sparkles className="h-4 w-4" style={{ color: 'var(--teal)' }} />
                      <span>1-Click Test Sync (Google Meet & Teams Standups)</span>
                    </h4>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>
                      Instantly sync sample recurring Google Meet and MS Teams team syncs for testing right now.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={syncing}
                    onClick={() => handleTriggerSync(true)}
                    className="shrink-0 btn-primary text-xs font-bold"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    <span>{syncing ? 'Syncing...' : 'Sync Sample Feeds'}</span>
                  </button>
                </div>
              </div>

              {/* Connected Feeds List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold" style={{ color: 'var(--ink)' }}>Your Connected Calendars</span>
                  <button
                    type="button"
                    disabled={syncing}
                    onClick={() => handleTriggerSync(false)}
                    className="text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    style={{ color: 'var(--teal)' }}
                  >
                    <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
                    <span>Sync All Active Feeds</span>
                  </button>
                </div>

                {integrations.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-xs" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
                    No custom external calendar feeds configured yet. Add your Google or Microsoft iCal URL below.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {integrations.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-lg p-3"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">
                            {item.provider === 'google' ? '🌐' : '👥'}
                          </span>
                          <div>
                            <div className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--ink)' }}>
                              <span>{item.provider === 'google' ? 'Google Calendar' : 'Microsoft Teams / 365'}</span>
                              <span className="rounded px-2 py-0.2 text-[9px] font-bold" style={{ background: 'var(--teal-wash)', color: 'var(--teal-ink)' }}>
                                Active
                              </span>
                            </div>
                            <div className="text-[10px] truncate max-w-[280px]" style={{ color: 'var(--muted)' }}>
                              {item.account_email || item.feed_url}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteIntegration(item.id)}
                          className="rounded-lg p-1.5 transition-colors cursor-pointer"
                          style={{ color: 'var(--muted)' }}
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
              <form onSubmit={handleAddIntegration} className="rounded-lg p-4 space-y-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                <span className="block text-xs font-bold" style={{ color: 'var(--ink)' }}>Connect a New Calendar Feed</span>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewIntegrationProvider('google')}
                    className="rounded-lg border p-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    style={
                      newIntegrationProvider === 'google'
                        ? { background: 'var(--amber-wash)', borderColor: 'var(--amber)', color: 'var(--amber)' }
                        : { background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--muted)' }
                    }
                  >
                    <span>🌐 Google Calendar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewIntegrationProvider('microsoft')}
                    className="rounded-lg border p-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    style={
                      newIntegrationProvider === 'microsoft'
                        ? { background: 'var(--violet-wash)', borderColor: 'var(--violet)', color: 'var(--violet)' }
                        : { background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--muted)' }
                    }
                  >
                    <span>👥 Microsoft Teams</span>
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold" style={{ color: 'var(--ink-2)' }}>Account Email (Optional)</label>
                  <input
                    type="email"
                    value={newIntegrationEmail}
                    onChange={(e) => setNewIntegrationEmail(e.target.value)}
                    placeholder={newIntegrationProvider === 'google' ? 'you@gmail.com' : 'you@company.onmicrosoft.com'}
                    className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none"
                    style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold" style={{ color: 'var(--ink-2)' }}>
                    Private iCal / ICS Feed URL <span style={{ color: 'var(--rose)' }}>*</span>
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
                    className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none font-mono text-[11px]"
                    style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                  />
                  <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                    {newIntegrationProvider === 'google'
                      ? 'Google Calendar: Settings -> Integrate calendar -> Secret address in iCal format'
                      : 'Outlook/Teams: Settings -> Calendar -> Shared calendars -> Publish a calendar -> ICS link'}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submittingIntegration}
                  className="w-full btn-primary justify-center text-xs font-bold"
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

        {/* ========================================================================= */}
        {/* REQUEST ATTENDANCE CORRECTION MODAL (§ 3) */}
        {/* ========================================================================= */}
        {showCorrectionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div
              className="w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl"
              style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
            >
              <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--line)' }}>
                <div className="flex items-center gap-2">
                  <FilePenLine className="h-4 w-4" style={{ color: 'var(--teal)' }} />
                  <h3 className="font-bold text-sm" style={{ color: 'var(--ink)' }}>
                    Request Attendance Correction
                  </h3>
                </div>
                <button
                  onClick={() => setShowCorrectionModal(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" style={{ color: 'var(--muted)' }} />
                </button>
              </div>

              <form onSubmit={handleCreateCorrection} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="block font-bold" style={{ color: 'var(--ink-2)' }}>
                    Target Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    max={todayStr}
                    value={correctionDate}
                    onChange={(e) => setCorrectionDate(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                  />
                  <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                    Select the past or current date you need corrected.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold" style={{ color: 'var(--ink-2)' }}>
                    Requested Attendance Status <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={correctionRequestedStatus}
                    onChange={(e) => setCorrectionRequestedStatus(e.target.value as AttendanceStatus)}
                    className="w-full rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                  >
                    <option value="PRESENT">Present (Office)</option>
                    <option value="WORK_FROM_HOME">Work From Home</option>
                    <option value="HALF_DAY">Half Day</option>
                    <option value="ON_LEAVE">On Leave</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold" style={{ color: 'var(--ink-2)' }}>
                    Reason / Justification <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    minLength={5}
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    placeholder="e.g. Forgot to punch in due to early morning client sync meeting..."
                    className="w-full rounded-lg p-2.5 text-xs focus:outline-none"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                  />
                  <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                    Minimum 5 characters. This will be reviewed by your squad leader or administrator.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t" style={{ borderColor: 'var(--line)' }}>
                  <button
                    type="button"
                    onClick={() => setShowCorrectionModal(false)}
                    className="btn-ghost text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingCorrection}
                    className="btn-primary text-xs font-bold"
                  >
                    {submittingCorrection ? 'Submitting...' : 'Submit for Review'}
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
