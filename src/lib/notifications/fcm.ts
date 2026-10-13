import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getMessaging, Message } from 'firebase-admin/messaging';
import { dataStore } from '../db/store';

function getFirebaseAdminApp(): App | null {
  const currentApps = getApps();
  if (currentApps.length > 0) return currentApps[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) return null;

  try {
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  } catch (err) {
    console.error('[FCM Init Error]', err);
    return null;
  }
}

export interface FcmPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Sends a high-priority FCM notification to a specific device token
 */
export async function sendFcmNotification(
  deviceToken: string,
  payload: FcmPayload
): Promise<string | null> {
  const app = getFirebaseAdminApp();
  if (!app) {
    // If running in development without FCM credentials, fail silently
    return null;
  }

  try {
    const messaging = getMessaging(app);
    const message: Message = {
      token: deviceToken,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      // ⚡ High-priority flag forces Android to bypass Doze mode immediately
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'cruvels_urgent_notifications',
          priority: 'max',
        },
      },
      // ⚡ APNs priority 10 forces iOS to wake up immediately
      apns: {
        payload: {
          aps: {
            sound: 'default',
            contentAvailable: true,
          },
        },
        headers: {
          'apns-priority': '10',
          'apns-push-type': 'alert',
        },
      },
    };

    const response = await messaging.send(message);
    return response;
  } catch (err) {
    console.error('[FCM Notification Error]:', err);
    return null;
  }
}

/**
 * Triggers instant push notification to a recipient user by their user ID
 */
export async function sendFcmNotificationToUser(
  userId: string,
  payload: FcmPayload
): Promise<void> {
  try {
    const tokens = await dataStore.getUserFcmTokens(userId);
    if (!tokens || tokens.length === 0) return;

    for (const token of tokens) {
      await sendFcmNotification(token, payload);
    }
  } catch (err) {
    console.error(`[FCM] Error dispatching notification to user ${userId}:`, err);
  }
}
