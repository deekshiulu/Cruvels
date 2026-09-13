import { AppNotification } from '../db/types';
import { publishToUser } from '../realtime/hub';
import { sendWebPush } from './push';

export async function dispatchNotification(notification: AppNotification) {
  publishToUser(notification.user_id, notification);
  if (process.env.EMAIL_PROVIDER_MODE === 'mock' || process.env.VITEST) {
    return;
  }
  await sendWebPush(notification.user_id, notification);
}
