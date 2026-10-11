'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { analytics } from '@/lib/analytics';

/**
 * Initialises PostHog on mount, identifies logged-in users,
 * and fires page_viewed events on every route change.
 *
 * Wrap in Suspense if you use useSearchParams in a Server Component tree.
 */
export function PostHogProvider({ userId, userTraits }: {
  userId?: string;
  userTraits?: Record<string, unknown>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prevPath = useRef<string | null>(null);

  // Identify on mount / userId change
  useEffect(() => {
    if (!userId) return;
    void analytics.identify(userId, userTraits);
  }, [userId, userTraits]);

  // Page view on route change
  useEffect(() => {
    const fullPath = pathname + (searchParams?.toString() ? `?${searchParams}` : '');
    if (fullPath === prevPath.current) return;
    prevPath.current = fullPath;
    void analytics.track('page_viewed', {
      path: fullPath,
      referrer: typeof document !== 'undefined' ? document.referrer : undefined,
    });
  }, [pathname, searchParams]);

  return null;
}
