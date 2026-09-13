'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Inbox,
  Paperclip,
  Star,
  ChevronLeft,
  ChevronRight,
  Mail,
  MailOpen,
  Filter,
  CheckCircle2,
  Trash2,
  Reply,
  ShieldCheck,
} from 'lucide-react';
import { Message } from '@/lib/db/types';
import { clientCache } from '@/lib/cache/clientCache';

function InboxContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [page, setPage] = useState(1);
  const [filterUnread, setFilterUnread] = useState(false);
  const [filterStarred, setFilterStarred] = useState(false);

  // Initialize from cache if available for 0ms instant display
  const cachedData = clientCache.get<{ messages: Message[]; totalPages: number; total: number }>('inbox', {
    page,
    query,
    filterUnread,
  });

  const [messages, setMessages] = useState<Message[]>(cachedData?.messages || []);
  const [loading, setLoading] = useState(!cachedData);
  const [totalPages, setTotalPages] = useState(cachedData?.totalPages || 1);
  const [total, setTotal] = useState(cachedData?.total || 0);

  const fetchInbox = useCallback(async () => {
    const cached = clientCache.get<{ messages: Message[]; totalPages: number; total: number }>('inbox', {
      page,
      query,
      filterUnread,
    });
    if (!cached) setLoading(true);

    try {
      let url = `/api/mail/inbox?page=${page}&limit=20`;
      if (query) url += `&q=${encodeURIComponent(query)}`;
      if (filterUnread) url += '&isRead=false';

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
        clientCache.set('inbox', { page, query, filterUnread }, {
          messages: data.messages || [],
          totalPages: data.totalPages || 1,
          total: data.total || 0,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [page, query, filterUnread]);

  useEffect(() => {
    fetchInbox();

    const handleMailRead = (e: any) => {
      if (e.detail?.id) {
        setMessages((prev) =>
          prev.map((m) => (m.id === e.detail.id ? { ...m, is_read: true } : m))
        );
      }
    };

    const intervalTimer = setInterval(() => {
      fetchInbox();
    }, 15000);

    window.addEventListener('mail-read', handleMailRead);
    window.addEventListener('mail-synced', fetchInbox);
    window.addEventListener('focus', fetchInbox);
    return () => {
      clearInterval(intervalTimer);
      window.removeEventListener('mail-read', handleMailRead);
      window.removeEventListener('mail-synced', fetchInbox);
      window.removeEventListener('focus', fetchInbox);
    };
  }, [fetchInbox]);

  const handleToggleStar = async (e: React.MouseEvent, msg: Message) => {
    e.stopPropagation();
    const newStarred = !msg.is_starred;
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, is_starred: newStarred } : m))
    );
    clientCache.invalidate('inbox');
    try {
      await fetch(`/api/messages/${msg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_starred: newStarred }),
      });
    } catch {
      // Revert on error
    }
  };

  const handleDeleteMessage = async (e: React.MouseEvent, msgId: string) => {
    e.stopPropagation();
    if (!confirm('Move this message to trash?')) return;
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    clientCache.invalidate('inbox');
    try {
      await fetch(`/api/messages/${msgId}`, {
        method: 'DELETE',
      });
      fetchInbox();
    } catch {
      // Revert on error
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
    });
  };

  const getSenderInitial = (msg: Message) => {
    const name = msg.from_name || msg.from_address;
    return (name.charAt(0) || 'U').toUpperCase();
  };

  const getAvatarGradient = (str: string) => {
    const charCode = str.charCodeAt(0) || 0;
    const gradients = [
      'from-blue-600 to-indigo-600 text-white',
      'from-purple-600 to-pink-600 text-white',
      'from-emerald-600 to-teal-600 text-white',
      'from-amber-500 to-orange-600 text-white',
      'from-cyan-600 to-blue-600 text-white',
    ];
    return gradients[charCode % gradients.length];
  };

  const displayedMessages = filterStarred
    ? messages.filter((m) => m.is_starred)
    : messages;

  return (
    <div className="flex h-full flex-col space-y-4 max-w-6xl mx-auto">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200 shadow-sm">
            <Inbox className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Inbox
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 font-medium border border-slate-200">
                {total} {total === 1 ? 'email' : 'emails'}
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              Only communications dispatched to your assigned alias
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Starred Filter Toggle */}
          <button
            onClick={() => setFilterStarred(!filterStarred)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold border transition-all shadow-sm ${
              filterStarred
                ? 'bg-amber-50 text-amber-700 border-amber-300'
                : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Star className={`h-3.5 w-3.5 ${filterStarred ? 'fill-amber-500 text-amber-500' : ''}`} />
            <span>Starred</span>
          </button>

          {/* Unread Filter Toggle */}
          <button
            onClick={() => {
              setFilterUnread(!filterUnread);
              setPage(1);
            }}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold border transition-all shadow-sm ${
              filterUnread
                ? 'bg-blue-50 text-blue-700 border-blue-300'
                : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Unread Filter</span>
          </button>

          {/* Pagination Controls */}
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
      </div>

      {/* Query filter notice */}
      {query && (
        <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs text-blue-800 shadow-sm">
          <span>Search filter applied: &ldquo;<strong>{query}</strong>&rdquo;</span>
          <button
            onClick={() => router.push('/mail/inbox')}
            className="text-xs text-blue-600 hover:underline font-semibold"
          >
            Clear Search
          </button>
        </div>
      )}

      {/* Message List Panel */}
      <div className="flex-1 overflow-hidden rounded-2xl bg-white shadow-sm flex flex-col border border-slate-200">
        {loading ? (
          <div className="flex flex-1 items-center justify-center p-16">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
              <p className="text-xs text-slate-500 font-medium">Fetching verified messages...</p>
            </div>
          </div>
        ) : displayedMessages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 border border-slate-200 shadow-inner">
              <MailOpen className="h-8 w-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No messages in inbox</h3>
            <p className="mt-1.5 text-xs text-slate-500 max-w-sm leading-relaxed">
              {query
                ? `No emails found matching "${query}". Try refining your search keyword.`
                : filterStarred
                ? 'No starred messages found.'
                : 'Your inbox is clear. Incoming emails directed to your assigned alias will be automatically routed here.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-y-auto">
            {displayedMessages.map((msg) => (
              <div
                key={msg.id}
                onClick={() => {
                  setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, is_read: true } : m)));
                  router.push(`/mail/${msg.id}`);
                }}
                className={`group flex items-center gap-3.5 px-4 sm:px-5 py-3.5 cursor-pointer transition-all ${
                  msg.is_read
                    ? 'bg-white hover:bg-slate-50'
                    : 'bg-blue-50/50 hover:bg-blue-50/90 border-l-4 border-l-blue-600'
                }`}
              >
                {/* Star Toggle Button */}
                <button
                  type="button"
                  onClick={(e) => handleToggleStar(e, msg)}
                  className="text-slate-300 hover:text-amber-500 p-1 rounded transition-colors shrink-0"
                  title="Star message"
                >
                  <Star className={`h-4 w-4 ${msg.is_starred ? 'fill-amber-400 text-amber-400' : ''}`} />
                </button>

                {/* Sender Avatar */}
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr ${getAvatarGradient(
                    msg.from_name || msg.from_address
                  )} text-xs font-bold shadow-sm`}
                >
                  {getSenderInitial(msg)}
                </div>

                {/* Sender & Badges */}
                <div className="w-40 sm:w-48 shrink-0 truncate">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xs truncate ${
                        msg.is_read ? 'text-slate-700 font-medium' : 'text-slate-900 font-bold'
                      }`}
                    >
                      {msg.from_name || msg.from_address}
                    </span>
                    {!msg.is_read && (
                      <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0" />
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate font-mono mt-0.5">
                    {msg.from_address}
                  </div>
                </div>

                {/* Subject & Preview */}
                <div className="flex flex-1 items-center gap-2 min-w-0">
                  <span
                    className={`text-xs truncate ${
                      msg.is_read ? 'text-slate-800 font-normal' : 'text-slate-950 font-bold'
                    }`}
                  >
                    {msg.subject || '(No Subject)'}
                  </span>
                  <span className="text-xs text-slate-500 truncate font-normal hidden sm:inline">
                    — {msg.snippet || 'No preview available'}
                  </span>
                </div>

                {/* Attachments Indicator & Date */}
                <div className="flex items-center gap-2 sm:gap-3 shrink-0 text-xs text-slate-500">
                  {msg.has_attachments && (
                    <span className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 border border-blue-200">
                      <Paperclip className="h-3 w-3" />
                      <span className="hidden sm:inline">Attachment</span>
                    </span>
                  )}
                  <span className="text-right whitespace-nowrap font-medium text-[11px] text-slate-500">
                    {formatDate(msg.received_at || msg.created_at)}
                  </span>
                  {/* Inline Trash Button */}
                  <button
                    type="button"
                    onClick={(e) => handleDeleteMessage(e, msg.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-1 rounded transition-opacity"
                    title="Move to Trash"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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

export default function InboxPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
        </div>
      }
    >
      <InboxContent />
    </Suspense>
  );
}
