import { AppNotification } from '../db/types';
import { publishToUser } from '../realtime/hub';
import { sendWebPush } from './push';
import { sendFcmNotificationToUser } from './fcm';

export async function dispatchNotification(notification: AppNotification) {
  // 1. In-app real-time stream (SSE) for active app viewers
  publishToUser(notification.user_id, notification);

  if (process.env.VITEST) {
    return;
  }

  // 2. Standard Web Push (browsers)
  if (process.env.EMAIL_PROVIDER_MODE !== 'mock') {
    await sendWebPush(notification.user_id, notification).catch(() => {});
  }

  // 3. ⚡ High-Priority FCM Push for Mobile Devices (Android System Tray & iOS APNs)
  // Wakes up device and displays in system notification bar even when app is closed
  await sendFcmNotificationToUser(notification.user_id, {
    title: notification.title,
    body: notification.message,
    data: {
      notificationId: notification.id,
      link_url: notification.link_url || notification.action_url || '',
      route: notification.link_url || notification.action_url || '',
      type: notification.type,
      title: notification.title,
      body: notification.message,
    },
  }).catch((err) => console.error('[FCM Dispatch Error]', err));
}

