'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import MailNavRail from '@/components/mail/MailNavRail';
import {
  Trash2,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Inbox,
  CheckCircle2,
  ArrowLeft,
  Search,
  Sparkles,
} from 'lucide-react';
import { Message } from '@/lib/db/types';
import { clientCache } from '@/lib/cache/clientCache';

function TrashContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(query);
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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/mail/trash?q=${encodeURIComponent(search.trim())}`);
    } else {
      router.push('/mail/trash');
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Mail Sub-Navigation Rail */}
      <MailNavRail currentFolder="trash" />

      {/* Header Bar */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-600 to-red-600 text-white shadow-md shadow-rose-600/20">
              <Trash2 className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <Link
                  href="/mail/inbox"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-700 transition-all mr-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Inbox</span>
                </Link>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Trash & Deleted Items
                </h1>
                <span className="rounded-full bg-rose-100 dark:bg-rose-950/60 px-3 py-0.5 text-[10px] font-bold text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                  {total} {total === 1 ? 'Item' : 'Items'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Messages discarded from inbox or sent folders. Can be restored or purged permanently.
              </p>
            </div>
          </div>

          {/* Search & Actions */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search trash..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2 pl-9 pr-4 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-rose-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all"
              />
            </form>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-1 text-xs text-slate-600 dark:text-slate-300">
                <span className="px-2 text-[11px] font-semibold font-mono">
                  {page}/{totalPages}
                </span>
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg p-1 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 transition-all cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-lg p-1 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 transition-all cursor-pointer"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {notification && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3.5 text-xs text-emerald-800 dark:text-emerald-300 shadow-xs animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{notification}</span>
        </div>
      )}

      {/* Messages List Container */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-rose-600" />
            <span className="text-xs font-medium">Scanning trash...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center max-w-xl mx-auto">
            <div className="relative mb-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 shadow-inner">
                <Trash2 className="h-9 w-9 text-slate-400" />
              </div>
              <div className="absolute -top-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Trash is Empty
            </h3>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              No discarded messages found. Emails you delete will be kept here until permanently removed.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 mt-7">
              <Link
                href="/mail/inbox"
                className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
              >
                <Inbox className="h-4 w-4 text-slate-500" />
                <span>Return to Messages / Inbox</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {messages.map((msg) => (
              <div
                key={msg.id}
                onClick={() => router.push(`/mail/${msg.id}`)}
                className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                    <Trash2 className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700">
                        Deleted
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {msg.from_name || msg.from_address}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2 text-xs min-w-0">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {msg.subject || '(No Subject)'}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 truncate text-[11px]">
                        — {msg.snippet || 'No preview available'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 text-xs">
                  {msg.has_attachments && (
                    <span className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      <Paperclip className="h-3 w-3" />
                      <span>Attachment</span>
                    </span>
                  )}

                  <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
                    {formatDate(msg.received_at || msg.created_at)}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleRestore(e, msg.id)}
                      title="Restore to Inbox"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all cursor-pointer"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Restore</span>
                    </button>

                    <button
                      onClick={(e) => handlePermanentDelete(e, msg.id)}
                      title="Permanently Delete"
                      className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TrashPage() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="flex h-96 items-center justify-center text-slate-400">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-rose-600" />
          </div>
        }
      >
        <TrashContent />
      </Suspense>
    </AppShell>
  );
}
