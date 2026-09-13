'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import {
  Building2,
  Users,
  Plus,
  Edit2,
  Trash2,
  Award,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  ChevronDown,
  ChevronUp,
  Mail,
  Shield,
} from 'lucide-react';
import { Department, Group, Employee } from '@/lib/db/types';

export default function DepartmentsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'departments' | 'groups'>('departments');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Department Modal State
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [deptHeadName, setDeptHeadName] = useState('');
  const [deptDescription, setDeptDescription] = useState('');

  // Group Modal State
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupDeptId, setGroupDeptId] = useState('');
  const [groupLeaderId, setGroupLeaderId] = useState('');
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [groupDescription, setGroupDescription] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedDeptIds, setExpandedDeptIds] = useState<string[]>([]);
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);

  const toggleDeptExpand = (deptId: string) => {
    setExpandedDeptIds((prev) =>
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
    );
  };

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const fetchData = async () => {
    try {
      const [deptRes, grpRes, empRes, meRes] = await Promise.all([
        fetch('/api/departments'),
        fetch('/api/groups'),
        fetch('/api/employees'),
        fetch('/api/auth/me'),
      ]);

      if (meRes.ok) {
        const meData = await meRes.json();
        setIsAdmin(meData.user?.role === 'admin');
      }
      if (deptRes.ok) {
        const d = await deptRes.json();
        setDepartments(d.departments || []);
      }
      if (grpRes.ok) {
        const g = await grpRes.json();
        setGroups(g.groups || []);
      }
      if (empRes.ok) {
        const e = await empRes.json();
        setEmployees(e.employees || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Department Handlers
  const openAddDept = () => {
    setEditingDept(null);
    setDeptName('');
    setDeptCode('');
    setDeptHeadName('');
    setDeptDescription('');
    setError(null);
    setShowDeptModal(true);
  };

  const openEditDept = (dept: Department) => {
    setEditingDept(dept);
    setDeptName(dept.name);
    setDeptCode(dept.code);
    setDeptHeadName(dept.head_name);
    setDeptDescription(dept.description || '');
    setError(null);
    setShowDeptModal(true);
  };

  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const url = editingDept ? `/api/departments/${editingDept.id}` : '/api/departments';
      const method = editingDept ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: deptName,
          code: deptCode,
          head_name: deptHeadName,
          description: deptDescription,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setNotification(`Department ${deptName} ${editingDept ? 'updated' : 'created'} successfully!`);
        setShowDeptModal(false);
        fetchData();
        setTimeout(() => setNotification(null), 4000);
      } else {
        setError(data.error || 'Failed to save department.');
      }
    } catch {
      setError('Network connection error.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDept = async (deptId: string, deptName: string) => {
    if (!confirm(`Are you sure you want to delete department "${deptName}"?`)) return;

    try {
      const res = await fetch(`/api/departments/${deptId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification(`Department "${deptName}" deleted.`);
        fetchData();
        setTimeout(() => setNotification(null), 4000);
      } else {
        alert(data.error || 'Failed to delete department.');
      }
    } catch {
      alert('Network error.');
    }
  };

  // Group Handlers
  const openAddGroup = () => {
    setEditingGroup(null);
    setGroupName('');
    setGroupDeptId(departments[0]?.id || '');
    setGroupLeaderId(employees[0]?.id || '');
    setGroupMemberIds([]);
    setGroupDescription('');
    setError(null);
    setShowGroupModal(true);
  };

  const openEditGroup = (group: Group) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupDeptId(group.department_id);
    setGroupLeaderId(group.leader_id);
    setGroupMemberIds(group.member_ids || []);
    setGroupDescription(group.description || '');
    setError(null);
    setShowGroupModal(true);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const url = editingGroup ? `/api/groups/${editingGroup.id}` : '/api/groups';
      const method = editingGroup ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupName,
          department_id: groupDeptId,
          leader_id: groupLeaderId,
          member_ids: groupMemberIds,
          description: groupDescription,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setNotification(`Squad / Group "${groupName}" ${editingGroup ? 'updated' : 'created'} successfully!`);
        setShowGroupModal(false);
        fetchData();
        setTimeout(() => setNotification(null), 4000);
      } else {
        setError(data.error || 'Failed to save group.');
      }
    } catch {
      setError('Network connection error.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGroup = async (groupId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete squad "${name}"?`)) return;

    try {
      const res = await fetch(`/api/groups/${groupId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification(`Squad "${name}" deleted.`);
        fetchData();
        setTimeout(() => setNotification(null), 4000);
      } else {
        alert(data.error || 'Failed to delete group.');
      }
    } catch {
      alert('Network error.');
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header & Tabs */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Organization & Squads</h1>
              <p className="text-xs text-slate-500">Manage departments and group hierarchies with Group Leaders (GL)</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex rounded-2xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold">
              <button
                onClick={() => setActiveTab('departments')}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 transition-all ${
                  activeTab === 'departments' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>Departments ({departments.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('groups')}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 transition-all ${
                  activeTab === 'groups' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Squads & GLs ({groups.length})</span>
              </button>
            </div>

            {isAdmin && (
              activeTab === 'departments' ? (
                <button
                  onClick={openAddDept}
                  className="glow-btn-primary flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white tracking-wide shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>New Department</span>
                </button>
              ) : (
                <button
                  onClick={openAddGroup}
                  className="glow-btn-primary flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white tracking-wide shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>New Squad</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Notifications */}
        {notification && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{notification}</span>
          </div>
        )}

        {/* Tab Content: Departments */}
        {activeTab === 'departments' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((dept) => (
              <div
                key={dept.id}
                className="rounded-3xl bg-white p-6 border border-slate-200 shadow-sm space-y-4 hover:border-blue-300 transition-all flex flex-col justify-between"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="rounded-md bg-blue-50 text-blue-700 px-2 py-0.5 text-[10px] font-mono font-bold border border-blue-200">
                      {dept.code}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-2">{dept.name}</h3>
                    {dept.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">{dept.description}</p>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditDept(dept)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                        title="Edit Department"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteDept(dept.id, dept.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                        title="Delete Department"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <div className="flex items-center gap-1 text-slate-500">
                      <span>Head:</span>
                      <span className="font-semibold text-slate-900">{dept.head_name}</span>
                    </div>
                    <button
                      onClick={() => toggleDeptExpand(dept.id)}
                      className="flex items-center gap-1 font-bold text-blue-600 hover:text-blue-700 text-xs bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                    >
                      <Users className="h-3.5 w-3.5" />
                      <span>{dept.members?.length || dept.employee_count || 0} Members</span>
                      {expandedDeptIds.includes(dept.id) ? (
                        <ChevronUp className="h-3.5 w-3.5 ml-0.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 ml-0.5" />
                      )}
                    </button>
                  </div>

                  {/* Expanded Member List */}
                  {expandedDeptIds.includes(dept.id) && (
                    <div className="rounded-2xl bg-slate-50 p-3 border border-slate-200 space-y-2 mt-2 max-h-64 overflow-y-auto animate-in fade-in">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Department Team Directory
                      </div>
                      {(!dept.members || dept.members.length === 0) ? (
                        <div className="text-[11px] text-slate-400 py-2 text-center">
                          No team members assigned to this department yet.
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-200/60">
                          {dept.members.map((m: any) => (
                            <div key={m.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-slate-900 flex items-center gap-1.5 truncate">
                                  <span>{m.name}</span>
                                  {m.is_group_leader && (
                                    <span className="bg-purple-100 text-purple-700 text-[9px] font-bold px-1.5 py-0.2 rounded">
                                      GL
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-blue-600 font-mono truncate flex items-center gap-1 mt-0.5">
                                  <Mail className="h-3 w-3 shrink-0" />
                                  <span>{m.email}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">{m.designation} • {m.group_name || 'No Squad'}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => router.push(`/mail/compose?to=${encodeURIComponent(m.email)}`)}
                                className="flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-white hover:bg-blue-50 px-2.5 py-1.5 rounded-xl border border-blue-200 shadow-2xs transition-colors shrink-0 cursor-pointer"
                                title={`Compose email to ${m.name}`}
                              >
                                <Mail className="h-3 w-3" />
                                <span>Email</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab Content: Groups & Squads */}
        {activeTab === 'groups' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.length === 0 && (
              <div className="col-span-3 text-center py-12 text-xs text-slate-400">
                No squads or teams configured yet.
              </div>
            )}
            {groups.map((grp: any) => (
              <div
                key={grp.id}
                className="rounded-3xl bg-white p-6 border border-slate-200 shadow-sm space-y-4 hover:border-blue-300 transition-all flex flex-col justify-between"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="rounded-md bg-purple-50 text-purple-700 px-2 py-0.5 text-[10px] font-mono font-bold border border-purple-200">
                      {grp.department_name}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-2">{grp.name}</h3>
                    {grp.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">{grp.description}</p>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditGroup(grp)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                        title="Edit Squad"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(grp.id, grp.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                        title="Delete Squad"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Group Leader (GL):</span>
                    <span className="font-bold text-purple-700 flex items-center gap-1 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                      <Award className="h-3.5 w-3.5" />
                      {grp.leader_name}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Assigned Squad Members:</span>
                    <button
                      onClick={() => toggleGroupExpand(grp.id)}
                      className="flex items-center gap-1 font-bold text-purple-700 hover:text-purple-800 text-xs bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200 transition-colors cursor-pointer"
                    >
                      <Users className="h-3.5 w-3.5" />
                      <span>{grp.members?.length || grp.member_ids?.length || 0} Members</span>
                      {expandedGroupIds.includes(grp.id) ? (
                        <ChevronUp className="h-3.5 w-3.5 ml-0.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 ml-0.5" />
                      )}
                    </button>
                  </div>

                  {/* Expanded Squad Members List */}
                  {expandedGroupIds.includes(grp.id) && (
                    <div className="rounded-2xl bg-purple-50/40 p-3 border border-purple-100 space-y-2 mt-2 max-h-64 overflow-y-auto animate-in fade-in">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600">
                        {grp.name} Squad Personnel
                      </div>
                      {(!grp.members || grp.members.length === 0) ? (
                        <div className="text-[11px] text-slate-400 py-2 text-center">
                          No team members assigned to this squad yet.
                        </div>
                      ) : (
                        <div className="divide-y divide-purple-100">
                          {grp.members.map((m: any) => (
                            <div key={m.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-slate-900 flex items-center gap-1.5 truncate">
                                  <span>{m.name}</span>
                                  {m.is_group_leader && (
                                    <span className="bg-purple-200/80 text-purple-800 text-[9px] font-bold px-1.5 py-0.2 rounded border border-purple-300">
                                      GL
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-purple-700 font-mono truncate flex items-center gap-1 mt-0.5">
                                  <Mail className="h-3 w-3 shrink-0" />
                                  <span>{m.email}</span>
                                </div>
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  {m.designation} • {m.phone || '+91 90000 00000'}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => router.push(`/mail/compose?to=${encodeURIComponent(m.email)}`)}
                                className="flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-white hover:bg-purple-100 px-2.5 py-1.5 rounded-xl border border-purple-200 shadow-2xs transition-colors shrink-0 cursor-pointer"
                                title={`Compose email to ${m.name}`}
                              >
                                <Mail className="h-3 w-3" />
                                <span>Email</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Department Modal */}
        {showDeptModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl space-y-5 border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  {editingDept ? 'Edit Department' : 'Create New Department'}
                </h3>
                <button onClick={() => setShowDeptModal(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSaveDept} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Department Name</label>
                  <input
                    type="text"
                    required
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    placeholder="e.g. Engineering & Infrastructure"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Short Code</label>
                  <input
                    type="text"
                    required
                    value={deptCode}
                    onChange={(e) => setDeptCode(e.target.value)}
                    placeholder="e.g. ENG"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Head of Department</label>
                  <input
                    type="text"
                    required
                    value={deptHeadName}
                    onChange={(e) => setDeptHeadName(e.target.value)}
                    placeholder="e.g. Admin Supervisor"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Description (Optional)</label>
                  <textarea
                    rows={2}
                    value={deptDescription}
                    onChange={(e) => setDeptDescription(e.target.value)}
                    placeholder="Brief summary of department operations..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowDeptModal(false)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="glow-btn-primary rounded-xl px-5 py-2 text-xs font-bold text-white shadow-sm disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Save Department'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add/Edit Group Modal */}
        {showGroupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl space-y-5 border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="h-5 w-5 text-purple-600" />
                  {editingGroup ? 'Edit Squad' : 'Create New Squad / Group'}
                </h3>
                <button onClick={() => setShowGroupModal(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSaveGroup} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Squad / Group Name</label>
                  <input
                    type="text"
                    required
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g. Backend Platform Squad"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Department</label>
                    <select
                      value={groupDeptId}
                      onChange={(e) => setGroupDeptId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Designated Group Leader (GL)</label>
                    <select
                      value={groupLeaderId}
                      onChange={(e) => setGroupLeaderId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                    >
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>{e.name} ({e.designation})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Select Squad Members</label>
                  <div className="max-h-32 overflow-y-auto rounded-xl border border-slate-200 p-2 space-y-1 bg-slate-50">
                    {employees.map((emp) => {
                      const isSelected = groupMemberIds.includes(emp.id) || emp.id === groupLeaderId;
                      return (
                        <label key={emp.id} className="flex items-center gap-2 p-1 hover:bg-white rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={emp.id === groupLeaderId}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setGroupMemberIds([...groupMemberIds, emp.id]);
                              } else {
                                setGroupMemberIds(groupMemberIds.filter((id) => id !== emp.id));
                              }
                            }}
                            className="rounded border-slate-300 text-blue-600"
                          />
                          <span className="text-slate-800 font-medium">{emp.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({emp.employee_code})</span>
                          {emp.id === groupLeaderId && (
                            <span className="text-[10px] text-purple-600 font-bold bg-purple-100 px-1.5 py-0.5 rounded ml-auto">GL</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Squad Description</label>
                  <textarea
                    rows={2}
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    placeholder="Focus area of this squad..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowGroupModal(false)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="glow-btn-primary rounded-xl px-5 py-2 text-xs font-bold text-white shadow-sm disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Save Squad'}
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
