'use client';

import { useQuery } from '@tanstack/react-query';
import { getMe, type AuthUser } from '@/lib/api';
import { useHasSession } from './useSession';
import { useApiAvailability } from './useApiAvailability';
import { qk } from '@/lib/query-keys';

/**
 * Cookie presence (`cfb_session`) is not enough — the token may be expired while
 * the indicator cookie remains. This hook validates once via GET /api/auth/me and
 * shares the result app-wide (React Query dedupes the fetch).
 *
 * Use `isAuthenticated` to gate protected REST calls and sockets — avoids 401
 * console noise from NotificationsBell, MessagingContext, etc.
 */
export function useAuthenticatedSession(): {
  isAuthenticated: boolean;
  isChecking: boolean;
  user: AuthUser | null;
} {
  const hasCookie = useHasSession();
  const apiAvailable = useApiAvailability();

  const { data, isPending, isFetching, isError } = useQuery({
    queryKey: qk('auth', 'me'),
    queryFn: getMe,
    enabled: hasCookie && apiAvailable,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const isChecking = hasCookie && apiAvailable && (isPending || isFetching);
  const isAuthenticated = hasCookie && !!data?.user && !isError;

  return {
    isAuthenticated,
    isChecking,
    user: data?.user ?? null,
  };
}
