import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, handleApiError, isCompanyManager } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';
import { formatComplianceMessage } from '@/lib/modules/compliance/templates';

const ReviewCorrectionSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  review_notes: z.string().max(500).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireActiveUser(req);
    const { id } = await params;
    const body = await req.json();
    const parsed = ReviewCorrectionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message || 'Invalid review payload.', success: false }, { status: 400 });
    }

    const correction = await dataStore.getAttendanceCorrectionById(id);
    if (!correction) {
      return NextResponse.json({ error: 'Attendance correction request not found.', success: false }, { status: 404 });
    }

    // Authorization check (§ 1.1, § 17):
    const isManager = isCompanyManager(user);
    const myEmp = await dataStore.getEmployeeByUserId(user.id);
    const isSquadLeader = myEmp?.is_group_leader && myEmp?.group_id && myEmp.group_id === correction.group_id;

    if (!isManager && !isSquadLeader) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Admins or the assigned Squad Group Leader can review attendance corrections.', success: false },
        { status: 403 }
      );
    }

    // Cannot approve your own correction request
    if (correction.user_id === user.id || (myEmp && correction.employee_id === myEmp.id)) {
      return NextResponse.json(
        { error: 'Conflict of interest: You cannot approve your own attendance correction request. Another supervisor or admin must review it.', success: false },
        { status: 403 }
      );
    }

    const reviewed = await dataStore.reviewAttendanceCorrection(id, {
      status: parsed.data.status,
      reviewed_by_id: user.id,
      reviewed_by_name: user.name,
      review_notes: parsed.data.review_notes,
    });

    // Notify requester of decision
    const templateKey = parsed.data.status === 'APPROVED' ? 'ATTENDANCE_CORRECTION_APPROVED' : 'ATTENDANCE_CORRECTION_REJECTED';
    const notifyMsg = formatComplianceMessage(templateKey, {
      date: correction.date,
      reviewerName: user.name,
      requestedStatus: correction.requested_status,
      reviewNotes: parsed.data.review_notes || 'No notes provided',
    });

    await dataStore.createNotification({
      user_id: correction.user_id,
      type: 'system',
      category: 'attendance_correction',
      title: notifyMsg.title,
      message: notifyMsg.body,
      link_url: '/attendance',
      metadata: { correctionId: id, status: parsed.data.status, date: correction.date },
    });

    await logAuditEvent({
      userId: user.id,
      action: parsed.data.status === 'APPROVED' ? 'ATTENDANCE_CORRECTION_APPROVED' : 'ATTENDANCE_CORRECTION_REJECTED',
      resourceType: 'attendance_correction',
      resourceId: id,
      metadata: {
        employee_id: correction.employee_id,
        employee_name: correction.employee_name,
        date: correction.date,
        status: parsed.data.status,
        review_notes: parsed.data.review_notes,
      },
      req,
    });

    return NextResponse.json({
      success: true,
      correction: reviewed,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
