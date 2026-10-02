import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, assertMessageOwnership, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';

const CreateReminderSchema = z.object({
  messageId: z.string().min(1, 'Message ID is required'),
  messageSubject: z.string().min(1, 'Subject is required').max(250),
  remindAt: z.string().min(10, 'Valid date/time is required'),
  note: z.string().max(500).optional(),
});

const UpdateReminderSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['complete', 'delete']),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    // Process any due reminders first
    await dataStore.processDueMailReminders();
    const reminders = await dataStore.getMailReminders(user.id);
    return NextResponse.json({ success: true, reminders });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const body = await req.json();
    const parsed = CreateReminderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid reminder data', success: false },
        { status: 400 }
      );
    }

    const { messageId, messageSubject, remindAt, note } = parsed.data;

    // Validate ownership of the message
    await assertMessageOwnership(user, messageId);

    const remindDate = new Date(remindAt);
    if (isNaN(remindDate.getTime())) {
      return NextResponse.json({ error: 'Invalid reminder date/time format', success: false }, { status: 400 });
    }

    const reminder = await dataStore.createMailReminder({
      userId: user.id,
      messageId,
      messageSubject,
      remindAt: remindDate.toISOString(),
      note: note?.trim(),
    });

    await logAuditEvent({
      userId: user.id,
      action: 'MAIL_REMINDER_SET',
      resourceType: 'MAIL_REMINDER',
      resourceId: reminder.id,
      metadata: { messageId, remindAt: reminder.remind_at },
      req,
    });

    return NextResponse.json({
      success: true,
      message: 'Reminder scheduled successfully.',
      reminder,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const body = await req.json();
    const parsed = UpdateReminderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request data', success: false }, { status: 400 });
    }

    const { id, action } = parsed.data;
    if (action === 'complete') {
      const ok = await dataStore.completeMailReminder(id, user.id);
      return NextResponse.json({ success: ok });
    } else if (action === 'delete') {
      const ok = await dataStore.deleteMailReminder(id, user.id);
      return NextResponse.json({ success: ok });
    }

    return NextResponse.json({ error: 'Unknown action', success: false }, { status: 400 });
  } catch (err) {
    return handleApiError(err);
  }
}
