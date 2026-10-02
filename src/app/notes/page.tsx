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
import { clientCache } from '@/lib/cache/clientCache';

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>(() => {
    if (typeof window !== 'undefined') {
      return clientCache.get<Note[]>('notes_list') || [];
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      return !clientCache.get<Note[]>('notes_list');
    }
    return true;
  });
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
        clientCache.set('notes_list', undefined, data.notes || []);
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl tag-teal">
              <StickyNote className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--ink)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>Personal & Team Notes</h1>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Quick scratchpad, meeting notes & idea board</p>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold tracking-wide shadow-sm"
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
          <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5" style={{ color:'var(--muted)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes by title or keyword..."
            className="w-full rounded-md py-1.5 pl-8 pr-4 text-xs focus:outline-none"
            style={{ background:'var(--surface)', border:'1px solid var(--line)', color:'var(--ink)' }}
          />
        </div>

        {/* Empty state */}
        {!loading && filteredNotes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <StickyNote className="h-10 w-10 opacity-15" style={{ color:'var(--ink)' }} />
            <p className="text-sm font-semibold" style={{ color:'var(--muted)' }}>
              {search ? `No notes matching "${search}"` : 'No notes yet'}
            </p>
            {!search && (
              <>
                <p className="text-xs" style={{ color:'var(--muted)' }}>Jot down your first note to get started.</p>
                <button onClick={() => setShowAddModal(true)} className="glow-btn-primary mt-2 rounded-md px-4 py-2 text-xs font-bold">
                  <Plus className="h-3.5 w-3.5" /> Create Note
                </button>
              </>
            )}
          </div>
        )}

        {/* Notes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              className="rounded-xl p-5 space-y-3 transition-all flex flex-col justify-between"
              style={{ background:'var(--surface)', border:'1px solid var(--line)' }}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {note.is_pinned && <Pin className="h-3.5 w-3.5 shrink-0" style={{ color:'var(--teal)' }} />}
                    <h3 className="text-sm font-bold" style={{ fontFamily:'Bricolage Grotesque, sans-serif', color:'var(--ink)' }}>{note.title}</h3>
                  </div>
                  <button onClick={() => handleDelete(note.id)} className="p-1 transition-colors" style={{ color:'var(--muted)' }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color:'var(--muted)' }}>{note.content}</p>
              </div>

              <div className="flex items-center justify-between pt-3 text-[10px] font-medium" style={{ borderTop:'1px solid var(--line)', color:'var(--muted)' }}>
                <span className="rounded px-2 py-0.5" style={{ background:'var(--teal-dim)', color:'var(--teal)' }}>{note.category}</span>
                <span>{new Date(note.updated_at).toLocaleDateString([], { month:'short', day:'numeric' })}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Add Note Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4 animate-in fade-in" style={{ background:'rgba(18,32,42,0.55)' }}>
            <div className="w-full max-w-md rounded-xl p-6 shadow-2xl space-y-4" style={{ background:'var(--surface)', border:'1px solid var(--line)' }}>
              <div className="flex items-center justify-between pb-3" style={{ borderBottom:'1px solid var(--line)' }}>
                <h3 className="text-sm font-bold flex items-center gap-2" style={{ fontFamily:'Bricolage Grotesque, sans-serif', color:'var(--ink)' }}>
                  <StickyNote className="h-4 w-4" style={{ color:'var(--teal)' }} />
                  New Note
                </h3>
                <button onClick={() => setShowAddModal(false)} style={{ color:'var(--muted)' }}><X className="h-4 w-4" /></button>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleCreate} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color:'var(--muted)' }}>Title</label>
                  <input type="text" required value={title} onChange={e=>setTitle(e.target.value)}
                    placeholder="e.g. Sprint Backlog & Brainstorming"
                    className="w-full rounded-md p-2.5 focus:outline-none"
                    style={{ background:'var(--paper)', border:'1px solid var(--line)', color:'var(--ink)' }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1" style={{ color:'var(--muted)' }}>Category</label>
                    <input type="text" value={category} onChange={e=>setCategory(e.target.value)}
                      placeholder="e.g. Work, Ideas"
                      className="w-full rounded-md p-2.5 focus:outline-none"
                      style={{ background:'var(--paper)', border:'1px solid var(--line)', color:'var(--ink)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1" style={{ color:'var(--muted)' }}>Color</label>
                    <select value={color} onChange={e=>setColor(e.target.value as any)}
                      className="w-full rounded-md p-2.5 focus:outline-none capitalize"
                      style={{ background:'var(--paper)', border:'1px solid var(--line)', color:'var(--ink)' }}>
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
                  <label className="block text-[11px] font-semibold mb-1" style={{ color:'var(--muted)' }}>Content</label>
                  <textarea required rows={4} value={content} onChange={e=>setContent(e.target.value)}
                    placeholder="Write quick notes..."
                    className="w-full rounded-md p-2.5 focus:outline-none leading-relaxed"
                    style={{ background:'var(--paper)', border:'1px solid var(--line)', color:'var(--ink)', resize:'none' }}
                  />
                </div>

                <div className="flex items-center justify-between pt-2" style={{ borderTop:'1px solid var(--line)' }}>
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-xs" style={{ color:'var(--ink)' }}>
                    <input type="checkbox" checked={isPinned} onChange={e=>setIsPinned(e.target.checked)}
                      className="rounded cursor-pointer" style={{ accentColor:'var(--teal)' }} />
                    <span>Pin to top</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setShowAddModal(false)}
                      className="rounded-md px-3 py-2 text-xs font-semibold"
                      style={{ color:'var(--muted)', border:'1px solid var(--line)', background:'var(--paper)' }}>
                      Cancel
                    </button>
                    <button type="submit" disabled={submitting}
                      className="glow-btn-primary rounded-md px-4 py-2 text-xs font-bold disabled:opacity-50">
                      {submitting ? 'Saving…' : 'Save Note'}
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
