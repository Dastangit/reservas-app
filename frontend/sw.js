const CACHE_NAME = 'elysio-v6';
const STATIC_ASSETS = [
  '/',
  '/app.html',
  '/css/theme.css',
  '/css/styles.css',
  '/js/theme-init.js',
  '/assets/logo-elysio.svg',
  '/assets/logo-elysio-dark.svg',
  '/manifest.json',
  '/js/app.js',
  '/js/router.js',
  '/js/auth.js',
  '/js/api.js',
  '/js/utils/formatters.js',
  '/js/utils/escape.js',
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

  const url = new URL(event.request.url);

  // Lo de otros origenes (fotos de Cloudinary, Google Fonts, teselas del mapa)
  // lo pide el navegador directamente. Un fetch() desde el service worker se
  // rige por connect-src de la CSP, que no incluye Cloudinary: el fetch fallaba,
  // el catch devolvia app.html y la foto salia rota en todas las paginas.
  if (url.origin !== self.location.origin) return;

  // No cachear la API: contiene datos autenticados (reservas, perfil) que no
  // deben quedar en disco tras cerrar sesion ni servirse obsoletos offline.
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        // Si falla la red, busca en caché esa URL exacta. Si tampoco está
        // (ej. una ruta de SPA como /host/properties/new, que nunca se
        // cachea individualmente), sirve la carcasa app.html como respaldo -- así
        // siempre se devuelve una Response válida, nunca undefined. Solo para
        // navegaciones: a una imagen o un CSS no se les puede responder con HTML.
        caches.match(event.request).then((cached) => cached
          || (event.request.mode === 'navigate' ? caches.match('/app.html') : Response.error()))
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
    payload = { title: 'Elysio Experiences', body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Elysio Experiences', {
      body: payload.body || '',
      icon: '/assets/icons/icon-192.png',
      badge: '/assets/icons/icon-192.png',
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
