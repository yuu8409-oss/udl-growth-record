const CACHE_NAME = 'udl-growth-v2-121';
const INDEX_URL = './index.html?v=121';
const APP_SHELL = [
  './',
  './index.html',
  INDEX_URL,
  './styles.css?v=121',
  './app.js?v=121',
  './manifest.webmanifest?v=121',
  './icon-192.png',
  './icon-512.png',
  './icon.ico',
  './UDL-app-download.zip?v=121'
];

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const results = await Promise.allSettled(APP_SHELL.map(url => cache.add(url)));
  const failed = results.filter(result => result.status === 'rejected');
  if (failed.length === APP_SHELL.length) throw new Error('App shell cache failed');
}

async function cachedIndex() {
  return await caches.match(INDEX_URL) ||
    await caches.match('./index.html') ||
    await caches.match('./');
}

async function updateIndexFromNetwork(request) {
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put('./index.html', response.clone());
    await cache.put(INDEX_URL, response.clone());
  }
  return response;
}

self.addEventListener('install', event => {
  event.waitUntil(cacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cached = await cachedIndex();
      const network = updateIndexFromNetwork(request).catch(() => cached);
      return cached || network;
    })());
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

