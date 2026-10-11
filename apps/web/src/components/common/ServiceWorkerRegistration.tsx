'use client';

import { useEffect } from 'react';

const CACHED_PREFIX = 'cofounderbay-';

async function unregisterServiceWorkersAndCaches() {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if ('caches' in window) {
    const cacheKeys = await caches.keys();
    await Promise.all(
      cacheKeys
        .filter((key) => key.startsWith(CACHED_PREFIX))
        .map((key) => caches.delete(key)),
    );
  }
}

/**
 * Registers the Service Worker only when explicitly enabled.
 * Updates happen in the background without forcing a reload during navigation.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_ENABLE_SW !== 'true') {
      void unregisterServiceWorkersAndCaches();
      return;
    }

    let updateInterval: ReturnType<typeof setInterval> | null = null;

    void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        void registration.update();
        updateInterval = setInterval(() => {
          void registration.update();
        }, 15 * 60 * 1000);
      })
      .catch(() => {
        // Keep registration failures silent in production UI.
      });

    return () => {
      if (updateInterval) {
        clearInterval(updateInterval);
      }
    };
  }, []);

  return null;
}
