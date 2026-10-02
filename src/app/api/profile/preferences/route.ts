import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';

const UpdatePreferencesSchema = z.object({
  portal_notifications: z.boolean().optional(),
  email_notifications: z.boolean().optional(),
  push_notifications: z.boolean().optional(),
  task_reminders: z.boolean().optional(),
  announcements: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const prefs = await dataStore.getNotificationPreferences(user.id);
    return NextResponse.json({
      success: true,
      preferences: prefs,
      immutableLocks: {
        attendance_compliance: true,
        security_alerts: true,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const body = await req.json();
    const parsed = UpdatePreferencesSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid preferences payload.' },
        { status: 400 }
      );
    }

    const updated = await dataStore.updateNotificationPreferences(user.id, parsed.data);

    await logAuditEvent({
      userId: user.id,
      action: 'NOTIFICATION_PREFERENCES_UPDATED',
      resourceType: 'user_preferences',
      resourceId: user.id,
      metadata: { patch: parsed.data },
      req,
    });

    return NextResponse.json({
      success: true,
      preferences: updated,
      immutableLocks: {
        attendance_compliance: true,
        security_alerts: true,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
