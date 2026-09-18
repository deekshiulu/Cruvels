import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const body = await req.json();
    const { messageId, starred } = body;

    if (!messageId) {
      return NextResponse.json({ error: 'Message ID is required', success: false }, { status: 400 });
    }

    const msg = await dataStore.getMessageById(messageId);
    if (!msg || msg.owner_user_id !== user.id) {
      return NextResponse.json({ error: 'Message not found or unauthorized', success: false }, { status: 404 });
    }

    const nextStarred = typeof starred === 'boolean' ? starred : !msg.is_starred;
    const updated = await dataStore.updateMessage(messageId, { is_starred: nextStarred });

    await logAuditEvent({
      userId: user.id,
      action: nextStarred ? 'EMAIL_STARRED' : 'EMAIL_UNSTARRED',
      resourceType: 'message',
      resourceId: messageId,
      metadata: { subject: msg.subject },
    });

    return NextResponse.json({
      success: true,
      is_starred: updated?.is_starred,
      data: updated,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
