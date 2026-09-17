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

    // Fetch authorized attachments list for primary message
    const attachments = await dataStore.getAttachmentsByMessageId(message.id);
    const safeAttachments = attachments.map((a) => ({
      id: a.id,
      filename: a.filename,
      mime_type: a.mime_type,
      size: a.size,
      download_url: `/api/messages/${message.id}/attachments/${a.id}`,
    }));

    // Fetch complete conversation thread (all chronological messages in this thread owned by user)
    const threadMessages = await dataStore.getMessagesByThreadId(user.id, message.thread_id);
    const threadAttachmentsMap: Record<string, { id: string; filename: string; mime_type: string; size: number; download_url: string }[]> = {};
    for (const tm of threadMessages) {
      if (tm.id === message.id) {
        threadAttachmentsMap[tm.id] = safeAttachments;
      } else {
        const tmAtts = await dataStore.getAttachmentsByMessageId(tm.id);
        threadAttachmentsMap[tm.id] = tmAtts.map((a) => ({
          id: a.id,
          filename: a.filename,
          mime_type: a.mime_type,
          size: a.size,
          download_url: `/api/messages/${tm.id}/attachments/${a.id}`,
        }));
      }
    }

    await logAuditEvent({
      userId: user.id,
      action: 'READ_MESSAGE',
      resourceType: 'MESSAGE',
      resourceId: message.id,
      metadata: { subject: message.subject, folder: message.folder, threadId: message.thread_id },
      req,
    });

    return NextResponse.json({
      success: true,
      message,
      attachments: safeAttachments,
      threadMessages: threadMessages.length > 0 ? threadMessages : [message],
      threadAttachmentsMap,
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
    if (body.action === 'spam' || body.folder === 'spam') {
      updates.folder = 'spam';
      updates.is_spam = true;
    } else if (body.action === 'unspam') {
      updates.folder = 'inbox';
      updates.is_spam = false;
    } else if (['inbox', 'sent', 'trash', 'archive', 'drafts', 'spam'].includes(body.folder)) {
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
