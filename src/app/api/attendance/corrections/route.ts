import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, handleApiError, isCompanyManager } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';
import { getIndianDateString } from '@/lib/utils/date';
import { formatComplianceMessage } from '@/lib/modules/compliance/templates';

const CreateCorrectionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  current_status: z.string().default('NOT_MARKED'),
  requested_status: z.enum(['PRESENT', 'WORK_FROM_HOME', 'HALF_DAY', 'ON_LEAVE', 'ABSENT']),
  reason: z.string().min(5, 'Reason must be at least 5 characters long').max(500),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') as any;
    const date = searchParams.get('date') || undefined;
    const employeeId = searchParams.get('employeeId') || undefined;

    const myEmp = await dataStore.getEmployeeByUserId(user.id);

    let corrections = await dataStore.getAttendanceCorrections({ status, date });

    if (isCompanyManager(user)) {
      if (employeeId) {
        corrections = corrections.filter((c) => c.employee_id === employeeId);
      }
    } else if (myEmp?.is_group_leader && myEmp.group_id) {
      // Group Leader sees their squad's correction requests
      corrections = corrections.filter((c) => c.group_id === myEmp.group_id || c.employee_id === myEmp.id);
    } else if (myEmp) {
      // Regular employee/intern sees ONLY their own
      corrections = corrections.filter((c) => c.employee_id === myEmp.id);
    } else {
      corrections = [];
    }

    return NextResponse.json({
      success: true,
      corrections,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const body = await req.json();
    const parsed = CreateCorrectionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message || 'Invalid correction request.', success: false }, { status: 400 });
    }

    const myEmp = await dataStore.getEmployeeByUserId(user.id);
    if (!myEmp) {
      return NextResponse.json({ error: 'No employee profile linked to your user account.', success: false }, { status: 400 });
    }

    const today = getIndianDateString();
    if (parsed.data.date > today) {
      return NextResponse.json({ error: 'Cannot request attendance correction for future dates.', success: false }, { status: 400 });
    }

    // Check if there is already a pending correction for this employee on this date
    const existing = await dataStore.getAttendanceCorrections({
      employeeId: myEmp.id,
      date: parsed.data.date,
      status: 'PENDING',
    });

    if (existing.length > 0) {
      return NextResponse.json({ error: `A pending correction request already exists for ${parsed.data.date}.`, success: false }, { status: 400 });
    }

    // Determine current recorded status if exists
    const recorded = await dataStore.getAttendanceRecords({ employeeId: myEmp.id, date: parsed.data.date });
    const currentStatus = recorded[0]?.status || parsed.data.current_status || 'NOT_MARKED';

    const correction = await dataStore.createAttendanceCorrection({
      user_id: user.id,
      employee_id: myEmp.id,
      employee_name: myEmp.name,
      department_name: myEmp.department_name,
      group_id: myEmp.group_id,
      group_name: myEmp.group_name,
      date: parsed.data.date,
      current_status: currentStatus,
      requested_status: parsed.data.requested_status,
      reason: parsed.data.reason,
    });

    // Notify user of submission
    const userMsg = formatComplianceMessage('ATTENDANCE_CORRECTION_SUBMITTED', {
      date: parsed.data.date,
      requestedStatus: parsed.data.requested_status,
    });
    await dataStore.createNotification({
      user_id: user.id,
      type: 'system',
      category: 'attendance_correction',
      title: userMsg.title,
      message: userMsg.body,
      link_url: '/attendance',
      metadata: { correctionId: correction.id, date: parsed.data.date },
    });

    // Notify reviewer: Group Leader or Admins
    if (myEmp.group_id) {
      const group = (await dataStore.getGroups()).find((g) => g.id === myEmp.group_id);
      if (group?.leader_id && group.leader_id !== myEmp.id) {
        const leaderEmp = await dataStore.getEmployeeById(group.leader_id);
        if (leaderEmp?.user_id) {
          const revMsg = formatComplianceMessage('ATTENDANCE_CORRECTION_PENDING_REVIEWER', {
            employeeName: myEmp.name,
            date: parsed.data.date,
            currentStatus,
            requestedStatus: parsed.data.requested_status,
            reason: parsed.data.reason,
          });
          await dataStore.createNotification({
            user_id: leaderEmp.user_id,
            type: 'system',
            category: 'attendance_correction',
            title: revMsg.title,
            message: revMsg.body,
            link_url: '/admin/attendance-compliance',
            metadata: { correctionId: correction.id },
          });
        }
      }
    }

    await logAuditEvent({
      userId: user.id,
      action: 'ATTENDANCE_CORRECTION_REQUESTED',
      resourceType: 'attendance_correction',
      resourceId: correction.id,
      metadata: {
        date: parsed.data.date,
        requested_status: parsed.data.requested_status,
        reason: parsed.data.reason,
      },
      req,
    });

    return NextResponse.json({
      success: true,
      correction,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
