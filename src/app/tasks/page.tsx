'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { clientCache } from '@/lib/cache/clientCache';
import AppShell from '@/components/layout/AppShell';
import {
  CheckSquare,
  Plus,
  Clock,
  AlertCircle,
  AlertOctagon,
  CheckCircle2,
  X,
  Edit2,
  Trash2,
  Search,
  ChevronDown,
  User as UserIcon,
  Shield,
  MessageSquare,
  Send,
  History,
  Check,
} from 'lucide-react';
import { TaskItem, Employee } from '@/lib/db/types';

const COL_CONFIG: { id: TaskItem['status']; label: string; accent: string }[] = [
  { id: 'todo',        label: 'To Do',       accent: '#6B7E7A' },
  { id: 'in_progress', label: 'In Progress', accent: '#2563EB' },
  { id: 'blocked',     label: 'Blocked',     accent: '#EF4444' },
  { id: 'in_review',   label: 'In Review',   accent: '#D99A1F' },
  { id: 'done',        label: 'Completed',   accent: '#4ADE80' },
];

const PRIORITY_STYLE: Record<string, { bg: string; color: string }> = {
  urgent: { bg: 'rgba(239,68,68,0.15)',  color: '#F87171' },
  high:   { bg: 'rgba(217,154,31,0.2)',  color: '#D99A1F' },
  medium: { bg: 'rgba(37,99,235,0.16)', color: '#2563EB' },
  low:    { bg: 'rgba(107,126,122,0.15)',color: '#8A9E9A' },
};

function dueDateLabel(dateStr: string): string {
  if (!dateStr) return '';
  const due = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0)   return `Overdue by ${Math.abs(diff)}d`;
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  return `In ${diff} days`;
}

function avatarColor(name: string): string {
  const colors = ['#0A369D', '#D99A1F', '#6366F1', '#EC4899', '#2563EB', '#F97316'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + h * 31;
  return colors[Math.abs(h) % colors.length];
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    if (typeof window !== 'undefined') {
      return clientCache.get<TaskItem[]>('tasks_list') || [];
    }
    return [];
  });
  const [employees, setEmployees] = useState<Employee[]>(() => {
    if (typeof window !== 'undefined') {
      return clientCache.get<Employee[]>('employees_list') || [];
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      return !clientCache.get<TaskItem[]>('tasks_list');
    }
    return true;
  });

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskItem['status']>('todo');
  const [priority, setPriority] = useState<TaskItem['priority']>('medium');
  const [dueDate, setDueDate] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [assignedPocId, setAssignedPocId] = useState('');
  const [requiresAcknowledgement, setRequiresAcknowledgement] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Detail drawer comments state
  const [newComment, setNewComment] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [detailTab, setDetailTab] = useState<'details' | 'comments' | 'activity'>('details');

  // Filters
  const [filterText, setFilterText] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('everyone');
  const [filterPriority, setFilterPriority] = useState('any');

  /* ── Data Fetching ─────────────────────────────────────────────────────── */
  const fetchTasks = useCallback(async () => {
    const res = await fetch('/api/tasks');
    if (res.ok) {
      const d = await res.json();
      setTasks(d.tasks || []);
      clientCache.set('tasks_list', undefined, d.tasks || []);
      // If a task was selected, update its reference
      setSelectedTask((prev) => {
        if (!prev) return null;
        return (d.tasks || []).find((t: TaskItem) => t.id === prev.id) || prev;
      });
    }
    setLoading(false);
  }, []);

  const fetchTasksAndEmployees = useCallback(async () => {
    const cached = clientCache.get<Employee[]>('employees_list');
    if (cached) {
      setEmployees(cached);
      await fetchTasks();
    } else {
      const [tr, er] = await Promise.all([fetch('/api/tasks'), fetch('/api/employees')]);
      if (tr.ok) {
        const d = await tr.json();
        setTasks(d.tasks || []);
      }
      if (er.ok) {
        const d = await er.json();
        setEmployees(d.employees || []);
        clientCache.set('employees_list', undefined, d.employees || []);
      }
      setLoading(false);
    }
  }, [fetchTasks]);

  useEffect(() => {
    const cached = clientCache.get<TaskItem[]>('tasks_list');
    if (cached) {
      setTasks(cached);
      setLoading(false);
    }
    fetchTasksAndEmployees();
  }, [fetchTasksAndEmployees]);

  /* ── Filtered View ─────────────────────────────────────────────────────── */
  const filtered = useMemo(
    () =>
      tasks.filter((t) => {
        if (filterText) {
          const q = filterText.toLowerCase();
          const matchTitle = t.title.toLowerCase().includes(q);
          const matchAssignee = (t.assigned_to_name || '').toLowerCase().includes(q);
          const matchPoc = (t.assigned_poc_name || '').toLowerCase().includes(q);
          if (!matchTitle && !matchAssignee && !matchPoc) return false;
        }
        if (filterAssignee !== 'everyone' && t.assigned_to_id !== filterAssignee) return false;
        if (filterPriority !== 'any' && t.priority !== filterPriority) return false;
        return true;
      }),
    [tasks, filterText, filterAssignee, filterPriority]
  );

  /* ── Modal Helpers ─────────────────────────────────────────────────────── */
  const openCreateModal = () => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setStatus('todo');
    setPriority('medium');
    setDueDate(new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]);
    setAssignedToId(employees[0]?.id || '');
    setAssignedPocId('');
    setRequiresAcknowledgement(false);
    setError(null);
    setShowModal(true);
  };

  const openEditModal = (task: TaskItem) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setStatus(task.status);
    setPriority(task.priority);
    setDueDate(task.due_date);
    setAssignedToId(task.assigned_to_id);
    setAssignedPocId(task.assigned_poc_id || '');
    setRequiresAcknowledgement(Boolean(task.requires_acknowledgement));
    setError(null);
    setShowModal(true);
  };

  /* ── CRUD & Actions ────────────────────────────────────────────────────── */
  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const url = editingTask ? `/api/tasks/${editingTask.id}` : '/api/tasks';
      const method = editingTask ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          status,
          priority,
          dueDate,
          due_date: dueDate,
          assignedToId,
          assigned_to_id: assignedToId,
          assignedPocId: assignedPocId || undefined,
          assigned_poc_id: assignedPocId || undefined,
          requiresAcknowledgement,
          requires_acknowledgement: requiresAcknowledgement,
        }),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        setNotification(`Task ${editingTask ? 'updated' : 'created'}!`);
        setShowModal(false);
        fetchTasks();
        setTimeout(() => setNotification(null), 4000);
      } else {
        setError(d.error || 'Failed to save.');
      }
    } catch {
      setError('Network error.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (taskId: string, newStatus: TaskItem['status']) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) fetchTasks();
  };

  const handleDeleteTask = async (taskId: string, taskTitle: string) => {
    if (!confirm(`Delete task "${taskTitle}"?`)) return;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (selectedTask?.id === taskId) setSelectedTask(null);
    const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    if (res.ok) {
      setNotification('Task deleted.');
      setTimeout(() => setNotification(null), 4000);
      fetchTasks();
    }
  };

  const handleAcknowledgeReceipt = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/acknowledge`, { method: 'POST' });
      const d = await res.json();
      if (res.ok && d.success) {
        setNotification('Task receipt acknowledged!');
        fetchTasks();
        setTimeout(() => setNotification(null), 4000);
      } else {
        alert(d.error || 'Failed to acknowledge task.');
      }
    } catch {
      alert('Network error while acknowledging.');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newComment.trim()) return;
    setCommentSubmitting(true);
    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        setNewComment('');
        setSelectedTask(d.task);
        fetchTasks();
      } else {
        alert(d.error || 'Failed to post comment.');
      }
    } catch {
      alert('Network error posting comment.');
    } finally {
      setCommentSubmitting(false);
    }
  };

  /* ── Render ────────────────────────────────────────────────────────────── */
  return (
    <AppShell>
      <div className="flex flex-col h-full gap-0" style={{ color: 'var(--ink)' }}>
        {/* Page Title Strip */}
        <div className="pb-3 mb-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--line)' }}>
          <div>
            <h1
              className="text-lg font-bold"
              style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}
            >
              Tasks Module
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              Collaborative 5-Stage Workflow, POC Supervision & Universal Acknowledgement
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold border" style={{ background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--muted)' }}>
              {tasks.length} Total Tasks
            </span>
          </div>
        </div>

        {/* Notification */}
        {notification && (
          <div
            className="mb-3 flex items-center gap-2 rounded-md px-3 py-2 text-xs"
            style={{
              background: 'var(--teal-wash)',
              border: '1px solid var(--teal)',
              color: 'var(--teal-ink)',
            }}
          >
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span className="font-semibold">{notification}</span>
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
              style={{ color: 'var(--muted)' }}
            />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Search title, assignee, or POC..."
              className="w-full rounded-md py-1.5 pl-8 pr-3 text-xs focus:outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)' }}
            />
          </div>

          {/* Assignee filter */}
          <div className="relative">
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="appearance-none rounded-md py-1.5 pl-3 pr-7 text-xs font-medium focus:outline-none cursor-pointer"
              style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)' }}
            >
              <option value="everyone">All Assignees</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3"
              style={{ color: 'var(--muted)' }}
            />
          </div>

          {/* Priority filter */}
          <div className="relative">
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="appearance-none rounded-md py-1.5 pl-3 pr-7 text-xs font-medium focus:outline-none cursor-pointer"
              style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)' }}
            >
              <option value="any">Any priority</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3"
              style={{ color: 'var(--muted)' }}
            />
          </div>

          <div className="flex-1" />

          {/* New Task button */}
          <button
            onClick={openCreateModal}
            className="glow-btn-primary rounded-md px-4 py-1.5 text-xs font-bold flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> New Task
          </button>
        </div>

        {/* 5-Column Kanban Board */}
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div
              className="h-7 w-7 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: 'var(--teal)', borderTopColor: 'transparent' }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 items-start flex-1 overflow-y-auto pb-4">
            {COL_CONFIG.map((col) => {
              const colTasks = filtered.filter((t) => t.status === col.id);
              return (
                <div
                  key={col.id}
                  className="flex flex-col rounded-lg overflow-hidden"
                  style={{ background: 'var(--surface)', border: '1px solid var(--line)', minHeight: 240 }}
                >
                  {/* Column header strip */}
                  <div className="h-1 w-full shrink-0" style={{ background: col.accent }} />
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold" style={{ color: 'var(--ink)' }}>
                        {col.label}
                      </span>
                      <span
                        className="rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-extrabold"
                        style={{ background: 'var(--paper)', color: 'var(--muted)' }}
                      >
                        {colTasks.length}
                      </span>
                    </div>
                    <button
                      onClick={openCreateModal}
                      className="rounded p-0.5 transition-colors"
                      style={{ color: 'var(--muted)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = col.accent)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Task cards */}
                  <div className="flex flex-col gap-2.5 px-2 pb-3">
                    {colTasks.length === 0 && (
                      <div className="text-center py-8 text-[11px]" style={{ color: 'var(--muted)' }}>
                        No tasks in {col.label}
                      </div>
                    )}
                    {colTasks.map((task) => {
                      const ps = PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.low;
                      const dd = dueDateLabel(task.due_date);
                      const isOverdue = dd.startsWith('Overdue');
                      const initial = (task.assigned_to_name || '?')[0].toUpperCase();
                      const bg = avatarColor(task.assigned_to_name || 'X');
                      const commentCount = task.comments?.length || 0;

                      return (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => setSelectedTask(task)}
                          className="rounded-md p-3 flex flex-col gap-2 group cursor-pointer transition-all hover:shadow-md touch-manipulation active:scale-[0.98] text-left w-full"
                          style={{ background: 'var(--paper)', border: '1px solid var(--line)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.borderColor = col.accent)}
                          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
                        >
                          {/* Top row: Priority & Quick Actions */}
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className="rounded px-2 py-0.5 text-[10px] font-bold capitalize"
                                style={{ background: ps.bg, color: ps.color }}
                              >
                                {task.priority}
                              </span>
                              {task.status === 'blocked' && (
                                <span className="rounded px-1.5 py-0.5 text-[9px] font-extrabold bg-red-500/20 text-red-500 flex items-center gap-1">
                                  <AlertOctagon className="h-2.5 w-2.5" /> Blocked
                                </span>
                              )}
                            </div>
                            <div
                              className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => openEditModal(task)}
                                className="p-1.5 rounded touch-manipulation min-h-[36px] min-w-[36px] flex items-center justify-center"
                                style={{ color: 'var(--muted)' }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--teal)')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTask(task.id, task.title)}
                                className="p-1.5 rounded touch-manipulation min-h-[36px] min-w-[36px] flex items-center justify-center"
                                style={{ color: 'var(--muted)' }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = '#F87171')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>

                          {/* Title */}
                          <p className="text-xs font-semibold leading-snug" style={{ color: 'var(--ink)' }}>
                            {task.title}
                          </p>

                          {/* POC and Acknowledgement Status Chips */}
                          <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                            {task.assigned_poc_name && (
                              <span
                                className="px-1.5 py-0.5 rounded font-medium border flex items-center gap-1"
                                style={{ background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                              >
                                <Shield className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400" /> POC: {task.assigned_poc_name.split(' ')[0]}
                              </span>
                            )}
                            {task.requires_acknowledgement && (
                              task.acknowledged_at ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                                  <Check className="h-2.5 w-2.5" /> Acked
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                                  <Clock className="h-2.5 w-2.5" /> Await Ack
                                </span>
                              )
                            )}
                          </div>

                          {/* Bottom row: Due, Comments count, Quick status move, Avatar */}
                          <div className="flex items-center justify-between gap-1.5 mt-1 pt-1.5 border-t border-[var(--line)]">
                            <div className="flex items-center gap-2">
                              <span
                                className="text-[10px] font-semibold flex items-center gap-1"
                                style={{ color: isOverdue ? '#F87171' : 'var(--muted)' }}
                              >
                                <Clock className="h-2.5 w-2.5" /> {dd}
                              </span>
                              {commentCount > 0 && (
                                <span className="text-[10px] flex items-center gap-0.5" style={{ color: 'var(--muted)' }}>
                                  <MessageSquare className="h-2.5 w-2.5" /> {commentCount}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <select
                                value={task.status}
                                onChange={(e) => handleUpdateStatus(task.id, e.target.value as any)}
                                className="text-[9px] font-semibold rounded py-0.5 px-1 focus:outline-none cursor-pointer"
                                style={{
                                  background: 'var(--surface)',
                                  border: '1px solid var(--line)',
                                  color: 'var(--muted)',
                                }}
                              >
                                <option value="todo">To Do</option>
                                <option value="in_progress">In Progress</option>
                                <option value="blocked">Blocked</option>
                                <option value="in_review">In Review</option>
                                <option value="done">Completed</option>
                              </select>
                              <div
                                className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white shrink-0"
                                style={{ background: bg }}
                                title={`Assignee: ${task.assigned_to_name}`}
                              >
                                {initial}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Task Detail Modal / Drawer (§ 9.3) */}
      {selectedTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4"
          style={{ background: 'rgba(18,32,42,0.6)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedTask(null); }}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl shadow-2xl overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: 'var(--line)' }}>
              <div className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-bold text-[var(--ink)]">Task Overview</span>
                <span
                  className="rounded px-2 py-0.5 text-[10px] font-bold capitalize"
                  style={{
                    background: (PRIORITY_STYLE[selectedTask.priority] || PRIORITY_STYLE.low).bg,
                    color: (PRIORITY_STYLE[selectedTask.priority] || PRIORITY_STYLE.low).color,
                  }}
                >
                  {selectedTask.priority}
                </span>
                {selectedTask.status === 'blocked' && (
                  <span className="rounded px-2 py-0.5 text-[10px] font-extrabold bg-red-500/20 text-red-500 flex items-center gap-1">
                    <AlertOctagon className="h-3 w-3" /> Blocked
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    openEditModal(selectedTask);
                    setSelectedTask(null);
                  }}
                  className="flex items-center justify-center rounded-lg transition-colors touch-manipulation active:scale-90 min-h-[40px] min-w-[40px] text-[var(--muted)] hover:text-blue-600"
                  aria-label="Edit task"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTask(null)}
                  className="flex items-center justify-center rounded-lg transition-colors touch-manipulation active:scale-90 min-h-[40px] min-w-[40px] text-[var(--muted)] hover:text-[var(--ink)]"
                  aria-label="Close task detail"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              <div>
                <h2 className="text-base font-bold leading-tight" style={{ color: 'var(--ink)' }}>
                  {selectedTask.title}
                </h2>
                <div className="flex items-center gap-4 mt-2 text-xs flex-wrap" style={{ color: 'var(--muted)' }}>
                  <span>Assignee: <strong className="text-[var(--ink)]">{selectedTask.assigned_to_name}</strong></span>
                  {selectedTask.assigned_poc_name && (
                    <span>Assigned POC: <strong className="text-[var(--ink)]">{selectedTask.assigned_poc_name}</strong></span>
                  )}
                  <span>Due Date: <strong className="text-[var(--ink)]">{selectedTask.due_date}</strong> ({dueDateLabel(selectedTask.due_date)})</span>
                </div>
              </div>

              {/* Status Transition & Acknowledgement Action Bar */}
              <div className="p-4 rounded-lg flex items-center justify-between gap-4 flex-wrap" style={{ background: 'var(--paper)', border: '1px solid var(--line)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--muted)]">Status:</span>
                  <select
                    value={selectedTask.status}
                    onChange={(e) => handleUpdateStatus(selectedTask.id, e.target.value as any)}
                    className="text-xs font-bold rounded px-2 py-1 focus:outline-none cursor-pointer"
                    style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="blocked">Blocked</option>
                    <option value="in_review">In Review</option>
                    <option value="done">Completed</option>
                  </select>
                </div>

                {/* Acknowledgement Status & Action (§ 9.3) */}
                <div>
                  {selectedTask.requires_acknowledgement ? (
                    selectedTask.acknowledged_at ? (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Receipt Acknowledged ({new Date(selectedTask.acknowledged_at).toLocaleDateString()})</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAcknowledgeReceipt(selectedTask.id)}
                        className="glow-btn-primary px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5"
                      >
                        <Check className="h-3.5 w-3.5" /> Acknowledge Task Receipt
                      </button>
                    )
                  ) : (
                    <span className="text-xs text-[var(--muted)]">Acknowledgement not required</span>
                  )}
                </div>
              </div>

              {/* Tabs: Details, Comments, Activity */}
              <div className="flex items-center gap-3 border-b pb-2 text-xs font-semibold" style={{ borderColor: 'var(--line)' }}>
                <button
                  onClick={() => setDetailTab('details')}
                  className={`pb-1 transition-colors ${detailTab === 'details' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 font-bold' : 'text-[var(--muted)]'}`}
                >
                  Description
                </button>
                <button
                  onClick={() => setDetailTab('comments')}
                  className={`pb-1 transition-colors flex items-center gap-1 ${detailTab === 'comments' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 font-bold' : 'text-[var(--muted)]'}`}
                >
                  <MessageSquare className="h-3.5 w-3.5" /> Comments ({selectedTask.comments?.length || 0})
                </button>
                <button
                  onClick={() => setDetailTab('activity')}
                  className={`pb-1 transition-colors flex items-center gap-1 ${detailTab === 'activity' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 font-bold' : 'text-[var(--muted)]'}`}
                >
                  <History className="h-3.5 w-3.5" /> Activity Log ({selectedTask.activity?.length || 0})
                </button>
              </div>

              {/* Tab: Details */}
              {detailTab === 'details' && (
                <div className="space-y-3">
                  <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--ink)' }}>
                    {selectedTask.description || 'No detailed description provided for this task.'}
                  </p>
                  {selectedTask.attachments && selectedTask.attachments.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-[var(--line)]">
                      <h4 className="text-xs font-bold mb-2 text-[var(--ink)]">Attachments</h4>
                      <div className="flex flex-col gap-1.5">
                        {selectedTask.attachments.map((att) => (
                          <a
                            key={att.id}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5"
                          >
                            📎 {att.name} {att.size_bytes ? `(${(att.size_bytes / 1024).toFixed(1)} KB)` : ''}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Comments Thread (§ 9.3) */}
              {detailTab === 'comments' && (
                <div className="space-y-4">
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {(!selectedTask.comments || selectedTask.comments.length === 0) ? (
                      <p className="text-xs text-[var(--muted)] italic py-4 text-center">No comments yet. Start the discussion below.</p>
                    ) : (
                      selectedTask.comments.map((c) => (
                        <div key={c.id} className="p-3 rounded-lg flex flex-col gap-1" style={{ background: 'var(--paper)', border: '1px solid var(--line)' }}>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-[var(--ink)]">{c.author_name}</span>
                            <span className="text-[var(--muted)]">{new Date(c.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-xs text-[var(--ink)] leading-normal whitespace-pre-wrap">{c.content}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Comment Input */}
                  <form onSubmit={handleAddComment} className="flex gap-2">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment or update for the team..."
                      className="flex-1 rounded-md px-3 py-2 text-xs focus:outline-none"
                      style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                    />
                    <button
                      type="submit"
                      disabled={commentSubmitting || !newComment.trim()}
                      className="glow-btn-primary px-3 py-2 rounded-md text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" /> Send
                    </button>
                  </form>
                </div>
              )}

              {/* Tab: Activity Log (§ 9.3) */}
              {detailTab === 'activity' && (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {selectedTask.activity?.map((act, i) => (
                    <div key={i} className="text-xs py-1.5 px-2 rounded flex items-center justify-between" style={{ background: 'var(--paper)' }}>
                      <div>
                        <strong className="text-[var(--ink)]">{act.by_name}</strong>{' '}
                        <span className="text-[var(--muted)]">
                          {act.action} {act.field ? `field "${act.field}"` : ''} {act.from && act.to ? `(${act.from} → ${act.to})` : ''}
                        </span>
                      </div>
                      <span className="text-[10px] text-[var(--muted)]">{new Date(act.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t flex justify-end" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
              <button
                onClick={() => setSelectedTask(null)}
                className="px-4 py-1.5 rounded text-xs font-semibold border"
                style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4"
          style={{ background: 'rgba(18,32,42,0.6)' }}
        >
          <div
            className="w-full max-w-lg rounded-xl p-6 shadow-2xl space-y-4"
            style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
          >
            <div className="flex items-center justify-between pb-3" style={{ borderBottom: '1px solid var(--line)' }}>
              <h3
                className="text-sm font-bold flex items-center gap-2"
                style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}
              >
                <CheckSquare className="h-4 w-4" style={{ color: 'var(--teal)' }} />
                {editingTask ? 'Edit Task' : 'New Task'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ color: 'var(--muted)' }}>
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div
                className="flex items-center gap-2 rounded-md px-3 py-2 text-xs"
                style={{
                  background: 'rgba(224,82,82,0.08)',
                  border: '1px solid rgba(224,82,82,0.3)',
                  color: '#F87171',
                }}
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSaveTask} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>
                  Task Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Task title..."
                  className="w-full rounded-md p-2.5 focus:outline-none"
                  style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full rounded-md p-2.5 focus:outline-none"
                    style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>
                    Due Date
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-md p-2.5 focus:outline-none"
                    style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>
                    Assignee (Owner)
                  </label>
                  <select
                    value={assignedToId}
                    onChange={(e) => setAssignedToId(e.target.value)}
                    className="w-full rounded-md p-2.5 focus:outline-none"
                    style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.designation || 'Staff'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>
                    Assigned POC / Review Owner (§ 9.2)
                  </label>
                  <select
                    value={assignedPocId}
                    onChange={(e) => setAssignedPocId(e.target.value)}
                    className="w-full rounded-md p-2.5 focus:outline-none"
                    style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                  >
                    <option value="">None (Direct Assignment)</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} {emp.is_group_leader ? '★ Squad Lead' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>
                  Status Column
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full rounded-md p-2.5 focus:outline-none"
                  style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="blocked">Blocked</option>
                  <option value="in_review">In Review</option>
                  <option value="done">Completed</option>
                </select>
              </div>

              {/* Require Acknowledgement Toggle (§ 9.3) */}
              <label className="flex items-center gap-2 p-2.5 rounded-md cursor-pointer border" style={{ background: 'var(--paper)', borderColor: 'var(--line)' }}>
                <input
                  type="checkbox"
                  checked={requiresAcknowledgement}
                  onChange={(e) => setRequiresAcknowledgement(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <div>
                  <span className="font-bold text-[var(--ink)] block">Require Assignee Receipt Acknowledgement</span>
                  <span className="text-[10px] text-[var(--muted)]">Requires assignee to explicitly confirm receipt upon assignment.</span>
                </div>
              </label>

              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>
                  Description & Instructions
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Task details, requirements, acceptance criteria..."
                  className="w-full rounded-md p-2.5 focus:outline-none leading-relaxed"
                  style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)', resize: 'none' }}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2" style={{ borderTop: '1px solid var(--line)' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-md px-4 py-2 text-xs font-semibold"
                  style={{ color: 'var(--muted)', border: '1px solid var(--line)', background: 'var(--paper)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="glow-btn-primary rounded-md px-4 py-2 text-xs font-bold disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : editingTask ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
