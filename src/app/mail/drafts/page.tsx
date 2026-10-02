'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import MailNavRail from '@/components/mail/MailNavRail';
import {
  FileText,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  Trash2,
  ArrowLeft,
  Search,
  Pencil,
  Inbox,
  ArrowUpRight,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Message } from '@/lib/db/types';

function DraftsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(query);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/mail/drafts?page=${page}&limit=20`;
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
    fetchDrafts();
  }, [fetchDrafts]);

  const handleDeleteDraft = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Discard this draft?')) return;
    setMessages((prev) => prev.filter((m) => m.id !== id));
    try {
      await fetch(`/api/messages/${id}`, { method: 'DELETE' });
      fetchDrafts();
    } catch {
      // Revert on failure
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/mail/drafts?q=${encodeURIComponent(search.trim())}`);
    } else {
      router.push('/mail/drafts');
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
      <MailNavRail currentFolder="drafts" />

      {/* Header Bar */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/20">
              <FileText className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <Link
                  href="/mail/inbox"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-300 dark:hover:border-purple-700 transition-all mr-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Inbox</span>
                </Link>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Drafts
                </h1>
                <span className="rounded-full bg-purple-100 dark:bg-purple-950/60 px-3 py-0.5 text-[10px] font-bold text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  {total} {total === 1 ? 'Draft' : 'Drafts'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Unsent messages saved locally for continuous editing and future dispatch
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
                placeholder="Filter drafts..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2 pl-9 pr-4 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-purple-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all"
              />
            </form>

            <Link
              href="/mail/compose"
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-purple-600/20 hover:opacity-95 transition-all shrink-0 cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Compose</span>
            </Link>

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

      {/* Drafts List Container */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-purple-600 border-t-transparent" />
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Loading saved drafts...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center max-w-xl mx-auto">
            <div className="relative mb-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 shadow-inner">
                <FileText className="h-9 w-9 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="absolute -top-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-purple-600 text-white shadow-md">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              No Unsent Drafts
            </h3>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              When you begin composing a message and choose &ldquo;Save as Draft&rdquo;, it will be safely stored here for editing.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 mt-7">
              <Link
                href="/mail/compose"
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-purple-600/20 hover:opacity-95 transition-all"
              >
                <Pencil className="h-4 w-4" />
                <span>Start New Draft</span>
              </Link>

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
                onClick={() => router.push(`/mail/compose?draftId=${msg.id}`)}
                className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/60">
                    <FileText className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 dark:bg-rose-950/50 dark:text-rose-300 px-1.5 py-0.2 rounded border border-rose-200 dark:border-rose-800">
                        Draft
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {msg.to_addresses && msg.to_addresses.length > 0
                          ? `To: ${msg.to_addresses.join(', ')}`
                          : '(No Recipient Specified)'}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2 text-xs min-w-0">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {msg.subject || '(Untitled Draft)'}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 truncate text-[11px]">
                        — {msg.snippet || 'No draft body content'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 text-xs">
                  {msg.has_attachments && (
                    <span className="flex items-center gap-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 text-[11px] font-semibold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      <Paperclip className="h-3 w-3" />
                      <span>Attachment</span>
                    </span>
                  )}

                  <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
                    Saved {formatDate(msg.created_at)}
                  </span>

                  <button
                    onClick={(e) => handleDeleteDraft(e, msg.id)}
                    title="Discard Draft"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DraftsPage() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-purple-600 border-t-transparent" />
          </div>
        }
      >
        <DraftsContent />
      </Suspense>
    </AppShell>
  );
}
