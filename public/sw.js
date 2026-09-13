// Cruvels Internal Portal Service Worker for Device Push Notifications & Sound Alerts
self.addEventListener('push', function (event) {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'Cruvels Internal Portal';
    const options = {
      body: data.message || 'You have a new update.',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: {
        url: data.link_url || '/dashboard',
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

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/dashboard';

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

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const title = event.data.title || 'Cruvels Internal Portal';
    const options = {
      body: event.data.message || 'You have a new update.',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
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
