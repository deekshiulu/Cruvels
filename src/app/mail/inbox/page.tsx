'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Mail,
  MailOpen,
  Trash2,
  Star,
  ShieldAlert,
  Reply,
  Search,
  Pencil,
  Check,
  X,
  Paperclip,
  ExternalLink,
} from 'lucide-react';
import { Message } from '@/lib/db/types';
import { clientCache } from '@/lib/cache/clientCache';
import AppShell from '@/components/layout/AppShell';
import MailNavRail from '@/components/mail/MailNavRail';

/* ── helpers ───────────────────────────────────────────────────────────── */
function initials(name: string): string {
  return (name || 'U')
    .split(' ')
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase())
    .join('');
}

function avatarBg(name: string): string {
  const colors = ['#0A369D', '#6366F1', '#D99A1F', '#EC4899', '#2563EB', '#F97316'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + h * 31;
  return colors[Math.abs(h) % colors.length];
}

function formatTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

/* ── main ──────────────────────────────────────────────────────────────── */
function MailboxContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [messages,     setMessages]     = useState<Message[]>(() => {
    if (typeof window !== 'undefined') {
      return clientCache.get<Message[]>('inbox_list') || [];
    }
    return [];
  });
  const [loading,      setLoading]      = useState(() => {
    if (typeof window !== 'undefined') {
      return !clientCache.get<Message[]>('inbox_list');
    }
    return true;
  });
  const [selected,     setSelected]     = useState<Message | null>(null);
  const [filterUnread, setFilterUnread] = useState(false);
  const [search,       setSearch]       = useState(query);

  // Compose / reply
  const [replyOpen,   setReplyOpen]   = useState(false);
  const [replyBody,   setReplyBody]   = useState('');
  const [sending,     setSending]     = useState(false);
  const [sentNotif,   setSentNotif]   = useState(false);

  /* fetch */
  const fetchMessages = useCallback(async () => {
    const cached = clientCache.get<Message[]>('inbox_list');
    if (cached) { setMessages(cached); setLoading(false); }
    try {
      let url = `/api/mail/inbox?page=1&limit=40`;
      if (search) url += `&q=${encodeURIComponent(search)}`;
      if (filterUnread) url += '&isRead=false';
      const res = await fetch(url);
      if (res.ok) {
        const d = await res.json();
        setMessages(d.messages || []);
        clientCache.set('inbox_list', undefined, d.messages || []);
      }
    } finally { setLoading(false); }
  }, [search, filterUnread]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  /* mark read */
  const openMessage = useCallback(async (msg: Message) => {
    setSelected(msg);
    setReplyOpen(false);
    setReplyBody('');
    if (!msg.is_read) {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
      fetch(`/api/messages/${msg.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true }) }).catch(() => {});
    }
  }, []);

  /* item click: on mobile/tablet load dedicated new page, on desktop open pane */
  const handleItemClick = useCallback((msg: Message) => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      router.push(`/mail/${msg.id}`);
      return;
    }
    openMessage(msg);
  }, [router, openMessage]);

  /* mark all read */
  const markAllRead = async () => {
    setMessages(prev => prev.map(m => ({ ...m, is_read: true })));
    await fetch('/api/mail/inbox', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }) }).catch(() => {});
  };

  /* delete */
  const handleDelete = async (e: React.MouseEvent, msgId: string) => {
    e.stopPropagation();
    if (selected?.id === msgId) setSelected(null);
    setMessages(prev => prev.filter(m => m.id !== msgId));
    fetch(`/api/messages/${msgId}`, { method: 'DELETE' }).catch(() => {});
  };

  /* star */
  const handleStar = async (e: React.MouseEvent, msg: Message) => {
    e.stopPropagation();
    const newStar = !msg.is_starred;
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_starred: newStar } : m));
    if (selected?.id === msg.id) setSelected(s => s ? { ...s, is_starred: newStar } : s);
    fetch(`/api/messages/${msg.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_starred: newStar }) }).catch(() => {});
  };

  /* send reply */
  const handleSendReply = async () => {
    if (!selected || !replyBody.trim()) return;
    setSending(true);
    try {
      await fetch('/api/mail/compose', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: selected.from_address, subject: `Re: ${selected.subject}`, body: replyBody, threadId: selected.thread_id }) });
      setSentNotif(true); setReplyOpen(false); setReplyBody('');
      setTimeout(() => setSentNotif(false), 4000);
    } finally { setSending(false); }
  };

  const displayed = filterUnread ? messages.filter(m => !m.is_read) : messages;
  const unreadCount = messages.filter(m => !m.is_read).length;

  return (
    <div className="flex flex-col h-full space-y-3" style={{ color: 'var(--ink)' }}>
      {/* Sleek single-row navigation rail */}
      <MailNavRail currentFolder="inbox" unreadCount={unreadCount} />

      {/* Page subheader (desktop/tablet clean summary) */}
      <div className="hidden sm:flex pb-2 items-center justify-between" style={{ borderBottom: '1px solid var(--line-soft)' }}>
        <div className="flex items-center gap-2.5">
          <h1 className="text-base sm:text-lg font-bold" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
            Internal Messages
          </h1>
          <span className="inline-flex items-center text-xs font-bold px-2.5 py-0.5 rounded-full border shadow-2xs" style={{ background: 'var(--teal-wash)', color: 'var(--teal)', borderColor: 'var(--line-soft)' }}>
            {unreadCount > 0 ? `${unreadCount} unread` : `${messages.length} messages`}
          </span>
        </div>
      </div>

      {/* Success notif */}
      {sentNotif && (
        <div className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-xs" style={{ background: 'var(--teal-wash)', border: '1px solid var(--teal)', color: 'var(--teal-ink)' }}>
          <Check className="h-3.5 w-3.5 shrink-0" /><span className="font-semibold">Reply sent!</span>
        </div>
      )}

      {/* Main Mail Viewport: Full-width list on mobile, split-view on desktop (lg) */}
      <div className="flex flex-1 gap-4 overflow-hidden min-h-0">

        {/* ── Left: message list (w-full on mobile, fixed width on desktop) ── */}
        <div
          className="flex flex-col rounded-2xl overflow-hidden w-full lg:w-80 xl:w-96 shrink-0 transition-all"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}
        >
          {/* List toolbar */}
          <div className="p-3 space-y-2.5 shrink-0" style={{ borderBottom: '1px solid var(--line-soft)' }}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--muted)' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search mail..."
                className="w-full rounded-xl py-2 pl-9 pr-8 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[var(--teal)] transition-all"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)', color: 'var(--ink)' }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-[var(--line-soft)] text-xs"
                  style={{ color: 'var(--muted)' }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between text-xs">
              <button
                onClick={() => setFilterUnread(!filterUnread)}
                className="text-[11px] font-bold rounded-lg px-2.5 py-1 transition-all"
                style={filterUnread ? { background: 'var(--teal-wash)', color: 'var(--teal-ink)', border: '1px solid var(--line-soft)' } : { color: 'var(--muted)', background: 'var(--surface-2)' }}
              >
                {filterUnread ? 'Unread only' : `All · ${messages.length}`}
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[11px] font-semibold rounded-lg px-2.5 py-1 transition-all hover:opacity-80"
                  style={{ color: 'var(--muted)', border: '1px solid var(--line-soft)' }}
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Message rows */}
          <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: 'var(--line-soft)' }}>
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: 'var(--teal)', borderTopColor: 'transparent' }} />
              </div>
            ) : displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 gap-2">
                <MailOpen className="h-8 w-8 opacity-20" style={{ color: 'var(--ink)' }} />
                <p className="text-xs font-medium" style={{ color: 'var(--muted)' }}>No messages</p>
              </div>
            ) : displayed.map(msg => {
              const isSelected = selected?.id === msg.id;
              const bg = avatarBg(msg.from_name || msg.from_address);
              return (
                <div
                  key={msg.id}
                  onClick={() => handleItemClick(msg)}
                  className="group flex items-start gap-3 px-3.5 py-3 cursor-pointer transition-all active:scale-[0.99] select-none"
                  style={{
                    background: isSelected ? 'var(--teal-wash)' : msg.is_read ? 'transparent' : 'rgba(59,130,246,0.05)',
                  }}
                >
                  {/* Unread dot */}
                  <div className="mt-2 shrink-0 h-2 w-2 rounded-full" style={{ background: msg.is_read ? 'transparent' : 'var(--teal)' }} />
                  {/* Avatar */}
                  <div className="h-9 w-9 rounded-2xl flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-2xs" style={{ background: bg }}>
                    {initials(msg.from_name || msg.from_address)}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-xs font-bold truncate" style={{ color: isSelected ? 'var(--teal)' : 'var(--ink)', fontWeight: msg.is_read ? 500 : 700 }}>
                        {msg.from_name || msg.from_address}
                      </span>
                      <span className="text-[10px] shrink-0 font-medium" style={{ color: 'var(--muted)' }}>{formatTime(msg.received_at || msg.created_at)}</span>
                    </div>
                    <p className="text-xs truncate mt-0.5" style={{ color: isSelected ? 'var(--teal)' : 'var(--ink)', fontWeight: msg.is_read ? 400 : 600 }}>
                      {msg.subject || '(No subject)'}
                    </p>
                    <p className="text-[11px] truncate mt-0.5 line-clamp-1" style={{ color: 'var(--muted)' }}>
                      {msg.snippet || 'No preview available'}
                    </p>
                  </div>
                  {/* Hover actions */}
                  <div className="hidden sm:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1">
                    <button onClick={e => handleStar(e, msg)} className="p-1 rounded hover:bg-[var(--line-soft)]" style={{ color: msg.is_starred ? '#D99A1F' : 'var(--muted)' }}>
                      <Star className="h-3 w-3" style={msg.is_starred ? { fill: '#D99A1F' } : {}} />
                    </button>
                    <button onClick={e => handleDelete(e, msg.id)} className="p-1 rounded hover:bg-[var(--line-soft)]" style={{ color: 'var(--muted)' }}
                      onMouseEnter={e2 => (e2.currentTarget.style.color = '#F87171')}
                      onMouseLeave={e2 => (e2.currentTarget.style.color = 'var(--muted)')}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right: reading pane (hidden on mobile, visible on desktop >= 1024px) ── */}
        <div
          className="hidden lg:flex flex-1 flex-col rounded-2xl overflow-hidden min-w-0 transition-all"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}
        >
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <Mail className="h-12 w-12 opacity-10" style={{ color: 'var(--ink)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Select a message to read</p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Reading header */}
              <div className="px-6 py-4 shrink-0" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-bold truncate" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
                      {selected.subject || '(No subject)'}
                    </h2>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-2xs"
                        style={{ background: avatarBg(selected.from_name || selected.from_address) }}>
                        {initials(selected.from_name || selected.from_address)}
                      </div>
                      <span className="text-xs font-semibold truncate" style={{ color: 'var(--ink)' }}>{selected.from_name || selected.from_address}</span>
                      <span className="text-[11px]" style={{ color: 'var(--muted)' }}>·</span>
                      <span className="text-[11px] shrink-0" style={{ color: 'var(--muted)' }}>{formatTime(selected.received_at || selected.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => router.push(`/mail/${selected.id}`)}
                      className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
                      style={{ color: 'var(--muted)', border: '1px solid var(--line-soft)' }}
                      title="Open in full dedicated page"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={e => handleStar(e, selected)} className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors" style={{ color: selected.is_starred ? '#D99A1F' : 'var(--muted)', border: '1px solid var(--line-soft)' }}>
                      <Star className="h-3.5 w-3.5" style={selected.is_starred ? { fill: '#D99A1F' } : {}} />
                    </button>
                    <button onClick={() => { setReplyOpen(!replyOpen); setReplyBody(''); }}
                      className="glow-btn-primary rounded-xl px-3.5 py-1.5 text-[11px] font-bold flex items-center gap-1.5 shadow-xs">
                      <Reply className="h-3 w-3" /> Reply
                    </button>
                    <button onClick={e => handleDelete(e, selected.id)} className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors" style={{ color: 'var(--muted)', border: '1px solid var(--line-soft)' }}
                      onMouseEnter={e2 => (e2.currentTarget.style.color = '#F87171')}
                      onMouseLeave={e2 => (e2.currentTarget.style.color = 'var(--muted)')}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div
                  className="email-rendered-body text-sm leading-relaxed max-w-2xl"
                  style={{ color: 'var(--ink)' }}
                  dangerouslySetInnerHTML={{ __html: selected.body_html || selected.body_text?.replace(/\n/g, '<br/>') || '' }}
                />
                {selected.has_attachments && (
                  <div className="mt-4 flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--muted)' }}>
                    <Paperclip className="h-3.5 w-3.5" /> Attachment included
                  </div>
                )}
              </div>

              {/* Inline reply */}
              {replyOpen && (
                <div className="px-6 py-4 shrink-0" style={{ borderTop: '1px solid var(--line)' }}>
                  <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--line)' }}>
                    <div className="px-3 py-2 text-[11px] font-semibold" style={{ background: 'var(--paper)', borderBottom: '1px solid var(--line)', color: 'var(--muted)' }}>
                      Replying to {selected.from_name || selected.from_address}
                    </div>
                    <textarea
                      rows={4} value={replyBody} onChange={e => setReplyBody(e.target.value)}
                      placeholder="Write your reply..." autoFocus
                      className="w-full p-3 text-xs focus:outline-none leading-relaxed"
                      style={{ background: 'var(--surface)', color: 'var(--ink)', resize: 'none' }}
                    />
                    <div className="flex items-center justify-end gap-2 px-3 py-2" style={{ background: 'var(--paper)', borderTop: '1px solid var(--line)' }}>
                      <button onClick={() => setReplyOpen(false)} className="text-xs px-3 py-1.5 rounded-md font-semibold"
                        style={{ color: 'var(--muted)', border: '1px solid var(--line)' }}>Cancel</button>
                      <button onClick={handleSendReply} disabled={sending || !replyBody.trim()}
                        className="glow-btn-primary text-xs px-3 py-1.5 rounded-md font-bold disabled:opacity-50">
                        {sending ? 'Sending…' : 'Send'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MailboxPage() {
  return (
    <AppShell>
      <Suspense fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: 'var(--teal)', borderTopColor: 'transparent' }} />
        </div>
      }>
        <MailboxContent />
      </Suspense>
    </AppShell>
  );
}
