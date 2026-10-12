import { NextResponse } from 'next/server';
import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getMessaging, Message } from 'firebase-admin/messaging';

// Initialize Firebase Admin only once to prevent hot-reload crashes
function getFirebaseAdminApp(): App | null {
  const currentApps = getApps();
  if (currentApps.length > 0) {
    return currentApps[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  try {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } catch (err) {
    console.error('[FCM Init Error]', err);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const { deviceToken, title, body, data } = await req.json();

    if (!deviceToken || !title) {
      return NextResponse.json(
        { success: false, error: 'deviceToken and title are required.' },
        { status: 400 }
      );
    }

    const app = getFirebaseAdminApp();
    if (!app) {
      return NextResponse.json(
        {
          success: false,
          error: 'Firebase Admin SDK is not initialized. Please configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.',
        },
        { status: 503 }
      );
    }

    const messaging = getMessaging(app);

    const message: Message = {
      token: deviceToken,
      notification: {
        title,
        body: body || '',
      },
      data: data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {},
      // ⚡ CRITICAL FOR INSTANT ANDROID DELIVERY (bypasses Doze mode)
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'cruvels_urgent_notifications',
          priority: 'max',
        },
      },
      // ⚡ CRITICAL FOR INSTANT IOS DELIVERY (wakes device immediately)
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

    // Send the message directly through FCM API
    const response = await messaging.send(message);

    return NextResponse.json({ success: true, messageId: response });
  } catch (error: any) {
    console.error('[FCM Send Error]:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to dispatch notification' },
      { status: 500 }
    );
  }
}
