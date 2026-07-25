const CACHE_NAME = 'dael-v4';
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
