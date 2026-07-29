const CACHE_NAME = 'dael-v5';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/manifest.json',
  '/js/app.js',
  '/js/router.js',
  '/js/auth.js',
  '/js/api.js',
  '/js/utils/formatters.js',
  '/js/utils/validators.js',
  '/js/components/Header.js',
  '/js/components/Footer.js',
  '/js/components/PropertyCard.js',
  '/js/components/BookingCard.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && event.request.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        // Si falla la red, busca en caché esa URL exacta. Si tampoco está
        // (ej. una ruta de SPA como /host/properties/new, que nunca se
        // cachea individualmente), sirve index.html como respaldo -- así
        // siempre se devuelve una Response válida, nunca undefined.
        caches.match(event.request).then((cached) => cached || caches.match('/index.html'))
      )
  );
});

// Notificaciones push para el admin (reservas nuevas, propiedades pendientes,
// resets de contraseña, pagos huérfanos, comisiones vencidas).
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { title: 'Da-El World Travelers', body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Da-El World Travelers', {
      body: payload.body || '',
      icon: '/assets/logo-icon.png',
      badge: '/assets/logo-icon.png',
      data: { url: payload.url || '/admin/dashboard' },
    })
  );
});

// Al tocar la notificación, abre (o enfoca) la app en la sección relevante.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/admin/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
