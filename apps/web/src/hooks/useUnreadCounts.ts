'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listConnectionRequests, getNotificationUnreadCount } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useMessagingUnreadCount } from '@/contexts/MessagingContext';
import { useHasSession } from './useSession';
import { useAuthenticatedSession } from './useAuthenticatedSession';
import { useApiAvailability } from './useApiAvailability';

export type UnreadCounts = {
  messages: number;
  intros: number;
  notifications: number;
};

/**
 * The three unread counters, each from one source.
 *
 * - messages: `MessagingContext` - the live count (socket events, the shared
 *   conversation-list cache, mark-read from any surface). This hook used to
 *   poll the conversation list on its own every 60 s, so the sidebar and the
 *   chat bubble showed different numbers until the next poll.
 * - notifications: the server's unread count (`queryKeys.notificationsUnread`),
 *   not a count of whatever page of notifications a surface happens to hold.
 *   The header bell reads this too; every mark-read invalidates `['notifications']`.
 * - intros: pending received connection requests (`queryKeys.connectionsPending`).
 *
 * Header bell, sidebar, phone navigation, bottom bar, chat bubble, chat popup
 * and dashboards all read these - never a count of their own.
 */
export function useUnreadCounts(pollIntervalMs = 60_000): UnreadCounts {
  const hasToken = useHasSession();
  const { isAuthenticated } = useAuthenticatedSession();
  const apiAvailable = useApiAvailability();
  const messages = useMessagingUnreadCount();
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

  const enabled = hasToken && isAuthenticated && isVisible && apiAvailable;

  const { data: introData } = useQuery({
    queryKey: queryKeys.connectionsPending,
    queryFn: () => listConnectionRequests({ type: 'received', limit: 50 }),
    staleTime: 60_000,
    // Stop polling on error (server down / 401) — resume only after window focus or manual refetch
    refetchInterval: (query) => {
      if (!isVisible || query.state.status === 'error') return false;
      return pollIntervalMs;
    },
    enabled,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    retry: 0,
  });

  const { data: notifData } = useQuery({
    queryKey: queryKeys.notificationsUnread,
    queryFn: getNotificationUnreadCount,
    staleTime: 60_000,
    refetchInterval: (query) => {
      if (!isVisible || query.state.status === 'error') return false;
      return pollIntervalMs;
    },
    enabled,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    retry: 0,
  });

  const intros = introData?.connections?.filter((c) => c.status === 'pending')?.length ?? 0;
  const notifications = notifData?.count ?? 0;

  return { messages, intros, notifications };
}
