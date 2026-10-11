'use client';

import { useQuery } from '@tanstack/react-query';
import type { VerificationMethod } from '@cofounderbay/shared';
import { getVerifiedMethods } from '@/lib/verification-api';
import { qk } from '@/lib/query-keys';
import { VerifiedBadge } from './VerifiedBadge';

/**
 * The verification badge for anyone by id, read live from
 * `GET /api/verification/of/:userId` (methods only: never the work domain or
 * a date). Renders nothing while loading, on error, or with no signal, so an
 * unverified person is not marked as such either.
 *
 * `fallback` renders instead when there is no platform signal, for a page
 * that already showed something of its own in that place.
 */
export function PersonVerifiedBadge({ userId, className, fallback }: { userId: string; className?: string; fallback?: React.ReactNode }) {
  const { data } = useQuery({
    queryKey: qk('verification', 'of', userId),
    queryFn: () => getVerifiedMethods(userId),
    enabled: !!userId,
    staleTime: 5 * 60_000,
    retry: 0,
  });
  const methods: VerificationMethod[] = data ?? [];
  if (methods.length) return <VerifiedBadge methods={methods} className={className} />;
  return <>{fallback ?? null}</>;
}
