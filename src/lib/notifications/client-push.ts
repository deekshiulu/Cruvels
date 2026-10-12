import { playNotificationSound, unlockAudioContext } from '@/lib/utils/sound';

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  if (typeof window === 'undefined') return new Uint8Array(0);
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Registers Service Worker (if supported) and synchronizes browser PushSubscription
 * with the server for the current authenticated user.
 */
export async function syncPushSubscription(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    const vapidRes = await fetch('/api/notifications/vapid');
    if (!vapidRes.ok) {
      // User might be unauthenticated or vapid not available yet
      return false;
    }

    const vapidData = await vapidRes.json();
    if (!vapidData?.publicKey || !reg.pushManager) {
      return false;
    }

    const keyArray = urlBase64ToUint8Array(vapidData.publicKey);
    const existing = await reg.pushManager.getSubscription();
    const subscription =
      existing ||
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyArray as unknown as BufferSource,
      }));

    const rawKey = subscription.getKey('p256dh');
    const rawAuth = subscription.getKey('auth');

    if (rawKey && rawAuth) {
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode(...new Uint8Array(rawKey))),
            auth: btoa(String.fromCharCode(...new Uint8Array(rawAuth))),
          },
          deviceName: navigator.userAgent.slice(0, 60),
        }),
      });
      return true;
    }
  } catch (err) {
    console.debug('Failed to sync push subscription:', err);
  }

  return false;
}

/**
 * Requests native browser/OS notification permission with audio unlock and push sync.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  try {
    unlockAudioContext();
    const perm = await Notification.requestPermission();

    if (perm === 'granted') {
      playNotificationSound();
      await syncPushSubscription();

      try {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_NOTIFICATION',
            title: 'Cruvels Internal Portal',
            message: 'Notifications enabled! You will receive real-time alerts on this device.',
            url: '/dashboard',
          });
        } else {
          new Notification('Cruvels Internal Portal', {
            body: 'Notifications enabled! You will receive real-time alerts on this device.',
            icon: '/favicon.ico',
          });
        }
      } catch {
        // Notification constructor or SW message fallback
      }
    }

    return perm;
  } catch (err) {
    console.error('Notification permission request error:', err);
    return Notification.permission;
  }
}
