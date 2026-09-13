import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';

const CreateNoticeSchema = z.object({
  title: z.string().min(3).max(150),
  content: z.string().min(5).max(2000),
  category: z.enum(['General', 'Urgent', 'Event', 'Policy', 'Engineering']).default('General'),
  isPinned: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  try {
    await requireActiveUser(req);
    const notices = await dataStore.getNotices();
    return NextResponse.json({ success: true, notices });
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

    const { title, content, category, isPinned } = parseRes.data;
    const notice = await dataStore.createNotice({
      title,
      content,
      category,
      is_pinned: isPinned,
      author_id: user.id,
      author_name: user.name,
    });

    await logAuditEvent({
      userId: user.id,
      action: 'NOTICE_PUBLISHED',
      resourceType: 'NOTICE',
      resourceId: notice.id,
      metadata: { title, category, isPinned },
      req,
    });

    // Broadcast notification to all active employees
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

    return NextResponse.json({ success: true, notice });
  } catch (err) {
    return handleApiError(err);
  }
}
