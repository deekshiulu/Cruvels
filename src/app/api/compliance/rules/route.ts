import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, handleApiError, requireAdmin } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';

const UpdateAttendanceRulesSchema = z.object({
  markingDeadline: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Deadline must be in HH:mm 24h format').optional(),
  workingDays: z.array(z.number().min(1).max(7)).min(1, 'At least one working day required').optional(),
  checkInCheckOutRequired: z.boolean().optional(),
  lateMarkingAllowed: z.boolean().optional(),
  gracePeriodMinutes: z.number().min(0).max(180).optional(),
  allowSelfEditAfterSubmission: z.boolean().optional(),
  correctionApproverRole: z.enum(['admin', 'group_leader', 'manager']).optional(),
  reminderTimes: z.array(z.string()).optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireActiveUser(req);
    const rules = await dataStore.getAttendanceRules();
    return NextResponse.json({ success: true, rules });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAdmin(req);
    const body = await req.json();
    const parsed = UpdateAttendanceRulesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message || 'Invalid rule configuration.', success: false }, { status: 400 });
    }

    const updated = await dataStore.updateAttendanceRules(parsed.data);

    await logAuditEvent({
      userId: user.id,
      action: 'UPDATE_ATTENDANCE_COMPLIANCE_RULES',
      resourceType: 'compliance_rules',
      resourceId: 'active_rules',
      metadata: { patch: parsed.data },
      req,
    });

    return NextResponse.json({ success: true, rules: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
