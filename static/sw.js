/**
 * ShellMan OS: Service Worker (sw.js)
 * Enables Progressive Web App (PWA) installation, offline fallback, and fast asset caching.
 */

const CACHE_NAME = 'shellman-pwa-v3.9';

// Core assets to pre-cache on install for standalone app shell
const PRECACHE_ASSETS = [
  '/',
  '/static/manifest.json',
  '/static/icons/favicon.svg',
  '/static/icons/icon-192.png',
  '/static/icons/icon-512.png',
  '/static/icons/icon-maskable-512.png',
  '/static/css/style.css',
  '/static/css/desktop.css',
  '/static/css/workspace.css',
  '/static/js/modal.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching asset warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Never cache non-GET requests (e.g. POST /api/...)
  if (req.method !== 'GET') {
    return;
  }

  // 2. Never cache WebSocket or live telemetry / terminal / sftp API calls
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/terminal/sock') ||
    url.pathname.includes('/sock') ||
    url.protocol === 'ws:' ||
    url.protocol === 'wss:'
  ) {
    return; // Pass through directly to network
  }

  // 3. For navigation requests (loading HTML documents): Network first, fallback to cache
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => {
        return caches.match(req).then((cached) => {
          if (cached) return cached;
          return caches.match('/');
        });
      })
    );
    return;
  }

  // 4. For static assets (CSS, JS, images, icons, fonts): Stale-While-Revalidate
  if (url.pathname.startsWith('/static/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(req).then((cachedResponse) => {
          const fetchPromise = fetch(req).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(req, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => cachedResponse);

          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Default: Network with cache fallback
  event.respondWith(
    caches.match(req).then((cached) => {
      return cached || fetch(req);
    })
  );
});

