import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const query = searchParams.get('q') || '';

    const { messages, total } = await dataStore.getMessagesByOwner(user.id, {
      folder: 'spam',
      query,
      page,
      limit,
    });

    const unreadCount = messages.filter((m) => !m.is_read).length;

    return NextResponse.json({
      success: true,
      messages,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      unreadCount,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const body = await req.json();
    const { messageId, action } = body;

    if (!messageId) {
      return NextResponse.json({ error: 'Message ID is required', success: false }, { status: 400 });
    }

    if (action === 'unmark') {
      const updated = await dataStore.unmarkMessageSpam(user.id, messageId);
      if (!updated) {
        return NextResponse.json({ error: 'Message not found or unauthorized', success: false }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: 'Restored to inbox', data: updated });
    } else {
      const updated = await dataStore.markMessageAsSpam(user.id, messageId);
      if (!updated) {
        return NextResponse.json({ error: 'Message not found or unauthorized', success: false }, { status: 404 });
      }
      await logAuditEvent({
        userId: user.id,
        action: 'MARK_AS_SPAM',
        resourceType: 'MESSAGE',
        resourceId: messageId,
        req,
      });
      return NextResponse.json({ success: true, message: 'Moved to spam', data: updated });
    }
  } catch (err) {
    return handleApiError(err);
  }
}
