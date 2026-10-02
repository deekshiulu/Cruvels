// Cruvels Workplace OS Service Worker
// Offline Caching Shell & Device Push Notifications Engine

const CACHE_NAME = 'cruvels-workplace-v2';
const STATIC_ASSETS = [
  '/offline.html',
  '/favicon.ico',
  '/favicon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/cruvels-logo.png',
  '/cruvels-logo-transparent.png',
];

// Install: precache offline fallback shell and key static icons
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('cruvels-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: network-first with offline fallback for navigation; bypass cache for API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always bypass cache for API calls, Next.js server actions, internal chunks, or non-GET requests
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/')
  ) {
    return;
  }

  // Navigation requests: try network first, fallback to offline shell if offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/offline.html');
      })
    );
    return;
  }

  // Static assets (images, icons, fonts): cache-first with network fallback
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        });
      })
    );
  }
});

// Push Notification Reception
self.addEventListener('push', function (event) {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'Cruvels Workplace OS';
    const options = {
      body: data.message || 'You have a new workplace update.',
      icon: '/icon-192.png',
      badge: '/favicon.png',
      data: {
        url: data.link_url || data.url || '/dashboard',
      },
      tag: data.tag || 'cruvels-notification',
      renotify: true,
      vibrate: [200, 100, 200],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('[SW Push Error]', err);
  }
});

// Push Notification Click Action
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const rawUrl = event.notification.data?.url || '/dashboard';

  // Security: Ensure targetUrl is strictly from this origin
  let targetUrl = '/dashboard';
  if (typeof rawUrl === 'string') {
    if (rawUrl.startsWith('/') && !rawUrl.startsWith('//')) {
      targetUrl = rawUrl;
    } else {
      try {
        const parsed = new URL(rawUrl, self.location.origin);
        if (parsed.origin === self.location.origin) {
          targetUrl = parsed.pathname + parsed.search + parsed.hash;
        }
      } catch (e) {}
    }
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Client Message Handling
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const title = event.data.title || 'Cruvels Workplace OS';
    const options = {
      body: event.data.message || 'You have a new workplace update.',
      icon: '/icon-192.png',
      badge: '/favicon.png',
      data: {
        url: event.data.url || '/dashboard',
      },
      tag: 'cruvels-' + Date.now(),
      renotify: true,
      vibrate: [200, 100, 200],
    };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});
