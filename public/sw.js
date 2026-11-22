const CACHE_NAME = 'yuk-shell-v4';
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

  // NUNCA interceptar payloads RSC de Next.js (*.txt / ?_rsc / header RSC)
  // para evitar que un cambio de build redirija al navegador a .../index.txt
  if (
    url.pathname.endsWith('.txt') ||
    url.searchParams.has('_rsc') ||
    request.headers.get('RSC') === '1'
  ) {
    return;
  }

  // Navegaciones HTML: network-first con respaldo offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const contentType = response.headers.get('content-type') || '';
          if (response.status === 200 && contentType.includes('text/html')) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(request, { ignoreSearch: true })
            .then(
              (cached) =>
                cached || caches.match(new URL('./hoy/', self.registration.scope).toString())
            )
        )
    );
    return;
  }

  // Assets inmutables con hash de Next.js (/_next/static/) y modelos 3D GLB (/models/)
  if (url.pathname.includes('/_next/static/') || url.pathname.includes('/models/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
  }
});
