import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { syncCalendarIntegration, syncSampleCalendars, syncGoogleHolidays } from '@/lib/calendar/sync-service';

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);

    // Rate limiting: 6 sync requests per minute per user
    const rateCheck = await checkRateLimit(`cal_sync:${user.id}`, 6, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Calendar sync requests are throttled. Please wait a few moments.', success: false },
        { status: 429 }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is acceptable
    }

    // Check if dedicated Google Calendar holidays sync was requested
    if (body?.action === 'sync_holidays') {
      const holidayResult = await syncGoogleHolidays(user.id);
      return NextResponse.json({
        success: true,
        message: `Google Calendar Public Holidays synced! Total: ${holidayResult.totalHolidays} holidays (${holidayResult.added} added, ${holidayResult.updated} updated).`,
        added: holidayResult.added,
        updated: holidayResult.updated,
        totalHolidays: holidayResult.totalHolidays,
      });
    }

    // Check if sample demo sync is requested
    if (body?.sample) {
      const result = await syncSampleCalendars(user.id, undefined, { includeHolidays: true });
      return NextResponse.json({
        success: true,
        message: `Google Calendar meetings & official public holidays synced! Added: ${result.added}, Updated: ${result.updated}`,
        added: result.added,
        updated: result.updated,
      });
    }

    const integrations = await dataStore.getUserCalendarIntegrations(user.id);
    if (integrations.length === 0) {
      const holidayResult = await syncGoogleHolidays(user.id);
      return NextResponse.json({
        success: true,
        message: `Official public holidays synced (${holidayResult.totalHolidays} holidays). Connect your Google Calendar or Microsoft Teams iCal URL below to sync your team meetings.`,
        added: holidayResult.added,
        updated: holidayResult.updated,
      });
    }

    let totalFetched = 0;
    let totalAdded = 0;
    let totalUpdated = 0;
    const results = [];

    for (const integration of integrations) {
      const res = await syncCalendarIntegration(integration, user.id);
      results.push(res);
      totalFetched += res.totalFetched;
      totalAdded += res.added;
      totalUpdated += res.updated;
    }

    return NextResponse.json({
      success: true,
      message: `Calendar synchronization completed. ${totalFetched} events evaluated (${totalAdded} added, ${totalUpdated} updated).`,
      results,
      totalFetched,
      totalAdded,
      totalUpdated,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
