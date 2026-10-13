import { ScheduleEvent } from '../db/types';
import { extractMeetingLink } from './ics-parser';

export const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
].join(' ');

export function getGoogleClientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) {
    throw new Error('GOOGLE_CLIENT_ID is not configured in environment variables.');
  }
  return id;
}

export function getGoogleClientSecret(): string {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) {
    throw new Error('GOOGLE_CLIENT_SECRET is not configured in environment variables.');
  }
  return secret;
}

export function resolveRedirectUri(reqOrHost?: string | Request): string {
  if (reqOrHost && typeof reqOrHost === 'object' && 'headers' in reqOrHost) {
    const host = reqOrHost.headers.get('x-forwarded-host') || reqOrHost.headers.get('host');
    if (host) {
      const proto = reqOrHost.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
      return `${proto}://${host}/api/auth/callback/google`;
    }
  }

  if (typeof reqOrHost === 'string') {
    if (reqOrHost.startsWith('http')) return reqOrHost;
    const proto = reqOrHost.includes('localhost') ? 'http' : 'https';
    return `${proto}://${reqOrHost}/api/auth/callback/google`;
  }

  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3005';
  return `${base}/api/auth/callback/google`;
}

/**
 * Builds the official Google OAuth 2.0 Authorization URL
 */
export function buildGoogleAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_OAUTH_SCOPES,
    access_type: 'offline', // Mandatory to receive refresh_token
    prompt: 'consent',     // Forces consent screen so refresh_token is guaranteed
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchanges the authorization code received in callback for access and refresh tokens
 */
export async function exchangeGoogleCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
}> {
  const params = new URLSearchParams({
    code,
    client_id: getGoogleClientId(),
    client_secret: getGoogleClientSecret(),
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error_description || data.error || 'Failed to exchange authorization code with Google');
  }

  return data;
}

/**
 * Refreshes an expired Google access token using the stored refresh token
 */
export async function refreshGoogleAccessToken(
  refreshToken: string
): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    client_secret: getGoogleClientSecret(),
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error_description || data.error || 'Failed to refresh Google access token');
  }

  return {
    access_token: data.access_token,
    expires_in: data.expires_in || 3600,
  };
}

/**
 * Fetches user profile info (primary email address)
 */
export async function fetchGoogleUserEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.email || null;
  } catch {
    return null;
  }
}

/**
 * Fetches real events from the user's primary Google Calendar
 */
export async function fetchGoogleCalendarEvents(accessToken: string): Promise<any[]> {
  const timeMin = new Date(Date.now() - 30 * 86400000).toISOString(); // Past 30 days
  const timeMax = new Date(Date.now() + 90 * 86400000).toISOString(); // Next 90 days

  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  url.searchParams.set('timeMin', timeMin);
  url.searchParams.set('timeMax', timeMax);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', '250');

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || 'Failed to fetch events from Google Calendar API');
  }

  return data.items || [];
}

/**
 * Normalizes raw Google Calendar items into portal ScheduleEvent entities
 */
export function mapGoogleItemsToScheduleEvents(
  items: any[],
  userId: string,
  accountEmail?: string
): Omit<ScheduleEvent, 'id' | 'created_at'>[] {
  return items
    .filter((item) => item.status !== 'cancelled')
    .map((item) => {
      // Determine start and end time (handling all-day date vs dateTime)
      const startIso = item.start?.dateTime || (item.start?.date ? `${item.start.date}T00:00:00.000Z` : new Date().toISOString());
      const endIso = item.end?.dateTime || (item.end?.date ? `${item.end.date}T23:59:59.000Z` : startIso);

      // Extract meeting link from hangoutLink or location / description
      const meetingLink = item.hangoutLink || extractMeetingLink(item.description || '', item.location || '') || undefined;

      // Determine meeting platform badge
      let platform: 'google_meet' | 'zoom' | 'teams' | 'other' = 'google_meet';
      if (meetingLink?.includes('zoom.us')) platform = 'zoom';
      else if (meetingLink?.includes('teams.microsoft.com')) platform = 'teams';

      return {
        title: item.summary || '(Untitled Google Event)',
        description: item.description || '',
        event_type: 'meeting',
        start_time: startIso,
        end_time: endIso,
        location: item.location || (meetingLink ? 'Google Meet' : 'Online'),
        attendee_ids: [userId],
        created_by: userId,
        source: 'google',
        external_event_id: item.id,
        meeting_link: meetingLink,
        meeting_platform: platform,
        sync_provider: 'google',
        sync_account_email: accountEmail,
      };
    });
}
