'use client';

import { useEffect, useState } from 'react';
import { isApiReachable } from '@/lib/api';

/**
 * Tracks whether the backend API is reachable. Purely event-driven: it reflects
 * the shared reachability state in `api.ts`, updated via the `cfb:api-offline` /
 * `cfb:api-online` events. Recovery probing is owned by a SINGLE `ApiHealthProbe`
 * mounted in the root layout, so this hook never spawns its own probe loop —
 * regardless of how many components consume it. This avoids the connection-refused
 * storm caused by N independent pollers plus React StrictMode double-mounting.
 */
export function useApiAvailability(): boolean {
  const [available, setAvailable] = useState(() => isApiReachable());

  useEffect(() => {
    // Sync immediately in case state changed between render and effect mount.
    setAvailable(isApiReachable());

    const handleOffline = () => setAvailable(false);
    const handleOnline = () => setAvailable(true);

    window.addEventListener('cfb:api-offline', handleOffline);
    window.addEventListener('cfb:api-online', handleOnline);

    return () => {
      window.removeEventListener('cfb:api-offline', handleOffline);
      window.removeEventListener('cfb:api-online', handleOnline);
    };
  }, []);

  return available;
}
