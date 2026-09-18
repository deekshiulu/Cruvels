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
      folder: 'trash',
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

    const msg = await dataStore.getMessageById(messageId);
    if (!msg || msg.owner_user_id !== user.id) {
      return NextResponse.json({ error: 'Message not found or unauthorized', success: false }, { status: 404 });
    }

    if (action === 'restore') {
      const updated = await dataStore.updateMessage(messageId, { folder: 'inbox' });
      await logAuditEvent({
        userId: user.id,
        action: 'EMAIL_RESTORED_FROM_TRASH',
        resourceType: 'message',
        resourceId: messageId,
        metadata: { subject: msg.subject },
      });
      return NextResponse.json({ success: true, message: 'Message restored to inbox', data: updated });
    } else {
      const updated = await dataStore.updateMessage(messageId, { folder: 'trash' });
      await logAuditEvent({
        userId: user.id,
        action: 'EMAIL_MOVED_TO_TRASH',
        resourceType: 'message',
        resourceId: messageId,
        metadata: { subject: msg.subject },
      });
      return NextResponse.json({ success: true, message: 'Message moved to trash', data: updated });
    }
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const { searchParams } = new URL(req.url);
    let messageId = searchParams.get('messageId');

    if (!messageId) {
      try {
        const body = await req.json();
        messageId = body.messageId;
      } catch {}
    }

    if (!messageId) {
      return NextResponse.json({ error: 'Message ID is required', success: false }, { status: 400 });
    }

    const msg = await dataStore.getMessageById(messageId);
    if (!msg || msg.owner_user_id !== user.id) {
      return NextResponse.json({ error: 'Message not found or unauthorized', success: false }, { status: 404 });
    }

    const deleted = await dataStore.deleteMessage(messageId);
    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete message', success: false }, { status: 500 });
    }

    await logAuditEvent({
      userId: user.id,
      action: 'EMAIL_PERMANENTLY_DELETED',
      resourceType: 'message',
      resourceId: messageId,
      metadata: { subject: msg.subject },
    });

    return NextResponse.json({ success: true, message: 'Message permanently deleted' });
  } catch (err) {
    return handleApiError(err);
  }
}
