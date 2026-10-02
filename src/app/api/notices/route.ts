import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';
import { acknowledgementService } from '@/lib/services/acknowledgement-service';

const CreateNoticeSchema = z.object({
  title: z.string().min(3).max(150),
  content: z.string().min(5).max(2000),
  category: z.enum(['General', 'Urgent', 'Event', 'Policy', 'Engineering']).default('General'),
  isPinned: z.boolean().default(false),
  requiresAcknowledgement: z.boolean().optional(),
  acknowledgementDueDate: z.string().optional(),
  targetAudience: z.enum(['all', 'interns', 'employees', 'engineering', 'squad']).optional(),
  targetGroupId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const notices = await dataStore.getNotices();
    const userAcks = await dataStore.getAcknowledgements({ recipientUserId: user.id, itemType: 'notice' });
    const userAckMap = new Map(userAcks.map((a) => [a.item_id, a]));

    const enriched = await Promise.all(
      notices.map(async (n) => {
        const userAck = userAckMap.get(n.id);
        let summary = null;
        if (n.requires_acknowledgement && (user.role === 'admin' || user.role === 'manager')) {
          summary = await dataStore.getItemAcknowledgementSummary('notice', n.id);
        }
        return {
          ...n,
          userAcknowledgement: userAck || null,
          acknowledgementSummary: summary,
        };
      })
    );

    return NextResponse.json({ success: true, notices: enriched });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    if (user.role !== 'admin' && user.role !== 'manager') {
      return NextResponse.json({ error: 'Only Managers and Admins can publish notices.', success: false }, { status: 403 });
    }

    const body = await req.json();
    const parseRes = CreateNoticeSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json({ error: 'Invalid notice parameters.', success: false }, { status: 400 });
    }

    const {
      title,
      content,
      category,
      isPinned,
      requiresAcknowledgement,
      acknowledgementDueDate,
      targetAudience,
      targetGroupId,
    } = parseRes.data;

    const notice = await dataStore.createNotice({
      title,
      content,
      category,
      is_pinned: isPinned,
      author_id: user.id,
      author_name: user.name,
      requires_acknowledgement: Boolean(requiresAcknowledgement),
      acknowledgement_due_date: acknowledgementDueDate || undefined,
      target_audience: targetAudience || 'all',
      target_group_id: targetGroupId || undefined,
    });

    await logAuditEvent({
      userId: user.id,
      action: 'NOTICE_PUBLISHED',
      resourceType: 'NOTICE',
      resourceId: notice.id,
      metadata: { title, category, isPinned, requiresAcknowledgement },
      req,
    });

    // If acknowledgement required, register requirement with the universal service (§ 8)
    if (requiresAcknowledgement) {
      await acknowledgementService.registerRequirement({
        itemType: 'notice',
        itemId: notice.id,
        itemTitle: notice.title,
        targetAudience: targetAudience || 'all',
        targetGroupId,
        dueAt: acknowledgementDueDate,
        registeredByUserId: user.id,
      });
    } else {
      // Standard broadcast notification to all active employees
      const allUsers = await dataStore.listUsers();
      for (const u of allUsers) {
        if (u.id !== user.id) {
          await dataStore.createNotification({
            user_id: u.id,
            type: 'notice',
            title: `${category === 'Urgent' ? '🔴 URGENT NOTICE' : 'Announcement'}: ${notice.title}`,
            message: `${notice.content.slice(0, 90)}...`,
            link_url: '/notices',
          });
        }
      }
    }

    return NextResponse.json({ success: true, notice });
  } catch (err) {
    return handleApiError(err);
  }
}

