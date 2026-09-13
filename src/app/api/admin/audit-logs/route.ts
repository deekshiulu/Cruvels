import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const { searchParams } = new URL(req.url);

    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    const logs = await dataStore.listAuditLogs({ limit });

    return NextResponse.json({
      success: true,
      logs,
      total: logs.length,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
