import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';

const MarkReadSchema = z.object({
  id: z.string().optional(),
  all: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '30', 10);
    const isReadParam = searchParams.get('isRead');
    const isRead = isReadParam !== null ? isReadParam === 'true' : undefined;

    const [notifications, unreadCount] = await Promise.all([
      dataStore.getNotifications(user.id, { limit, isRead }),
      dataStore.getUnreadNotificationsCount(user.id),
    ]);

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const body = await req.json();
    const parsed = MarkReadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid parameters', success: false }, { status: 400 });
    }

    if (parsed.data.all) {
      const count = await dataStore.markAllNotificationsAsRead(user.id);
      return NextResponse.json({ success: true, markedCount: count });
    }

    if (parsed.data.id) {
      const ok = await dataStore.markNotificationAsRead(parsed.data.id, user.id);
      return NextResponse.json({ success: ok });
    }

    return NextResponse.json({ error: 'Specify notification id or all: true', success: false }, { status: 400 });
  } catch (err) {
    return handleApiError(err);
  }
}
