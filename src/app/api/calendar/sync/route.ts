import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { syncCalendarIntegration, syncSampleCalendars } from '@/lib/calendar/sync-service';

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

    // Check if sample demo sync is requested
    if (body?.sample) {
      const result = await syncSampleCalendars(user.id);
      return NextResponse.json({
        success: true,
        message: `Sample Google Meet & Teams meetings synced! Added: ${result.added}, Updated: ${result.updated}`,
        added: result.added,
        updated: result.updated,
      });
    }

    const integrations = await dataStore.getUserCalendarIntegrations(user.id);
    if (integrations.length === 0) {
      // If user has no integrations configured yet, automatically seed sample Google & Teams meetings
      const result = await syncSampleCalendars(user.id);
      return NextResponse.json({
        success: true,
        message: `Connected sample Google Calendar & Microsoft Teams feeds! Added: ${result.added} meetings.`,
        added: result.added,
        updated: result.updated,
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
