import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, assertMessageOwnership, handleApiError } from '@/lib/security/authorization';
import { sendAuthorizedEmail } from '@/lib/email/sender';
import { checkRateLimit } from '@/lib/security/rate-limit';

const ReplySchema = z.object({
  replyToMessageId: z.string().min(1, 'Original message ID is required'),
  bodyText: z.string().optional(),
  bodyHtml: z.string().optional(),
  replyAll: z.boolean().optional().default(false),
  idempotencyKey: z.string().optional(),
  attachments: z
    .array(
      z.object({
        filename: z.string().min(1).max(255),
        mimeType: z.string(),
        data: z.string(), // base64
      })
    )
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);

    // Rate Limiting
    const rateCheck = await checkRateLimit(`send:${user.id}`, 30, 3600);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Email send rate limit reached. Please wait before sending more emails.', success: false },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parseRes = ReplySchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json(
        { error: 'Invalid reply data.', success: false },
        { status: 400 }
      );
    }

    const { replyToMessageId, bodyText, bodyHtml, replyAll, idempotencyKey, attachments } = parseRes.data;

    // Strict ownership verification of original message
    const originalMessage = await assertMessageOwnership(user, replyToMessageId);

    // Determine reply recipient
    const userAliasLower = user.assignedAliases.map((a) => a.toLowerCase());
    const isSentByMe = userAliasLower.includes(originalMessage.from_address.toLowerCase());

    let recipientTo: string[] = [];
    if (isSentByMe) {
      recipientTo = originalMessage.to_addresses.filter(
        (addr) => !userAliasLower.includes(addr.toLowerCase())
      );
      if (recipientTo.length === 0) {
        recipientTo = [originalMessage.to_addresses[0] || originalMessage.from_address];
      }
    } else {
      recipientTo = [originalMessage.from_address];
    }

    let recipientCc: string[] = [];
    if (replyAll) {
      const allParticipants = [
        originalMessage.from_address,
        ...originalMessage.to_addresses,
        ...(originalMessage.cc_addresses || []),
      ];
      recipientCc = Array.from(
        new Set(
          allParticipants.filter(
            (addr) =>
              !userAliasLower.includes(addr.toLowerCase()) &&
              !recipientTo.map((r) => r.toLowerCase()).includes(addr.toLowerCase())
          )
        )
      );
    }

    const replySubject = originalMessage.subject.startsWith('Re:')
      ? originalMessage.subject
      : `Re: ${originalMessage.subject}`;

    const quotedText = originalMessage.body_text
      ? `\n\nOn ${originalMessage.received_at || originalMessage.sent_at || ''}, ${originalMessage.from_name || originalMessage.from_address} wrote:\n${originalMessage.body_text
          .split('\n')
          .map((line) => `> ${line}`)
          .join('\n')}`
      : '';
    const fullText = `${bodyText || ''}${quotedText}`;
    const fullHtml =
      bodyHtml ||
      (fullText
        ? fullText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>')
        : undefined);

    const sendRes = await sendAuthorizedEmail(user, {
      to: recipientTo,
      cc: recipientCc,
      subject: replySubject,
      bodyText: fullText,
      bodyHtml: fullHtml,
      replyToMessageId: originalMessage.id,
      idempotencyKey,
      attachments,
    });

    return NextResponse.json({
      success: true,
      message: 'Reply sent successfully.',
      data: sendRes,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
