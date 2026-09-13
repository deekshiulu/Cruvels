'use client';

import React, { useEffect, useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import {
  Megaphone,
  Pin,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Trash2,
  Edit2,
} from 'lucide-react';
import { Notice, AuthSessionUser } from '@/lib/db/types';

export default function NoticeBoardPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthSessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<'General' | 'Urgent' | 'Event' | 'Policy' | 'Engineering'>('General');
  const [isPinned, setIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchNotices = async () => {
    try {
      const [noticesRes, meRes] = await Promise.all([
        fetch('/api/notices'),
        fetch('/api/auth/me'),
      ]);

      if (meRes.ok) {
        const meData = await meRes.json();
        setCurrentUser(meData.user);
      }
      if (noticesRes.ok) {
        const data = await noticesRes.json();
        setNotices(data.notices || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const isAdminOrManager = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const openCreateModal = () => {
    setEditingNotice(null);
    setTitle('');
    setContent('');
    setCategory('General');
    setIsPinned(false);
    setError(null);
    setShowModal(true);
  };

  const openEditModal = (notice: Notice) => {
    setEditingNotice(notice);
    setTitle(notice.title);
    setContent(notice.content);
    setCategory(notice.category);
    setIsPinned(notice.is_pinned);
    setError(null);
    setShowModal(true);
  };

  const handleSaveNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const url = editingNotice ? `/api/notices/${editingNotice.id}` : '/api/notices';
      const method = editingNotice ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          category,
          isPinned,
          is_pinned: isPinned,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setNotification(`Notice ${editingNotice ? 'updated' : 'published'} successfully!`);
        setShowModal(false);
        fetchNotices();
        setTimeout(() => setNotification(null), 4000);
      } else {
        setError(data.error || 'Failed to save notice.');
      }
    } catch {
      setError('Network connection error.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this notice?')) return;
    try {
      const res = await fetch(`/api/notices/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNotification('Notice deleted.');
        fetchNotices();
        setTimeout(() => setNotification(null), 3000);
      }
    } catch {
      alert('Failed to delete notice.');
    }
  };

  const filteredNotices = notices.filter((n) => {
    const matchesCategory = !categoryFilter || n.category === categoryFilter;
    const matchesSearch =
      !search ||
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Urgent':
        return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'Event':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Policy':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Engineering':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Company Notice Board</h1>
              <p className="text-xs text-slate-500">Official organizational bulletins, updates & broadcasts</p>
            </div>
          </div>

          {isAdminOrManager && (
            <button
              onClick={openCreateModal}
              className="glow-btn-primary flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white tracking-wide shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Publish Announcement</span>
            </button>
          )}
        </div>

        {/* Notifications */}
        {notification && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{notification}</span>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 rounded-2xl bg-white p-3 border border-slate-200 shadow-sm">
          <div className="relative flex-1 w-full">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search announcements..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {['', 'General', 'Urgent', 'Event', 'Policy', 'Engineering'].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                  categoryFilter === cat
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {cat || 'All Categories'}
              </button>
            ))}
          </div>
        </div>

        {/* Notices Stream */}
        <div className="space-y-4">
          {filteredNotices.length === 0 ? (
            <div className="rounded-3xl bg-white p-12 text-center border border-slate-200 text-xs text-slate-400">
              No announcements match your search or filter tags.
            </div>
          ) : (
            filteredNotices.map((notice) => (
              <div
                key={notice.id}
                className={`rounded-3xl bg-white p-6 border transition-all shadow-sm space-y-3 ${
                  notice.is_pinned ? 'border-amber-300 shadow-amber-500/5 bg-amber-50/10' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {notice.is_pinned && (
                      <span className="flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                        <Pin className="h-3 w-3 fill-amber-500" />
                        PINNED
                      </span>
                    )}
                    <span className={`rounded-md px-2.5 py-0.5 text-[10px] font-bold border ${getCategoryColor(notice.category)}`}>
                      {notice.category}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">{notice.title}</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">
                      {new Date(notice.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    {isAdminOrManager && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(notice)}
                          className="text-slate-400 hover:text-blue-600 p-1"
                          title="Edit Notice"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(notice.id)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                          title="Delete Notice"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{notice.content}</p>

                <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 font-medium">
                  Author: <span className="text-slate-700 font-semibold">{notice.author_name}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add/Edit Notice Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl space-y-5 border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Megaphone className="h-5 w-5 text-amber-600" />
                  {editingNotice ? 'Edit Announcement' : 'Publish Announcement'}
                </h3>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSaveNotice} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Announcement Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Q3 Town Hall or Scheduled Maintenance"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                    >
                      <option value="General">General</option>
                      <option value="Urgent">Urgent</option>
                      <option value="Event">Event</option>
                      <option value="Policy">Policy</option>
                      <option value="Engineering">Engineering</option>
                    </select>
                  </div>
                  <div className="flex items-center pt-6">
                    <label className="flex items-center gap-2 text-slate-700 cursor-pointer font-medium">
                      <input
                        type="checkbox"
                        checked={isPinned}
                        onChange={(e) => setIsPinned(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-0"
                      />
                      <span>Pin to Top</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Announcement Content</label>
                  <textarea
                    required
                    rows={4}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Type notice message..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="glow-btn-primary rounded-xl px-5 py-2 text-xs font-bold text-white shadow-sm disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : editingNotice ? 'Save Changes' : 'Publish Announcement'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
