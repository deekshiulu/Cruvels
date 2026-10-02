/**
 * Attendance Compliance & Management Service (Roadmap §§ 1, 2, 3, 4, 28, 29)
 * Reusable engine managing dynamic attendance rules, automated compliance checks,
 * non-spam reminder schedules, individual & team compliance metrics, and correction reviews.
 */

import { dataStore } from '@/lib/db/store';
import {
  AttendanceRuleConfig,
  DEFAULT_ATTENDANCE_RULES,
  AttendanceRecord,
  AttendanceStatus,
  AttendanceCorrectionRequest,
  AttendanceCorrectionStatus,
  ComplianceStatus,
  AttendanceComplianceSummary,
  IndividualComplianceRecord,
  INDIAN_HOLIDAYS_2026,
  PublicHolidayDefinition,
  Employee,
} from '@/lib/db/types';
import { getIndianDateString, getIndianTimeString } from '@/lib/utils/date';
export { getIndianDateString };
import { formatComplianceMessage } from '@/lib/modules/compliance/templates';
import { logAuditEvent } from '@/lib/audit/logger';

export interface EmployeeDailyComplianceDetail {
  employeeId: string;
  employeeName: string;
  departmentName: string;
  groupId?: string | null;
  groupName?: string | null;
  date: string;
  status: ComplianceStatus;
  punchTime?: string;
  isLate: boolean;
  notes?: string;
  correction?: AttendanceCorrectionRequest | null;
}

export interface TeamComplianceSummary {
  groupId: string;
  groupName: string;
  departmentName: string;
  totalMembers: number;
  markedCount: number;
  lateCount: number;
  missingCount: number;
  leaveCount: number;
  complianceRate: number;
}

/**
 * Returns current time in IST formatted as "HH:mm" (24-hour).
 */
export function getIndianTime24(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const hour = parts.find((p) => p.type === 'hour')?.value || '00';
  const minute = parts.find((p) => p.type === 'minute')?.value || '00';
  return `${hour}:${minute}`;
}

/**
 * Parses "09:42 AM IST" or "14:30" or ISO to minutes from midnight for accurate comparison.
 */
export function timeStringToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  // 12-hour format: "09:42 AM IST"
  const match12 = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const meridian = match12[3].toUpperCase();
    if (meridian === 'PM' && hours < 12) hours += 12;
    if (meridian === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
  // 24-hour format: "10:00"
  const match24 = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    return hours * 60 + minutes;
  }
  return null;
}

export class ComplianceService {
  /**
   * Check if a given date is a configured working day.
   */
  public async isWorkingDay(dateStr: string, rules?: AttendanceRuleConfig): Promise<boolean> {
    const activeRules = rules || (await dataStore.getAttendanceRules());
    const dateObj = new Date(`${dateStr}T12:00:00+05:30`);
    let dayOfWeek = dateObj.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
    if (dayOfWeek === 0) dayOfWeek = 7; // Map Sun to 7
    return activeRules.workingDays.includes(dayOfWeek);
  }

  /**
   * Check if a date is an official company holiday.
   */
  public isHoliday(dateStr: string, holidays?: PublicHolidayDefinition[]): boolean {
    const list = holidays && holidays.length > 0 ? holidays : INDIAN_HOLIDAYS_2026;
    return list.some((h) => h.date === dateStr && h.type !== 'optional');
  }

  /**
   * Check whether an attendance punch was marked after the configured deadline.
   */
  public isPunchLate(punchTime: string | undefined, deadline: string): boolean {
    const punchMins = timeStringToMinutes(punchTime);
    const deadlineMins = timeStringToMinutes(deadline);
    if (punchMins === null || deadlineMins === null) return false;
    return punchMins > deadlineMins;
  }

  /**
   * Evaluate compliance for all active employees on a given date.
   */
  public async evaluateDailyCompliance(date?: string): Promise<{
    summary: AttendanceComplianceSummary;
    details: EmployeeDailyComplianceDetail[];
    isWorkingDay: boolean;
    isHoliday: boolean;
  }> {
    const evalDate = date || getIndianDateString();
    const settings = await dataStore.getSystemSettings();
    const rules = settings.attendanceRules || (await dataStore.getAttendanceRules());
    const workingDay = await this.isWorkingDay(evalDate, rules);
    const holiday = this.isHoliday(evalDate, settings.holidays);

    const [allEmployees, attendanceRecords, leaveRequests, corrections] = await Promise.all([
      dataStore.getEmployees({ status: 'ACTIVE' }),
      dataStore.getAttendanceRecords({ date: evalDate }),
      dataStore.getLeaveRequests(),
      dataStore.getAttendanceCorrections({ date: evalDate }),
    ]);

    const attMap = new Map<string, AttendanceRecord>();
    for (const r of attendanceRecords) attMap.set(r.employee_id, r);

    const corMap = new Map<string, AttendanceCorrectionRequest>();
    for (const c of corrections) corMap.set(c.employee_id, c);

    const approvedLeaves = new Set<string>();
    for (const l of leaveRequests) {
      if (l.status === 'APPROVED' && evalDate >= l.start_date && evalDate <= l.end_date) {
        approvedLeaves.add(l.employee_id);
      }
    }

    const details: EmployeeDailyComplianceDetail[] = [];
    let presentCount = 0;
    let lateCount = 0;
    let notMarkedCount = 0;
    let onLeaveCount = 0;
    let pendingCorrectionsCount = 0;

    for (const emp of allEmployees) {
      const punch = attMap.get(emp.id);
      const correction = corMap.get(emp.id);
      const onLeave = approvedLeaves.has(emp.id);

      if (correction && correction.status === 'PENDING') {
        pendingCorrectionsCount++;
      }

      let status: ComplianceStatus = 'NOT_MARKED';
      let isLate = false;

      if (holiday) {
        status = 'HOLIDAY';
      } else if (onLeave) {
        status = 'ON_LEAVE';
        onLeaveCount++;
      } else if (punch) {
        if (punch.status === 'ON_LEAVE') {
          status = 'ON_LEAVE';
          onLeaveCount++;
        } else if (punch.status === 'ABSENT') {
          status = 'NOT_MARKED';
          notMarkedCount++;
        } else {
          isLate = this.isPunchLate(punch.punch_time, rules.markingDeadline);
          if (isLate) {
            status = 'MARKED_LATE';
            lateCount++;
            presentCount++; // Punched in, but flagged late
          } else {
            status = 'MARKED_PRESENT';
            presentCount++;
          }
        }
      } else if (!workingDay) {
        status = 'HOLIDAY';
      } else {
        if (correction && correction.status === 'PENDING') {
          status = 'CORRECTION_PENDING';
        } else {
          status = 'NOT_MARKED';
        }
        notMarkedCount++;
      }

      details.push({
        employeeId: emp.id,
        employeeName: emp.name,
        departmentName: emp.department_name,
        groupId: emp.group_id,
        groupName: emp.group_name,
        date: evalDate,
        status,
        punchTime: punch?.punch_time,
        isLate,
        notes: punch?.notes,
        correction: correction || null,
      });
    }

    const totalActive = allEmployees.length;
    const requiredWorkforce = Math.max(1, totalActive - onLeaveCount - (holiday || !workingDay ? totalActive : 0));
    const compliancePercentage =
      holiday || !workingDay
        ? 100
        : Math.round(((presentCount - lateCount) / requiredWorkforce) * 100);

    const summary: AttendanceComplianceSummary = {
      date: evalDate,
      total_active_employees: totalActive,
      present_count: presentCount,
      not_marked_count: notMarkedCount,
      late_count: lateCount,
      on_leave_count: onLeaveCount,
      pending_corrections_count: pendingCorrectionsCount,
      compliance_percentage: Math.max(0, Math.min(100, compliancePercentage)),
    };

    return {
      summary,
      details,
      isWorkingDay: workingDay,
      isHoliday: holiday,
    };
  }

  /**
   * Run automated compliance checks and dispatch non-spam reminders (§ 1.2, § 1.3).
   */
  public async processAttendanceReminders(
    currentClockTime?: string,
    targetDate?: string,
    options?: { forceSend?: boolean; milestoneOverride?: string }
  ): Promise<{
    remindersSent: number;
    milestone: string;
    targetDate: string;
  }> {
    const today = targetDate || getIndianDateString();
    const currentTime = currentClockTime || getIndianTime24();
    const rules = await dataStore.getAttendanceRules();

    if (!options?.forceSend) {
      if (!(await this.isWorkingDay(today, rules)) || this.isHoliday(today)) {
        return { remindersSent: 0, milestone: 'non_working_day', targetDate: today };
      }
    }

    const evalResult = await this.evaluateDailyCompliance(today);
    const unrecordedEmployees = evalResult.details.filter((d) => {
      if (options?.forceSend) {
        return (
          d.status === 'NOT_MARKED' ||
          d.status === 'CORRECTION_PENDING' ||
          (d.status === 'HOLIDAY' && !d.punchTime)
        );
      }
      return d.status === 'NOT_MARKED' || d.status === 'CORRECTION_PENDING';
    });

    if (unrecordedEmployees.length === 0) {
      return { remindersSent: 0, milestone: 'all_recorded', targetDate: today };
    }

    const currentMins = timeStringToMinutes(currentTime) || 0;
    const deadlineMins = timeStringToMinutes(rules.markingDeadline) || 600; // 10:00 AM = 600
    const graceMins = deadlineMins + (rules.gracePeriodMinutes || 30); // 10:30 AM = 630

    let milestone = options?.milestoneOverride || '';
    let templateKey = '';

    if (milestone === 'morning_reminder') {
      templateKey = 'ATTENDANCE_NOT_MARKED_MORNING';
    } else if (milestone === 'deadline_passed' || milestone === 'late_grace_warning') {
      templateKey = 'ATTENDANCE_NOT_MARKED_DEADLINE';
    } else if (currentMins >= deadlineMins - 30 && currentMins < deadlineMins) {
      // 09:30 AM - Morning reminder
      milestone = 'morning_reminder';
      templateKey = 'ATTENDANCE_NOT_MARKED_MORNING';
    } else if (currentMins >= deadlineMins && currentMins < graceMins) {
      // 10:00 AM - Deadline passed reminder
      milestone = 'deadline_passed';
      templateKey = 'ATTENDANCE_NOT_MARKED_DEADLINE';
    } else if (currentMins >= graceMins) {
      // 10:30 AM+ - Critical late compliance warning
      milestone = 'late_grace_warning';
      templateKey = 'ATTENDANCE_NOT_MARKED_DEADLINE';
    } else if (options?.forceSend) {
      // Fallback for manual/test dispatch outside standard reminder window
      milestone = 'morning_reminder';
      templateKey = 'ATTENDANCE_NOT_MARKED_MORNING';
    } else {
      // Too early for reminders
      return { remindersSent: 0, milestone: 'too_early', targetDate: today };
    }

    let remindersSent = 0;
    const allEmployees = await dataStore.getEmployees({ status: 'ACTIVE' });
    const empUserMap = new Map(allEmployees.map((e) => [e.id, e.user_id]));

    for (const item of unrecordedEmployees) {
      const userId = empUserMap.get(item.employeeId);
      if (!userId) continue;

      // Anti-spam guard: Check if reminder with this milestone already sent today to this user
      if (!options?.forceSend) {
        const existingNotifs = await dataStore.getNotifications(userId, { limit: 50 });
        const alreadySent = existingNotifs.some(
          (n) =>
            n.type === 'system' &&
            n.metadata?.date === today &&
            n.metadata?.milestone === milestone &&
            n.metadata?.category === 'attendance_compliance'
        );

        if (alreadySent) continue;
      }

      const formatted = formatComplianceMessage(templateKey, {
        userName: item.employeeName,
        date: today,
        deadline: rules.markingDeadline,
      });

      // 1. Create In-App Realtime Notification Card
      await dataStore.createNotification({
        user_id: userId,
        type: 'system',
        category: 'attendance_compliance',
        title: formatted.title,
        message: formatted.body,
        link_url: formatted.actionUrl || '/attendance',
        action_label: 'Punch Attendance',
        action_url: formatted.actionUrl || '/attendance',
        state: 'action_required',
        metadata: {
          category: 'attendance_compliance',
          date: today,
          milestone,
          deadline: rules.markingDeadline,
        },
      });

      // 2. Deposit Official Attendance Reminder Email directly into User's Mailbox
      try {
        const aliases = await dataStore.getAliasesByUserId(userId);
        const userObj = await dataStore.getUserById(userId);
        const empAlias = aliases.find((a) => a.is_active)?.email_address || (userObj ? `${userObj.username}@cruvels.com` : null);

        if (empAlias && userObj) {
          const threadId = `thread_attendance_rem_${today}_${userId}`;
          const isUrgent = milestone !== 'morning_reminder';
          const subject = isUrgent
            ? `[URGENT] Attendance Deadline Notice - ${today}`
            : `Daily Attendance Reminder - ${today}`;

          await dataStore.createMessage({
            owner_user_id: userId,
            owner_alias_id: empAlias,
            provider_message_id: `msg_att_rem_${Date.now()}_${userId.slice(0, 6)}`,
            thread_id: threadId,
            from_address: 'compliance@cruvels.com',
            from_name: 'Cruvels Workplace Compliance',
            to_addresses: [empAlias],
            subject,
            body_text: `Good morning ${item.employeeName},\n\nYour attendance for today (${today}) has not been recorded yet.\n\nMarking Deadline: ${rules.markingDeadline} IST\nStatus: Unrecorded\n\nPlease log into the portal and punch your attendance at http://localhost:3005/attendance.\n\nCruvels HR & Compliance Team`,
            body_html: `<div class="email-card" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0A192F; line-height: 1.6; max-width: 600px; padding: 8px 0;">
              <div class="email-card-header" style="background: ${isUrgent ? '#991B1B' : '#0A192F'}; color: #FFFFFF; padding: 18px 24px; border-radius: 12px 12px 0 0;">
                <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #FFFFFF !important;">${isUrgent ? 'Attendance Deadline Exceeded' : 'Daily Attendance Reminder'}</h2>
                <p style="margin: 4px 0 0 0; font-size: 12px; color: ${isUrgent ? '#FECACA' : '#94A3B8'} !important;">Workplace Attendance Compliance &bull; ${today}</p>
              </div>
              <div class="email-card-body" style="background: #FFFFFF; padding: 24px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="font-size: 14px; margin-top: 0; color: #0A192F;">Good morning <strong>${item.employeeName}</strong>,</p>
                <p style="font-size: 13px; color: #475569;">${formatted.body}</p>
                <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
                  <tr style="border-bottom: 1px solid #F1F5F9;">
                    <td style="padding: 8px 0; color: #64748B; width: 140px; font-weight: 600;">Employee Name:</td>
                    <td style="padding: 8px 0; color: #0A192F; font-weight: 700;">${item.employeeName}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #F1F5F9;">
                    <td style="padding: 8px 0; color: #64748B; font-weight: 600;">Target Date:</td>
                    <td style="padding: 8px 0; color: #0A192F; font-weight: 600;">${today}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #F1F5F9;">
                    <td style="padding: 8px 0; color: #64748B; font-weight: 600;">Daily Deadline:</td>
                    <td style="padding: 8px 0; color: #0A369D; font-weight: 700;">${rules.markingDeadline} IST</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748B; font-weight: 600;">Current Status:</td>
                    <td style="padding: 8px 0; color: #D97706; font-weight: 700;">Action Required</td>
                  </tr>
                </table>
                <div style="margin-top: 24px;">
                  <a href="/attendance" class="email-action-btn" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: #0A369D; color: #FFFFFF !important; text-decoration: none !important; padding: 11px 22px; border-radius: 9px; font-size: 13px; font-weight: 700; letter-spacing: 0.01em; box-shadow: 0 2px 8px rgba(10, 54, 157, 0.25);">
                    Punch Attendance Now &rarr;
                  </a>
                </div>
              </div>
            </div>`,
            snippet: formatted.body.slice(0, 100),
            folder: 'inbox',
            is_read: false,
            is_starred: false,
            has_attachments: false,
            received_at: new Date().toISOString(),
            sent_at: new Date().toISOString(),
          });

          // 3. Outbound SMTP relay if real external email provider is configured
          if (!process.env.VITEST) {
            try {
              const { getEmailProvider } = await import('../email/provider');
              const provider = getEmailProvider();
              if (provider && provider.name !== 'MockEmailProvider') {
                await provider.sendEmail({
                  from: 'compliance@cruvels.com',
                  fromName: 'Cruvels Workplace Compliance',
                  to: [empAlias],
                  subject,
                  text: `Good morning ${item.employeeName},\n\nYour attendance for today (${today}) has not been recorded yet.\n\nMarking Deadline: ${rules.markingDeadline} IST\nStatus: Unrecorded\n\nPlease log into the portal and punch your attendance at http://localhost:3005/attendance.\n\nCruvels HR & Compliance Team`,
                  html: formatted.body,
                });
              }
            } catch (smtpErr) {
              console.warn('[ATTENDANCE-REMINDER-SMTP] Outbound SMTP relay warning:', smtpErr);
            }
          }
        }
      } catch (mailErr) {
        console.error('[ATTENDANCE-REMINDER-MAIL] Error dispatching mail:', mailErr);
      }

      remindersSent++;
    }

    if (remindersSent > 0) {
      await logAuditEvent({
        action: 'ATTENDANCE_REMINDERS_DISPATCHED',
        resourceType: 'compliance',
        resourceId: today,
        metadata: {
          milestone,
          remindersSent,
          unrecordedCount: unrecordedEmployees.length,
          currentTime,
        },
      });
    }

    return { remindersSent, milestone, targetDate: today };
  }

  /**
   * Get team-level compliance breakdown for POCs & Admins (§ 2.2).
   */
  public async getTeamCompliance(date?: string): Promise<TeamComplianceSummary[]> {
    const evalResult = await this.evaluateDailyCompliance(date);
    const groups = await dataStore.getGroups();
    const groupSummaries: TeamComplianceSummary[] = [];

    for (const group of groups) {
      const members = evalResult.details.filter((d) => d.groupId === group.id);
      const totalMembers = members.length;
      if (totalMembers === 0) continue;

      const markedCount = members.filter((m) => m.status === 'MARKED_PRESENT' || m.status === 'MARKED_LATE').length;
      const lateCount = members.filter((m) => m.status === 'MARKED_LATE').length;
      const leaveCount = members.filter((m) => m.status === 'ON_LEAVE').length;
      const missingCount = members.filter((m) => m.status === 'NOT_MARKED' || m.status === 'CORRECTION_PENDING').length;

      const workingMembers = Math.max(1, totalMembers - leaveCount);
      const complianceRate = Math.round(((markedCount - lateCount) / workingMembers) * 100);

      groupSummaries.push({
        groupId: group.id,
        groupName: group.name,
        departmentName: group.department_name,
        totalMembers,
        markedCount,
        lateCount,
        missingCount,
        leaveCount,
        complianceRate: Math.max(0, Math.min(100, complianceRate)),
      });
    }

    return groupSummaries;
  }

  /**
   * Get individual monthly compliance history (§ 2.1).
   * Calculates monthly metrics: Present, Late, Missing, Leave, Corrections.
   */
  public async getIndividualComplianceHistory(
    employeeId: string,
    yearMonth?: string // Format "YYYY-MM", e.g. "2026-09"
  ): Promise<IndividualComplianceRecord> {
    const targetMonth = yearMonth || getIndianDateString().substring(0, 7);
    const emp = await dataStore.getEmployeeById(employeeId);
    if (!emp) throw new Error('Employee not found');

    const rules = await dataStore.getAttendanceRules();
    const allRecords = await dataStore.getAttendanceRecords({ employeeId });
    const allLeaves = await dataStore.getLeaveRequests({ employeeId });
    const allCorrections = await dataStore.getAttendanceCorrections({ employeeId });

    const monthRecords = allRecords.filter((r) => r.date.startsWith(targetMonth));
    const monthCorrections = allCorrections.filter((c) => c.date.startsWith(targetMonth));

    let presentDays = 0;
    let lateDays = 0;
    let leaveDays = 0;

    for (const r of monthRecords) {
      if (r.status === 'ON_LEAVE') {
        leaveDays++;
      } else if (r.status === 'PRESENT' || r.status === 'HALF_DAY' || r.status === 'WORK_FROM_HOME') {
        const isLate = this.isPunchLate(r.punch_time, rules.markingDeadline);
        if (isLate) {
          lateDays++;
        } else {
          presentDays++;
        }
      }
    }

    // Count approved leaves in this month that might not have an attendance punch
    for (const l of allLeaves) {
      if (l.status === 'APPROVED' && l.start_date.startsWith(targetMonth)) {
        // If not already counted in attendance records
        if (!monthRecords.some((r) => r.date >= l.start_date && r.date <= l.end_date)) {
          leaveDays += l.days_count;
        }
      }
    }

    // Calculate total working days in the month up to current date
    const today = getIndianDateString();
    const isCurrentMonth = today.startsWith(targetMonth);
    const lastDayToCount = isCurrentMonth ? parseInt(today.split('-')[2], 10) : 30;

    let totalWorkingDaysElapsed = 0;
    for (let day = 1; day <= lastDayToCount; day++) {
      const dStr = `${targetMonth}-${String(day).padStart(2, '0')}`;
      if (!this.isHoliday(dStr)) {
        const dObj = new Date(`${dStr}T12:00:00+05:30`);
        let dow = dObj.getDay();
        if (dow === 0) dow = 7;
        if (rules.workingDays.includes(dow)) {
          totalWorkingDaysElapsed++;
        }
      }
    }

    const recordedDays = presentDays + lateDays + leaveDays;
    const missingDays = Math.max(0, totalWorkingDaysElapsed - recordedDays);
    const requiredDays = Math.max(1, totalWorkingDaysElapsed - leaveDays);
    const complianceRate = Math.round((presentDays / requiredDays) * 100);

    return {
      employee_id: emp.id,
      employee_name: emp.name,
      department_name: emp.department_name,
      group_name: emp.group_name || 'Unassigned',
      month: targetMonth,
      present_days: presentDays,
      late_days: lateDays,
      missing_days: missingDays,
      leave_days: leaveDays,
      correction_count: monthCorrections.length,
      compliance_rate: Math.max(0, Math.min(100, complianceRate)),
    };
  }
}

export const complianceService = new ComplianceService();
