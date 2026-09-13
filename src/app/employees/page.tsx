'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import {
  Users,
  Search,
  UserPlus,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Calendar,
  Filter,
  CheckCircle2,
  AlertCircle,
  X,
  CalendarCheck,
  CheckSquare,
} from 'lucide-react';
import { Employee, Department } from '@/lib/db/types';

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [isSquadOnly, setIsSquadOnly] = useState(false);
  const [groupName, setGroupName] = useState('');

  // 360 Detail Modal State
  const [selectedDetail, setSelectedDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchEmployeeDetail = async (empId: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/employees/${empId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedDetail(data);
      }
    } catch {
      // Non-fatal
    } finally {
      setLoadingDetail(false);
    }
  };

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [designation, setDesignation] = useState('');
  const [role, setRole] = useState<'intern' | 'employee' | 'manager' | 'admin'>('employee');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      let url = `/api/employees?`;
      if (search) url += `search=${encodeURIComponent(search)}&`;
      if (deptFilter) url += `departmentId=${encodeURIComponent(deptFilter)}&`;
      if (statusFilter) url += `status=${encodeURIComponent(statusFilter)}&`;

      const [empRes, deptRes, meRes] = await Promise.all([
        fetch(url),
        fetch('/api/departments'),
        fetch('/api/auth/me'),
      ]);

      if (meRes.ok) {
        const meData = await meRes.json();
        const r = meData.user?.role;
        if (r === 'employee' || r === 'intern') {
          router.replace('/dashboard');
          return;
        }
      }

      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployees(empData.employees || []);
        setIsSquadOnly(Boolean(empData.isSquadOnly));
        if (empData.groupName) setGroupName(empData.groupName);
      }
      if (deptRes.ok) {
        const deptData = await deptRes.json();
        setDepartments(deptData.departments || []);
        if (deptData.departments.length > 0 && !departmentId) {
          setDepartmentId(deptData.departments[0].id);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, deptFilter, statusFilter]);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          username,
          email: email.includes('@') ? email : `${email}@cruvels.com`,
          phone,
          departmentId,
          designation,
          role,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to create employee record.');
      } else {
        setSuccess(`Employee ${firstName} ${lastName} added successfully!`);
        setShowAddModal(false);
        setFirstName('');
        setLastName('');
        setUsername('');
        setEmail('');
        setPhone('');
        setDesignation('');
        fetchData();
        setTimeout(() => setSuccess(null), 4000);
      }
    } catch {
      setError('Network error while provisioning employee.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                {isSquadOnly ? `${groupName || 'My Squad'} Directory` : 'Employee Directory'}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 font-medium">
                  {employees.length} {employees.length === 1 ? 'Member' : 'Members'}
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                {isSquadOnly
                  ? 'Personnel assigned to your working squad & department'
                  : 'Cruvels workforce organization, roles & department assignments'}
              </p>
            </div>
          </div>

          {!isSquadOnly && (
            <button
              onClick={() => setShowAddModal(true)}
              className="glow-btn-primary flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white tracking-wide shadow-sm"
            >
              <UserPlus className="h-4 w-4" />
              <span>Add New Employee</span>
            </button>
          )}
        </div>

        {/* Alerts */}
        {success && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{success}</span>
          </div>
        )}

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-3 rounded-2xl bg-white p-3 border border-slate-200 shadow-sm">
          <div className="relative flex-1 w-full">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, code, email, designation..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {!isSquadOnly && (
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 py-1.5 px-3 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 py-1.5 px-3 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        {/* Employee Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full flex items-center justify-center p-16">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
            </div>
          ) : employees.length === 0 ? (
            <div className="col-span-full rounded-3xl bg-white p-12 text-center border border-slate-200">
              <Users className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-900">No employees found</h3>
              <p className="text-xs text-slate-400 mt-1">Try adjusting your search criteria or filter tags.</p>
            </div>
          ) : (
            employees.map((emp) => (
              <div
                key={emp.id}
                onClick={() => fetchEmployeeDetail(emp.id)}
                className="rounded-3xl bg-white p-5 border border-slate-200 shadow-sm space-y-4 hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-sm font-bold text-white shadow-md group-hover:scale-105 transition-transform">
                      {emp.first_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">{emp.name}</div>
                      <div className="text-xs text-blue-600 font-medium mt-0.5">{emp.designation}</div>
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-600 border border-slate-200">
                    {emp.employee_code}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-medium">{emp.department_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-mono text-[11px] truncate">{emp.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span>{emp.phone}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${emp.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <span className="font-semibold text-slate-700">{emp.status}</span>
                  </span>
                  <span className="text-blue-600 font-semibold group-hover:underline flex items-center gap-0.5">
                    View 360° Profile &rarr;
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 360° Employee Details Modal */}
        {selectedDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in overflow-y-auto">
            <div className="w-full max-w-2xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl space-y-6 border border-slate-200 my-8">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-xl font-extrabold text-white shadow-md">
                    {selectedDetail.employee.first_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      {selectedDetail.employee.name}
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-700 border border-slate-200">
                        {selectedDetail.employee.employee_code}
                      </span>
                    </h2>
                    <p className="text-xs text-blue-600 font-semibold">{selectedDetail.employee.designation}</p>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {selectedDetail.employee.email} • {selectedDetail.employee.phone}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDetail(null)}
                  className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Department & Role Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="rounded-2xl bg-slate-50 p-3 border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Department</span>
                  <span className="font-bold text-slate-800 text-[11px]">{selectedDetail.employee.department_name}</span>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Squad</span>
                  <span className="font-bold text-slate-800 text-[11px]">
                    {selectedDetail.employee.group_name || 'Unassigned'}
                    {selectedDetail.employee.is_group_leader ? ' (GL)' : ''}
                  </span>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">System Role</span>
                  <span className="font-bold text-blue-700 text-[11px] uppercase">
                    {selectedDetail.user?.role || selectedDetail.employee.designation}
                  </span>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Joined</span>
                  <span className="font-bold text-slate-800 text-[11px]">{selectedDetail.employee.joining_date}</span>
                </div>
              </div>

              {selectedDetail.restricted ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
                  Directory contact card only. Attendance, tasks, leave balances, and login details are limited to administrators and the employee.
                </div>
              ) : (
                <>
              {/* Attendance Tracker */}
              <div className="rounded-2xl bg-slate-50/80 p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <CalendarCheck className="h-4 w-4 text-emerald-600" />
                    <span>Attendance Summary</span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {selectedDetail.attendance.summary.totalRecords} Logs Recorded
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="rounded-xl bg-white p-2.5 border border-slate-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase block">Present</span>
                    <span className="text-base font-extrabold text-slate-900">{selectedDetail.attendance.summary.present}</span>
                  </div>
                  <div className="rounded-xl bg-white p-2.5 border border-slate-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-purple-700 uppercase block">Half Day</span>
                    <span className="text-base font-extrabold text-slate-900">{selectedDetail.attendance.summary.halfDay}</span>
                  </div>
                  <div className="rounded-xl bg-white p-2.5 border border-slate-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-amber-700 uppercase block">On Leave</span>
                    <span className="text-base font-extrabold text-slate-900">{selectedDetail.attendance.summary.onLeave}</span>
                  </div>
                  <div className="rounded-xl bg-white p-2.5 border border-slate-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-rose-700 uppercase block">Absent</span>
                    <span className="text-base font-extrabold text-slate-900">{selectedDetail.attendance.summary.absent}</span>
                  </div>
                </div>

                {selectedDetail.attendance.recent.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-200/60 max-h-32 overflow-y-auto pr-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Recent Punch Logs</span>
                    {selectedDetail.attendance.recent.slice(0, 5).map((att: any) => (
                      <div key={att.id} className="flex items-center justify-between text-xs bg-white rounded-lg px-2.5 py-1.5 border border-slate-100">
                        <span className="font-mono text-slate-700 text-[11px] font-medium">{att.date}</span>
                        <div className="flex items-center gap-2">
                          {att.punch_time && <span className="text-[10px] font-mono text-slate-400">{att.punch_time}</span>}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            att.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            att.status === 'HALF_DAY' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                            att.status === 'ON_LEAVE' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {att.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tasks & Performance */}
              <div className="rounded-2xl bg-slate-50/80 p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <CheckSquare className="h-4 w-4 text-blue-600" />
                    <span>Assigned Tasks & Progress</span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {selectedDetail.tasks.summary.completed} / {selectedDetail.tasks.summary.total} Done
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-white p-2.5 border border-slate-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase block">Completed</span>
                    <span className="text-base font-extrabold text-slate-900">{selectedDetail.tasks.summary.completed}</span>
                  </div>
                  <div className="rounded-xl bg-white p-2.5 border border-slate-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-blue-700 uppercase block">In Progress</span>
                    <span className="text-base font-extrabold text-slate-900">{selectedDetail.tasks.summary.inProgress}</span>
                  </div>
                  <div className="rounded-xl bg-white p-2.5 border border-slate-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-600 uppercase block">To Do</span>
                    <span className="text-base font-extrabold text-slate-900">{selectedDetail.tasks.summary.pending}</span>
                  </div>
                </div>

                {selectedDetail.tasks.list.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-200/60 max-h-36 overflow-y-auto pr-1">
                    {selectedDetail.tasks.list.slice(0, 5).map((task: any) => (
                      <div key={task.id} className="flex items-center justify-between text-xs bg-white rounded-lg px-2.5 py-1.5 border border-slate-100">
                        <div className="min-w-0 pr-2">
                          <span className="font-semibold text-slate-800 truncate block">{task.title}</span>
                          {task.due_date && <span className="text-[10px] text-slate-400">Due: {task.due_date}</span>}
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          task.status === 'done' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          task.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {task.status.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Leave Balances */}
              <div className="rounded-2xl bg-slate-50/80 p-4 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <Calendar className="h-4 w-4 text-purple-600" />
                  <span>Leave Allowances & Balances</span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-white p-2 border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Casual</span>
                    <span className="text-sm font-bold text-slate-800">{selectedDetail.leaves.balances.casual} days</span>
                  </div>
                  <div className="rounded-xl bg-white p-2 border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Sick</span>
                    <span className="text-sm font-bold text-slate-800">{selectedDetail.leaves.balances.sick} days</span>
                  </div>
                  <div className="rounded-xl bg-white p-2 border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Annual</span>
                    <span className="text-sm font-bold text-slate-800">{selectedDetail.leaves.balances.annual} days</span>
                  </div>
                  <div className="rounded-xl bg-white p-2 border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Unpaid</span>
                    <span className="text-sm font-bold text-slate-800">{selectedDetail.leaves.balances.unpaid} days</span>
                  </div>
                </div>
              </div>
                </>
              )}

              {/* Close Action */}
              <div className="flex items-center justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedDetail(null)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Close Profile
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Employee Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl space-y-5 border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-blue-600" />
                  Add Employee to Workforce
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

              <form onSubmit={handleCreateEmployee} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">First Name</label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. Alex"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Last Name</label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="e.g. Miller"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Login Username</label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. alex"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Company Email Alias</label>
                    <input
                      type="text"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. alex@cruvels.com"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Department</label>
                    <select
                      value={departmentId}
                      onChange={(e) => setDepartmentId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Designation</label>
                    <input
                      type="text"
                      required
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      placeholder="e.g. QA Automation Engineer"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Phone</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 00000"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">System Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none capitalize"
                    >
                      <option value="intern">Intern</option>
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
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
                    {submitting ? 'Saving...' : 'Add to Workforce'}
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
