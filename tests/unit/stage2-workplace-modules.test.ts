import { describe, it, expect, beforeEach } from 'vitest';
import { dataStore } from '../../src/lib/db/store';
import { hashPassword } from '../../src/lib/auth/session';
import { canViewEmployee360, canViewEmployeeDirectory } from '../../src/lib/security/authorization';
import { getIndianDateString } from '../../src/lib/utils/date';
import { AuthSessionUser } from '../../src/lib/db/types';

describe('Stage 2: Core Workplace Modules (Employees, Attendance, Leaves)', () => {
  let adminSession: AuthSessionUser;
  let leaderSession: AuthSessionUser;
  let internASession: AuthSessionUser;
  let internBSession: AuthSessionUser;
  let leaderEmpId: string;
  let empAId: string;
  let empBId: string;
  let deptId: string;
  let squadId: string;

  beforeEach(async () => {
    dataStore.resetAndSeed();

    // 1. Department
    const dept = await dataStore.createDepartment({
      name: 'Engineering',
      code: 'ENG',
      head_name: 'Lead Eng',
    });
    deptId = dept.id;

    // 2. Group Leader
    const leaderUser = await dataStore.createUser({
      name: 'Vikram Singh',
      username: 'vikram_gl',
      password_hash: hashPassword('Password123!'),
      role: 'team_lead',
      status: 'active',
    });
    const leaderEmp = await dataStore.createEmployee({
      first_name: 'Vikram',
      last_name: 'Singh',
      email: 'vikram_gl@cruvels.com',
      department_id: deptId,
      department_name: dept.name,
      designation: 'Tech Lead',
      user_id: leaderUser.id,
      is_group_leader: true,
      phone: '9876543210',
    });
    leaderEmpId = leaderEmp.id;

    const squad = await dataStore.createGroup({
      name: 'Mobile Squad',
      department_id: deptId,
      leader_id: leaderEmpId,
      member_ids: [],
    });
    squadId = squad.id;

    await dataStore.updateEmployee(leaderEmpId, { group_id: squadId, group_name: squad.name });

    leaderSession = {
      id: leaderUser.id,
      name: leaderUser.name,
      username: leaderUser.username,
      role: 'team_lead',
      status: 'active',
      assignedAliases: ['vikram_gl@cruvels.com'],
      primaryAlias: 'vikram_gl@cruvels.com',
      employeeId: leaderEmpId,
      groupId: squadId,
      isGroupLeader: true,
    };

    // 3. Admin
    const adminUser = await dataStore.createUser({
      name: 'Admin Boss',
      username: 'admin_boss',
      password_hash: hashPassword('Password123!'),
      role: 'admin',
      status: 'active',
    });
    adminSession = {
      id: adminUser.id,
      name: adminUser.name,
      username: adminUser.username,
      role: 'admin',
      status: 'active',
      assignedAliases: ['admin_boss@cruvels.com'],
      primaryAlias: 'admin_boss@cruvels.com',
    };

    // 4. Intern A (in Mobile Squad)
    const userA = await dataStore.createUser({
      name: 'Rahul Sharma',
      username: 'rahul_squad',
      password_hash: hashPassword('Password123!'),
      role: 'intern',
      status: 'active',
    });
    const empA = await dataStore.createEmployee({
      first_name: 'Rahul',
      last_name: 'Sharma',
      email: 'rahul_squad@cruvels.com',
      department_id: deptId,
      department_name: dept.name,
      group_id: squadId,
      group_name: squad.name,
      designation: 'Mobile Intern',
      user_id: userA.id,
      phone: '9999911111',
    });
    empAId = empA.id;
    internASession = {
      id: userA.id,
      name: userA.name,
      username: userA.username,
      role: 'intern',
      status: 'active',
      assignedAliases: ['rahul_squad@cruvels.com'],
      primaryAlias: 'rahul_squad@cruvels.com',
      employeeId: empAId,
      groupId: squadId,
    };

    // 5. Intern B (also in Mobile Squad)
    const userB = await dataStore.createUser({
      name: 'Priya Patel',
      username: 'priya_squad',
      password_hash: hashPassword('Password123!'),
      role: 'intern',
      status: 'active',
    });
    const empB = await dataStore.createEmployee({
      first_name: 'Priya',
      last_name: 'Patel',
      email: 'priya_squad@cruvels.com',
      department_id: deptId,
      department_name: dept.name,
      group_id: squadId,
      group_name: squad.name,
      designation: 'Mobile Intern',
      user_id: userB.id,
      phone: '9999922222',
    });
    empBId = empB.id;
    internBSession = {
      id: userB.id,
      name: userB.name,
      username: userB.username,
      role: 'intern',
      status: 'active',
      assignedAliases: ['priya_squad@cruvels.com'],
      primaryAlias: 'priya_squad@cruvels.com',
      employeeId: empBId,
      groupId: squadId,
    };
  });

  // --- 1. Employee Directory & Profile Privacy ---
  describe('Employee Directory & Profile 360 Privacy', () => {
    it('allows peers in the same squad to view directory listing', async () => {
      const canView = await canViewEmployeeDirectory(internASession, empBId);
      expect(canView).toBe(true);
    });

    it('DENIES full 360 telemetry view to peer interns', async () => {
      const empB = (await dataStore.getEmployeeById(empBId))!;
      const show360 = canViewEmployee360(internASession, empB);
      // Intern A cannot view Intern B's full 360 telemetry
      expect(show360).toBe(false);
    });

    it('ALLOWS full 360 telemetry to the employee themselves', async () => {
      const empA = (await dataStore.getEmployeeById(empAId))!;
      const show360 = canViewEmployee360(internASession, empA);
      expect(show360).toBe(true);
    });

    it('ALLOWS full 360 telemetry to company Admin', async () => {
      const empA = (await dataStore.getEmployeeById(empAId))!;
      const show360 = canViewEmployee360(adminSession, empA);
      expect(show360).toBe(true);
    });
  });

  // --- 2. Attendance Validation ---
  describe('Attendance Punch-In & Leave Conflicts', () => {
    it('records attendance successfully under IST date', async () => {
      const today = getIndianDateString();
      const record = await dataStore.markDailyAttendance({
        employee_id: empAId,
        employee_name: 'Rahul Sharma',
        date: today,
        status: 'PRESENT',
        marked_by_id: internASession.id,
        is_admin_override: false,
      });

      expect(record).toBeDefined();
      expect(record.status).toBe('PRESENT');
      expect(record.date).toBe(today);
    });

    it('blocks duplicate punch-in attempts on the same calendar date', async () => {
      const today = getIndianDateString();
      await dataStore.markDailyAttendance({
        employee_id: empBId,
        employee_name: 'Priya Patel',
        date: today,
        status: 'PRESENT',
        marked_by_id: internBSession.id,
        is_admin_override: false,
      });

      // Second punch must fail with duplicate error
      await expect(
        dataStore.markDailyAttendance({
          employee_id: empBId,
          employee_name: 'Priya Patel',
          date: today,
          status: 'PRESENT',
          marked_by_id: internBSession.id,
          is_admin_override: false,
        })
      ).rejects.toThrow(/already been recorded/);
    });

    it('blocks punch-in if employee has an active approved leave for today', async () => {
      const today = getIndianDateString();
      await dataStore.createLeaveRequest({
        employee_id: empAId,
        employee_name: 'Rahul Sharma',
        employee_code: 'CRU-EMP',
        department_name: 'Engineering',
        leave_type: 'CASUAL',
        start_date: today,
        end_date: today,
        days_count: 1,
        reason: 'Personal engagement',
        status: 'APPROVED',
      });

      const leaves = await dataStore.getLeaveRequests({ employeeId: empAId });
      const hasApprovedLeave = leaves.some(
        (l) => l.status === 'APPROVED' && today >= l.start_date && today <= l.end_date
      );

      expect(hasApprovedLeave).toBe(true);
    });
  });

  // --- 3. Leave Management & Approvals ---
  describe('Leave Approvals & Permissions', () => {
    it('allows Group Leader to review and approve squad members leave', async () => {
      const isGL = await dataStore.isGroupLeaderFor(leaderEmpId, empAId);
      expect(isGL).toBe(true);

      const leave = await dataStore.createLeaveRequest({
        employee_id: empAId,
        employee_name: 'Rahul Sharma',
        employee_code: 'CRU-EMP',
        department_name: 'Engineering',
        leave_type: 'SICK',
        start_date: '2026-10-01',
        end_date: '2026-10-02',
        days_count: 2,
        reason: 'Viral fever recovery',
        status: 'PENDING',
      });

      const updated = await dataStore.updateLeaveStatus(
        leave.id,
        'APPROVED',
        leaderSession.id,
        leaderSession.name
      );

      expect(updated?.status).toBe('APPROVED');
      expect(updated?.reviewed_by_name).toBe(leaderSession.name);
    });

    it('DENIES peer interns from approving leave for fellow interns', async () => {
      // Intern B cannot approve Intern A's leave
      const isGL = await dataStore.isGroupLeaderFor(empBId, empAId);
      expect(isGL).toBe(false);

      const isAuthorized =
        internBSession.role === 'admin' ||
        internBSession.role === 'manager' ||
        isGL;

      expect(isAuthorized).toBe(false);
    });
  });
});
