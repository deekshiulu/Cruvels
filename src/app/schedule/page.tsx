'use client';

import React, { useEffect, useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  MapPin,
  Users,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { ScheduleEvent } from '@/lib/db/types';

export default function SchedulePage() {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<'meeting' | 'shift' | 'holiday' | 'event'>('meeting');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedule = async () => {
    try {
      const res = await fetch('/api/schedule');
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          eventType,
          startTime,
          endTime,
          location,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setNotification('Event added to company schedule!');
        setShowAddModal(false);
        setTitle('');
        setDescription('');
        setLocation('');
        fetchSchedule();
        setTimeout(() => setNotification(null), 4000);
      } else {
        setError(data.error || 'Failed to create event.');
      }
    } catch {
      setError('Network connection error.');
    } finally {
      setSubmitting(false);
    }
  };

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'meeting':
        return <span className="rounded-full bg-blue-50 text-blue-700 px-2.5 py-0.5 text-[10px] font-bold border border-blue-200">MEETING</span>;
      case 'shift':
        return <span className="rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-0.5 text-[10px] font-bold border border-emerald-200">SHIFT</span>;
      case 'holiday':
        return <span className="rounded-full bg-purple-50 text-purple-700 px-2.5 py-0.5 text-[10px] font-bold border border-purple-200">HOLIDAY</span>;
      default:
        return <span className="rounded-full bg-slate-100 text-slate-700 px-2.5 py-0.5 text-[10px] font-bold border border-slate-200">EVENT</span>;
    }
  };

  const filteredEvents = typeFilter ? events.filter((e) => e.event_type === typeFilter) : events;

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-200">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Workplace Schedule & Calendar</h1>
              <p className="text-xs text-slate-500">Team standups, shift rosters, holidays, and meetings</p>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="glow-btn-primary flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white tracking-wide shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Add Event / Meeting</span>
          </button>
        </div>

        {/* Notifications */}
        {notification && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{notification}</span>
          </div>
        )}

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          {['', 'meeting', 'shift', 'holiday', 'event'].map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold capitalize transition-all ${
                typeFilter === type
                  ? 'bg-purple-50 text-purple-700 border border-purple-200 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {type ? `${type}s` : 'All Events'}
            </button>
          ))}
        </div>

        {/* Schedule List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredEvents.map((evt) => (
            <div
              key={evt.id}
              className="rounded-3xl bg-white p-6 border border-slate-200 shadow-sm space-y-4 hover:border-purple-300 transition-all flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getEventBadge(evt.event_type)}
                    <h3 className="text-sm font-bold text-slate-900">{evt.title}</h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{evt.description}</p>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2 font-mono text-[11px] text-slate-700">
                  <Clock className="h-3.5 w-3.5 text-purple-600" />
                  <span>
                    {new Date(evt.start_time).toLocaleString([], {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {evt.location && (
                  <div className="flex items-center gap-2 text-slate-500">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span>{evt.location}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add Event Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl space-y-5 border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-purple-600" />
                  Create Schedule Event
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
                  <label className="block text-slate-600 font-semibold mb-1">Event Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Design Review / Team Sync"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Category</label>
                    <select
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value as any)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none capitalize"
                    >
                      <option value="meeting">Meeting</option>
                      <option value="shift">Shift</option>
                      <option value="holiday">Holiday</option>
                      <option value="event">Company Event</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Location / Room</label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Room Beta / Zoom"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Start Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">End Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Event context or agenda..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
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
                    {submitting ? 'Creating...' : 'Save to Schedule'}
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
