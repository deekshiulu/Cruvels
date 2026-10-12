// Cruvels Workplace OS Service Worker
// Offline Caching Shell, PWA Resiliency & Push Notifications Engine

const CACHE_NAME = 'cruvels-workplace-v2';
const RUNTIME_CACHE = 'cruvels-runtime-v2';

const STATIC_PRECACHE = [
  '/',
  '/dashboard',
  '/schedule',
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
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_PRECACHE).catch((err) => {
          console.warn('[SW PRECACHE WARN] Some precache routes skipped during build:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('cruvels-') && name !== CACHE_NAME && name !== RUNTIME_CACHE)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch: Stale-While-Revalidate and Network-First for offline Subway resilience
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Non-GET requests should always be passed to network
  if (event.request.method !== 'GET') {
    return;
  }

  // 1. API: Schedule caching for offline operational agenda access
  if (url.pathname === '/api/schedule') {
    event.respondWith(
      fetch(event.request)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return networkRes;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return new Response(JSON.stringify({ events: [], success: true, offline: true }), {
              headers: { 'Content-Type': 'application/json' },
            });
          });
        })
    );
    return;
  }

  // Bypass other non-cacheable APIs
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 2. Next.js Static Chunks & Scripts (/_next/static/...) -> Stale-While-Revalidate
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, clone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 3. Navigation Requests (HTML Pages like /dashboard, /schedule) -> Network First with Shell Cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline Subway fallback: try specific requested page first
          return caches.match(event.request).then((matched) => {
            if (matched) return matched;
            // Fallback to cached dashboard or schedule or offline shell
            if (url.pathname.startsWith('/schedule')) {
              return caches.match('/schedule').then((sched) => sched || caches.match('/offline.html'));
            }
            return caches.match('/dashboard').then((dash) => dash || caches.match('/offline.html'));
          });
        })
    );
    return;
  }

  // 4. Static Images, Icons, and Fonts -> Cache First
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
        if (cachedResponse) return cachedResponse;
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);
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
      vibrate: [200, 100, 200],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('[SW PUSH ERROR]', err);
  }
});

// Push Notification Click
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
