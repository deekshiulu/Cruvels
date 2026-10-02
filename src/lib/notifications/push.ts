import { dataStore } from '../db/store';
import { AppNotification } from '../db/types';
import webpush from 'web-push';

let configured = false;

export interface PushNotificationPayload {
  title: string;
  message: string;
  link_url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
}

export async function ensureVapid(): Promise<{ publicKey: string; privateKey: string } | null> {
  const loaded = await dataStore.loadVapidKeys();
  if (loaded?.publicKey && loaded?.privateKey) {
    if (!configured) {
      webpush.setVapidDetails('mailto:admin@cruvels.com', loaded.publicKey, loaded.privateKey);
      configured = true;
    }
    return loaded;
  }

  const existing = dataStore.getOrCreateVapidKeys();
  if (existing?.publicKey && existing?.privateKey) {
    if (!configured) {
      webpush.setVapidDetails('mailto:admin@cruvels.com', existing.publicKey, existing.privateKey);
      configured = true;
    }
    return existing;
  }

  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    const keys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    dataStore.setVapidKeys(keys);
    webpush.setVapidDetails('mailto:admin@cruvels.com', keys.publicKey, keys.privateKey);
    configured = true;
    return keys;
  }

  const generated = webpush.generateVAPIDKeys();
  dataStore.setVapidKeys(generated);
  webpush.setVapidDetails('mailto:admin@cruvels.com', generated.publicKey, generated.privateKey);
  configured = true;
  return generated;
}

export async function getVapidPublicKey(): Promise<string> {
  const keys = await ensureVapid();
  return keys?.publicKey || '';
}

export async function sendWebPush(userId: string, notification: AppNotification): Promise<{ delivered: number; failed: number }> {
  const keys = await ensureVapid();
  if (!keys) return { delivered: 0, failed: 0 };

  const subscriptions = await dataStore.listPushSubscriptionsForUser(userId);
  const payload = JSON.stringify({
    title: notification.title,
    message: notification.message,
    link_url: notification.link_url || '/dashboard',
    tag: `cruvels-${notification.id}`,
    icon: '/icon-192.png',
    badge: '/favicon.png',
  });

  let delivered = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    if (!sub.endpoint.startsWith('https://') || sub.endpoint.includes('push.browser/')) {
      continue;
    }
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys,
        },
        payload
      );
      delivered++;
    } catch (err: any) {
      failed++;
      const status = err?.statusCode;
      if (status === 404 || status === 410) {
        await dataStore.deletePushSubscription(sub.id);
      }
    }
  }

  return { delivered, failed };
}

export async function sendPushToSubscription(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: PushNotificationPayload
): Promise<boolean> {
  const keys = await ensureVapid();
  if (!keys) return false;

  if (!subscription.endpoint.startsWith('https://') || subscription.endpoint.includes('push.browser/')) {
    return false;
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify(payload)
    );
    return true;
  } catch (err: any) {
    return false;
  }
}

/**
 * Dispatches an automated attendance reminder push notification and in-app action card (§ 25).
 */
export async function dispatchAttendanceReminderPush(
  employee: { id: string; user_id?: string | null; name: string },
  deadlineTime: string
): Promise<AppNotification | null> {
  const userId = employee.user_id;
  if (!userId) return null;

  const notif = await dataStore.createNotification({
    user_id: userId,
    title: 'Attendance Reminder',
    message: `Hi ${employee.name}, please remember to mark attendance before ${deadlineTime} IST to remain compliant.`,
    type: 'attendance_missing',
    category: 'attendance',
    link_url: '/attendance',
    action_label: 'Punch Attendance',
    action_url: '/attendance',
    state: 'action_required',
    metadata: {
      employee_id: employee.id,
      deadline: deadlineTime,
    },
  });

  await sendWebPush(userId, notif);
  return notif;
}

/**
 * Dispatches a task assignment push notification and in-app action card (§ 25).
 */
export async function dispatchTaskAssignmentPush(
  assignee: { id: string; user_id?: string | null; name: string },
  task: { id: string; title: string; priority?: string }
): Promise<AppNotification | null> {
  const userId = assignee.user_id;
  if (!userId) return null;

  const priorityLabel = (task.priority || 'medium').toUpperCase();
  const notif = await dataStore.createNotification({
    user_id: userId,
    title: `Task Assigned: ${task.title}`,
    message: `You have been assigned a new [${priorityLabel}] priority task: "${task.title}".`,
    type: 'task',
    category: 'task',
    link_url: '/tasks',
    action_label: 'View Task',
    action_url: '/tasks',
    state: 'action_required',
    metadata: {
      task_id: task.id,
      priority: task.priority,
    },
  });

  await sendWebPush(userId, notif);
  return notif;
}

/**
 * Dispatches a meeting alert push notification and in-app action card (§ 25).
 */
export async function dispatchMeetingAlertPush(
  attendee: { id: string; user_id?: string | null; name: string },
  meeting: { id?: string; title: string; startsAt: string; meetUrl?: string }
): Promise<AppNotification | null> {
  const userId = attendee.user_id;
  if (!userId) return null;

  const notif = await dataStore.createNotification({
    user_id: userId,
    title: `Upcoming Meeting: ${meeting.title}`,
    message: `Meeting "${meeting.title}" starts at ${meeting.startsAt}. Join your squad.`,
    type: 'schedule',
    category: 'calendar',
    link_url: meeting.meetUrl || '/calendar',
    action_label: 'Join Meeting',
    action_url: meeting.meetUrl || '/calendar',
    state: 'unread',
    metadata: {
      meeting_id: meeting.id,
      meet_url: meeting.meetUrl,
      starts_at: meeting.startsAt,
    },
  });

  await sendWebPush(userId, notif);
  return notif;
}
