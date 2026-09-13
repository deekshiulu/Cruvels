import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser, assertMessageOwnership, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';
import { getEmailProvider } from '@/lib/email/provider';
import { Message } from '@/lib/db/types';

function syncMailboxFlags(message: Message, action: 'read' | 'unread' | 'star' | 'unstar' | 'trash' | 'delete') {
  const provider = getEmailProvider();
  if (!provider.applyMessageAction || !message.provider_message_id?.startsWith('imap_')) return;
  void provider
    .applyMessageAction(message.provider_message_id, action, message.provider_metadata)
    .catch(() => {});
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireActiveUser(req);
    const { id } = await context.params;

    // Strict IDOR assertion
    const message = await assertMessageOwnership(user, id);

    // Auto-mark as read if not already
    if (!message.is_read) {
      await dataStore.updateMessage(message.id, { is_read: true });
      message.is_read = true;
      syncMailboxFlags(message, 'read');
    }

    // Fetch authorized attachments list
    const attachments = await dataStore.getAttachmentsByMessageId(message.id);
    const safeAttachments = attachments.map((a) => ({
      id: a.id,
      filename: a.filename,
      mime_type: a.mime_type,
      size: a.size,
      download_url: `/api/messages/${message.id}/attachments/${a.id}`,
    }));

    await logAuditEvent({
      userId: user.id,
      action: 'READ_MESSAGE',
      resourceType: 'MESSAGE',
      resourceId: message.id,
      metadata: { subject: message.subject, folder: message.folder },
      req,
    });

    return NextResponse.json({
      success: true,
      message,
      attachments: safeAttachments,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireActiveUser(req);
    const { id } = await context.params;

    // Strict IDOR assertion
    const message = await assertMessageOwnership(user, id);

    const body = await req.json();
    const updates: Record<string, any> = {};

    if (typeof body.is_read === 'boolean') updates.is_read = body.is_read;
    if (typeof body.is_starred === 'boolean') updates.is_starred = body.is_starred;
    if (['inbox', 'sent', 'trash', 'archive', 'drafts'].includes(body.folder)) {
      updates.folder = body.folder;
    }

    const updated = await dataStore.updateMessage(message.id, updates);

    if (typeof body.is_read === 'boolean') {
      syncMailboxFlags(message, body.is_read ? 'read' : 'unread');
    }
    if (typeof body.is_starred === 'boolean') {
      syncMailboxFlags(message, body.is_starred ? 'star' : 'unstar');
    }
    if (body.folder === 'trash') {
      syncMailboxFlags(message, 'trash');
    }

    return NextResponse.json({
      success: true,
      message: updated,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireActiveUser(req);
    const { id } = await context.params;

    const message = await assertMessageOwnership(user, id);

    if (message.folder !== 'trash') {
      await dataStore.updateMessage(message.id, { folder: 'trash' });
      syncMailboxFlags(message, 'trash');
      return NextResponse.json({ success: true, message: 'Message moved to trash.' });
    } else {
      await dataStore.deleteMessage(message.id);
      syncMailboxFlags(message, 'delete');
      return NextResponse.json({ success: true, message: 'Message permanently deleted.' });
    }
  } catch (err) {
    return handleApiError(err);
  }
}
