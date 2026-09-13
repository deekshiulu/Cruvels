import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const stats = await dataStore.getDashboardStats(user.id);

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
