import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { dataStore } from '@/lib/db/store';
import { POST as punchAttendanceRoute } from '@/app/api/attendance/punch/route';
import { POST as requestCorrectionRoute } from '@/app/api/attendance/corrections/route';
import { PATCH as reviewCorrectionRoute } from '@/app/api/attendance/corrections/[id]/route';
import { GET as getEmployeeRoute } from '@/app/api/employees/[id]/route';
import { PATCH as patchSettingsRoute } from '@/app/api/admin/settings/route';
import { POST as createCommentRoute } from '@/app/api/tasks/[id]/comments/route';
import { createSessionToken } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';

function makeAuthRequest(path: string, options: { method?: string; body?: any; token?: string; headers?: Record<string, string> }) {
  const headers = new Headers();
  headers.set('host', 'localhost:3005');
  headers.set('Content-Type', 'application/json');
  if (options.token) {
    headers.set('cookie', `cruvels_session=${options.token}`);
  }
  if (options.headers) {
    for (const [k, v] of Object.entries(options.headers)) {
      headers.set(k, v);
    }
  }

  const init: RequestInit = {
    method: options.method || 'GET',
    headers,
  };
  if (options.body) {
    init.body = JSON.stringify(options.body);
  }

  return new NextRequest(`http://localhost:3005${path}`, init as any);
}

describe('Phase 7: Security Review, Auditability & Data Privacy (§§ 16, 17, 18)', () => {
  let adminToken: string;
  let leadToken: string;
  let internToken: string;
  let peerToken: string;

  let adminUser: any;
  let leadUser: any;
  let internUser: any;
  let peerUser: any;

  let internEmp: any;
  let peerEmp: any;

  beforeEach(async () => {
    dataStore.resetAndSeed();

    adminUser = await dataStore.getUserByUsername('admin');
    const charithDb = await dataStore.getUserByUsername('charith');
    if (charithDb) {
      await dataStore.updateUser(charithDb.id, { role: 'team_lead' });
      leadUser = await dataStore.getUserById(charithDb.id);
    }
    internUser = await dataStore.getUserByUsername('rahul');
    peerUser = await dataStore.getUserByUsername('priya');

    adminToken = await createSessionToken(adminUser, ['admin@cruvels.com']);
    leadToken = await createSessionToken(leadUser, ['charith@cruvels.com']);
    internToken = await createSessionToken(internUser, ['rahul@cruvels.com']);
    peerToken = await createSessionToken(peerUser, ['priya@cruvels.com']);

    internEmp = await dataStore.getEmployeeByUserId(internUser.id);
    peerEmp = await dataStore.getEmployeeByUserId(peerUser.id);
  });

  describe('1. Zero-Trust Audit Logging & Sensitive Data Redaction (§ 16)', () => {
    it('records structured audit logs when attendance is marked', async () => {
      const punchReq = makeAuthRequest('/api/attendance/punch', {
        method: 'POST',
        token: internToken,
        body: { status: 'PRESENT' },
      });

      const res = await punchAttendanceRoute(punchReq);
      expect(res.status).toBe(200);

      const logs = await dataStore.listAuditLogs({ action: 'ATTENDANCE_RECORDED' });
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs[0].user_id).toBe(internUser.id);
      expect(logs[0].resource_type).toBe('ATTENDANCE');
    });

    it('redacts sensitive fields (passwords, tokens, secrets) in audit metadata', async () => {
      await logAuditEvent({
        userId: adminUser.id,
        action: 'TEST_SECRET_ACTION',
        metadata: {
          password: 'SecretSuperPassword123!',
          token: 'jwt.token.secret',
          authorization: 'Bearer super_secret',
          safeField: 'Cruvels Operations',
        },
      });

      const logs = await dataStore.listAuditLogs({ action: 'TEST_SECRET_ACTION' });
      expect(logs.length).toBeGreaterThanOrEqual(1);
      const log = logs[0];
      expect(log.metadata?.password).toBe('[REDACTED]');
      expect(log.metadata?.token).toBe('[REDACTED]');
      expect(log.metadata?.authorization).toBe('[REDACTED]');
      expect(log.metadata?.safeField).toBe('Cruvels Operations');
    });

    it('records structured audit logs for attendance correction submission and approval', async () => {
      // 1. Intern requests correction
      const reqTicket = makeAuthRequest('/api/attendance/corrections', {
        method: 'POST',
        token: internToken,
        body: {
          date: '2026-09-10',
          current_status: 'NOT_MARKED',
          requested_status: 'PRESENT',
          reason: 'Network disconnect during client demo',
        },
      });
      const createRes = await requestCorrectionRoute(reqTicket);
      expect(createRes.status).toBe(200);
      const createJson = await createRes.json();
      const ticketId = createJson.correction.id;

      // Verify request audit log
      const reqLogs = await dataStore.listAuditLogs({ action: 'ATTENDANCE_CORRECTION_REQUESTED' });
      expect(reqLogs.some((l) => l.resource_id === ticketId)).toBe(true);

      // 2. Admin approves correction
      const reviewReq = makeAuthRequest(`/api/attendance/corrections/${ticketId}`, {
        method: 'PATCH',
        token: adminToken,
        body: {
          status: 'APPROVED',
          review_notes: 'Verified against squad client call log',
        },
      });
      const reviewRes = await reviewCorrectionRoute(reviewReq, { params: Promise.resolve({ id: ticketId }) });
      expect(reviewRes.status).toBe(200);

      // Verify approval audit log
      const appLogs = await dataStore.listAuditLogs({ action: 'ATTENDANCE_CORRECTION_APPROVED' });
      expect(appLogs.some((l) => l.resource_id === ticketId && l.user_id === adminUser.id)).toBe(true);
    });

    it('records structured audit log when commenting on tasks', async () => {
      const task = await dataStore.createTask({
        title: 'Security Compliance Audit RFC',
        description: 'Prepare zero-trust checklist',
        created_by_id: adminUser.id,
        created_by_name: adminUser.name,
        assigned_to_id: internEmp.id,
        assigned_to_name: internEmp.name,
        priority: 'high',
        status: 'todo',
        due_date: '2026-10-01',
      });

      const commentReq = makeAuthRequest(`/api/tasks/${task.id}/comments`, {
        method: 'POST',
        token: internToken,
        body: {
          content: 'Started draft of zero-trust verification matrix.',
        },
      });

      const res = await createCommentRoute(commentReq, { params: Promise.resolve({ id: task.id }) });
      expect(res.status).toBe(200);

      const logs = await dataStore.listAuditLogs({ action: 'TASK_COMMENT_ADDED' });
      expect(logs.some((l) => l.resource_id === task.id && l.user_id === internUser.id)).toBe(true);
    });
  });

  describe('2. Employee Profile 360 & PII Privacy Scoping (§ 18)', () => {
    it('strictly scrubs phone numbers, personal email, and leave balances when peer intern views colleague', async () => {
      // Intern A (Rahul) queries Peer Intern B (Priya)
      const req = makeAuthRequest(`/api/employees/${peerEmp.id}`, {
        method: 'GET',
        token: internToken,
      });

      const res = await getEmployeeRoute(req, { params: Promise.resolve({ id: peerEmp.id }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      // Verify PII is scrubbed
      expect(json.employee.phone).toBeNull();
      expect(json.employee.personal_email).toBeNull();
      expect(json.leaves.balances).toBeNull();
      expect(json.attendance.summary).toBeNull();
      expect(json.tasks.summary).toBeNull();
      expect(json.restricted).toBe(true);

      // Verify public corporate fields remain visible
      expect(json.employee.name).toBe(peerEmp.name);
      expect(json.employee.department_name).toBe(peerEmp.department_name);
      expect(json.employee.designation).toBe(peerEmp.designation);
    });

    it('allows employee to view their own complete 360 profile and leave balances', async () => {
      // Intern A (Rahul) queries their own profile
      const req = makeAuthRequest(`/api/employees/${internEmp.id}`, {
        method: 'GET',
        token: internToken,
      });

      const res = await getEmployeeRoute(req, { params: Promise.resolve({ id: internEmp.id }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      // Verify self-profile is fully accessible
      expect(json.restricted).toBeFalsy();
      expect(json.leaves.balances).toBeDefined();
      expect(json.attendance.summary).toBeDefined();
    });

    it('allows administrators to view complete 360 profile and contact details of any employee', async () => {
      // Admin queries Intern profile
      const req = makeAuthRequest(`/api/employees/${internEmp.id}`, {
        method: 'GET',
        token: adminToken,
      });

      const res = await getEmployeeRoute(req, { params: Promise.resolve({ id: internEmp.id }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.restricted).toBeFalsy();
      expect(json.leaves.balances).toBeDefined();
      expect(json.attendance.summary).toBeDefined();
    });
  });

  describe('3. Zero-Trust Access Control & Privilege Escalation Prevention (§ 17)', () => {
    it('blocks interns from approving attendance corrections', async () => {
      const ticket = await dataStore.createAttendanceCorrection({
        user_id: peerUser.id,
        employee_id: peerEmp.id,
        employee_name: peerEmp.name,
        department_name: peerEmp.department_name,
        date: '2026-09-08',
        current_status: 'NOT_MARKED',
        requested_status: 'PRESENT',
        reason: 'Client site deployment',
      });

      // Intern A attempts to approve peer ticket
      const hackReq = makeAuthRequest(`/api/attendance/corrections/${ticket.id}`, {
        method: 'PATCH',
        token: internToken,
        body: { status: 'APPROVED' },
      });

      const res = await reviewCorrectionRoute(hackReq, { params: Promise.resolve({ id: ticket.id }) });
      expect(res.status).toBe(403);
    });

    it('prevents group leaders from reviewing corrections of other squads', async () => {
      // Create employee in a different squad
      const otherSquadEmp = await dataStore.createEmployee({
        first_name: 'Ananya',
        last_name: 'Roy',
        email: 'ananya@cruvels.com',
        department_id: internEmp.department_id,
        group_id: 'diff-squad-999',
        designation: 'Backend Intern',
      });

      const ticket = await dataStore.createAttendanceCorrection({
        user_id: 'other-user-999',
        employee_id: otherSquadEmp.id,
        employee_name: otherSquadEmp.name,
        department_name: otherSquadEmp.department_name,
        group_id: 'diff-squad-999',
        date: '2026-09-07',
        current_status: 'NOT_MARKED',
        requested_status: 'PRESENT',
        reason: 'Meeting',
      });

      // Group leader Charith (assigned to Engineering Squad A) attempts to approve other squad ticket
      const hackReq = makeAuthRequest(`/api/attendance/corrections/${ticket.id}`, {
        method: 'PATCH',
        token: leadToken,
        body: { status: 'APPROVED' },
      });

      const res = await reviewCorrectionRoute(hackReq, { params: Promise.resolve({ id: ticket.id }) });
      expect(res.status).toBe(403);
    });
  });
});
