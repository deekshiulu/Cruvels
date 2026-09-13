import { AuthSessionUser } from '../db/types';
import { dataStore } from '../db/store';
import { getEmailProvider } from './provider';
import { sanitizeEmailHtml, extractSnippet } from '../security/sanitize';
import { validateEmailString, validateSafeHeader } from '../security/authorization';
import { evaluateEmailOwnership } from './ownership';
import { logAuditEvent } from '../audit/logger';
import { generateRfcMessageId, normalizeRfcMessageId, textToEmailHtml } from './rfc';

// In-Memory Idempotency Cache (5 min window) with auto-pruning
const idempotencyCache = new Map<string, { result: OutboundSendResult; timestamp: number }>();

function pruneIdempotencyCache() {
  const now = Date.now();
  for (const [key, item] of idempotencyCache.entries()) {
    if (now - item.timestamp > 300000) {
      idempotencyCache.delete(key);
    }
  }
}

export interface OutboundEmailPayload {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  replyToMessageId?: string;
  idempotencyKey?: string;
  attachments?: {
    filename: string;
    mimeType: string;
    data: string; // base64
  }[];
}

export interface OutboundSendResult {
  success: boolean;
  messageId: string;
  threadId: string;
  from: string;
  internalRecipientsCount?: number;
}

export async function sendAuthorizedEmail(
  user: AuthSessionUser,
  payload: OutboundEmailPayload
): Promise<OutboundSendResult> {
  // 1. Idempotency Check & Sweep
  if (idempotencyCache.size > 500) {
    pruneIdempotencyCache();
  }

  if (payload.idempotencyKey) {
    const cached = idempotencyCache.get(`${user.id}:${payload.idempotencyKey}`);
    if (cached && Date.now() - cached.timestamp < 300000) {
      return cached.result;
    }
  }

  // 2. Strict Sender Lock (Absolute Rule: Client NEVER sets From header)
  const userAliases = await dataStore.getAliasesByUserId(user.id);
  const activeAliases = userAliases.filter((a) => a.is_active);
  if (activeAliases.length === 0) {
    throw new Error('You do not have an active assigned email alias. Sending is disabled.');
  }
  const senderAlias = activeAliases[0];
  const enforcedFrom = senderAlias.email_address;

  // 3. Header Validation & CRLF Injection Prevention
  if (!payload.to || !Array.isArray(payload.to) || payload.to.length === 0) {
    throw new Error('At least one recipient (To) is required.');
  }

  const validTo = payload.to.map((e) => e.trim()).filter((e) => validateEmailString(e));
  if (validTo.length === 0) {
    throw new Error('Invalid recipient email address provided.');
  }

  const validCc = (payload.cc || []).map((e) => e.trim()).filter((e) => validateEmailString(e));
  const validBcc = (payload.bcc || []).map((e) => e.trim()).filter((e) => validateEmailString(e));
  const safeSubject = validateSafeHeader(payload.subject || '(No Subject)');

  // 4. Attachment Security & Size Validation (Max 25MB total)
  let totalAttachmentSize = 0;
  const safeAttachments: { filename: string; mimeType: string; data: string; size: number }[] = [];

  if (payload.attachments && Array.isArray(payload.attachments)) {
    for (const att of payload.attachments) {
      if (!att.filename || !att.data) continue;

      // Sanitize filename against directory traversal
      const cleanFilename = att.filename.replace(/[\0\r\n/\\]/g, '_').replace(/\.\./g, '_').trim();
      const approxSize = Math.round((att.data.length * 3) / 4);
      totalAttachmentSize += approxSize;

      if (approxSize > 15 * 1024 * 1024) {
        throw new Error(`Attachment "${cleanFilename}" exceeds single file limit of 15MB.`);
      }

      safeAttachments.push({
        filename: cleanFilename || 'attachment',
        mimeType: att.mimeType || 'application/octet-stream',
        data: att.data,
        size: approxSize,
      });
    }

    if (totalAttachmentSize > 25 * 1024 * 1024) {
      throw new Error('Total attachment size exceeds 25MB limit.');
    }
  }

  // 5. Threading & Reply Resolution
  let threadId = `thread_${Date.now()}`;
  let rfcInReplyTo: string | undefined;
  if (payload.replyToMessageId) {
    const original = await dataStore.getMessageById(payload.replyToMessageId);
    if (original && original.owner_user_id === user.id) {
      threadId = original.thread_id;
      rfcInReplyTo =
        original.provider_metadata?.rfcMessageId ||
        (original.provider_message_id.includes('@') ? original.provider_message_id : undefined);
    }
  }

  // 6. Sanitize HTML (plain text is converted so SMTP clients render line breaks)
  const safeText = payload.bodyText || '';
  const htmlSource = payload.bodyHtml || (safeText ? textToEmailHtml(safeText) : '');
  const safeHtml = htmlSource ? sanitizeEmailHtml(htmlSource) : undefined;
  const snippet = extractSnippet(safeText || safeHtml);
  const now = new Date().toISOString();
  const rfcMessageId = generateRfcMessageId(enforcedFrom);

  // 7. Instant Local Delivery to All Internal Recipients in Organization
  const internalMatches = await evaluateEmailOwnership({
    toAddresses: validTo,
    ccAddresses: validCc,
    bccAddresses: validBcc,
    fromAddress: enforcedFrom,
  });

  for (const match of internalMatches) {
    // Avoid creating duplicate message in sender's own inbox
    if (match.matchedUser.id === user.id) continue;

    const inboxMsg = await dataStore.createMessage({
      provider_message_id: `msg_internal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      thread_id: threadId,
      owner_user_id: match.matchedUser.id,
      owner_alias_id: match.matchedAlias.id,
      from_address: enforcedFrom,
      from_name: user.name,
      to_addresses: validTo,
      cc_addresses: validCc,
      bcc_addresses: validBcc,
      subject: safeSubject,
      body_text: safeText,
      body_html: safeHtml || null,
      snippet,
      received_at: now,
      sent_at: now,
      folder: 'inbox',
      is_read: false,
      is_starred: false,
      has_attachments: safeAttachments.length > 0,
      provider_metadata: { delivery: 'internal_instant', rfcMessageId: normalizeRfcMessageId(rfcMessageId) },
    });

    await dataStore.createNotification({
      user_id: match.matchedUser.id,
      type: 'mail',
      title: `New Email: ${safeSubject}`,
      message: `From ${user.name} (${enforcedFrom}) - ${snippet.slice(0, 80)}`,
      link_url: `/mail/${inboxMsg.id}`,
    });

    for (const att of safeAttachments) {
      await dataStore.createAttachment({
        message_id: inboxMsg.id,
        filename: att.filename,
        mime_type: att.mimeType,
        size: att.size,
        storage_path: `inbox-attachments/${match.matchedUser.username}/${att.filename}`,
        content_data: att.data,
      });
    }
  }

  // 8. Outbound SMTP Delivery via Configured Provider
  let providerMessageId = `msg_${Date.now()}`;
  const provider = getEmailProvider();

  try {
    const dispatchRes = await provider.sendEmail({
      from: enforcedFrom,
      fromName: user.name,
      to: validTo,
      cc: validCc,
      bcc: validBcc,
      subject: safeSubject,
      text: safeText,
      html: safeHtml,
      threadId,
      messageId: rfcMessageId,
      replyToMessageId: rfcInReplyTo,
      attachments: safeAttachments.map((a) => ({
        filename: a.filename,
        mimeType: a.mimeType,
        data: a.data,
      })),
    });
    providerMessageId = dispatchRes.providerMessageId;
  } catch (providerErr: any) {
    console.error('[OUTBOUND SMTP DISPATCH ERROR]', providerErr);
    // If no internal members received the email, bubble up SMTP error
    if (internalMatches.length === 0 || internalMatches.every((m) => m.matchedUser.id === user.id)) {
      throw providerErr;
    }
  }

  // 9. Store in Sender's Sent Mailbox
  const savedMsg = await dataStore.createMessage({
    provider_message_id: providerMessageId,
    thread_id: threadId,
    owner_user_id: user.id,
    owner_alias_id: senderAlias.id,
    from_address: enforcedFrom,
    from_name: user.name,
    to_addresses: validTo,
    cc_addresses: validCc,
    bcc_addresses: validBcc,
    subject: safeSubject,
    body_text: safeText,
    body_html: safeHtml || null,
    snippet,
    received_at: null,
    sent_at: now,
    folder: 'sent',
    is_read: true,
    is_starred: false,
    has_attachments: safeAttachments.length > 0,
    provider_metadata: {
      provider: provider.name,
      rfcMessageId: normalizeRfcMessageId(rfcMessageId),
    },
  });

  // Store attachments in sender's record
  for (const att of safeAttachments) {
    await dataStore.createAttachment({
      message_id: savedMsg.id,
      filename: att.filename,
      mime_type: att.mimeType,
      size: att.size,
      storage_path: `sent-attachments/${user.username}/${att.filename}`,
      content_data: att.data,
    });
  }

  const sendResult: OutboundSendResult = {
    success: true,
    messageId: savedMsg.id,
    threadId: savedMsg.thread_id,
    from: enforcedFrom,
    internalRecipientsCount: internalMatches.length,
  };

  // Cache for idempotency
  if (payload.idempotencyKey) {
    idempotencyCache.set(`${user.id}:${payload.idempotencyKey}`, {
      result: sendResult,
      timestamp: Date.now(),
    });
  }

  await logAuditEvent({
    userId: user.id,
    action: payload.replyToMessageId ? 'REPLY_MESSAGE' : 'SEND_MESSAGE',
    resourceType: 'MESSAGE',
    resourceId: savedMsg.id,
    metadata: {
      toCount: validTo.length,
      hasAttachments: savedMsg.has_attachments,
      fromAlias: enforcedFrom,
      internalDeliveries: internalMatches.length,
    },
  });

  return sendResult;
}
