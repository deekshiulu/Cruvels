import { describe, it, expect, beforeEach } from 'vitest';
import { dataStore } from '@/lib/db/store';
import { subscribeToUser, publishToUser } from '@/lib/realtime/hub';
import { AppNotification } from '@/lib/db/types';

describe('Stage 6: Notifications & Real-Time Behavior', () => {
  const userA = 'usr-notif-a';
  const userB = 'usr-notif-b';

  beforeEach(async () => {
    dataStore.resetAndSeed();
  });

  it('creates and retrieves notifications with category support', async () => {
    const notif1 = await dataStore.createNotification({
      user_id: userA,
      type: 'task',
      title: 'New Task Assigned',
      message: 'You have been assigned to Sprint 4 Deliverables.',
      category: 'task',
      link_url: '/tasks',
    });

    const notif2 = await dataStore.createNotification({
      user_id: userA,
      type: 'leave_approval',
      title: 'Leave Request Approved',
      message: 'Your Casual Leave has been approved.',
      category: 'leave',
      link_url: '/leaves',
    });

    expect(notif1.id).toBeDefined();
    expect(notif1.is_read).toBe(false);
    expect(notif2.id).toBeDefined();

    const allNotifs = await dataStore.getNotifications(userA);
    expect(allNotifs).toHaveLength(2);
    expect(allNotifs[0].id).toBe(notif2.id); // Most recent first (unshift)

    // Unread count
    const unreadCount = await dataStore.getUnreadNotificationsCount(userA);
    expect(unreadCount).toBe(2);
  });

  it('strictly isolates notifications between users (multi-tenant safety)', async () => {
    await dataStore.createNotification({
      user_id: userA,
      type: 'system',
      title: 'Confidential Salary Notice',
      message: 'Direct deposit processed.',
      category: 'system',
    });

    await dataStore.createNotification({
      user_id: userB,
      type: 'system',
      title: 'Welcome to Cruvels',
      message: 'Onboarding docs ready.',
      category: 'system',
    });

    const notifsA = await dataStore.getNotifications(userA);
    const notifsB = await dataStore.getNotifications(userB);

    expect(notifsA).toHaveLength(1);
    expect(notifsA[0].title).toBe('Confidential Salary Notice');

    expect(notifsB).toHaveLength(1);
    expect(notifsB[0].title).toBe('Welcome to Cruvels');
  });

  it('marks single notification as read and decrements unread count', async () => {
    const notif = await dataStore.createNotification({
      user_id: userA,
      type: 'mail',
      title: 'New Mail Received',
      message: 'Client sent feedback.',
      category: 'mail',
    });

    expect(await dataStore.getUnreadNotificationsCount(userA)).toBe(1);

    const marked = await dataStore.markNotificationAsRead(notif.id, userA);
    expect(marked).toBe(true);

    const updated = await dataStore.getNotifications(userA);
    expect(updated[0].is_read).toBe(true);

    expect(await dataStore.getUnreadNotificationsCount(userA)).toBe(0);
  });

  it('marks all notifications as read in bulk', async () => {
    await dataStore.createNotification({ user_id: userA, type: 'system', title: 'Item 1', message: 'Desc 1', category: 'system' });
    await dataStore.createNotification({ user_id: userA, type: 'mail', title: 'Item 2', message: 'Desc 2', category: 'mail' });
    await dataStore.createNotification({ user_id: userA, type: 'task', title: 'Item 3', message: 'Desc 3', category: 'task' });

    expect(await dataStore.getUnreadNotificationsCount(userA)).toBe(3);

    const count = await dataStore.markAllNotificationsAsRead(userA);
    expect(count).toBe(3);

    expect(await dataStore.getUnreadNotificationsCount(userA)).toBe(0);
  });

  it('dispatches live notifications to active SSE subscribers in real-time hub', () => {
    const received: AppNotification[] = [];
    const unsubscribe = subscribeToUser(userA, (n) => {
      received.push(n);
    });

    const mockNotif: AppNotification = {
      id: 'notif-sse-test',
      user_id: userA,
      type: 'system',
      title: 'Real-Time Standup Ping',
      message: 'Standup starts in 5 minutes.',
      category: 'system',
      is_read: false,
      created_at: new Date().toISOString(),
    };

    publishToUser(userA, mockNotif);
    expect(received).toHaveLength(1);
    expect(received[0].title).toBe('Real-Time Standup Ping');

    // Test unsubscription
    unsubscribe();
    publishToUser(userA, mockNotif);
    expect(received).toHaveLength(1); // No new events received after unsubscribe
  });

  it('manages Web Push subscriptions and VAPID key pairs', async () => {
    const pushSub = await dataStore.savePushSubscription(userA, {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-sub-token',
      keys: {
        p256dh: 'BNcRdreALRF8Jx6EVV8UOB1nyFaPU206',
        auth: 'tBHItDaA9xWpwqmPQGTEHQ',
      },
      deviceName: 'Chrome on Windows',
    });

    expect(pushSub.id).toBeDefined();
    expect(pushSub.user_id).toBe(userA);
    expect(pushSub.device_name).toBe('Chrome on Windows');

    const userSubs = await dataStore.listPushSubscriptionsForUser(userA);
    expect(userSubs).toHaveLength(1);
    expect(userSubs[0].id).toBe(pushSub.id);

    // Delete push subscription
    await dataStore.deletePushSubscription(pushSub.id);
    const afterDelete = await dataStore.listPushSubscriptionsForUser(userA);
    expect(afterDelete).toEqual([]);
  });
});
