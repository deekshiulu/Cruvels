import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';
import { DEFAULT_SYSTEM_SETTINGS, PublicHolidayDefinition, SystemSettings } from '@/lib/db/types';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function validateTime(time: string, fieldName: string): void {
  if (!TIME_REGEX.test(time)) {
    throw new Error(`Invalid format for ${fieldName}. Must be HH:MM in 24-hour format (e.g. 10:00).`);
  }
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const settings = await dataStore.getSystemSettings();
    return NextResponse.json({ success: true, settings });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(req);
    const body = await req.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid settings payload.' }, { status: 400 });
    }

    // Validate Attendance Rules
    if (body.attendanceRules) {
      const rules = body.attendanceRules;
      if (rules.markingDeadline !== undefined) {
        validateTime(rules.markingDeadline, 'attendanceRules.markingDeadline');
      }
      if (rules.gracePeriodMinutes !== undefined) {
        if (typeof rules.gracePeriodMinutes !== 'number' || rules.gracePeriodMinutes < 0 || rules.gracePeriodMinutes > 240) {
          return NextResponse.json(
            { success: false, error: 'Grace period must be a number between 0 and 240 minutes.' },
            { status: 400 }
          );
        }
      }
      if (rules.workingDays !== undefined) {
        if (!Array.isArray(rules.workingDays) || rules.workingDays.length === 0) {
          return NextResponse.json(
            { success: false, error: 'Working days must be a non-empty array of day numbers (1=Mon..7=Sun).' },
            { status: 400 }
          );
        }
        for (const day of rules.workingDays) {
          if (![1, 2, 3, 4, 5, 6, 7].includes(day)) {
            return NextResponse.json(
              { success: false, error: `Invalid working day: ${day}. Must be between 1 (Monday) and 7 (Sunday).` },
              { status: 400 }
            );
          }
        }
      }
      if (rules.correctionApproverRole !== undefined) {
        if (!['admin', 'group_leader', 'manager'].includes(rules.correctionApproverRole)) {
          return NextResponse.json(
            { success: false, error: 'Invalid approver role. Must be admin, group_leader, or manager.' },
            { status: 400 }
          );
        }
      }
      if (rules.reminderTimes !== undefined) {
        if (!Array.isArray(rules.reminderTimes)) {
          return NextResponse.json({ success: false, error: 'reminderTimes must be an array of HH:MM strings.' }, { status: 400 });
        }
        for (const t of rules.reminderTimes) {
          validateTime(t, 'reminderTimes');
        }
      }
    }

    // Validate Reminder Timing
    if (body.reminderTiming) {
      const rt = body.reminderTiming;
      if (rt.first_reminder !== undefined) validateTime(rt.first_reminder, 'reminderTiming.first_reminder');
      if (rt.second_reminder !== undefined) validateTime(rt.second_reminder, 'reminderTiming.second_reminder');
    }

    // Validate Task Reminders
    if (body.taskReminderIntervals) {
      const tri = body.taskReminderIntervals;
      if (tri.unacknowledged_hours !== undefined) {
        if (typeof tri.unacknowledged_hours !== 'number' || tri.unacknowledged_hours < 1) {
          return NextResponse.json(
            { success: false, error: 'unacknowledged_hours must be at least 1 hour.' },
            { status: 400 }
          );
        }
      }
      if (tri.deadline_prior_hours !== undefined) {
        if (!Array.isArray(tri.deadline_prior_hours)) {
          return NextResponse.json(
            { success: false, error: 'deadline_prior_hours must be an array of hours.' },
            { status: 400 }
          );
        }
      }
    }

    // Validate Holidays
    if (body.holidays !== undefined) {
      if (!Array.isArray(body.holidays)) {
        return NextResponse.json({ success: false, error: 'holidays must be an array.' }, { status: 400 });
      }
      for (const h of body.holidays) {
        if (!h.name || !h.date || !['national', 'company', 'optional'].includes(h.type)) {
          return NextResponse.json(
            { success: false, error: `Invalid holiday item: ${JSON.stringify(h)}. Name, date (YYYY-MM-DD), and valid type required.` },
            { status: 400 }
          );
        }
        if (!DATE_REGEX.test(h.date)) {
          return NextResponse.json(
            { success: false, error: `Invalid holiday date: ${h.date}. Must be YYYY-MM-DD.` },
            { status: 400 }
          );
        }
      }
    }

    const updated = await dataStore.updateSystemSettings(body, {
      id: adminUser.id,
      name: adminUser.name,
    });

    await logAuditEvent({
      userId: adminUser.id,
      action: 'SETTINGS_UPDATED',
      resourceType: 'system_settings',
      resourceId: 'general_settings',
      metadata: {
        updatedFields: Object.keys(body),
      },
      req,
    });

    return NextResponse.json({
      success: true,
      settings: updated,
      message: 'System settings successfully updated.',
    });
  } catch (err: any) {
    if (err.message && err.message.includes('Invalid format')) {
      return NextResponse.json({ success: false, error: err.message }, { status: 400 });
    }
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(req);
    const body = await req.json();

    if (body.action === 'add_holiday') {
      const holiday: PublicHolidayDefinition = body.holiday;
      if (!holiday?.name || !holiday?.date || !['national', 'company', 'optional'].includes(holiday?.type)) {
        return NextResponse.json(
          { success: false, error: 'Valid holiday name, date (YYYY-MM-DD), and type required.' },
          { status: 400 }
        );
      }
      if (!DATE_REGEX.test(holiday.date)) {
        return NextResponse.json({ success: false, error: 'Date must be YYYY-MM-DD.' }, { status: 400 });
      }

      const holidays = await dataStore.addHoliday(holiday);
      await logAuditEvent({
        userId: adminUser.id,
        action: 'HOLIDAY_ADDED',
        resourceType: 'holiday',
        resourceId: `${holiday.date}_${holiday.name}`,
        metadata: { holiday },
        req,
      });

      return NextResponse.json({ success: true, holidays, message: `Holiday "${holiday.name}" added.` });
    }

    if (body.action === 'delete_holiday') {
      const { date, name } = body;
      if (!date || !name) {
        return NextResponse.json({ success: false, error: 'Date and name required to delete holiday.' }, { status: 400 });
      }

      const holidays = await dataStore.deleteHoliday(date, name);
      await logAuditEvent({
        userId: adminUser.id,
        action: 'HOLIDAY_DELETED',
        resourceType: 'holiday',
        resourceId: `${date}_${name}`,
        metadata: { date, name },
        req,
      });

      return NextResponse.json({ success: true, holidays, message: `Holiday "${name}" deleted.` });
    }

    if (body.action === 'reset_defaults') {
      const restored = await dataStore.updateSystemSettings(DEFAULT_SYSTEM_SETTINGS, {
        id: adminUser.id,
        name: adminUser.name,
      });

      await logAuditEvent({
        userId: adminUser.id,
        action: 'SETTINGS_RESET_TO_DEFAULTS',
        resourceType: 'system_settings',
        resourceId: 'general_settings',
        metadata: {},
        req,
      });

      return NextResponse.json({
        success: true,
        settings: restored,
        message: 'System settings restored to platform defaults.',
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action specified.' }, { status: 400 });
  } catch (err) {
    return handleApiError(err);
  }
}
