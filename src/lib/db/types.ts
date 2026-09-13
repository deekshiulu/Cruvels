export type UserRole = 'admin' | 'manager' | 'team_lead' | 'employee' | 'intern';
export type UserStatus = 'active' | 'disabled' | 'suspended';

export interface User {
  id: string;
  name: string;
  username: string;
  password_hash: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  last_login_at?: string | null;
  must_change_password?: boolean;
}

export interface MailAlias {
  id: string;
  user_id: string;
  email_address: string;
  is_active: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  provider_message_id: string;
  thread_id: string;
  owner_user_id: string;
  owner_alias_id: string;
  from_address: string;
  from_name: string | null;
  to_addresses: string[];
  cc_addresses?: string[];
  bcc_addresses?: string[];
  subject: string;
  body_text: string;
  body_html: string | null;
  snippet: string;
  received_at: string | null;
  sent_at: string | null;
  folder: 'inbox' | 'sent' | 'trash' | 'drafts';
  is_read: boolean;
  is_starred: boolean;
  has_attachments: boolean;
  provider_metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface Attachment {
  id: string;
  message_id: string;
  filename: string;
  mime_type: string;
  size: number;
  storage_path: string;
  content_data?: string; // base64 encoded
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, any>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface SyncCheckpoint {
  id: string;
  provider: string;
  history_id: string | null;
  last_sync_timestamp: string;
  status: 'idle' | 'running' | 'error';
  error_message?: string | null;
  updated_at: string;
}

export interface AuthSessionUser {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  assignedAliases: string[];
  primaryAlias: string;
  employeeId?: string | null;
  groupId?: string | null;
  isGroupLeader?: boolean;
  mustChangePassword?: boolean;
}

// ============================================================================
// EMPLOYEE MANAGEMENT & WORKPLACE PRODUCTIVITY DOMAIN MODELS
// ============================================================================

export interface Department {
  id: string;
  name: string;
  code: string;
  head_id?: string | null;
  head_name: string;
  description?: string;
  employee_count: number;
  members?: Array<{
    id: string;
    name: string;
    email: string;
    designation: string;
    group_name?: string | null;
    is_group_leader?: boolean;
    status: string;
  }>;
  member_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  name: string;
  department_id: string;
  department_name: string;
  leader_id: string; // Group Leader (GL) employee_id
  leader_name: string;
  member_ids: string[]; // List of employee_ids
  description?: string;
  created_by_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveBalances {
  casual: number;
  sick: number;
  annual: number;
  unpaid: number;
}

export interface Employee {
  id: string;
  user_id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  name: string;
  email: string;
  phone: string;
  department_id: string;
  department_name: string;
  group_id?: string | null;
  group_name?: string | null;
  is_group_leader?: boolean;
  designation: string;
  tagline?: string;
  personal_email?: string;
  joining_date: string;
  manager_id?: string | null;
  manager_name?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  leave_balances: LeaveBalances;
  created_by_id?: string | null;
  created_at: string;
  updated_at: string;
}

export type AttendanceStatus = 'PRESENT' | 'WORK_FROM_HOME' | 'HALF_DAY' | 'ON_LEAVE' | 'ABSENT';

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  punch_time?: string; // e.g. "09:42 AM IST"
  notes?: string;
  marked_by_id?: string;
  is_locked?: boolean;
  created_at: string;
  updated_at: string;
}

export type LeaveType = 'CASUAL' | 'SICK' | 'ANNUAL' | 'UNPAID';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface LeaveRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  department_name: string;
  group_id?: string | null;
  group_name?: string | null;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string;
  status: LeaveStatus;
  reviewed_by?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export type NoticeCategory = 'General' | 'Urgent' | 'Event' | 'Policy' | 'Engineering';

export interface Notice {
  id: string;
  title: string;
  content: string;
  category: NoticeCategory;
  is_pinned: boolean;
  author_id: string;
  author_name: string;
  created_at: string;
  updated_at: string;
}

export type EventType = 'meeting' | 'shift' | 'holiday' | 'event';

export interface ScheduleEvent {
  id: string;
  title: string;
  description: string;
  event_type: EventType;
  start_time: string; // ISO
  end_time: string; // ISO
  location?: string;
  attendee_ids: string[];
  created_by: string;
  created_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: string;
  color: 'blue' | 'purple' | 'amber' | 'emerald' | 'rose' | 'slate';
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TaskActivityEntry {
  at: string;
  by_id: string;
  by_name: string;
  action: string;
  field?: string;
  from?: string;
  to?: string;
}

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string;
  assigned_to_id: string;
  assigned_to_name: string;
  created_by_id: string;
  created_by_name: string;
  activity: TaskActivityEntry[];
  created_at: string;
  updated_at: string;
}

export type EmailMessage = Message;

export type NotificationType =
  | 'mail'
  | 'task'
  | 'notice'
  | 'schedule'
  | 'leave_approval'
  | 'leave_status'
  | 'system';

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link_url?: string;
  is_read: boolean;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface PushSubscriptionItem {
  id: string;
  user_id: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  device_name?: string;
  created_at: string;
}
