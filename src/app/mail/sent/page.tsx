'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import MailNavRail from '@/components/mail/MailNavRail';
import {
  Send,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Search,
  ArrowLeft,
  MailCheck,
  Sparkles,
  Inbox,
  Pencil,
  ShieldCheck,
  Clock,
  Check,
} from 'lucide-react';
import { Message } from '@/lib/db/types';
import { clientCache } from '@/lib/cache/clientCache';

function initials(name: string): string {
  return (name || 'U')
    .split(' ')
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');
}

function avatarBg(name: string): string {
  const colors = ['#0A369D', '#6366F1', '#D99A1F', '#EC4899', '#2563EB', '#F97316', '#8B5CF6'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + h * 31;
  return colors[Math.abs(h) % colors.length];
}

function SentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(query);

  // Initialize from cache if available for 0ms instant display
  const cachedData = clientCache.get<{ messages: Message[]; totalPages: number; total: number }>('sent', {
    page,
    query,
  });

  const [messages, setMessages] = useState<Message[]>(cachedData?.messages || []);
  const [loading, setLoading] = useState(!cachedData);
  const [totalPages, setTotalPages] = useState(cachedData?.totalPages || 1);
  const [total, setTotal] = useState(cachedData?.total || 0);

  const fetchSent = useCallback(async () => {
    const cached = clientCache.get<{ messages: Message[]; totalPages: number; total: number }>('sent', {
      page,
      query,
    });
    if (!cached) setLoading(true);

    try {
      let url = `/api/mail/sent?page=${page}&limit=20`;
      if (query) url += `&q=${encodeURIComponent(query)}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
        clientCache.set(
          'sent',
          { page, query },
          {
            messages: data.messages || [],
            totalPages: data.totalPages || 1,
            total: data.total || 0,
          }
        );
      }
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    fetchSent();

    const intervalTimer = setInterval(() => {
      fetchSent();
    }, 15000);

    window.addEventListener('mail-synced', fetchSent);
    window.addEventListener('focus', fetchSent);
    return () => {
      clearInterval(intervalTimer);
      window.removeEventListener('mail-synced', fetchSent);
      window.removeEventListener('focus', fetchSent);
    };
  }, [fetchSent]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/mail/sent?q=${encodeURIComponent(search.trim())}`);
    } else {
      router.push('/mail/sent');
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    }
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
      <MailNavRail currentFolder="sent" />

      {/* Header Bar */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#0A2540] to-[#1E3A8A] text-white shadow-md shadow-blue-900/20">
              <Send className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <Link
                  href="/mail/inbox"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all mr-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Inbox</span>
                </Link>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Sent Mail
                </h1>
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-3 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {total} {total === 1 ? 'Dispatch' : 'Dispatches'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Outbound corporate communications dispatched and verified from your assigned alias
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
                placeholder="Filter sent messages..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2 pl-9 pr-4 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all"
              />
            </form>

            <Link
              href="/mail/compose"
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0A2540] via-[#1E3A8A] to-[#2563EB] px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-900/20 hover:opacity-95 transition-all shrink-0 cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Compose</span>
            </Link>

            {/* Pagination Controls */}
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

      {/* Operational Pulse Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-3xl bg-white dark:bg-slate-900 p-5 shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Total Dispatched
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <Send className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white">{total}</div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
              100% Outbound Delivery
            </p>
          </div>
        </div>

        <div className="rounded-3xl bg-white dark:bg-slate-900 p-5 shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Sender Authentication
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-sm font-bold text-slate-900 dark:text-white">Strict Alias Lock</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono truncate">
              @cruvels.com verified
            </p>
          </div>
        </div>

        <div className="rounded-3xl bg-white dark:bg-slate-900 p-5 shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Audit Telemetry
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <MailCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-sm font-bold text-purple-600 dark:text-purple-400">Immutable Ledger</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Zero-Trust trace recorded
            </p>
          </div>
        </div>

        <div className="rounded-3xl bg-white dark:bg-slate-900 p-5 shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Folder Navigation
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Inbox className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <Link
              href="/mail/inbox"
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>Go to Inbox</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
            <span className="text-[10px] text-slate-400">Live Folders</span>
          </div>
        </div>
      </div>

      {/* Sent Message List Container */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Loading dispatched emails...</p>
          </div>
        ) : messages.length === 0 ? (
          /* High-Quality, Actionable Empty State */
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center max-w-xl mx-auto">
            <div className="relative mb-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-blue-500/10 via-indigo-500/10 to-sky-500/10 border border-blue-200 dark:border-blue-800 shadow-inner">
                <Send className="h-9 w-9 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="absolute -top-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              No Sent Dispatches Yet
            </h3>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Emails you send using your assigned Cruvels alias will appear here with recipient delivery stamps and full
              conversation histories.
            </p>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-7">
              <Link
                href="/mail/compose"
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0A2540] via-[#1E3A8A] to-[#2563EB] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-900/20 hover:opacity-95 transition-all"
              >
                <Pencil className="h-4 w-4" />
                <span>Compose First Email</span>
              </Link>

              <Link
                href="/mail/inbox"
                className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
              >
                <Inbox className="h-4 w-4 text-slate-500" />
                <span>Return to Messages / Inbox</span>
              </Link>
            </div>

            {/* Zero-Trust Notice */}
            <div className="mt-8 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 p-4 text-left w-full">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Zero-Trust Outbound Enforcement Active</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Outbound emails automatically bind your authenticated alias as the sender. Header spoofing and
                cross-intern forging are mathematically prevented by the internal gateway.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {messages.map((msg) => {
              const recipientFirst = msg.to_addresses[0] || 'Unknown';
              const bg = avatarBg(recipientFirst);
              return (
                <div
                  key={msg.id}
                  onClick={() => router.push(`/mail/${msg.id}`)}
                  className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* Recipient Avatar */}
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xs font-bold text-white shadow-2xs"
                      style={{ background: bg }}
                    >
                      {initials(recipientFirst)}
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800">
                          To
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {msg.to_addresses.join(', ')}
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

                  {/* Metadata & Timestamp */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 text-xs">
                    {msg.has_attachments && (
                      <span className="flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <Paperclip className="h-3 w-3" />
                        <span>Attachment</span>
                      </span>
                    )}

                    <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      {formatDate(msg.sent_at || msg.created_at)}
                    </span>

                    <div className="opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex items-center text-emerald-600 dark:text-emerald-400">
                      <ArrowUpRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SentMailPage() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
          </div>
        }
      >
        <SentContent />
      </Suspense>
    </AppShell>
  );
}
