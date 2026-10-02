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
  folder: 'inbox' | 'sent' | 'trash' | 'drafts' | 'spam';
  is_read: boolean;
  is_starred: boolean;
  has_attachments: boolean;
  is_spam?: boolean;
  spam_score?: number;
  spam_reason?: string;
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

export type CreateEmployeeInput = {
  first_name: string;
  last_name: string;
  email: string;
  department_id: string;
  user_id?: string;
  employee_code?: string;
  name?: string;
  phone?: string;
  department_name?: string;
  group_id?: string | null;
  group_name?: string | null;
  is_group_leader?: boolean;
  designation?: string;
  tagline?: string;
  personal_email?: string;
  joining_date?: string;
  manager_id?: string | null;
  manager_name?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
  leave_balances?: LeaveBalances;
  created_by_id?: string | null;
};

export type AttendanceStatus = 'PRESENT' | 'WORK_FROM_HOME' | 'HALF_DAY' | 'ON_LEAVE' | 'ABSENT';

export interface AttendanceRuleConfig {
  markingDeadline: string; // e.g. "10:00" in 24h format
  workingDays: number[]; // [1, 2, 3, 4, 5] (1=Mon, 7=Sun)
  checkInCheckOutRequired: boolean;
  lateMarkingAllowed: boolean;
  gracePeriodMinutes: number; // e.g. 30
  allowSelfEditAfterSubmission: boolean;
  correctionApproverRole: 'admin' | 'group_leader' | 'manager';
  reminderTimes: string[]; // e.g. ['09:30', '10:00', '10:30']
}

export const DEFAULT_ATTENDANCE_RULES: AttendanceRuleConfig = {
  markingDeadline: '10:00',
  workingDays: [1, 2, 3, 4, 5],
  checkInCheckOutRequired: false,
  lateMarkingAllowed: true,
  gracePeriodMinutes: 30,
  allowSelfEditAfterSubmission: false,
  correctionApproverRole: 'admin',
  reminderTimes: ['09:30', '10:00', '10:30'],
};

export type AttendanceCorrectionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AttendanceCorrectionRequest {
  id: string;
  user_id: string;
  employee_id: string;
  employee_name: string;
  department_name: string;
  group_id?: string | null;
  group_name?: string | null;
  date: string; // YYYY-MM-DD
  current_status: string;
  requested_status: AttendanceStatus;
  reason: string;
  status: AttendanceCorrectionStatus;
  reviewed_by_id?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type ComplianceStatus =
  | 'MARKED_PRESENT'
  | 'MARKED_LATE'
  | 'NOT_MARKED'
  | 'ON_LEAVE'
  | 'HOLIDAY'
  | 'CORRECTION_PENDING';

export interface AttendanceComplianceSummary {
  date: string;
  total_active_employees: number;
  present_count: number;
  not_marked_count: number;
  late_count: number;
  on_leave_count: number;
  pending_corrections_count: number;
  compliance_percentage: number;
}

export interface IndividualComplianceRecord {
  employee_id: string;
  employee_name: string;
  department_name: string;
  group_name: string;
  month: string;
  present_days: number;
  late_days: number;
  missing_days: number;
  leave_days: number;
  correction_count: number;
  compliance_rate: number;
}

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
  reviewed_by_id?: string | null;
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
  requires_acknowledgement?: boolean;
  acknowledgement_due_date?: string;
  target_audience?: 'all' | 'interns' | 'employees' | 'engineering' | 'squad';
  target_group_id?: string;
  created_at: string;
  updated_at: string;
}

export type EventType = 'meeting' | 'shift' | 'holiday' | 'event' | 'company_event' | 'deadline' | 'reminder';
export type EventSource = 'internal' | 'google' | 'microsoft' | 'external';

export interface ScheduleEvent {
  id: string;
  title: string;
  description: string;
  event_type: EventType;
  holiday_type?: 'national' | 'company' | 'optional';
  start_time: string; // ISO
  end_time: string; // ISO
  location?: string;
  attendee_ids: string[];
  created_by: string;
  created_at: string;
  source?: EventSource;
  external_event_id?: string;
  meeting_link?: string;
  meeting_platform?: 'google_meet' | 'zoom' | 'teams' | 'other';
  sync_provider?: 'google' | 'microsoft';
  sync_account_email?: string;
}

export interface PublicHolidayDefinition {
  name: string;
  date: string; // YYYY-MM-DD
  type: 'national' | 'company' | 'optional';
  description: string;
}

export const INDIAN_HOLIDAYS_2026: PublicHolidayDefinition[] = [
  { name: 'New Year Day', date: '2026-01-01', type: 'national', description: 'New Year celebration' },
  { name: 'Republic Day', date: '2026-01-26', type: 'national', description: 'National Republic Day holiday' },
  { name: 'Maha Shivaratri', date: '2026-02-15', type: 'optional', description: 'Maha Shivaratri festival' },
  { name: 'Holi', date: '2026-03-04', type: 'national', description: 'Festival of colors' },
  { name: 'Good Friday', date: '2026-04-03', type: 'national', description: 'Good Friday Christian observance' },
  { name: 'Eid ul-Fitr', date: '2026-03-21', type: 'national', description: 'Eid festival celebration' },
  { name: 'Labor Day / May Day', date: '2026-05-01', type: 'company', description: 'International Workers Day' },
  { name: 'Independence Day', date: '2026-08-15', type: 'national', description: 'Indian Independence Day national holiday' },
  { name: 'Raksha Bandhan', date: '2026-08-28', type: 'optional', description: 'Festival of sibling bonds' },
  { name: 'Janmashtami', date: '2026-09-04', type: 'optional', description: 'Krishna Janmashtami' },
  { name: 'Ganesh Chaturthi', date: '2026-09-14', type: 'company', description: 'Vinayaka Chaturthi festival' },
  { name: 'Gandhi Jayanti', date: '2026-10-02', type: 'national', description: 'Mahatma Gandhi birth anniversary' },
  { name: 'Dussehra (Vijayadashami)', date: '2026-10-20', type: 'national', description: 'Triumph of good over evil' },
  { name: 'Diwali (Deepavali)', date: '2026-11-08', type: 'national', description: 'Festival of lights national holiday' },
  { name: 'Guru Nanak Jayanti', date: '2026-11-24', type: 'national', description: 'Guru Nanak birth anniversary' },
  { name: 'Christmas', date: '2026-12-25', type: 'national', description: 'Christmas Day celebration' },
];

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

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'in_review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  author_name: string;
  content: string;
  created_at: string;
}

export interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  size_bytes?: number;
  uploaded_at: string;
}

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
  assigned_poc_id?: string;
  assigned_poc_name?: string;
  attachments?: TaskAttachment[];
  comments?: TaskComment[];
  requires_acknowledgement?: boolean;
  acknowledged_at?: string;
  acknowledged_by_id?: string;
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
  | 'attendance_missing'
  | 'acknowledgement_required'
  | 'system';

export type NotificationState = 'unread' | 'read' | 'action_required' | 'acknowledged' | 'expired';

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  category?: string;
  title: string;
  message: string;
  link_url?: string;
  action_url?: string;
  action_label?: string;
  is_read: boolean;
  state?: NotificationState;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface NotificationPreference {
  user_id: string;
  portal_notifications: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
  task_reminders: boolean;
  announcements: boolean;
  // Immutable compliance locks (§ 11):
  // attendance_compliance: always true
  // security_alerts: always true
  updated_at: string;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<NotificationPreference, 'user_id' | 'updated_at'> = {
  portal_notifications: true,
  email_notifications: true,
  push_notifications: true,
  task_reminders: true,
  announcements: true,
};

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

export interface UserCalendarIntegration {
  id: string;
  user_id: string;
  provider: 'google' | 'microsoft';
  account_email?: string;
  feed_url?: string;
  is_active: boolean;
  last_synced_at?: string;
  sync_error?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// UNIVERSAL ACKNOWLEDGEMENT SYSTEM (Roadmap §§ 5, 6, 7, 8, 29)
// ============================================================================

export type AcknowledgementItemType =
  | 'task'
  | 'notice'
  | 'policy'
  | 'document'
  | 'notification'
  | 'communication';

export type AcknowledgementStatus =
  | 'not_required'
  | 'pending'
  | 'acknowledged'
  | 'overdue';

export interface UniversalAcknowledgement {
  id: string;
  item_type: AcknowledgementItemType;
  item_id: string;
  item_title: string;
  recipient_user_id: string;
  recipient_name?: string;
  recipient_role?: string;
  recipient_email?: string;
  department_id?: string;
  department_name?: string;
  group_id?: string | null;
  group_name?: string | null;
  status: AcknowledgementStatus;
  due_at?: string; // ISO date-time or YYYY-MM-DD
  acknowledged_at?: string; // ISO date-time
  acknowledged_ip?: string;
  acknowledged_user_agent?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface AcknowledgementSummary {
  itemId: string;
  itemType: AcknowledgementItemType;
  itemTitle: string;
  totalRecipients: number;
  acknowledgedCount: number;
  pendingCount: number;
  overdueCount: number;
  complianceRate: number; // percentage (0-100)
  dueAt?: string;
  recipients: {
    id: string;
    userId: string;
    name: string;
    role: string;
    departmentName: string;
    groupName?: string;
    status: AcknowledgementStatus;
    dueAt?: string;
    acknowledgedAt?: string;
  }[];
}

// -------------------------------------------------------------
// GOOGLE DRIVE & WORKSPACE EXPLORER (Roadmap § 12)
// -------------------------------------------------------------
export type DriveSection = 'my_files' | 'shared_files' | 'project_files' | 'company_resources';
export type DriveFileType = 'doc' | 'sheet' | 'slide' | 'pdf' | 'folder' | 'archive' | 'link';

export interface DriveResource {
  id: string;
  name: string;
  description?: string;
  section: DriveSection;
  file_type: DriveFileType;
  external_url: string; // Google Drive / Docs / Sheets link
  owner_user_id: string;
  owner_name: string;
  group_id?: string; // Squad binding
  group_name?: string;
  is_company_wide?: boolean;
  shared_with_user_ids?: string[];
  size_label?: string;
  parent_folder_id?: string;
  created_at: string;
  updated_at: string;
}

// -------------------------------------------------------------
// DYNAMIC SYSTEM SETTINGS & CONFIGURATION (Roadmap § 15)
// -------------------------------------------------------------
export interface ReminderTimingConfig {
  first_reminder: string; // e.g. "09:30"
  second_reminder: string; // e.g. "10:00"
  deadline_warning: boolean;
}

export interface TaskReminderIntervalConfig {
  unacknowledged_hours: number; // e.g. 24
  deadline_prior_hours: number[]; // e.g. [24, 4]
  overdue_escalation_hours: number; // e.g. 12
}

export interface SystemSettings {
  portalName: string;
  supportEmail: string;
  attendanceRules: AttendanceRuleConfig;
  reminderTiming: ReminderTimingConfig;
  taskReminderIntervals: TaskReminderIntervalConfig;
  holidays: PublicHolidayDefinition[];
  allowSelfEditAfterSubmission: boolean;
  updated_at?: string;
  updated_by_id?: string;
  updated_by_name?: string;
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  portalName: 'Cruvels Workplace OS',
  supportEmail: 'ops@cruvels.com',
  attendanceRules: { ...DEFAULT_ATTENDANCE_RULES },
  reminderTiming: {
    first_reminder: '09:30',
    second_reminder: '10:00',
    deadline_warning: true,
  },
  taskReminderIntervals: {
    unacknowledged_hours: 24,
    deadline_prior_hours: [24, 4],
    overdue_escalation_hours: 12,
  },
  holidays: [...INDIAN_HOLIDAYS_2026],
  allowSelfEditAfterSubmission: false,
};

export interface MailReminder {
  id: string;
  user_id: string;
  message_id: string;
  message_subject: string;
  remind_at: string; // ISO string
  note?: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

