import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
    void import('@/lib/services/compliance-scheduler')
      .then((m) => m.startAttendanceReminderScheduler())
      .catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    service: 'cruvels-portal',
    ts: new Date().toISOString(),
  });
}
