'use client';

import React, { useEffect, useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import {
  CalendarDays,
  Plus,
  CheckCircle2,
  AlertCircle,
  Check,
  X,
  Award,
} from 'lucide-react';
import { LeaveRequest, LeaveBalances } from '@/lib/db/types';

export default function LeavesPage() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalances>({ casual: 12, sick: 10, annual: 15, unpaid: 0 });
  const [approvalQueue, setApprovalQueue] = useState<LeaveRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'my_leaves' | 'approvals'>('my_leaves');
  const [canApprove, setCanApprove] = useState(false);
  const [loading, setLoading] = useState(true);

  // Leave Form
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [leaveType, setLeaveType] = useState<'CASUAL' | 'SICK' | 'ANNUAL' | 'UNPAID'>('CASUAL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const fetchLeaves = async () => {
    try {
      const [leavesRes, userRes] = await Promise.all([
        fetch('/api/leaves'),
        fetch('/api/auth/me'),
      ]);

      if (leavesRes.ok) {
        const data = await leavesRes.json();
        setLeaves(data.leaves || []);
        if (data.balances) setBalances(data.balances);
      }

      if (userRes.ok) {
        const userData = await userRes.json();
        const role = userData.user?.role;
        // Check if admin, manager, team_lead, or group leader
        const approvalsRes = await fetch('/api/leaves/approvals');
        if (approvalsRes.ok) {
          const approvalsData = await approvalsRes.json();
          setApprovalQueue(approvalsData.leaves || []);
          if (role === 'admin' || role === 'manager' || role === 'team_lead' || approvalsData.leaves?.length > 0) {
            setCanApprove(true);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaveType,
          startDate,
          endDate,
          reason,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to submit leave request.');
      } else {
        setNotification('Leave request submitted successfully for approval!');
        setShowApplyModal(false);
        setReason('');
        fetchLeaves();
        setTimeout(() => setNotification(null), 4000);
      }
    } catch {
      setError('Network connection error.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelLeave = async (leaveId: string) => {
    if (!confirm('Cancel this leave request? Approved days will be restored to your balance.')) return;
    try {
      const res = await fetch('/api/leaves', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaveId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification('Leave request cancelled.');
        fetchLeaves();
        setTimeout(() => setNotification(null), 4000);
      } else {
        alert(data.error || 'Failed to cancel leave.');
      }
    } catch {
      alert('Failed to cancel leave.');
    }
  };

  const handleReviewLeave = async (leaveId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await fetch('/api/leaves/approvals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaveId, status }),
      });
      if (res.ok) {
        setNotification(`Leave request marked as ${status}.`);
        fetchLeaves();
        setTimeout(() => setNotification(null), 4000);
      }
    } catch {
      alert('Failed to update leave status.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <span className="rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-0.5 text-[10px] font-bold border border-emerald-200">APPROVED</span>;
      case 'REJECTED':
        return <span className="rounded-full bg-rose-50 text-rose-700 px-2.5 py-0.5 text-[10px] font-bold border border-rose-200">REJECTED</span>;
      case 'PENDING':
        return <span className="rounded-full bg-amber-50 text-amber-700 px-2.5 py-0.5 text-[10px] font-bold border border-amber-200">PENDING</span>;
      default:
        return <span className="rounded-full bg-slate-100 text-slate-700 px-2.5 py-0.5 text-[10px] font-bold border border-slate-200">{status}</span>;
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Time Off & Leave Management</h1>
              <p className="text-xs text-slate-500">Track leave balances, submit requests, and manage GL/Manager approvals</p>
            </div>
          </div>

          <button
            onClick={() => setShowApplyModal(true)}
            className="glow-btn-primary flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white tracking-wide shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Apply for Time Off</span>
          </button>
        </div>

        {/* Notifications */}
        {notification && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{notification}</span>
          </div>
        )}

        {/* Leave Balances Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-3xl bg-white p-5 border border-slate-200 shadow-sm space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Casual Leave</div>
            <div className="text-2xl font-extrabold text-blue-600">{balances.casual} Days</div>
            <div className="text-[10px] text-slate-400">Available balance</div>
          </div>
          <div className="rounded-3xl bg-white p-5 border border-slate-200 shadow-sm space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Sick Leave</div>
            <div className="text-2xl font-extrabold text-emerald-600">{balances.sick} Days</div>
            <div className="text-[10px] text-slate-400">Medical / Health</div>
          </div>
          <div className="rounded-3xl bg-white p-5 border border-slate-200 shadow-sm space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Annual Paid</div>
            <div className="text-2xl font-extrabold text-purple-600">{balances.annual} Days</div>
            <div className="text-[10px] text-slate-400">Earned vacation</div>
          </div>
          <div className="rounded-3xl bg-white p-5 border border-slate-200 shadow-sm space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Unpaid Leave</div>
            <div className="text-2xl font-extrabold text-slate-700">{balances.unpaid} Days</div>
            <div className="text-[10px] text-slate-400">Without pay</div>
          </div>
        </div>

        {/* Tabs for My Leaves vs Team Approvals Queue */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab('my_leaves')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'my_leaves'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            My Time Off History ({leaves.length})
          </button>

          {canApprove && (
            <button
              onClick={() => setActiveTab('approvals')}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'approvals'
                  ? 'bg-purple-50 text-purple-700 border border-purple-200 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span>Team Approval Queue (GL / Manager)</span>
              {approvalQueue.filter((l) => l.status === 'PENDING').length > 0 && (
                <span className="rounded-full bg-purple-600 text-white px-2 py-0.5 text-[10px]">
                  {approvalQueue.filter((l) => l.status === 'PENDING').length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Tab 1: My Leaves Table */}
        {activeTab === 'my_leaves' && (
          <div className="rounded-3xl bg-white p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">Leave Type</th>
                    <th className="px-5 py-3">Dates</th>
                    <th className="px-5 py-3">Duration</th>
                    <th className="px-5 py-3">Reason</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Applied On</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                  {leaves.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">
                        No leave requests submitted yet.
                      </td>
                    </tr>
                  ) : (
                    leaves.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-slate-900">{l.leave_type}</td>
                        <td className="px-5 py-3.5 font-mono text-[11px]">
                          {l.start_date} → {l.end_date}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-900">{l.days_count} Days</td>
                        <td className="px-5 py-3.5 max-w-xs truncate text-slate-600">{l.reason}</td>
                        <td className="px-5 py-3.5">{getStatusBadge(l.status)}</td>
                        <td className="px-5 py-3.5 text-slate-400">
                          {new Date(l.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {(l.status === 'PENDING' || l.status === 'APPROVED') && (
                            <button
                              onClick={() => handleCancelLeave(l.id)}
                              className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 hover:text-rose-700 hover:border-rose-200"
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Team Approvals Queue */}
        {activeTab === 'approvals' && (
          <div className="rounded-3xl bg-white p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">Applicant Employee</th>
                    <th className="px-5 py-3">Leave Type</th>
                    <th className="px-5 py-3">Dates</th>
                    <th className="px-5 py-3">Days</th>
                    <th className="px-5 py-3">Reason</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Review Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                  {approvalQueue.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">
                        No pending team leave approvals.
                      </td>
                    </tr>
                  ) : (
                    approvalQueue.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-slate-900">{l.employee_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{l.employee_code} • {l.department_name}</div>
                        </td>
                        <td className="px-5 py-3.5 font-bold">{l.leave_type}</td>
                        <td className="px-5 py-3.5 font-mono text-[11px]">
                          {l.start_date} → {l.end_date}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-900">{l.days_count}</td>
                        <td className="px-5 py-3.5 max-w-xs truncate text-slate-600">{l.reason}</td>
                        <td className="px-5 py-3.5">{getStatusBadge(l.status)}</td>
                        <td className="px-5 py-3.5 text-right">
                          {l.status === 'PENDING' ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleReviewLeave(l.id, 'APPROVED')}
                                className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 shadow-sm"
                              >
                                <Check className="h-3.5 w-3.5" />
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => handleReviewLeave(l.id, 'REJECTED')}
                                className="flex items-center gap-1 rounded-xl bg-rose-50 border border-rose-200 px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100 shadow-sm"
                              >
                                <X className="h-3.5 w-3.5" />
                                <span>Reject</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Reviewed</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Apply Leave Modal */}
        {showApplyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl space-y-5 border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-blue-600" />
                  Submit Time Off Request
                </h3>
                <button onClick={() => setShowApplyModal(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleApplyLeave} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Leave Category</label>
                  <select
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="CASUAL">Casual Leave ({balances.casual} days left)</option>
                    <option value="SICK">Sick Leave ({balances.sick} days left)</option>
                    <option value="ANNUAL">Annual Paid Leave ({balances.annual} days left)</option>
                    <option value="UNPAID">Unpaid Leave</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Start Date</label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">End Date</label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Reason / Purpose</label>
                  <textarea
                    required
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Provide details for your leave request..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowApplyModal(false)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="glow-btn-primary rounded-xl px-5 py-2 text-xs font-bold text-white shadow-sm disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : 'Submit Request'}
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
