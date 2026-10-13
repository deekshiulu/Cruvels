import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import {
  resolveRedirectUri,
  exchangeGoogleCodeForTokens,
  fetchGoogleUserEmail,
  fetchGoogleCalendarEvents,
  mapGoogleItemsToScheduleEvents,
} from '@/lib/calendar/google-oauth';
import { logAuditEvent } from '@/lib/audit/logger';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');

  // Handle user declining permissions
  if (error || !code) {
    const errorMsg = error || 'Authorization was cancelled';
    console.warn('[Google OAuth Callback Cancelled]:', errorMsg);
    return NextResponse.redirect(
      new URL(`/schedule?error=${encodeURIComponent(errorMsg)}`, req.url)
    );
  }

  try {
    // 1. Identify current authenticated user (from session cookie or OAuth state parameter)
    const session = await getAuthenticatedSession(req);
    const userId = session?.id || state;

    if (!userId) {
      return NextResponse.redirect(
        new URL('/login?error=Session+expired.+Please+log+in+again.', req.url)
      );
    }

    // 2. Exchange authorization code for tokens
    const redirectUri = resolveRedirectUri(req);
    const tokenData = await exchangeGoogleCodeForTokens(code, redirectUri);

    // 3. Fetch user's Google account email address
    const googleEmail = (await fetchGoogleUserEmail(tokenData.access_token)) || 'google_user@gmail.com';

    // 4. Calculate expiration timestamp
    const expiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000;

    // 5. Securely persist tokens in database
    await dataStore.saveUserCalendarIntegration({
      userId,
      provider: 'google',
      accountEmail: googleEmail,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt,
      scope: tokenData.scope,
    });

    await logAuditEvent({
      userId,
      action: 'CALENDAR_OAUTH_LINKED',
      resourceType: 'GOOGLE_CALENDAR',
      metadata: { email: googleEmail },
      req,
    });

    // 6. Instantly pull and sync real upcoming events from Google Calendar
    try {
      const rawEvents = await fetchGoogleCalendarEvents(tokenData.access_token);
      const scheduleEvents = mapGoogleItemsToScheduleEvents(rawEvents, userId, googleEmail);
      if (scheduleEvents.length > 0) {
        await dataStore.upsertScheduleEvents(scheduleEvents);
      }
    } catch (syncErr) {
      console.error('[Google Initial Event Fetch Warning]:', syncErr);
    }

    // 7. Smooth top-level redirect back to the schedule page (Seamless for Flutter WebView)
    return NextResponse.redirect(
      new URL('/schedule?synced=google&status=success', req.url)
    );
  } catch (err: any) {
    console.error('[Google OAuth Callback Error]:', err);
    return NextResponse.redirect(
      new URL(`/schedule?error=${encodeURIComponent(err?.message || 'OAuth exchange failed')}`, req.url)
    );
  }
}
