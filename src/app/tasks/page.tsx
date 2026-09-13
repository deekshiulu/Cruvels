'use client';

import React, { useEffect, useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import {
  CheckSquare,
  Plus,
  Clock,
  User,
  AlertCircle,
  CheckCircle2,
  X,
  Edit2,
  Trash2,
} from 'lucide-react';
import { TaskItem, Employee } from '@/lib/db/types';

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Add / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskItem['status']>('todo');
  const [priority, setPriority] = useState<TaskItem['priority']>('medium');
  const [dueDate, setDueDate] = useState('');
  const [assignedToId, setAssignedToId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mobileActiveCol, setMobileActiveCol] = useState<string>('all');

  const fetchTasksAndEmployees = async () => {
    try {
      const [tasksRes, empsRes] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/employees'),
      ]);

      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(data.tasks || []);
      }
      if (empsRes.ok) {
        const empsData = await empsRes.json();
        setEmployees(empsData.employees || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasksAndEmployees();
  }, []);

  const openCreateModal = () => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setStatus('todo');
    setPriority('medium');
    setDueDate(new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]);
    setAssignedToId(employees[0]?.id || '');
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
    setError(null);
    setShowModal(true);
  };

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
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setNotification(`Task "${title}" ${editingTask ? 'updated' : 'created'} successfully!`);
        setShowModal(false);
        fetchTasksAndEmployees();
        setTimeout(() => setNotification(null), 4000);
      } else {
        setError(data.error || 'Failed to save task.');
      }
    } catch {
      setError('Network connection error.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (taskId: string, newStatus: TaskItem['status']) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchTasksAndEmployees();
      }
    } catch {
      alert('Failed to update task status.');
    }
  };

  const handleDeleteTask = async (taskId: string, taskTitle: string) => {
    if (!confirm(`Are you sure you want to delete task "${taskTitle}"?`)) return;

    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (res.ok) {
        setNotification('Task deleted.');
        fetchTasksAndEmployees();
        setTimeout(() => setNotification(null), 4000);
      }
    } catch {
      alert('Failed to delete task.');
    }
  };

  const columns: { id: TaskItem['status']; label: string; color: string }[] = [
    { id: 'todo', label: 'To Do', color: 'border-slate-300' },
    { id: 'in_progress', label: 'In Progress', color: 'border-blue-400' },
    { id: 'in_review', label: 'In Review', color: 'border-amber-400' },
    { id: 'done', label: 'Completed', color: 'border-emerald-400' },
  ];

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'urgent':
        return <span className="rounded-md bg-rose-50 text-rose-700 px-2 py-0.5 text-[9px] font-bold border border-rose-200">URGENT</span>;
      case 'high':
        return <span className="rounded-md bg-amber-50 text-amber-700 px-2 py-0.5 text-[9px] font-bold border border-amber-200">HIGH</span>;
      case 'medium':
        return <span className="rounded-md bg-blue-50 text-blue-700 px-2 py-0.5 text-[9px] font-bold border border-blue-200">MEDIUM</span>;
      default:
        return <span className="rounded-md bg-slate-100 text-slate-600 px-2 py-0.5 text-[9px] font-bold border border-slate-200">LOW</span>;
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
              <CheckSquare className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Workplace Kanban & Tasks</h1>
              <p className="text-xs text-slate-500">Create, edit, assign, and track project deliverables</p>
            </div>
          </div>

          <button
            onClick={openCreateModal}
            className="glow-btn-primary flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white tracking-wide shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Create New Task</span>
          </button>
        </div>

        {/* Notifications */}
        {notification && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{notification}</span>
          </div>
        )}

        {/* Mobile Column Switcher (Visible only on small devices) */}
        <div className="flex sm:hidden items-center gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setMobileActiveCol('all')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all shrink-0 ${
              mobileActiveCol === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            All Columns ({tasks.length})
          </button>
          {columns.map((col) => {
            const count = tasks.filter((t) => t.status === col.id).length;
            return (
              <button
                key={col.id}
                onClick={() => setMobileActiveCol(col.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all shrink-0 ${
                  mobileActiveCol === col.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                {col.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Kanban Board Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {columns
            .filter((col) => mobileActiveCol === 'all' || mobileActiveCol === col.id)
            .map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.id);
            return (
              <div key={col.id} className="rounded-3xl bg-slate-100/70 p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-800">
                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                    <span>{col.label}</span>
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600 shadow-sm border border-slate-200">
                    {colTasks.length}
                  </span>
                </div>

                <div className="space-y-3 min-h-[320px]">
                  {colTasks.length === 0 && (
                    <div className="text-center py-12 text-[11px] text-slate-400 font-medium">
                      No tasks in {col.label}
                    </div>
                  )}
                  {colTasks.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-2xl bg-white p-4 border border-slate-200 shadow-sm space-y-3 hover:border-blue-300 transition-all flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          {getPriorityBadge(task.priority)}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditModal(task)}
                              className="text-slate-400 hover:text-blue-600 p-1 rounded-md hover:bg-blue-50"
                              title="Edit Task"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTask(task.id, task.title)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50"
                              title="Delete Task"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 leading-snug">{task.title}</h4>
                        <p className="text-[10px] text-slate-500">
                          Created by <span className="font-semibold text-slate-700">{task.created_by_name || 'Unknown'}</span>
                        </p>
                        {task.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{task.description}</p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                        <div className="flex items-center gap-1.5 font-medium text-slate-600">
                          <div className="h-5 w-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[9px]">
                            {task.assigned_to_name.charAt(0)}
                          </div>
                          <span className="truncate max-w-[80px]">{task.assigned_to_name}</span>
                        </div>

                        <div className="flex items-center gap-1 text-slate-400 font-mono">
                          <Clock className="h-3 w-3" />
                          <span>{task.due_date}</span>
                        </div>
                      </div>

                      {/* Move Column Actions */}
                      <div className="flex items-center justify-between gap-1 pt-1">
                        <select
                          value={task.status}
                          onChange={(e) => handleUpdateStatus(task.id, e.target.value as any)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1 px-1.5 text-[10px] text-slate-700 font-semibold focus:outline-none"
                        >
                          <option value="todo">To Do</option>
                          <option value="in_progress">In Progress</option>
                          <option value="in_review">In Review</option>
                          <option value="done">Completed</option>
                        </select>
                      </div>

                      {task.activity && task.activity.length > 0 && (
                        <details className="pt-1">
                          <summary className="text-[10px] font-semibold text-slate-500 cursor-pointer">
                            Activity ({task.activity.length})
                          </summary>
                          <ul className="mt-1 space-y-1 max-h-24 overflow-y-auto">
                            {[...task.activity].reverse().map((entry, idx) => (
                              <li key={`${task.id}-act-${idx}`} className="text-[10px] text-slate-500">
                                <span className="font-semibold text-slate-700">{entry.by_name}</span>{' '}
                                {entry.action}
                                {entry.field ? ` ${entry.field}` : ''}
                                {entry.from && entry.to ? `: ${entry.from} → ${entry.to}` : ''}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add/Edit Task Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl space-y-5 border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CheckSquare className="h-5 w-5 text-blue-600" />
                  {editingTask ? 'Edit Task' : 'Create Kanban Task'}
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

              <form onSubmit={handleSaveTask} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Task Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Conduct Security Audit & RLS Verification"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as any)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none capitalize"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Due Date</label>
                    <input
                      type="date"
                      required
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Assignee</label>
                    <select
                      value={assignedToId}
                      onChange={(e) => setAssignedToId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                    >
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Status Column</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none capitalize"
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="in_review">In Review</option>
                      <option value="done">Completed</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Description / Deliverables</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Task details and acceptance criteria..."
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
                    {submitting ? 'Saving...' : editingTask ? 'Save Changes' : 'Add Task'}
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
