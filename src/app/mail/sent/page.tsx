'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Send, Paperclip, ChevronLeft, ChevronRight, MailCheck, ArrowUpRight } from 'lucide-react';
import { Message } from '@/lib/db/types';

import { clientCache } from '@/lib/cache/clientCache';

function SentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [page, setPage] = useState(1);

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
        clientCache.set('sent', { page, query }, {
          messages: data.messages || [],
          totalPages: data.totalPages || 1,
          total: data.total || 0,
        });
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

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex h-full flex-col space-y-4 max-w-6xl mx-auto">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm">
            <Send className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Sent Mail
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 font-medium border border-slate-200">
                {total} {total === 1 ? 'dispatch' : 'dispatches'}
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              Emails dispatched from your assigned company alias
            </p>
          </div>
        </div>

        {/* Pagination */}
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 shadow-sm">
          <span className="px-1 text-[11px] font-medium text-slate-500">
            {page} / {totalPages}
          </span>
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg p-1 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-lg p-1 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Sent Message List */}
      <div className="flex-1 overflow-hidden rounded-2xl bg-white shadow-sm flex flex-col border border-slate-200">
        {loading ? (
          <div className="flex flex-1 items-center justify-center p-16">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
              <p className="text-xs text-slate-500 font-medium">Loading dispatched emails...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 border border-slate-200 shadow-inner">
              <MailCheck className="h-8 w-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No sent messages</h3>
            <p className="mt-1.5 text-xs text-slate-500 max-w-sm leading-relaxed">
              Emails you send using your assigned alias will be tracked here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-y-auto">
            {messages.map((msg) => (
              <div
                key={msg.id}
                onClick={() => router.push(`/mail/${msg.id}`)}
                className="group flex items-center gap-4 px-5 py-4 cursor-pointer bg-white hover:bg-slate-50 transition-all"
              >
                {/* Sent indicator icon */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                  <ArrowUpRight className="h-4 w-4" />
                </div>

                {/* To badge */}
                <div className="w-56 shrink-0 truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                      To
                    </span>
                    <span className="text-xs font-semibold text-slate-900 truncate">
                      {msg.to_addresses.join(', ')}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 truncate font-mono mt-0.5">
                    From: {msg.from_address}
                  </div>
                </div>

                {/* Subject & Preview */}
                <div className="flex flex-1 items-center gap-2 min-w-0">
                  <span className="text-xs font-medium text-slate-800 truncate">
                    {msg.subject || '(No Subject)'}
                  </span>
                  <span className="text-xs text-slate-500 truncate font-normal">
                    — {msg.snippet || 'No preview available'}
                  </span>
                </div>

                {/* Attachments & Date */}
                <div className="flex items-center gap-3 shrink-0 text-xs text-slate-500">
                  {msg.has_attachments && (
                    <span className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                      <Paperclip className="h-3 w-3" />
                      Attachment
                    </span>
                  )}
                  <span className="w-24 text-right whitespace-nowrap font-medium text-[11px] text-slate-500">
                    {formatDate(msg.sent_at || msg.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SentMailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
        </div>
      }
    >
      <SentContent />
    </Suspense>
  );
}
