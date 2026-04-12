self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {};
  const title = payload.title || 'Prayer reminder';
  const body = payload.body || 'A prayer reminder is ready.';
  const url = payload.url || '/';

  event.waitUntil(
    Promise.all([
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
        for (const client of clients) {
          client.postMessage({
            payload,
            type: 'prayer-notification',
          });
        }
      }),
      self.registration.showNotification(title, {
        body,
        data: {
          url,
        },
        tag: payload.jobId || payload.id || title,
      }),
    ]),
  );
});

self.addEventListener('notificationclick', (event) => {
  const targetUrl = event.notification?.data?.url || '/';

  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client;
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    }),
  );
});
