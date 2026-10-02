import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { dataStore } from '@/lib/db/store';
import { GET as getPreferencesRoute, PATCH as patchPreferencesRoute } from '@/app/api/profile/preferences/route';
import { PATCH as updateNotificationStateRoute } from '@/app/api/notifications/[id]/state/route';
import { createSessionToken } from '@/lib/auth/session';

function makeAuthRequest(path: string, options: { method?: string; body?: any; token?: string }) {
  const headers = new Headers();
  headers.set('host', 'localhost:3005');
  headers.set('Content-Type', 'application/json');
  if (options.token) {
    headers.set('cookie', `cruvels_session=${options.token}`);
  }

  const init: RequestInit = {
    method: options.method || 'GET',
    headers,
  };
  if (options.body) {
    init.body = JSON.stringify(options.body);
  }

  return new NextRequest(`http://localhost:3005${path}`, init as any);
}

describe('Phase 3: Centralized Notification Center & Preferences (§§ 10, 11)', () => {
  let internUser: any;
  let adminUser: any;
  let internToken: string;
  let adminToken: string;

  beforeEach(async () => {
    dataStore.resetAndSeed();
    internUser = await dataStore.getUserByUsername('rahul');
    adminUser = await dataStore.getUserByUsername('admin');
    internToken = await createSessionToken(internUser, ['rahul@cruvels.com']);
    adminToken = await createSessionToken(adminUser, ['admin@cruvels.com']);
  });

  describe('Store Layer: Notification Preferences & Defaults', () => {
    it('returns default notification preferences for a user without stored preferences', async () => {
      const prefs = await dataStore.getNotificationPreferences(internUser.id);
      expect(prefs).toBeDefined();
      expect(prefs.portal_notifications).toBe(true);
      expect(prefs.email_notifications).toBe(true);
      expect(prefs.push_notifications).toBe(true);
      expect(prefs.task_reminders).toBe(true);
      expect(prefs.announcements).toBe(true);
    });

    it('updates and persists user notification preferences', async () => {
      const updated = await dataStore.updateNotificationPreferences(internUser.id, {
        portal_notifications: true,
        email_notifications: false,
        task_reminders: false,
      });

      expect(updated.email_notifications).toBe(false);
      expect(updated.task_reminders).toBe(false);
      expect(updated.portal_notifications).toBe(true);

      const reloaded = await dataStore.getNotificationPreferences(internUser.id);
      expect(reloaded.email_notifications).toBe(false);
      expect(reloaded.task_reminders).toBe(false);
    });
  });

  describe('Store Layer: Notification States & Filtering', () => {
    it('creates notification with action_required state for compliance/acknowledgement categories', async () => {
      const notif = await dataStore.createNotification({
        user_id: internUser.id,
        type: 'attendance_missing',
        title: 'Action Needed: Attendance Missing',
        message: 'Please punch in before 11:00 AM.',
        category: 'attendance_missing',
        link_url: '/attendance',
      });

      expect(notif.state).toBe('action_required');
      expect(notif.action_label).toBe('Punch Attendance');
    });

    it('updates notification state from action_required to acknowledged', async () => {
      const notif = await dataStore.createNotification({
        user_id: internUser.id,
        type: 'acknowledgement_required',
        title: 'Mandatory Policy Acknowledged',
        message: 'Security policy requires acknowledgement.',
        category: 'acknowledgement_required',
        link_url: '/notices',
      });

      expect(notif.state).toBe('action_required');

      const updated = await dataStore.updateNotificationState(notif.id, internUser.id, 'acknowledged');
      expect(updated).toBeDefined();
      expect(updated?.state).toBe('acknowledged');

      const retrieved = await dataStore.getNotifications(internUser.id);
      const target = retrieved.find((n) => n.id === notif.id);
      expect(target?.state).toBe('acknowledged');
    });

    it('filters notifications by state and category', async () => {
      await dataStore.createNotification({
        user_id: internUser.id,
        type: 'task',
        title: 'Task Alpha',
        message: 'Normal task',
        category: 'task',
        state: 'unread',
      });

      await dataStore.createNotification({
        user_id: internUser.id,
        type: 'attendance_missing',
        title: 'Attendance Alert',
        message: 'Missing attendance',
        category: 'attendance_missing',
        state: 'action_required',
      });

      const unreadTasks = await dataStore.getNotifications(internUser.id, { state: 'unread', category: 'task' });
      expect(unreadTasks.length).toBeGreaterThanOrEqual(1);
      expect(unreadTasks.every((n) => n.category === 'task' && n.state === 'unread')).toBe(true);

      const actionRequired = await dataStore.getNotifications(internUser.id, { state: 'action_required' });
      expect(actionRequired.length).toBeGreaterThanOrEqual(1);
      expect(actionRequired.every((n) => n.state === 'action_required')).toBe(true);
    });
  });

  describe('API Endpoints: Preferences & State Management', () => {
    it('GET /api/profile/preferences returns preferences and compliance immutable locks', async () => {
      const req = makeAuthRequest('/api/profile/preferences', {
        method: 'GET',
        token: internToken,
      });

      const res = await getPreferencesRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.preferences).toBeDefined();
      expect(json.immutableLocks.attendance_compliance).toBe(true);
      expect(json.immutableLocks.security_alerts).toBe(true);
    });

    it('PATCH /api/profile/preferences updates preferences and preserves compliance lock', async () => {
      const req = makeAuthRequest('/api/profile/preferences', {
        method: 'PATCH',
        token: internToken,
        body: {
          email_notifications: false,
          announcements: false,
        },
      });

      const res = await patchPreferencesRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.preferences.email_notifications).toBe(false);
      expect(json.preferences.announcements).toBe(false);
      expect(json.immutableLocks.attendance_compliance).toBe(true);
    });

    it('PATCH /api/notifications/[id]/state transitions notification state for the owner', async () => {
      const notif = await dataStore.createNotification({
        user_id: internUser.id,
        type: 'task',
        title: 'Complete Sprint Task',
        message: 'Deliver before end of day.',
        category: 'task',
        state: 'action_required',
      });

      const req = makeAuthRequest(`/api/notifications/${notif.id}/state`, {
        method: 'PATCH',
        token: internToken,
        body: { state: 'acknowledged' },
      });

      const res = await updateNotificationStateRoute(req, {
        params: Promise.resolve({ id: notif.id }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.notification.state).toBe('acknowledged');
    });

    it('DENIES other users from mutating another users notification state', async () => {
      const notif = await dataStore.createNotification({
        user_id: internUser.id,
        type: 'task',
        title: 'Private Intern Alert',
        message: 'Restricted notification.',
        category: 'task',
      });

      // Admin tries to mutate intern's notification state via endpoint
      const req = makeAuthRequest(`/api/notifications/${notif.id}/state`, {
        method: 'PATCH',
        token: adminToken,
        body: { state: 'read' },
      });

      const res = await updateNotificationStateRoute(req, {
        params: Promise.resolve({ id: notif.id }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });
});
