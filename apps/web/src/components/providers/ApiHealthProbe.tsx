'use client';

import { useEffect } from 'react';
import { isApiReachable, probeApiHealth } from '@/lib/api';

const PROBE_INTERVAL_MS = 15_000;

/**
 * THE single source of API recovery probing for the whole app (mounted once in
 * the root layout). It only probes while the API is believed unreachable, and a
 * successful probe broadcasts `cfb:api-online` to re-enable gated queries.
 * Centralising the loop here avoids the connection-refused storm that occurred
 * when every `useApiAvailability` consumer ran its own probe interval.
 */
export function ApiHealthProbe() {
  useEffect(() => {
    let cancelled = false;

    const tick = () => {
      // Only probe while down — when reachable there is nothing to recover.
      if (cancelled || isApiReachable()) return;
      void probeApiHealth();
    };

    const id = window.setInterval(tick, PROBE_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return null;
}
