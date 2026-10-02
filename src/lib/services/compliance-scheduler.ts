import { complianceService, getIndianTime24 } from './compliance-service';
import { getIndianDateString } from '@/lib/utils/date';
import { dataStore } from '../db/store';

let schedulerInterval: NodeJS.Timeout | null = null;
let isExecuting = false;

/**
 * Initializes the automated attendance compliance scheduler.
 * Ticks every 60 seconds to evaluate workforce attendance and automatically
 * dispatches reminder emails and push notifications at configured milestones:
 *  - 30 minutes before punch-in deadline (e.g. 09:30 AM IST)
 *  - 30 minutes before closing cutoff (e.g. 10:00 AM IST)
 *  - Closing grace cutoff warning (e.g. 10:30 AM IST)
 *
 * Guarded against duplicate initialization and duplicate dispatches (anti-spam).
 */
export function startAttendanceReminderScheduler() {
  if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') {
    return;
  }

  // Prevent multiple timer loops within the same Node process
  const globalRef = global as any;
  if (globalRef.__cruvels_attendance_scheduler_active) {
    return;
  }
  globalRef.__cruvels_attendance_scheduler_active = true;

  // Run initial tick after a brief server boot delay (5 seconds)
  setTimeout(() => {
    void executeSchedulerTick();
  }, 5000);

  // Periodic tick every 60 seconds
  schedulerInterval = setInterval(() => {
    void executeSchedulerTick();
  }, 60_000);

  if (schedulerInterval && typeof schedulerInterval.unref === 'function') {
    schedulerInterval.unref();
  }
}

export async function executeSchedulerTick(): Promise<{
  checked: boolean;
  remindersSent: number;
  milestone?: string;
  reason?: string;
}> {
  if (isExecuting) {
    return { checked: false, remindersSent: 0, reason: 'already_running' };
  }

  isExecuting = true;
  try {
    const today = getIndianDateString();
    const currentTime = getIndianTime24();

    const rules = await dataStore.getAttendanceRules();
    const isWorking = await complianceService.isWorkingDay(today, rules);
    const isHoliday = complianceService.isHoliday(today);

    if (!isWorking || isHoliday) {
      return { checked: true, remindersSent: 0, reason: isHoliday ? 'holiday' : 'non_working_day' };
    }

    const result = await complianceService.processAttendanceReminders(currentTime, today);
    return {
      checked: true,
      remindersSent: result.remindersSent,
      milestone: result.milestone,
    };
  } catch (err) {
    console.error('[COMPLIANCE-SCHEDULER] Automated check error:', err);
    return { checked: false, remindersSent: 0, reason: 'error' };
  } finally {
    isExecuting = false;
  }
}
