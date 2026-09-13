import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { sendAuthorizedEmail } from '@/lib/email/sender';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { dataStore } from '@/lib/db/store';
import { sanitizeEmailHtml } from '@/lib/security/sanitize';

const ComposeSchema = z.object({
  to: z.array(z.string()).optional().default([]),
  cc: z.array(z.string()).optional(),
  bcc: z.array(z.string()).optional(),
  subject: z.string().max(200, 'Subject cannot exceed 200 characters').default(''),
  bodyText: z.string().optional(),
  bodyHtml: z.string().optional(),
  idempotencyKey: z.string().optional(),
  isDraft: z.boolean().optional(),
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

    const body = await req.json();
    const parseRes = ComposeSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json(
        { error: parseRes.error.errors[0]?.message || 'Invalid email composition data.', success: false },
        { status: 400 }
      );
    }

    // Handle Save as Draft
    if (parseRes.data.isDraft) {
      const draftMsg = await dataStore.createMessage({
        owner_user_id: user.id,
        owner_alias_id: user.primaryAlias,
        provider_message_id: `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        thread_id: `thread_draft_${Date.now()}`,
        from_address: user.primaryAlias,
        from_name: user.name,
        to_addresses: parseRes.data.to || [],
        cc_addresses: parseRes.data.cc || [],
        bcc_addresses: parseRes.data.bcc || [],
        subject: parseRes.data.subject || '(Draft)',
        body_text: parseRes.data.bodyText || '',
        body_html: parseRes.data.bodyHtml ? sanitizeEmailHtml(parseRes.data.bodyHtml) : null,
        snippet: (parseRes.data.bodyText || '').slice(0, 100),
        folder: 'drafts',
        is_read: true,
        is_starred: false,
        has_attachments: Boolean(parseRes.data.attachments && parseRes.data.attachments.length > 0),
        received_at: null,
        sent_at: null,
      });

      return NextResponse.json({
        success: true,
        message: 'Draft saved successfully.',
        data: { messageId: draftMsg.id },
      });
    }

    // Validation for live sending: requires recipient
    if (!parseRes.data.to || parseRes.data.to.length === 0) {
      return NextResponse.json(
        { error: 'At least one recipient is required to send email.', success: false },
        { status: 400 }
      );
    }

    // Rate Limiting (30 sends per hour per user)
    const rateCheck = await checkRateLimit(`send:${user.id}`, 30, 3600);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Email send rate limit reached. Please wait before sending more emails.', success: false },
        { status: 429 }
      );
    }

    const result = await sendAuthorizedEmail(user, {
      ...parseRes.data,
      to: parseRes.data.to,
      bodyHtml:
        parseRes.data.bodyHtml ||
        (parseRes.data.bodyText
          ? parseRes.data.bodyText
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/\n/g, '<br>')
          : undefined),
    });

    return NextResponse.json({
      success: true,
      message: 'Email dispatched successfully.',
      data: result,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
