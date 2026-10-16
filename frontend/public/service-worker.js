/**
 * Ngopi v3 Progressive Web App Service Worker
 * Fondasi Offline untuk Akses Tanpa Internet & HT (Handy Talky)
 */

const CACHE_NAME = 'ngopi-v3';
const OFFLINE_FALLBACK_URL = '/offline.html';

const URLS_TO_CACHE = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/chat',
  '/warung',
  '/games/gapleh',
  '/guides/ht',
  '/guides/first-aid',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// 1. Install Event: Cache app shell & offline fallback
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[ServiceWorker] Pre-caching offline shell and pages');
      // Cache URLs gracefully so single failure does not break installation
      await Promise.all(
        URLS_TO_CACHE.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[ServiceWorker] Failed to precache ${url}:`, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate Event: Clean old caches & claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event: Network with cache fallback + offline.html for HTML navigation
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Bypass non-GET requests and WebSocket/Socket.IO connections
  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/socket.io/')) return;

  // API calls: Network only (let frontend handle offline queues/sync)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Navigation requests (HTML documents)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // If valid response, clone into cache
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          // Try matched cache first
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;

          // Fallback to cached home or offline.html
          const cachedHome = await caches.match('/');
          if (cachedHome) return cachedHome;

          const offlinePage = await caches.match(OFFLINE_FALLBACK_URL);
          if (offlinePage) return offlinePage;

          return new Response('Mode Offline Aktif — HT Siap', {
            headers: { 'Content-Type': 'text/plain' },
          });
        })
    );
    return;
  }

  // Static assets (JS, CSS, Images, Fonts): Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// 4. Message Listener (Skip waiting on demand)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
