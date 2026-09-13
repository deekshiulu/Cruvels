import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';

const UpdateLeaveSchema = z.object({
  leaveId: z.string().min(1),
  status: z.enum(['APPROVED', 'REJECTED', 'CANCELLED']),
  rejectionReason: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const leaves = await dataStore.getPendingLeaveRequestsForReviewer(user.id);
    return NextResponse.json({ success: true, leaves });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const body = await req.json();
    const parseRes = UpdateLeaveSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json({ error: parseRes.error.errors[0]?.message || 'Invalid update parameters.', success: false }, { status: 400 });
    }

    const { leaveId, status, rejectionReason } = parseRes.data;

    // Check authorization: Admin, Manager, or Group Leader for applicant
    const allLeaves = await dataStore.getLeaveRequests();
    const targetLeave = allLeaves.find((l) => l.id === leaveId);
    if (!targetLeave) {
      return NextResponse.json({ error: 'Leave request not found.', success: false }, { status: 404 });
    }

    let isAuthorized = user.role === 'admin' || user.role === 'manager';
    if (!isAuthorized) {
      const myEmp = await dataStore.getEmployeeByUserId(user.id);
      if (myEmp) {
        isAuthorized = await dataStore.isGroupLeaderFor(myEmp.id, targetLeave.employee_id);
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Forbidden. You are not authorized to approve leave for this employee.', success: false },
        { status: 403 }
      );
    }

    const updated = await dataStore.updateLeaveStatus(
      leaveId,
      status,
      user.id,
      user.name,
      rejectionReason
    );

    if (!updated) {
      return NextResponse.json({ error: 'Leave request not found.', success: false }, { status: 404 });
    }

    await logAuditEvent({
      userId: user.id,
      action: `LEAVE_REQUEST_${status}`,
      resourceType: 'LEAVE',
      resourceId: leaveId,
      metadata: { reviewer: user.name, status, rejectionReason, employee: targetLeave.employee_name },
      req,
    });

    // Notify the employee who applied
    const applicantEmp = await dataStore.getEmployeeById(targetLeave.employee_id);
    if (applicantEmp && applicantEmp.user_id) {
      await dataStore.createNotification({
        user_id: applicantEmp.user_id,
        type: 'leave_status',
        title: `Leave Request ${status}`,
        message: `Your ${targetLeave.leave_type} leave from ${targetLeave.start_date} to ${targetLeave.end_date} was ${status.toLowerCase()} by ${user.name}.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
        link_url: '/leaves',
      });
    }

    return NextResponse.json({ success: true, leave: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
