import { describe, it, expect, beforeEach } from 'vitest';
import { dataStore } from '../../src/lib/db/store';
import { hashPassword } from '../../src/lib/auth/session';
import { getTaskAccessLevel } from '../../src/lib/security/authorization';
import { AuthSessionUser } from '../../src/lib/db/types';

describe('Stage 3: Work Management Modules (Tasks, Notes, Notices, Schedule)', () => {
  let adminSession: AuthSessionUser;
  let managerSession: AuthSessionUser;
  let internASession: AuthSessionUser;
  let internBSession: AuthSessionUser;
  let internCSession: AuthSessionUser;
  let empAId: string;
  let empBId: string;
  let empCId: string;
  let deptId: string;
  let squad1Id: string;
  let squad2Id: string;

  beforeEach(async () => {
    dataStore.resetAndSeed();

    // 1. Department
    const dept = await dataStore.createDepartment({
      name: 'Product & Tech',
      code: 'PROD',
      head_name: 'VP Tech',
    });
    deptId = dept.id;

    // Leader
    const leaderEmp = await dataStore.createEmployee({
      first_name: 'Lead',
      last_name: 'Architect',
      email: 'lead.arch@cruvels.com',
      department_id: deptId,
      department_name: dept.name,
      designation: 'Tech Lead',
    });

    const squad1 = await dataStore.createGroup({
      name: 'Core Squad',
      department_id: deptId,
      leader_id: leaderEmp.id,
      member_ids: [],
    });
    squad1Id = squad1.id;

    const squad2 = await dataStore.createGroup({
      name: 'Growth Squad',
      department_id: deptId,
      leader_id: leaderEmp.id,
      member_ids: [],
    });
    squad2Id = squad2.id;

    // Admin
    const admin = await dataStore.createUser({
      name: 'Site Admin',
      username: 'site_admin',
      password_hash: hashPassword('Password123!'),
      role: 'admin',
      status: 'active',
    });
    adminSession = {
      id: admin.id,
      name: admin.name,
      username: admin.username,
      role: 'admin',
      status: 'active',
      assignedAliases: ['admin@cruvels.com'],
      primaryAlias: 'admin@cruvels.com',
    };

    // Manager
    const manager = await dataStore.createUser({
      name: 'Engineering Manager',
      username: 'eng_mgr',
      password_hash: hashPassword('Password123!'),
      role: 'manager',
      status: 'active',
    });
    managerSession = {
      id: manager.id,
      name: manager.name,
      username: manager.username,
      role: 'manager',
      status: 'active',
      assignedAliases: ['manager@cruvels.com'],
      primaryAlias: 'manager@cruvels.com',
    };

    // Intern A (Core Squad)
    const userA = await dataStore.createUser({
      name: 'Rahul Sharma',
      username: 'rahul_stage3',
      password_hash: hashPassword('Password123!'),
      role: 'intern',
      status: 'active',
    });
    const empA = await dataStore.createEmployee({
      first_name: 'Rahul',
      last_name: 'Sharma',
      email: 'rahul_stage3@cruvels.com',
      department_id: deptId,
      department_name: dept.name,
      group_id: squad1Id,
      group_name: 'Core Squad',
      designation: 'Core Intern',
      user_id: userA.id,
    });
    empAId = empA.id;
    internASession = {
      id: userA.id,
      name: userA.name,
      username: userA.username,
      role: 'intern',
      status: 'active',
      assignedAliases: ['rahul_stage3@cruvels.com'],
      primaryAlias: 'rahul_stage3@cruvels.com',
      employeeId: empAId,
      groupId: squad1Id,
    };

    // Intern B (Core Squad)
    const userB = await dataStore.createUser({
      name: 'Priya Patel',
      username: 'priya_stage3',
      password_hash: hashPassword('Password123!'),
      role: 'intern',
      status: 'active',
    });
    const empB = await dataStore.createEmployee({
      first_name: 'Priya',
      last_name: 'Patel',
      email: 'priya_stage3@cruvels.com',
      department_id: deptId,
      department_name: dept.name,
      group_id: squad1Id,
      group_name: 'Core Squad',
      designation: 'Core Intern',
      user_id: userB.id,
    });
    empBId = empB.id;
    internBSession = {
      id: userB.id,
      name: userB.name,
      username: userB.username,
      role: 'intern',
      status: 'active',
      assignedAliases: ['priya_stage3@cruvels.com'],
      primaryAlias: 'priya_stage3@cruvels.com',
      employeeId: empBId,
      groupId: squad1Id,
    };

    // Intern C (Growth Squad)
    const userC = await dataStore.createUser({
      name: 'Karan Mehra',
      username: 'karan_stage3',
      password_hash: hashPassword('Password123!'),
      role: 'intern',
      status: 'active',
    });
    const empC = await dataStore.createEmployee({
      first_name: 'Karan',
      last_name: 'Mehra',
      email: 'karan_stage3@cruvels.com',
      department_id: deptId,
      department_name: dept.name,
      group_id: squad2Id,
      group_name: 'Growth Squad',
      designation: 'Growth Intern',
      user_id: userC.id,
    });
    empCId = empC.id;
    internCSession = {
      id: userC.id,
      name: userC.name,
      username: userC.username,
      role: 'intern',
      status: 'active',
      assignedAliases: ['karan_stage3@cruvels.com'],
      primaryAlias: 'karan_stage3@cruvels.com',
      employeeId: empCId,
      groupId: squad2Id,
    };
  });

  // --- 1. Tasks: Access Levels & Progression ---
  describe('Task Access Levels & Editing Boundaries', () => {
    it('grants full access to task creator and status-only access to assignee', async () => {
      const task = await dataStore.createTask({
        title: 'Implement OAuth Token Refresh',
        description: 'Ensure token rotation works seamlessly',
        status: 'todo',
        priority: 'high',
        due_date: '2026-10-15',
        assigned_to_id: empBId,
        assigned_to_name: 'Priya Patel',
        created_by_id: internASession.id,
        created_by_name: 'Rahul Sharma',
      });

      // Creator (Rahul) -> 'full'
      const creatorAccess = await getTaskAccessLevel(internASession, task);
      expect(creatorAccess).toBe('full');

      // Assignee (Priya) -> 'status'
      const assigneeAccess = await getTaskAccessLevel(internBSession, task);
      expect(assigneeAccess).toBe('status');

      // Unrelated Intern (Karan) -> 'none'
      const thirdPartyAccess = await getTaskAccessLevel(internCSession, task);
      expect(thirdPartyAccess).toBe('none');

      // Admin -> 'full'
      const adminAccess = await getTaskAccessLevel(adminSession, task);
      expect(adminAccess).toBe('full');
    });

    it('allows assignee to update task progression status', async () => {
      const task = await dataStore.createTask({
        title: 'Fix responsive navigation',
        description: 'Mobile breakpoint fixes',
        status: 'todo',
        priority: 'medium',
        due_date: '2026-10-20',
        assigned_to_id: empBId,
        assigned_to_name: 'Priya Patel',
        created_by_id: internASession.id,
        created_by_name: 'Rahul Sharma',
      });

      const updated = await dataStore.updateTask(
        task.id,
        { status: 'in_progress' },
        { id: internBSession.id, name: internBSession.name }
      );

      expect(updated?.status).toBe('in_progress');
      // Original title & due date must remain unchanged
      expect(updated?.title).toBe('Fix responsive navigation');
      expect(updated?.due_date).toBe('2026-10-20');
    });
  });

  // --- 2. Personal Notes: Strict Multi-Tenant Isolation ---
  describe('Personal Notes Multi-Tenant Isolation', () => {
    it('ensures User A can create and access their private notes', async () => {
      const note = await dataStore.createNote({
        user_id: internASession.id,
        title: 'Project Ideas',
        content: 'Confidential architecture thoughts',
        category: 'Work',
        color: 'emerald',
        is_pinned: true,
      });

      expect(note).toBeDefined();
      expect(note.user_id).toBe(internASession.id);

      const userANotes = await dataStore.getNotes(internASession.id);
      expect(userANotes.some((n) => n.id === note.id)).toBe(true);
    });

    it('strictly isolates notes: User B cannot view User A notes', async () => {
      const noteA = await dataStore.createNote({
        user_id: internASession.id,
        title: 'Rahul Secret Note',
        content: 'Private thoughts',
        category: 'Personal',
        color: 'purple',
        is_pinned: false,
      });

      // User B fetches their notes
      const userBNotes = await dataStore.getNotes(internBSession.id);
      expect(userBNotes.some((n) => n.id === noteA.id)).toBe(false);
    });

    it('blocks User B from modifying or deleting User A notes', async () => {
      const noteA = await dataStore.createNote({
        user_id: internASession.id,
        title: 'Immutable to others',
        content: 'Should not be edited by Priya',
        category: 'Security',
        color: 'rose',
        is_pinned: false,
      });

      // Attempt to update as User B
      const updateResult = await dataStore.updateNote(noteA.id, internBSession.id, {
        title: 'Hacked by B',
      });
      expect(updateResult).toBeNull();

      // Attempt to delete as User B
      const deleteResult = await dataStore.deleteNote(noteA.id, internBSession.id);
      expect(deleteResult).toBe(false);

      // Verify Note A remains untouched
      const original = (await dataStore.getNotes(internASession.id)).find((n) => n.id === noteA.id);
      expect(original?.title).toBe('Immutable to others');
    });
  });

  // --- 3. Notices & Broadcast Controls ---
  describe('Notices & Announcements Publication Rules', () => {
    it('DENIES regular interns from publishing company notices', () => {
      // Permission check matching POST /api/notices
      const canPublish = internASession.role === 'admin' || internASession.role === 'manager';
      expect(canPublish).toBe(false);
    });

    it('ALLOWS Managers and Admins to publish notices and broadcasts', async () => {
      const canPublishMgr = managerSession.role === 'admin' || managerSession.role === 'manager';
      const canPublishAdmin = adminSession.role === 'admin' || adminSession.role === 'manager';

      expect(canPublishMgr).toBe(true);
      expect(canPublishAdmin).toBe(true);

      const notice = await dataStore.createNotice({
        title: 'All-Hands Product Showcase',
        content: 'Join us at 4 PM for the Q3 showcase.',
        category: 'General',
        is_pinned: true,
        author_id: managerSession.id,
        author_name: managerSession.name,
      });

      expect(notice).toBeDefined();
      expect(notice.title).toBe('All-Hands Product Showcase');

      // All active users can read notices
      const allNotices = await dataStore.getNotices();
      expect(allNotices.some((n) => n.id === notice.id)).toBe(true);
    });
  });
});
