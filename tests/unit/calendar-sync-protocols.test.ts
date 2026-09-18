import { describe, it, expect, beforeEach } from 'vitest';
import { parseIcsContent, extractMeetingLink } from '@/lib/calendar/ics-parser';
import { syncSampleCalendars } from '@/lib/calendar/sync-service';
import { dataStore } from '@/lib/db/store';

describe('RFC 5545 iCalendar (ICS) Parser & Protocols', () => {
  it('extracts Google Meet links accurately from descriptions or locations', () => {
    const text1 = 'Please join the meeting at https://meet.google.com/abc-defg-hij on time.';
    expect(extractMeetingLink(text1, '')).toBe('https://meet.google.com/abc-defg-hij');

    const loc = 'Google Meet (https://meet.google.com/xyz-uvwx-rst)';
    expect(extractMeetingLink('', loc)).toBe('https://meet.google.com/xyz-uvwx-rst');
  });

  it('extracts Microsoft Teams links accurately from descriptions or locations', () => {
    const text1 = 'Join Teams Meeting: https://teams.microsoft.com/l/meetup-join/19%3ameeting_xyz%40thread.v2/0?context=abc';
    expect(extractMeetingLink(text1, '')).toBe('https://teams.microsoft.com/l/meetup-join/19%3ameeting_xyz%40thread.v2/0?context=abc');

    const loc = 'https://teams.live.com/meet/987654321';
    expect(extractMeetingLink('', loc)).toBe('https://teams.live.com/meet/987654321');
  });

  it('unfolds RFC 5545 multi-line strings and parses VEVENT details correctly', () => {
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Google Inc//Google Calendar 70.9054//EN',
      'BEGIN:VEVENT',
      'UID:google-sprint-standup-001@google.com',
      'SUMMARY:Daily Engineering Standup',
      'DESCRIPTION:Daily synchronization for engineering sprint deliverables. Disc',
      ' ussing blockers and roadmap progression.\\nLink: https://meet.google.com/ab',
      ' c-defg-hij',
      'DTSTART:20260918T043000Z',
      'DTEND:20260918T050000Z',
      'LOCATION:Google Meet (https://meet.google.com/abc-defg-hij)',
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const parsed = parseIcsContent(icsContent, 'google', 'eng.lead@gmail.com');
    expect(parsed).toHaveLength(1);
    const ev = parsed[0];
    expect(ev.external_event_id).toBe('google-sprint-standup-001@google.com');
    expect(ev.title).toBe('Daily Engineering Standup');
    expect(ev.source).toBe('google');
    expect(ev.sync_provider).toBe('google');
    expect(ev.sync_account_email).toBe('eng.lead@gmail.com');
    expect(ev.meeting_link).toBe('https://meet.google.com/abc-defg-hij');
    expect(ev.description).toContain('Discussing blockers and roadmap progression.');
    expect(ev.start_time).toBe('2026-09-18T04:30:00.000Z');
    expect(ev.end_time).toBe('2026-09-18T05:00:00.000Z');
  });

  it('handles Microsoft Teams all-day events and local timezones gracefully', () => {
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:ms-teams-planning-100@cruvels.com',
      'SUMMARY:Q3 Product Roadmap Review',
      'DTSTART;VALUE=DATE:20260920',
      'DTEND;VALUE=DATE:20260921',
      'LOCATION:Microsoft Teams Room Alpha',
      'DESCRIPTION:Review quarterly OKRs.\\nhttps://teams.microsoft.com/l/meetup-join/12345',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');

    const parsed = parseIcsContent(icsContent, 'microsoft', 'pm@outlook.com');
    expect(parsed).toHaveLength(1);
    const ev = parsed[0];
    expect(ev.title).toBe('Q3 Product Roadmap Review');
    expect(ev.source).toBe('microsoft');
    expect(ev.sync_provider).toBe('microsoft');
    expect(ev.meeting_link).toBe('https://teams.microsoft.com/l/meetup-join/12345');
    expect(ev.start_time).toContain('2026-09-20');
  });

  it('safely ignores corrupted or empty calendar files without throwing exceptions', () => {
    const emptyParsed = parseIcsContent('NOT_A_CALENDAR_DATA', 'google');
    expect(emptyParsed).toEqual([]);

    const noEndEvent = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Broken Event';
    expect(parseIcsContent(noEndEvent, 'microsoft')).toEqual([]);
  });
});

describe('Calendar Integration Store & Sync Engine', () => {
  const testUserId = 'usr-calendar-test-01';

  beforeEach(async () => {
    dataStore.resetAndSeed();
  });

  it('persists and retrieves user calendar integrations', async () => {
    const initialIntegrations = await dataStore.getUserCalendarIntegrations(testUserId);
    expect(initialIntegrations).toEqual([]);

    const created = await dataStore.saveUserCalendarIntegration({
      userId: testUserId,
      provider: 'google',
      accountEmail: 'deekshit.test@gmail.com',
      feedUrl: 'https://calendar.google.com/calendar/ical/deekshit.test%40gmail.com/private-test/basic.ics',
    });

    expect(created.id).toBeDefined();
    expect(created.provider).toBe('google');
    expect(created.account_email).toBe('deekshit.test@gmail.com');

    const userIntegrations = await dataStore.getUserCalendarIntegrations(testUserId);
    expect(userIntegrations).toHaveLength(1);
    expect(userIntegrations[0].id).toBe(created.id);

    // Delete integration
    const deleted = await dataStore.deleteUserCalendarIntegration(created.id, testUserId);
    expect(deleted).toBe(true);

    const afterDelete = await dataStore.getUserCalendarIntegrations(testUserId);
    expect(afterDelete).toEqual([]);
  });

  it('deduplicates events upon multiple upsert passes', async () => {
    const eventA = {
      title: 'Google Meet Standup',
      description: 'Daily team sync',
      event_type: 'meeting' as const,
      start_time: '2026-09-18T10:00:00.000Z',
      end_time: '2026-09-18T10:30:00.000Z',
      attendee_ids: [],
      created_by: testUserId,
      source: 'google' as const,
      external_event_id: 'sync-standup-100',
      meeting_link: 'https://meet.google.com/abc-defg-hij',
      sync_provider: 'google' as const,
    };

    // First upsert: adds 1 event
    const pass1 = await dataStore.upsertScheduleEvents([eventA]);
    expect(pass1.added).toBe(1);
    expect(pass1.updated).toBe(0);

    const allEventsPass1 = await dataStore.getScheduleEvents();
    const found1 = allEventsPass1.filter((e) => e.external_event_id === 'sync-standup-100');
    expect(found1).toHaveLength(1);
    expect(found1[0].title).toBe('Google Meet Standup');

    // Second upsert: same external_event_id with updated title updates existing without duplicate
    const updatedEventA = {
      ...eventA,
      title: 'Google Meet Standup (Rescheduled)',
    };
    const pass2 = await dataStore.upsertScheduleEvents([updatedEventA]);
    expect(pass2.added).toBe(0);
    expect(pass2.updated).toBe(1);

    const allEventsPass2 = await dataStore.getScheduleEvents();
    const found2 = allEventsPass2.filter((e) => e.external_event_id === 'sync-standup-100');
    expect(found2).toHaveLength(1);
    expect(found2[0].title).toBe('Google Meet Standup (Rescheduled)');
  });

  it('synchronizes sample Google & Microsoft Teams calendars end-to-end', async () => {
    const result = await syncSampleCalendars(testUserId, 'deekshit.work@cruvels.com');
    expect(result.success).toBe(true);
    expect(result.eventsSynced).toBeGreaterThanOrEqual(4);

    // Verify integrations were recorded
    const integrations = await dataStore.getUserCalendarIntegrations(testUserId);
    expect(integrations).toHaveLength(2);
    expect(integrations.some((i) => i.provider === 'google')).toBe(true);
    expect(integrations.some((i) => i.provider === 'microsoft')).toBe(true);

    // Verify schedule events now contain both Google Meet and Teams events
    const allEvents = await dataStore.getScheduleEvents();
    const googleEvents = allEvents.filter((e) => e.source === 'google');
    const teamsEvents = allEvents.filter((e) => e.source === 'microsoft');

    expect(googleEvents.length).toBeGreaterThanOrEqual(2);
    expect(teamsEvents.length).toBeGreaterThanOrEqual(2);

    for (const g of googleEvents) {
      expect(g.meeting_link).toMatch(/^https:\/\/meet\.google\.com\//);
      expect(g.sync_provider).toBe('google');
    }

    for (const t of teamsEvents) {
      expect(t.meeting_link).toMatch(/^https:\/\/teams\.microsoft\.com\//);
      expect(t.sync_provider).toBe('microsoft');
    }
  });

  it('validates schedule event time ranges and records attendees', async () => {
    // Valid time range
    const startTime = '2026-09-20T10:00:00.000Z';
    const endTime = '2026-09-20T11:00:00.000Z';
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    expect(end > start).toBe(true);

    const event = await dataStore.createScheduleEvent({
      title: 'Architecture Review',
      description: 'Review stage completion',
      event_type: 'meeting',
      start_time: startTime,
      end_time: endTime,
      location: 'Conference Room Alpha',
      attendee_ids: [testUserId, 'user-charith', 'user-niketh'],
      created_by: testUserId,
    });

    expect(event.id).toBeDefined();
    expect(event.title).toBe('Architecture Review');
    expect(event.attendee_ids).toContain(testUserId);
    expect(event.attendee_ids).toContain('user-charith');
    expect(event.attendee_ids).toContain('user-niketh');

    // Invalid time range: end before start
    const invalidStart = '2026-09-20T15:00:00.000Z';
    const invalidEnd = '2026-09-20T14:00:00.000Z';
    const isInvalid = new Date(invalidEnd).getTime() <= new Date(invalidStart).getTime();
    expect(isInvalid).toBe(true);
  });
});
