import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { getVapidPublicKey } from '@/lib/notifications/push';

export async function GET(req: NextRequest) {
  try {
    await requireActiveUser(req);
    return NextResponse.json({
      success: true,
      publicKey: await getVapidPublicKey(),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
