'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileText, Paperclip, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { Message } from '@/lib/db/types';
import { clientCache } from '@/lib/cache/clientCache';

function DraftsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [page, setPage] = useState(1);
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

  return (
    <div className="flex h-full flex-col space-y-4 max-w-6xl mx-auto">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-200 shadow-sm">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Drafts
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 font-medium border border-slate-200">
                {total} {total === 1 ? 'draft' : 'drafts'}
              </span>
            </h1>
            <p className="text-xs text-slate-500">Unsent emails saved for later editing and dispatch</p>
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

      {/* Drafts List */}
      <div className="flex-1 overflow-hidden rounded-2xl bg-white shadow-sm flex flex-col border border-slate-200">
        {loading ? (
          <div className="flex flex-1 items-center justify-center p-16">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-purple-600 border-t-transparent" />
              <p className="text-xs text-slate-500 font-medium">Loading saved drafts...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 border border-slate-200 shadow-inner">
              <FileText className="h-8 w-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No saved drafts</h3>
            <p className="mt-1.5 text-xs text-slate-500 max-w-sm leading-relaxed">
              When composing an email, click &ldquo;Save Draft&rdquo; to store it here for later.
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
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-200">
                  <FileText className="h-4 w-4" />
                </div>

                <div className="w-56 shrink-0 truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                      Draft
                    </span>
                    <span className="text-xs font-semibold text-slate-900 truncate">
                      {msg.to_addresses.length > 0 ? msg.to_addresses.join(', ') : '(No Recipient)'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-1 items-center gap-2 min-w-0">
                  <span className="text-xs font-medium text-slate-800 truncate">
                    {msg.subject || '(No Subject)'}
                  </span>
                  <span className="text-xs text-slate-500 truncate font-normal">
                    — {msg.snippet || 'No preview available'}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0 text-xs text-slate-500">
                  {msg.has_attachments && (
                    <span className="flex items-center gap-1 rounded-lg bg-purple-50 px-2 py-1 text-[11px] font-semibold text-purple-700 border border-purple-200">
                      <Paperclip className="h-3 w-3" />
                      Attachment
                    </span>
                  )}
                  <span className="w-24 text-right whitespace-nowrap font-medium text-[11px] text-slate-500">
                    {formatDate(msg.created_at)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteDraft(e, msg.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-1 rounded transition-opacity"
                    title="Discard Draft"
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

export default function DraftsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-purple-600 border-t-transparent" />
        </div>
      }
    >
      <DraftsContent />
    </Suspense>
  );
}
