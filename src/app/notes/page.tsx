'use client';

import React, { useEffect, useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import {
  StickyNote,
  Pin,
  Plus,
  Search,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Palette,
} from 'lucide-react';
import { Note } from '@/lib/db/types';

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Personal');
  const [color, setColor] = useState<'blue' | 'purple' | 'amber' | 'emerald' | 'rose' | 'slate'>('blue');
  const [isPinned, setIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = async () => {
    try {
      const res = await fetch('/api/notes');
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, category, color, isPinned }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification('Note saved!');
        setShowAddModal(false);
        setTitle('');
        setContent('');
        fetchNotes();
        setTimeout(() => setNotification(null), 4000);
      } else {
        setError(data.error || 'Failed to save note.');
      }
    } catch {
      setError('Network error.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchNotes();
      }
    } catch {
      alert('Failed to delete note.');
    }
  };

  const getColorClasses = (c: string) => {
    switch (c) {
      case 'amber':
        return 'bg-amber-50/70 border-amber-200 text-amber-950';
      case 'emerald':
        return 'bg-emerald-50/70 border-emerald-200 text-emerald-950';
      case 'purple':
        return 'bg-purple-50/70 border-purple-200 text-purple-950';
      case 'rose':
        return 'bg-rose-50/70 border-rose-200 text-rose-950';
      case 'slate':
        return 'bg-slate-100 border-slate-300 text-slate-900';
      default:
        return 'bg-blue-50/70 border-blue-200 text-blue-950';
    }
  };

  const filteredNotes = notes.filter(
    (n) =>
      !search ||
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase()) ||
      n.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
              <StickyNote className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Personal & Team Notes</h1>
              <p className="text-xs text-slate-500">Quick scratchpad, meeting notes & idea board</p>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="glow-btn-primary flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white tracking-wide shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Create New Note</span>
          </button>
        </div>

        {/* Notifications */}
        {notification && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{notification}</span>
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes by title or keyword..."
            className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none shadow-sm"
          />
        </div>

        {/* Notes Masonry/Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              className={`rounded-3xl p-6 border shadow-sm space-y-3 transition-all flex flex-col justify-between ${getColorClasses(
                note.color
              )}`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {note.is_pinned && <Pin className="h-3.5 w-3.5 text-blue-600 fill-blue-600 shrink-0" />}
                    <h3 className="text-sm font-bold tracking-tight">{note.title}</h3>
                  </div>
                  <button
                    onClick={() => handleDelete(note.id)}
                    className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <p className="text-xs leading-relaxed whitespace-pre-wrap font-sans opacity-90">{note.content}</p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-black/5 text-[10px] text-slate-500 font-medium">
                <span className="rounded-md bg-white/60 px-2 py-0.5 border border-black/5">{note.category}</span>
                <span>{new Date(note.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Add Note Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl space-y-5 border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <StickyNote className="h-5 w-5 text-blue-600" />
                  New Memo Note
                </h3>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Sprint Backlog & Brainstorming"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Category Tag</label>
                    <input
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="e.g. Work, Ideas, Security"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Color Palette</label>
                    <select
                      value={color}
                      onChange={(e) => setColor(e.target.value as any)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none capitalize"
                    >
                      <option value="blue">Blue</option>
                      <option value="emerald">Emerald</option>
                      <option value="amber">Amber</option>
                      <option value="purple">Purple</option>
                      <option value="rose">Rose</option>
                      <option value="slate">Slate</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Content / Markdown</label>
                  <textarea
                    required
                    rows={4}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write quick notes..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none leading-relaxed font-sans"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 text-slate-700 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={isPinned}
                      onChange={(e) => setIsPinned(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-0"
                    />
                    <span>Pin to top</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="glow-btn-primary rounded-xl px-5 py-2 text-xs font-bold text-white shadow-sm disabled:opacity-50"
                    >
                      {submitting ? 'Saving...' : 'Save Note'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
