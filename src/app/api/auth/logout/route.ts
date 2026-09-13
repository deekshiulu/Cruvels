import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, parseCookies, verifySessionToken, clearSessionCookie } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';

export async function POST(req: NextRequest) {
  const cookies = parseCookies(req.headers.get('cookie'));
  const token = cookies[AUTH_COOKIE_NAME];

  if (token) {
    const session = await verifySessionToken(token);
    if (session) {
      await logAuditEvent({
        userId: session.id,
        action: 'LOGOUT',
        resourceType: 'AUTH',
        req,
      });
    }
  }

  const response = NextResponse.json({ success: true, message: 'Logged out successfully.' });
  clearSessionCookie(response);
  return response;
}
