import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';
import { runIncrementalEmailSync } from '@/lib/email/sync';

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const query = searchParams.get('q') || '';
    const isReadParam = searchParams.get('isRead');
    const isRead = isReadParam !== null ? isReadParam === 'true' : undefined;

    const { messages, total } = await dataStore.getMessagesByOwner(user.id, {
      folder: 'inbox',
      isRead,
      query,
      page,
      limit,
    });

    if (page === 1 && !query && (process.env.EMAIL_SYNC_ON_READ === 'true' || searchParams.get('sync') === 'true')) {
      runIncrementalEmailSync(false).catch(() => {});
    }

    // Compute unread count in inbox
    const allInbox = await dataStore.getMessagesByOwner(user.id, { folder: 'inbox', isRead: false, limit: 1000 });
    const unreadCount = allInbox.total;

    if (query) {
      await logAuditEvent({
        userId: user.id,
        action: 'SEARCH_MESSAGES',
        resourceType: 'SEARCH',
        metadata: { queryLength: query.length, resultCount: total },
        req,
      });
    }

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
