import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';

const SubscribeSchema = z.object({
  endpoint: z.string().url('Invalid push endpoint URL'),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  deviceName: z.string().max(80).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const body = await req.json();
    const parsed = SubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid subscription data.', success: false },
        { status: 400 }
      );
    }

    if (parsed.data.endpoint.includes('push.browser/') || parsed.data.keys.p256dh === 'browser-key') {
      return NextResponse.json({ error: 'Invalid push subscription.', success: false }, { status: 400 });
    }

    const sub = await dataStore.savePushSubscription(user.id, parsed.data);

    await logAuditEvent({
      userId: user.id,
      action: 'DEVICE_NOTIFICATIONS_LINKED',
      resourceType: 'PUSH_SUBSCRIPTION',
      resourceId: sub.id,
      metadata: { device: sub.device_name },
      req,
    });

    return NextResponse.json({
      success: true,
      message: 'Device linked for real-time notifications.',
      subscription: sub,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
