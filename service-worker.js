const CACHE_NAME = 'team-lucao-v149';
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=20260908-ui2',
  './app.js?v=20260908-ui2',
  './manifest.webmanifest?v=20260908-ui2',
  './aluno',
  './autorizar',
  './public.css?v=20260908-agenda3',
  './public-theme.js?v=20260908-agenda3',
  './student-fast.js?v=20260908-agenda3',
  './authorize-fast.js?v=20260908-ui2',
  './assets/team-lucao-logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).pathname.startsWith('/api/')) return;
  event.respondWith(
    fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      return response;
    }).catch(() => caches.match(request))
  );
});
