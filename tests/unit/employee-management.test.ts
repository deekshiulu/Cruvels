import { describe, it, expect, beforeEach } from 'vitest';
import { dataStore } from '@/lib/db/store';

describe('Cruvels Production-Ready Workplace OS Tests', () => {
  beforeEach(() => {
    dataStore.resetAndSeed();
  });

  // 1. Departments Management (Full CRUD)
  it('supports full CRUD on departments', async () => {
    const initialDepts = await dataStore.getDepartments();
    expect(initialDepts.length).toBeGreaterThanOrEqual(4);

    // Create
    const newDept = await dataStore.createDepartment({
      name: 'Legal & Compliance',
      code: 'LEGAL',
      head_name: 'Adv. Raman',
      description: 'Regulatory affairs.',
    });
    expect(newDept.id).toBeDefined();
    expect(newDept.code).toBe('LEGAL');

    // Update
    const updated = await dataStore.updateDepartment(newDept.id, {
      name: 'Legal, Compliance & Ethics',
    });
    expect(updated?.name).toBe('Legal, Compliance & Ethics');

    // Delete
    const deleted = await dataStore.deleteDepartment(newDept.id);
    expect(deleted).toBe(true);
  });

  // 2. Groups & Squads with Group Leaders (GL)
  it('creates squads and designates Group Leaders with member syncing', async () => {
    const adminEmp = (await dataStore.getEmployees())[0];

    // Create a new employee
    const memberEmp = await dataStore.createEmployee({
      user_id: 'user_member_01',
      employee_code: 'CRUV-101',
      first_name: 'Dev',
      last_name: 'Engineer',
      name: 'Dev Engineer',
      email: 'dev@cruvels.com',
      phone: '+91 99999 88888',
      department_id: 'dep-001',
      department_name: 'Engineering & Technology',
      designation: 'Frontend Engineer',
      joining_date: '2026-01-01',
      status: 'ACTIVE',
      leave_balances: { casual: 12, sick: 10, annual: 15, unpaid: 0 },
    });

    const newGroup = await dataStore.createGroup({
      name: 'Frontend Web Squad',
      department_id: 'dep-001',
      leader_id: adminEmp.id,
      member_ids: [memberEmp.id],
      description: 'Next.js and UI components',
    });

    expect(newGroup.id).toBeDefined();
    expect(newGroup.leader_id).toBe(adminEmp.id);
    expect(newGroup.member_ids).toContain(memberEmp.id);

    // Verify member employee group fields synced
    const refreshedMember = await dataStore.getEmployeeById(memberEmp.id);
    expect(refreshedMember?.group_id).toBe(newGroup.id);
    expect(refreshedMember?.group_name).toBe('Frontend Web Squad');

    // Verify GL authorization check
    const isGL = await dataStore.isGroupLeaderFor(adminEmp.id, memberEmp.id);
    expect(isGL).toBe(true);
  });

  // 3. Simplified Daily Attendance (No Timers/Punches)
  it('records daily attendance status (PRESENT, WFH, HALF_DAY, LEAVE, ABSENT)', async () => {
    const adminEmp = (await dataStore.getEmployees())[0];
    const today = '2026-09-01';

    const record = await dataStore.markDailyAttendance({
      employee_id: adminEmp.id,
      employee_name: adminEmp.name,
      date: today,
      status: 'WORK_FROM_HOME',
      notes: 'Remote engineering work',
      marked_by_id: 'user_admin',
    });

    expect(record.id).toBeDefined();
    expect(record.status).toBe('WORK_FROM_HOME');
    expect(record.date).toBe(today);

    const history = await dataStore.getAttendanceRecords({ employeeId: adminEmp.id });
    expect(history.length).toBe(1);
    expect(history[0].status).toBe('WORK_FROM_HOME');
  });

  // 4. Multi-tier Leave Approvals by Group Leader (GL)
  it('allows Group Leader to approve squad members leave requests', async () => {
    const adminEmp = (await dataStore.getEmployees())[0];

    const testMember = await dataStore.createEmployee({
      user_id: 'user_test_gl_leave',
      employee_code: 'CRUV-202',
      first_name: 'Junior',
      last_name: 'Dev',
      name: 'Junior Dev',
      email: 'junior@cruvels.com',
      phone: '+91 91111 22222',
      department_id: 'dep-001',
      department_name: 'Engineering & Technology',
      designation: 'Intern',
      joining_date: '2026-01-01',
      status: 'ACTIVE',
      leave_balances: { casual: 10, sick: 8, annual: 12, unpaid: 0 },
    });

    // Put in group led by adminEmp
    await dataStore.createGroup({
      name: 'Intern Squad',
      department_id: 'dep-001',
      leader_id: adminEmp.id,
      member_ids: [testMember.id],
    });

    // Member creates leave request
    const leave = await dataStore.createLeaveRequest({
      employee_id: testMember.id,
      employee_name: testMember.name,
      employee_code: testMember.employee_code,
      department_name: testMember.department_name,
      leave_type: 'CASUAL',
      start_date: '2026-09-10',
      end_date: '2026-09-12',
      days_count: 3,
      reason: 'Exams preparation',
      status: 'PENDING',
    });

    // GL approves leave
    const approved = await dataStore.updateLeaveStatus(
      leave.id,
      'APPROVED',
      adminEmp.user_id,
      adminEmp.name
    );

    expect(approved?.status).toBe('APPROVED');

    // Verify balance deduction
    const updatedMember = await dataStore.getEmployeeById(testMember.id);
    expect(updatedMember?.leave_balances.casual).toBe(7); // 10 - 3
  });

  // 5. Tasks (Full CRUD & Editing)
  it('supports creating, editing, and deleting Kanban tasks', async () => {
    const adminEmp = (await dataStore.getEmployees())[0];

    const task = await dataStore.createTask({
      title: 'Initial Security Audit',
      description: 'Verify RLS and Token Revocation',
      status: 'todo',
      priority: 'urgent',
      due_date: '2026-09-05',
      assigned_to_id: adminEmp.id,
      assigned_to_name: adminEmp.name,
      created_by_id: adminEmp.user_id,
      created_by_name: adminEmp.name,
    });

    expect(task.id).toBeDefined();

    // Edit task
    const updated = await dataStore.updateTask(
      task.id,
      {
        title: 'Completed Security Audit',
        status: 'done',
      },
      { id: adminEmp.user_id, name: adminEmp.name }
    );

    expect(updated?.title).toBe('Completed Security Audit');
    expect(updated?.status).toBe('done');
    expect(updated?.activity?.some((a) => a.field === 'status')).toBe(true);

    // Delete task
    const deleted = await dataStore.deleteTask(task.id);
    expect(deleted).toBe(true);
  });

  // 6. Role Promotion by Admin
  it('supports updating user roles across admin, manager, team_lead, employee, intern', async () => {
    const user = await dataStore.createUser({
      name: 'Karan Mehra',
      username: 'karan',
      password_hash: 'hashed_pw',
      role: 'intern',
      status: 'active',
    });

    expect(user.role).toBe('intern');

    // Admin promotes to Team Lead
    const promoted = await dataStore.updateUserRole(user.id, 'team_lead');
    expect(promoted?.role).toBe('team_lead');

    // Admin promotes to Manager
    const manager = await dataStore.updateUserRole(user.id, 'manager');
    expect(manager?.role).toBe('manager');
  });
});
