import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, handleApiError, canMarkAttendanceFor, isCompanyManager } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';
import { getIndianDateString } from '@/lib/utils/date';

const MarkAttendanceSchema = z.object({
  employee_id: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  status: z.enum(['PRESENT', 'WORK_FROM_HOME', 'HALF_DAY', 'ON_LEAVE', 'ABSENT']),
  notes: z.string().max(250).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const emp = await dataStore.getEmployeeByUserId(user.id);
    let records = await dataStore.getAttendanceRecords({ date, startDate, endDate });

    if (!isCompanyManager(user)) {
      if (emp?.is_group_leader && emp?.group_id) {
        // Group Leader can view attendance for members of their squad
        const squadMembers = await dataStore.getEmployees({ groupId: emp.group_id });
        const memberIds = new Set(squadMembers.map((m) => m.id));
        records = records.filter((r) => memberIds.has(r.employee_id));
      } else if (emp) {
        // Regular employee/intern sees ONLY their own attendance
        records = records.filter((r) => r.employee_id === emp.id);
      } else {
        records = [];
      }
    } else if (searchParams.get('employeeId')) {
      records = records.filter((r) => r.employee_id === searchParams.get('employeeId'));
    }

    return NextResponse.json({
      success: true,
      records,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const body = await req.json();
    const parsed = MarkAttendanceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message || 'Invalid attendance data.', success: false }, { status: 400 });
    }

    let targetEmployeeId = parsed.data.employee_id;
    let targetEmployeeName = user.name;

    if (!targetEmployeeId) {
      const myEmp = await dataStore.getEmployeeByUserId(user.id);
      if (!myEmp) {
        return NextResponse.json({ error: 'No employee record linked to this user.', success: false }, { status: 400 });
      }
      targetEmployeeId = myEmp.id;
      targetEmployeeName = myEmp.name;
    } else if (targetEmployeeId) {
      const targetEmp = await dataStore.getEmployeeById(targetEmployeeId);
      if (!targetEmp) {
        return NextResponse.json({ error: 'Target employee not found.', success: false }, { status: 404 });
      }
      targetEmployeeName = targetEmp.name;

      if (targetEmp.user_id !== user.id) {
        const allowed = await canMarkAttendanceFor(user, targetEmp.id);
        if (!allowed) {
          return NextResponse.json({ error: 'Unauthorized to mark attendance for this employee.', success: false }, { status: 403 });
        }
      }
    }

    const today = getIndianDateString();

    if (parsed.data.date !== today) {
      return NextResponse.json(
        {
          error: `Attendance can only be marked for today (${today}). Previous and future dates cannot be marked or modified.`,
          success: false,
        },
        { status: 400 }
      );
    }

    // Check if employee has an approved leave for this date
    const leaves = await dataStore.getLeaveRequests({ employeeId: targetEmployeeId });
    const hasApprovedLeave = leaves.some(
      (l) => l.status === 'APPROVED' && parsed.data.date >= l.start_date && parsed.data.date <= l.end_date
    );
    if (hasApprovedLeave) {
      return NextResponse.json(
        {
          error: `You have an approved leave on ${parsed.data.date}. Cancel your approved leave request first before marking attendance.`,
          success: false,
        },
        { status: 400 }
      );
    }

    const record = await dataStore.markDailyAttendance({
      employee_id: targetEmployeeId,
      employee_name: targetEmployeeName,
      date: parsed.data.date,
      status: parsed.data.status,
      notes: parsed.data.notes,
      marked_by_id: user.id,
      is_admin_override: false,
    });

    await logAuditEvent({
      userId: user.id,
      action: 'ATTENDANCE_RECORDED',
      resourceType: 'ATTENDANCE',
      resourceId: record.id,
      metadata: { employeeId: targetEmployeeId, date: parsed.data.date, status: parsed.data.status },
      req,
    });

    return NextResponse.json({ success: true, record });
  } catch (err) {
    if (err instanceof Error && err.message.includes('already been recorded')) {
      return NextResponse.json({ error: err.message, success: false }, { status: 409 });
    }
    return handleApiError(err);
  }
}
