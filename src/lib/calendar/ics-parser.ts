export interface ParsedIcsEvent {
  uid: string;
  external_event_id: string;
  title: string;
  description: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  start_time: string; // ISO string
  end_time: string; // ISO string
  location?: string;
  meetingLink?: string;
  meeting_link?: string;
  provider: 'google' | 'microsoft' | 'external';
  source: 'google' | 'microsoft' | 'external';
  sync_provider: 'google' | 'microsoft' | 'external';
  sync_account_email?: string;
}

/**
 * Decodes escaped characters in iCalendar text (RFC 5545)
 */
function unescapeIcsText(text: string): string {
  return text
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/**
 * Extracts Google Meet or Microsoft Teams links from any text block or location
 */
export function extractMeetingLink(text?: string, location?: string): string | undefined {
  const combined = `${text || ''} ${location || ''}`.trim();
  if (!combined) return undefined;
  
  // Google Meet
  const googleMeetMatch = combined.match(/https:\/\/meet\.google\.com\/[a-z0-9-]+/i);
  if (googleMeetMatch) return googleMeetMatch[0];

  // Microsoft Teams
  const teamsMatch = combined.match(/https:\/\/(?:teams\.microsoft\.com|teams\.live\.com)\/[^\s"<>]+/i);
  if (teamsMatch) return teamsMatch[0];

  // Zoom / Generic Webex fallback
  const genericMatch = combined.match(/https:\/\/[a-z0-9-]+\.(?:zoom\.us|webex\.com)\/[^\s"<>]+/i);
  if (genericMatch) return genericMatch[0];

  return undefined;
}

/**
 * Parses iCalendar date formats into ISO 8601 strings
 * Supports:
 * - 20260917T090000Z (UTC)
 * - 20260917T090000 (Local / floating)
 * - 20260917 (All day)
 */
export function parseIcsDate(rawDateStr: string): string {
  const clean = rawDateStr.trim();
  
  // All day: YYYYMMDD
  if (/^\d{8}$/.test(clean)) {
    const y = clean.substring(0, 4);
    const m = clean.substring(4, 6);
    const d = clean.substring(6, 8);
    return new Date(`${y}-${m}-${d}T00:00:00.000Z`).toISOString();
  }

  // UTC: YYYYMMDDTHHMMSSZ
  const utcMatch = clean.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (utcMatch) {
    const [, y, m, d, hh, mm, ss] = utcMatch;
    return new Date(Date.UTC(+y, +m - 1, +d, +hh, +mm, +ss)).toISOString();
  }

  // Floating / TZ: YYYYMMDDTHHMMSS
  const localMatch = clean.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (localMatch) {
    const [, y, m, d, hh, mm, ss] = localMatch;
    // Default to IST (+05:30) for enterprise local events if unspecified
    const isoStr = `${y}-${m}-${d}T${hh}:${mm}:${ss}+05:30`;
    const dt = new Date(isoStr);
    return !isNaN(dt.getTime()) ? dt.toISOString() : new Date().toISOString();
  }

  const parsed = new Date(clean);
  return !isNaN(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
}

/**
 * Parses raw iCalendar (ICS) RFC 5545 feed into structured ParsedIcsEvent items
 */
export function parseIcsContent(
  icsContent: string,
  defaultProvider: 'google' | 'microsoft' | 'external' = 'external',
  accountEmail?: string
): ParsedIcsEvent[] {
  if (!icsContent || typeof icsContent !== 'string') return [];

  // 1. Unfold lines according to RFC 5545 (lines starting with space or tab belong to previous line)
  const unfolded = icsContent.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  const events: ParsedIcsEvent[] = [];
  let currentEvent: Record<string, string> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'BEGIN:VEVENT') {
      currentEvent = {};
      continue;
    }

    if (trimmed === 'END:VEVENT') {
      if (currentEvent && currentEvent.UID) {
        const uid = currentEvent.UID;
        const title = unescapeIcsText(currentEvent.SUMMARY || 'Untitled Event');
        const description = unescapeIcsText(currentEvent.DESCRIPTION || '');
        const location = unescapeIcsText(currentEvent.LOCATION || '');
        const url = currentEvent.URL || '';

        const rawStart = currentEvent.DTSTART || currentEvent['DTSTART;VALUE=DATE'] || '';
        const rawEnd = currentEvent.DTEND || currentEvent['DTEND;VALUE=DATE'] || rawStart;

        const startTime = parseIcsDate(rawStart);
        let endTime = parseIcsDate(rawEnd);

        // Fallback: If end time equals or precedes start time, add 30 mins
        if (new Date(endTime).getTime() <= new Date(startTime).getTime()) {
          endTime = new Date(new Date(startTime).getTime() + 30 * 60 * 1000).toISOString();
        }

        // Meeting Link detection
        const meetingLink = extractMeetingLink(description, `${url} ${location}`);

        // Provider heuristic detection
        let provider = defaultProvider;
        if (meetingLink?.includes('meet.google.com') || uid.includes('google.com') || icsContent.includes('Google Calendar')) {
          provider = 'google';
        } else if (
          meetingLink?.includes('teams.microsoft.com') ||
          meetingLink?.includes('teams.live.com') ||
          uid.includes('teams') ||
          uid.includes('outlook.com') ||
          icsContent.includes('Microsoft Exchange')
        ) {
          provider = 'microsoft';
        }

        events.push({
          uid,
          external_event_id: uid,
          title,
          description,
          startTime,
          endTime,
          start_time: startTime,
          end_time: endTime,
          location: location || undefined,
          meetingLink,
          meeting_link: meetingLink,
          provider,
          source: provider,
          sync_provider: provider,
          sync_account_email: accountEmail,
        });
      }
      currentEvent = null;
      continue;
    }

    if (!currentEvent) continue;

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex <= 0) continue;

    const propHeader = trimmed.substring(0, colonIndex);
    const propValue = trimmed.substring(colonIndex + 1);

    // Normalize property name (strip parameters e.g. DTSTART;TZID=... -> DTSTART)
    const basePropName = propHeader.split(';')[0].toUpperCase();

    if (basePropName === 'UID') {
      currentEvent.UID = propValue;
    } else if (basePropName === 'SUMMARY') {
      currentEvent.SUMMARY = propValue;
    } else if (basePropName === 'DESCRIPTION') {
      currentEvent.DESCRIPTION = propValue;
    } else if (basePropName === 'LOCATION') {
      currentEvent.LOCATION = propValue;
    } else if (basePropName === 'URL') {
      currentEvent.URL = propValue;
    } else if (basePropName === 'DTSTART') {
      currentEvent.DTSTART = propValue;
    } else if (basePropName === 'DTEND') {
      currentEvent.DTEND = propValue;
    }
  }

  return events;
}
