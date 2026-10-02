'use client';

import React, { useEffect, useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import AdminNavRail from '@/components/admin/AdminNavRail';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Users,
  Search,
  RefreshCw,
  Filter,
  Check,
  X,
  FilePenLine,
  Sliders,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Sparkles,
  Send,
} from 'lucide-react';
import {
  AttendanceComplianceSummary,
  AttendanceCorrectionRequest,
  IndividualComplianceRecord,
} from '@/lib/db/types';
import { TeamComplianceSummary, EmployeeDailyComplianceDetail } from '@/lib/services/compliance-service';
import { getIndianDateString } from '@/lib/utils/date';
import Link from 'next/link';

export default function AdminAttendanceCompliancePage() {
  const today = getIndianDateString();
  const [selectedDate, setSelectedDate] = useState(today);
  const [summary, setSummary] = useState<AttendanceComplianceSummary | null>(null);
  const [teams, setTeams] = useState<TeamComplianceSummary[]>([]);
  const [details, setDetails] = useState<EmployeeDailyComplianceDetail[]>([]);
  const [pendingCorrections, setPendingCorrections] = useState<AttendanceCorrectionRequest[]>([]);
  const [isWorkingDay, setIsWorkingDay] = useState(true);
  const [isHoliday, setIsHoliday] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [sendingReminders, setSendingReminders] = useState(false);

  // Active view tab: 'roster' | 'teams' | 'history' | 'corrections'
  const [activeTab, setActiveTab] = useState<'roster' | 'teams' | 'history' | 'corrections'>('roster');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Individual Drilldown State (§ 2.1)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(today.substring(0, 7));
  const [individualHistory, setIndividualHistory] = useState<IndividualComplianceRecord | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Correction Review Modal State (§ 3)
  const [reviewingCorrection, setReviewingCorrection] = useState<AttendanceCorrectionRequest | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [reviewNotes, setReviewNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchComplianceData = async (dateStr = selectedDate) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/compliance?date=${dateStr}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setSummary(data.summary);
        setTeams(data.teams || []);
        setDetails(data.details || []);
        setPendingCorrections(data.pendingCorrections || []);
        setIsWorkingDay(data.isWorkingDay);
        setIsHoliday(data.isHoliday);
      } else {
        setError(data.error || 'Failed to load compliance metrics.');
      }
    } catch {
      setError('Network error loading compliance data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplianceData(selectedDate);
  }, [selectedDate]);

  const fetchIndividualHistory = async (empId: string, monthStr: string) => {
    if (!empId) return;
    try {
      setHistoryLoading(true);
      const res = await fetch(`/api/admin/compliance?employeeId=${empId}&month=${monthStr}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setIndividualHistory(data.history);
      }
    } catch {
      // silently handle
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleReviewCorrection = async () => {
    if (!reviewingCorrection) return;
    try {
      setSubmittingReview(true);
      const res = await fetch(`/api/attendance/corrections/${reviewingCorrection.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: reviewStatus,
          review_notes: reviewNotes,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification(`Attendance correction ${reviewStatus.toLowerCase()} successfully.`);
        setReviewingCorrection(null);
        setReviewNotes('');
        fetchComplianceData();
        setTimeout(() => setNotification(null), 4000);
      } else {
        setError(data.error || 'Failed to submit review.');
      }
    } catch {
      setError('Network error while processing review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDispatchReminders = async () => {
    try {
      setSendingReminders(true);
      setError(null);
      setNotification(null);
      const res = await fetch('/api/compliance/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetDate: selectedDate,
          forceSend: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification(
          `Dispatched ${data.result?.remindersSent || 0} attendance reminder email(s) & notification(s) for ${selectedDate}.`
        );
        fetchComplianceData();
      } else {
        setError(data.error || 'Failed to dispatch compliance reminders.');
      }
    } catch {
      setError('Network error while dispatching attendance reminders.');
    } finally {
      setSendingReminders(false);
    }
  };

  const filteredDetails = details.filter((d) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = d.employeeName.toLowerCase().includes(q);
      const matchDept = d.departmentName.toLowerCase().includes(q);
      const matchGroup = d.groupName?.toLowerCase().includes(q) || false;
      if (!matchName && !matchDept && !matchGroup) return false;
    }
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'LATE' && d.status !== 'MARKED_LATE') return false;
      if (statusFilter === 'MISSING' && d.status !== 'NOT_MARKED') return false;
      if (statusFilter === 'PRESENT' && d.status !== 'MARKED_PRESENT') return false;
      if (statusFilter === 'LEAVE' && d.status !== 'ON_LEAVE') return false;
    }
    return true;
  });

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Dedicated 10-Section Navigation Rail (Roadmap § 14) */}
        <AdminNavRail currentTab="compliance" />

        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-2xl p-6 sm:p-7 text-white shadow-xl border border-indigo-900/40">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1 text-xs font-semibold backdrop-blur-md">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
              <span>Cruvels Compliance Engine</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              Attendance Compliance & Governance
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl">
              Live automated compliance tracking, deadline enforcement, squad-level reporting, and correction workflow under enterprise policies.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-white/10 hover:bg-white/15 border border-white/20 text-white rounded-lg px-3 py-1.5 text-xs font-semibold transition-all focus:outline-none"
            />
            <button
              onClick={() => fetchComplianceData()}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
              title="Refresh telemetry"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleDispatchReminders}
              disabled={sendingReminders}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all shadow-sm disabled:opacity-50"
              title="Dispatch attendance reminder emails and system notifications"
            >
              <Send className={`h-3.5 w-3.5 ${sendingReminders ? 'animate-pulse' : ''}`} />
              <span>{sendingReminders ? 'Sending...' : 'Send Reminders'}</span>
            </button>
            <Link
              href="/admin/settings"
              className="btn-primary text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Rules Config</span>
            </Link>
          </div>
        </div>

        {/* Notifications */}
        {notification && (
          <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 shadow-sm animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-bold">{notification}</span>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 shadow-sm animate-in fade-in">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span className="font-bold">{error}</span>
          </div>
        )}

        {/* Top Summary Metrics Cards (§ 2) */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="rounded-xl p-4 space-y-1.5" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                Present (Office / WFH)
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {summary.present_count}
                </span>
                <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                  of {summary.total_active_employees}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.round((summary.present_count / Math.max(1, summary.total_active_employees)) * 100))}%` }}
                />
              </div>
            </div>

            <div className="rounded-xl p-4 space-y-1.5" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                Not Marked / Missing
              </span>
              <div className="flex items-baseline justify-between">
                <span className={`text-2xl font-black font-mono ${summary.not_marked_count > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'}`}>
                  {summary.not_marked_count}
                </span>
                <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                  Action Needed
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.round((summary.not_marked_count / Math.max(1, summary.total_active_employees)) * 100))}%` }}
                />
              </div>
            </div>

            <div className="rounded-xl p-4 space-y-1.5" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                Marked Late
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                  {summary.late_count}
                </span>
                <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                  Past Deadline
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.round((summary.late_count / Math.max(1, summary.total_active_employees)) * 100))}%` }}
                />
              </div>
            </div>

            <div className="rounded-xl p-4 space-y-1.5" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                Compliance Score
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                  {summary.compliance_percentage}%
                </span>
                <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                  {summary.pending_corrections_count} Pending Review
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all"
                  style={{ width: `${summary.compliance_percentage}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3" style={{ borderColor: 'var(--line)' }}>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('roster')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'roster'
                  ? 'btn-primary'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Daily Roster ({details.length})
            </button>

            <button
              onClick={() => setActiveTab('teams')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'teams'
                  ? 'btn-primary'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Team & Squad Scoping ({teams.length})
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'history'
                  ? 'btn-primary'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Individual History (§ 2.1)
            </button>

            <button
              onClick={() => setActiveTab('corrections')}
              className={`relative px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'corrections'
                  ? 'btn-primary'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Correction Queue
              {pendingCorrections.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black">
                  {pendingCorrections.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* TAB 1: DAILY ROSTER */}
        {activeTab === 'roster' && (
          <div className="space-y-4">
            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5" style={{ color: 'var(--muted)' }} />
                <input
                  type="text"
                  placeholder="Search employee, squad, dept..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs focus:outline-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                />
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                {['ALL', 'PRESENT', 'LATE', 'MISSING', 'LEAVE'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all whitespace-nowrap ${
                      statusFilter === filter
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Roster Table / Card layout */}
            {/* Roster Table / Card layout */}
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
              {/* Mobile Card View (< md) */}
              <div className="md:hidden divide-y" style={{ borderColor: 'var(--line-soft)' }}>
                {filteredDetails.length === 0 ? (
                  <div className="py-8 text-center text-xs p-4" style={{ color: 'var(--muted)' }}>
                    No employee records match the selected filter for {selectedDate}.
                  </div>
                ) : (
                  filteredDetails.map((detail) => (
                    <div key={detail.employeeId} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-sm" style={{ color: 'var(--ink)' }}>
                            {detail.employeeName}
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                            <span>{detail.departmentName}</span>
                            {detail.groupName && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {detail.groupName}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="font-mono text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                          {detail.punchTime || '—'}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div>
                          {detail.status === 'MARKED_PRESENT' && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="h-3 w-3" /> Present (Compliant)
                            </span>
                          )}
                          {detail.status === 'MARKED_LATE' && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              <Clock className="h-3 w-3" /> Marked Late
                            </span>
                          )}
                          {detail.status === 'NOT_MARKED' && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                              <AlertTriangle className="h-3 w-3" /> Not Marked
                            </span>
                          )}
                          {detail.status === 'ON_LEAVE' && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              <Calendar className="h-3 w-3" /> Approved Leave
                            </span>
                          )}
                          {detail.status === 'CORRECTION_PENDING' && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              <FilePenLine className="h-3 w-3" /> Correction Pending
                            </span>
                          )}
                          {detail.status === 'HOLIDAY' && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200">
                              Non-Working / Holiday
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            setSelectedEmployeeId(detail.employeeId);
                            setActiveTab('history');
                            fetchIndividualHistory(detail.employeeId, selectedMonth);
                          }}
                          className="min-h-[44px] px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50/50 text-blue-600 hover:text-blue-700 dark:text-blue-400 font-bold text-xs"
                        >
                          History &rarr;
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Table View (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--line)' }}>
                      <th className="py-3 px-4 font-bold" style={{ color: 'var(--muted)' }}>Employee</th>
                      <th className="py-3 px-4 font-bold" style={{ color: 'var(--muted)' }}>Department / Squad</th>
                      <th className="py-3 px-4 font-bold" style={{ color: 'var(--muted)' }}>Compliance Status</th>
                      <th className="py-3 px-4 font-bold" style={{ color: 'var(--muted)' }}>Punch Time</th>
                      <th className="py-3 px-4 font-bold text-right" style={{ color: 'var(--muted)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--line-soft)' }}>
                    {filteredDetails.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center" style={{ color: 'var(--muted)' }}>
                          No employee records match the selected filter for {selectedDate}.
                        </td>
                      </tr>
                    ) : (
                      filteredDetails.map((detail) => (
                        <tr key={detail.employeeId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 font-bold" style={{ color: 'var(--ink)' }}>
                            {detail.employeeName}
                          </td>
                          <td className="py-3 px-4" style={{ color: 'var(--ink-2)' }}>
                            <span>{detail.departmentName}</span>
                            {detail.groupName && (
                              <span className="ml-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {detail.groupName}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {detail.status === 'MARKED_PRESENT' && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <CheckCircle2 className="h-3 w-3" /> Present (Compliant)
                              </span>
                            )}
                            {detail.status === 'MARKED_LATE' && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                <Clock className="h-3 w-3" /> Marked Late
                              </span>
                            )}
                            {detail.status === 'NOT_MARKED' && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                <AlertTriangle className="h-3 w-3" /> Not Marked
                              </span>
                            )}
                            {detail.status === 'ON_LEAVE' && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                <Calendar className="h-3 w-3" /> Approved Leave
                              </span>
                            )}
                            {detail.status === 'CORRECTION_PENDING' && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                <FilePenLine className="h-3 w-3" /> Correction Pending
                              </span>
                            )}
                            {detail.status === 'HOLIDAY' && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200">
                                Non-Working / Holiday
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px]" style={{ color: 'var(--ink)' }}>
                            {detail.punchTime || '—'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedEmployeeId(detail.employeeId);
                                setActiveTab('history');
                                fetchIndividualHistory(detail.employeeId, selectedMonth);
                              }}
                              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-bold hover:underline"
                            >
                              History &rarr;
                            </button>
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

        {/* TAB 2: TEAM & SQUAD COMPLIANCE (§ 2.2) */}
        {activeTab === 'teams' && (
          <div className="space-y-4">
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Squad-level attendance breakdown for authorized POCs and Management.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.length === 0 ? (
                <div className="col-span-full py-8 text-center rounded-xl border border-dashed p-6" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
                  No squads configured or accessible.
                </div>
              ) : (
                teams.map((team) => (
                  <div
                    key={team.groupId}
                    className="rounded-xl p-5 space-y-3"
                    style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-sm" style={{ color: 'var(--ink)' }}>{team.groupName}</h3>
                        <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{team.departmentName}</span>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        {team.complianceRate}%
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center pt-2" style={{ borderTop: '1px solid var(--line-soft)' }}>
                      <div>
                        <span className="block text-[10px] font-bold uppercase" style={{ color: 'var(--muted)' }}>Total</span>
                        <span className="font-bold text-xs" style={{ color: 'var(--ink)' }}>{team.totalMembers}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold uppercase" style={{ color: 'var(--muted)' }}>Present</span>
                        <span className="font-bold text-xs text-emerald-600">{team.markedCount}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold uppercase" style={{ color: 'var(--muted)' }}>Late</span>
                        <span className="font-bold text-xs text-amber-600">{team.lateCount}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold uppercase" style={{ color: 'var(--muted)' }}>Missing</span>
                        <span className={`font-bold text-xs ${team.missingCount > 0 ? 'text-rose-600 font-extrabold' : 'text-slate-500'}`}>{team.missingCount}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: INDIVIDUAL COMPLIANCE HISTORY (§ 2.1) */}
        {activeTab === 'history' && (
          <div className="space-y-5">
            <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
              <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--ink)' }}>
                <TrendingUp className="h-4 w-4 text-blue-600" />
                Select Employee & Month for Compliance Telemetry
              </h3>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => {
                    setSelectedEmployeeId(e.target.value);
                    fetchIndividualHistory(e.target.value, selectedMonth);
                  }}
                  className="w-full sm:w-80 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                >
                  <option value="">-- Choose Employee --</option>
                  {details.map((d) => (
                    <option key={d.employeeId} value={d.employeeId}>
                      {d.employeeName} ({d.departmentName})
                    </option>
                  ))}
                </select>

                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    fetchIndividualHistory(selectedEmployeeId, e.target.value);
                  }}
                  className="rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                />
              </div>
            </div>

            {historyLoading && (
              <div className="p-8 text-center" style={{ color: 'var(--muted)' }}>
                Loading individual history...
              </div>
            )}

            {!historyLoading && individualHistory && (
              <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
                <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--line)' }}>
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>
                      {individualHistory.employee_name}
                    </h2>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      {individualHistory.department_name} • Squad: {individualHistory.group_name} • Month: {individualHistory.month}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black font-mono text-blue-600">
                      {individualHistory.compliance_rate}%
                    </span>
                    <span className="block text-[10px] uppercase font-bold" style={{ color: 'var(--muted)' }}>Monthly Compliance</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                  <div className="rounded-lg p-3 text-center bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                    <span className="block text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">Present</span>
                    <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400 font-mono">{individualHistory.present_days}</span>
                  </div>

                  <div className="rounded-lg p-3 text-center bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                    <span className="block text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase">Late</span>
                    <span className="text-xl font-bold text-amber-700 dark:text-amber-400 font-mono">{individualHistory.late_days}</span>
                  </div>

                  <div className="rounded-lg p-3 text-center bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                    <span className="block text-[10px] font-bold text-rose-800 dark:text-rose-300 uppercase">Missing</span>
                    <span className="text-xl font-bold text-rose-700 dark:text-rose-400 font-mono">{individualHistory.missing_days}</span>
                  </div>

                  <div className="rounded-lg p-3 text-center bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                    <span className="block text-[10px] font-bold text-blue-800 dark:text-blue-300 uppercase">Leave</span>
                    <span className="text-xl font-bold text-blue-700 dark:text-blue-400 font-mono">{individualHistory.leave_days}</span>
                  </div>

                  <div className="rounded-lg p-3 text-center bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800">
                    <span className="block text-[10px] font-bold text-purple-800 dark:text-purple-300 uppercase">Corrections</span>
                    <span className="text-xl font-bold text-purple-700 dark:text-purple-400 font-mono">{individualHistory.correction_count}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: CORRECTION QUEUE (§ 3) */}
        {activeTab === 'corrections' && (
          <div className="space-y-4">
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Review pending attendance correction requests submitted by workforce members. Approved requests atomically update attendance records and write immutable audit logs.
            </p>

            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
              {/* Mobile Card View (< md) */}
              <div className="md:hidden divide-y" style={{ borderColor: 'var(--line-soft)' }}>
                {pendingCorrections.length === 0 ? (
                  <div className="py-8 text-center text-xs p-4" style={{ color: 'var(--muted)' }}>
                    No pending attendance correction requests. All records are up to date.
                  </div>
                ) : (
                  pendingCorrections.map((cor) => (
                    <div key={cor.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-sm" style={{ color: 'var(--ink)' }}>
                            {cor.employee_name}
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                            {cor.department_name} {cor.group_name && `• ${cor.group_name}`}
                          </div>
                        </div>
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {cor.date}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-[10px] uppercase font-semibold text-slate-400">Change:</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {cor.current_status}
                        </span>
                        <span className="text-slate-400">&rarr;</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {cor.requested_status}
                        </span>
                      </div>

                      <div className="rounded-lg p-2 bg-slate-50 dark:bg-slate-800/50 text-xs italic" style={{ color: 'var(--ink)' }}>
                        &ldquo;{cor.reason}&rdquo;
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => {
                            setReviewingCorrection(cor);
                            setReviewStatus('APPROVED');
                          }}
                          className="flex-1 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <Check className="h-4 w-4" /> Approve
                        </button>
                        <button
                          onClick={() => {
                            setReviewingCorrection(cor);
                            setReviewStatus('REJECTED');
                          }}
                          className="flex-1 min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <X className="h-4 w-4" /> Reject
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Table View (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--line)' }}>
                      <th className="py-3 px-4 font-bold" style={{ color: 'var(--muted)' }}>Employee</th>
                      <th className="py-3 px-4 font-bold" style={{ color: 'var(--muted)' }}>Date</th>
                      <th className="py-3 px-4 font-bold" style={{ color: 'var(--muted)' }}>Current Status</th>
                      <th className="py-3 px-4 font-bold" style={{ color: 'var(--muted)' }}>Requested</th>
                      <th className="py-3 px-4 font-bold" style={{ color: 'var(--muted)' }}>Reason</th>
                      <th className="py-3 px-4 font-bold text-right" style={{ color: 'var(--muted)' }}>Review</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--line-soft)' }}>
                    {pendingCorrections.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center" style={{ color: 'var(--muted)' }}>
                          No pending attendance correction requests. All records are up to date.
                        </td>
                      </tr>
                    ) : (
                      pendingCorrections.map((cor) => (
                        <tr key={cor.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-3 px-4 font-bold" style={{ color: 'var(--ink)' }}>
                            {cor.employee_name}
                            <span className="block text-[10px] font-normal" style={{ color: 'var(--muted)' }}>
                              {cor.department_name} {cor.group_name && `• ${cor.group_name}`}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold" style={{ color: 'var(--ink)' }}>
                            {cor.date}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {cor.current_status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {cor.requested_status}
                            </span>
                          </td>
                          <td className="py-3 px-4 max-w-xs" style={{ color: 'var(--ink)' }}>
                            &ldquo;{cor.reason}&rdquo;
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setReviewingCorrection(cor);
                                  setReviewStatus('APPROVED');
                                }}
                                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] inline-flex items-center gap-1"
                              >
                                <Check className="h-3 w-3" /> Approve
                              </button>
                              <button
                                onClick={() => {
                                  setReviewingCorrection(cor);
                                  setReviewStatus('REJECTED');
                                }}
                                className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] inline-flex items-center gap-1"
                              >
                                <X className="h-3 w-3" /> Reject
                              </button>
                            </div>
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

        {/* Correction Review Modal Dialog (§ 3) */}
        {reviewingCorrection && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div
              className="w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl"
              style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
            >
              <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--line)' }}>
                <h3 className="font-bold text-sm" style={{ color: 'var(--ink)' }}>
                  Review Attendance Correction
                </h3>
                <button
                  onClick={() => setReviewingCorrection(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" style={{ color: 'var(--muted)' }} />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="font-semibold" style={{ color: 'var(--muted)' }}>Employee:</span>{' '}
                  <span className="font-bold" style={{ color: 'var(--ink)' }}>{reviewingCorrection.employee_name}</span>
                </div>
                <div>
                  <span className="font-semibold" style={{ color: 'var(--muted)' }}>Date:</span>{' '}
                  <span className="font-mono font-bold" style={{ color: 'var(--ink)' }}>{reviewingCorrection.date}</span>
                </div>
                <div>
                  <span className="font-semibold" style={{ color: 'var(--muted)' }}>Requested Change:</span>{' '}
                  <span className="font-bold text-rose-600">{reviewingCorrection.current_status}</span> &rarr;{' '}
                  <span className="font-bold text-emerald-600">{reviewingCorrection.requested_status}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border" style={{ borderColor: 'var(--line-soft)' }}>
                  <span className="font-semibold block text-[10px] uppercase mb-1" style={{ color: 'var(--muted)' }}>Reason:</span>
                  <p className="italic text-xs" style={{ color: 'var(--ink)' }}>&ldquo;{reviewingCorrection.reason}&rdquo;</p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--ink-2)' }}>
                    Action Decision:
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setReviewStatus('APPROVED')}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                        reviewStatus === 'APPROVED'
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      ✓ Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewStatus('REJECTED')}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                        reviewStatus === 'REJECTED'
                          ? 'bg-rose-600 text-white shadow-md'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      ✕ Reject
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--ink-2)' }}>
                    Review Notes / Feedback (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Enter review explanation or reason for rejection..."
                    className="w-full rounded-lg p-2.5 text-xs focus:outline-none"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t" style={{ borderColor: 'var(--line)' }}>
                <button
                  type="button"
                  onClick={() => setReviewingCorrection(null)}
                  className="btn-ghost text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submittingReview}
                  onClick={handleReviewCorrection}
                  className={`btn-primary text-xs font-bold ${
                    reviewStatus === 'REJECTED' ? 'bg-rose-600 hover:bg-rose-700' : ''
                  }`}
                >
                  {submittingReview ? 'Submitting...' : `Confirm ${reviewStatus}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
