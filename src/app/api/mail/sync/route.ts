import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { runIncrementalEmailSync } from '@/lib/email/sync';
import { checkRateLimit } from '@/lib/security/rate-limit';

function isCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}

async function runSync(force: boolean) {
  const syncResult = await runIncrementalEmailSync(force);
  return NextResponse.json({
    success: syncResult.success,
    data: syncResult,
  });
}

export async function GET(req: NextRequest) {
  try {
    if (!isCronRequest(req)) {
      return NextResponse.json({ error: 'Unauthorized.', success: false }, { status: 401 });
    }
    return await runSync(true);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    if (isCronRequest(req)) {
      return await runSync(true);
    }

    const user = await requireActiveUser(req);
    const rateCheck = await checkRateLimit(`sync:${user.id}`, 4, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Sync requests are throttled. Please wait a few seconds.', success: false },
        { status: 429 }
      );
    }

    return await runSync(true);
  } catch (err) {
    return handleApiError(err);
  }
}
