const CACHE_NAME = 'yuk-shell-v2';
// Rutas relativas al scope del SW (funciona igual en raíz o bajo basePath de GitHub Pages).
const APP_SHELL = [
  './',
  './hoy/',
  './entrenar/',
  './rutina/',
  './ejercicios/',
  './progreso/',
  './comunidad/',
  './perfil/',
  './manifest.webmanifest',
  './icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all(
          APP_SHELL.map((p) =>
            cache.add(new URL(p, self.registration.scope).toString()).catch(() => undefined)
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request, { ignoreSearch: request.mode === 'navigate' }).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          cached ||
          (request.mode === 'navigate'
            ? caches.match(new URL('./hoy/', self.registration.scope).toString())
            : undefined)
        );
      return cached || networkFetch;
    })
  );
});
