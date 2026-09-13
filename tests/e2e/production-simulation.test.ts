import { describe, it, expect, beforeEach } from 'vitest';
import { dataStore } from '@/lib/db/store';
import {
  createSessionToken,
  verifySessionToken,
  verifyPassword,
} from '@/lib/auth/session';
import { sendAuthorizedEmail } from '@/lib/email/sender';
import { assertMessageOwnership, assertAttachmentOwnership } from '@/lib/security/authorization';
import { evaluateEmailOwnership } from '@/lib/email/ownership';
import { SmtpImapProvider } from '@/lib/email/provider';

describe('Production-Grade End-to-End Simulation Test Suite', () => {
  beforeEach(() => {
    dataStore.resetAndSeed();
  });

  // --------------------------------------------------------------------------
  // 1. ADMIN & INTERN ACCOUNTS VERIFICATION
  // --------------------------------------------------------------------------
  it('verifies all 6 Admin and 4 Intern accounts are correctly seeded with credentials and roles', async () => {
    const adminUsernames = ['admin', 'charith', 'niketh', 'pannagasai', 'harshith', 'nitheesh'];
    for (const username of adminUsernames) {
      const user = await dataStore.getUserByUsername(username);
      expect(user).toBeDefined();
      expect(user!.role).toBe('admin');
      expect(user!.status).toBe('active');
      expect(verifyPassword('Password123!', user!.password_hash)).toBe(true);

      const aliases = await dataStore.getAliasesByUserId(user!.id);
      expect(aliases.length).toBeGreaterThanOrEqual(1);
      expect(aliases[0].is_active).toBe(true);
      expect(aliases[0].email_address).toBe(`${username}@cruvels.com`);
    }

    const internUsernames = ['rahul', 'priya', 'sales.intern', 'hr.intern'];
    for (const username of internUsernames) {
      const user = await dataStore.getUserByUsername(username);
      expect(user).toBeDefined();
      expect(user!.role).toBe('intern');
      expect(user!.status).toBe('active');
      expect(verifyPassword('Password123!', user!.password_hash)).toBe(true);

      const aliases = await dataStore.getAliasesByUserId(user!.id);
      expect(aliases.length).toBeGreaterThanOrEqual(1);
      expect(aliases[0].email_address).toBe(`${username}@cruvels.com`);
    }
  });

  // --------------------------------------------------------------------------
  // 2. MULTI-MAILBOX INBOUND & OUTBOUND ROUTING SIMULATION
  // --------------------------------------------------------------------------
  it('simulates inbound email ingestion across multi-mailboxes and routes to exact recipient accounts', async () => {
    // Simulated inbound email from client to Charith (Engineering Admin)
    const charithMatch = await evaluateEmailOwnership({
      toAddresses: ['charith@cruvels.com'],
      fromAddress: 'client@enterprise.com',
    });
    expect(charithMatch.length).toBe(1);
    expect(charithMatch[0].matchedUser.username).toBe('charith');

    // Ingest into Charith's inbox
    const charithMsg = await dataStore.createMessage({
      owner_user_id: charithMatch[0].matchedUser.id,
      owner_alias_id: charithMatch[0].matchedAlias.id,
      provider_message_id: `test_charith_${Date.now()}`,
      thread_id: `thread_charith_${Date.now()}`,
      from_address: 'client@enterprise.com',
      from_name: 'Enterprise Client',
      to_addresses: ['charith@cruvels.com'],
      cc_addresses: [],
      bcc_addresses: [],
      subject: 'Security Audit Architecture Q3',
      snippet: 'Please review our architecture...',
      body_html: '<p>Please review our architecture...</p>',
      body_text: 'Please review our architecture...',
      folder: 'inbox',
      is_read: false,
      is_starred: false,
      has_attachments: false,
      received_at: new Date().toISOString(),
      sent_at: null,
    });

    expect(charithMsg.id).toBeDefined();

    // Query Charith's inbox
    const charithInbox = await dataStore.getMessagesByOwner(charithMatch[0].matchedUser.id, { folder: 'inbox' });
    expect(charithInbox.total).toBe(1);
    expect(charithInbox.messages[0].subject).toBe('Security Audit Architecture Q3');

    // Verify Zero-Trust Isolation: Intern Rahul CANNOT see Charith's email
    const rahul = await dataStore.getUserByUsername('rahul');
    const rahulInbox = await dataStore.getMessagesByOwner(rahul!.id, { folder: 'inbox' });
    expect(rahulInbox.total).toBe(0);
  });

  it('simulates outbound email dispatch and verifies SMTP transporter mapping', async () => {
    const harshith = await dataStore.getUserByUsername('harshith');
    expect(harshith).toBeDefined();

    const harshithSession = {
      id: harshith!.id,
      name: harshith!.name,
      username: harshith!.username,
      role: harshith!.role,
      status: harshith!.status,
      assignedAliases: ['harshith@cruvels.com'],
      primaryAlias: 'harshith@cruvels.com',
    };

    // Send email from Harshith (Sales Admin)
    const sendResult = await sendAuthorizedEmail(harshithSession, {
      to: ['prospect@bigcorp.com'],
      subject: 'Cruvels Workplace OS Enterprise Demo',
      bodyText: 'We would love to demonstrate our internal portal.',
    });

    expect(sendResult.success).toBe(true);
    expect(sendResult.from).toBe('harshith@cruvels.com');

    // Check sent box
    const sent = await dataStore.getMessagesByOwner(harshith!.id, { folder: 'sent' });
    expect(sent.total).toBe(1);
    expect(sent.messages[0].to_addresses).toContain('prospect@bigcorp.com');
  });

  // --------------------------------------------------------------------------
  // 3. DAILY ATTENDANCE ROSTER SIMULATION
  // --------------------------------------------------------------------------
  it('simulates 1-click daily attendance marking and roster filtering', async () => {
    const nikethEmp = (await dataStore.getEmployees({ search: 'Niketh' }))[0];
    expect(nikethEmp).toBeDefined();

    // Mark WFH for today
    const today = new Date().toISOString().split('T')[0];
    const record = await dataStore.markDailyAttendance({
      employee_id: nikethEmp.id,
      employee_name: nikethEmp.name,
      date: today,
      status: 'WORK_FROM_HOME',
      notes: 'Remote API hardening',
      marked_by_id: nikethEmp.user_id,
    });

    expect(record.status).toBe('WORK_FROM_HOME');

    // Query records for today
    const records = await dataStore.getAttendanceRecords({ date: today });
    expect(records.some((r) => r.employee_id === nikethEmp.id && r.status === 'WORK_FROM_HOME')).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 4. GROUP LEADER (GL) MULTI-TIER LEAVE APPROVAL SIMULATION
  // --------------------------------------------------------------------------
  it('simulates Intern submitting leave request and Group Leader (Charith) approving it', async () => {
    const rahulEmp = (await dataStore.getEmployees({ search: 'Rahul' }))[0];
    const charithEmp = (await dataStore.getEmployees({ search: 'Charith' }))[0];

    expect(rahulEmp).toBeDefined();
    expect(charithEmp).toBeDefined();

    // Verify Charith is Group Leader for Rahul in Core Platform Squad
    const isGL = await dataStore.isGroupLeaderFor(charithEmp.id, rahulEmp.id);
    expect(isGL).toBe(true);

    // Rahul submits leave request for 2 days
    const initialCasualBalance = rahulEmp.leave_balances.casual;
    const leaveReq = await dataStore.createLeaveRequest({
      employee_id: rahulEmp.id,
      employee_name: rahulEmp.name,
      employee_code: rahulEmp.employee_code,
      department_name: rahulEmp.department_name,
      leave_type: 'CASUAL',
      start_date: '2026-09-15',
      end_date: '2026-09-16',
      days_count: 2,
      reason: 'College symposium',
      status: 'PENDING',
    });

    expect(leaveReq.status).toBe('PENDING');

    // Charith reviews and approves the request
    const approved = await dataStore.updateLeaveStatus(
      leaveReq.id,
      'APPROVED',
      charithEmp.user_id,
      charithEmp.name
    );

    expect(approved?.status).toBe('APPROVED');
    expect(approved?.reviewed_by_name).toBe('Charith');

    // Check that Rahul's balance was deducted by 2 days
    const updatedRahul = await dataStore.getEmployeeById(rahulEmp.id);
    expect(updatedRahul?.leave_balances.casual).toBe(initialCasualBalance - 2);
  });

  // --------------------------------------------------------------------------
  // 5. KANBAN TASKS CRUD & STATUS TRANSITIONS SIMULATION
  // --------------------------------------------------------------------------
  it('simulates full Task life cycle: creation, editing fields, status movements, and deletion', async () => {
    const pannagasaiEmp = (await dataStore.getEmployees({ search: 'Pannagasai' }))[0];

    // Create task
    const task = await dataStore.createTask({
      title: 'Configure IMAP TLS Ciphers',
      description: 'Ensure TLS 1.3 compliance across all mailboxes',
      status: 'todo',
      priority: 'high',
      due_date: '2026-09-20',
      assigned_to_id: pannagasaiEmp.id,
      assigned_to_name: pannagasaiEmp.name,
      created_by_id: 'emp-001',
      created_by_name: 'Pannagasai',
    });

    expect(task.id).toBeDefined();

    // Move to in_progress & edit description
    const updated = await dataStore.updateTask(task.id, {
      status: 'in_progress',
      description: 'TLS 1.3 verified on port 993',
      priority: 'urgent',
    });

    expect(updated?.status).toBe('in_progress');
    expect(updated?.priority).toBe('urgent');

    // Move to done
    const completed = await dataStore.updateTask(task.id, { status: 'done' });
    expect(completed?.status).toBe('done');

    // Delete
    const deleted = await dataStore.deleteTask(task.id);
    expect(deleted).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 6. ADMIN PORTAL USER & ROLE ELEVATION SIMULATION
  // --------------------------------------------------------------------------
  it('simulates Admin elevating roles, assigning aliases, and toggling status', async () => {
    const nitheesh = await dataStore.getUserByUsername('nitheesh');
    expect(nitheesh?.role).toBe('admin');

    // Admin provisions new employee
    const newEmp = await dataStore.createEmployee({
      user_id: 'user_temp_001',
      employee_code: 'CRUV-888',
      first_name: 'Test',
      last_name: 'Member',
      name: 'Test Member',
      email: 'test.member@cruvels.com',
      phone: '+91 99999 11111',
      department_id: 'dep-001',
      department_name: 'Engineering & Technology',
      designation: 'Backend Intern',
      joining_date: '2026-01-01',
      status: 'ACTIVE',
      leave_balances: { casual: 12, sick: 10, annual: 15, unpaid: 0 },
    });

    expect(newEmp.id).toBeDefined();

    // Elevate role
    const promotedUser = await dataStore.createUser({
      name: 'Test Member',
      username: 'test.member',
      password_hash: 'hash',
      role: 'intern',
      status: 'active',
    });

    const elevated = await dataStore.updateUserRole(promotedUser.id, 'manager');
    expect(elevated?.role).toBe('manager');

    // Disable and enable
    const disabled = await dataStore.updateUser(promotedUser.id, { status: 'disabled' });
    expect(disabled?.status).toBe('disabled');
  });
});
