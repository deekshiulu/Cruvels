import { AppNotification } from '../db/types';
import { publishToUser } from '../realtime/hub';
import { sendWebPush } from './push';
import { sendFcmNotificationToUser } from './fcm';

export async function dispatchNotification(notification: AppNotification) {
  publishToUser(notification.user_id, notification);
  if (process.env.EMAIL_PROVIDER_MODE === 'mock' || process.env.VITEST) {
    return;
  }
  await sendWebPush(notification.user_id, notification);
  await sendFcmNotificationToUser(notification.user_id, {
    title: notification.title,
    body: notification.message,
    data: {
      notificationId: notification.id,
      link_url: notification.link_url || notification.action_url || '',
      type: notification.type,
    },
  });
}
