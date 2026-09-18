import { dataStore } from '../db/store';
import { ScheduleEvent, UserCalendarIntegration } from '../db/types';
import { parseIcsContent, ParsedIcsEvent } from './ics-parser';

export interface CalendarSyncResult {
  success: boolean;
  provider: string;
  feedUrl?: string;
  totalFetched: number;
  added: number;
  updated: number;
  error?: string;
}

/**
 * Fetches an external iCal (.ics) feed URL securely
 */
async function fetchIcsFeed(feedUrl: string): Promise<string> {
  // Translate webcal:// to https://
  const cleanUrl = feedUrl.trim().replace(/^webcal:\/\//i, 'https://');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const res = await fetch(cleanUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Cruvels-Enterprise-Calendar-Sync/1.0',
        Accept: 'text/calendar, text/plain, */*',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const text = await res.text();
    // Safety check: cap at 5MB
    if (text.length > 5 * 1024 * 1024) {
      throw new Error('Calendar feed exceeds maximum allowed size (5MB).');
    }

    return text;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Synchronizes an individual calendar integration for a user
 */
export async function syncCalendarIntegration(
  integration: UserCalendarIntegration,
  userId: string
): Promise<CalendarSyncResult> {
  if (!integration.feed_url) {
    return {
      success: false,
      provider: integration.provider,
      totalFetched: 0,
      added: 0,
      updated: 0,
      error: 'No feed URL provided for this integration.',
    };
  }

  try {
    const icsContent = await fetchIcsFeed(integration.feed_url);
    const parsedEvents: ParsedIcsEvent[] = parseIcsContent(icsContent, integration.provider);

    const scheduleEventsToUpsert: Omit<ScheduleEvent, 'id' | 'created_at'>[] = parsedEvents.map((ev) => ({
      title: ev.title,
      description: ev.description,
      event_type: 'meeting',
      start_time: ev.startTime,
      end_time: ev.endTime,
      location: ev.location || (ev.provider === 'google' ? 'Google Meet' : 'Microsoft Teams'),
      attendee_ids: [userId],
      created_by: userId,
      source: ev.provider,
      external_event_id: ev.uid,
      meeting_link: ev.meetingLink,
      sync_provider: ev.provider === 'external' ? integration.provider : ev.provider,
      sync_account_email: integration.account_email,
    }));

    const { added, updated } = await dataStore.upsertScheduleEvents(scheduleEventsToUpsert);

    // Update integration last_synced_at
    await dataStore.saveUserCalendarIntegration({
      userId,
      provider: integration.provider,
      accountEmail: integration.account_email,
      feedUrl: integration.feed_url,
    });

    return {
      success: true,
      provider: integration.provider,
      feedUrl: integration.feed_url,
      totalFetched: parsedEvents.length,
      added,
      updated,
    };
  } catch (err: any) {
    return {
      success: false,
      provider: integration.provider,
      feedUrl: integration.feed_url,
      totalFetched: 0,
      added: 0,
      updated: 0,
      error: err?.message || 'Failed to fetch and parse external calendar.',
    };
  }
}

/**
 * Pre-populates realistic Google Calendar and Microsoft Teams sample meetings
 * into the user's schedule for immediate testing and demonstration.
 */
export async function syncSampleCalendars(
  userId: string,
  userEmail?: string
): Promise<{ success: boolean; eventsSynced: number; added: number; updated: number }> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const today = now.getDate();

  // Helper to format ISO
  const toIso = (dayOffset: number, hour: number, minute: number) => {
    const d = new Date(year, month, today + dayOffset, hour, minute, 0);
    return d.toISOString();
  };

  const sampleEvents: Omit<ScheduleEvent, 'id' | 'created_at'>[] = [
    {
      title: 'Daily Engineering Standup (Google Meet)',
      description: 'Morning sync with core platform squad. Agenda: Sprint blockers and PR reviews.',
      event_type: 'meeting',
      start_time: toIso(0, 10, 0),
      end_time: toIso(0, 10, 30),
      location: 'Google Meet',
      attendee_ids: [userId],
      created_by: userId,
      source: 'google',
      external_event_id: `gcal_standup_${year}_${month}_${today}`,
      meeting_link: 'https://meet.google.com/abc-cruv-xyz',
      sync_provider: 'google',
      sync_account_email: 'workplace@gmail.com',
    },
    {
      title: 'Cross-Functional Sprint Alignment (Microsoft Teams)',
      description: 'Product roadmap review and architectural deliverables with Tech Leads.',
      event_type: 'meeting',
      start_time: toIso(0, 15, 0),
      end_time: toIso(0, 16, 0),
      location: 'Microsoft Teams',
      attendee_ids: [userId],
      created_by: userId,
      source: 'microsoft',
      external_event_id: `teams_sprint_${year}_${month}_${today}`,
      meeting_link: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_cruvels_demo',
      sync_provider: 'microsoft',
      sync_account_email: 'engineer@cruvels.onmicrosoft.com',
    },
    {
      title: 'Architecture & Security Review (Google Meet)',
      description: 'Review zero-trust IDOR controls and attendance rate-limiting metrics.',
      event_type: 'meeting',
      start_time: toIso(1, 11, 0),
      end_time: toIso(1, 12, 0),
      location: 'Google Meet',
      attendee_ids: [userId],
      created_by: userId,
      source: 'google',
      external_event_id: `gcal_sec_review_${year}_${month}_${today + 1}`,
      meeting_link: 'https://meet.google.com/sec-cruv-mtg',
      sync_provider: 'google',
      sync_account_email: 'workplace@gmail.com',
    },
    {
      title: 'Company All-Hands / Monthly Townhall (Microsoft Teams)',
      description: 'Cruvels monthly company-wide townhall, executive updates, and Q&A.',
      event_type: 'meeting',
      start_time: toIso(2, 16, 30),
      end_time: toIso(2, 17, 30),
      location: 'Microsoft Teams',
      attendee_ids: [userId],
      created_by: userId,
      source: 'microsoft',
      external_event_id: `teams_townhall_${year}_${month}_${today + 2}`,
      meeting_link: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_townhall_demo',
      sync_provider: 'microsoft',
      sync_account_email: 'engineer@cruvels.onmicrosoft.com',
    },
  ];

  // Also record mock integrations so they show in user's connected accounts
  await dataStore.saveUserCalendarIntegration({
    userId,
    provider: 'google',
    accountEmail: 'workplace@gmail.com',
    feedUrl: 'https://calendar.google.com/calendar/ical/demo/basic.ics',
  });

  await dataStore.saveUserCalendarIntegration({
    userId,
    provider: 'microsoft',
    accountEmail: 'engineer@cruvels.onmicrosoft.com',
    feedUrl: 'https://outlook.office365.com/owa/calendar/demo/reachcalendar.ics',
  });

  const { added, updated } = await dataStore.upsertScheduleEvents(sampleEvents);
  return {
    success: true,
    eventsSynced: added + updated,
    added,
    updated,
  };
}
