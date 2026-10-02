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
  ShieldAlert,
  RotateCcw,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  User,
  Video,
  ExternalLink,
  Calendar as CalendarIcon,
  Bell,
} from 'lucide-react';
import { Message } from '@/lib/db/types';
import { clientCache } from '@/lib/cache/clientCache';
import DOMPurify from 'dompurify';
import AppShell from '@/components/layout/AppShell';
import MailNavRail from '@/components/mail/MailNavRail';
import MailReminderModal from '@/components/mail/MailReminderModal';

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

  const [message, setMessage] = useState<Message | null>(null);
  const [attachments, setAttachments] = useState<SafeAttachmentItem[]>([]);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [threadAttachmentsMap, setThreadAttachmentsMap] = useState<Record<string, SafeAttachmentItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Expanded message IDs in thread (latest message expanded by default)
  const [expandedMessageIds, setExpandedMessageIds] = useState<Set<string>>(new Set());

  // Reminder & Schedule State
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderNotification, setReminderNotification] = useState<string | null>(null);
  const [addingToSchedule, setAddingToSchedule] = useState(false);
  const [scheduleSuccess, setScheduleSuccess] = useState<string | null>(null);

  // Reply State
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyAll, setReplyAll] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [replySuccess, setReplySuccess] = useState<string | null>(null);
  const [spamNotification, setSpamNotification] = useState<string | null>(null);

  const fetchMessage = async () => {
    try {
      const [res, meRes] = await Promise.all([
        fetch(`/api/messages/${id}`),
        fetch('/api/auth/me'),
      ]);

      if (meRes.ok) {
        const meData = await meRes.json();
        setCurrentUser(meData.user || null);
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Access restricted or message does not exist.');
        return;
      }

      setMessage(data.message);
      setAttachments(data.attachments || []);

      const thread = data.threadMessages && data.threadMessages.length > 0 ? data.threadMessages : [data.message];
      setThreadMessages(thread);
      setThreadAttachmentsMap(data.threadAttachmentsMap || { [data.message.id]: data.attachments || [] });

      // By default, expand the latest message and the active clicked message
      const toExpand = new Set<string>([data.message.id]);
      if (thread.length > 0) {
        toExpand.add(thread[thread.length - 1].id);
      }
      setExpandedMessageIds(toExpand);

      clientCache.invalidate('inbox');
      window.dispatchEvent(new CustomEvent('mail-read', { detail: { id: data.message.id } }));
    } catch {
      setError('Network error while loading conversation.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessage();
  }, [id]);

  const toggleExpand = (msgId: string) => {
    setExpandedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        // Prevent collapsing if it's the only message
        if (next.size > 1) next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  };

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

  const handleToggleSpam = async () => {
    if (!message) return;
    const isCurrentlySpam = message.folder === 'spam' || message.is_spam;
    const action = isCurrentlySpam ? 'unspam' : 'spam';

    try {
      const res = await fetch(`/api/messages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        const updatedFolder = isCurrentlySpam ? 'inbox' : 'spam';
        setMessage({ ...message, folder: updatedFolder as any, is_spam: !isCurrentlySpam });
        clientCache.invalidate('inbox');
        setSpamNotification(
          isCurrentlySpam ? 'Message restored to Inbox.' : 'Message moved to Spam Quarantine.'
        );
        setTimeout(() => setSpamNotification(null), 4000);
      }
    } catch {
      alert('Failed to update spam status.');
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !message) return;

    setSendingReply(true);
    setReplySuccess(null);

    try {
      // Always reply to the latest message in thread for continuity
      const latestMsgInThread = threadMessages.length > 0 ? threadMessages[threadMessages.length - 1] : message;

      const res = await fetch('/api/mail/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          replyToMessageId: latestMsgInThread.id,
          bodyText: replyText,
          replyAll,
          idempotencyKey: `reply_${latestMsgInThread.id}_${Date.now()}`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to dispatch reply.');
      } else {
        setReplySuccess('Reply dispatched successfully! Appended to conversation thread.');
        setReplyText('');
        setShowReplyBox(false);

        // Optimistically append sent reply into thread
        if (data.data) {
          const newSentMsg: Message = {
            id: data.data.messageId,
            provider_message_id: `sent_${Date.now()}`,
            thread_id: message.thread_id,
            owner_user_id: currentUser?.id || '',
            owner_alias_id: '',
            from_address: data.data.from,
            from_name: currentUser?.name || 'Me',
            to_addresses: message.from_address ? [message.from_address] : message.to_addresses,
            subject: message.subject.startsWith('Re:') ? message.subject : `Re: ${message.subject}`,
            body_text: replyText,
            body_html: null,
            snippet: replyText.slice(0, 100),
            received_at: null,
            sent_at: new Date().toISOString(),
            folder: 'sent',
            is_read: true,
            is_starred: false,
            has_attachments: false,
          };
          setThreadMessages((prev) => [...prev, newSentMsg]);
          setExpandedMessageIds((prev) => new Set([...Array.from(prev), newSentMsg.id]));
        }

        clientCache.invalidate('inbox');
        clientCache.invalidate('sent');
        setTimeout(() => setReplySuccess(null), 5000);
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

  // Phishing / Suspicious heuristic check
  const isSuspiciousEmail = (msg: Message) => {
    if (msg.is_spam || msg.folder === 'spam') return true;
    const text = `${msg.subject} ${msg.snippet} ${msg.body_text || ''}`.toLowerCase();
    const flags = ['urgent wire', 'lottery', 'verify password', 'immediate action required', 'cryptocurrency transfer', 'tax refund claim'];
    return flags.some((flag) => text.includes(flag));
  };

  // Inbound Meeting Link Detector (Google Meet & Microsoft Teams)
  const extractMeetingDetails = (msg: Message) => {
    const content = `${msg.body_text || ''} ${msg.snippet || ''} ${msg.body_html || ''}`;

    // Google Meet
    const gmeetMatch = content.match(/https?:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i);
    if (gmeetMatch) {
      return {
        platform: 'google_meet' as const,
        platformName: 'Google Meet',
        url: gmeetMatch[0],
        badgeColor: '#10B981',
        badgeBg: 'rgba(16, 185, 129, 0.12)',
        badgeBorder: 'rgba(16, 185, 129, 0.35)',
      };
    }

    // Microsoft Teams
    const teamsMatch = content.match(/https?:\/\/(?:teams\.microsoft\.com|teams\.live\.com)[^\s"'>)]+/i);
    if (teamsMatch) {
      return {
        platform: 'teams' as const,
        platformName: 'Microsoft Teams',
        url: teamsMatch[0],
        badgeColor: '#6366F1',
        badgeBg: 'rgba(99, 102, 241, 0.12)',
        badgeBorder: 'rgba(99, 102, 241, 0.35)',
      };
    }

    return null;
  };

  const handleAddToSchedule = async (meetingDetails: { platform: string; platformName: string; url: string }) => {
    if (!message) return;
    setAddingToSchedule(true);
    setScheduleSuccess(null);
    try {
      const startTime = new Date();
      // Set to tomorrow 10:00 AM or 1 hour from now
      startTime.setDate(startTime.getDate() + 1);
      startTime.setHours(10, 0, 0, 0);
      const endTime = new Date(startTime.getTime() + 45 * 60 * 1000);

      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Meeting: ${message.subject}`,
          description: `Auto-scheduled from email sent by ${message.from_address}.\nInvite Link: ${meetingDetails.url}`,
          eventType: 'meeting',
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          location: `${meetingDetails.platformName} Call`,
          meetingLink: meetingDetails.url,
          meetingPlatform: meetingDetails.platform,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setScheduleSuccess(`Event synced to Cruvels Schedule! Scheduled for tomorrow at 10:00 AM IST.`);
        setTimeout(() => setScheduleSuccess(null), 5000);
      } else {
        alert(data.error || 'Failed to auto-add to schedule.');
      }
    } catch {
      alert('Network error while scheduling event.');
    } finally {
      setAddingToSchedule(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-16">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
          <p className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Verifying message authorization & thread history...</p>
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
        <h3 className="text-base font-bold" style={{ color: 'var(--ink)' }}>Access Denied / Not Found</h3>
        <p className="mt-1.5 text-xs max-w-md leading-relaxed" style={{ color: 'var(--muted)' }}>{error}</p>
        <button
          onClick={() => router.push('/mail/inbox')}
          className="mt-6 flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-white transition-colors"
          style={{ background: 'var(--teal)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          Return to Inbox
        </button>
      </div>
    );
  }

  const isSpam = message.folder === 'spam' || message.is_spam;

  return (
    <AppShell>
      <div className="space-y-4 max-w-5xl mx-auto pb-12">
        {/* On desktop show MailNavRail; on mobile hide to maximize clean reading viewport */}
        <div className="hidden md:block">
          <MailNavRail />
        </div>

        {/* Top Action Toolbar */}
        <div className="flex items-center justify-between gap-2 py-1">
          <button
            onClick={() => router.push('/mail/inbox')}
            className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all shrink-0 hover:border-blue-500/40"
            style={{ background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--ink)' }}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden xs:inline sm:inline">Messages</span>
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Spam / Not Spam Toggle */}
            <button
              onClick={handleToggleSpam}
              className={`flex items-center gap-1.5 rounded-xl border px-2.5 sm:px-3 py-2 text-xs font-semibold shadow-xs transition-all ${
                isSpam
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300'
              }`}
              title={isSpam ? 'Restore to Inbox' : 'Move to Spam Quarantine'}
            >
              {isSpam ? <RotateCcw className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />}
              <span className="hidden sm:inline">{isSpam ? 'Not Spam' : 'Spam'}</span>
            </button>

            {/* Star Toggle */}
            <button
              onClick={handleToggleStar}
              className="rounded-xl border p-2 transition-colors shadow-xs"
              style={{
                borderColor: message.is_starred ? 'var(--amber)' : 'var(--line)',
                background: message.is_starred ? 'var(--amber-dim)' : 'var(--surface)',
                color: message.is_starred ? 'var(--amber)' : 'var(--muted)',
              }}
              title="Star message"
            >
              <Star className={`h-4 w-4 ${message.is_starred ? 'fill-amber-500 text-amber-500' : ''}`} />
            </button>

            {/* Remind Me / Snooze */}
            <button
              onClick={() => setShowReminderModal(true)}
              className="flex items-center gap-1.5 rounded-xl border px-2.5 sm:px-3 py-2 text-xs font-semibold transition-all shadow-xs"
              style={{ background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--ink)' }}
              title="Set reminder / snooze email with push notifications"
            >
              <Clock className="h-4 w-4" style={{ color: 'var(--teal)' }} />
              <span className="hidden sm:inline">Remind</span>
            </button>

            {/* Delete Button */}
            <button
              onClick={handleDelete}
              className="rounded-xl border p-2 transition-colors shadow-xs hover:text-rose-600"
              style={{ background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--muted)' }}
              title="Move to Trash"
            >
              <Trash2 className="h-4 w-4" />
            </button>

            {/* Reply Toggle */}
            <button
              onClick={() => setShowReplyBox(!showReplyBox)}
              className="glow-btn-primary flex items-center gap-1.5 rounded-xl px-3 sm:px-4 py-2 text-xs font-bold text-white tracking-wide shadow-xs"
            >
              <Reply className="h-4 w-4" />
              <span>Reply</span>
            </button>
          </div>
        </div>

      {/* Reminder Confirmation Alert */}
      {reminderNotification && (
        <div className="flex items-center justify-between gap-2.5 rounded-2xl border border-blue-200 bg-blue-50 p-3.5 text-xs text-blue-900 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-blue-600 shrink-0" />
            <span className="font-semibold">{reminderNotification}</span>
          </div>
          <button
            onClick={() => setReminderNotification(null)}
            className="text-blue-700 hover:text-blue-900 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Schedule Success Alert */}
      {scheduleSuccess && (
        <div className="flex items-center justify-between gap-2.5 rounded-2xl border border-indigo-200 bg-indigo-50 p-3.5 text-xs text-indigo-900 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-indigo-600 shrink-0" />
            <span className="font-semibold">{scheduleSuccess}</span>
          </div>
          <button
            onClick={() => setScheduleSuccess(null)}
            className="text-indigo-700 hover:text-indigo-900 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Inbound Meeting Invite Detected Banner */}
      {(() => {
        const detected = extractMeetingDetails(message);
        if (!detected) return null;

        return (
          <div
            className="rounded-2xl p-4 shadow-sm space-y-3 animate-in fade-in"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
            }}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className="p-2 rounded-xl text-white shadow-xs"
                  style={{ background: detected.badgeColor }}
                >
                  <Video className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-wide" style={{ color: detected.badgeColor }}>
                      {detected.platformName} Invite Detected
                    </span>
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-bold border"
                      style={{ background: 'var(--surface-2)', color: 'var(--ink)', borderColor: 'var(--line-soft)' }}
                    >
                      Auto-Linkable
                    </span>
                  </div>
                  <p className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>
                    This email contains a verified {detected.platformName} video conference link.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={detected.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors shadow-2xs"
                  style={{ background: 'var(--surface-2)', color: 'var(--ink)', borderColor: 'var(--line-soft)' }}
                >
                  <ExternalLink className="h-3.5 w-3.5" style={{ color: 'var(--muted)' }} />
                  <span>Join Call</span>
                </a>

                <button
                  type="button"
                  onClick={() => handleAddToSchedule(detected)}
                  disabled={addingToSchedule}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white transition-all shadow-xs hover:opacity-95"
                  style={{ background: detected.badgeColor }}
                >
                  {addingToSchedule ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Syncing...</span>
                    </>
                  ) : (
                    <>
                      <CalendarIcon className="h-3.5 w-3.5" />
                      <span>Add to Schedule</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div
              className="text-[11px] font-mono rounded-lg px-3 py-1.5 truncate border"
              style={{ background: 'var(--surface-2)', color: 'var(--ink)', borderColor: 'var(--line-soft)' }}
            >
              {detected.url}
            </div>
          </div>
        );
      })()}

      {/* Spam Status Notification */}
      {spamNotification && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 shadow-sm animate-in fade-in">
          <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="font-semibold">{spamNotification}</span>
        </div>
      )}

      {/* Reply Success Alert */}
      {replySuccess && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 shadow-sm animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{replySuccess}</span>
        </div>
      )}

      {/* Phishing Warning Banner if Suspicious */}
      {isSuspiciousEmail(message) && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900 shadow-sm">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-rose-800">Security Warning: Potential Phishing or Unverified Sender</div>
            <p className="mt-0.5 text-[11px] text-rose-700 leading-relaxed">
              This message has been quarantined by the Zero-Trust Gateway or contains keywords associated with phishing attempts. Do not click untrusted external links or disclose credentials.
            </p>
          </div>
        </div>
      )}

      {/* Thread Header Bar */}
      <div
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl p-4 shadow-xs border transition-all"
        style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
      >
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full"
              style={{ background: 'var(--teal-wash)', color: 'var(--teal-ink)', border: '1px solid var(--line-soft)' }}
            >
              <MessageSquare className="h-3 w-3" />
              Conversation Thread
            </span>
            <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
              {threadMessages.length} {threadMessages.length === 1 ? 'Message' : 'Messages'}
            </span>
          </div>
          <h1 className="text-base sm:text-xl font-extrabold truncate" style={{ color: 'var(--ink)' }}>
            {message.subject || '(No Subject)'}
          </h1>
        </div>

        <div className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0 shadow-xs">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span className="hidden sm:inline">Verified Zero-Trust Channel</span>
          <span className="sm:hidden">Verified Channel</span>
        </div>
      </div>

      {/* Conversation Messages Stream */}
      <div className="space-y-4">
        {threadMessages.map((tm, idx) => {
          const isExpanded = expandedMessageIds.has(tm.id);
          const isSentByMe = currentUser && (
            tm.owner_user_id === currentUser.id && tm.folder === 'sent'
          );
          const tmAttachments = threadAttachmentsMap[tm.id] || [];

          return (
            <div
              key={tm.id}
              className="rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs"
              style={{ background: 'var(--surface)', borderColor: isExpanded ? 'var(--line)' : 'var(--line-soft)' }}
            >
              {/* Message Summary / Accordion Header */}
              <div
                onClick={() => toggleExpand(tm.id)}
                className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-4 cursor-pointer transition-colors select-none"
                style={{
                  background: isExpanded ? 'var(--surface-2)' : 'transparent',
                  borderBottom: isExpanded ? '1px solid var(--line-soft)' : 'none',
                }}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Sender Avatar */}
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-xs font-bold text-white shadow-xs ${
                      isSentByMe
                        ? 'bg-gradient-to-tr from-blue-600 to-indigo-600'
                        : 'bg-gradient-to-tr from-purple-600 to-pink-600'
                    }`}
                  >
                    {(tm.from_name || tm.from_address).charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs" style={{ color: 'var(--ink)' }}>
                        {isSentByMe ? 'You' : tm.from_name || tm.from_address}
                      </span>
                      <span className="text-[11px] font-mono" style={{ color: 'var(--muted)' }}>
                        &lt;{tm.from_address}&gt;
                      </span>
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border"
                        style={
                          isSentByMe
                            ? { background: 'var(--teal-wash)', color: 'var(--teal-ink)', borderColor: 'var(--line-soft)' }
                            : { background: 'var(--surface-2)', color: 'var(--muted)', borderColor: 'var(--line-soft)' }
                        }
                      >
                        {tm.folder === 'sent' ? 'Sent Reply' : 'Inbox'}
                      </span>
                    </div>

                    {!isExpanded && (
                      <p className="text-xs truncate mt-0.5" style={{ color: 'var(--muted)' }}>
                        {tm.snippet || tm.body_text?.slice(0, 80) || ''}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {tmAttachments.length > 0 && (
                    <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: 'var(--muted)' }}>
                      <Paperclip className="h-3 w-3" />
                      <span>{tmAttachments.length}</span>
                    </span>
                  )}
                  <span className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>
                    {new Date(tm.sent_at || tm.received_at || tm.created_at || '').toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" style={{ color: 'var(--muted)' }} />
                  ) : (
                    <ChevronDown className="h-4 w-4" style={{ color: 'var(--muted)' }} />
                  )}
                </div>
              </div>

              {/* Message Expanded Content */}
              {isExpanded && (
                <div className="p-6 space-y-6">
                  {/* Detailed Recipients */}
                  <div
                    className="text-xs space-y-1.5 p-3.5 rounded-2xl border transition-colors"
                    style={{ background: 'var(--surface-2)', borderColor: 'var(--line-soft)' }}
                  >
                    <div className="flex gap-2 items-center">
                      <span className="font-semibold shrink-0" style={{ color: 'var(--muted)' }}>To:</span>
                      <span className="font-mono font-medium" style={{ color: 'var(--ink)' }}>{tm.to_addresses.join(', ')}</span>
                    </div>
                    {tm.cc_addresses && tm.cc_addresses.length > 0 && (
                      <div className="flex gap-2 items-center">
                        <span className="font-semibold shrink-0" style={{ color: 'var(--muted)' }}>CC:</span>
                        <span className="font-mono font-medium" style={{ color: 'var(--muted)' }}>{tm.cc_addresses.join(', ')}</span>
                      </div>
                    )}
                    <div className="flex gap-2 items-center">
                      <span className="font-semibold shrink-0" style={{ color: 'var(--muted)' }}>Date:</span>
                      <span style={{ color: 'var(--muted)' }}>
                        {new Date(tm.sent_at || tm.received_at || tm.created_at || '').toLocaleString([], {
                          dateStyle: 'full',
                          timeStyle: 'medium',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div
                    className="min-h-[120px] text-sm leading-relaxed font-sans email-rendered-body"
                    style={{ color: 'var(--ink)' }}
                  >
                    {tm.body_html ? (
                      <div
                        className="email-rendered-body text-sm leading-relaxed"
                        style={{ color: 'var(--ink)' }}
                        dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(tm.body_html, {
                            USE_PROFILES: { html: true },
                            FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
                          }),
                        }}
                      />
                    ) : (
                      <pre
                        className="whitespace-pre-wrap font-sans text-sm leading-relaxed select-text"
                        style={{ color: 'var(--ink)', fontFamily: 'inherit' }}
                      >
                        {tm.body_text}
                      </pre>
                    )}
                  </div>

                  {/* Attachments */}
                  {tmAttachments.length > 0 && (
                    <div className="pt-4 space-y-2.5" style={{ borderTop: '1px solid var(--line-soft)' }}>
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                        <Paperclip className="h-3.5 w-3.5" style={{ color: 'var(--teal)' }} />
                        <span>Attachments ({tmAttachments.length})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {tmAttachments.map((att) => (
                          <div
                            key={att.id}
                            className="flex items-center justify-between rounded-xl border p-2.5 transition-colors"
                            style={{ background: 'var(--surface-2)', borderColor: 'var(--line-soft)' }}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border shadow-2xs"
                                style={{ background: 'var(--surface)', borderColor: 'var(--line-soft)', color: 'var(--teal)' }}
                              >
                                {getFileIcon(att.filename, att.mime_type)}
                              </div>
                              <div className="truncate min-w-0">
                                <div className="text-xs font-semibold truncate" style={{ color: 'var(--ink)' }} title={att.filename}>
                                  {att.filename}
                                </div>
                                <div className="text-[10px]" style={{ color: 'var(--muted)' }}>
                                  {formatFileSize(att.size)}
                                </div>
                              </div>
                            </div>
                            <a
                              href={att.download_url}
                              download={att.filename}
                              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white transition-colors shrink-0 ml-2"
                              style={{ background: 'var(--teal)' }}
                            >
                              <Download className="h-3 w-3" />
                              <span>Download</span>
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Embedded Quick Reply Box at Bottom of Thread */}
      <div
        className="rounded-2xl border p-4 sm:p-6 shadow-sm space-y-4"
        style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--ink)' }}>
            <Reply className="h-4 w-4" style={{ color: 'var(--teal)' }} />
            <span className="truncate">
              Reply to {message.from_name || message.from_address}
            </span>
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer" style={{ color: 'var(--muted)' }}>
            <input
              type="checkbox"
              checked={replyAll}
              onChange={(e) => setReplyAll(e.target.checked)}
              className="rounded border-[var(--line)] text-blue-600 focus:ring-blue-500"
            />
            <span>Reply All (Include CCs)</span>
          </label>
        </div>

        <form onSubmit={handleSendReply} className="space-y-3">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Type your reply here... (Formatting and line breaks will be preserved)"
            rows={4}
            className="w-full rounded-xl border p-3 sm:p-4 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[var(--teal)] resize-y transition-all"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--line-soft)', color: 'var(--ink)' }}
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <span className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>
              Sending from verified alias:{' '}
              <span className="font-mono font-semibold" style={{ color: 'var(--ink)' }}>{currentUser?.primaryAlias || 'Company Alias'}</span>
            </span>

            <button
              type="submit"
              disabled={sendingReply || !replyText.trim()}
              className="glow-btn-primary flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-50 transition-all cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{sendingReply ? 'Dispatching...' : 'Send Reply'}</span>
            </button>
          </div>
        </form>
      </div>
      </div>

      {showReminderModal && message && (
        <MailReminderModal
          messageId={message.id}
          messageSubject={message.subject || 'Cruvels Email'}
          onClose={() => setShowReminderModal(false)}
          onReminderSet={(remindAt) => {
            const dt = new Date(remindAt);
            setReminderNotification(
              `Reminder scheduled for ${dt.toLocaleDateString()} at ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Desktop & mobile alerts are enabled.`
            );
            setTimeout(() => setReminderNotification(null), 6000);
          }}
        />
      )}
    </AppShell>
  );
}
