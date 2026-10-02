'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
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
} from 'lucide-react';
import AdminNavRail from '@/components/admin/AdminNavRail';
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
    if (reminding) return;
    setReminding(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch('/api/acknowledgements/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedItem ? { itemType: selectedItem.itemType, itemId: selectedItem.itemId } : {}),
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackMsg({ type: 'success', text: data.message || `Reminders dispatched successfully!` });
        loadGlobalMetrics();
        if (selectedItem) loadItemDetail(selectedItem.itemType, selectedItem.itemId);
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Failed to dispatch reminders.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Failed to send reminders.' });
    } finally {
      setReminding(false);
    }
  };

  const filteredRecipients = (itemSummary?.recipients || []).filter((r) => {
    if (statusFilter !== 'ALL' && r.status.toUpperCase() !== statusFilter) {
      return false;
    }
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
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Dedicated 10-Section Navigation Rail (Roadmap § 14) */}
      <AdminNavRail currentTab="acknowledgements" />

      {/* Header & Back Nav */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Admin Console</span>
            </Link>
            <span className="text-muted-foreground text-xs">/</span>
            <span className="text-xs text-primary-600 font-semibold">Acknowledgements</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary-600" />
            <span>Universal Acknowledgement Operations</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Real-time compliance tracking, recipient roster audits, and automated escalation reminders across all modules.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              loadGlobalMetrics();
              if (selectedItem) loadItemDetail(selectedItem.itemType, selectedItem.itemId);
            }}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border bg-card text-xs font-semibold hover:bg-muted transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleDispatchReminders}
            disabled={Boolean(reminding || (selectedItem && itemSummary?.pendingCount === 0 && itemSummary?.overdueCount === 0))}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold shadow transition disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{reminding ? 'Dispatching...' : 'Dispatch Reminders'}</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-lg text-xs font-medium border flex items-center justify-between ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
      )}

      {/* High-Level Metric Tiles (§ 6) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Tracked
            </span>
            <Users className="w-4 h-4 text-primary-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-foreground">
            {metrics ? metrics.totalRecipients : '...'}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Across {metrics?.totalRequirements || 0} items</p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Acknowledged
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-emerald-600 dark:text-emerald-400">
            {metrics ? metrics.acknowledgedCount : '...'}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {metrics && metrics.totalRecipients > 0
              ? `${Math.round((metrics.acknowledgedCount / metrics.totalRecipients) * 100)}% compliance`
              : '100%'}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Pending
            </span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-amber-600 dark:text-amber-400">
            {metrics ? metrics.pendingCount : '...'}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Within deadline</p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
              Overdue
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-rose-600 dark:text-rose-400">
            {metrics ? metrics.overdueCount : '...'}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Deadline passed</p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Compliance Rate
            </span>
            <ShieldCheck className="w-4 h-4 text-primary-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-foreground">
            {metrics ? `${metrics.complianceRate}%` : '...'}
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all"
              style={{ width: `${metrics?.complianceRate || 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Two-Column Console (§ 6) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Active Requirements Catalog (4 Cols) */}
        <div className="lg:col-span-4 border border-border rounded-xl bg-card p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary-600" />
              <span>Mandatory Items</span>
            </h3>
            <span className="text-xs font-mono text-muted-foreground">
              {metrics?.items.length || 0} active
            </span>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {metrics && metrics.items.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No active acknowledgement requirements recorded.
              </div>
            ) : (
              metrics?.items.map((item) => {
                const isSelected =
                  selectedItem?.itemId === item.itemId && selectedItem?.itemType === item.itemType;
                return (
                  <div
                    key={`${item.itemType}-${item.itemId}`}
                    onClick={() => setSelectedItem({ itemType: item.itemType, itemId: item.itemId })}
                    className={`p-3 rounded-lg border cursor-pointer transition ${
                      isSelected
                        ? 'border-primary-500 bg-primary-500/10 shadow-sm'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-muted text-muted-foreground">
                            {item.itemType}
                          </span>
                          {item.dueAt && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              Due: {new Date(item.dueAt).toLocaleDateString('en-GB')}
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-semibold text-foreground mt-1 line-clamp-2">
                          {item.itemTitle}
                        </h4>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
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

                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/60 pt-2">
                      <span>
                        {item.acknowledged} / {item.total} acknowledged
                      </span>
                      {item.overdue > 0 && (
                        <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
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
        <div className="lg:col-span-8 border border-border rounded-xl bg-card p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-semibold uppercase bg-primary-500/15 text-primary-600">
                  {itemSummary?.itemType || 'Item'}
                </span>
                <h3 className="text-base font-semibold text-foreground">
                  {itemSummary?.itemTitle || 'Select an item from the left'}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Recipient compliance roster with cryptographic audit verification and completion timestamps.
              </p>
            </div>

            {itemSummary && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Progress:{' '}
                  <strong className="text-foreground">
                    {itemSummary.acknowledgedCount}/{itemSummary.totalRecipients} ({itemSummary.complianceRate}%)
                  </strong>
                </span>
              </div>
            )}
          </div>

          {/* Table Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search recipient, squad, or role..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              {(['ALL', 'PENDING', 'OVERDUE', 'ACKNOWLEDGED'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    statusFilter === filter
                      ? 'bg-primary-600 text-white'
                      : 'border border-border bg-card text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Roster Table / Card View */}
          <div className="border border-border rounded-lg overflow-hidden">
            {/* Mobile Card View (< md) */}
            <div className="md:hidden divide-y divide-border">
              {itemLoading ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Loading recipient roster...
                </div>
              ) : filteredRecipients.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No recipients match the selected filters.
                </div>
              ) : (
                filteredRecipients.map((rec) => (
                  <div key={rec.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-foreground text-sm">{rec.name}</div>
                        <div className="text-xs text-muted-foreground capitalize">{rec.role}</div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 ${
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

                    <div className="flex items-center gap-1.5 text-xs text-foreground">
                      <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span>{rec.departmentName}</span>
                      {rec.groupName && (
                        <span className="text-muted-foreground font-medium">• {rec.groupName}</span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-border/60 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground">Due Date:</span>
                        <div className="font-mono text-muted-foreground mt-0.5">
                          {rec.dueAt ? new Date(rec.dueAt).toLocaleDateString('en-GB') : 'No deadline'}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground">Acknowledged:</span>
                        <div className="font-mono text-xs mt-0.5">
                          {rec.acknowledgedAt ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              {new Date(rec.acknowledgedAt).toLocaleString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 italic text-[11px]">Pending confirmation</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th className="p-3">Recipient</th>
                    <th className="p-3">Department & Squad</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Due Date</th>
                    <th className="p-3">Acknowledged On</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {itemLoading ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        Loading recipient roster...
                      </td>
                    </tr>
                  ) : filteredRecipients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        No recipients match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredRecipients.map((rec) => (
                      <tr key={rec.id} className="hover:bg-muted/30 transition">
                        <td className="p-3">
                          <div className="font-semibold text-foreground">{rec.name}</div>
                          <div className="text-[11px] text-muted-foreground capitalize">{rec.role}</div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5 text-foreground">
                            <Building2 className="w-3 h-3 text-muted-foreground" />
                            <span>{rec.departmentName}</span>
                          </div>
                          {rec.groupName && (
                            <div className="text-[11px] text-muted-foreground font-medium pl-4.5">
                              {rec.groupName}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold ${
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
                        </td>
                        <td className="p-3 font-mono text-muted-foreground">
                          {rec.dueAt ? new Date(rec.dueAt).toLocaleDateString('en-GB') : 'No deadline'}
                        </td>
                        <td className="p-3 font-mono text-muted-foreground">
                          {rec.acknowledgedAt ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              {new Date(rec.acknowledgedAt).toLocaleString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 italic">Pending confirmation</span>
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
  );
}
