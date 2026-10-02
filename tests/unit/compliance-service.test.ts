import { describe, it, expect, beforeEach } from 'vitest';
import { complianceService, timeStringToMinutes, getIndianTime24 } from '@/lib/services/compliance-service';
import { dataStore } from '@/lib/db/store';
import { DEFAULT_ATTENDANCE_RULES, AttendanceRecord } from '@/lib/db/types';

describe('Phase 1: Attendance Compliance & Management System', () => {
  beforeEach(() => {
    dataStore.resetAndSeed();
  });

  describe('1. Attendance Compliance Rules & Time Evaluation (§ 1.1)', () => {
    it('accurately parses 12h and 24h timestamps into minutes from midnight', () => {
      expect(timeStringToMinutes('09:30 AM IST')).toBe(570);
      expect(timeStringToMinutes('10:00 AM IST')).toBe(600);
      expect(timeStringToMinutes('10:15 AM IST')).toBe(615);
      expect(timeStringToMinutes('12:00 PM IST')).toBe(720);
      expect(timeStringToMinutes('01:30 PM IST')).toBe(810);
      expect(timeStringToMinutes('10:00')).toBe(600);
      expect(timeStringToMinutes(undefined)).toBeNull();
    });

    it('identifies late punches according to configured deadline', () => {
      const deadline = '10:00'; // 10:00 AM
      expect(complianceService.isPunchLate('09:45 AM IST', deadline)).toBe(false);
      expect(complianceService.isPunchLate('10:00 AM IST', deadline)).toBe(false);
      expect(complianceService.isPunchLate('10:05 AM IST', deadline)).toBe(true);
      expect(complianceService.isPunchLate('11:30 AM IST', deadline)).toBe(true);
    });

    it('validates working days and weekend definitions', async () => {
      // 2026-09-21 is Monday (day 1)
      expect(await complianceService.isWorkingDay('2026-09-21')).toBe(true);
      // 2026-09-20 is Sunday (day 7)
      expect(await complianceService.isWorkingDay('2026-09-20')).toBe(false);
      // 2026-09-19 is Saturday (day 6)
      expect(await complianceService.isWorkingDay('2026-09-19')).toBe(false);
    });

    it('detects national and company holidays', () => {
      // Republic Day: 2026-01-26
      expect(complianceService.isHoliday('2026-01-26')).toBe(true);
      // Regular day
      expect(complianceService.isHoliday('2026-09-21')).toBe(false);
    });

    it('supports dynamic rule modification via dataStore', async () => {
      const initialRules = await dataStore.getAttendanceRules();
      expect(initialRules.markingDeadline).toBe('10:00');

      const updated = await dataStore.updateAttendanceRules({
        markingDeadline: '11:00',
        gracePeriodMinutes: 45,
      });

      expect(updated.markingDeadline).toBe('11:00');
      expect(updated.gracePeriodMinutes).toBe(45);

      const reloaded = await dataStore.getAttendanceRules();
      expect(reloaded.markingDeadline).toBe('11:00');
    });
  });

  describe('2. Automated Compliance Checks (§ 1.2, § 2)', () => {
    it('evaluates daily compliance across workforce', async () => {
      const employees = await dataStore.getEmployees({ status: 'ACTIVE' });
      expect(employees.length).toBeGreaterThan(0);

      const testDate = '2026-09-21'; // Monday

      // Mark 1 employee as present on-time (09:40 AM)
      await dataStore.markAttendance({
        employee_id: employees[0].id,
        employee_name: employees[0].name,
        date: testDate,
        status: 'PRESENT',
        punch_time: '09:40 AM IST',
      });

      // Mark 1 employee as late (10:25 AM)
      await dataStore.markAttendance({
        employee_id: employees[1].id,
        employee_name: employees[1].name,
        date: testDate,
        status: 'PRESENT',
        punch_time: '10:25 AM IST',
      });

      const result = await complianceService.evaluateDailyCompliance(testDate);
      expect(result.summary.total_active_employees).toBe(employees.length);
      expect(result.summary.present_count).toBe(2);
      expect(result.summary.late_count).toBe(1);
      expect(result.summary.not_marked_count).toBe(employees.length - 2);

      const emp0Detail = result.details.find((d) => d.employeeId === employees[0].id);
      expect(emp0Detail?.status).toBe('MARKED_PRESENT');
      expect(emp0Detail?.isLate).toBe(false);

      const emp1Detail = result.details.find((d) => d.employeeId === employees[1].id);
      expect(emp1Detail?.status).toBe('MARKED_LATE');
      expect(emp1Detail?.isLate).toBe(true);
    });

    it('computes squad-level team compliance summaries (§ 2.2)', async () => {
      const teams = await complianceService.getTeamCompliance('2026-09-21');
      expect(Array.isArray(teams)).toBe(true);
      expect(teams.length).toBeGreaterThan(0);
      expect(teams[0]).toHaveProperty('groupId');
      expect(teams[0]).toHaveProperty('groupName');
      expect(teams[0]).toHaveProperty('complianceRate');
    });

    it('computes individual monthly compliance drilldown (§ 2.1)', async () => {
      const employees = await dataStore.getEmployees({ status: 'ACTIVE' });
      const targetEmp = employees[0];

      // Mark 3 attendance punches in September 2026
      await dataStore.markAttendance({
        employee_id: targetEmp.id,
        employee_name: targetEmp.name,
        date: '2026-09-01',
        status: 'PRESENT',
        punch_time: '09:35 AM IST',
      });
      await dataStore.markAttendance({
        employee_id: targetEmp.id,
        employee_name: targetEmp.name,
        date: '2026-09-02',
        status: 'PRESENT',
        punch_time: '10:15 AM IST', // Late
      });

      const history = await complianceService.getIndividualComplianceHistory(targetEmp.id, '2026-09');
      expect(history.employee_id).toBe(targetEmp.id);
      expect(history.present_days).toBe(1);
      expect(history.late_days).toBe(1);
      expect(history.month).toBe('2026-09');
    });
  });

  describe('3. Automated Reminder Pipeline & Non-Spam Guards (§ 1.3)', () => {
    it('dispatches reminder notifications and blocks duplicate spam', async () => {
      // 09:45 AM IST on Monday 2026-09-21 -> Morning reminder window (deadline is 10:00)
      const workingMonday = '2026-09-21';
      const run1 = await complianceService.processAttendanceReminders('09:45', workingMonday);
      expect(run1.milestone).toBe('morning_reminder');
      expect(run1.remindersSent).toBeGreaterThan(0);

      // Verify that reminder emails were actually deposited in unrecorded employees' inbox
      const employees = await dataStore.getEmployees({ status: 'ACTIVE' });
      const firstEmp = employees[0];
      const inboxRes = await dataStore.getMessagesByOwner(firstEmp.user_id, { folder: 'inbox' });
      const reminderEmail = inboxRes.messages.find((m) => m.from_address === 'compliance@cruvels.com');
      expect(reminderEmail).toBeDefined();
      expect(reminderEmail?.subject).toContain('Attendance Reminder');
      expect(reminderEmail?.body_html).toContain('Punch Attendance Now');

      // Running again at 09:50 AM on same day should send 0 new reminders due to anti-spam guard
      const run2 = await complianceService.processAttendanceReminders('09:50', workingMonday);
      expect(run2.remindersSent).toBe(0);
    });

    it('dispatches urgent closing reminder 30 minutes before punch closing cutoff (10:00 AM IST)', async () => {
      const workingMonday = '2026-09-28';
      // 10:05 AM IST -> 30 mins before closing cutoff (gracePeriod is 30 mins past 10:00 = 10:30)
      const closingRun = await complianceService.processAttendanceReminders('10:05', workingMonday);
      expect(closingRun.milestone).toBe('deadline_passed');
      expect(closingRun.remindersSent).toBeGreaterThan(0);

      // Verify that urgent reminder email was created
      const employees = await dataStore.getEmployees({ status: 'ACTIVE' });
      const firstEmp = employees[0];
      const inboxRes = await dataStore.getMessagesByOwner(firstEmp.user_id, { folder: 'inbox' });
      const urgentEmail = inboxRes.messages.find(
        (m) => m.from_address === 'compliance@cruvels.com' && m.subject.includes('[URGENT]')
      );
      expect(urgentEmail).toBeDefined();
      expect(urgentEmail?.body_html).toContain('Attendance Deadline Exceeded');

      // Verify in-app notification card was generated
      const notifs = await dataStore.getNotifications(firstEmp.user_id, { limit: 10 });
      const actionCard = notifs.find((n) => n.category === 'attendance_compliance' && n.metadata?.milestone === 'deadline_passed');
      expect(actionCard).toBeDefined();
      expect(actionCard?.action_label).toBe('Punch Attendance');
      expect(actionCard?.state).toBe('action_required');
    });

    it('honors forceSend even on holidays/weekends for manual admin testing', async () => {
      const holidayDate = '2026-10-02'; // Gandhi Jayanti
      // Standard automated run should skip
      const autoRun = await complianceService.processAttendanceReminders('09:45', holidayDate);
      expect(autoRun.milestone).toBe('non_working_day');
      expect(autoRun.remindersSent).toBe(0);

      // Force send should dispatch reminder emails anyway
      const forceRun = await complianceService.processAttendanceReminders('09:45', holidayDate, {
        forceSend: true,
      });
      expect(forceRun.remindersSent).toBeGreaterThan(0);
    });
  });

  describe('4. Attendance Correction Workflow (§ 3)', () => {
    it('allows an employee to submit a correction request with reason', async () => {
      const employees = await dataStore.getEmployees({ status: 'ACTIVE' });
      const emp = employees[0];

      const correction = await dataStore.createAttendanceCorrection({
        user_id: emp.user_id,
        employee_id: emp.id,
        employee_name: emp.name,
        department_name: emp.department_name,
        group_id: emp.group_id,
        group_name: emp.group_name,
        date: '2026-09-15',
        current_status: 'NOT_MARKED',
        requested_status: 'PRESENT',
        reason: 'Client presentation delayed arrival; forgot to punch before leaving.',
      });

      expect(correction.id).toBeDefined();
      expect(correction.status).toBe('PENDING');
      expect(correction.requested_status).toBe('PRESENT');

      const list = await dataStore.getAttendanceCorrections({ employeeId: emp.id });
      expect(list.length).toBe(1);
      expect(list[0].id).toBe(correction.id);
    });

    it('updates attendance record when correction is approved', async () => {
      const employees = await dataStore.getEmployees({ status: 'ACTIVE' });
      const emp = employees[0];

      const correction = await dataStore.createAttendanceCorrection({
        user_id: emp.user_id,
        employee_id: emp.id,
        employee_name: emp.name,
        department_name: emp.department_name,
        group_id: emp.group_id,
        group_name: emp.group_name,
        date: '2026-09-16',
        current_status: 'NOT_MARKED',
        requested_status: 'PRESENT',
        reason: 'Power outage in home office during morning hours.',
      });

      // Review and approve
      const reviewed = await dataStore.reviewAttendanceCorrection(correction.id, {
        status: 'APPROVED',
        reviewed_by_id: 'admin-user-id',
        reviewed_by_name: 'Lead Admin',
        review_notes: 'Verified with squad lead. Approved.',
      });

      expect(reviewed.status).toBe('APPROVED');
      expect(reviewed.reviewed_by_name).toBe('Lead Admin');

      // Verify the AttendanceRecord now exists and is marked PRESENT
      const records = await dataStore.getAttendanceRecords({
        employeeId: emp.id,
        date: '2026-09-16',
      });
      expect(records.length).toBe(1);
      expect(records[0].status).toBe('PRESENT');
      expect(records[0].notes).toContain('Correction approved by Lead Admin');
    });

    it('does not modify attendance when correction is rejected', async () => {
      const employees = await dataStore.getEmployees({ status: 'ACTIVE' });
      const emp = employees[1];

      const correction = await dataStore.createAttendanceCorrection({
        user_id: emp.user_id,
        employee_id: emp.id,
        employee_name: emp.name,
        department_name: emp.department_name,
        date: '2026-09-17',
        current_status: 'NOT_MARKED',
        requested_status: 'PRESENT',
        reason: 'Unsubstantiated claim.',
      });

      const reviewed = await dataStore.reviewAttendanceCorrection(correction.id, {
        status: 'REJECTED',
        reviewed_by_id: 'admin-user-id',
        reviewed_by_name: 'Lead Admin',
        review_notes: 'No proof of work provided.',
      });

      expect(reviewed.status).toBe('REJECTED');

      // Verify no AttendanceRecord was created
      const records = await dataStore.getAttendanceRecords({
        employeeId: emp.id,
        date: '2026-09-17',
      });
      expect(records.length).toBe(0);
    });
  });
});
