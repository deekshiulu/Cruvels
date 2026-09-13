import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';
import { getIndianDateString } from '@/lib/utils/date';
import { AttendanceStatus } from '@/lib/db/types';

const ALLOWED_STATUS: AttendanceStatus[] = ['PRESENT', 'WORK_FROM_HOME', 'HALF_DAY', 'ON_LEAVE', 'ABSENT'];

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const body = await req.json().catch(() => ({}));
    const status = (body.status || 'PRESENT') as AttendanceStatus;
    if (!ALLOWED_STATUS.includes(status)) {
      return NextResponse.json({ error: 'Invalid attendance status.', success: false }, { status: 400 });
    }

    const emp = await dataStore.getEmployeeByUserId(user.id);
    if (!emp) {
      return NextResponse.json(
        { error: 'No employee record is linked to this account. Ask an admin to provision your profile first.', success: false },
        { status: 400 }
      );
    }

    const today = getIndianDateString();

    const leaves = await dataStore.getLeaveRequests({ employeeId: emp.id });
    const hasApprovedLeave = leaves.some(
      (l) => l.status === 'APPROVED' && today >= l.start_date && today <= l.end_date
    );
    if (hasApprovedLeave) {
      return NextResponse.json(
        {
          error: 'You have an approved leave for today. Cancel your approved leave request first before marking attendance.',
          success: false,
        },
        { status: 400 }
      );
    }

    const record = await dataStore.markDailyAttendance({
      employee_id: emp.id,
      employee_name: emp.name,
      date: today,
      status,
      marked_by_id: user.id,
      is_admin_override: false,
    });

    await logAuditEvent({
      userId: user.id,
      action: 'ATTENDANCE_RECORDED',
      resourceType: 'ATTENDANCE',
      resourceId: record.id,
      metadata: { status: record.status, date: record.date },
      req,
    });

    return NextResponse.json({
      success: true,
      message: `Attendance marked as ${record.status} for today.`,
      record,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('already been recorded')) {
      return NextResponse.json({ error: err.message, success: false }, { status: 409 });
    }
    return handleApiError(err);
  }
}
