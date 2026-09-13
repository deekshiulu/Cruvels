import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { getEmailProvider } from '@/lib/email/provider';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const users = await dataStore.listUsers();
    const interns = users.filter((u) => u.role === 'intern' || u.role === 'employee');
    const activeInterns = interns.filter((u) => u.status === 'active');
    const disabledInterns = interns.filter((u) => u.status === 'disabled');

    const aliases = await dataStore.listAllAliases();
    const activeAliases = aliases.filter((a) => a.is_active);

    const allMessagesCount = await dataStore.countMessages();
    const totalSent = await dataStore.countMessages('sent');

    const recentAudits = await dataStore.listAuditLogs({ limit: 10 });
    const provider = getEmailProvider();
    const checkpoint = await dataStore.getCheckpoint(provider.name);

    return NextResponse.json({
      success: true,
      stats: {
        totalInterns: interns.length,
        activeInterns: activeInterns.length,
        disabledInterns: disabledInterns.length,
        totalAliases: activeAliases.length,
        totalMessages: allMessagesCount,
        totalSent,
        provider: provider.name,
        syncStatus: checkpoint?.status || 'idle',
        lastSyncedAt: checkpoint?.last_sync_timestamp || null,
        recentAudits,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
