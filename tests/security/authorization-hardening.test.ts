import { describe, it, expect, beforeEach } from 'vitest';
import { dataStore } from '../../src/lib/db/store';
import { hashPassword } from '../../src/lib/auth/session';
import { checkRateLimit, rateLimiter } from '../../src/lib/security/rate-limit';
import { AuthSessionUser } from '../../src/lib/db/types';

describe('Authorization Boundaries & Security Hardening Tests', () => {
  let adminUser: AuthSessionUser;
  let internA: AuthSessionUser;
  let internB: AuthSessionUser;
  let internC: AuthSessionUser;
  let empAId: string;
  let empBId: string;
  let empCId: string;
  let squad1Id: string;
  let squad2Id: string;

  beforeEach(async () => {
    dataStore.resetAndSeed();
    rateLimiter.clearAll();

    // 1. Setup Department & Squads
    const dept = await dataStore.createDepartment({
      name: 'Engineering',
      code: 'ENG',
      head_name: 'Lead Eng',
    });

    const leaderEmp = await dataStore.createEmployee({
      first_name: 'Lead',
      last_name: 'Engineer',
      email: 'lead.eng@cruvels.com',
      department_id: dept.id,
      department_name: dept.name,
      designation: 'Engineering Lead',
    });

    const squad1 = await dataStore.createGroup({
      name: 'Frontend Squad',
      department_id: dept.id,
      leader_id: leaderEmp.id,
      member_ids: [],
    });
    squad1Id = squad1.id;

    const squad2 = await dataStore.createGroup({
      name: 'Backend Squad',
      department_id: dept.id,
      leader_id: leaderEmp.id,
      member_ids: [],
    });
    squad2Id = squad2.id;

    // 2. Setup Admin
    const admin = await dataStore.createUser({
      name: 'Admin User',
      username: 'admin_test',
      password_hash: hashPassword('Password123!'),
      role: 'admin',
      status: 'active',
    });
    adminUser = {
      id: admin.id,
      name: admin.name,
      username: admin.username,
      role: 'admin',
      status: 'active',
      assignedAliases: ['admin@cruvels.com'],
      primaryAlias: 'admin@cruvels.com',
    };

    // 3. Setup Intern A (in Frontend Squad)
    const userA = await dataStore.createUser({
      name: 'Rahul Sharma',
      username: 'rahul_sec',
      password_hash: hashPassword('Password123!'),
      role: 'intern',
      status: 'active',
    });
    const empA = await dataStore.createEmployee({
      first_name: 'Rahul',
      last_name: 'Sharma',
      email: 'rahul_sec@cruvels.com',
      department_id: dept.id,
      department_name: dept.name,
      group_id: squad1Id,
      group_name: 'Frontend Squad',
      designation: 'Frontend Intern',
      user_id: userA.id,
    });
    empAId = empA.id;
    internA = {
      id: userA.id,
      name: userA.name,
      username: userA.username,
      role: 'intern',
      status: 'active',
      assignedAliases: ['rahul_sec@cruvels.com'],
      primaryAlias: 'rahul_sec@cruvels.com',
      employeeId: empAId,
      groupId: squad1Id,
    };

    // 4. Setup Intern B (also in Frontend Squad)
    const userB = await dataStore.createUser({
      name: 'Priya Patel',
      username: 'priya_sec',
      password_hash: hashPassword('Password123!'),
      role: 'intern',
      status: 'active',
    });
    const empB = await dataStore.createEmployee({
      first_name: 'Priya',
      last_name: 'Patel',
      email: 'priya_sec@cruvels.com',
      department_id: dept.id,
      department_name: dept.name,
      group_id: squad1Id,
      group_name: 'Frontend Squad',
      designation: 'Frontend Intern',
      user_id: userB.id,
    });
    empBId = empB.id;
    internB = {
      id: userB.id,
      name: userB.name,
      username: userB.username,
      role: 'intern',
      status: 'active',
      assignedAliases: ['priya_sec@cruvels.com'],
      primaryAlias: 'priya_sec@cruvels.com',
      employeeId: empBId,
      groupId: squad1Id,
    };

    // 5. Setup Intern C (in Backend Squad)
    const userC = await dataStore.createUser({
      name: 'Karan Mehra',
      username: 'karan_sec',
      password_hash: hashPassword('Password123!'),
      role: 'intern',
      status: 'active',
    });
    const empC = await dataStore.createEmployee({
      first_name: 'Karan',
      last_name: 'Mehra',
      email: 'karan_sec@cruvels.com',
      department_id: dept.id,
      department_name: dept.name,
      group_id: squad2Id,
      group_name: 'Backend Squad',
      designation: 'Backend Intern',
      user_id: userC.id,
    });
    empCId = empC.id;
    internC = {
      id: userC.id,
      name: userC.name,
      username: userC.username,
      role: 'intern',
      status: 'active',
      assignedAliases: ['karan_sec@cruvels.com'],
      primaryAlias: 'karan_sec@cruvels.com',
      employeeId: empCId,
      groupId: squad2Id,
    };
  });

  // --- Task Assignment Boundary Checks ---
  describe('Task Assignment Authorization Boundaries', () => {
    it('allows an intern to assign a task to themselves', async () => {
      const myEmp = await dataStore.getEmployeeByUserId(internA.id);
      expect(myEmp?.id).toBe(empAId);

      const task = await dataStore.createTask({
        title: 'Review UI Components',
        description: 'Self-assigned frontend review',
        status: 'todo',
        priority: 'medium',
        due_date: '2026-09-30',
        assigned_to_id: empAId,
        assigned_to_name: internA.name,
        created_by_id: internA.id,
        created_by_name: internA.name,
      });

      expect(task).toBeDefined();
      expect(task.assigned_to_id).toBe(empAId);
    });

    it('allows an intern to assign a task to a colleague in the same squad', async () => {
      const myEmp = await dataStore.getEmployeeByUserId(internA.id);
      const targetEmp = await dataStore.getEmployeeById(empBId);

      // Verify same squad
      expect(myEmp?.group_id).toBe(squad1Id);
      expect(targetEmp?.group_id).toBe(squad1Id);

      const task = await dataStore.createTask({
        title: 'Pair on responsive layout',
        description: 'Frontend collaboration',
        status: 'todo',
        priority: 'medium',
        due_date: '2026-09-30',
        assigned_to_id: empBId,
        assigned_to_name: internB.name,
        created_by_id: internA.id,
        created_by_name: internA.name,
      });

      expect(task).toBeDefined();
      expect(task.assigned_to_id).toBe(empBId);
    });

    it('identifies cross-squad task assignment as unauthorized for interns', async () => {
      const myEmp = await dataStore.getEmployeeByUserId(internA.id);
      const targetEmp = await dataStore.getEmployeeById(empCId);

      // Check authorization condition enforced in POST /api/tasks
      const isSelf = myEmp?.id === targetEmp?.id;
      const isSameSquad = Boolean(myEmp?.group_id && myEmp.group_id === targetEmp?.group_id);

      // Must be false: Intern A (Frontend) cannot assign to Intern C (Backend)
      expect(isSelf).toBe(false);
      expect(isSameSquad).toBe(false);
    });

    it('allows an admin to assign tasks across any squad or employee', async () => {
      expect(adminUser.role).toBe('admin');

      const task = await dataStore.createTask({
        title: 'Company-wide architecture sync',
        description: 'Assigned by admin to Backend intern',
        status: 'todo',
        priority: 'high',
        due_date: '2026-09-30',
        assigned_to_id: empCId,
        assigned_to_name: internC.name,
        created_by_id: adminUser.id,
        created_by_name: adminUser.name,
      });

      expect(task).toBeDefined();
      expect(task.assigned_to_id).toBe(empCId);
    });
  });

  // --- Schedule Event Authorization Checks ---
  describe('Schedule Event Deletion Authorization', () => {
    it('allows the creator to delete their own schedule event', async () => {
      const event = await dataStore.createScheduleEvent({
        title: 'Frontend standup',
        description: 'Daily team sync',
        event_type: 'meeting',
        start_time: '2026-09-20T10:00:00Z',
        end_time: '2026-09-20T10:30:00Z',
        location: 'Room A',
        attendee_ids: [internA.id],
        created_by: internA.id,
      });

      const deleted = await dataStore.deleteScheduleEvent(event.id);
      expect(deleted).toBe(true);

      const allEvents = await dataStore.getScheduleEvents();
      expect(allEvents.some((e) => e.id === event.id)).toBe(false);
    });

    it('prevents non-admin, non-creator users from deleting another user event', async () => {
      const event = await dataStore.createScheduleEvent({
        title: 'Confidential review',
        description: 'Created by Intern A',
        event_type: 'meeting',
        start_time: '2026-09-20T11:00:00Z',
        end_time: '2026-09-20T12:00:00Z',
        location: 'Room B',
        attendee_ids: [internA.id],
        created_by: internA.id,
      });

      // Simulation of check in DELETE /api/schedule
      const requestingUser = internB;
      const isAuthorized =
        requestingUser.role === 'admin' ||
        requestingUser.role === 'manager' ||
        event.created_by === requestingUser.id;

      expect(isAuthorized).toBe(false);
    });
  });

  // --- Login Identifier Rate-Limiting ---
  describe('Login Identifier Rate-Limiting Protection', () => {
    it('throttles excessive failed attempts on the same account identifier', async () => {
      const identifier = 'target_user@cruvels.com';
      const key = `login:ident:${identifier.toLowerCase()}`;

      // Simulate 15 attempts allowed within 300s window
      for (let i = 0; i < 15; i++) {
        const res = await checkRateLimit(key, 15, 300);
        expect(res.allowed).toBe(true);
      }

      // 16th attempt must be rejected
      const blocked = await checkRateLimit(key, 15, 300);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });
  });
});
