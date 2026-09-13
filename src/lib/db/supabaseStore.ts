import { supabaseAdmin, isSupabaseConfigured } from './supabase';
import {
  User,
  UserRole,
  UserStatus,
  MailAlias,
  Message,
  Attachment,
  AuditLog,
  SyncCheckpoint,
  Department,
  Group,
  Employee,
  AttendanceRecord,
  AttendanceStatus,
  LeaveRequest,
  LeaveStatus,
  LeaveBalances,
  Notice,
  ScheduleEvent,
  Note,
  TaskItem,
  AppNotification,
  PushSubscriptionItem,
} from './types';
import { hashPassword, verifyPassword } from '../auth/password';
import { getPasswordPolicyError } from '../auth/password-policy';
import { getIndianDateString, getIndianTimeString } from '../utils/date';

function db() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  return supabaseAdmin;
}

function err(error: { message?: string } | null, fallback: string): never {
  throw new Error(error?.message || fallback);
}

function iso(value: string | Date | null | undefined): string {
  if (!value) return new Date().toISOString();
  return typeof value === 'string' ? value : value.toISOString();
}

function mapCheckpoint(row: any): SyncCheckpoint {
  return {
    id: row.id,
    provider: row.provider,
    history_id: row.last_history_id ?? row.history_id ?? null,
    last_sync_timestamp: iso(row.last_synced_at || row.last_sync_timestamp || row.updated_at),
    status: row.status === 'syncing' ? 'running' : row.status,
    error_message: row.error_message ?? null,
    updated_at: iso(row.updated_at),
  };
}

function mapEmployee(row: any): Employee {
  return {
    ...row,
    leave_balances: row.leave_balances || { casual: 12, sick: 10, annual: 15, unpaid: 0 },
    is_group_leader: Boolean(row.is_group_leader),
  };
}

function mapMessage(row: any): Message {
  return {
    ...row,
    to_addresses: row.to_addresses || [],
    cc_addresses: row.cc_addresses || [],
    bcc_addresses: row.bcc_addresses || [],
    provider_metadata: row.provider_metadata || {},
  };
}

export class SupabaseDataStore {
  public messages: Message[] = [];
  public attachments: Attachment[] = [];
  public vapidKeys: { publicKey: string; privateKey: string } | null = null;
  public pushSubscriptions: PushSubscriptionItem[] = [];

  public persistToDisk() {}
  public loadFromDisk() {
    return true;
  }
  public resetAndSeed() {}

  public datesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
    return aStart <= bEnd && bStart <= aEnd;
  }

  // ----- users & aliases -----
  public async getUserById(id: string): Promise<User | null> {
    const { data, error } = await db().from('users').select('*').eq('id', id).maybeSingle();
    if (error) err(error, 'Failed to load user');
    return data as User | null;
  }

  public async getUserByUsername(username: string): Promise<User | null> {
    const { data, error } = await db()
      .from('users')
      .select('*')
      .ilike('username', username.trim())
      .maybeSingle();
    if (error) err(error, 'Failed to load user');
    return data as User | null;
  }

  public async getUserByEmail(email: string): Promise<User | null> {
    const clean = email.trim().toLowerCase();
    const { data: alias } = await db()
      .from('mail_aliases')
      .select('user_id')
      .eq('email_address', clean)
      .eq('is_active', true)
      .maybeSingle();
    if (alias?.user_id) return this.getUserById(alias.user_id);
    const { data: emp } = await db()
      .from('employees')
      .select('user_id')
      .ilike('email', clean)
      .eq('status', 'ACTIVE')
      .maybeSingle();
    if (emp?.user_id) return this.getUserById(emp.user_id);
    return null;
  }

  public async listUsers(): Promise<User[]> {
    const { data, error } = await db().from('users').select('*');
    if (error) err(error, 'Failed to list users');
    return (data || []) as User[];
  }

  public async createUser(data: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
    const now = new Date().toISOString();
    const row = { ...data, id: crypto.randomUUID(), created_at: now, updated_at: now };
    const { data: created, error } = await db().from('users').insert(row).select('*').single();
    if (error) err(error, 'Failed to create user');
    return created as User;
  }

  public async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const { data, error } = await db()
      .from('users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) err(error, 'Failed to update user');
    return data as User | null;
  }

  public async updateUserRole(userId: string, role: UserRole): Promise<User | null> {
    return this.updateUser(userId, { role });
  }

  public async updateUserStatus(userId: string, status: UserStatus): Promise<User | null> {
    return this.updateUser(userId, { status });
  }

  public async listAllAliases(): Promise<MailAlias[]> {
    const { data, error } = await db().from('mail_aliases').select('*');
    if (error) err(error, 'Failed to list aliases');
    return (data || []) as MailAlias[];
  }

  public async getAliasesByUserId(userId: string): Promise<MailAlias[]> {
    const { data, error } = await db().from('mail_aliases').select('*').eq('user_id', userId);
    if (error) err(error, 'Failed to load aliases');
    return (data || []) as MailAlias[];
  }

  public async getAliasByEmail(email: string): Promise<MailAlias | null> {
    const { data, error } = await db()
      .from('mail_aliases')
      .select('*')
      .eq('email_address', email.trim().toLowerCase())
      .maybeSingle();
    if (error) err(error, 'Failed to load alias');
    return data as MailAlias | null;
  }

  public async createAlias(userId: string, emailAddress: string): Promise<MailAlias> {
    const row = {
      id: crypto.randomUUID(),
      user_id: userId,
      email_address: emailAddress.trim().toLowerCase(),
      is_active: true,
      created_at: new Date().toISOString(),
    };
    const { data, error } = await db().from('mail_aliases').insert(row).select('*').single();
    if (error) err(error, 'Failed to create alias');
    return data as MailAlias;
  }

  public async updateAliasStatus(id: string, isActive: boolean): Promise<MailAlias | null> {
    const { data, error } = await db()
      .from('mail_aliases')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) err(error, 'Failed to update alias');
    return data as MailAlias | null;
  }

  // ----- departments / groups / employees -----
  public async getDepartments(): Promise<Department[]> {
    const { data, error } = await db().from('departments').select('*').order('name');
    if (error) err(error, 'Failed to list departments');
    const departments = (data || []) as Department[];
    const { data: employees } = await db().from('employees').select('department_id, status');
    return departments.map((dept) => ({
      ...dept,
      employee_count: (employees || []).filter((e: any) => e.department_id === dept.id && e.status === 'ACTIVE').length,
    }));
  }

  public async getDepartmentById(id: string): Promise<Department | null> {
    const { data, error } = await db().from('departments').select('*').eq('id', id).maybeSingle();
    if (error) err(error, 'Failed to load department');
    if (!data) return null;
    const { count } = await db()
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('department_id', id)
      .eq('status', 'ACTIVE');
    return { ...(data as Department), employee_count: count || 0 };
  }

  public async createDepartment(data: {
    name: string;
    code: string;
    head_name: string;
    head_id?: string;
    description?: string;
  }): Promise<Department> {
    const now = new Date().toISOString();
    const row = {
      id: `dep-${Date.now().toString(36)}`,
      name: data.name.trim(),
      code: data.code.trim().toUpperCase(),
      head_id: data.head_id || null,
      head_name: data.head_name.trim(),
      description: data.description || '',
      employee_count: 0,
      created_at: now,
      updated_at: now,
    };
    const { data: created, error } = await db().from('departments').insert(row).select('*').single();
    if (error) err(error, 'Failed to create department');
    return created as Department;
  }

  public async updateDepartment(id: string, data: Partial<Department>): Promise<Department | null> {
    const existing = await this.getDepartmentById(id);
    if (!existing) return null;
    const updated = {
      ...data,
      name: data.name ? data.name.trim() : existing.name,
      code: data.code ? data.code.trim().toUpperCase() : existing.code,
      updated_at: new Date().toISOString(),
    };
    const { data: row, error } = await db().from('departments').update(updated).eq('id', id).select('*').maybeSingle();
    if (error) err(error, 'Failed to update department');
    if (data.name && data.name !== existing.name) {
      await db().from('employees').update({ department_name: data.name }).eq('department_id', id);
      await db().from('groups').update({ department_name: data.name }).eq('department_id', id);
    }
    return row as Department | null;
  }

  public async deleteDepartment(id: string): Promise<boolean> {
    const { count } = await db()
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('department_id', id);
    if (count && count > 0) {
      throw new Error(`Cannot delete department with ${count} assigned employees. Please reassign them first.`);
    }
    await db().from('groups').delete().eq('department_id', id);
    const { error, count: deleted } = await db().from('departments').delete({ count: 'exact' }).eq('id', id);
    if (error) err(error, 'Failed to delete department');
    return Boolean(deleted);
  }

  public async getGroups(departmentId?: string): Promise<Group[]> {
    let q = db().from('groups').select('*');
    if (departmentId) q = q.eq('department_id', departmentId);
    const { data, error } = await q;
    if (error) err(error, 'Failed to list groups');
    return (data || []).map((g: any) => ({ ...g, member_ids: g.member_ids || [] }));
  }

  public async getGroupById(id: string): Promise<Group | null> {
    const { data, error } = await db().from('groups').select('*').eq('id', id).maybeSingle();
    if (error) err(error, 'Failed to load group');
    return data ? { ...data, member_ids: data.member_ids || [] } : null;
  }

  public async createGroup(data: {
    name: string;
    department_id: string;
    leader_id: string;
    member_ids?: string[];
    description?: string;
    created_by_id?: string;
  }): Promise<Group> {
    const dept = await this.getDepartmentById(data.department_id);
    if (!dept) throw new Error('Department not found.');
    const leader = await this.getEmployeeById(data.leader_id);
    if (!leader) throw new Error('Designated Group Leader employee not found.');
    const id = `grp-${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const members = Array.from(new Set([data.leader_id, ...(data.member_ids || [])]));
    const row = {
      id,
      name: data.name.trim(),
      department_id: dept.id,
      department_name: dept.name,
      leader_id: leader.id,
      leader_name: leader.name,
      member_ids: members,
      description: data.description || '',
      created_by_id: data.created_by_id || null,
      created_at: now,
      updated_at: now,
    };
    const { data: created, error } = await db().from('groups').insert(row).select('*').single();
    if (error) err(error, 'Failed to create group');
    for (const memberId of members) {
      await db()
        .from('employees')
        .update({
          group_id: id,
          group_name: row.name,
          is_group_leader: memberId === leader.id,
          updated_at: now,
        })
        .eq('id', memberId);
    }
    return { ...created, member_ids: members } as Group;
  }

  public async updateGroup(id: string, data: Partial<Group>): Promise<Group | null> {
    const existing = await this.getGroupById(id);
    if (!existing) return null;
    let leaderName = existing.leader_name;
    if (data.leader_id && data.leader_id !== existing.leader_id) {
      const leader = await this.getEmployeeById(data.leader_id);
      if (leader) leaderName = leader.name;
    }
    let members = data.member_ids ? Array.from(new Set(data.member_ids)) : existing.member_ids;
    if (data.leader_id && !members.includes(data.leader_id)) members.push(data.leader_id);
    const now = new Date().toISOString();
    const { data: updated, error } = await db()
      .from('groups')
      .update({
        ...data,
        leader_name: leaderName,
        member_ids: members,
        updated_at: now,
      })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) err(error, 'Failed to update group');
    await db()
      .from('employees')
      .update({ group_id: null, group_name: null, is_group_leader: false, updated_at: now })
      .eq('group_id', id);
    for (const memberId of members) {
      await db()
        .from('employees')
        .update({
          group_id: id,
          group_name: updated?.name || existing.name,
          is_group_leader: memberId === (data.leader_id || existing.leader_id),
          updated_at: now,
        })
        .eq('id', memberId);
    }
    return updated ? { ...updated, member_ids: members } : null;
  }

  public async deleteGroup(id: string): Promise<boolean> {
    await db()
      .from('employees')
      .update({ group_id: null, group_name: null, is_group_leader: false })
      .eq('group_id', id);
    const { error, count } = await db().from('groups').delete({ count: 'exact' }).eq('id', id);
    if (error) err(error, 'Failed to delete group');
    return Boolean(count);
  }

  public async isGroupLeaderFor(leaderEmployeeId: string, memberEmployeeId: string): Promise<boolean> {
    const groups = await this.getGroups();
    return groups.some((g) => g.leader_id === leaderEmployeeId && g.member_ids.includes(memberEmployeeId));
  }

  public async getEmployees(filter?: { departmentId?: string; groupId?: string; search?: string }): Promise<Employee[]> {
    let q = db().from('employees').select('*');
    if (filter?.departmentId) q = q.eq('department_id', filter.departmentId);
    if (filter?.groupId) q = q.eq('group_id', filter.groupId);
    const { data, error } = await q;
    if (error) err(error, 'Failed to list employees');
    let result = (data || []).map(mapEmployee);
    if (filter?.search) {
      const s = filter.search.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(s) ||
          e.email.toLowerCase().includes(s) ||
          e.employee_code.toLowerCase().includes(s) ||
          e.designation.toLowerCase().includes(s)
      );
    }
    return result;
  }

  public async getEmployeeById(id: string): Promise<Employee | null> {
    const { data, error } = await db().from('employees').select('*').eq('id', id).maybeSingle();
    if (error) err(error, 'Failed to load employee');
    return data ? mapEmployee(data) : null;
  }

  public async getEmployeeByUserId(userId: string): Promise<Employee | null> {
    const { data, error } = await db().from('employees').select('*').eq('user_id', userId).maybeSingle();
    if (error) err(error, 'Failed to load employee');
    return data ? mapEmployee(data) : null;
  }

  public async createEmployee(data: Omit<Employee, 'id' | 'created_at' | 'updated_at'>): Promise<Employee> {
    const id = `emp-${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const row = { ...data, id, created_at: now, updated_at: now };
    const { data: created, error } = await db().from('employees').insert(row).select('*').single();
    if (error) err(error, 'Failed to create employee');
    if (row.group_id) {
      const grp = await this.getGroupById(row.group_id);
      if (grp && !grp.member_ids.includes(id)) {
        await this.updateGroup(grp.id, { member_ids: [...grp.member_ids, id] });
      }
    }
    return mapEmployee(created);
  }

  public async updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee | null> {
    const { data, error } = await db()
      .from('employees')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) err(error, 'Failed to update employee');
    return data ? mapEmployee(data) : null;
  }

  // ----- attendance / leaves -----
  public async markDailyAttendance(data: {
    employee_id: string;
    employee_name: string;
    date: string;
    status: AttendanceStatus;
    punch_time?: string;
    notes?: string;
    marked_by_id?: string;
    is_admin_override?: boolean;
  }): Promise<AttendanceRecord> {
    const now = new Date();
    const isoNow = now.toISOString();
    const punch = data.punch_time || getIndianTimeString(now);
    const { data: existing } = await db()
      .from('attendance_records')
      .select('*')
      .eq('employee_id', data.employee_id)
      .eq('date', data.date)
      .maybeSingle();

    if (existing) {
      if (existing.is_locked && !data.is_admin_override) {
        throw new Error(`Attendance for ${data.date} has already been recorded and cannot be modified.`);
      }
      const { data: updated, error } = await db()
        .from('attendance_records')
        .update({
          status: data.status,
          punch_time: existing.punch_time || punch,
          notes: data.notes || existing.notes,
          marked_by_id: data.marked_by_id || existing.marked_by_id,
          is_locked: true,
          updated_at: isoNow,
        })
        .eq('id', existing.id)
        .select('*')
        .single();
      if (error) err(error, 'Failed to update attendance');
      return updated as AttendanceRecord;
    }

    const row = {
      id: `att-${crypto.randomUUID()}`,
      employee_id: data.employee_id,
      employee_name: data.employee_name,
      date: data.date,
      status: data.status,
      punch_time: punch,
      notes: data.notes || '',
      marked_by_id: data.marked_by_id || null,
      is_locked: true,
      created_at: isoNow,
      updated_at: isoNow,
    };
    const { data: created, error } = await db().from('attendance_records').insert(row).select('*').single();
    if (error) {
      if (String(error.message || '').includes('duplicate') || (error as any).code === '23505') {
        throw new Error(`Attendance for ${data.date} has already been recorded and cannot be modified.`);
      }
      err(error, 'Failed to mark attendance');
    }
    return created as AttendanceRecord;
  }

  public async getAttendanceRecords(filter?: {
    employeeId?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<AttendanceRecord[]> {
    let q = db().from('attendance_records').select('*').order('date', { ascending: false });
    if (filter?.employeeId) q = q.eq('employee_id', filter.employeeId);
    if (filter?.date) q = q.eq('date', filter.date);
    if (filter?.startDate) q = q.gte('date', filter.startDate);
    if (filter?.endDate) q = q.lte('date', filter.endDate);
    const { data, error } = await q;
    if (error) err(error, 'Failed to load attendance');
    return (data || []) as AttendanceRecord[];
  }

  public async getLeaveRequests(filter?: { employeeId?: string; status?: LeaveStatus }): Promise<LeaveRequest[]> {
    let q = db().from('leave_requests').select('*').order('created_at', { ascending: false });
    if (filter?.employeeId) q = q.eq('employee_id', filter.employeeId);
    if (filter?.status) q = q.eq('status', filter.status);
    const { data, error } = await q;
    if (error) err(error, 'Failed to load leaves');
    return (data || []) as LeaveRequest[];
  }

  public async getPendingLeaveRequestsForReviewer(reviewerUserId: string): Promise<LeaveRequest[]> {
    const user = await this.getUserById(reviewerUserId);
    if (!user) return [];
    if (user.role === 'admin' || user.role === 'manager') return this.getLeaveRequests({ status: 'PENDING' });
    const reviewerEmp = await this.getEmployeeByUserId(reviewerUserId);
    if (!reviewerEmp) return [];
    const groups = await this.getGroups();
    const ledMemberIds = new Set<string>();
    for (const g of groups.filter((g) => g.leader_id === reviewerEmp.id)) {
      for (const m of g.member_ids) ledMemberIds.add(m);
    }
    const pending = await this.getLeaveRequests({ status: 'PENDING' });
    return pending.filter((l) => ledMemberIds.has(l.employee_id));
  }

  public async findOverlappingLeave(
    employeeId: string,
    startDate: string,
    endDate: string,
    excludeId?: string
  ): Promise<LeaveRequest | null> {
    const { data, error } = await db()
      .from('leave_requests')
      .select('*')
      .eq('employee_id', employeeId)
      .in('status', ['PENDING', 'APPROVED']);
    if (error) err(error, 'Failed to check leave overlap');
    const hit = (data || []).find(
      (l: LeaveRequest) =>
        l.id !== excludeId && this.datesOverlap(startDate, endDate, l.start_date, l.end_date)
    );
    return hit || null;
  }

  public async createLeaveRequest(data: Omit<LeaveRequest, 'id' | 'created_at' | 'updated_at'>): Promise<LeaveRequest> {
    const now = new Date().toISOString();
    const row = { ...data, id: `leave-${crypto.randomUUID()}`, status: 'PENDING', created_at: now, updated_at: now };
    const { data: created, error } = await db().from('leave_requests').insert(row).select('*').single();
    if (error) err(error, 'Failed to create leave request');
    return created as LeaveRequest;
  }

  public async updateLeaveStatus(
    id: string,
    status: LeaveStatus,
    reviewerId: string,
    reviewerName: string,
    rejectionReason?: string
  ): Promise<LeaveRequest | null> {
    const existing = (await db().from('leave_requests').select('*').eq('id', id).maybeSingle()).data as LeaveRequest | null;
    if (!existing) return null;
    if (existing.status === status) return existing;
    const previousStatus = existing.status;
    const { data: updated, error } = await db()
      .from('leave_requests')
      .update({
        status,
        reviewed_by: reviewerId,
        reviewed_by_name: reviewerName,
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejectionReason || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) err(error, 'Failed to update leave');

    const typeKey = existing.leave_type.toLowerCase() as keyof LeaveBalances;
    const emp = await this.getEmployeeById(existing.employee_id);
    if (emp && existing.leave_type !== 'UNPAID' && emp.leave_balances[typeKey] !== undefined) {
      const balances = { ...emp.leave_balances };
      if (status === 'APPROVED' && previousStatus !== 'APPROVED') {
        balances[typeKey] = Math.max(0, balances[typeKey] - existing.days_count);
      } else if (status === 'CANCELLED' && previousStatus === 'APPROVED') {
        balances[typeKey] += existing.days_count;
      }
      await this.updateEmployee(emp.id, { leave_balances: balances });
    }
    return updated as LeaveRequest | null;
  }

  // ----- tasks / notices / schedule / notes -----
  public async getTasks(filter?: { assignedToId?: string; status?: string }): Promise<TaskItem[]> {
    let q = db().from('tasks').select('*').order('created_at', { ascending: false });
    if (filter?.assignedToId) q = q.eq('assigned_to_id', filter.assignedToId);
    if (filter?.status) q = q.eq('status', filter.status);
    const { data, error } = await q;
    if (error) err(error, 'Failed to list tasks');
    return (data || []).map((t: any) => ({ ...t, activity: t.activity || [] }));
  }

  public async getTaskById(id: string): Promise<TaskItem | null> {
    const { data, error } = await db().from('tasks').select('*').eq('id', id).maybeSingle();
    if (error) err(error, 'Failed to load task');
    return data ? { ...data, created_by_name: data.created_by_name || 'Unknown', activity: data.activity || [] } : null;
  }

  public async createTask(
    data: Omit<TaskItem, 'id' | 'created_at' | 'updated_at' | 'activity'> & { activity?: TaskItem['activity'] }
  ): Promise<TaskItem> {
    const now = new Date().toISOString();
    const row = {
      ...data,
      id: `task-${crypto.randomUUID()}`,
      created_by_name: data.created_by_name || 'Unknown',
      activity: data.activity || [
        { at: now, by_id: data.created_by_id, by_name: data.created_by_name || 'Unknown', action: 'created' },
      ],
      created_at: now,
      updated_at: now,
    };
    const { data: created, error } = await db().from('tasks').insert(row).select('*').single();
    if (error) err(error, 'Failed to create task');
    return { ...created, activity: created.activity || [] };
  }

  public async updateTask(
    id: string,
    updates: Partial<TaskItem>,
    actor?: { id: string; name: string }
  ): Promise<TaskItem | null> {
    const existing = await this.getTaskById(id);
    if (!existing) return null;
    const activity = [...(existing.activity || [])];
    if (actor) {
      const tracked: Array<keyof TaskItem> = ['title', 'description', 'status', 'priority', 'due_date', 'assigned_to_id'];
      for (const field of tracked) {
        if (updates[field] !== undefined && updates[field] !== existing[field]) {
          activity.push({
            at: new Date().toISOString(),
            by_id: actor.id,
            by_name: actor.name,
            action: 'updated',
            field,
            from: String(existing[field] ?? ''),
            to: String(updates[field] ?? ''),
          });
        }
      }
    }
    const { data, error } = await db()
      .from('tasks')
      .update({ ...updates, activity, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) err(error, 'Failed to update task');
    return data ? { ...data, activity: data.activity || [] } : null;
  }

  public async deleteTask(id: string): Promise<boolean> {
    const { error, count } = await db().from('tasks').delete({ count: 'exact' }).eq('id', id);
    if (error) err(error, 'Failed to delete task');
    return Boolean(count);
  }

  public async getNotices(): Promise<Notice[]> {
    const { data, error } = await db().from('notices').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
    if (error) err(error, 'Failed to list notices');
    return (data || []) as Notice[];
  }

  public async createNotice(data: Omit<Notice, 'id' | 'created_at' | 'updated_at'>): Promise<Notice> {
    const now = new Date().toISOString();
    const row = { ...data, id: `notice-${crypto.randomUUID()}`, created_at: now, updated_at: now };
    const { data: created, error } = await db().from('notices').insert(row).select('*').single();
    if (error) err(error, 'Failed to create notice');
    return created as Notice;
  }

  public async deleteNotice(id: string): Promise<boolean> {
    const { error, count } = await db().from('notices').delete({ count: 'exact' }).eq('id', id);
    if (error) err(error, 'Failed to delete notice');
    return Boolean(count);
  }

  public async getNoticeById(id: string): Promise<Notice | null> {
    const { data, error } = await db().from('notices').select('*').eq('id', id).maybeSingle();
    if (error) err(error, 'Failed to load notice');
    return data as Notice | null;
  }

  public async updateNotice(id: string, updates: Partial<Notice>): Promise<Notice | null> {
    const { data, error } = await db()
      .from('notices')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) err(error, 'Failed to update notice');
    return data as Notice | null;
  }

  public async getScheduleEvents(): Promise<ScheduleEvent[]> {
    const { data, error } = await db().from('schedule_events').select('*').order('start_time');
    if (error) err(error, 'Failed to list schedule');
    return (data || []).map((e: any) => ({ ...e, attendee_ids: e.attendee_ids || [] }));
  }

  public async createScheduleEvent(data: Omit<ScheduleEvent, 'id' | 'created_at'>): Promise<ScheduleEvent> {
    const row = { ...data, id: `evt-${crypto.randomUUID()}`, created_at: new Date().toISOString() };
    const { data: created, error } = await db().from('schedule_events').insert(row).select('*').single();
    if (error) err(error, 'Failed to create event');
    return { ...created, attendee_ids: created.attendee_ids || [] };
  }

  public async getNotes(userId: string): Promise<Note[]> {
    const { data, error } = await db().from('notes').select('*').eq('user_id', userId).order('is_pinned', { ascending: false });
    if (error) err(error, 'Failed to list notes');
    return (data || []) as Note[];
  }

  public async createNote(data: Omit<Note, 'id' | 'created_at' | 'updated_at'>): Promise<Note> {
    const now = new Date().toISOString();
    const row = { ...data, id: `note-${crypto.randomUUID()}`, created_at: now, updated_at: now };
    const { data: created, error } = await db().from('notes').insert(row).select('*').single();
    if (error) err(error, 'Failed to create note');
    return created as Note;
  }

  public async updateNote(id: string, userId: string, updates: Partial<Note>): Promise<Note | null> {
    const { data, error } = await db()
      .from('notes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();
    if (error) err(error, 'Failed to update note');
    return data as Note | null;
  }

  public async deleteNote(id: string, userId: string): Promise<boolean> {
    const { error, count } = await db().from('notes').delete({ count: 'exact' }).eq('id', id).eq('user_id', userId);
    if (error) err(error, 'Failed to delete note');
    return Boolean(count);
  }

  // ----- messages -----
  public async getMessageById(id: string): Promise<Message | null> {
    const { data, error } = await db().from('messages').select('*').eq('id', id).maybeSingle();
    if (error) err(error, 'Failed to load message');
    return data ? mapMessage(data) : null;
  }

  public async getMessageByProviderId(providerMessageId: string): Promise<Message | null> {
    const { data, error } = await db().from('messages').select('*').eq('provider_message_id', providerMessageId).maybeSingle();
    if (error) err(error, 'Failed to load message');
    return data ? mapMessage(data) : null;
  }

  public async getMessagesByOwner(
    ownerUserId: string,
    options: {
      folder?: string;
      limit?: number;
      offset?: number;
      page?: number;
      query?: string;
      isRead?: boolean;
      isStarred?: boolean;
    } = {}
  ): Promise<{ messages: Message[]; total: number }> {
    const folder = options.folder || 'inbox';
    const limit = options.limit || 50;
    const page = options.page || 1;
    const offset = options.offset !== undefined ? options.offset : (page - 1) * limit;

    let q = db().from('messages').select('*', { count: 'exact' }).eq('owner_user_id', ownerUserId).eq('folder', folder);
    if (options.isRead !== undefined) q = q.eq('is_read', options.isRead);
    if (options.isStarred !== undefined) q = q.eq('is_starred', options.isStarred);
    if (options.query && options.query.trim()) {
      const raw = options.query.trim().replace(/,/g, ' ').replace(/%/g, '');
      q = q.or(`subject.ilike.%${raw}%,from_address.ilike.%${raw}%,snippet.ilike.%${raw}%`);
    }
    const { data, error, count } = await q
      .order('received_at', { ascending: false, nullsFirst: false })
      .order('sent_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);
    if (error) err(error, 'Failed to list messages');
    return { messages: (data || []).map(mapMessage), total: count || 0 };
  }

  public async createMessage(data: Omit<Message, 'id' | 'created_at' | 'updated_at'>): Promise<Message> {
    const now = new Date().toISOString();
    const row = { ...data, id: crypto.randomUUID(), created_at: now, updated_at: now };
    const { data: created, error } = await db().from('messages').insert(row).select('*').single();
    if (error) err(error, 'Failed to create message');
    return mapMessage(created);
  }

  public async updateMessage(id: string, updates: Partial<Message>): Promise<Message | null> {
    const { data, error } = await db()
      .from('messages')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) err(error, 'Failed to update message');
    return data ? mapMessage(data) : null;
  }

  public async deleteMessage(id: string): Promise<boolean> {
    const { error, count } = await db().from('messages').delete({ count: 'exact' }).eq('id', id);
    if (error) err(error, 'Failed to delete message');
    return Boolean(count);
  }

  public async getMessageByProviderAndOwner(providerMessageId: string, ownerUserId: string): Promise<Message | null> {
    const { data, error } = await db()
      .from('messages')
      .select('*')
      .eq('provider_message_id', providerMessageId)
      .eq('owner_user_id', ownerUserId)
      .maybeSingle();
    if (error) err(error, 'Failed to load message');
    return data ? mapMessage(data) : null;
  }

  public async findMessageByRfcId(ownerUserId: string, rfcId: string, folder?: string): Promise<Message | null> {
    const needle = String(rfcId || '').trim().replace(/^<|>$/g, '').toLowerCase();
    if (!needle) return null;
    let q = db().from('messages').select('*').eq('owner_user_id', ownerUserId).eq('rfc_message_id', needle);
    if (folder) q = q.eq('folder', folder);
    const { data, error } = await q.maybeSingle();
    if (error || !data) {
      let q2 = db().from('messages').select('*').eq('owner_user_id', ownerUserId).contains('provider_metadata', { rfcMessageId: needle });
      if (folder) q2 = q2.eq('folder', folder);
      const fallback = await q2.maybeSingle();
      return fallback.data ? mapMessage(fallback.data) : null;
    }
    return mapMessage(data);
  }

  public async countMessages(folder?: string): Promise<number> {
    let q = db().from('messages').select('id', { count: 'exact', head: true });
    if (folder) q = q.eq('folder', folder);
    const { count, error } = await q;
    if (error) err(error, 'Failed to count messages');
    return count || 0;
  }

  public async getAttachmentById(id: string): Promise<Attachment | null> {
    const { data, error } = await db().from('attachments').select('*').eq('id', id).maybeSingle();
    if (error) err(error, 'Failed to load attachment');
    return data as Attachment | null;
  }

  public async getAttachmentsByMessageId(messageId: string): Promise<Attachment[]> {
    const { data, error } = await db().from('attachments').select('*').eq('message_id', messageId);
    if (error) err(error, 'Failed to load attachments');
    return (data || []) as Attachment[];
  }

  public async createAttachment(data: Omit<Attachment, 'id' | 'created_at'>): Promise<Attachment> {
    const row = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    const { data: created, error } = await db().from('attachments').insert(row).select('*').single();
    if (error) err(error, 'Failed to create attachment');
    return created as Attachment;
  }

  public async updateAttachment(id: string, updates: Partial<Attachment>): Promise<Attachment | null> {
    const { data, error } = await db().from('attachments').update(updates).eq('id', id).select('*').maybeSingle();
    if (error) err(error, 'Failed to update attachment');
    return data as Attachment | null;
  }

  public async addAuditLog(entry: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog> {
    const row = { ...entry, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    const { data, error } = await db().from('audit_logs').insert(row).select('*').single();
    if (error) err(error, 'Failed to write audit log');
    return data as AuditLog;
  }

  public async createAuditLog(entry: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog> {
    return this.addAuditLog(entry);
  }

  public async listAuditLogs(options?: { limit?: number; action?: string }): Promise<AuditLog[]> {
    let q = db().from('audit_logs').select('*').order('created_at', { ascending: false }).limit(options?.limit || 50);
    if (options?.action) q = q.eq('action', options.action);
    const { data, error } = await q;
    if (error) err(error, 'Failed to list audit logs');
    return (data || []) as AuditLog[];
  }

  public async getCheckpoint(provider: string): Promise<SyncCheckpoint | null> {
    const { data, error } = await db().from('sync_checkpoints').select('*').eq('provider', provider).maybeSingle();
    if (error) err(error, 'Failed to load checkpoint');
    return data ? mapCheckpoint(data) : null;
  }

  public async saveCheckpoint(provider: string, data: SyncCheckpoint): Promise<void> {
    const id = data.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.id)
      ? data.id
      : crypto.randomUUID();
    const row = {
      id,
      provider,
      last_history_id: data.history_id,
      last_synced_at: data.last_sync_timestamp,
      status: data.status,
      error_message: data.error_message ?? null,
      updated_at: data.updated_at || new Date().toISOString(),
    };
    const { error } = await db().from('sync_checkpoints').upsert(row, { onConflict: 'provider' });
    if (error) err(error, 'Failed to save checkpoint');
  }

  public async tryAcquireSyncLock(provider: string, ttlMs = 120000): Promise<boolean> {
    const existing = await this.getCheckpoint(provider);
    if (existing?.status === 'running') {
      const age = Date.now() - new Date(existing.updated_at).getTime();
      if (age < ttlMs) return false;
    }
    await this.saveCheckpoint(provider, {
      id: existing?.id || crypto.randomUUID(),
      provider,
      history_id: existing?.history_id || null,
      last_sync_timestamp: existing?.last_sync_timestamp || new Date().toISOString(),
      status: 'running',
      error_message: null,
      updated_at: new Date().toISOString(),
    });
    return true;
  }

  public async releaseSyncLock(provider: string, next?: Partial<SyncCheckpoint>): Promise<void> {
    const existing = await this.getCheckpoint(provider);
    await this.saveCheckpoint(provider, {
      id: existing?.id || crypto.randomUUID(),
      provider,
      history_id: next?.history_id ?? existing?.history_id ?? null,
      last_sync_timestamp: next?.last_sync_timestamp || new Date().toISOString(),
      status: next?.status || 'idle',
      error_message: next?.error_message ?? null,
      updated_at: new Date().toISOString(),
    });
  }

  public async getDashboardStats(userId: string) {
    const employee = await this.getEmployeeByUserId(userId);
    const today = getIndianDateString();
    const todayAttendance = employee
      ? (await this.getAttendanceRecords({ employeeId: employee.id, date: today }))[0] || null
      : null;
    const unread = await this.getMessagesByOwner(userId, { folder: 'inbox', isRead: false, limit: 1 });
    const userTasks = employee ? await this.getTasks({ assignedToId: employee.id }) : [];
    const pendingLeaves = employee ? await this.getLeaveRequests({ employeeId: employee.id, status: 'PENDING' }) : [];
    const recentNotices = await this.getNotices();
    const scheduleEvents = await this.getScheduleEvents();
    const todayStart = `${today}T00:00:00+05:30`;
    const todayEnd = `${today}T23:59:59+05:30`;
    const { count: empCount } = await db().from('employees').select('id', { count: 'exact', head: true });
    return {
      employee: employee || null,
      todayAttendance,
      unreadEmails: unread.total,
      pendingTasksCount: userTasks.filter((t) => t.status !== 'done').length,
      completedTasksCount: userTasks.filter((t) => t.status === 'done').length,
      pendingLeavesCount: pendingLeaves.length,
      totalEmployeesCount: empCount || 0,
      leaveBalances: employee?.leave_balances || { casual: 0, sick: 0, annual: 0, unpaid: 0 },
      recentNotices: recentNotices.slice(0, 5),
      todaySchedule: scheduleEvents.filter((e) => e.start_time >= todayStart && e.start_time <= todayEnd).slice(0, 5),
    };
  }

  public async updateEmployeeProfile(
    userId: string,
    data: { phone?: string; personal_email?: string; tagline?: string; firstName?: string; lastName?: string }
  ): Promise<Employee | null> {
    let emp = await this.getEmployeeByUserId(userId);
    const user = await this.getUserById(userId);
    if (!user) return null;
    if (!emp) {
      emp = await this.createEmployee({
        user_id: user.id,
        employee_code: `CRUV-${Math.floor(100 + Math.random() * 900)}`,
        first_name: data.firstName || user.name.split(' ')[0] || user.name,
        last_name: data.lastName || user.name.split(' ')[1] || 'Staff',
        name: user.name,
        email: user.username.includes('@') ? user.username : `${user.username}@cruvels.com`,
        phone: data.phone || '+91 90000 00000',
        department_id: 'dep-001',
        department_name: 'Engineering',
        designation: user.role === 'admin' ? 'Administrator' : 'Team Member',
        joining_date: getIndianDateString(),
        status: 'ACTIVE',
        leave_balances: { casual: 12, sick: 10, annual: 15, unpaid: 0 },
      });
    }
    return this.updateEmployee(emp.id, {
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.personal_email !== undefined ? { personal_email: data.personal_email } : {}),
      ...(data.tagline !== undefined ? { tagline: data.tagline } : {}),
    });
  }

  public async changeUserPassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    const user = await this.getUserById(userId);
    if (!user) return { success: false, error: 'User not found.' };
    if (!verifyPassword(currentPassword, user.password_hash)) {
      return { success: false, error: 'Current password is incorrect.' };
    }
    const policyError = getPasswordPolicyError(newPassword);
    if (policyError) {
      return { success: false, error: policyError };
    }
    if (currentPassword === newPassword) {
      return { success: false, error: 'New password must be different from the current password.' };
    }
    await this.updateUser(userId, { password_hash: hashPassword(newPassword), must_change_password: false });
    return { success: true };
  }

  public async getStorageStats() {
    const totalUsers = (await db().from('users').select('id', { count: 'exact', head: true })).count || 0;
    const totalEmployees = (await db().from('employees').select('id', { count: 'exact', head: true })).count || 0;
    const totalMessages = await this.countMessages();
    const inboxCount = await this.countMessages('inbox');
    const sentCount = await this.countMessages('sent');
    const totalAttachments = (await db().from('attachments').select('id', { count: 'exact', head: true })).count || 0;
    const totalAuditLogs = (await db().from('audit_logs').select('id', { count: 'exact', head: true })).count || 0;
    const totalTasks = (await db().from('tasks').select('id', { count: 'exact', head: true })).count || 0;
    return {
      totalUsers,
      totalEmployees,
      totalMessages,
      inboxCount,
      sentCount,
      totalAttachments,
      totalAuditLogs,
      totalTasks,
      estimatedStorageBytes: 0,
      estimatedStorageFormatted: 'Supabase Postgres',
      supabaseFreeTierCapacityPct: 'n/a',
    };
  }

  public async purgeOldAuditLogs(daysThreshold: number = 30): Promise<{ purgedCount: number }> {
    const cutoff = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await db().from('audit_logs').delete({ count: 'exact' }).lt('created_at', cutoff);
    if (error) err(error, 'Failed to purge audit logs');
    return { purgedCount: count || 0 };
  }

  public async purgeOldMessages(daysThreshold: number = 90, folder?: 'trash' | 'inbox' | 'sent'): Promise<{ purgedCount: number }> {
    const cutoff = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000).toISOString();
    let q = db().from('messages').delete({ count: 'exact' }).lt('created_at', cutoff);
    if (folder) q = q.eq('folder', folder);
    const { count, error } = await q;
    if (error) err(error, 'Failed to purge messages');
    return { purgedCount: count || 0 };
  }

  public async getNotifications(
    userId: string,
    options?: { isRead?: boolean; limit?: number }
  ): Promise<AppNotification[]> {
    let q = db().from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (options?.isRead !== undefined) q = q.eq('is_read', options.isRead);
    if (options?.limit) q = q.limit(options.limit);
    const { data, error } = await q;
    if (error) err(error, 'Failed to list notifications');
    return (data || []) as AppNotification[];
  }

  public async getUnreadNotificationsCount(userId: string): Promise<number> {
    const { count, error } = await db()
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) err(error, 'Failed to count notifications');
    return count || 0;
  }

  public async createNotification(
    data: Omit<AppNotification, 'id' | 'created_at' | 'is_read'>
  ): Promise<AppNotification> {
    const row: AppNotification = {
      ...data,
      id: `notif-${crypto.randomUUID()}`,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    const { data: created, error } = await db().from('notifications').insert(row).select('*').single();
    if (error) err(error, 'Failed to create notification');
    const saved = created as AppNotification;
    void import('../notifications/dispatch')
      .then((mod) => mod.dispatchNotification(saved))
      .catch(() => {});
    return saved;
  }

  public getPushSubscriptionsForUser(userId: string): PushSubscriptionItem[] {
    return this.pushSubscriptions.filter((s) => s.user_id === userId);
  }

  public async listPushSubscriptionsForUser(userId: string): Promise<PushSubscriptionItem[]> {
    const { data, error } = await db().from('push_subscriptions').select('*').eq('user_id', userId);
    if (error) err(error, 'Failed to load push subscriptions');
    return (data || []).map((s: any) => ({ ...s, keys: s.keys || {} }));
  }

  public getOrCreateVapidKeys(): { publicKey: string; privateKey: string } {
    if (this.vapidKeys?.publicKey && this.vapidKeys?.privateKey) return this.vapidKeys;
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      this.vapidKeys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
      void this.setVapidKeys(this.vapidKeys);
      return this.vapidKeys;
    }
    return { publicKey: '', privateKey: '' };
  }

  public setVapidKeys(keys: { publicKey: string; privateKey: string }) {
    this.vapidKeys = keys;
    void db()
      .from('app_settings')
      .upsert({ key: 'vapid', value: keys, updated_at: new Date().toISOString() });
  }

  public async loadVapidKeys(): Promise<{ publicKey: string; privateKey: string } | null> {
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      this.vapidKeys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
      return this.vapidKeys;
    }
    const { data } = await db().from('app_settings').select('value').eq('key', 'vapid').maybeSingle();
    if (data?.value?.publicKey && data.value.privateKey) {
      this.vapidKeys = data.value;
      return this.vapidKeys;
    }
    return null;
  }

  public async markNotificationAsRead(id: string, userId: string): Promise<boolean> {
    const { data, error } = await db()
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();
    if (error) err(error, 'Failed to mark notification read');
    return Boolean(data);
  }

  public async markAllNotificationsAsRead(userId: string): Promise<number> {
    const { count, error } = await db()
      .from('notifications')
      .update({ is_read: true }, { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) err(error, 'Failed to mark notifications read');
    return count || 0;
  }

  public async savePushSubscription(
    userId: string,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string }; deviceName?: string }
  ): Promise<PushSubscriptionItem> {
    await db().from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', subscription.endpoint);
    const row = {
      id: `push-${crypto.randomUUID()}`,
      user_id: userId,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      device_name: subscription.deviceName || 'Web Browser',
      created_at: new Date().toISOString(),
    };
    const { data, error } = await db().from('push_subscriptions').insert(row).select('*').single();
    if (error) err(error, 'Failed to save push subscription');
    return { ...data, keys: data.keys } as PushSubscriptionItem;
  }

  public async deletePushSubscription(id: string): Promise<void> {
    await db().from('push_subscriptions').delete().eq('id', id);
  }

  public async importSnapshot(source: {
    users: Map<string, User>;
    aliases: Map<string, MailAlias>;
    departments: Department[];
    groups: Group[];
    employees: Employee[];
    attendanceRecords: AttendanceRecord[];
    leaveRequests: LeaveRequest[];
    notices: Notice[];
    scheduleEvents: ScheduleEvent[];
    notes: Note[];
    tasks: TaskItem[];
    messages: Message[];
    attachments: Attachment[];
    auditLogs: AuditLog[];
    notifications: AppNotification[];
    pushSubscriptions: PushSubscriptionItem[];
    checkpoints: Map<string, SyncCheckpoint>;
    vapidKeys: { publicKey: string; privateKey: string } | null;
  }): Promise<void> {
    const users = Array.from(source.users.values());
    const aliases = Array.from(source.aliases.values());
    const chunk = async (table: string, rows: any[]) => {
      for (let i = 0; i < rows.length; i += 50) {
        const slice = rows.slice(i, i + 50);
        if (!slice.length) continue;
        const { error } = await db().from(table).upsert(slice, { onConflict: 'id' });
        if (error) err(error, `Failed to import ${table}`);
      }
    };
    await chunk('users', users);
    await chunk('mail_aliases', aliases);
    await chunk('departments', source.departments);
    await chunk('groups', source.groups);
    await chunk('employees', source.employees);
    await chunk('attendance_records', source.attendanceRecords);
    await chunk('leave_requests', source.leaveRequests);
    await chunk('notices', source.notices);
    await chunk('schedule_events', source.scheduleEvents);
    await chunk('notes', source.notes);
    await chunk('tasks', source.tasks);
    await chunk('messages', source.messages);
    await chunk('attachments', source.attachments);
    await chunk('audit_logs', source.auditLogs);
    await chunk('notifications', source.notifications);
    await chunk('push_subscriptions', source.pushSubscriptions);
    for (const cp of source.checkpoints.values()) {
      await this.saveCheckpoint(cp.provider, cp);
    }
    if (source.vapidKeys) this.setVapidKeys(source.vapidKeys);
  }
}
