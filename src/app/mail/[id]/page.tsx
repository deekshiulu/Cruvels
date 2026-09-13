'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Paperclip,
  Download,
  Reply,
  Trash2,
  Star,
  ShieldCheck,
  Send,
  AlertCircle,
  CheckCircle2,
  FileText,
  FileSpreadsheet,
  FileArchive,
  Image as ImageIcon,
  Clock,
} from 'lucide-react';
import { Message } from '@/lib/db/types';
import { clientCache } from '@/lib/cache/clientCache';
import DOMPurify from 'dompurify';

interface SafeAttachmentItem {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  download_url: string;
}

export default function MessageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);

  // Initialize from cache if previously visited
  const cachedMsg = clientCache.get<{ message: Message; attachments: SafeAttachmentItem[] }>('msg_detail', { id });

  const [message, setMessage] = useState<Message | null>(cachedMsg?.message || null);
  const [attachments, setAttachments] = useState<SafeAttachmentItem[]>(cachedMsg?.attachments || []);
  const [loading, setLoading] = useState(!cachedMsg);
  const [error, setError] = useState<string | null>(null);

  // Reply State
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyAll, setReplyAll] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [replySuccess, setReplySuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchMessage = async () => {
      try {
        const res = await fetch(`/api/messages/${id}`);
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.error || 'Access restricted or message does not exist.');
          return;
        }
        setMessage(data.message);
        setAttachments(data.attachments || []);
        clientCache.set('msg_detail', { id }, {
          message: data.message,
          attachments: data.attachments || [],
        });
        // Invalidate stale inbox cache so return navigation shows read status immediately
        clientCache.invalidate('inbox');
        window.dispatchEvent(new CustomEvent('mail-read', { detail: { id: data.message.id } }));
      } catch {
        setError('Network error while loading message.');
      } finally {
        setLoading(false);
      }
    };
    fetchMessage();
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('Move this message to trash?')) return;
    try {
      await fetch(`/api/messages/${id}`, { method: 'DELETE' });
      router.push('/mail/inbox');
    } catch {
      alert('Failed to delete message.');
    }
  };

  const handleToggleStar = async () => {
    if (!message) return;
    const newStar = !message.is_starred;
    setMessage({ ...message, is_starred: newStar });
    await fetch(`/api/messages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_starred: newStar }),
    });
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    setSendingReply(true);
    setReplySuccess(null);

    try {
      const res = await fetch('/api/mail/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          replyToMessageId: id,
          bodyText: replyText,
          replyAll,
          idempotencyKey: `reply_${id}_${Date.now()}`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to dispatch reply.');
      } else {
        setReplySuccess('Reply dispatched successfully using your assigned company alias!');
        setReplyText('');
        setShowReplyBox(false);
        clientCache.invalidate('inbox');
        clientCache.invalidate('sent');
        setTimeout(() => setReplySuccess(null), 4000);
      }
    } catch {
      setError('Network error sending reply.');
    } finally {
      setSendingReply(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const getFileIcon = (filename: string, mime: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['pdf'].includes(ext) || mime.includes('pdf')) {
      return <FileText className="h-5 w-5 text-rose-500" />;
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext) || mime.startsWith('image/')) {
      return <ImageIcon className="h-5 w-5 text-blue-500" />;
    }
    if (['zip', 'tar', 'gz', 'rar'].includes(ext)) {
      return <FileArchive className="h-5 w-5 text-amber-500" />;
    }
    if (['csv', 'xlsx', 'xls'].includes(ext)) {
      return <FileSpreadsheet className="h-5 w-5 text-emerald-500" />;
    }
    return <FileText className="h-5 w-5 text-slate-500" />;
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-16">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
          <p className="text-xs text-slate-500 font-medium">Verifying message authorization...</p>
        </div>
      </div>
    );
  }

  if (error || !message) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-200">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Access Denied / Not Found</h3>
        <p className="mt-1.5 text-xs text-slate-500 max-w-md leading-relaxed">{error}</p>
        <button
          onClick={() => router.push('/mail/inbox')}
          className="mt-6 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Return to Inbox
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col space-y-4 max-w-5xl mx-auto">
      {/* Top Action Toolbar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Messages</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleStar}
            className={`rounded-xl border p-2 transition-colors shadow-sm ${
              message.is_starred
                ? 'border-amber-300 bg-amber-50 text-amber-600'
                : 'border-slate-200 bg-white text-slate-400 hover:text-amber-500'
            }`}
            title="Star message"
          >
            <Star className={`h-4 w-4 ${message.is_starred ? 'fill-amber-500 text-amber-500' : ''}`} />
          </button>
          <button
            onClick={handleDelete}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:text-rose-600 hover:border-rose-300 shadow-sm transition-colors"
            title="Move to Trash"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowReplyBox(!showReplyBox)}
            className="glow-btn-primary flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white tracking-wide shadow-sm"
          >
            <Reply className="h-4 w-4" />
            <span>Reply</span>
          </button>
        </div>
      </div>

      {replySuccess && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 shadow-sm animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{replySuccess}</span>
        </div>
      )}

      {/* Main Message Viewer Card */}
      <div className="flex-1 overflow-y-auto rounded-3xl bg-white p-6 sm:p-8 shadow-sm space-y-6 border border-slate-200">
        {/* Header Metadata */}
        <div className="border-b border-slate-100 pb-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-snug">
              {message.subject || '(No Subject)'}
            </h2>
            <div className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800 shrink-0 shadow-sm">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>Zero-Trust Verified</span>
            </div>
          </div>

          <div className="flex items-start gap-3.5 pt-1">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-sm font-bold text-white shadow-md">
              {(message.from_name || message.from_address).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">
                    {message.from_name || message.from_address}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    &lt;{message.from_address}&gt;
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                  <Clock className="h-3 w-3" />
                  <span>
                    {new Date(message.received_at || message.created_at || '').toLocaleString([], {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-600 flex flex-wrap gap-x-3 gap-y-1">
                <div>
                  <span className="font-semibold text-slate-400">To: </span>
                  <span className="text-slate-700 font-mono">{message.to_addresses.join(', ')}</span>
                </div>
                {message.cc_addresses && message.cc_addresses.length > 0 && (
                  <div>
                    <span className="font-semibold text-slate-400">CC: </span>
                    <span className="text-slate-600 font-mono">{message.cc_addresses.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sanitized Email Body Content */}
        <div className="min-h-[220px] text-sm text-slate-800 leading-relaxed font-sans email-rendered-body">
          {message.body_html ? (
            <iframe
              title="Email content"
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              srcDoc={DOMPurify.sanitize(message.body_html, {
                USE_PROFILES: { html: true },
                FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
              })}
              className="w-full min-h-[280px] border-0 bg-white"
            />
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-sm">{message.body_text}</pre>
          )}
        </div>

        {/* Attachments Section */}
        {attachments.length > 0 && (
          <div className="border-t border-slate-100 pt-6 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
              <Paperclip className="h-4 w-4 text-blue-600" />
              <span>Verified Attachments ({attachments.length})</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 hover:border-blue-300 hover:bg-blue-50/30 transition-all group shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200 shadow-sm">
                      {getFileIcon(att.filename, att.mime_type)}
                    </div>
                    <div className="truncate min-w-0">
                      <div className="text-xs font-semibold text-slate-900 truncate" title={att.filename}>
                        {att.filename}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                        {formatFileSize(att.size)} • {att.mime_type}
                      </div>
                    </div>
                  </div>

                  <a
                    href={att.download_url}
                    download={att.filename}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-all shrink-0 ml-2 shadow-sm"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inline Quick Reply Composer */}
        {showReplyBox && (
          <form
            onSubmit={handleSendReply}
            className="border-t border-slate-100 pt-6 space-y-4 animate-in fade-in"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <Reply className="h-4 w-4 text-blue-600" />
                <span>Reply to: {message.from_address}</span>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer font-medium hover:text-slate-900">
                <input
                  type="checkbox"
                  checked={replyAll}
                  onChange={(e) => setReplyAll(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-0"
                />
                <span>Reply All</span>
              </label>
            </div>

            <textarea
              required
              rows={5}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Compose your reply here..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-medium text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all leading-relaxed"
            />

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowReplyBox(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 shadow-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sendingReply}
                className="glow-btn-primary flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-bold text-white tracking-wide disabled:opacity-50 shadow-sm"
              >
                {sendingReply ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Send Reply</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
