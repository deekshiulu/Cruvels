import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';

const PurgeSchema = z.object({
  target: z.enum(['audit_logs', 'trash_messages', 'old_messages']),
  daysThreshold: z.number().int().min(1).max(365).default(30),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const stats = await dataStore.getStorageStats();
    return NextResponse.json({ success: true, stats });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const body = await req.json();
    const parsed = PurgeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid maintenance parameters.', success: false },
        { status: 400 }
      );
    }

    const { target, daysThreshold } = parsed.data;
    let purgedCount = 0;

    if (target === 'audit_logs') {
      const res = await dataStore.purgeOldAuditLogs(daysThreshold);
      purgedCount = res.purgedCount;
    } else if (target === 'trash_messages') {
      const res = await dataStore.purgeOldMessages(daysThreshold, 'trash');
      purgedCount = res.purgedCount;
    } else if (target === 'old_messages') {
      const res = await dataStore.purgeOldMessages(daysThreshold);
      purgedCount = res.purgedCount;
    }

    await logAuditEvent({
      userId: admin.id,
      action: 'ADMIN_STORAGE_PURGE',
      resourceType: 'STORAGE_MAINTENANCE',
      metadata: { target, daysThreshold, purgedCount },
      req,
    });

    const updatedStats = await dataStore.getStorageStats();

    return NextResponse.json({
      success: true,
      message: `Successfully purged ${purgedCount} items from ${target}.`,
      purgedCount,
      stats: updatedStats,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
