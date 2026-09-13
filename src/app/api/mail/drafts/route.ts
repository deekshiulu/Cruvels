import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const query = searchParams.get('q') || '';

    const { messages, total } = await dataStore.getMessagesByOwner(user.id, {
      folder: 'drafts',
      query,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      messages,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
