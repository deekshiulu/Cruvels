import { dataStore } from '../db/store';
import { AppNotification } from '../db/types';
import webpush from 'web-push';

let configured = false;

async function ensureVapid(): Promise<{ publicKey: string; privateKey: string } | null> {
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

export async function sendWebPush(userId: string, notification: AppNotification) {
  const keys = await ensureVapid();
  if (!keys) return;

  const subscriptions = await dataStore.listPushSubscriptionsForUser(userId);
  const payload = JSON.stringify({
    title: notification.title,
    message: notification.message,
    link_url: notification.link_url || '/dashboard',
    tag: `cruvels-${notification.id}`,
  });

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
    } catch (err: any) {
      const status = err?.statusCode;
      if (status === 404 || status === 410) {
        await dataStore.deletePushSubscription(sub.id);
      }
    }
  }
}
