import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';

const UpdateStateSchema = z.object({
  state: z.enum(['unread', 'read', 'action_required', 'acknowledged', 'expired']),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireActiveUser(req);
    const { id } = await context.params;
    const body = await req.json();
    const parsed = UpdateStateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid state payload.' },
        { status: 400 }
      );
    }

    const updated = await dataStore.updateNotificationState(id, user.id, parsed.data.state);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Notification not found or access denied.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, notification: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
