import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser, assertAttachmentOwnership, handleApiError } from '@/lib/security/authorization';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { logAuditEvent } from '@/lib/audit/logger';
import { getEmailProvider } from '@/lib/email/provider';
import { dataStore } from '@/lib/db/store';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; attId: string }> }
) {
  try {
    const user = await requireActiveUser(req);
    const { id: messageId, attId: attachmentId } = await context.params;

    // Rate Limiting on Attachment Downloads (20 per minute)
    const rateCheck = await checkRateLimit(`download:${user.id}`, 20, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many attachment download requests. Please wait a moment.', success: false },
        { status: 429 }
      );
    }

    // Strict IDOR and message association assertion
    const { message, attachment } = await assertAttachmentOwnership(user, messageId, attachmentId);

    let fileBuffer: Buffer | null = null;
    if (attachment.content_data) {
      fileBuffer = Buffer.from(attachment.content_data, 'base64');
    } else {
      const provider = getEmailProvider();
      if (provider.fetchAttachment) {
        const fetched = await provider.fetchAttachment(
          message.provider_message_id,
          attachment.filename,
          message.provider_metadata
        );
        if (fetched?.data) {
          fileBuffer = Buffer.from(fetched.data, 'base64');
          await dataStore.updateAttachment(attachment.id, { content_data: fetched.data });
        }
      }
    }

    if (!fileBuffer) {
      return NextResponse.json(
        { error: 'Attachment content is not available yet. Try syncing mail and download again.', success: false },
        { status: 404 }
      );
    }

    await logAuditEvent({
      userId: user.id,
      action: 'DOWNLOAD_ATTACHMENT',
      resourceType: 'ATTACHMENT',
      resourceId: attachment.id,
      metadata: {
        filename: attachment.filename,
        size: attachment.size,
        messageId: message.id,
      },
      req,
    });

    let safeFilename = attachment.filename
      .replace(/[\0\r\n/\\]/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/^\.+/, '');
    if (!safeFilename) safeFilename = 'attachment.bin';

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': attachment.mime_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
        'Content-Length': String(fileBuffer.length),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
