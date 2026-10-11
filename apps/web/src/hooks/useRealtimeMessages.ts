import { useEffect, useCallback, useState } from 'react';
import { useWebSocket } from './useWebSocket';
import { useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt?: string;
  /** Present only while an optimistic message is awaiting its server ack. */
  tempId?: string;
  /** emoji -> userIds who reacted with it */
  reactions?: Record<string, string[]>;
  sender: {
    id: string;
    profile: {
      displayName: string;
      avatarUrl?: string;
    };
  };
}

/**
 * Shape of the infinite-query cache these handlers patch in place.
 * Every updater below took `old: any`, so a change to the page shape would
 * have produced a silently empty thread instead of a type error.
 */
interface MessagePage {
  messages: Message[];
  nextCursor?: string | null;
}

interface MessagesCache {
  pages: MessagePage[];
  pageParams: unknown[];
}

/** Applies `fn` to every message in the cache, leaving the pages intact. */
function mapCachedMessages(
  old: MessagesCache | undefined,
  fn: (msg: Message) => Message,
): MessagesCache | undefined {
  if (!old?.pages) return old;
  return {
    ...old,
    pages: old.pages.map((page) => ({ ...page, messages: page.messages.map(fn) })),
  };
}

/** Prepends a message to the newest page. */
function prependCachedMessage(
  old: MessagesCache | undefined,
  message: Message,
): MessagesCache | undefined {
  if (!old?.pages) return old;
  const pages = [...old.pages];
  if (pages[0]?.messages) {
    pages[0] = { ...pages[0], messages: [message, ...pages[0].messages] };
  }
  return { ...old, pages };
}

interface TypingIndicator {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

interface ReadReceipt {
  messageId: string;
  userId: string;
  readAt: string;
}

interface MessageReaction {
  messageId: string;
  userId: string;
  emoji: string;
}

export function useRealtimeMessages(conversationId?: string) {
  const queryClient = useQueryClient();
  const { socket, connected, emit, on } = useWebSocket();
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  // Join conversation
  useEffect(() => {
    if (!connected || !conversationId) return;
    emit('conversation:join', { conversationId });
  }, [connected, conversationId, emit]);

  // Handle new messages
  useEffect(() => {
    if (!connected) return;

    return on('message:new', ({ message }: { message: Message }) => {
      // Update messages query cache
      queryClient.setQueryData(
        qk('messages', message.conversationId),
        (old: MessagesCache | undefined) => prependCachedMessage(old, message),
      );

      // Update conversation list
      queryClient.invalidateQueries({ queryKey: qk('conversations') });
    });
  }, [connected, on, queryClient]);

  // Handle message acknowledgments
  useEffect(() => {
    if (!connected) return;

    return on('message:ack', ({ tempId, message }: { tempId: string | null; message: Message }) => {
      if (!tempId) return;

      // Replace optimistic message with real one
      queryClient.setQueryData(
        qk('messages', message.conversationId),
        (old: MessagesCache | undefined) =>
          mapCachedMessages(old, (msg) =>
            msg.tempId === tempId ? { ...message, tempId: undefined } : msg,
          ),
      );
    });
  }, [connected, on, queryClient]);

  // Handle typing indicators
  useEffect(() => {
    if (!connected) return;

    return on('typing:update', ({ conversationId: convId, userId, isTyping }: TypingIndicator) => {
      if (convId !== conversationId) return;

      setTypingUsers((prev) => {
        const next = new Set(prev);
        if (isTyping) {
          next.add(userId);
        } else {
          next.delete(userId);
        }
        return next;
      });

      // Auto-clear typing indicator after 5 seconds
      if (isTyping) {
        setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Set(prev);
            next.delete(userId);
            return next;
          });
        }, 5000);
      }
    });
  }, [connected, conversationId, on]);

  // Handle read receipts
  useEffect(() => {
    if (!connected) return;

    return on('message:read', ({ messageId, userId, readAt }: ReadReceipt) => {
      queryClient.setQueryData(
        qk('messages', conversationId),
        (old: MessagesCache | undefined) =>
          mapCachedMessages(old, (msg) => (msg.id === messageId ? { ...msg, readAt } : msg)),
      );
    });
  }, [connected, conversationId, on, queryClient]);

  // Handle reactions
  useEffect(() => {
    if (!connected) return;

    return on('message:reaction', ({ messageId, userId, emoji }: MessageReaction) => {
      queryClient.setQueryData(
        qk('messages', conversationId),
        (old: MessagesCache | undefined) =>
          mapCachedMessages(old, (msg) => {
            if (msg.id !== messageId) return msg;
            const reactions = msg.reactions ?? {};
            const current = reactions[emoji] ?? [];
            const hasReacted = current.includes(userId);
            return {
              ...msg,
              reactions: {
                ...reactions,
                [emoji]: hasReacted
                  ? current.filter((id) => id !== userId)
                  : [...current, userId],
              },
            };
          }),
      );
    });
  }, [connected, conversationId, on, queryClient]);

  // Send message
  const sendMessage = useCallback(
    (body: string, attachmentIds?: string[]) => {
      if (!connected || !conversationId) return;

      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const userId = localStorage.getItem('userId') || '';

      // Optimistic update
      const optimisticMessage: Message = {
        id: tempId,
        tempId,
        conversationId,
        senderId: userId,
        body,
        createdAt: new Date().toISOString(),
        sender: {
          id: userId,
          profile: {
            displayName: 'You',
            avatarUrl: localStorage.getItem('userAvatar') || undefined,
          },
        },
      };

      queryClient.setQueryData(
        qk('messages', conversationId),
        (old: MessagesCache | undefined) => {
          if (!old?.pages) return old;
          const newPages = [...old.pages];
          if (newPages[0]?.messages) {
            newPages[0] = {
              ...newPages[0],
              messages: [optimisticMessage, ...newPages[0].messages],
            };
          }
          return { ...old, pages: newPages };
        }
      );

      // Send to server
      emit('message:send', {
        conversationId,
        body,
        tempId,
        attachmentUploadIds: attachmentIds,
      });
    },
    [connected, conversationId, emit, queryClient]
  );

  // Send typing indicator
  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (!connected || !conversationId) return;
      emit('typing:start', { conversationId, isTyping });
    },
    [connected, conversationId, emit]
  );

  // Mark message as read
  const markAsRead = useCallback(
    (messageId: string) => {
      if (!connected || !conversationId) return;
      emit('message:markRead', { conversationId, messageId });
    },
    [connected, conversationId, emit]
  );

  // React to message
  const reactToMessage = useCallback(
    (messageId: string, emoji: string) => {
      if (!connected) return;
      emit('message:react', { messageId, emoji });
    },
    [connected, emit]
  );

  return {
    connected,
    typingUsers: Array.from(typingUsers),
    sendMessage,
    setTyping,
    markAsRead,
    reactToMessage,
  };
}
