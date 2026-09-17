'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShieldAlert,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Inbox,
  CheckCircle2,
} from 'lucide-react';
import { Message } from '@/lib/db/types';
import { clientCache } from '@/lib/cache/clientCache';

function SpamContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [page, setPage] = useState(1);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [notification, setNotification] = useState<string | null>(null);

  const fetchSpam = useCallback(async () => {
    try {
      setLoading(true);
      let url = `/api/mail/spam?page=${page}&limit=20`;
      if (query) url += `&q=${encodeURIComponent(query)}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    fetchSpam();
  }, [fetchSpam]);

  const handleUnspam = async (e: React.MouseEvent, msgId: string) => {
    e.stopPropagation();
    try {
      const res = await fetch('/api/mail/spam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: msgId, action: 'unmark' }),
      });
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
        setTotal((prev) => Math.max(0, prev - 1));
        clientCache.invalidate('inbox');
        setNotification('Email restored to your Inbox.');
        setTimeout(() => setNotification(null), 4000);
      }
    } catch {
      alert('Failed to restore message.');
    }
  };

  const handleDelete = async (e: React.MouseEvent, msgId: string) => {
    e.stopPropagation();
    if (!confirm('Permanently delete this spam message?')) return;
    try {
      const res = await fetch(`/api/messages/${msgId}`, { method: 'DELETE' });
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
        setTotal((prev) => Math.max(0, prev - 1));
        setNotification('Spam message permanently removed.');
        setTimeout(() => setNotification(null), 4000);
      }
    } catch {
      alert('Failed to delete message.');
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex h-full flex-col space-y-4 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-orange-500/10 border border-amber-200/80 rounded-3xl p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-amber-500/20 p-2.5 text-amber-700">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              Spam & Threat Quarantine
              <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                {total} {total === 1 ? 'Message' : 'Messages'}
              </span>
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Zero-Trust heuristic filters isolate unverified, suspicious, or user-flagged emails here.
            </p>
          </div>
        </div>

        {total > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/mail/inbox')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-xs"
            >
              <Inbox className="h-3.5 w-3.5" />
              <span>Back to Inbox</span>
            </button>
          </div>
        )}
      </div>

      {notification && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 shadow-sm animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{notification}</span>
        </div>
      )}

      {/* Messages List Container */}
      <div className="flex-1 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm flex flex-col">
        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center p-12 text-slate-400 space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-amber-600" />
            <span className="text-xs font-medium">Scanning spam quarantine...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-16 text-center">
            <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-3 border border-emerald-100">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Zero Spam Detected</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              Your quarantine folder is clean. Suspicious external emails or messages you mark as spam will appear here.
            </p>
            <button
              onClick={() => router.push('/mail/inbox')}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-all shadow-sm"
            >
              <Inbox className="h-3.5 w-3.5" />
              <span>Return to Inbox</span>
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {messages.map((msg) => (
              <div
                key={msg.id}
                onClick={() => router.push(`/mail/${msg.id}`)}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 hover:bg-amber-50/40 cursor-pointer transition-colors"
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  <div className="rounded-full bg-rose-50 text-rose-600 p-2 border border-rose-200 shrink-0 mt-0.5 sm:mt-0">
                    <AlertTriangle className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {msg.from_name || msg.from_address}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        &lt;{msg.from_address}&gt;
                      </span>
                      <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-100 text-rose-700">
                        Spam
                      </span>
                    </div>

                    <div className="text-xs font-medium text-slate-800 mt-0.5 truncate">
                      {msg.subject || '(No Subject)'}
                    </div>

                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      {msg.snippet}
                    </div>
                  </div>
                </div>

                {/* Right Metadata & Action Buttons */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    {msg.has_attachments && <Paperclip className="h-3.5 w-3.5 text-slate-500" />}
                    <span>{formatDate(msg.received_at || msg.created_at)}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleUnspam(e, msg.id)}
                      title="Not Spam (Move to Inbox)"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 transition-all shadow-2xs"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Not Spam</span>
                    </button>

                    <button
                      onClick={(e) => handleDelete(e, msg.id)}
                      title="Delete Permanently"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-600 bg-slate-50/50">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SpamPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-96 items-center justify-center text-slate-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-amber-600" />
        </div>
      }
    >
      <SpamContent />
    </Suspense>
  );
}
