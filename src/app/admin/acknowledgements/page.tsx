'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import AdminNavRail from '@/components/admin/AdminNavRail';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  Users,
  Search,
  Filter,
  ArrowLeft,
  RefreshCw,
  FileText,
  CheckSquare,
  Building2,
  ExternalLink,
  Sparkles,
  Megaphone,
  Check,
} from 'lucide-react';
import { AcknowledgementSummary } from '@/lib/db/types';

interface GlobalMetrics {
  totalRequirements: number;
  totalRecipients: number;
  acknowledgedCount: number;
  pendingCount: number;
  overdueCount: number;
  complianceRate: number;
  items: Array<{
    itemId: string;
    itemType: string;
    itemTitle: string;
    total: number;
    acknowledged: number;
    pending: number;
    overdue: number;
    rate: number;
    dueAt?: string;
  }>;
}

export default function AdminAcknowledgementsPage() {
  const [metrics, setMetrics] = useState<GlobalMetrics | null>(null);
  const [selectedItem, setSelectedItem] = useState<{ itemType: string; itemId: string } | null>(null);
  const [itemSummary, setItemSummary] = useState<AcknowledgementSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [itemLoading, setItemLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'ACKNOWLEDGED' | 'OVERDUE'>('ALL');
  const [reminding, setReminding] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadGlobalMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/acknowledgements');
      const data = await res.json();
      if (data.success && data.metrics) {
        setMetrics(data.metrics);
        if (data.metrics.items.length > 0 && !selectedItem) {
          setSelectedItem({
            itemType: data.metrics.items[0].itemType,
            itemId: data.metrics.items[0].itemId,
          });
        }
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Failed to load acknowledgement metrics.' });
    } finally {
      setLoading(false);
    }
  }, [selectedItem]);

  const loadItemDetail = useCallback(async (itemType: string, itemId: string) => {
    setItemLoading(true);
    try {
      const res = await fetch(`/api/admin/acknowledgements?itemType=${itemType}&itemId=${itemId}`);
      const data = await res.json();
      if (data.success && data.summary) {
        setItemSummary(data.summary);
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Failed to load item drilldown.' });
    } finally {
      setItemLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGlobalMetrics();
  }, [loadGlobalMetrics]);

  useEffect(() => {
    if (selectedItem) {
      loadItemDetail(selectedItem.itemType, selectedItem.itemId);
    }
  }, [selectedItem, loadItemDetail]);

  const handleDispatchReminders = async () => {
    if (!selectedItem) {
      setFeedbackMsg({ type: 'error', text: 'Select an acknowledgement requirement first.' });
      return;
    }
    setReminding(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch('/api/acknowledgements/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType: selectedItem.itemType,
          itemId: selectedItem.itemId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedbackMsg({
          type: 'success',
          text: `Escalation reminder dispatched to ${data.dispatchedTo?.length || 0} pending recipient(s).`,
        });
        loadItemDetail(selectedItem.itemType, selectedItem.itemId);
        loadGlobalMetrics();
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Failed to dispatch reminders.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Network error while dispatching reminders.' });
    } finally {
      setReminding(false);
    }
  };

  const filteredRecipients = (itemSummary?.recipients || []).filter((r) => {
    if (statusFilter === 'PENDING' && r.status !== 'pending') return false;
    if (statusFilter === 'ACKNOWLEDGED' && r.status !== 'acknowledged') return false;
    if (statusFilter === 'OVERDUE' && r.status !== 'overdue') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q) ||
        r.departmentName.toLowerCase().includes(q) ||
        (r.groupName && r.groupName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Dedicated 10-Section Navigation Rail */}
        <AdminNavRail currentTab="acknowledgements" />

        {/* Executive Header Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-2xl p-6 sm:p-7 text-white shadow-xl border border-indigo-900/40">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1 text-xs font-semibold backdrop-blur-md">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
              <span>Universal Compliance Engine</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              Universal Acknowledgement Operations
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Real-time compliance tracking, recipient roster audits, and automated escalation reminders across all corporate policies, notices, and task assignments.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={() => {
                loadGlobalMetrics();
                if (selectedItem) loadItemDetail(selectedItem.itemType, selectedItem.itemId);
              }}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition border border-white/15"
              title="Refresh compliance telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleDispatchReminders}
              disabled={Boolean(reminding || !selectedItem || (itemSummary?.pendingCount === 0 && itemSummary?.overdueCount === 0))}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Send className={`w-3.5 h-3.5 ${reminding ? 'animate-pulse' : ''}`} />
              <span>{reminding ? 'Dispatching...' : 'Dispatch Reminders'}</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div
            className={`p-4 rounded-xl text-xs font-medium border flex items-center justify-between shadow-sm animate-in fade-in ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedbackMsg.text}</span>
            </div>
            <button onClick={() => setFeedbackMsg(null)} className="text-muted hover:text-ink text-sm">
              ✕
            </button>
          </div>
        )}

        {/* High-Level Metric Tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
          <div className="p-4 sm:p-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider">
                Total Tracked
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black mt-2 text-[var(--ink)]">
              {metrics ? metrics.totalRecipients : '0'}
            </div>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">Across {metrics?.totalRequirements || 0} items</p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Acknowledged
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black mt-2 text-emerald-600 dark:text-emerald-400">
              {metrics ? metrics.acknowledgedCount : '0'}
            </div>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">
              {metrics && metrics.totalRecipients > 0
                ? `${Math.round((metrics.acknowledgedCount / metrics.totalRecipients) * 100)}% compliance`
                : '100%'}
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                Pending
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black mt-2 text-amber-600 dark:text-amber-400">
              {metrics ? metrics.pendingCount : '0'}
            </div>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">Within deadline</p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                Overdue
              </span>
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black mt-2 text-rose-600 dark:text-rose-400">
              {metrics ? metrics.overdueCount : '0'}
            </div>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">Deadline passed</p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-xs col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[var(--ink)] uppercase tracking-wider">
                Compliance Rate
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black mt-2 text-[var(--ink)]">
              {metrics ? `${metrics.complianceRate}%` : '100%'}
            </div>
            <div className="w-full bg-[var(--line)] rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${metrics?.complianceRate ?? 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Main Two-Column Console */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Active Requirements Catalog (4 Cols) */}
          <div className="lg:col-span-4 border border-[var(--line)] rounded-2xl bg-[var(--surface)] p-4 sm:p-5 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <h3 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Mandatory Items</span>
              </h3>
              <span className="text-xs font-mono text-[var(--muted)] bg-[var(--paper)] px-2 py-0.5 rounded-md border border-[var(--line)]">
                {metrics?.items.length || 0} active
              </span>
            </div>

            <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
              {metrics && metrics.items.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-[var(--surface-sunken)] border border-[var(--line)] space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-500/20">
                    <CheckSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[var(--ink)]">All Mandates Compliant</h4>
                    <p className="text-[11px] text-[var(--muted)] mt-1 max-w-[220px] mx-auto leading-relaxed">
                      No pending acknowledgements required. Notices and company policies are fully signed off.
                    </p>
                  </div>
                  <Link
                    href="/notices"
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline pt-1"
                  >
                    <Megaphone className="w-3.5 h-3.5" />
                    <span>Publish Company Notice</span>
                  </Link>
                </div>
              ) : (
                metrics?.items.map((item) => {
                  const isSelected =
                    selectedItem?.itemId === item.itemId && selectedItem?.itemType === item.itemType;
                  return (
                    <div
                      key={`${item.itemType}-${item.itemId}`}
                      onClick={() => setSelectedItem({ itemType: item.itemType, itemId: item.itemId })}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500/10 shadow-xs'
                          : 'border-[var(--line)] hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-[var(--surface-sunken)] text-[var(--muted)] border border-[var(--line)]">
                              {item.itemType}
                            </span>
                            {item.dueAt && (
                              <span className="text-[10px] text-[var(--muted)] font-mono">
                                Due: {new Date(item.dueAt).toLocaleDateString('en-GB')}
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-[var(--ink)] mt-1.5 line-clamp-2">
                            {item.itemTitle}
                          </h4>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            item.rate >= 80
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : item.rate >= 50
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {item.rate}%
                        </span>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-[var(--muted)] border-t border-[var(--line)] pt-2">
                        <span>
                          {item.acknowledged} / {item.total} acknowledged
                        </span>
                        {item.overdue > 0 && (
                          <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {item.overdue} overdue
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Recipient Audit Breakdown Table (8 Cols) */}
          <div className="lg:col-span-8 border border-[var(--line)] rounded-2xl bg-[var(--surface)] p-4 sm:p-6 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-blue-500/10 text-blue-600 border border-blue-500/20">
                    {itemSummary?.itemType || 'Status'}
                  </span>
                  <h3 className="text-base font-bold text-[var(--ink)]">
                    {itemSummary?.itemTitle || 'Acknowledgement Roster'}
                  </h3>
                </div>
                <p className="text-xs text-[var(--muted)] mt-1">
                  Recipient compliance roster with cryptographic audit verification and completion timestamps.
                </p>
              </div>

              {itemSummary && (
                <div className="flex items-center gap-2 bg-[var(--surface-sunken)] px-3 py-1.5 rounded-xl border border-[var(--line)]">
                  <span className="text-xs font-medium text-[var(--muted)]">
                    Progress:{' '}
                    <strong className="text-[var(--ink)] font-bold">
                      {itemSummary.acknowledgedCount}/{itemSummary.totalRecipients} ({itemSummary.complianceRate}%)
                    </strong>
                  </span>
                </div>
              )}
            </div>

            {/* Table Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search recipient, squad, or role..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <Filter className="w-3.5 h-3.5 text-[var(--muted)] mr-1" />
                {(['ALL', 'PENDING', 'OVERDUE', 'ACKNOWLEDGED'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      statusFilter === filter
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'border border-[var(--line)] bg-[var(--paper)] text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Roster Table / Card View */}
            <div className="border border-[var(--line)] rounded-xl overflow-hidden bg-[var(--paper)]">
              {/* Mobile Card View (< md) */}
              <div className="md:hidden divide-y divide-[var(--line)]">
                {itemLoading ? (
                  <div className="p-8 text-center text-xs text-[var(--muted)]">
                    Loading recipient roster...
                  </div>
                ) : filteredRecipients.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[var(--muted)]">
                    {metrics && metrics.items.length === 0
                      ? 'No pending recipients. All requirements fulfilled.'
                      : 'No recipients match the selected filters.'}
                  </div>
                ) : (
                  filteredRecipients.map((rec) => (
                    <div key={rec.id} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-[var(--ink)] text-sm">{rec.name}</div>
                          <div className="text-xs text-[var(--muted)] capitalize">{rec.role}</div>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0 ${
                            rec.status === 'acknowledged'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : rec.status === 'overdue'
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold animate-pulse'
                              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {rec.status === 'acknowledged' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : rec.status === 'overdue' ? (
                            <AlertTriangle className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          <span className="capitalize">{rec.status}</span>
                        </span>
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {rec.departmentName} {rec.groupName ? `• ${rec.groupName}` : ''}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Table View (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--surface-sunken)] border-b border-[var(--line)] text-[var(--muted)] font-bold">
                    <tr>
                      <th className="p-3.5">Recipient</th>
                      <th className="p-3.5">Department & Squad</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Due Date</th>
                      <th className="p-3.5">Acknowledged On</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {itemLoading ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-[var(--muted)]">
                          Loading recipient roster...
                        </td>
                      </tr>
                    ) : filteredRecipients.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-10 text-center text-[var(--muted)]">
                          {metrics && metrics.items.length === 0 ? (
                            <div className="space-y-1.5">
                              <p className="font-semibold text-[var(--ink)]">Zero Pending Acknowledgements</p>
                              <p className="text-xs text-[var(--muted)]">
                                When a mandatory notice or task requiring sign-off is assigned, staff rosters will populate here with cryptographic verification timestamps.
                              </p>
                            </div>
                          ) : (
                            'No recipients match the selected filters.'
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredRecipients.map((rec) => (
                        <tr key={rec.id} className="hover:bg-[var(--surface-hover)] transition">
                          <td className="p-3.5">
                            <div className="font-bold text-[var(--ink)]">{rec.name}</div>
                            <div className="text-[11px] text-[var(--muted)] capitalize">{rec.role}</div>
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5 text-[var(--ink)] font-medium">
                              <Building2 className="w-3.5 h-3.5 text-[var(--muted)]" />
                              <span>{rec.departmentName}</span>
                            </div>
                            {rec.groupName && (
                              <div className="text-[11px] text-[var(--muted)] font-medium pl-5">
                                {rec.groupName}
                              </div>
                            )}
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                                rec.status === 'acknowledged'
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  : rec.status === 'overdue'
                                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold animate-pulse'
                                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {rec.status === 'acknowledged' ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              ) : rec.status === 'overdue' ? (
                                <AlertTriangle className="w-3.5 h-3.5" />
                              ) : (
                                <Clock className="w-3.5 h-3.5" />
                              )}
                              <span className="capitalize">{rec.status}</span>
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-[var(--muted)]">
                            {rec.dueAt ? new Date(rec.dueAt).toLocaleDateString('en-GB') : 'No deadline'}
                          </td>
                          <td className="p-3.5 font-mono text-[var(--muted)]">
                            {rec.acknowledgedAt ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                {new Date(rec.acknowledgedAt).toLocaleString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            ) : (
                              <span className="text-[var(--muted)]/70 italic">Pending confirmation</span>
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
        </div>
      </div>
    </AppShell>
  );
}
