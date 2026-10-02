import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser, handleApiError, isCompanyManager } from '@/lib/security/authorization';
import { complianceService } from '@/lib/services/compliance-service';
import { dataStore } from '@/lib/db/store';

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || undefined;

    const evaluation = await complianceService.evaluateDailyCompliance(date);

    // Enforce data scoping (§ 18):
    if (!isCompanyManager(user)) {
      const emp = await dataStore.getEmployeeByUserId(user.id);
      if (emp?.is_group_leader && emp.group_id) {
        // Group leader only sees their squad members
        evaluation.details = evaluation.details.filter((d) => d.groupId === emp.group_id);
      } else if (emp) {
        // Regular employee/intern only sees themselves
        evaluation.details = evaluation.details.filter((d) => d.employeeId === emp.id);
      } else {
        evaluation.details = [];
      }
    }

    return NextResponse.json({
      success: true,
      summary: evaluation.summary,
      details: evaluation.details,
      isWorkingDay: evaluation.isWorkingDay,
      isHoliday: evaluation.isHoliday,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    // Can be triggered by automated cron (with CRON_SECRET) or authenticated manager/admin
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization') || '';
    const isCron = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);

    if (!isCron) {
      await requireActiveUser(req);
    }
    const body = await req.json().catch(() => ({}));
    const currentClockTime = body.currentTime || undefined;
    const targetDate = body.targetDate || undefined;
    const forceSend = body.forceSend === true;
    const milestoneOverride = body.milestoneOverride || undefined;

    const result = await complianceService.processAttendanceReminders(
      currentClockTime,
      targetDate,
      { forceSend, milestoneOverride }
    );

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
