'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  Video,
  ExternalLink,
  Clock,
  ShieldCheck,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Employee, Department } from '@/lib/db/types';
import { clientCache } from '@/lib/cache/clientCache';

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>(() => {
    if (typeof window !== 'undefined') {
      return clientCache.get<Employee[]>('employees_list') || [];
    }
    return [];
  });
  const [departments, setDepartments] = useState<Department[]>(() => {
    if (typeof window !== 'undefined') {
      return clientCache.get<Department[]>('departments_list') || [];
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      return !clientCache.get<Employee[]>('employees_list');
    }
    return true;
  });
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [isSquadOnly, setIsSquadOnly] = useState(false);
  const [groupName, setGroupName] = useState('');

  // 360 Detail Modal State
  const [selectedDetail, setSelectedDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sheetMode, setSheetMode] = useState<'full' | 'side'>('full');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedDetail) {
        setSelectedDetail(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDetail]);

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
        clientCache.set('employees_list', undefined, empData.employees || []);
        setIsSquadOnly(Boolean(empData.isSquadOnly));
        if (empData.groupName) setGroupName(empData.groupName);
      }
      if (deptRes.ok) {
        const deptData = await deptRes.json();
        setDepartments(deptData.departments || []);
        clientCache.set('departments_list', undefined, deptData.departments || []);
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
              <h1 className="text-xl font-bold tracking-tight flex items-center gap-2" style={{ color: 'var(--ink)' }}>
                {isSquadOnly ? `${groupName || 'My Squad'} Directory` : 'Employee Directory'}
                <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}>
                  {employees.length} {employees.length === 1 ? 'Member' : 'Members'}
                </span>
              </h1>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
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
        <div className="flex flex-col sm:flex-row items-center gap-3 rounded-2xl p-3 border shadow-sm" style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}>
          <div className="relative flex-1 w-full">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5" style={{ color: 'var(--muted)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, code, email, designation..."
              className="w-full rounded-xl border py-1.5 pl-8 pr-4 text-xs focus:outline-none transition-colors"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--line)', color: 'var(--ink)' }}
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {!isSquadOnly && (
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="rounded-xl border py-1.5 px-3 text-xs focus:outline-none transition-colors cursor-pointer"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--line)', color: 'var(--ink)' }}
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
              className="rounded-xl border py-1.5 px-3 text-xs focus:outline-none transition-colors cursor-pointer"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--line)', color: 'var(--ink)' }}
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
            <div className="col-span-full rounded-3xl p-12 text-center border" style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}>
              <Users className="h-10 w-10 mx-auto mb-2" style={{ color: 'var(--muted)' }} />
              <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>No employees found</h3>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Try adjusting your search criteria or filter tags.</p>
            </div>
          ) : (
            employees.map((emp) => (
              <button
                key={emp.id}
                type="button"
                onClick={() => fetchEmployeeDetail(emp.id)}
                className="rounded-3xl p-5 border shadow-sm space-y-4 transition-all flex flex-col justify-between cursor-pointer group hover:shadow-md hover:-translate-y-0.5 touch-manipulation active:scale-[0.98] text-left w-full"
                style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-sm font-bold text-white shadow-md group-hover:scale-105 transition-transform">
                      {emp.first_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-sm leading-tight group-hover:text-blue-600 transition-colors" style={{ color: 'var(--ink)' }}>{emp.name}</div>
                      <div className="text-xs font-semibold mt-0.5" style={{ color: 'var(--teal)' }}>{emp.designation}</div>
                    </div>
                  </div>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-mono font-bold" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}>
                    {emp.employee_code}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs pt-1" style={{ borderTop: '1px solid var(--line-soft)', color: 'var(--muted)' }}>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5" style={{ color: 'var(--muted)' }} />
                    <span className="font-medium" style={{ color: 'var(--ink)' }}>{emp.department_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5" style={{ color: 'var(--muted)' }} />
                    <span className="font-mono text-[11px] truncate">{emp.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" style={{ color: 'var(--muted)' }} />
                    <span>{emp.phone}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 text-[11px]" style={{ borderTop: '1px solid var(--line-soft)' }}>
                  <span className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${emp.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <span className="font-semibold" style={{ color: 'var(--ink)' }}>{emp.status}</span>
                  </span>
                  <span className="font-semibold group-hover:underline flex items-center gap-0.5" style={{ color: 'var(--teal)' }}>
                    View 360° Profile &rarr;
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
        {/* 360° Employee Details Sheet - Full Bleed View (Portaled directly to document.body) */}
        {mounted && selectedDetail && createPortal(
          <div
            className={
              sheetMode === 'full'
                ? 'fixed inset-0 z-[9999] flex flex-col w-screen h-screen overflow-hidden animate-in fade-in'
                : 'fixed inset-0 z-[9999] overflow-hidden flex justify-end animate-in fade-in'
            }
            style={
              sheetMode === 'full'
                ? { background: 'var(--paper)', color: 'var(--ink)' }
                : { background: 'rgba(10, 20, 25, 0.7)', backdropFilter: 'blur(6px)' }
            }
            onClick={(e) => {
              if (sheetMode === 'side' && e.target === e.currentTarget) {
                setSelectedDetail(null);
              }
            }}
            role="dialog"
            aria-modal="true"
            aria-label={`Employee Profile: ${selectedDetail.employee.name}`}
          >
            <div
              className={
                sheetMode === 'full'
                  ? 'flex-1 flex flex-col h-full overflow-hidden'
                  : 'w-full max-w-3xl xl:max-w-4xl h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200'
              }
              style={{ background: 'var(--paper)', color: 'var(--ink)' }}
            >
              {/* Sticky Top Header Bar */}
              <div
                className="h-16 px-6 sm:px-8 shrink-0 flex items-center justify-between gap-4"
                style={{
                  background: 'var(--surface)',
                  borderBottom: '1px solid var(--line)',
                  boxShadow: 'var(--shadow)',
                }}
              >
                {/* Left: Avatar + Identity */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-extrabold text-white shadow-xs"
                    style={{ background: 'var(--teal)' }}
                  >
                    {selectedDetail.employee.first_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2
                        className="text-base font-bold truncate"
                        style={{ color: 'var(--ink)', fontFamily: 'Bricolage Grotesque, sans-serif' }}
                      >
                        {selectedDetail.employee.name}
                      </h2>
                      <span
                        className="rounded px-2 py-0.5 text-[10px] font-mono font-bold shrink-0"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}
                      >
                        {selectedDetail.employee.employee_code}
                      </span>
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0"
                        style={
                          selectedDetail.employee.status === 'ACTIVE'
                            ? { background: 'var(--teal-wash)', color: 'var(--teal-ink)' }
                            : { background: 'var(--rose-wash)', color: 'var(--rose)' }
                        }
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            selectedDetail.employee.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                        {selectedDetail.employee.status}
                      </span>
                    </div>
                    <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                      <span className="font-semibold" style={{ color: 'var(--teal)' }}>
                        {selectedDetail.employee.designation}
                      </span>{' '}
                      • {selectedDetail.employee.department_name}
                      {selectedDetail.employee.group_name ? ` • ${selectedDetail.employee.group_name}` : ''}
                    </p>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`/mail/compose?to=${encodeURIComponent(selectedDetail.employee.email)}`}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                    title="Send internal email"
                  >
                    <Mail className="h-3.5 w-3.5" style={{ color: 'var(--teal)' }} />
                    <span className="truncate max-w-[160px]">{selectedDetail.employee.email}</span>
                  </a>

                  {/* Mode Toggle Button: Full Bleed vs Side Drawer */}
                  <button
                    type="button"
                    onClick={() => setSheetMode(sheetMode === 'full' ? 'side' : 'full')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                    title={sheetMode === 'full' ? 'Switch to Side Drawer view' : 'Switch to Full Bleed view'}
                  >
                    {sheetMode === 'full' ? (
                      <>
                        <Minimize2 className="h-3.5 w-3.5" />
                        <span className="hidden md:inline">Side Drawer</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="h-3.5 w-3.5" />
                        <span className="hidden md:inline">Full Bleed</span>
                      </>
                    )}
                  </button>

                  {/* Close Profile (Esc) */}
                  <button
                    type="button"
                    onClick={() => setSelectedDetail(null)}
                    className="flex items-center justify-center rounded-xl transition-colors cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 touch-manipulation active:scale-90 min-h-[44px] min-w-[44px]"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                    title="Close (Esc)"
                    aria-label="Close employee profile"
                  >
                    <X className="h-5 w-5" style={{ color: 'var(--ink)' }} />
                  </button>
                </div>
              </div>

              {/* Scrollable Content Body */}
              <div
                className="flex-1 overflow-y-auto px-6 sm:px-10 lg:px-12 py-6 space-y-6"
                style={{ background: 'var(--paper)' }}
              >
                <div className="max-w-7xl mx-auto space-y-6">
                  {/* Hero Employee Profile Card */}
                  <div
                    className="rounded-2xl p-6 sm:p-7 shadow-xs relative overflow-hidden"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                    }}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                      <div className="flex items-center gap-4">
                        <div
                          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-extrabold text-white shadow-md"
                          style={{ background: 'var(--teal)' }}
                        >
                          {selectedDetail.employee.first_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h1
                              className="text-xl sm:text-2xl font-bold tracking-tight"
                              style={{ color: 'var(--ink)', fontFamily: 'Bricolage Grotesque, sans-serif' }}
                            >
                              {selectedDetail.employee.name}
                            </h1>
                            <span
                              className="rounded-md px-2 py-0.5 text-xs font-mono font-bold"
                              style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}
                            >
                              {selectedDetail.employee.employee_code}
                            </span>
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold"
                              style={
                                selectedDetail.employee.status === 'ACTIVE'
                                  ? { background: 'var(--teal-wash)', color: 'var(--teal-ink)' }
                                  : { background: 'var(--rose-wash)', color: 'var(--rose)' }
                              }
                            >
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  selectedDetail.employee.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'
                                }`}
                              />
                              {selectedDetail.employee.status}
                            </span>
                          </div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--teal)' }}>
                            {selectedDetail.employee.designation}
                          </p>
                          <div className="flex items-center gap-4 text-xs font-medium flex-wrap" style={{ color: 'var(--muted)' }}>
                            <span className="flex items-center gap-1.5">
                              <Mail className="h-3.5 w-3.5" style={{ color: 'var(--teal)' }} />
                              <a href={`mailto:${selectedDetail.employee.email}`} className="hover:underline">
                                {selectedDetail.employee.email}
                              </a>
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5" style={{ color: 'var(--muted)' }} />
                              {selectedDetail.employee.phone}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 self-stretch sm:self-auto justify-end flex-wrap">
                        <a
                          href={`/mail/compose?to=${encodeURIComponent(selectedDetail.employee.email)}`}
                          className="btn-primary text-xs font-bold inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          <span>Email Employee</span>
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Department & Role Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="rounded-xl p-3.5 shadow-2xs" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
                      <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--muted)' }}>
                        Department
                      </span>
                      <span className="font-bold text-xs mt-1 block" style={{ color: 'var(--ink)' }}>
                        {selectedDetail.employee.department_name}
                      </span>
                    </div>
                    <div className="rounded-xl p-3.5 shadow-2xs" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
                      <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--muted)' }}>
                        Squad
                      </span>
                      <span className="font-bold text-xs mt-1 block" style={{ color: 'var(--ink)' }}>
                        {selectedDetail.employee.group_name || 'Unassigned'}
                        {selectedDetail.employee.is_group_leader ? ' (GL)' : ''}
                      </span>
                    </div>
                    <div className="rounded-xl p-3.5 shadow-2xs" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
                      <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--muted)' }}>
                        System Role
                      </span>
                      <span className="font-bold text-xs uppercase mt-1 block" style={{ color: 'var(--teal)' }}>
                        {selectedDetail.user?.role || selectedDetail.employee.designation}
                      </span>
                    </div>
                    <div className="rounded-xl p-3.5 shadow-2xs" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
                      <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--muted)' }}>
                        Joined Company
                      </span>
                      <span className="font-bold text-xs mt-1 block" style={{ color: 'var(--ink)' }}>
                        {selectedDetail.employee.joining_date}
                      </span>
                    </div>
                  </div>

                  {selectedDetail.restricted ? (
                    <div
                      className="rounded-xl p-6 text-xs"
                      style={{ background: 'var(--amber-wash)', border: '1px solid var(--amber)', color: 'var(--amber)' }}
                    >
                      Directory contact card only. Attendance, tasks, leave balances, and login details are limited to administrators and the employee.
                    </div>
                  ) : (
                    <>
                      {/* Top KPI Ribbon (4 Cards) */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                        <div
                          className="rounded-xl p-4 space-y-1.5 shadow-2xs"
                          style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
                        >
                          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                            Attendance Rate
                          </span>
                          <div className="flex items-baseline justify-between">
                            <span className="text-2xl font-extrabold" style={{ color: 'var(--ink)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                              {selectedDetail.attendance.summary.complianceRate !== undefined
                                ? `${selectedDetail.attendance.summary.complianceRate}%`
                                : '100%'}
                            </span>
                            <span className="text-xs font-semibold" style={{ color: 'var(--teal)' }}>
                              {selectedDetail.attendance.summary.totalRecords} Logs
                            </span>
                          </div>
                        </div>

                        <div
                          className="rounded-xl p-4 space-y-1.5 shadow-2xs"
                          style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
                        >
                          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                            Tasks Completed
                          </span>
                          <div className="flex items-baseline justify-between">
                            <span className="text-2xl font-extrabold" style={{ color: 'var(--ink)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                              {selectedDetail.tasks.summary.completed}
                            </span>
                            <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                              of {selectedDetail.tasks.summary.total} Assigned
                            </span>
                          </div>
                        </div>

                        <div
                          className="rounded-xl p-4 space-y-1.5 shadow-2xs"
                          style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
                        >
                          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                            Annual Leaves Left
                          </span>
                          <div className="flex items-baseline justify-between">
                            <span className="text-2xl font-extrabold" style={{ color: 'var(--violet)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                              {selectedDetail.leaves.balances.annual}
                            </span>
                            <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                              {selectedDetail.leaves.balances.casual} Casual left
                            </span>
                          </div>
                        </div>

                        <div
                          className="rounded-xl p-4 space-y-1.5 shadow-2xs"
                          style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
                        >
                          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                            Conferences & Meets
                          </span>
                          <div className="flex items-baseline justify-between">
                            <span className="text-2xl font-extrabold" style={{ color: 'var(--ink)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                              {selectedDetail.meetings?.summary?.totalMeets || 0}
                            </span>
                            <span className="text-xs font-semibold" style={{ color: 'var(--teal)' }}>
                              {selectedDetail.meetings?.summary?.upcomingCount || 0} Upcoming
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 2-Column Responsive Bento Layout */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left Column: Attendance & Leaves */}
                        <div className="space-y-6">
                          {/* Attendance Tracker */}
                          <div
                            className="rounded-xl p-5 space-y-4 shadow-2xs"
                            style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--ink)' }}>
                                <CalendarCheck className="h-4 w-4" style={{ color: 'var(--teal)' }} />
                                <span>Attendance Summary & Telemetry</span>
                              </div>
                              {selectedDetail.attendance.summary.complianceRate !== undefined && (
                                <span
                                  className="px-2.5 py-0.5 rounded text-xs font-bold"
                                  style={{ background: 'var(--teal-wash)', color: 'var(--teal-ink)', border: '1px solid var(--teal)' }}
                                >
                                  {selectedDetail.attendance.summary.complianceRate}% Compliance
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-4 gap-2 text-center">
                              <div className="rounded-lg p-2.5 shadow-2xs" style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}>
                                <span className="text-[10px] font-bold uppercase block" style={{ color: 'var(--teal)' }}>Present</span>
                                <span className="text-base font-extrabold" style={{ color: 'var(--ink)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>{selectedDetail.attendance.summary.present}</span>
                              </div>
                              <div className="rounded-lg p-2.5 shadow-2xs" style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}>
                                <span className="text-[10px] font-bold uppercase block" style={{ color: 'var(--violet)' }}>Half Day</span>
                                <span className="text-base font-extrabold" style={{ color: 'var(--ink)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>{selectedDetail.attendance.summary.halfDay}</span>
                              </div>
                              <div className="rounded-lg p-2.5 shadow-2xs" style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}>
                                <span className="text-[10px] font-bold uppercase block" style={{ color: 'var(--amber)' }}>On Leave</span>
                                <span className="text-base font-extrabold" style={{ color: 'var(--ink)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>{selectedDetail.attendance.summary.onLeave}</span>
                              </div>
                              <div className="rounded-lg p-2.5 shadow-2xs" style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}>
                                <span className="text-[10px] font-bold uppercase block" style={{ color: 'var(--rose)' }}>Absent</span>
                                <span className="text-base font-extrabold" style={{ color: 'var(--ink)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>{selectedDetail.attendance.summary.absent}</span>
                              </div>
                            </div>

                            {selectedDetail.attendance.recent.length > 0 && (
                              <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--line-soft)' }}>
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold uppercase" style={{ color: 'var(--muted)' }}>
                                    Recent Attendance Logs
                                  </span>
                                  <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                                    Last {selectedDetail.attendance.recent.slice(0, 6).length} records
                                  </span>
                                </div>
                                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                  {selectedDetail.attendance.recent.slice(0, 6).map((att: any) => (
                                    <div
                                      key={att.id}
                                      className="flex items-center justify-between text-xs rounded-lg px-3 py-2"
                                      style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}
                                    >
                                      <span className="font-mono text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                                        {att.date}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        {att.punch_time && (
                                          <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
                                            {att.punch_time}
                                          </span>
                                        )}
                                        <span
                                          className="px-2 py-0.5 rounded text-[10px] font-bold"
                                          style={
                                            att.status === 'PRESENT'
                                              ? { background: 'var(--teal-wash)', color: 'var(--teal-ink)' }
                                              : att.status === 'HALF_DAY'
                                              ? { background: 'var(--violet-wash)', color: 'var(--violet)' }
                                              : att.status === 'ON_LEAVE'
                                              ? { background: 'var(--amber-wash)', color: 'var(--amber)' }
                                              : { background: 'var(--rose-wash)', color: 'var(--rose)' }
                                          }
                                        >
                                          {att.status}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Leave Balances */}
                          <div
                            className="rounded-xl p-5 space-y-4 shadow-2xs"
                            style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
                          >
                            <div className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--ink)' }}>
                              <Calendar className="h-4 w-4" style={{ color: 'var(--violet)' }} />
                              <span>Leave Allowances & Balances</span>
                            </div>

                            <div className="grid grid-cols-4 gap-2 text-center text-xs">
                              <div className="rounded-lg p-2.5 shadow-2xs" style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}>
                                <span className="text-[10px] font-bold uppercase block" style={{ color: 'var(--muted)' }}>Casual</span>
                                <span className="text-sm font-bold mt-0.5 block" style={{ color: 'var(--ink)' }}>{selectedDetail.leaves.balances.casual} days</span>
                              </div>
                              <div className="rounded-lg p-2.5 shadow-2xs" style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}>
                                <span className="text-[10px] font-bold uppercase block" style={{ color: 'var(--muted)' }}>Sick</span>
                                <span className="text-sm font-bold mt-0.5 block" style={{ color: 'var(--ink)' }}>{selectedDetail.leaves.balances.sick} days</span>
                              </div>
                              <div className="rounded-lg p-2.5 shadow-2xs" style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}>
                                <span className="text-[10px] font-bold uppercase block" style={{ color: 'var(--muted)' }}>Annual</span>
                                <span className="text-sm font-bold mt-0.5 block" style={{ color: 'var(--ink)' }}>{selectedDetail.leaves.balances.annual} days</span>
                              </div>
                              <div className="rounded-lg p-2.5 shadow-2xs" style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}>
                                <span className="text-[10px] font-bold uppercase block" style={{ color: 'var(--muted)' }}>Unpaid</span>
                                <span className="text-sm font-bold mt-0.5 block" style={{ color: 'var(--ink)' }}>{selectedDetail.leaves.balances.unpaid} days</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right Column: Tasks & Meetings */}
                        <div className="space-y-6">
                          {/* Tasks & Performance */}
                          <div
                            className="rounded-xl p-5 space-y-4 shadow-2xs"
                            style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--ink)' }}>
                                <CheckSquare className="h-4 w-4" style={{ color: 'var(--teal)' }} />
                                <span>Assigned Tasks & Progress</span>
                              </div>
                              <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                                {selectedDetail.tasks.summary.completed} / {selectedDetail.tasks.summary.total} Done
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div className="rounded-lg p-2.5 shadow-2xs" style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}>
                                <span className="text-[10px] font-bold uppercase block" style={{ color: 'var(--teal)' }}>Completed</span>
                                <span className="text-base font-extrabold" style={{ color: 'var(--ink)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>{selectedDetail.tasks.summary.completed}</span>
                              </div>
                              <div className="rounded-lg p-2.5 shadow-2xs" style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}>
                                <span className="text-[10px] font-bold uppercase block" style={{ color: 'var(--amber)' }}>In Progress</span>
                                <span className="text-base font-extrabold" style={{ color: 'var(--ink)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>{selectedDetail.tasks.summary.inProgress}</span>
                              </div>
                              <div className="rounded-lg p-2.5 shadow-2xs" style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}>
                                <span className="text-[10px] font-bold uppercase block" style={{ color: 'var(--muted)' }}>To Do</span>
                                <span className="text-base font-extrabold" style={{ color: 'var(--ink)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>{selectedDetail.tasks.summary.pending}</span>
                              </div>
                            </div>

                            {selectedDetail.tasks.list.length > 0 ? (
                              <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--line-soft)' }}>
                                <span className="text-[11px] font-bold uppercase block" style={{ color: 'var(--muted)' }}>
                                  Task Backlog & Assignments
                                </span>
                                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                  {selectedDetail.tasks.list.map((task: any) => (
                                    <div
                                      key={task.id}
                                      className="flex items-center justify-between text-xs rounded-lg px-3 py-2"
                                      style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}
                                    >
                                      <div className="min-w-0 pr-2">
                                        <span className="font-semibold truncate block" style={{ color: 'var(--ink)' }}>
                                          {task.title}
                                        </span>
                                        {task.due_date && (
                                          <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                                            Due: {task.due_date}
                                          </span>
                                        )}
                                      </div>
                                      <span
                                        className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                                        style={
                                          task.status === 'done'
                                            ? { background: 'var(--teal-wash)', color: 'var(--teal-ink)' }
                                            : task.status === 'in_progress'
                                            ? { background: 'var(--amber-wash)', color: 'var(--amber)' }
                                            : { background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--line-soft)' }
                                        }
                                      >
                                        {task.status.replace('_', ' ')}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-center py-2" style={{ color: 'var(--muted)' }}>
                                No tasks currently assigned.
                              </p>
                            )}
                          </div>

                          {/* Conferences & Video Meets */}
                          <div
                            className="rounded-xl p-5 space-y-4 shadow-2xs"
                            style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--ink)' }}>
                                <Video className="h-4 w-4" style={{ color: 'var(--teal)' }} />
                                <span>Conferences & Scheduled Meets</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                                  {selectedDetail.meetings?.summary?.totalMeets || 0} Total Meets
                                </span>
                                {selectedDetail.meetings?.summary?.upcomingCount > 0 && (
                                  <span
                                    className="px-2 py-0.5 rounded text-[10px] font-bold"
                                    style={{ background: 'var(--teal-wash)', color: 'var(--teal-ink)' }}
                                  >
                                    {selectedDetail.meetings.summary.upcomingCount} Upcoming
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                              <div className="rounded-lg p-2.5 shadow-2xs" style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}>
                                <span className="text-[10px] font-bold uppercase block" style={{ color: 'var(--muted)' }}>Total Meets</span>
                                <span className="text-sm font-bold mt-0.5 block" style={{ color: 'var(--ink)' }}>{selectedDetail.meetings?.summary?.totalMeets || 0}</span>
                              </div>
                              <div className="rounded-lg p-2.5 shadow-2xs" style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}>
                                <span className="text-[10px] font-bold uppercase block text-emerald-700">Google Meet</span>
                                <span className="text-sm font-bold text-emerald-700 mt-0.5 block">{selectedDetail.meetings?.summary?.googleMeetCount || 0}</span>
                              </div>
                              <div className="rounded-lg p-2.5 shadow-2xs" style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}>
                                <span className="text-[10px] font-bold uppercase block text-indigo-700">MS Teams</span>
                                <span className="text-sm font-bold text-indigo-700 mt-0.5 block">{selectedDetail.meetings?.summary?.teamsCount || 0}</span>
                              </div>
                            </div>

                            {selectedDetail.meetings?.list?.length > 0 ? (
                              <div className="space-y-1.5 pt-2 max-h-48 overflow-y-auto pr-1" style={{ borderTop: '1px solid var(--line-soft)' }}>
                                {selectedDetail.meetings.list.map((m: any) => {
                                  const isTeams = m.meeting_link?.includes('teams.') || m.meeting_platform === 'teams';
                                  return (
                                    <div
                                      key={m.id}
                                      className="flex items-center justify-between text-xs rounded-lg px-3 py-2"
                                      style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}
                                    >
                                      <div className="min-w-0 pr-2">
                                        <span className="font-semibold truncate block" style={{ color: 'var(--ink)' }}>{m.title}</span>
                                        <span className="text-[10px] block" style={{ color: 'var(--muted)' }}>
                                          {new Date(m.start_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span
                                          className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                                          style={
                                            isTeams
                                              ? { background: 'rgba(99, 102, 241, 0.12)', color: '#4F46E5', border: '1px solid rgba(99, 102, 241, 0.3)' }
                                              : { background: 'rgba(16, 185, 129, 0.12)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.3)' }
                                          }
                                        >
                                          {isTeams ? 'Teams' : 'Google Meet'}
                                        </span>
                                        {m.meeting_link && (
                                          <a
                                            href={m.meeting_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1.5 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                                            title="Open video call"
                                          >
                                            <ExternalLink className="h-3.5 w-3.5" />
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-center py-2" style={{ color: 'var(--muted)' }}>
                                No meeting sessions logged yet for this employee.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Sticky Bottom Action Bar */}
              <div
                className="h-14 px-6 sm:px-8 shrink-0 flex items-center justify-between"
                style={{
                  background: 'var(--surface)',
                  borderTop: '1px solid var(--line)',
                }}
              >
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                  <ShieldCheck className="h-4 w-4" style={{ color: 'var(--teal)' }} />
                  <span>Cruvels Internal Workforce Directory • Enterprise 360° Profile</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedDetail(null)}
                    className="btn-primary text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer touch-manipulation active:scale-95 min-h-[44px]"
                  >
                    Close Profile
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Add Employee Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in" style={{ background: 'rgba(10, 20, 25, 0.6)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-lg rounded-2xl p-6 sm:p-7 space-y-5" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
              <div className="flex items-center justify-between pb-3" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                <h3 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--ink)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                  <UserPlus className="h-5 w-5" style={{ color: 'var(--teal)' }} />
                  Add Employee to Workforce
                </h3>
                <button type="button" onClick={() => setShowAddModal(false)} className="flex items-center justify-center rounded-xl transition-colors touch-manipulation active:scale-90 min-h-[44px] min-w-[44px]" style={{ color: 'var(--muted)' }} aria-label="Close modal">
                  <X className="h-5 w-5" style={{ color: 'var(--ink)' }} />
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl p-3 text-xs" style={{ background: 'var(--rose-wash)', border: '1px solid var(--rose)', color: 'var(--rose)' }}>
                  <AlertCircle className="h-4 w-4 shrink-0" style={{ color: 'var(--rose)' }} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleCreateEmployee} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1" style={{ color: 'var(--muted)' }}>First Name</label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. Alex"
                      className="w-full rounded-xl p-2.5 transition-colors focus:outline-none"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1" style={{ color: 'var(--muted)' }}>Last Name</label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="e.g. Miller"
                      className="w-full rounded-xl p-2.5 transition-colors focus:outline-none"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1" style={{ color: 'var(--muted)' }}>Login Username</label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. alex"
                      className="w-full rounded-xl p-2.5 transition-colors focus:outline-none"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1" style={{ color: 'var(--muted)' }}>Company Email Alias</label>
                    <input
                      type="text"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. alex@cruvels.com"
                      className="w-full rounded-xl p-2.5 transition-colors focus:outline-none font-mono"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1" style={{ color: 'var(--muted)' }}>Department</label>
                    <select
                      value={departmentId}
                      onChange={(e) => setDepartmentId(e.target.value)}
                      className="w-full rounded-xl p-2.5 transition-colors focus:outline-none"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1" style={{ color: 'var(--muted)' }}>Designation</label>
                    <input
                      type="text"
                      required
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      placeholder="e.g. QA Automation Engineer"
                      className="w-full rounded-xl p-2.5 transition-colors focus:outline-none"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1" style={{ color: 'var(--muted)' }}>Phone</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 00000"
                      className="w-full rounded-xl p-2.5 transition-colors focus:outline-none"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1" style={{ color: 'var(--muted)' }}>System Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="w-full rounded-xl p-2.5 capitalize transition-colors focus:outline-none"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                    >
                      <option value="intern">Intern</option>
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3" style={{ borderTop: '1px solid var(--line-soft)' }}>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="btn-ghost text-xs font-semibold touch-manipulation active:scale-95 min-h-[44px] px-4"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary rounded-xl px-5 py-2.5 text-xs font-bold disabled:opacity-50 touch-manipulation active:scale-95 min-h-[44px]"
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
