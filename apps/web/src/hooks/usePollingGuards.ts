'use client';

import { useEffect, useState } from 'react';
import { useApiAvailability } from './useApiAvailability';

/**
 * Shared guards for polling (`refetchInterval`) queries.
 *
 * Returns:
 *  - `apiAvailable` — add to a query's `enabled` so it never polls a server that
 *    is known to be down (circuit breaker open).
 *  - `isVisible` — true while the tab is foregrounded.
 *  - `pollInterval(ms)` — a `refetchInterval` callback that pauses polling while
 *    the tab is hidden OR the query is in an error state, otherwise polls `ms`.
 *
 * This codifies the proven pattern from `useUnreadCounts` so every polling query
 * fails fast and quiet instead of hammering an unreachable backend.
 */
export function usePollingGuards() {
  const apiAvailable = useApiAvailability();
  const [isVisible, setIsVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState === 'visible',
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const pollInterval =
    (ms: number) =>
    (query: { state: { status: string } }): number | false =>
      !isVisible || query.state.status === 'error' ? false : ms;

  return { apiAvailable, isVisible, pollInterval };
}
