const CACHE_NAME = 'qlbh-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force the waiting service worker to become the active service worker.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      return self.clients.claim(); // Take control of all clients immediately.
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Network-first strategy or just bypass cache
  event.respondWith(fetch(event.request));
});
