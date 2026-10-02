'use client';

import React, { useEffect, useState, useMemo } from 'react';
import AppShell from '@/components/layout/AppShell';
import {
  Calendar as CalendarIcon,
  Plus,
  MapPin,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  RefreshCw,
  Video,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Clock,
  Bell,
  Users,
  CalendarDays,
  Sparkles,
  Zap,
  Flag,
  Briefcase,
  Layers,
  ArrowRight,
  Check,
  CalendarCheck,
  ShieldCheck,
} from 'lucide-react';
import { ScheduleEvent, EventType } from '@/lib/db/types';
import { clientCache } from '@/lib/cache/clientCache';

/* ─── helpers ─────────────────────────────────────────────── */
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function startOfMonth(y: number, m: number) {
  return new Date(y, m, 1);
}
function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDT(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any; border: string }> = {
  holiday:       { label: 'Public Holiday', color: '#D99A1F', bg: 'rgba(217,154,31,0.14)', icon: Flag, border: 'rgba(217,154,31,0.35)' },
  meeting:       { label: 'Meeting',       color: '#2563EB', bg: 'rgba(37,99,235,0.12)', icon: Video, border: 'rgba(37,99,235,0.3)' },
  company_event: { label: 'Company Event', color: '#6366F1', bg: 'rgba(99,102,241,0.14)', icon: Zap, border: 'rgba(99,102,241,0.35)' },
  deadline:      { label: 'Milestone / Due',color: '#EF4444', bg: 'rgba(239,68,68,0.14)', icon: Clock, border: 'rgba(239,68,68,0.35)' },
  reminder:      { label: 'Reminder',      color: '#8B5CF6', bg: 'rgba(139,92,246,0.14)', icon: Bell, border: 'rgba(139,92,246,0.35)' },
  event:         { label: 'Event',         color: '#2563EB', bg: 'rgba(37,99,235,0.12)', icon: CalendarIcon, border: 'rgba(37,99,235,0.3)' },
  shift:         { label: 'Shift',         color: '#10B981', bg: 'rgba(16,185,129,0.14)', icon: Briefcase, border: 'rgba(16,185,129,0.35)' },
};

function getPlatformBadge(url?: string, platform?: string) {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes('meet.google.com') || platform === 'google_meet') {
    return { name: 'Google Meet', color: '#10B981', bg: 'rgba(16,185,129,0.15)', icon: Video };
  }
  if (u.includes('zoom.us') || platform === 'zoom') {
    return { name: 'Zoom', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)', icon: Video };
  }
  if (u.includes('teams.microsoft.com') || platform === 'teams') {
    return { name: 'MS Teams', color: '#6366F1', bg: 'rgba(99,102,241,0.15)', icon: Video };
  }
  return { name: 'Join Video Call', color: '#2563EB', bg: 'rgba(37,99,235,0.12)', icon: Video };
}

export default function SchedulePage() {
  const today = useMemo(() => new Date(), []);
  const todayYMD = useMemo(() => toYMD(today), [today]);

  const [events, setEvents] = useState<ScheduleEvent[]>(() => {
    if (typeof window !== 'undefined') {
      return clientCache.get<ScheduleEvent[]>('schedule_events') || [];
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      return !clientCache.get<ScheduleEvent[]>('schedule_events');
    }
    return true;
  });
  const [syncing, setSyncing] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [activeView, setActiveView] = useState<'month' | 'agenda' | 'day'>('month');
  const [notification, setNotification] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creationWarnings, setCreationWarnings] = useState<string[]>([]);

  // calendar nav
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState(todayYMD);

  // add-event modal
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<EventType>('meeting');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /* fetch */
  const fetchSchedule = async () => {
    try {
      const res = await fetch('/api/schedule');
      if (res.ok) {
        const d = await res.json();
        setEvents(d.events || []);
        clientCache.set('schedule_events', undefined, d.events || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, []);

  /* sync */
  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sample: true }),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        setNotification(d.message || 'Google Calendar synced successfully!');
        fetchSchedule();
        setTimeout(() => setNotification(null), 3500);
      } else {
        setError(d.error || 'Calendar sync failed.');
      }
    } catch {
      setError('Network connection error during sync.');
    } finally {
      setSyncing(false);
    }
  };

  /* open create modal with pre-fills */
  const openCreateModal = (dateStr?: string, defaultTitle?: string, defaultType: EventType = 'meeting', durationMinutes = 60) => {
    const baseDate = dateStr ? new Date(`${dateStr}T10:00:00`) : new Date();
    const startIso = new Date(baseDate.getTime() - baseDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const endIso = new Date(baseDate.getTime() + durationMinutes * 60000 - baseDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    setTitle(defaultTitle || '');
    setEventType(defaultType);
    setStartTime(startIso);
    setEndTime(endIso);
    setDescription('');
    setLocation(defaultType === 'meeting' ? 'Google Meet' : 'Cruvels Office');
    setMeetingLink(defaultType === 'meeting' ? `https://meet.google.com/cru-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}` : '');
    setError(null);
    setCreationWarnings([]);
    setShowModal(true);
  };

  /* create */
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setCreationWarnings([]);
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          eventType,
          startTime,
          endTime,
          location,
          meetingLink: meetingLink || undefined,
        }),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        setNotification('Event successfully scheduled!');
        if (d.warnings && d.warnings.length > 0) {
          setCreationWarnings(d.warnings);
        } else {
          setShowModal(false);
        }
        setTitle('');
        setDescription('');
        setLocation('');
        setMeetingLink('');
        fetchSchedule();
        setTimeout(() => setNotification(null), 4000);
      } else {
        setError(d.error || 'Failed to create event.');
      }
    } catch {
      setError('Network connection error.');
    } finally {
      setSubmitting(false);
    }
  };

  /* calendar grid calculations */
  const calGrid = useMemo(() => {
    const firstDow = startOfMonth(calYear, calMonth).getDay();
    const days = daysInMonth(calYear, calMonth);
    const cells: (number | null)[] = [
      ...Array(firstDow).fill(null),
      ...Array.from({ length: days }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calYear, calMonth]);

  /* group events by date map */
  const eventsByDate = useMemo(() => {
    const m: Record<string, ScheduleEvent[]> = {};
    events.forEach((ev) => {
      const ymd = toYMD(new Date(ev.start_time));
      if (!m[ymd]) m[ymd] = [];
      m[ymd].push(ev);
    });
    return m;
  }, [events]);

  /* dots per day */
  const dotMap = useMemo(() => {
    const m: Record<string, string[]> = {};
    events.forEach((ev) => {
      const ymd = toYMD(new Date(ev.start_time));
      if (!m[ymd]) m[ymd] = [];
      const col = TYPE_CONFIG[ev.event_type]?.color || '#2563EB';
      if (!m[ymd].includes(col)) m[ymd].push(col);
    });
    return m;
  }, [events]);

  /* filtered events */
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (typeFilter && ev.event_type !== typeFilter) return false;
      return true;
    });
  }, [events, typeFilter]);

  /* selected day events */
  const selectedDayEvents = useMemo(() => {
    return filteredEvents.filter((ev) => toYMD(new Date(ev.start_time)) === selected);
  }, [filteredEvents, selected]);

  /* selected date metadata */
  const selectedDateObj = useMemo(() => {
    const parts = selected.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }, [selected]);

  const isSelectedToday = selected === todayYMD;
  const isSelectedWeekend = selectedDateObj.getDay() === 0 || selectedDateObj.getDay() === 6;

  /* upcoming today's agenda */
  const todayAgenda = useMemo(() => {
    return filteredEvents
      .filter((ev) => toYMD(new Date(ev.start_time)) === todayYMD)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [filteredEvents, todayYMD]);

  /* KPI 1: Next upcoming public holiday */
  const nextHoliday = useMemo<{
    title: string;
    start_time: string;
    diffDays?: number;
  } | null>(() => {
    const holidays = events
      .filter((ev) => ev.event_type === 'holiday')
      .map((ev) => ({
        ...ev,
        dateStr: toYMD(new Date(ev.start_time)),
        dateObj: new Date(ev.start_time),
      }))
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

    if (holidays.length === 0) return null;

    const upcoming = holidays.find((h) => h.dateStr >= todayYMD);
    if (!upcoming) {
      return { title: holidays[0].title, start_time: holidays[0].start_time };
    }

    const diffDays = Math.ceil((upcoming.dateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return { title: upcoming.title, start_time: upcoming.start_time, diffDays };
  }, [events, today, todayYMD]);

  /* KPI 2: Working days in viewed month */
  const workingDaysInfo = useMemo(() => {
    const totalDays = daysInMonth(calYear, calMonth);
    let workDays = 0;
    const holidaysInMonth = events.filter((ev) => {
      if (ev.event_type !== 'holiday') return false;
      const d = new Date(ev.start_time);
      return d.getFullYear() === calYear && d.getMonth() === calMonth;
    });

    for (let day = 1; day <= totalDays; day++) {
      const dt = new Date(calYear, calMonth, day);
      const dow = dt.getDay();
      const isWeekend = dow === 0 || dow === 6;
      const ymd = toYMD(dt);
      const isHol = holidaysInMonth.some((h) => toYMD(new Date(h.start_time)) === ymd);
      if (!isWeekend && !isHol) {
        workDays++;
      }
    }
    return {
      workDays,
      holidayCount: holidaysInMonth.length,
      monthName: MONTH_NAMES[calMonth],
    };
  }, [calYear, calMonth, events]);

  /* KPI 3: Scheduled items in viewed month */
  const monthStats = useMemo(() => {
    const monthEvs = events.filter((ev) => {
      const d = new Date(ev.start_time);
      return d.getFullYear() === calYear && d.getMonth() === calMonth;
    });

    const meetingsCount = monthEvs.filter((e) => e.event_type === 'meeting').length;
    const holidaysCount = monthEvs.filter((e) => e.event_type === 'holiday').length;
    const deadlinesCount = monthEvs.filter((e) => e.event_type === 'deadline').length;

    return {
      total: monthEvs.length,
      meetingsCount,
      holidaysCount,
      deadlinesCount,
    };
  }, [calYear, calMonth, events]);

  /* Upcoming Company Highlights (next 4 upcoming events across calendar) */
  const upcomingHighlights = useMemo(() => {
    return events
      .filter((ev) => toYMD(new Date(ev.start_time)) >= todayYMD)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .slice(0, 4);
  }, [events, todayYMD]);

  /* Event category counts for filter pills */
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: events.length,
      holiday: 0,
      meeting: 0,
      company_event: 0,
      deadline: 0,
      reminder: 0,
    };
    events.forEach((e) => {
      if (counts[e.event_type] !== undefined) {
        counts[e.event_type]++;
      }
    });
    return counts;
  }, [events]);

  return (
    <AppShell>
      <div className="flex flex-col h-full gap-4 max-w-7xl mx-auto w-full pb-8" style={{ color: 'var(--ink)' }}>
        
        {/* TOP HERO HEADER */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[var(--line)]">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 shadow-xs">
                <CalendarIcon className="h-5 w-5" />
              </div>
              <div>
                <h1
                  className="text-lg sm:text-xl font-bold tracking-tight flex items-center gap-2"
                  style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}
                >
                  Calendar & Operational Agenda
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 hidden md:inline-flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" /> Live Operations
                  </span>
                </h1>
                <p className="text-xs text-[var(--muted)]">
                  Google Workspace sync, Indian gazetted holidays, and instant video conference launches.
                </p>
              </div>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-2 transition-all hover:bg-[var(--surface-hover)] active:scale-95 shadow-xs"
              style={{ background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--ink)' }}
              title="Sync with Google Workspace calendar"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin text-blue-500' : 'text-blue-600 dark:text-blue-400'}`} />
              <span>{syncing ? 'Syncing...' : 'Sync Calendar'}</span>
            </button>

            <button
              onClick={() => openCreateModal(selected)}
              className="glow-btn-primary px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all hover:scale-[1.02] active:scale-95 text-white"
            >
              <Plus className="h-4 w-4" />
              <span>Schedule Event</span>
            </button>
          </div>
        </div>

        {/* ALERTS & NOTIFICATIONS */}
        {notification && (
          <div className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-xs bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 font-semibold animate-in fade-in slide-in-from-top-2 duration-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span>{notification}</span>
          </div>
        )}

        {creationWarnings.length > 0 && (
          <div className="p-3.5 rounded-xl text-xs bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 space-y-1 animate-in fade-in">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Operational Notice:</span>
            </div>
            <ul className="list-disc list-inside pl-1 space-y-0.5 text-[11px]">
              {creationWarnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* EXECUTIVE KPI PULSE BAR */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Card 1: Next Holiday */}
          <div
            className="p-3.5 rounded-2xl border transition-all hover:border-amber-500/40 relative overflow-hidden group"
            style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
          >
            <div className="absolute -right-3 -bottom-3 w-16 h-16 rounded-full bg-amber-500/5 blur-xl pointer-events-none group-hover:bg-amber-500/10 transition-colors" />
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-[var(--muted)] flex items-center gap-1.5">
                <Flag className="h-3.5 w-3.5 text-amber-500" /> Next Public Holiday
              </span>
              {nextHoliday?.diffDays !== undefined && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  {nextHoliday.diffDays === 0 ? 'Today!' : nextHoliday.diffDays === 1 ? 'Tomorrow' : `In ${nextHoliday.diffDays}d`}
                </span>
              )}
            </div>
            <div className="text-sm font-bold text-[var(--ink)] truncate" title={nextHoliday?.title || 'None upcoming'}>
              {nextHoliday?.title || 'None Scheduled'}
            </div>
            <div className="text-[11px] text-[var(--muted)] mt-0.5">
              {nextHoliday ? new Date(nextHoliday.start_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'All gazetted holidays cleared'}
            </div>
          </div>

          {/* Card 2: Working Days in Month */}
          <div
            className="p-3.5 rounded-2xl border transition-all hover:border-blue-500/40 relative overflow-hidden group"
            style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
          >
            <div className="absolute -right-3 -bottom-3 w-16 h-16 rounded-full bg-blue-500/5 blur-xl pointer-events-none group-hover:bg-blue-500/10 transition-colors" />
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-[var(--muted)] flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> Operational Month
              </span>
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                {workingDaysInfo.monthName}
              </span>
            </div>
            <div className="text-sm font-bold text-[var(--ink)] flex items-baseline gap-1.5">
              <span>{workingDaysInfo.workDays} Working Days</span>
            </div>
            <div className="text-[11px] text-[var(--muted)] mt-0.5">
              {workingDaysInfo.holidayCount} public holiday{workingDaysInfo.holidayCount === 1 ? '' : 's'} defined
            </div>
          </div>

          {/* Card 3: Scheduled Engagements */}
          <div
            className="p-3.5 rounded-2xl border transition-all hover:border-indigo-500/40 relative overflow-hidden group"
            style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
          >
            <div className="absolute -right-3 -bottom-3 w-16 h-16 rounded-full bg-indigo-500/5 blur-xl pointer-events-none group-hover:bg-indigo-500/10 transition-colors" />
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-[var(--muted)] flex items-center gap-1.5">
                <CalendarCheck className="h-3.5 w-3.5 text-indigo-500" /> Month Capacity
              </span>
              <span className="text-[10px] font-bold text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                {monthStats.total} Events
              </span>
            </div>
            <div className="text-sm font-bold text-[var(--ink)]">
              {monthStats.meetingsCount} Meetings &middot; {monthStats.holidaysCount} Holidays
            </div>
            <div className="text-[11px] text-[var(--muted)] mt-0.5">
              {monthStats.deadlinesCount} active milestones/due dates
            </div>
          </div>

          {/* Card 4: Google Workspace Live Sync */}
          <div
            className="p-3.5 rounded-2xl border transition-all hover:border-emerald-500/40 relative overflow-hidden group"
            style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
          >
            <div className="absolute -right-3 -bottom-3 w-16 h-16 rounded-full bg-emerald-500/5 blur-xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-[var(--muted)] flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-emerald-500" /> Cloud Sync Engine
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="text-sm font-bold text-[var(--ink)] flex items-center gap-1.5">
              <span>Google Calendar</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                Active
              </span>
            </div>
            <div className="text-[11px] text-[var(--muted)] mt-0.5">
              Bidirectional auto-sync &amp; RSVP
            </div>
          </div>
        </div>

        {/* CONTROLS: VIEW SWITCHER + VIBRANT CATEGORY PILLS */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
          {/* Segmented View Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--paper)] border border-[var(--line)] shrink-0 self-start md:self-auto">
            <button
              onClick={() => setActiveView('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeView === 'month'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" /> Month View
            </button>
            <button
              onClick={() => setActiveView('agenda')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeView === 'agenda'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              <Clock className="h-3.5 w-3.5" /> Today&apos;s Agenda
            </button>
            <button
              onClick={() => setActiveView('day')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeView === 'day'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              <Layers className="h-3.5 w-3.5" /> Day View
            </button>
          </div>

          {/* Interactive Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              onClick={() => setTypeFilter('')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-all border ${
                typeFilter === ''
                  ? 'bg-blue-500/15 border-blue-500 shadow-xs'
                  : 'border-[var(--line)] hover:text-[var(--ink)] bg-[var(--paper)]'
              }`}
              style={{ color: typeFilter === '' ? 'var(--teal)' : 'var(--muted)' }}
            >
              All ({categoryCounts.all})
            </button>
            <button
              onClick={() => setTypeFilter('holiday')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-all border flex items-center gap-1 ${
                typeFilter === 'holiday'
                  ? 'bg-amber-500/20 border-amber-500 shadow-xs'
                  : 'border-[var(--line)] hover:text-[var(--ink)] bg-[var(--paper)]'
              }`}
              style={{ color: typeFilter === 'holiday' ? 'var(--amber)' : 'var(--muted)' }}
            >
              <Flag className="h-3 w-3 text-amber-500" /> Holidays ({categoryCounts.holiday})
            </button>
            <button
              onClick={() => setTypeFilter('meeting')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-all border flex items-center gap-1 ${
                typeFilter === 'meeting'
                  ? 'bg-blue-500/20 border-blue-500 shadow-xs'
                  : 'border-[var(--line)] hover:text-[var(--ink)] bg-[var(--paper)]'
              }`}
              style={{ color: typeFilter === 'meeting' ? 'var(--teal)' : 'var(--muted)' }}
            >
              <Video className="h-3 w-3 text-blue-500" /> Meetings ({categoryCounts.meeting})
            </button>
            <button
              onClick={() => setTypeFilter('deadline')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-all border flex items-center gap-1 ${
                typeFilter === 'deadline'
                  ? 'bg-rose-500/20 border-rose-500 shadow-xs'
                  : 'border-[var(--line)] hover:text-[var(--ink)] bg-[var(--paper)]'
              }`}
              style={{ color: typeFilter === 'deadline' ? 'var(--rose)' : 'var(--muted)' }}
            >
              <Clock className="h-3 w-3 text-rose-500" /> Milestones ({categoryCounts.deadline})
            </button>
            <button
              onClick={() => setTypeFilter('company_event')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-all border flex items-center gap-1 ${
                typeFilter === 'company_event'
                  ? 'bg-indigo-500/20 border-indigo-500 shadow-xs'
                  : 'border-[var(--line)] hover:text-[var(--ink)] bg-[var(--paper)]'
              }`}
              style={{ color: typeFilter === 'company_event' ? 'var(--violet)' : 'var(--muted)' }}
            >
              <Zap className="h-3 w-3 text-indigo-500" /> Company ({categoryCounts.company_event})
            </button>
          </div>
        </div>

        {/* MAIN DISPLAY AREA */}
        {loading ? (
          <div className="flex flex-1 items-center justify-center p-16">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent border-blue-600" />
              <p className="text-xs text-[var(--muted)]">Syncing operations agenda...</p>
            </div>
          </div>
        ) : activeView === 'agenda' ? (
          /* TODAY'S AGENDA VIEW */
          <div className="p-6 rounded-3xl border border-[var(--line)] bg-[var(--surface)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div>
                <h2 className="text-base font-bold text-[var(--ink)] flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Today&apos;s Operational Agenda
                </h2>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                {todayAgenda.length} Event{todayAgenda.length === 1 ? '' : 's'} Scheduled Today
              </span>
            </div>

            {todayAgenda.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border border-dashed border-[var(--line)] bg-[var(--paper)] space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--ink)]">Clear Schedule Today</h3>
                  <p className="text-xs text-[var(--muted)] max-w-sm mx-auto mt-1">
                    No meetings or mandatory deadlines are scheduled for today. Enjoy an uninterrupted flow block!
                  </p>
                </div>
                <button
                  onClick={() => openCreateModal(todayYMD, 'Quick Standup', 'meeting', 30)}
                  className="glow-btn-primary px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm text-white"
                >
                  <Plus className="h-4 w-4" /> Quick Schedule Meeting
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {todayAgenda.map((ev) => {
                  const conf = TYPE_CONFIG[ev.event_type] || TYPE_CONFIG.event;
                  const platform = getPlatformBadge(ev.meeting_link, ev.meeting_platform);
                  const diffMinutes = (new Date(ev.start_time).getTime() - Date.now()) / 60000;
                  const isStartingSoon = diffMinutes > 0 && diffMinutes <= 15;

                  return (
                    <div
                      key={ev.id}
                      className="p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:shadow-md"
                      style={{
                        background: isStartingSoon ? 'var(--teal-wash)' : 'var(--paper)',
                        borderColor: isStartingSoon ? 'var(--teal)' : 'var(--line)',
                      }}
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                            style={{ background: conf.bg, color: conf.color }}
                          >
                            {conf.label}
                          </span>
                          {isStartingSoon && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-500 animate-pulse flex items-center gap-1">
                              <Bell className="h-3 w-3" /> Starts in {Math.round(diffMinutes)} mins
                            </span>
                          )}
                          <span className="text-xs font-bold text-[var(--ink)]">
                            {fmtTime(ev.start_time)} – {fmtTime(ev.end_time)}
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-[var(--ink)]">{ev.title}</h3>
                        {ev.description && (
                          <p className="text-xs text-[var(--muted)]">{ev.description}</p>
                        )}
                        {ev.location && (
                          <div className="text-[11px] text-[var(--muted)] flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" /> {ev.location}
                          </div>
                        )}
                      </div>

                      {ev.meeting_link && platform && (
                        <a
                          href={ev.meeting_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="glow-btn-primary px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0 text-white shadow-sm"
                        >
                          <Video className="h-4 w-4" />
                          <span>Join {platform.name}</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeView === 'day' ? (
          /* DEDICATED DAY VIEW */
          <div className="p-6 rounded-3xl border border-[var(--line)] bg-[var(--surface)] space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-[var(--line)] gap-2">
              <div>
                <h2 className="text-base font-bold text-[var(--ink)] flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Day Focus: {selectedDateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  {isSelectedToday && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400">
                      Today
                    </span>
                  )}
                  {isSelectedWeekend && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400">
                      Weekend
                    </span>
                  )}
                  <span className="text-xs text-[var(--muted)]">
                    {selectedDayEvents.length} scheduled item{selectedDayEvents.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const prev = new Date(selectedDateObj.getTime() - 86400000);
                    setSelected(toYMD(prev));
                    setCalYear(prev.getFullYear());
                    setCalMonth(prev.getMonth());
                  }}
                  className="p-1.5 rounded-lg border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]"
                  title="Previous Day"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setSelected(todayYMD);
                    setCalYear(today.getFullYear());
                    setCalMonth(today.getMonth());
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold border border-[var(--line)] hover:bg-[var(--surface-hover)]"
                >
                  Today
                </button>
                <button
                  onClick={() => {
                    const next = new Date(selectedDateObj.getTime() + 86400000);
                    setSelected(toYMD(next));
                    setCalYear(next.getFullYear());
                    setCalMonth(next.getMonth());
                  }}
                  className="p-1.5 rounded-lg border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]"
                  title="Next Day"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => openCreateModal(selected)}
                  className="glow-btn-primary px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 text-white ml-2"
                >
                  <Plus className="h-3.5 w-3.5" /> Add to this Day
                </button>
              </div>
            </div>

            {/* Hourly schedule layout */}
            <div className="space-y-2 max-w-3xl">
              {selectedDayEvents.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-dashed border-[var(--line)] bg-[var(--paper)] space-y-2">
                  <p className="text-sm font-bold text-[var(--ink)]">No scheduled events for this date</p>
                  <p className="text-xs text-[var(--muted)]">Use the button above to schedule a client meeting, standup, or milestone.</p>
                </div>
              ) : (
                selectedDayEvents.map((ev) => {
                  const conf = TYPE_CONFIG[ev.event_type] || TYPE_CONFIG.event;
                  const platform = getPlatformBadge(ev.meeting_link, ev.meeting_platform);
                  return (
                    <div
                      key={ev.id}
                      className="p-4 rounded-2xl border border-[var(--line)] bg-[var(--paper)] flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-bold"
                            style={{ background: conf.bg, color: conf.color }}
                          >
                            {conf.label}
                          </span>
                          <span className="text-xs font-bold text-[var(--muted)]">
                            {ev.event_type === 'holiday' ? 'All Day' : `${fmtTime(ev.start_time)} – ${fmtTime(ev.end_time)}`}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-[var(--ink)]">{ev.title}</h3>
                        {ev.description && <p className="text-xs text-[var(--muted)]">{ev.description}</p>}
                      </div>
                      {ev.meeting_link && platform && (
                        <a
                          href={ev.meeting_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="glow-btn-primary px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 text-white"
                        >
                          <Video className="h-4 w-4" /> Join
                        </a>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* CLASSIC MONTH VIEW + DYNAMIC RICH SIDEBAR */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* LEFT / CENTER: FULL-HEIGHT CALENDAR GRID (8 of 12 cols) */}
            <div
              className="lg:col-span-8 rounded-3xl p-5 border border-[var(--line)] flex flex-col justify-between shadow-xs"
              style={{ background: 'var(--surface)' }}
            >
              <div>
                {/* Month Navigator Header */}
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--line)]">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-[var(--ink)] tracking-tight" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                      {MONTH_NAMES[calMonth]} {calYear}
                    </span>
                    <span className="text-xs text-[var(--muted)] font-medium">
                      ({workingDaysInfo.workDays} work days)
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        if (calMonth === 0) {
                          setCalMonth(11);
                          setCalYear((y) => y - 1);
                        } else {
                          setCalMonth((m) => m - 1);
                        }
                      }}
                      className="p-2 rounded-xl border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)] transition-all"
                      aria-label="Previous Month"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    
                    <button
                      onClick={() => {
                        setCalMonth(today.getMonth());
                        setCalYear(today.getFullYear());
                        setSelected(todayYMD);
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-[var(--teal)] border border-[var(--line)] hover:bg-[var(--surface-hover)] transition-all"
                    >
                      Today
                    </button>

                    <button
                      onClick={() => {
                        if (calMonth === 11) {
                          setCalMonth(0);
                          setCalYear((y) => y + 1);
                        } else {
                          setCalMonth((m) => m + 1);
                        }
                      }}
                      className="p-2 rounded-xl border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)] transition-all"
                      aria-label="Next Month"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Day Names Header */}
                <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-[var(--muted)] mb-2">
                  {DAY_NAMES.map((d, i) => {
                    const isWeekendHeader = i === 0 || i === 6;
                    return (
                      <div
                        key={d}
                        className={`py-1 rounded-md ${isWeekendHeader ? 'text-amber-500/80 dark:text-amber-400/80' : ''}`}
                      >
                        {d}
                      </div>
                    );
                  })}
                </div>

                {/* Calendar Grid Cells */}
                <div className="grid grid-cols-7 gap-2">
                  {calGrid.map((dayNum, idx) => {
                    if (dayNum === null) {
                      return (
                        <div
                          key={`empty-${idx}`}
                          className="min-h-[96px] rounded-2xl border border-[var(--line)]/20 bg-[var(--paper)]/30 opacity-25"
                        />
                      );
                    }

                    const colIndex = idx % 7;
                    const isWeekendCol = colIndex === 0 || colIndex === 6;
                    const cellYMD = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                    const isSelected = selected === cellYMD;
                    const isTodayCell = cellYMD === todayYMD;
                    const dayEvents = (eventsByDate[cellYMD] || []).filter((ev) => !typeFilter || ev.event_type === typeFilter);
                    const dayHolidays = dayEvents.filter((ev) => ev.event_type === 'holiday');
                    const hasHoliday = dayHolidays.length > 0;

                    return (
                      <div
                        key={`day-${dayNum}`}
                        onClick={() => setSelected(cellYMD)}
                        className={`group min-h-[96px] rounded-2xl p-2 flex flex-col justify-between transition-all border text-left cursor-pointer relative ${
                          isSelected
                            ? 'border-blue-500 bg-blue-500/10 shadow-sm ring-2 ring-blue-500/40'
                            : isTodayCell
                            ? 'border-blue-500/70 bg-blue-500/5 shadow-xs'
                            : hasHoliday
                            ? 'border-amber-500/30 bg-amber-500/[0.04] hover:border-amber-400/60'
                            : isWeekendCol
                            ? 'border-[var(--line)] bg-[var(--paper)]/50 hover:border-blue-500/40'
                            : 'border-[var(--line)] bg-[var(--paper)] hover:border-blue-500/40 hover:bg-[var(--surface-hover)]'
                        }`}
                      >
                        {/* Cell Header: Day Number + Quick Add */}
                        <div className="w-full flex items-center justify-between">
                          <span
                            className={`flex items-center justify-center text-xs rounded-full transition-all ${
                              isTodayCell
                                ? 'h-6 w-6 bg-blue-600 text-white font-black shadow-sm ring-2 ring-blue-400/30'
                                : isSelected
                                ? 'font-black text-blue-600 dark:text-blue-400'
                                : hasHoliday
                                ? 'font-bold text-amber-500 dark:text-amber-400'
                                : isWeekendCol
                                ? 'font-medium text-[var(--muted)]'
                                : 'font-bold text-[var(--ink)]'
                            }`}
                          >
                            {dayNum}
                          </span>

                          {/* Quick "+" scheduler on cell hover */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openCreateModal(cellYMD);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded-md hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 transition-opacity"
                            title={`Schedule on ${cellYMD}`}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Event Chips inside the Cell */}
                        <div className="w-full space-y-1 my-1">
                          {dayEvents.slice(0, 2).map((ev) => {
                            const conf = TYPE_CONFIG[ev.event_type] || TYPE_CONFIG.event;
                            const isHol = ev.event_type === 'holiday';

                            return (
                              <div
                                key={ev.id}
                                className="w-full px-1.5 py-0.5 rounded-md text-[10px] font-bold truncate flex items-center gap-1 transition-transform group-hover:scale-[1.02]"
                                style={{
                                  background: conf.bg,
                                  color: conf.color,
                                  border: `1px solid ${conf.border}`,
                                }}
                                title={`${ev.title} (${conf.label})`}
                              >
                                {isHol ? (
                                  <span className="shrink-0 text-[10px]">🇮🇳</span>
                                ) : (
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: conf.color }} />
                                )}
                                <span className="truncate">{ev.title}</span>
                              </div>
                            );
                          })}

                          {dayEvents.length > 2 && (
                            <div className="text-[9px] font-extrabold text-[var(--muted)] pl-0.5">
                              +{dayEvents.length - 2} more
                            </div>
                          )}
                        </div>

                        {/* Cell Bottom Indicator dots if no chips */}
                        {dayEvents.length === 0 && (
                          <div className="h-1.5 w-full flex items-center justify-end">
                            {isWeekendCol && (
                              <span className="text-[8px] font-semibold text-[var(--muted)]/50 uppercase tracking-wider">
                                Wkd
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT SIDEBAR: DYNAMIC SMART DAY & MONTH HUB (4 of 12 cols) */}
            <div
              className="lg:col-span-4 rounded-3xl p-5 border border-[var(--line)] flex flex-col justify-between shadow-xs space-y-5"
              style={{ background: 'var(--surface)' }}
            >
              <div className="space-y-4">
                {/* Selected Date Header */}
                <div className="pb-3 border-b border-[var(--line)]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> Selected Date
                    </span>
                    {isSelectedToday ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                        Today
                      </span>
                    ) : isSelectedWeekend ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                        Weekend
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--paper)] text-[var(--muted)] border border-[var(--line)]">
                        Working Day
                      </span>
                    )}
                  </div>

                  <h2 className="text-base font-bold text-[var(--ink)]">
                    {selectedDateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
                  </h2>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--line)]/50">
                    <span className="text-xs text-[var(--muted)]">
                      {selectedDayEvents.length} Event{selectedDayEvents.length === 1 ? '' : 's'} scheduled
                    </span>
                    <button
                      onClick={() => openCreateModal(selected)}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Event
                    </button>
                  </div>
                </div>

                {/* Selected Day's Events List */}
                {selectedDayEvents.length > 0 ? (
                  <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin">
                    {selectedDayEvents.map((ev) => {
                      const conf = TYPE_CONFIG[ev.event_type] || TYPE_CONFIG.event;
                      const platform = getPlatformBadge(ev.meeting_link, ev.meeting_platform);
                      const isHol = ev.event_type === 'holiday';

                      return (
                        <div
                          key={ev.id}
                          className="p-3.5 rounded-2xl border transition-all hover:shadow-xs flex flex-col gap-2"
                          style={{ background: 'var(--paper)', borderColor: 'var(--line)' }}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className="px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1"
                              style={{ background: conf.bg, color: conf.color }}
                            >
                              {isHol ? '🇮🇳' : null} {conf.label}
                            </span>
                            <span className="text-[11px] font-bold text-[var(--muted)]">
                              {isHol ? 'Gazetted Holiday' : fmtTime(ev.start_time)}
                            </span>
                          </div>

                          <h4 className="text-xs font-bold text-[var(--ink)] leading-snug">{ev.title}</h4>

                          {ev.description && (
                            <p className="text-[11px] text-[var(--muted)] leading-relaxed">{ev.description}</p>
                          )}

                          {ev.location && (
                            <div className="text-[10px] text-[var(--muted)] flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-blue-600" /> {ev.location}
                            </div>
                          )}

                          {ev.meeting_link && platform && (
                            <div className="mt-1 pt-2 border-t border-[var(--line)] flex items-center justify-between">
                              <span className="text-[10px] text-[var(--muted)]">{platform.name}</span>
                              <a
                                href={ev.meeting_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="glow-btn-primary px-3 py-1 rounded-lg text-xs font-bold text-white flex items-center gap-1.5"
                              >
                                <Video className="h-3.5 w-3.5" /> Join Call
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Clean Slate Empty State */
                  <div className="p-4 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--paper)]/60 text-center space-y-2">
                    <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--ink)]">Open Focus Day</h4>
                      <p className="text-[11px] text-[var(--muted)] max-w-xs mx-auto">
                        Zero meetings or commitments on this date.
                      </p>
                    </div>

                    {/* Quick 1-Click Scheduling Presets */}
                    <div className="pt-2 flex flex-wrap gap-1.5 justify-center">
                      <button
                        onClick={() => openCreateModal(selected, 'Quick Sync', 'meeting', 30)}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[var(--surface)] border border-[var(--line)] hover:border-blue-500 text-[var(--ink)] transition-colors"
                      >
                        + 30m Sync
                      </button>
                      <button
                        onClick={() => openCreateModal(selected, '1:1 Review', 'meeting', 45)}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[var(--surface)] border border-[var(--line)] hover:border-blue-500 text-[var(--ink)] transition-colors"
                      >
                        + 45m 1:1
                      </button>
                      <button
                        onClick={() => openCreateModal(selected, 'Project Milestone', 'deadline', 60)}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[var(--surface)] border border-[var(--line)] hover:border-blue-500 text-[var(--ink)] transition-colors"
                      >
                        + Milestone
                      </button>
                    </div>
                  </div>
                )}

                {/* UPCOMING COMPANY HIGHLIGHTS TIMELINE (Prevents Empty Void) */}
                <div className="pt-3 border-t border-[var(--line)] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider flex items-center gap-1.5">
                      <Flag className="h-3.5 w-3.5 text-amber-500" /> Upcoming Highlights
                    </span>
                    <span className="text-[10px] font-medium text-[var(--muted)]">Across Cruvels</span>
                  </div>

                  <div className="space-y-1.5">
                    {upcomingHighlights.map((ev) => {
                      const conf = TYPE_CONFIG[ev.event_type] || TYPE_CONFIG.event;
                      const dateFormatted = new Date(ev.start_time).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      });
                      const isHol = ev.event_type === 'holiday';

                      return (
                        <div
                          key={ev.id}
                          onClick={() => {
                            const ymd = toYMD(new Date(ev.start_time));
                            setSelected(ymd);
                            const d = new Date(ev.start_time);
                            setCalYear(d.getFullYear());
                            setCalMonth(d.getMonth());
                          }}
                          className="p-2.5 rounded-xl border border-[var(--line)] bg-[var(--paper)] hover:border-blue-500/50 hover:bg-[var(--surface-hover)] transition-all cursor-pointer flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-sm shrink-0">{isHol ? '🇮🇳' : '📌'}</span>
                            <div className="truncate">
                              <div className="text-xs font-bold text-[var(--ink)] truncate">{ev.title}</div>
                              <div className="text-[10px] text-[var(--muted)]">{conf.label}</div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-[11px] font-extrabold text-[var(--ink)]">{dateFormatted}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Bottom Quick Action Note */}
              <div className="pt-2 text-[10px] text-[var(--muted)] flex items-center justify-between border-t border-[var(--line)]/50">
                <span>Auto-refreshed with Indian Gazetted Calendar</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">Cruvels 2026</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SCHEDULE EVENT MODAL */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4 animate-in fade-in duration-200"
          style={{ background: 'rgba(18,32,42,0.65)' }}
        >
          <div
            className="w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
            style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <CalendarIcon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--ink)]">
                    Schedule Operational Event / Meeting
                  </h3>
                  <p className="text-[11px] text-[var(--muted)]">Syncs across all squad members and calendars</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-500">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-semibold mb-1 text-[var(--muted)]">
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Core Squad Standup or Product RFC Review"
                  className="w-full rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold mb-1 text-[var(--muted)]">
                    Category *
                  </label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value as any)}
                    className="w-full rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                  >
                    <option value="meeting">Meeting (Video/In-Person)</option>
                    <option value="company_event">Company Event</option>
                    <option value="holiday">Public Holiday</option>
                    <option value="deadline">Milestone / Due Date</option>
                    <option value="reminder">Personal Reminder</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1 text-[var(--muted)]">
                    Location / Room
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Google Meet or Room 402"
                    className="w-full rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold mb-1 text-[var(--muted)]">
                    Start Date &amp; Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1 text-[var(--muted)]">
                    End Date &amp; Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-[var(--muted)]">
                    Video Meeting URL
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const rand = Math.random().toString(36).substring(2, 6);
                      const rand2 = Math.random().toString(36).substring(2, 5);
                      setMeetingLink(`https://meet.google.com/cru-${rand}-${rand2}`);
                    }}
                    className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    + Auto-generate Google Meet
                  </button>
                </div>
                <input
                  type="url"
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  placeholder="https://meet.google.com/xyz-abc or Zoom link"
                  className="w-full rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1 text-[var(--muted)]">
                  Description / Agenda
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Discussion points, deliverables, attendees..."
                  className="w-full rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all leading-relaxed"
                  style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)', resize: 'none' }}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="glow-btn-primary rounded-xl px-5 py-2 text-xs font-bold text-white shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Scheduling...' : 'Schedule Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
