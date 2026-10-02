import { describe, it, expect, beforeEach } from 'vitest';
import manifest from '@/app/manifest';
import fs from 'fs';
import path from 'path';
import { dataStore } from '@/lib/db/store';
import {
  getVapidPublicKey,
  dispatchAttendanceReminderPush,
  dispatchTaskAssignmentPush,
  dispatchMeetingAlertPush,
  sendWebPush,
  sendPushToSubscription,
} from '@/lib/notifications/push';

describe('Phase 9: PWA Configuration & Offline Readiness (§§ 24, 26)', () => {
  it('validates web app manifest with standalone display and corporate branding', () => {
    const config = manifest();
    expect(config.name).toBe('Cruvels Workplace OS');
    expect(config.short_name).toBe('Cruvels');
    expect(config.display).toBe('standalone');
    expect(config.start_url).toBe('/dashboard');
    expect(config.background_color).toBe('#0B0F19');
    expect(config.theme_color).toBe('#0B6E6A');

    const sizes = config.icons?.map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });

  it('verifies public/sw.js service worker contains offline fallback caching and push listeners', () => {
    const swPath = path.join(process.cwd(), 'public', 'sw.js');
    expect(fs.existsSync(swPath)).toBe(true);

    const swContent = fs.readFileSync(swPath, 'utf8');
    expect(swContent).toContain('cruvels-workplace-v2');
    expect(swContent).toContain('/offline.html');
    expect(swContent).toContain("event.request.mode === 'navigate'");
    expect(swContent).toContain("addEventListener('push'");
    expect(swContent).toContain("addEventListener('notificationclick'");
  });

  it('verifies public/offline.html fallback page exists with Cruvels branding and reconnect action', () => {
    const offlinePath = path.join(process.cwd(), 'public', 'offline.html');
    expect(fs.existsSync(offlinePath)).toBe(true);

    const offlineHtml = fs.readFileSync(offlinePath, 'utf8');
    expect(offlineHtml).toContain('Cruvels Workplace OS');
    expect(offlineHtml).toContain('Retry Connection');
    expect(offlineHtml).toContain('You are Currently Offline');
  });
});

describe('Phase 10: Web Push Notifications Pipeline (§ 25)', () => {
  let testUserId: string;
  let testEmpId: string;

  beforeEach(() => {
    testUserId = 'push-user-' + Math.random().toString(36).substring(2, 9);
    testEmpId = 'push-emp-' + Math.random().toString(36).substring(2, 9);
  });

  it('generates or loads a valid VAPID public key', async () => {
    const pubKey = await getVapidPublicKey();
    expect(pubKey).toBeDefined();
    expect(typeof pubKey).toBe('string');
    expect(pubKey.length).toBeGreaterThan(20);
  });

  it('dispatches attendance reminder push notification and action card', async () => {
    const notif = await dispatchAttendanceReminderPush(
      {
        id: testEmpId,
        user_id: testUserId,
        name: 'Rohan Sharma',
      },
      '11:00 AM'
    );

    expect(notif).not.toBeNull();
    expect(notif?.user_id).toBe(testUserId);
    expect(notif?.title).toBe('Attendance Reminder');
    expect(notif?.category).toBe('attendance');
    expect(notif?.type).toBe('attendance_missing');
    expect(notif?.link_url).toBe('/attendance');
    expect(notif?.action_label).toBe('Punch Attendance');
    expect(notif?.action_url).toBe('/attendance');
    expect(notif?.message).toContain('11:00 AM IST');
  });

  it('dispatches task assignment push notification with priority badge and action card', async () => {
    const notif = await dispatchTaskAssignmentPush(
      {
        id: testEmpId,
        user_id: testUserId,
        name: 'Rohan Sharma',
      },
      {
        id: 'task-push-999',
        title: 'Complete Security Audit Checklist',
        priority: 'high',
      }
    );

    expect(notif).not.toBeNull();
    expect(notif?.user_id).toBe(testUserId);
    expect(notif?.title).toContain('Task Assigned');
    expect(notif?.title).toContain('Complete Security Audit Checklist');
    expect(notif?.category).toBe('task');
    expect(notif?.type).toBe('task');
    expect(notif?.link_url).toBe('/tasks');
    expect(notif?.action_label).toBe('View Task');
    expect(notif?.message).toContain('[HIGH]');
    expect(notif?.metadata?.task_id).toBe('task-push-999');
  });

  it('dispatches calendar meeting alert push notification with join URL', async () => {
    const notif = await dispatchMeetingAlertPush(
      {
        id: testEmpId,
        user_id: testUserId,
        name: 'Rohan Sharma',
      },
      {
        id: 'evt-meet-888',
        title: 'Weekly Squad Standup',
        startsAt: '10:00 AM',
        meetUrl: 'https://meet.google.com/abc-defg-hij',
      }
    );

    expect(notif).not.toBeNull();
    expect(notif?.user_id).toBe(testUserId);
    expect(notif?.title).toContain('Weekly Squad Standup');
    expect(notif?.category).toBe('calendar');
    expect(notif?.type).toBe('schedule');
    expect(notif?.link_url).toBe('https://meet.google.com/abc-defg-hij');
    expect(notif?.action_label).toBe('Join Meeting');
    expect(notif?.metadata?.meet_url).toBe('https://meet.google.com/abc-defg-hij');
  });

  it('gracefully returns null if employee has no associated user_id', async () => {
    const notif = await dispatchAttendanceReminderPush(
      {
        id: 'emp-no-user',
        user_id: null,
        name: 'Contractor User',
      },
      '11:00 AM'
    );

    expect(notif).toBeNull();
  });

  it('filters out invalid or mocked test endpoints during web push dispatch', async () => {
    // Save a mock test subscription
    await dataStore.savePushSubscription(testUserId, {
      endpoint: 'https://push.browser/mock-token',
      keys: {
        p256dh: 'mock-p256dh',
        auth: 'mock-auth',
      },
    });

    const notif = await dataStore.createNotification({
      user_id: testUserId,
      title: 'Filter Test',
      message: 'Testing mock filtering',
      type: 'system',
    });

    const result = await sendWebPush(testUserId, notif);
    // Mock endpoints are skipped, delivering 0 without crashing
    expect(result.delivered).toBe(0);
  });

  it('rejects push dispatch to invalid endpoints without throwing exceptions', async () => {
    const success = await sendPushToSubscription(
      {
        endpoint: 'https://invalid-push-provider.example.invalid/endpoint',
        keys: {
          p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9AcUbVYOIxW',
          auth: 'tBHItJI5svbpez7KI4CCXg',
        },
      },
      {
        title: 'Test Delivery',
        message: 'Testing error resilience',
      }
    );

    expect(success).toBe(false);
  });
});
