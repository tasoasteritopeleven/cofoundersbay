// Service Worker for CoFounderBay
// Network-first strategy to prevent stale cache issues in development

const CACHE_VERSION = 'v2';
const CACHE_NAME = `cofounderbay-${CACHE_VERSION}`;
const IS_LOCALHOST = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

// Install event - skip waiting immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event - clear ALL old caches and claim clients
self.addEventListener('activate', (event) => {
  if (IS_LOCALHOST) {
    event.waitUntil((async () => {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      await Promise.all(clients.map((client) => client.navigate(client.url)));
    })());
    return;
  }

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - NETWORK FIRST for everything to prevent stale assets
self.addEventListener('fetch', (event) => {
  if (IS_LOCALHOST) return;

  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip external requests
  if (url.origin !== self.location.origin) return;

  // Skip _next/static with hash in filename (already cache-busted by Next.js)
  // These can use stale-while-revalidate safely
  if (url.pathname.includes('/_next/static/') && url.pathname.match(/\.[a-f0-9]{8,}\./)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Everything else: NETWORK FIRST (prevents stale page issues)
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only cache successful responses for static assets
        if (response.ok && url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|woff2?)$/)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline fallback - try cache
        return caches.match(request);
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  // Placeholder for syncing offline messages when back online
  console.log('Syncing offline messages...');
}

// Push notifications support
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'CoFounderBay';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    data: data.url || '/',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || '/')
  );
});
