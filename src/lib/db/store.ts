import crypto from 'crypto';
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
  CreateEmployeeInput,
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

// ============================================================================
// INITIAL SEED DATA (CLEAN MASTER ACCOUNT & CORE DEPARTMENTS ONLY)
// ============================================================================

const DEV_SEED_SALT = 'cruvels_static_dev_seed_salt_2026';

const SEED_USERS: User[] = [
  // 1. Master Admin
  {
    id: 'a0000000-0000-0000-0000-000000000001',
    name: 'Admin Supervisor',
    username: 'admin',
    password_hash: hashPassword('Password123!', DEV_SEED_SALT),
    role: 'admin',
    status: 'active',
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  // 2. Charith (Admin)
  {
    id: 'a0000000-0000-0000-0000-000000000002',
    name: 'Charith',
    username: 'charith',
    password_hash: hashPassword('Password123!', DEV_SEED_SALT),
    role: 'admin',
    status: 'active',
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  // 3. Niketh (Admin)
  {
    id: 'a0000000-0000-0000-0000-000000000003',
    name: 'Niketh',
    username: 'niketh',
    password_hash: hashPassword('Password123!', DEV_SEED_SALT),
    role: 'admin',
    status: 'active',
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  // 4. Pannagasai (Admin)
  {
    id: 'a0000000-0000-0000-0000-000000000004',
    name: 'Pannagasai',
    username: 'pannagasai',
    password_hash: hashPassword('Password123!', DEV_SEED_SALT),
    role: 'admin',
    status: 'active',
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  // 5. Harshith (Admin)
  {
    id: 'a0000000-0000-0000-0000-000000000005',
    name: 'Harshith',
    username: 'harshith',
    password_hash: hashPassword('Password123!', DEV_SEED_SALT),
    role: 'admin',
    status: 'active',
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  // 6. Nitheesh (Admin)
  {
    id: 'a0000000-0000-0000-0000-000000000006',
    name: 'Nitheesh',
    username: 'nitheesh',
    password_hash: hashPassword('Password123!', DEV_SEED_SALT),
    role: 'admin',
    status: 'active',
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  // 7. Rahul (Intern)
  {
    id: 'a0000000-0000-0000-0000-000000000007',
    name: 'Rahul Sharma',
    username: 'rahul',
    password_hash: hashPassword('Password123!', DEV_SEED_SALT),
    role: 'intern',
    status: 'active',
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  // 8. Priya (Intern)
  {
    id: 'a0000000-0000-0000-0000-000000000008',
    name: 'Priya Patel',
    username: 'priya',
    password_hash: hashPassword('Password123!', DEV_SEED_SALT),
    role: 'intern',
    status: 'active',
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  // 9. Sales Intern
  {
    id: 'a0000000-0000-0000-0000-000000000009',
    name: 'Sales Intern',
    username: 'sales.intern',
    password_hash: hashPassword('Password123!', DEV_SEED_SALT),
    role: 'intern',
    status: 'active',
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  // 10. HR Intern
  {
    id: 'a0000000-0000-0000-0000-000000000010',
    name: 'HR Intern',
    username: 'hr.intern',
    password_hash: hashPassword('Password123!', DEV_SEED_SALT),
    role: 'intern',
    status: 'active',
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  // 11. Tharun (Intern)
  {
    id: 'a0000000-0000-0000-0000-000000000011',
    name: 'Tharun',
    username: 'tharun.intern',
    password_hash: hashPassword('Password123!', DEV_SEED_SALT),
    role: 'intern',
    status: 'active',
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  // 12. Sugumaran (Intern)
  {
    id: 'a0000000-0000-0000-0000-000000000012',
    name: 'Sugumaran',
    username: 'sugumaran.intern',
    password_hash: hashPassword('Password123!', DEV_SEED_SALT),
    role: 'intern',
    status: 'active',
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
];

const SEED_ALIASES: MailAlias[] = [
  {
    id: 'b0000000-0000-0000-0000-000000000001',
    user_id: 'a0000000-0000-0000-0000-000000000001',
    email_address: 'admin@cruvels.com',
    is_active: true,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000013',
    user_id: 'a0000000-0000-0000-0000-000000000001',
    email_address: 'founder@cruvels.com',
    is_active: true,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000002',
    user_id: 'a0000000-0000-0000-0000-000000000002',
    email_address: 'charith@cruvels.com',
    is_active: true,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000003',
    user_id: 'a0000000-0000-0000-0000-000000000003',
    email_address: 'niketh@cruvels.com',
    is_active: true,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000004',
    user_id: 'a0000000-0000-0000-0000-000000000004',
    email_address: 'pannagasai@cruvels.com',
    is_active: true,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000005',
    user_id: 'a0000000-0000-0000-0000-000000000005',
    email_address: 'harshith@cruvels.com',
    is_active: true,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000006',
    user_id: 'a0000000-0000-0000-0000-000000000006',
    email_address: 'nitheesh@cruvels.com',
    is_active: true,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000007',
    user_id: 'a0000000-0000-0000-0000-000000000007',
    email_address: 'rahul@cruvels.com',
    is_active: true,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000008',
    user_id: 'a0000000-0000-0000-0000-000000000008',
    email_address: 'priya@cruvels.com',
    is_active: true,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000009',
    user_id: 'a0000000-0000-0000-0000-000000000009',
    email_address: 'sales.intern@cruvels.com',
    is_active: true,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000010',
    user_id: 'a0000000-0000-0000-0000-000000000010',
    email_address: 'hr.intern@cruvels.com',
    is_active: true,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000011',
    user_id: 'a0000000-0000-0000-0000-000000000011',
    email_address: 'tharun.intern@cruvels.com',
    is_active: true,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000012',
    user_id: 'a0000000-0000-0000-0000-000000000012',
    email_address: 'sugumaran.intern@cruvels.com',
    is_active: true,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
];

const SEED_DEPARTMENTS: Department[] = [
  {
    id: 'dep-001',
    name: 'Engineering & Technology',
    code: 'ENG',
    head_name: 'Charith',
    description: 'Software development, infrastructure, and technical operations.',
    employee_count: 5,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: 'dep-002',
    name: 'Human Resources & People Ops',
    code: 'HR',
    head_name: 'Admin Supervisor',
    description: 'Talent recruitment, onboarding, and workforce policies.',
    employee_count: 1,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: 'dep-003',
    name: 'Sales & Growth',
    code: 'SALES',
    head_name: 'Harshith',
    description: 'Enterprise outreach, business development, and client accounts.',
    employee_count: 3,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: 'dep-004',
    name: 'Product & Design',
    code: 'PROD',
    head_name: 'Admin Supervisor',
    description: 'Product strategy, UX research, and design systems.',
    employee_count: 1,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
];

const SEED_GROUPS: Group[] = [
  {
    id: 'grp-001',
    name: 'Core Platform Squad',
    department_id: 'dep-001',
    department_name: 'Engineering & Technology',
    leader_id: 'emp-002',
    leader_name: 'Charith',
    member_ids: ['emp-001', 'emp-002', 'emp-003', 'emp-004', 'emp-007', 'emp-008'],
    description: 'Core infrastructure, portal development, and engineering operations.',
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: 'grp-002',
    name: 'Growth & Outreach Squad',
    department_id: 'dep-003',
    department_name: 'Sales & Growth',
    leader_id: 'emp-005',
    leader_name: 'Harshith',
    member_ids: ['emp-005', 'emp-006', 'emp-009'],
    description: 'Client acquisition, partnership management, and market expansion.',
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
];

const SEED_EMPLOYEES: Employee[] = [
  // 1. Admin Supervisor
  {
    id: 'emp-001',
    user_id: 'a0000000-0000-0000-0000-000000000001',
    employee_code: 'CRUV-001',
    first_name: 'Admin',
    last_name: 'Supervisor',
    name: 'Admin Supervisor',
    email: 'admin@cruvels.com',
    phone: '+91 98765 43210',
    department_id: 'dep-001',
    department_name: 'Engineering & Technology',
    group_id: 'grp-001',
    group_name: 'Core Platform Squad',
    is_group_leader: false,
    designation: 'Principal Architect & Director',
    joining_date: '2025-01-01',
    manager_id: null,
    manager_name: null,
    status: 'ACTIVE',
    leave_balances: { casual: 15, sick: 12, annual: 20, unpaid: 0 },
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  // 2. Charith (Admin & GL)
  {
    id: 'emp-002',
    user_id: 'a0000000-0000-0000-0000-000000000002',
    employee_code: 'CRUV-002',
    first_name: 'Charith',
    last_name: 'Admin',
    name: 'Charith',
    email: 'charith@cruvels.com',
    phone: '+91 98765 00001',
    department_id: 'dep-001',
    department_name: 'Engineering & Technology',
    group_id: 'grp-001',
    group_name: 'Core Platform Squad',
    is_group_leader: true,
    designation: 'Engineering Lead & Admin',
    joining_date: '2025-01-01',
    manager_id: 'emp-001',
    manager_name: 'Admin Supervisor',
    status: 'ACTIVE',
    leave_balances: { casual: 15, sick: 12, annual: 20, unpaid: 0 },
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  // 3. Niketh (Admin)
  {
    id: 'emp-003',
    user_id: 'a0000000-0000-0000-0000-000000000003',
    employee_code: 'CRUV-003',
    first_name: 'Niketh',
    last_name: 'Admin',
    name: 'Niketh',
    email: 'niketh@cruvels.com',
    phone: '+91 98765 00002',
    department_id: 'dep-001',
    department_name: 'Engineering & Technology',
    group_id: 'grp-001',
    group_name: 'Core Platform Squad',
    is_group_leader: false,
    designation: 'Staff Infrastructure Engineer & Admin',
    joining_date: '2025-01-01',
    manager_id: 'emp-002',
    manager_name: 'Charith',
    status: 'ACTIVE',
    leave_balances: { casual: 15, sick: 12, annual: 20, unpaid: 0 },
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  // 4. Pannagasai (Admin)
  {
    id: 'emp-004',
    user_id: 'a0000000-0000-0000-0000-000000000004',
    employee_code: 'CRUV-004',
    first_name: 'Pannagasai',
    last_name: 'Admin',
    name: 'Pannagasai',
    email: 'pannagasai@cruvels.com',
    phone: '+91 98765 00003',
    department_id: 'dep-001',
    department_name: 'Engineering & Technology',
    group_id: 'grp-001',
    group_name: 'Core Platform Squad',
    is_group_leader: false,
    designation: 'Principal Systems Engineer & Admin',
    joining_date: '2025-01-01',
    manager_id: 'emp-002',
    manager_name: 'Charith',
    status: 'ACTIVE',
    leave_balances: { casual: 15, sick: 12, annual: 20, unpaid: 0 },
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  // 5. Harshith (Admin & GL)
  {
    id: 'emp-005',
    user_id: 'a0000000-0000-0000-0000-000000000005',
    employee_code: 'CRUV-005',
    first_name: 'Harshith',
    last_name: 'Admin',
    name: 'Harshith',
    email: 'harshith@cruvels.com',
    phone: '+91 98765 00004',
    department_id: 'dep-003',
    department_name: 'Sales & Growth',
    group_id: 'grp-002',
    group_name: 'Growth & Outreach Squad',
    is_group_leader: true,
    designation: 'Growth Director & Admin',
    joining_date: '2025-01-01',
    manager_id: 'emp-001',
    manager_name: 'Admin Supervisor',
    status: 'ACTIVE',
    leave_balances: { casual: 15, sick: 12, annual: 20, unpaid: 0 },
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  // 6. Nitheesh (Admin)
  {
    id: 'emp-006',
    user_id: 'a0000000-0000-0000-0000-000000000006',
    employee_code: 'CRUV-006',
    first_name: 'Nitheesh',
    last_name: 'Admin',
    name: 'Nitheesh',
    email: 'nitheesh@cruvels.com',
    phone: '+91 98765 00005',
    department_id: 'dep-003',
    department_name: 'Sales & Growth',
    group_id: 'grp-002',
    group_name: 'Growth & Outreach Squad',
    is_group_leader: false,
    designation: 'Enterprise Strategy Lead & Admin',
    joining_date: '2025-01-01',
    manager_id: 'emp-005',
    manager_name: 'Harshith',
    status: 'ACTIVE',
    leave_balances: { casual: 15, sick: 12, annual: 20, unpaid: 0 },
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  // 7. Rahul (Intern)
  {
    id: 'emp-007',
    user_id: 'a0000000-0000-0000-0000-000000000007',
    employee_code: 'CRUV-007',
    first_name: 'Rahul',
    last_name: 'Sharma',
    name: 'Rahul Sharma',
    email: 'rahul@cruvels.com',
    phone: '+91 98765 00006',
    department_id: 'dep-001',
    department_name: 'Engineering & Technology',
    group_id: 'grp-001',
    group_name: 'Core Platform Squad',
    is_group_leader: false,
    designation: 'Software Engineering Intern',
    joining_date: '2026-01-01',
    manager_id: 'emp-002',
    manager_name: 'Charith',
    status: 'ACTIVE',
    leave_balances: { casual: 12, sick: 10, annual: 15, unpaid: 0 },
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  // 8. Priya (Intern)
  {
    id: 'emp-008',
    user_id: 'a0000000-0000-0000-0000-000000000008',
    employee_code: 'CRUV-008',
    first_name: 'Priya',
    last_name: 'Patel',
    name: 'Priya Patel',
    email: 'priya@cruvels.com',
    phone: '+91 98765 00007',
    department_id: 'dep-001',
    department_name: 'Engineering & Technology',
    group_id: 'grp-001',
    group_name: 'Core Platform Squad',
    is_group_leader: false,
    designation: 'Frontend Engineering Intern',
    joining_date: '2026-01-01',
    manager_id: 'emp-002',
    manager_name: 'Charith',
    status: 'ACTIVE',
    leave_balances: { casual: 12, sick: 10, annual: 15, unpaid: 0 },
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  // 9. Sales Intern
  {
    id: 'emp-009',
    user_id: 'a0000000-0000-0000-0000-000000000009',
    employee_code: 'CRUV-009',
    first_name: 'Sales',
    last_name: 'Intern',
    name: 'Sales Intern',
    email: 'sales.intern@cruvels.com',
    phone: '+91 98765 00008',
    department_id: 'dep-003',
    department_name: 'Sales & Growth',
    group_id: 'grp-002',
    group_name: 'Growth & Outreach Squad',
    is_group_leader: false,
    designation: 'Business Development Intern',
    joining_date: '2026-01-01',
    manager_id: 'emp-005',
    manager_name: 'Harshith',
    status: 'ACTIVE',
    leave_balances: { casual: 12, sick: 10, annual: 15, unpaid: 0 },
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  // 10. HR Intern
  {
    id: 'emp-010',
    user_id: 'a0000000-0000-0000-0000-000000000010',
    employee_code: 'CRUV-010',
    first_name: 'HR',
    last_name: 'Intern',
    name: 'HR Intern',
    email: 'hr.intern@cruvels.com',
    phone: '+91 98765 00009',
    department_id: 'dep-002',
    department_name: 'Human Resources & People Ops',
    group_id: null,
    group_name: null,
    is_group_leader: false,
    designation: 'People Operations Intern',
    joining_date: '2026-01-01',
    manager_id: 'emp-001',
    manager_name: 'Admin Supervisor',
    status: 'ACTIVE',
    leave_balances: { casual: 12, sick: 10, annual: 15, unpaid: 0 },
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  // 11. Tharun (Intern)
  {
    id: 'emp-011',
    user_id: 'a0000000-0000-0000-0000-000000000011',
    employee_code: 'CRUV-011',
    first_name: 'Tharun',
    last_name: 'Intern',
    name: 'Tharun',
    email: 'tharun.intern@cruvels.com',
    phone: '+91 98765 00010',
    department_id: 'dep-001',
    department_name: 'Engineering & Technology',
    group_id: 'grp-001',
    group_name: 'Core Platform Squad',
    is_group_leader: false,
    designation: 'Software Engineering Intern',
    joining_date: '2026-01-01',
    manager_id: 'emp-002',
    manager_name: 'Charith',
    status: 'ACTIVE',
    leave_balances: { casual: 12, sick: 10, annual: 15, unpaid: 0 },
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  // 12. Sugumaran (Intern)
  {
    id: 'emp-012',
    user_id: 'a0000000-0000-0000-0000-000000000012',
    employee_code: 'CRUV-012',
    first_name: 'Sugumaran',
    last_name: 'Intern',
    name: 'Sugumaran',
    email: 'sugumaran.intern@cruvels.com',
    phone: '+91 98765 00011',
    department_id: 'dep-001',
    department_name: 'Engineering & Technology',
    group_id: 'grp-001',
    group_name: 'Core Platform Squad',
    is_group_leader: false,
    designation: 'Backend Engineering Intern',
    joining_date: '2026-01-01',
    manager_id: 'emp-002',
    manager_name: 'Charith',
    status: 'ACTIVE',
    leave_balances: { casual: 12, sick: 10, annual: 15, unpaid: 0 },
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
];

import { isSupabaseBackendActive, assertProductionDataBackend } from './backend';
import { SupabaseDataStore } from './supabaseStore';
import fs from 'fs';
import path from 'path';

// ============================================================================
// DATA STORE IMPLEMENTATION
// ============================================================================

export class UnifiedDataStore {
  public users: Map<string, User> = new Map();
  public aliases: Map<string, MailAlias> = new Map();
  public messages: Message[] = [];
  public attachments: Attachment[] = [];
  public auditLogs: AuditLog[] = [];
  public checkpoints: Map<string, SyncCheckpoint> = new Map();

  public departments: Department[] = [];
  public groups: Group[] = [];
  public employees: Employee[] = [];
  public attendanceRecords: AttendanceRecord[] = [];
  public leaveRequests: LeaveRequest[] = [];
  public notices: Notice[] = [];
  public scheduleEvents: ScheduleEvent[] = [];
  public notes: Note[] = [];
  public tasks: TaskItem[] = [];
  public notifications: AppNotification[] = [];
  public pushSubscriptions: PushSubscriptionItem[] = [];
  public vapidKeys: { publicKey: string; privateKey: string } | null = null;
  private attendanceLocks = new Map<string, Promise<void>>();

  constructor() {
    this.resetAndSeed();
    this.loadFromDisk();
  }

  private writeJsonAtomic(filePath: string, jsonStr: string) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmpPath = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, jsonStr, 'utf-8');
    try {
      fs.renameSync(tmpPath, filePath);
    } catch {
      fs.writeFileSync(filePath, jsonStr, 'utf-8');
      try {
        fs.unlinkSync(tmpPath);
      } catch {}
    }
  }

  public persistToDisk() {
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      return;
    }

    const data = {
      users: Array.from(this.users.values()),
      aliases: Array.from(this.aliases.values()),
      messages: this.messages,
      attachments: this.attachments,
      auditLogs: this.auditLogs,
      checkpoints: Array.from(this.checkpoints.values()),
      departments: this.departments,
      groups: this.groups,
      employees: this.employees,
      attendanceRecords: this.attendanceRecords,
      leaveRequests: this.leaveRequests,
      notices: this.notices,
      scheduleEvents: this.scheduleEvents,
      notes: this.notes,
      tasks: this.tasks,
      notifications: this.notifications,
      pushSubscriptions: this.pushSubscriptions,
      vapidKeys: this.vapidKeys,
    };

    const jsonStr = JSON.stringify(data, null, 2);

    try {
      this.writeJsonAtomic(path.join(process.cwd(), 'data', 'cruvels_db.json'), jsonStr);
    } catch {
      // Ignore if read-only filesystem (e.g. Vercel)
    }

    try {
      this.writeJsonAtomic(path.join('/tmp', 'cruvels_db.json'), jsonStr);
    } catch {}
  }

  public loadFromDisk(): boolean {
    const dataPath = path.join(process.cwd(), 'data', 'cruvels_db.json');
    const tmpPath = path.join('/tmp', 'cruvels_db.json');
    const pathsToTry =
      process.env.NODE_ENV === 'production' ? [tmpPath, dataPath] : [dataPath, tmpPath];

    for (const filePath of pathsToTry) {
      try {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          const data = JSON.parse(content);
          if (data && (data.users || data.messages || data.employees)) {
            if (data.users && Array.isArray(data.users)) {
              this.users.clear();
              for (const u of data.users) {
                this.users.set(u.id, {
                  ...u,
                  must_change_password: Boolean(u.must_change_password),
                });
              }
            }
            if (data.aliases && Array.isArray(data.aliases)) {
              this.aliases.clear();
              for (const a of data.aliases) this.aliases.set(a.id, a);
            }
            if (Array.isArray(data.messages)) this.messages = data.messages;
            if (Array.isArray(data.attachments)) this.attachments = data.attachments;
            if (Array.isArray(data.auditLogs)) this.auditLogs = data.auditLogs;
            if (data.checkpoints && Array.isArray(data.checkpoints)) {
              this.checkpoints.clear();
              for (const c of data.checkpoints) this.checkpoints.set(c.provider, c);
            }
            if (Array.isArray(data.departments)) this.departments = data.departments;
            if (Array.isArray(data.groups)) this.groups = data.groups;
            if (Array.isArray(data.employees)) this.employees = data.employees;
            if (Array.isArray(data.attendanceRecords)) this.attendanceRecords = data.attendanceRecords;
            if (Array.isArray(data.leaveRequests)) this.leaveRequests = data.leaveRequests;
            if (Array.isArray(data.notices)) this.notices = data.notices;
            if (Array.isArray(data.scheduleEvents)) this.scheduleEvents = data.scheduleEvents;
            if (Array.isArray(data.notes)) this.notes = data.notes;
            if (Array.isArray(data.tasks)) this.tasks = data.tasks;
            if (Array.isArray(data.notifications)) this.notifications = data.notifications;
            if (Array.isArray(data.pushSubscriptions)) this.pushSubscriptions = data.pushSubscriptions;
            if (data.vapidKeys?.publicKey && data.vapidKeys?.privateKey) {
              this.vapidKeys = data.vapidKeys;
            }
            this.tasks = this.tasks.map((t) => ({
              ...t,
              created_by_name: t.created_by_name || 'Unknown',
              activity: Array.isArray(t.activity) ? t.activity : [],
            }));
            return true;
          }
        }
      } catch {}
    }
    return false;
  }

  public resetAndSeed() {
    this.users.clear();
    this.aliases.clear();
    this.messages = [];
    this.attachments = [];
    this.auditLogs = [];
    this.checkpoints.clear();

    for (const u of SEED_USERS) this.users.set(u.id, { ...u, must_change_password: true });
    for (const a of SEED_ALIASES) this.aliases.set(a.id, { ...a });

    this.departments = JSON.parse(JSON.stringify(SEED_DEPARTMENTS));
    this.groups = JSON.parse(JSON.stringify(SEED_GROUPS));
    this.employees = JSON.parse(JSON.stringify(SEED_EMPLOYEES));
    this.attendanceRecords = [];
    this.leaveRequests = [];
    this.notices = [];
    this.scheduleEvents = [];
    this.notes = [];
    this.tasks = [];
    this.notifications = [];
    this.pushSubscriptions = [];
  }

  // -------------------------------------------------------------
  // USER & ALIAS MANAGEMENT (RBAC)
  // -------------------------------------------------------------

  public async getUserById(id: string): Promise<User | null> {
    const user = this.users.get(id);
    return user ? { ...user } : null;
  }

  public async getUserByUsername(username: string): Promise<User | null> {
    const clean = username.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.username.toLowerCase() === clean) return { ...user };
    }
    return null;
  }

  public async getUserByEmail(email: string): Promise<User | null> {
    const clean = email.trim().toLowerCase();
    for (const alias of this.aliases.values()) {
      if (alias.email_address.toLowerCase() === clean && alias.is_active) {
        return this.getUserById(alias.user_id);
      }
    }
    for (const emp of this.employees) {
      if (emp.email.toLowerCase() === clean && emp.status === 'ACTIVE') {
        return this.getUserById(emp.user_id);
      }
    }
    return null;
  }

  public async listUsers(): Promise<User[]> {
    return Array.from(this.users.values()).map((u) => ({ ...u }));
  }

  public async createUser(data: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newUser: User = {
      ...data,
      id,
      created_at: now,
      updated_at: now,
    };
    this.users.set(id, newUser);
    this.persistToDisk();
    return { ...newUser };
  }

  public async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const existing = this.users.get(id);
    if (!existing) return null;

    const updated: User = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.users.set(id, updated);
    this.persistToDisk();
    return { ...updated };
  }

  public async updateUserRole(userId: string, role: UserRole): Promise<User | null> {
    return this.updateUser(userId, { role });
  }

  public async updateUserStatus(userId: string, status: UserStatus): Promise<User | null> {
    return this.updateUser(userId, { status });
  }

  public async listAllAliases(): Promise<MailAlias[]> {
    return Array.from(this.aliases.values()).map((a) => ({ ...a }));
  }

  public async getAliasesByUserId(userId: string): Promise<MailAlias[]> {
    const list: MailAlias[] = [];
    for (const alias of this.aliases.values()) {
      if (alias.user_id === userId) {
        list.push({ ...alias });
      }
    }
    return list;
  }

  public async getAliasByEmail(email: string): Promise<MailAlias | null> {
    const clean = email.trim().toLowerCase();
    for (const alias of this.aliases.values()) {
      if (alias.email_address.toLowerCase() === clean) return { ...alias };
    }
    return null;
  }

  public async createAlias(userId: string, emailAddress: string): Promise<MailAlias> {
    const id = crypto.randomUUID();
    const newAlias: MailAlias = {
      id,
      user_id: userId,
      email_address: emailAddress.trim().toLowerCase(),
      is_active: true,
      created_at: new Date().toISOString(),
    };
    this.aliases.set(id, newAlias);
    this.persistToDisk();
    return { ...newAlias };
  }

  public async updateAliasStatus(id: string, isActive: boolean): Promise<MailAlias | null> {
    const existing = this.aliases.get(id);
    if (!existing) return null;
    existing.is_active = isActive;
    this.aliases.set(id, existing);
    this.persistToDisk();
    return { ...existing };
  }

  // -------------------------------------------------------------
  // DEPARTMENTS (EDITABLE CRUD)
  // -------------------------------------------------------------

  public async getDepartments(): Promise<Department[]> {
    // Recompute headcount dynamically
    return this.departments.map((dept) => {
      const count = this.employees.filter((e) => e.department_id === dept.id && e.status === 'ACTIVE').length;
      return { ...dept, employee_count: count };
    });
  }

  public async getDepartmentById(id: string): Promise<Department | null> {
    const dept = this.departments.find((d) => d.id === id);
    if (!dept) return null;
    const count = this.employees.filter((e) => e.department_id === dept.id && e.status === 'ACTIVE').length;
    return { ...dept, employee_count: count };
  }

  public async createDepartment(data: { name: string; code: string; head_name: string; head_id?: string; description?: string }): Promise<Department> {
    const id = `dep-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const newDept: Department = {
      id,
      name: data.name.trim(),
      code: data.code.trim().toUpperCase(),
      head_id: data.head_id || null,
      head_name: data.head_name.trim(),
      description: data.description || '',
      employee_count: 0,
      created_at: now,
      updated_at: now,
    };
    this.departments.push(newDept);
    this.persistToDisk();
    return { ...newDept };
  }

  public async updateDepartment(id: string, data: Partial<Department>): Promise<Department | null> {
    const index = this.departments.findIndex((d) => d.id === id);
    if (index === -1) return null;

    const existing = this.departments[index];
    const updated: Department = {
      ...existing,
      ...data,
      name: data.name ? data.name.trim() : existing.name,
      code: data.code ? data.code.trim().toUpperCase() : existing.code,
      updated_at: new Date().toISOString(),
    };
    this.departments[index] = updated;

    // Update denormalized department_name in employees and groups
    if (data.name && data.name !== existing.name) {
      for (const emp of this.employees) {
        if (emp.department_id === id) emp.department_name = data.name;
      }
      for (const grp of this.groups) {
        if (grp.department_id === id) grp.department_name = data.name;
      }
    }

    this.persistToDisk();
    return { ...updated };
  }

  public async deleteDepartment(id: string): Promise<boolean> {
    const count = this.employees.filter((e) => e.department_id === id).length;
    if (count > 0) {
      throw new Error(`Cannot delete department with ${count} assigned employees. Please reassign them first.`);
    }
    const initialLen = this.departments.length;
    this.departments = this.departments.filter((d) => d.id !== id);
    this.groups = this.groups.filter((g) => g.department_id !== id);
    if (this.departments.length < initialLen) {
      this.persistToDisk();
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------
  // GROUPS / SQUADS & GROUP LEADERS (GL)
  // -------------------------------------------------------------

  public async getGroups(departmentId?: string): Promise<Group[]> {
    if (departmentId) {
      return this.groups.filter((g) => g.department_id === departmentId).map((g) => ({ ...g }));
    }
    return this.groups.map((g) => ({ ...g }));
  }

  public async getGroupById(id: string): Promise<Group | null> {
    const grp = this.groups.find((g) => g.id === id);
    return grp ? { ...grp } : null;
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

    const id = `grp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const members = Array.from(new Set([data.leader_id, ...(data.member_ids || [])]));

    const newGroup: Group = {
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

    this.groups.push(newGroup);

    // Update leader's GL flag and assign members' group fields
    for (const emp of this.employees) {
      if (members.includes(emp.id)) {
        emp.group_id = id;
        emp.group_name = newGroup.name;
        if (emp.id === leader.id) {
          emp.is_group_leader = true;
        }
      }
    }

    this.persistToDisk();
    return { ...newGroup };
  }

  public async updateGroup(id: string, data: Partial<Group>): Promise<Group | null> {
    const index = this.groups.findIndex((g) => g.id === id);
    if (index === -1) return null;

    const existing = this.groups[index];
    let leaderName = existing.leader_name;
    if (data.leader_id && data.leader_id !== existing.leader_id) {
      const leader = await this.getEmployeeById(data.leader_id);
      if (leader) leaderName = leader.name;
    }

    let members = data.member_ids ? Array.from(new Set(data.member_ids)) : existing.member_ids;
    if (data.leader_id && !members.includes(data.leader_id)) {
      members.push(data.leader_id);
    }

    const updated: Group = {
      ...existing,
      ...data,
      leader_name: leaderName,
      member_ids: members,
      updated_at: new Date().toISOString(),
    };
    this.groups[index] = updated;

    // Synchronize employees
    for (const emp of this.employees) {
      if (members.includes(emp.id)) {
        emp.group_id = id;
        emp.group_name = updated.name;
        emp.is_group_leader = emp.id === updated.leader_id;
      } else if (emp.group_id === id) {
        emp.group_id = null;
        emp.group_name = null;
        emp.is_group_leader = false;
      }
    }

    this.persistToDisk();
    return { ...updated };
  }

  public async deleteGroup(id: string): Promise<boolean> {
    const initialLen = this.groups.length;
    this.groups = this.groups.filter((g) => g.id !== id);
    for (const emp of this.employees) {
      if (emp.group_id === id) {
        emp.group_id = null;
        emp.group_name = null;
        emp.is_group_leader = false;
      }
    }
    if (this.groups.length < initialLen) {
      this.persistToDisk();
      return true;
    }
    return false;
  }

  public async isGroupLeaderFor(leaderEmployeeId: string, memberEmployeeId: string): Promise<boolean> {
    return this.groups.some(
      (g) => g.leader_id === leaderEmployeeId && g.member_ids.includes(memberEmployeeId)
    );
  }

  // -------------------------------------------------------------
  // EMPLOYEES DIRECTORY
  // -------------------------------------------------------------

  public async getEmployees(filter?: { departmentId?: string; groupId?: string; search?: string }): Promise<Employee[]> {
    let result = [...this.employees];

    if (filter?.departmentId) {
      result = result.filter((e) => e.department_id === filter.departmentId);
    }
    if (filter?.groupId) {
      result = result.filter((e) => e.group_id === filter.groupId);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q) ||
          e.employee_code.toLowerCase().includes(q) ||
          e.designation.toLowerCase().includes(q)
      );
    }

    return result.map((e) => ({ ...e }));
  }

  public async getEmployeeById(id: string): Promise<Employee | null> {
    const emp = this.employees.find((e) => e.id === id);
    return emp ? { ...emp } : null;
  }

  public async getEmployeeByUserId(userId: string): Promise<Employee | null> {
    const emp = this.employees.find((e) => e.user_id === userId);
    return emp ? { ...emp } : null;
  }

  public async createEmployee(data: CreateEmployeeInput): Promise<Employee> {
    const id = `emp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const firstName = data.first_name || '';
    const lastName = data.last_name || '';
    const fullName = data.name || `${firstName} ${lastName}`.trim() || 'Employee';
    const newEmp: Employee = {
      id,
      user_id: data.user_id || '',
      employee_code: data.employee_code || `CRUV-${Math.floor(100 + Math.random() * 900)}`,
      first_name: firstName,
      last_name: lastName,
      name: fullName,
      email: data.email,
      phone: data.phone || '+91 90000 00000',
      department_id: data.department_id,
      department_name: data.department_name || '',
      group_id: data.group_id || null,
      group_name: data.group_name || null,
      is_group_leader: Boolean(data.is_group_leader),
      designation: data.designation || 'Team Member',
      tagline: data.tagline || '',
      personal_email: data.personal_email || '',
      joining_date: data.joining_date || now.split('T')[0],
      manager_id: data.manager_id || null,
      manager_name: data.manager_name || null,
      status: data.status || 'ACTIVE',
      leave_balances: data.leave_balances || { casual: 12, sick: 10, annual: 15, unpaid: 0 },
      created_by_id: data.created_by_id || null,
      created_at: now,
      updated_at: now,
    };
    this.employees.push(newEmp);

    if (newEmp.group_id) {
      const grp = this.groups.find((g) => g.id === newEmp.group_id);
      if (grp && !grp.member_ids.includes(id)) {
        grp.member_ids.push(id);
      }
    }

    this.persistToDisk();
    return { ...newEmp };
  }

  public async updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee | null> {
    const index = this.employees.findIndex((e) => e.id === id);
    if (index === -1) return null;

    const existing = this.employees[index];
    const updated: Employee = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.employees[index] = updated;
    this.persistToDisk();
    return { ...updated };
  }

  // -------------------------------------------------------------
  // SIMPLIFIED DAILY ATTENDANCE (NO TIMERS / PUNCH CLOCKS)
  // -------------------------------------------------------------

  private async withAttendanceLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.attendanceLocks.get(key) || Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.attendanceLocks.set(
      key,
      previous.then(() => gate)
    );
    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (this.attendanceLocks.get(key) === gate) {
        this.attendanceLocks.delete(key);
      }
    }
  }

  public async markDailyAttendance(data: {
    employee_id: string;
    employee_name: string;
    date: string; // YYYY-MM-DD
    status: AttendanceStatus;
    punch_time?: string;
    notes?: string;
    marked_by_id?: string;
    is_admin_override?: boolean;
  }): Promise<AttendanceRecord> {
    const lockKey = `${data.employee_id}:${data.date}`;
    return this.withAttendanceLock(lockKey, async () => {
      const existingIndex = this.attendanceRecords.findIndex(
        (r) => r.employee_id === data.employee_id && r.date === data.date
      );

      const now = new Date();
      const isoNow = now.toISOString();
      const formattedPunchTime = data.punch_time || getIndianTimeString(now);

      if (existingIndex !== -1) {
        const existing = this.attendanceRecords[existingIndex];
        if (existing.is_locked && !data.is_admin_override) {
          throw new Error(`Attendance for ${data.date} has already been recorded and cannot be modified.`);
        }

        const updated: AttendanceRecord = {
          ...existing,
          status: data.status,
          punch_time: existing.punch_time || formattedPunchTime,
          notes: data.notes || existing.notes,
          marked_by_id: data.marked_by_id || existing.marked_by_id,
          is_locked: true,
          updated_at: isoNow,
        };
        this.attendanceRecords[existingIndex] = updated;
        this.persistToDisk();
        return { ...updated };
      }

      const newRecord: AttendanceRecord = {
        id: `att-${crypto.randomUUID()}`,
        employee_id: data.employee_id,
        employee_name: data.employee_name,
        date: data.date,
        status: data.status,
        punch_time: formattedPunchTime,
        notes: data.notes || '',
        marked_by_id: data.marked_by_id || undefined,
        is_locked: true,
        created_at: isoNow,
        updated_at: isoNow,
      };
      this.attendanceRecords.push(newRecord);
      this.persistToDisk();
      return { ...newRecord };
    });
  }

  public async getAttendanceRecords(filter?: {
    employeeId?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<AttendanceRecord[]> {
    let result = [...this.attendanceRecords];

    if (filter?.employeeId) {
      result = result.filter((r) => r.employee_id === filter.employeeId);
    }
    if (filter?.date) {
      result = result.filter((r) => r.date === filter.date);
    }
    if (filter?.startDate && filter?.endDate) {
      result = result.filter((r) => r.date >= filter.startDate! && r.date <= filter.endDate!);
    }

    return result.sort((a, b) => b.date.localeCompare(a.date)).map((r) => ({ ...r }));
  }

  // -------------------------------------------------------------
  // LEAVES & APPROVALS HIERARCHY
  // -------------------------------------------------------------

  public async getLeaveRequests(filter?: { employeeId?: string; status?: LeaveStatus }): Promise<LeaveRequest[]> {
    let result = [...this.leaveRequests];
    if (filter?.employeeId) {
      result = result.filter((l) => l.employee_id === filter.employeeId);
    }
    if (filter?.status) {
      result = result.filter((l) => l.status === filter.status);
    }
    return result.sort((a, b) => b.created_at.localeCompare(a.created_at)).map((l) => ({ ...l }));
  }

  public async getPendingLeaveRequestsForReviewer(reviewerUserId: string): Promise<LeaveRequest[]> {
    const user = await this.getUserById(reviewerUserId);
    if (!user) return [];

    // Admin sees all pending
    if (user.role === 'admin' || user.role === 'manager') {
      return this.leaveRequests.filter((l) => l.status === 'PENDING').map((l) => ({ ...l }));
    }

    const reviewerEmp = await this.getEmployeeByUserId(reviewerUserId);
    if (!reviewerEmp) return [];

    // Check groups led by this reviewer
    const ledGroups = this.groups.filter((g) => g.leader_id === reviewerEmp.id);
    const ledMemberIds = new Set<string>();
    for (const g of ledGroups) {
      for (const m of g.member_ids) ledMemberIds.add(m);
    }

    return this.leaveRequests.filter(
      (l) => l.status === 'PENDING' && ledMemberIds.has(l.employee_id)
    ).map((l) => ({ ...l }));
  }

  public datesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
    return aStart <= bEnd && bStart <= aEnd;
  }

  public async findOverlappingLeave(
    employeeId: string,
    startDate: string,
    endDate: string,
    excludeId?: string
  ): Promise<LeaveRequest | null> {
    const hit = this.leaveRequests.find(
      (l) =>
        l.employee_id === employeeId &&
        l.id !== excludeId &&
        (l.status === 'PENDING' || l.status === 'APPROVED') &&
        this.datesOverlap(startDate, endDate, l.start_date, l.end_date)
    );
    return hit ? { ...hit } : null;
  }

  public async createLeaveRequest(data: Omit<LeaveRequest, 'id' | 'created_at' | 'updated_at'>): Promise<LeaveRequest> {
    const id = `leave-${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const newReq: LeaveRequest = {
      ...data,
      id,
      status: (data as any).status || 'PENDING',
      created_at: now,
      updated_at: now,
    };
    this.leaveRequests.push(newReq);
    this.persistToDisk();
    return { ...newReq };
  }

  public async updateLeaveStatus(
    id: string,
    status: LeaveStatus,
    reviewerId: string,
    reviewerName: string,
    rejectionReason?: string
  ): Promise<LeaveRequest | null> {
    const index = this.leaveRequests.findIndex((l) => l.id === id);
    if (index === -1) return null;

    const existing = this.leaveRequests[index];
    const previousStatus = existing.status;

    if (existing.status === status) {
      return { ...existing };
    }

    const updated: LeaveRequest = {
      ...existing,
      status,
      reviewed_by: reviewerId,
      reviewed_by_id: reviewerId,
      reviewed_by_name: reviewerName,
      reviewed_at: new Date().toISOString(),
      rejection_reason: rejectionReason || null,
      updated_at: new Date().toISOString(),
    };
    this.leaveRequests[index] = updated;

    const typeKey = existing.leave_type.toLowerCase() as keyof LeaveBalances;
    const emp = this.employees.find((e) => e.id === existing.employee_id);
    if (emp && existing.leave_type !== 'UNPAID' && emp.leave_balances && emp.leave_balances[typeKey] !== undefined) {
      if (status === 'APPROVED' && previousStatus !== 'APPROVED') {
        emp.leave_balances[typeKey] = Math.max(0, emp.leave_balances[typeKey] - existing.days_count);
      } else if (status === 'CANCELLED' && previousStatus === 'APPROVED') {
        emp.leave_balances[typeKey] += existing.days_count;
      }
    }

    this.persistToDisk();
    return { ...updated };
  }

  // -------------------------------------------------------------
  // TASKS (FULLY EDITABLE CRUD)
  // -------------------------------------------------------------

  public async getTasks(filter?: { assignedToId?: string; status?: string }): Promise<TaskItem[]> {
    let result = [...this.tasks];
    if (filter?.assignedToId) {
      result = result.filter((t) => t.assigned_to_id === filter.assignedToId);
    }
    if (filter?.status) {
      result = result.filter((t) => t.status === filter.status);
    }
    return result.sort((a, b) => b.created_at.localeCompare(a.created_at)).map((t) => ({ ...t }));
  }

  public async getTaskById(id: string): Promise<TaskItem | null> {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return null;
    return {
      ...task,
      created_by_name: task.created_by_name || 'Unknown',
      activity: Array.isArray(task.activity) ? [...task.activity] : [],
    };
  }

  public async createTask(data: Omit<TaskItem, 'id' | 'created_at' | 'updated_at' | 'activity'> & { activity?: TaskItem['activity'] }): Promise<TaskItem> {
    const id = `task-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const newTask: TaskItem = {
      ...data,
      created_by_name: data.created_by_name || 'Unknown',
      activity: data.activity || [
        {
          at: now,
          by_id: data.created_by_id,
          by_name: data.created_by_name || 'Unknown',
          action: 'created',
        },
      ],
      id,
      created_at: now,
      updated_at: now,
    };
    this.tasks.unshift(newTask);
    this.persistToDisk();
    return { ...newTask, activity: [...newTask.activity] };
  }

  public async updateTask(
    id: string,
    updates: Partial<TaskItem>,
    actor?: { id: string; name: string }
  ): Promise<TaskItem | null> {
    const index = this.tasks.findIndex((t) => t.id === id);
    if (index === -1) return null;

    const existing = this.tasks[index];
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

    const updated: TaskItem = {
      ...existing,
      ...updates,
      activity,
      created_by_id: existing.created_by_id,
      created_by_name: existing.created_by_name,
      updated_at: new Date().toISOString(),
    };
    this.tasks[index] = updated;
    this.persistToDisk();
    return { ...updated, activity: [...updated.activity] };
  }

  public async deleteTask(id: string): Promise<boolean> {
    const initialLen = this.tasks.length;
    this.tasks = this.tasks.filter((t) => t.id !== id);
    if (this.tasks.length < initialLen) {
      this.persistToDisk();
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------
  // NOTICES & BROADCASTS
  // -------------------------------------------------------------

  public async getNotices(): Promise<Notice[]> {
    return [...this.notices].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return b.created_at.localeCompare(a.created_at);
    });
  }

  public async createNotice(data: Omit<Notice, 'id' | 'created_at' | 'updated_at'>): Promise<Notice> {
    const id = `not-${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const newNotice: Notice = {
      ...data,
      id,
      created_at: now,
      updated_at: now,
    };
    this.notices.unshift(newNotice);
    this.persistToDisk();
    return { ...newNotice };
  }

  public async deleteNotice(id: string): Promise<boolean> {
    const initialLen = this.notices.length;
    this.notices = this.notices.filter((n) => n.id !== id);
    if (this.notices.length < initialLen) {
      this.persistToDisk();
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------
  // SCHEDULE & EVENTS
  // -------------------------------------------------------------

  public async getScheduleEvents(): Promise<ScheduleEvent[]> {
    return [...this.scheduleEvents].sort((a, b) => a.start_time.localeCompare(b.start_time));
  }

  public async createScheduleEvent(data: Omit<ScheduleEvent, 'id' | 'created_at'>): Promise<ScheduleEvent> {
    const id = `evt-${Date.now().toString(36)}`;
    const newEvent: ScheduleEvent = {
      ...data,
      id,
      created_at: new Date().toISOString(),
    };
    this.scheduleEvents.push(newEvent);
    this.persistToDisk();
    return { ...newEvent };
  }

  public async deleteScheduleEvent(id: string): Promise<boolean> {
    const initialLen = this.scheduleEvents.length;
    this.scheduleEvents = this.scheduleEvents.filter((e) => e.id !== id);
    if (this.scheduleEvents.length < initialLen) {
      this.persistToDisk();
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------
  // PERSONAL NOTES
  // -------------------------------------------------------------

  public async getNotes(userId: string): Promise<Note[]> {
    return this.notes
      .filter((n) => n.user_id === userId)
      .sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return b.created_at.localeCompare(a.created_at);
      });
  }

  public async createNote(data: Omit<Note, 'id' | 'created_at' | 'updated_at'>): Promise<Note> {
    const id = `note-${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const newNote: Note = {
      ...data,
      id,
      created_at: now,
      updated_at: now,
    };
    this.notes.unshift(newNote);
    this.persistToDisk();
    return { ...newNote };
  }

  public async updateNote(id: string, userId: string, updates: Partial<Note>): Promise<Note | null> {
    const index = this.notes.findIndex((n) => n.id === id && n.user_id === userId);
    if (index === -1) return null;
    const allowed: Partial<Note> = {};
    if (typeof updates.title === 'string') allowed.title = updates.title;
    if (typeof updates.content === 'string') allowed.content = updates.content;
    if (typeof updates.category === 'string') allowed.category = updates.category;
    if (updates.color) allowed.color = updates.color;
    if (typeof updates.is_pinned === 'boolean') allowed.is_pinned = updates.is_pinned;
    const updated: Note = {
      ...this.notes[index],
      ...allowed,
      user_id: userId,
      updated_at: new Date().toISOString(),
    };
    this.notes[index] = updated;
    this.persistToDisk();
    return { ...updated };
  }

  public async deleteNote(id: string, userId: string): Promise<boolean> {
    const initialLen = this.notes.length;
    this.notes = this.notes.filter((n) => !(n.id === id && n.user_id === userId));
    if (this.notes.length < initialLen) {
      this.persistToDisk();
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------
  // MESSAGES & EMAIL REPOSITORY (ZERO-TRUST ISOLATION)
  // -------------------------------------------------------------

  public async getMessageById(id: string): Promise<Message | null> {
    const msg = this.messages.find((m) => m.id === id);
    return msg ? { ...msg } : null;
  }

  public async getMessageByProviderId(providerMessageId: string): Promise<Message | null> {
    const msg = this.messages.find((m) => m.provider_message_id === providerMessageId);
    return msg ? { ...msg } : null;
  }

  public async getMessagesByThreadId(ownerUserId: string, threadId: string): Promise<Message[]> {
    const threadMsgs = this.messages.filter(
      (m) => m.owner_user_id === ownerUserId && m.thread_id === threadId && m.folder !== 'trash'
    );
    threadMsgs.sort((a, b) => {
      const dateA = new Date(a.received_at || a.sent_at || a.created_at || 0).getTime();
      const dateB = new Date(b.received_at || b.sent_at || b.created_at || 0).getTime();
      return dateA - dateB;
    });
    return threadMsgs.map((m) => ({ ...m }));
  }

  public async markMessageAsSpam(userId: string, messageId: string): Promise<Message | null> {
    const msg = this.messages.find((m) => m.id === messageId && m.owner_user_id === userId);
    if (!msg) return null;
    msg.folder = 'spam';
    msg.is_spam = true;
    msg.updated_at = new Date().toISOString();
    this.persistToDisk();
    return { ...msg };
  }

  public async unmarkMessageSpam(userId: string, messageId: string): Promise<Message | null> {
    const msg = this.messages.find((m) => m.id === messageId && m.owner_user_id === userId);
    if (!msg) return null;
    msg.folder = 'inbox';
    msg.is_spam = false;
    msg.updated_at = new Date().toISOString();
    this.persistToDisk();
    return { ...msg };
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

    let filtered = this.messages.filter((m) => m.owner_user_id === ownerUserId && m.folder === folder);

    if (options.isRead !== undefined) {
      filtered = filtered.filter((m) => m.is_read === options.isRead);
    }

    if (options.isStarred !== undefined) {
      filtered = filtered.filter((m) => m.is_starred === options.isStarred);
    }

    if (options.query && options.query.trim()) {
      const q = options.query.trim().toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.subject.toLowerCase().includes(q) ||
          m.from_address.toLowerCase().includes(q) ||
          (m.snippet && m.snippet.toLowerCase().includes(q)) ||
          (m.body_text && m.body_text.toLowerCase().includes(q))
      );
    }

    filtered.sort((a, b) => {
      const dateA = new Date(a.received_at || a.sent_at || a.created_at || 0).getTime();
      const dateB = new Date(b.received_at || b.sent_at || b.created_at || 0).getTime();
      return dateB - dateA;
    });

    const paginated = filtered.slice(offset, offset + limit);
    return { messages: paginated.map((m) => ({ ...m })), total: filtered.length };
  }

  public async createMessage(data: Omit<Message, 'id' | 'created_at' | 'updated_at'>): Promise<Message> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newMsg: Message = {
      ...data,
      id,
      created_at: now,
      updated_at: now,
    };
    this.messages.unshift(newMsg);
    this.persistToDisk();
    return { ...newMsg };
  }

  public async updateMessage(id: string, updates: Partial<Message>): Promise<Message | null> {
    const index = this.messages.findIndex((m) => m.id === id);
    if (index === -1) return null;
    const updated: Message = {
      ...this.messages[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.messages[index] = updated;
    this.persistToDisk();
    return { ...updated };
  }

  public async deleteMessage(id: string): Promise<boolean> {
    const initialLen = this.messages.length;
    this.messages = this.messages.filter((m) => m.id !== id);
    if (this.messages.length < initialLen) {
      this.persistToDisk();
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------
  // ATTACHMENTS
  // -------------------------------------------------------------

  public async getAttachmentById(id: string): Promise<Attachment | null> {
    const att = this.attachments.find((a) => a.id === id);
    return att ? { ...att } : null;
  }

  public async getAttachmentsByMessageId(messageId: string): Promise<Attachment[]> {
    return this.attachments.filter((a) => a.message_id === messageId).map((a) => ({ ...a }));
  }

  public async createAttachment(data: Omit<Attachment, 'id' | 'created_at'>): Promise<Attachment> {
    const id = crypto.randomUUID();
    const newAtt: Attachment = {
      ...data,
      id,
      created_at: new Date().toISOString(),
    };
    this.attachments.push(newAtt);
    this.persistToDisk();
    return { ...newAtt };
  }

  // -------------------------------------------------------------
  // AUDIT LOGS & CHECKPOINTS
  // -------------------------------------------------------------

  public async addAuditLog(entry: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog> {
    const id = crypto.randomUUID();
    const newLog: AuditLog = {
      ...entry,
      id,
      created_at: new Date().toISOString(),
    };
    this.auditLogs.unshift(newLog);
    this.persistToDisk();
    return { ...newLog };
  }

  public async createAuditLog(entry: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog> {
    return this.addAuditLog(entry);
  }

  public async listAuditLogs(options?: { limit?: number; action?: string }): Promise<AuditLog[]> {
    let list = [...this.auditLogs];
    if (options?.action) {
      list = list.filter((l) => l.action === options.action);
    }
    const limit = options?.limit || 50;
    return list.slice(0, limit);
  }

  public async getCheckpoint(provider: string): Promise<SyncCheckpoint | null> {
    const cp = this.checkpoints.get(provider);
    return cp ? { ...cp } : null;
  }

  public async saveCheckpoint(provider: string, data: SyncCheckpoint): Promise<void> {
    this.checkpoints.set(provider, { ...data });
    this.persistToDisk();
  }

  public async tryAcquireSyncLock(provider: string, ttlMs = 120000): Promise<boolean> {
    const existing = this.checkpoints.get(provider);
    if (existing?.status === 'running') {
      const age = Date.now() - new Date(existing.updated_at).getTime();
      if (age < ttlMs) return false;
    }
    this.checkpoints.set(provider, {
      id: existing?.id || crypto.randomUUID(),
      provider,
      history_id: existing?.history_id || null,
      last_sync_timestamp: existing?.last_sync_timestamp || new Date().toISOString(),
      status: 'running',
      error_message: null,
      updated_at: new Date().toISOString(),
    });
    this.persistToDisk();
    return true;
  }

  public async releaseSyncLock(provider: string, next?: Partial<SyncCheckpoint>): Promise<void> {
    const existing = this.checkpoints.get(provider);
    this.checkpoints.set(provider, {
      id: existing?.id || crypto.randomUUID(),
      provider,
      history_id: next?.history_id ?? existing?.history_id ?? null,
      last_sync_timestamp: next?.last_sync_timestamp || new Date().toISOString(),
      status: next?.status || 'idle',
      error_message: next?.error_message ?? null,
      updated_at: new Date().toISOString(),
    });
    this.persistToDisk();
  }

  public async countMessages(folder?: string): Promise<number> {
    if (!folder) return this.messages.length;
    return this.messages.filter((m) => m.folder === folder).length;
  }

  public async getMessageByProviderAndOwner(providerMessageId: string, ownerUserId: string): Promise<Message | null> {
    const msg = this.messages.find(
      (m) => m.provider_message_id === providerMessageId && m.owner_user_id === ownerUserId
    );
    return msg ? { ...msg } : null;
  }

  public async findMessageByRfcId(ownerUserId: string, rfcId: string, folder?: string): Promise<Message | null> {
    const needle = String(rfcId || '').trim().replace(/^<|>$/g, '').toLowerCase();
    if (!needle) return null;
    const msg = this.messages.find((m) => {
      if (m.owner_user_id !== ownerUserId) return false;
      if (folder && m.folder !== folder) return false;
      const metaId = String(m.provider_metadata?.rfcMessageId || '').replace(/^<|>$/g, '').toLowerCase();
      return metaId === needle;
    });
    return msg ? { ...msg } : null;
  }

  public async updateAttachment(id: string, updates: Partial<Attachment>): Promise<Attachment | null> {
    const index = this.attachments.findIndex((a) => a.id === id);
    if (index === -1) return null;
    const updated: Attachment = { ...this.attachments[index], ...updates };
    this.attachments[index] = updated;
    this.persistToDisk();
    return { ...updated };
  }

  // -------------------------------------------------------------
  // DASHBOARD TELEMETRY
  // -------------------------------------------------------------

  public async getDashboardStats(userId: string) {
    const employee = await this.getEmployeeByUserId(userId);
    const today = getIndianDateString();

    const todayAttendance = employee
      ? this.attendanceRecords.find((r) => r.employee_id === employee.id && r.date === today) || null
      : null;

    const unreadEmails = this.messages.filter((m) => m.owner_user_id === userId && m.folder === 'inbox' && !m.is_read).length;

    const userTasks = employee ? this.tasks.filter((t) => t.assigned_to_id === employee.id) : [];
    const pendingTasks = userTasks.filter((t) => t.status !== 'done');
    const completedTasks = userTasks.filter((t) => t.status === 'done');

    const pendingLeaves = employee ? this.leaveRequests.filter((l) => l.employee_id === employee.id && l.status === 'PENDING') : [];

    const recentNotices = await this.getNotices();
    const scheduleEvents = await this.getScheduleEvents();
    const todayStart = `${today}T00:00:00+05:30`;
    const todayEnd = `${today}T23:59:59+05:30`;
    const todaySchedule = scheduleEvents.filter((e) => e.start_time >= todayStart && e.start_time <= todayEnd).slice(0, 5);

    return {
      employee: employee || null,
      todayAttendance,
      unreadEmails,
      pendingTasksCount: pendingTasks.length,
      completedTasksCount: completedTasks.length,
      pendingLeavesCount: pendingLeaves.length,
      totalEmployeesCount: this.employees.length,
      leaveBalances: employee?.leave_balances || { casual: 0, sick: 0, annual: 0, unpaid: 0 },
      recentNotices: recentNotices.slice(0, 5),
      todaySchedule,
    };
  }

  // -------------------------------------------------------------
  // USER PROFILE CUSTOMIZATION & PASSWORD MANAGEMENT
  // -------------------------------------------------------------

  public async updateEmployeeProfile(
    userId: string,
    data: {
      phone?: string;
      personal_email?: string;
      tagline?: string;
      firstName?: string;
      lastName?: string;
    }
  ): Promise<Employee | null> {
    let emp = await this.getEmployeeByUserId(userId);
    const user = await this.getUserById(userId);
    if (!user) return null;

    if (!emp) {
      // Lazy-create employee record if missing
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

    const index = this.employees.findIndex((e) => e.id === emp!.id);
    if (index === -1) return null;

    const updatedEmp: Employee = {
      ...this.employees[index],
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.personal_email !== undefined ? { personal_email: data.personal_email } : {}),
      ...(data.tagline !== undefined ? { tagline: data.tagline } : {}),
      updated_at: new Date().toISOString(),
    };

    this.employees[index] = updatedEmp;
    this.persistToDisk();
    return { ...updatedEmp };
  }

  public async changeUserPassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    const user = await this.getUserById(userId);
    if (!user) {
      return { success: false, error: 'User not found.' };
    }

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

    const newHash = hashPassword(newPassword);
    const existingUser = this.users.get(userId);
    if (existingUser) {
      this.users.set(userId, {
        ...existingUser,
        password_hash: newHash,
        must_change_password: false,
        updated_at: new Date().toISOString(),
      });
    }

    this.persistToDisk();
    return { success: true };
  }

  // -------------------------------------------------------------
  // NOTICES ENHANCED CRUD (ADMIN CONTROL)
  // -------------------------------------------------------------

  public async getNoticeById(id: string): Promise<Notice | null> {
    const notice = this.notices.find((n) => n.id === id);
    return notice ? { ...notice } : null;
  }

  public async updateNotice(id: string, updates: Partial<Notice>): Promise<Notice | null> {
    const index = this.notices.findIndex((n) => n.id === id);
    if (index === -1) return null;

    const updatedNotice: Notice = {
      ...this.notices[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.notices[index] = updatedNotice;
    this.persistToDisk();
    return { ...updatedNotice };
  }

  // -------------------------------------------------------------
  // FREE TIER STORAGE TELEMETRY & ADMIN PURGE UTILITIES
  // -------------------------------------------------------------

  public async getStorageStats() {
    const totalMessages = this.messages.length;
    const inboxCount = this.messages.filter((m) => m.folder === 'inbox').length;
    const sentCount = this.messages.filter((m) => m.folder === 'sent').length;
    const totalAuditLogs = this.auditLogs.length;
    const totalAttachments = this.attachments.length;
    const totalEmployees = this.employees.length;
    const totalTasks = this.tasks.length;

    // Estimate memory footprint
    const rawData = JSON.stringify({
      users: Array.from(this.users.values()),
      employees: this.employees,
      messages: this.messages,
      attachments: this.attachments,
      auditLogs: this.auditLogs,
      tasks: this.tasks,
    });
    const estimatedBytes = Buffer.byteLength(rawData, 'utf8');

    return {
      totalUsers: this.users.size,
      totalEmployees,
      totalMessages,
      inboxCount,
      sentCount,
      totalAttachments,
      totalAuditLogs,
      totalTasks,
      estimatedStorageBytes: estimatedBytes,
      estimatedStorageFormatted: `${(estimatedBytes / 1024).toFixed(1)} KB`,
      supabaseFreeTierCapacityPct: `${Math.min(100, ((estimatedBytes / (500 * 1024 * 1024)) * 100)).toFixed(3)}%`,
    };
  }

  public async purgeOldAuditLogs(daysThreshold: number = 30): Promise<{ purgedCount: number }> {
    const cutoff = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000).toISOString();
    const initial = this.auditLogs.length;
    this.auditLogs = this.auditLogs.filter((a) => a.created_at >= cutoff);
    const purgedCount = initial - this.auditLogs.length;
    if (purgedCount > 0) this.persistToDisk();
    return { purgedCount };
  }

  public async purgeOldMessages(daysThreshold: number = 90, folder?: 'trash' | 'inbox' | 'sent'): Promise<{ purgedCount: number }> {
    const cutoff = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000).toISOString();
    const initial = this.messages.length;
    this.messages = this.messages.filter((m) => {
      if (folder && m.folder !== folder) return true;
      const date = m.received_at || m.sent_at || m.created_at || '';
      return date >= cutoff;
    });
    const purgedCount = initial - this.messages.length;
    if (purgedCount > 0) this.persistToDisk();
    return { purgedCount };
  }

  // -------------------------------------------------------------
  // REAL-TIME NOTIFICATIONS & DEVICE PUSH MESSAGING
  // -------------------------------------------------------------

  public async getNotifications(
    userId: string,
    options?: { isRead?: boolean; limit?: number }
  ): Promise<AppNotification[]> {
    let list = this.notifications.filter((n) => n.user_id === userId);
    if (options?.isRead !== undefined) {
      list = list.filter((n) => n.is_read === options.isRead);
    }
    list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (options?.limit) {
      list = list.slice(0, options.limit);
    }
    return list.map((n) => ({ ...n }));
  }

  public async getUnreadNotificationsCount(userId: string): Promise<number> {
    return this.notifications.filter((n) => n.user_id === userId && !n.is_read).length;
  }

  public async createNotification(
    data: Omit<AppNotification, 'id' | 'created_at' | 'is_read'>
  ): Promise<AppNotification> {
    const id = `notif-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const newNotif: AppNotification = {
      ...data,
      id,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    this.notifications.unshift(newNotif);
    this.persistToDisk();
    void import('../notifications/dispatch')
      .then((mod) => mod.dispatchNotification(newNotif))
      .catch(() => {});
    return { ...newNotif };
  }

  public getPushSubscriptionsForUser(userId: string): PushSubscriptionItem[] {
    return this.pushSubscriptions.filter((s) => s.user_id === userId).map((s) => ({ ...s }));
  }

  public async listPushSubscriptionsForUser(userId: string): Promise<PushSubscriptionItem[]> {
    return this.getPushSubscriptionsForUser(userId);
  }

  public async loadVapidKeys(): Promise<{ publicKey: string; privateKey: string } | null> {
    if (this.vapidKeys?.publicKey) return this.vapidKeys;
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      this.vapidKeys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
      return this.vapidKeys;
    }
    return this.vapidKeys;
  }

  public async deletePushSubscription(id: string): Promise<void> {
    this.pushSubscriptions = this.pushSubscriptions.filter((s) => s.id !== id);
    this.persistToDisk();
  }

  public getOrCreateVapidKeys(): { publicKey: string; privateKey: string } {
    if (this.vapidKeys?.publicKey && this.vapidKeys?.privateKey) {
      return this.vapidKeys;
    }
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      this.vapidKeys = {
        publicKey: process.env.VAPID_PUBLIC_KEY,
        privateKey: process.env.VAPID_PRIVATE_KEY,
      };
      this.persistToDisk();
      return this.vapidKeys;
    }
    // Generated lazily by notifications/push.ts and stored here.
    return { publicKey: '', privateKey: '' };
  }

  public setVapidKeys(keys: { publicKey: string; privateKey: string }) {
    this.vapidKeys = keys;
    this.persistToDisk();
  }

  public async markNotificationAsRead(id: string, userId: string): Promise<boolean> {
    const notif = this.notifications.find((n) => n.id === id && n.user_id === userId);
    if (!notif) return false;
    notif.is_read = true;
    this.persistToDisk();
    return true;
  }

  public async markAllNotificationsAsRead(userId: string): Promise<number> {
    let count = 0;
    for (const notif of this.notifications) {
      if (notif.user_id === userId && !notif.is_read) {
        notif.is_read = true;
        count++;
      }
    }
    if (count > 0) this.persistToDisk();
    return count;
  }

  public async savePushSubscription(
    userId: string,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string }; deviceName?: string }
  ): Promise<PushSubscriptionItem> {
    // Remove existing subscription with same endpoint for this user
    this.pushSubscriptions = this.pushSubscriptions.filter(
      (s) => !(s.user_id === userId && s.endpoint === subscription.endpoint)
    );

    const newSub: PushSubscriptionItem = {
      id: `push-${Date.now().toString(36)}`,
      user_id: userId,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      device_name: subscription.deviceName || 'Web Browser',
      created_at: new Date().toISOString(),
    };

    this.pushSubscriptions.push(newSub);
    this.persistToDisk();
    return { ...newSub };
  }
}

const globalForStore = globalThis as unknown as {
  __cruvels_data_store__?: UnifiedDataStore | SupabaseDataStore;
};

function createDataStore(): UnifiedDataStore | SupabaseDataStore {
  assertProductionDataBackend();
  if (isSupabaseBackendActive()) {
    return new SupabaseDataStore();
  }
  return new UnifiedDataStore();
}

export type AppDataStore = UnifiedDataStore | SupabaseDataStore;
export const dataStore = globalForStore.__cruvels_data_store__ ?? createDataStore();
globalForStore.__cruvels_data_store__ = dataStore;
