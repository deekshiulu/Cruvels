import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { syncGoogleHolidays } from '@/lib/calendar/sync-service';
import {
  buildGoogleAuthUrl,
  resolveRedirectUri,
  refreshGoogleAccessToken,
  fetchGoogleCalendarEvents,
  mapGoogleItemsToScheduleEvents,
} from '@/lib/calendar/google-oauth';

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);

    // Rate limiting: 10 sync requests per minute per user
    const rateCheck = await checkRateLimit(`cal_sync:${user.id}`, 10, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Calendar sync requests are throttled. Please wait a few moments.', success: false },
        { status: 429 }
      );
    }

    // 1. Check if user has connected Google Calendar via OAuth2
    const googleIntegration = await dataStore.getUserCalendarIntegration(user.id, 'google');

    // =========================================================================
    // IF NOT LINKED: Return 401 Unauthorized with requires_auth flag & OAuth URL
    // =========================================================================
    if (!googleIntegration || (!googleIntegration.access_token && !googleIntegration.refresh_token)) {
      const redirectUri = resolveRedirectUri(req);
      const authUrl = buildGoogleAuthUrl(user.id, redirectUri);

      return NextResponse.json(
        {
          success: false,
          requires_auth: true,
          provider: 'google',
          auth_url: authUrl,
          message: 'Google Calendar is not linked. Please authorize access to sync your live meetings.',
        },
        { status: 401 }
      );
    }

    // =========================================================================
    // IF LINKED: Check token validity, auto-refresh if expired, & fetch real events
    // =========================================================================
    let accessToken = googleIntegration.access_token;
    const isExpired = googleIntegration.expires_at
      ? Date.now() >= googleIntegration.expires_at - 60000 // Refresh if within 1 min of expiry
      : !accessToken;

    if (isExpired) {
      if (!googleIntegration.refresh_token) {
        // Refresh token missing, re-prompt consent
        const redirectUri = resolveRedirectUri(req);
        const authUrl = buildGoogleAuthUrl(user.id, redirectUri);
        return NextResponse.json(
          {
            success: false,
            requires_auth: true,
            provider: 'google',
            auth_url: authUrl,
            message: 'Your Google Calendar session has expired. Please re-authenticate.',
          },
          { status: 401 }
        );
      }

      try {
        const refreshed = await refreshGoogleAccessToken(googleIntegration.refresh_token);
        accessToken = refreshed.access_token;
        const newExpiresAt = Date.now() + (refreshed.expires_in || 3600) * 1000;

        await dataStore.saveUserCalendarIntegration({
          userId: user.id,
          provider: 'google',
          accountEmail: googleIntegration.account_email,
          accessToken,
          refreshToken: googleIntegration.refresh_token,
          expiresAt: newExpiresAt,
          scope: googleIntegration.scope,
        });
      } catch (refreshErr: any) {
        console.error('[Google Token Refresh Error]:', refreshErr);
        const redirectUri = resolveRedirectUri(req);
        const authUrl = buildGoogleAuthUrl(user.id, redirectUri);
        return NextResponse.json(
          {
            success: false,
            requires_auth: true,
            provider: 'google',
            auth_url: authUrl,
            error: 'Failed to refresh Google Calendar credentials. Please re-authenticate.',
          },
          { status: 401 }
        );
      }
    }

    if (!accessToken) {
      const redirectUri = resolveRedirectUri(req);
      return NextResponse.json(
        {
          success: false,
          requires_auth: true,
          provider: 'google',
          auth_url: buildGoogleAuthUrl(user.id, redirectUri),
        },
        { status: 401 }
      );
    }

    // 2. Fetch real live Google Calendar meetings & events
    const rawEvents = await fetchGoogleCalendarEvents(accessToken);
    const liveScheduleEvents = mapGoogleItemsToScheduleEvents(
      rawEvents,
      user.id,
      googleIntegration.account_email
    );

    // 3. Upsert real events into portal schedule
    let addedCount = 0;
    let updatedCount = 0;
    if (liveScheduleEvents.length > 0) {
      const upsertResult = await dataStore.upsertScheduleEvents(liveScheduleEvents);
      addedCount = upsertResult.added;
      updatedCount = upsertResult.updated;
    }

    // 4. Also synchronize official public holidays
    const holidayResult = await syncGoogleHolidays(user.id);

    // 5. Update last_synced_at timestamp on the integration
    await dataStore.saveUserCalendarIntegration({
      userId: user.id,
      provider: 'google',
      accountEmail: googleIntegration.account_email,
      accessToken,
      refreshToken: googleIntegration.refresh_token,
      expiresAt: googleIntegration.expires_at,
    });

    return NextResponse.json({
      success: true,
      provider: 'google',
      accountEmail: googleIntegration.account_email,
      message: `Google Calendar synchronized successfully! ${liveScheduleEvents.length} live meetings and ${holidayResult.totalHolidays} public holidays synced.`,
      eventsCount: liveScheduleEvents.length,
      holidaysCount: holidayResult.totalHolidays,
      added: addedCount,
      updated: updatedCount,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
