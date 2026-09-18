'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Trash2,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Inbox,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Message } from '@/lib/db/types';
import { clientCache } from '@/lib/cache/clientCache';

function TrashContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [page, setPage] = useState(1);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [notification, setNotification] = useState<string | null>(null);

  const fetchTrash = useCallback(async () => {
    try {
      setLoading(true);
      let url = `/api/mail/trash?page=${page}&limit=20`;
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
    fetchTrash();
  }, [fetchTrash]);

  const handleRestore = async (e: React.MouseEvent, msgId: string) => {
    e.stopPropagation();
    try {
      const res = await fetch('/api/mail/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: msgId, action: 'restore' }),
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

  const handlePermanentDelete = async (e: React.MouseEvent, msgId: string) => {
    e.stopPropagation();
    if (!confirm('Permanently delete this email? This action cannot be undone.')) return;
    try {
      const res = await fetch(`/api/mail/trash?messageId=${encodeURIComponent(msgId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
        setTotal((prev) => Math.max(0, prev - 1));
        setNotification('Message permanently removed.');
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-500/10 via-rose-500/10 to-red-500/10 border border-slate-200/80 rounded-3xl p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-rose-500/20 p-2.5 text-rose-700">
            <Trash2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              Trash Mailbox
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-semibold border border-rose-200">
                {total} {total === 1 ? 'Message' : 'Messages'}
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Items in trash can be restored back to your Inbox or permanently deleted.
            </p>
          </div>
        </div>

        <button
          onClick={() => router.push('/mail/inbox')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white border border-slate-200 shadow-2xs text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <Inbox className="w-3.5 h-3.5 text-blue-600" />
          Back to Inbox
        </button>
      </div>

      {notification && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-medium animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Messages List Container */}
      <div className="flex-1 rounded-3xl border border-slate-200/80 bg-white/70 backdrop-blur-md overflow-hidden shadow-xs flex flex-col">
        {loading ? (
          <div className="flex flex-1 items-center justify-center p-12 text-slate-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-700 mr-3" />
            <span className="text-sm font-medium">Loading deleted messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
            <div className="w-14 h-14 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <Trash2 className="w-7 h-7" />
            </div>
            <p className="text-sm font-bold text-slate-700">Trash is Empty</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              {query ? `No trash items match "${query}".` : 'You have no deleted emails in your trash.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 flex-1 overflow-y-auto">
            {messages.map((msg) => (
              <div
                key={msg.id}
                onClick={() => router.push(`/mail/${msg.id}`)}
                className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-slate-50/80 cursor-pointer transition-colors gap-2"
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 font-semibold text-xs border border-slate-200">
                    {(msg.from_name || msg.from_address || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 truncate max-w-[180px]">
                        {msg.from_name || msg.from_address}
                      </span>
                      {msg.has_attachments && (
                        <Paperclip className="h-3 w-3 text-slate-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs font-medium text-slate-700 truncate mt-0.5">
                      {msg.subject || '(No Subject)'}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {msg.snippet || msg.body_text?.substring(0, 100)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <span className="text-[10px] font-mono text-slate-400">
                    {formatDate(msg.received_at || msg.sent_at || msg.created_at)}
                  </span>
                  
                  {/* Restore Action */}
                  <button
                    onClick={(e) => handleRestore(e, msg.id)}
                    title="Restore to Inbox"
                    className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors shadow-2xs"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restore
                  </button>

                  {/* Permanent Delete Action */}
                  <button
                    onClick={(e) => handlePermanentDelete(e, msg.id)}
                    title="Delete Forever"
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
            <span className="text-xs text-slate-500 font-medium">
              Page {page} of {totalPages} ({total} total)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft className="h-4 w-4 text-slate-600" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                <ChevronRight className="h-4 w-4 text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TrashPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading Trash...</div>}>
      <TrashContent />
    </Suspense>
  );
}
