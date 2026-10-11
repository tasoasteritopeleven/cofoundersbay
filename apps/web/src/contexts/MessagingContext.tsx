'use client';

/**
 * MessagingContext — shared messaging store
 *
 * Provides a single source-of-truth for:
 *   - total unread message count (driven by socket events + REST bootstrap)
 *   - active open conversation ID (prevents popup + full-page from fighting)
 *   - unread-by-conversation map
 *   - cross-surface "mark as read" signalling
 *
 * Design principles:
 *   - ADDITIVE: ChatPopup and MessagesPage are NOT refactored; they still own
 *     their own socket instances and local state.  This context is a lightweight
 *     broadcast bus so they stay in sync on the things that matter (unread count,
 *     active conversation, "new message" signal).
 *   - NON-BREAKING: Consumers call opt-in hooks; nothing is forced on legacy code.
 *   - FAST: unread count exposed to ChatBubble is updated immediately on socket
 *     events instead of waiting up to 60 s for the polling interval.
 *   - ONE COUNT: the sidebar, the phone navigation, the chat bubble, the chat
 *     popup's tab and the founder dashboard all read `totalUnread` (directly or
 *     through `useUnreadCounts`). They used to count separately - a 60 s poll
 *     here, the popup's own list there - and disagreed after every read. The
 *     conversation-list query cache (`queryKeys.conversationsList`) is the
 *     channel: whoever fetches the list writes it there, this store derives
 *     its map from every write, and marking a conversation read updates the
 *     cached row as well, so the lists and the badges cannot drift apart.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiAvailability } from '@/hooks/useApiAvailability';
import { useSession } from '@/hooks/useSession';
import { useAuthenticatedSession } from '@/hooks/useAuthenticatedSession';
import { listMessageConversations } from '@/lib/api';
import { isApiCircuitOpen, probeApiHealth } from '@/lib/api';
import { createMessagingSocket } from '@/lib/messagingSocket';
import type { MessageItem } from '@/lib/api';
import { queryKeys, qk } from '@/lib/query-keys';

type ConversationList = Awaited<ReturnType<typeof listMessageConversations>>;

/** The per-conversation unread map a conversation list implies. */
function unreadMapOf(list: ConversationList | undefined): Record<string, number> | null {
  const conversations = list?.conversations;
  if (!Array.isArray(conversations)) return null;
  const map: Record<string, number> = {};
  for (const c of conversations) map[c.id] = c.unreadCount ?? 0;
  return map;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type MessagingContextValue = {
  /** Total unread message count across all conversations */
  totalUnread: number;
  /** Per-conversation unread count */
  unreadMap: Record<string, number>;
  /**
   * The conversation ID that is currently "open" in any surface (popup or
   * full-page).  Used to suppress duplicate unread increments.
   */
  activeConversationId: string | null;

  /** Called by ChatPopup / MessagesPage when a conversation is opened */
  setActiveConversationId: (id: string | null) => void;
  /** Called when a message is read so other surfaces can react */
  markConversationRead: (conversationId: string) => void;
  /** Called when a new outbound/inbound message is processed */
  incrementUnread: (conversationId: string, delta?: number) => void;
  /** Force-refresh unread counts from REST (e.g. after page focus) */
  refreshUnread: () => void;
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

type State = {
  unreadMap: Record<string, number>;
  activeConversationId: string | null;
};

type Action =
  | { type: 'SET_UNREAD_MAP'; map: Record<string, number> }
  | { type: 'INCREMENT'; conversationId: string; delta: number }
  | { type: 'MARK_READ'; conversationId: string }
  | { type: 'SET_ACTIVE'; id: string | null };

function totalUnread(map: Record<string, number>): number {
  return Object.values(map).reduce((s, v) => s + v, 0);
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_UNREAD_MAP':
      return { ...state, unreadMap: action.map };

    case 'INCREMENT': {
      const prev = state.unreadMap[action.conversationId] ?? 0;
      return {
        ...state,
        unreadMap: {
          ...state.unreadMap,
          [action.conversationId]: Math.max(0, prev + action.delta),
        },
      };
    }

    case 'MARK_READ':
      return {
        ...state,
        unreadMap: { ...state.unreadMap, [action.conversationId]: 0 },
      };

    case 'SET_ACTIVE':
      return { ...state, activeConversationId: action.id };

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const MessagingContext = createContext<MessagingContextValue>({
  totalUnread: 0,
  unreadMap: {},
  activeConversationId: null,
  setActiveConversationId: () => {},
  markConversationRead: () => {},
  incrementUnread: () => {},
  refreshUnread: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

const SOCKET_CONNECT_DELAY_MS = 450;

export function MessagingProvider({ children }: { children: React.ReactNode }) {
  const { mounted: sessionReady } = useSession();
  const { isAuthenticated } = useAuthenticatedSession();

  const [state, dispatch] = useReducer(reducer, {
    unreadMap: {},
    activeConversationId: null,
  });

  const queryClient = useQueryClient();
  const socketRef = useRef<ReturnType<typeof createMessagingSocket> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Tracks whether the API is reachable — updated by cfb:api-online/offline events
  const apiOnlineRef = useRef(true);
  // Ref-tracked active conversation ID — avoids stale closure in socket callbacks
  const activeConversationIdRef = useRef<string | null>(null);

  // Keep ref in sync with reducer state (runs synchronously after every render)
  useEffect(() => {
    activeConversationIdRef.current = state.activeConversationId;
  }, [state.activeConversationId]);

  // ── Bootstrap unread map from REST ──────────────────────────────────────────
  const refreshUnread = useCallback(async () => {
    if (!isAuthenticated || !apiOnlineRef.current) return;
    try {
      // Through the shared cache: the write below reaches the map via the
      // subscription, and every list reading the same key sees it too.
      await queryClient.fetchQuery({
        queryKey: queryKeys.conversationsList,
        queryFn: listMessageConversations,
        staleTime: 0,
      });
    } catch {
      // silently ignore — stale values are acceptable
    }
  }, [isAuthenticated, queryClient]);

  // An observer on the shared list, so `invalidateQueries(qk('conversations'))`
  // (a report, a thread, a realtime event) refetches it and the count follows.
  // Without one, an invalidation only marked the entry stale.
  const apiAvailable = useApiAvailability();
  useQuery({
    queryKey: queryKeys.conversationsList,
    queryFn: listMessageConversations,
    enabled: sessionReady && isAuthenticated && apiAvailable,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: 0,
  });

  // Every write to the conversation list - this store's refresh, /messages,
  // the chat popup, a mark-read below - sets the map it implies.
  useEffect(() => {
    const initial = unreadMapOf(queryClient.getQueryData<ConversationList>(queryKeys.conversationsList));
    if (initial) dispatch({ type: 'SET_UNREAD_MAP', map: initial });
    const hash = JSON.stringify(queryKeys.conversationsList);
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || JSON.stringify(event.query.queryKey) !== hash) return;
      const map = unreadMapOf(event.query.state.data as ConversationList | undefined);
      if (map) dispatch({ type: 'SET_UNREAD_MAP', map });
    });
  }, [queryClient]);

  // ── Track API availability — pause everything when server is down ────────────
  useEffect(() => {
    const handleOffline = () => {
      apiOnlineRef.current = false;
      // Disconnect socket immediately — Socket.IO will reconnect via its own
      // backoff policy when the server comes back up.
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
    const handleOnline = () => {
      apiOnlineRef.current = true;
      // Re-bootstrap unread count and reconnect socket if session is active
      if (sessionReady && isAuthenticated && !socketRef.current) {
        refreshUnread();
        const socket = createMessagingSocket();
        socketRef.current = socket;
        socket.on('message:new', ({ message }: { message: MessageItem }) => {
          const convId = message.conversationId;
          if (!convId) return;
          if (activeConversationIdRef.current !== convId) {
            dispatch({ type: 'INCREMENT', conversationId: convId, delta: 1 });
          }
        });
      }
    };
    window.addEventListener('cfb:api-offline', handleOffline);
    window.addEventListener('cfb:api-online', handleOnline);
    return () => {
      window.removeEventListener('cfb:api-offline', handleOffline);
      window.removeEventListener('cfb:api-online', handleOnline);
    };
  }, [sessionReady, isAuthenticated, refreshUnread]);

  // ── Shared socket for unread tracking only ──────────────────────────────────
  // This socket listens for new-message events to update the unread count in
  // real time, regardless of whether the popup or full-page is open.
  // ChatPopup and MessagesPage still maintain their OWN sockets for sending /
  // receiving full message objects — this one is only for the count.
  useEffect(() => {
    if (!sessionReady || !isAuthenticated) return;

    let cancelled = false;
    let socket: ReturnType<typeof createMessagingSocket> | null = null;

    const connectTimer = setTimeout(() => {
      void (async () => {
        if (cancelled) return;

        if (isApiCircuitOpen()) {
          const ok = await probeApiHealth();
          if (!ok || cancelled) return;
        }

        refreshUnread();

        socket = createMessagingSocket();
        socketRef.current = socket;

        socket.on('message:new', ({ message }: { message: MessageItem }) => {
          const convId = message.conversationId;
          if (!convId) return;
          if (activeConversationIdRef.current !== convId) {
            dispatch({ type: 'INCREMENT', conversationId: convId, delta: 1 });
          }
        });
      })();
    }, SOCKET_CONNECT_DELAY_MS);

    // Periodic refresh every 90 s as a safety net — skipped if API is offline
    refreshTimerRef.current = setInterval(() => {
      if (apiOnlineRef.current) refreshUnread();
    }, 90_000);

    return () => {
      cancelled = true;
      clearTimeout(connectTimer);
      socket?.disconnect();
      socketRef.current = null;
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady, isAuthenticated]);

  // Re-run refreshUnread when auth changes (login/logout)
  useEffect(() => {
    if (sessionReady && isAuthenticated) refreshUnread();
    if (!isAuthenticated) dispatch({ type: 'SET_UNREAD_MAP', map: {} });
  }, [sessionReady, isAuthenticated, refreshUnread]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  // Zero the row in the shared list as well, so a list read after this does
  // not bring the old count back.
  const zeroCachedRow = useCallback((conversationId: string) => {
    queryClient.setQueryData<ConversationList>(queryKeys.conversationsList, (old) =>
      old?.conversations
        ? { ...old, conversations: old.conversations.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)) }
        : old,
    );
  }, [queryClient]);

  const setActiveConversationId = useCallback((id: string | null) => {
    dispatch({ type: 'SET_ACTIVE', id });
    // Clear unread immediately when a conversation is activated
    if (id) {
      dispatch({ type: 'MARK_READ', conversationId: id });
      zeroCachedRow(id);
    }
  }, [zeroCachedRow]);

  const markConversationRead = useCallback((conversationId: string) => {
    dispatch({ type: 'MARK_READ', conversationId });
    zeroCachedRow(conversationId);
  }, [zeroCachedRow]);

  const incrementUnread = useCallback(
    (conversationId: string, delta = 1) => {
      if (state.activeConversationId === conversationId) return;
      dispatch({ type: 'INCREMENT', conversationId, delta });
    },
    [state.activeConversationId],
  );

  return (
    <MessagingContext.Provider
      value={{
        totalUnread: totalUnread(state.unreadMap),
        unreadMap: state.unreadMap,
        activeConversationId: state.activeConversationId,
        setActiveConversationId,
        markConversationRead,
        incrementUnread,
        refreshUnread,
      }}
    >
      {children}
    </MessagingContext.Provider>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Full context — use in surfaces that need to drive conversation selection */
export function useMessaging(): MessagingContextValue {
  return useContext(MessagingContext);
}

/** Lightweight hook for ChatBubble badge — only subscribes to totalUnread */
export function useMessagingUnreadCount(): number {
  return useContext(MessagingContext).totalUnread;
}
