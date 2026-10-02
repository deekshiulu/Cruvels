'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle2, Clock, AlertTriangle, ShieldCheck, Loader2 } from 'lucide-react';
import { AcknowledgementItemType, AcknowledgementStatus } from '@/lib/db/types';

export interface AcknowledgementActionProps {
  itemType: AcknowledgementItemType;
  itemId: string;
  itemTitle: string;
  dueAt?: string;
  initialStatus?: AcknowledgementStatus;
  initialAcknowledgedAt?: string;
  compact?: boolean;
  onAcknowledged?: () => void;
}

export function AcknowledgementAction({
  itemType,
  itemId,
  itemTitle,
  dueAt,
  initialStatus,
  initialAcknowledgedAt,
  compact = false,
  onAcknowledged,
}: AcknowledgementActionProps) {
  const [status, setStatus] = useState<AcknowledgementStatus>(initialStatus || 'pending');
  const [acknowledgedAt, setAcknowledgedAt] = useState<string | undefined>(initialAcknowledgedAt);
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If initialStatus wasn't provided, fetch current user's status for this item
  useEffect(() => {
    if (!initialStatus) {
      fetch(`/api/acknowledgements?itemType=${itemType}&itemId=${itemId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.acknowledgement) {
            setStatus(data.acknowledgement.status);
            setAcknowledgedAt(data.acknowledgement.acknowledged_at);
          }
        })
        .catch(() => {});
    }
  }, [itemType, itemId, initialStatus]);

  const handleAcknowledge = async () => {
    if (isSubmitting || status === 'acknowledged') return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/acknowledgements/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType,
          itemId,
          notes: `Acknowledged: ${itemTitle}`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit acknowledgement.');
      }

      setStatus('acknowledged');
      setAcknowledgedAt(data.acknowledgement?.acknowledged_at || new Date().toISOString());
      if (onAcknowledged) onAcknowledged();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isOverdue = status === 'overdue' || (status === 'pending' && dueAt && new Date(dueAt).getTime() < Date.now());

  const formattedDate = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  // Compact Mode (for list rows or cards)
  if (compact) {
    if (status === 'acknowledged') {
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60"
          title={`Acknowledged on ${formattedDate(acknowledgedAt)}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Acknowledged</span>
        </span>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
            isOverdue
              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/60 animate-pulse'
              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60'
          }`}
        >
          {isOverdue ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
          <span>{isOverdue ? 'Overdue' : 'Pending Ack'}</span>
        </span>
        <button
          type="button"
          onClick={handleAcknowledge}
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-primary-600 hover:bg-primary-700 text-white shadow-sm transition disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
          <span>Acknowledge</span>
        </button>
      </div>
    );
  }

  // Full Box Mode
  if (status === 'acknowledged') {
    return (
      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-200 flex items-start gap-3">
        <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mt-0.5">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div className="flex-1 text-sm">
          <div className="font-semibold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
            <span>Mandatory Acknowledgement Verified</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 font-mono">
              CONFIRMED
            </span>
          </div>
          <p className="text-xs text-emerald-700/90 dark:text-emerald-300/80 mt-1">
            You reviewed and formally acknowledged this {itemType} on{' '}
            <span className="font-medium">{formattedDate(acknowledgedAt)}</span>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`p-4 rounded-xl border transition-all ${
        isOverdue
          ? 'bg-rose-500/5 border-rose-500/30'
          : 'bg-amber-500/5 border-amber-500/30'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-lg mt-0.5 ${
            isOverdue
              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
          }`}
        >
          {isOverdue ? <AlertTriangle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4
              className={`text-sm font-semibold ${
                isOverdue ? 'text-rose-900 dark:text-rose-200' : 'text-amber-900 dark:text-amber-200'
              }`}
            >
              {isOverdue ? 'Action Overdue: Mandatory Acknowledgement Required' : 'Action Required: Please Confirm Receipt'}
            </h4>
            {dueAt && (
              <span className="text-xs font-mono text-muted-foreground">
                Due: {formattedDate(dueAt)}
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground mt-1">
            As part of Cruvels compliance policies, all designated recipients must confirm that they have
            received, read, and understood this communication.
          </p>

          {error && (
            <div className="mt-2 text-xs text-rose-600 dark:text-rose-400 font-medium">
              {error}
            </div>
          )}

          <div className="mt-3.5 pt-3 border-t border-dashed border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs text-foreground font-medium">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-700"
              />
              <span>I have read, understood, and accept this {itemType}</span>
            </label>

            <button
              type="button"
              onClick={handleAcknowledge}
              disabled={!agreed || isSubmitting}
              className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white shadow transition min-h-[38px] ${
                isOverdue
                  ? 'bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400'
                  : 'bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400'
              } disabled:cursor-not-allowed`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Recording...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Confirm Acknowledgement</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
