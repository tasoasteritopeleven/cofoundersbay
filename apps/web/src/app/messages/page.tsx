'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { ConversationList, type Conversation } from '@/components/messaging/ConversationList';
import { ChatWindow, NoChatSelected, type Message } from '@/components/messaging/ChatWindow';
import { ReportBlockModal } from '@/components/common/ReportBlockModal';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { RoleBadge } from '@/components/common/RoleBadge';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { useToast } from '@/components/ui/toast';
import { BilingualText } from '@/components/common/BilingualText';
import { PageContextualHelp } from '@/components/common/PageContextualHelp';
import { CfbGlyph } from '@/components/icons/CfbGlyph';
import { ThreadAvatar } from '@/components/messaging/ThreadAvatar';
import { CardHead } from '@/components/common/CardAnatomy';
import {
  messagesEn,
  messagesEl,
  useMessagesPrimaryText,
  PREVIEW_MESSAGE_EL,
} from '@/lib/i18n/strings-messages';
import { bilingualAria } from '@/lib/i18n/format';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';
import { cn } from '@/lib/utils';
import { usePopupChat } from '@/contexts/PopupChatContext';
import { ComposeMessageDialog, candidatesFromInbox } from './ComposeMessageDialog';
import {
  getOrCreateDirectConversation,
  listConversationMessages,
  listMessageConversations,
  updateConversationFlags,
  uploadMessageAttachment,
  listConnectionRequests,
  respondToConnectionRequest,
  getMe,
  ApiError,
  type ConversationSummary,
  type MessageItem,
  type ConnectionRequestItem,
} from '@/lib/api';
import { createMessagingSocket, type ServerToClientEvents } from '@/lib/messagingSocket';
import { useSession } from '@/hooks/useSession';
import { isPreviewDemo } from '@/lib/preview-demo';
import { useMessaging } from '@/contexts/MessagingContext';
import { queryKeys } from '@/lib/query-keys';
import { choiceControl, rowOptions, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { useQueryClient } from '@tanstack/react-query';
import type { ConversationValidationState } from '@/components/messaging/ConversationValidation';

function mapConversation(s: ConversationSummary): Conversation {
  const lastAt = s.lastMessage?.createdAt ?? s.updatedAt;
  return {
    id: s.id,
    recipientId: s.recipient?.id ?? 'unknown',
    recipientName: s.recipient?.displayName ?? 'Unknown user',
    recipientAvatar: s.recipient?.avatarUrl ?? null,
    recipientRole: s.recipient?.role || 'founder',
    recipientHeadline: s.recipient?.headline ?? null,
    lastMessage: s.lastMessage?.body ?? '',
    lastMessageTime: new Date(lastAt),
    unreadCount: s.unreadCount ?? 0,
    isPinned: s.isPinned ?? false,
    isArchived: s.isArchived ?? false,
    isOnline: s.recipient?.isOnline ?? false,
  };
}

function mapMessage(m: MessageItem, currentUserId: string): Message {
  return {
    id: m.id,
    senderId: m.senderId,
    content: m.body,
    timestamp: new Date(m.createdAt),
    status: m.senderId === currentUserId ? 'sent' : 'read',
    attachments: m.attachments?.length
      ? m.attachments.map((a) => ({
          type: a.mimeType ?? 'file',
          url: a.url,
          name: a.fileName ?? 'attachment',
        }))
      : undefined,
  };
}

function IntroDetailPane({
  request,
  responding,
  onAccept,
  onDecline,
  locale,
  onBack,
}: {
  request: ConnectionRequestItem | null;
  responding: boolean;
  onAccept: () => void;
  onDecline: () => void;
  locale: 'en' | 'el';
  onBack?: () => void;
}) {
  if (!request) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center overflow-hidden p-8 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.1),transparent_58%)]"
        />
        <div className="relative flex max-w-sm flex-col items-center gap-4">
          <CfbGlyph name="people" className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">
            <BilingualText en={messagesEn('no_pending')} el={messagesEl('no_pending')} />
          </p>
          <p className="text-xs text-muted-foreground">
            <BilingualText en={messagesEn('intro_empty_hint')} el={messagesEl('intro_empty_hint')} />
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild size="sm" variant="outline" className="rounded-full">
              <Link href="/matches">
                <CfbGlyph name="matches" className="icon-sm mr-1.5" />
                <BilingualText en={messagesEn('browse_matches')} el={messagesEl('browse_matches')} compact />
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="rounded-full">
              <Link href="/discover">
                <CfbGlyph name="discover" className="icon-sm mr-1.5" />
                <BilingualText en={messagesEn('find_people')} el={messagesEl('find_people')} compact />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const quoteEl = request.message ? PREVIEW_MESSAGE_EL[request.message] : undefined;
  const dateLabel = new Date(request.createdAt).toLocaleDateString(locale === 'el' ? 'el-GR' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="relative flex h-full flex-col overflow-y-auto bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_52%)]"
      />
      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-col gap-5 px-6 py-10">
        {onBack && (
          <Button variant="ghost" size="sm" className="mb-1 w-fit rounded-full md:hidden" onClick={onBack}>
            <BilingualText en={messagesEn('back_to_conversations')} el={messagesEl('back_to_conversations')} compact />
          </Button>
        )}
        <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <BilingualText en={messagesEn('connection_request')} el={messagesEl('connection_request')} compact />
        </p>
        {/* The request as its card shows it: the person's mark, the name with
            the role beside it and the headline under it, the date at the
            right; the note under them starts on the mark's edge. */}
        <CardHead
          titleAs="p"
          mark={(
            <Link href={`/profiles/${request.requester.id}`} aria-label={bilingualAria(`Open ${request.requester.displayName}'s profile`, `Άνοιγμα προφίλ: ${request.requester.displayName}`)}>
              <ThreadAvatar
                name={request.requester.displayName}
                src={request.requester.avatarUrl}
                seed={request.requester.id}
                size="md"
              />
            </Link>
          )}
          title={(
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <Link href={`/profiles/${request.requester.id}`} className="transition-colors hover:text-primary-accessible">
                {request.requester.displayName}
              </Link>
              <RoleBadge role={request.requester?.role || 'founder'} size="sm" />
            </span>
          )}
          subtitle={request.requester?.headline || (
            <BilingualText en={messagesEn('headline_fallback')} el={messagesEl('headline_fallback')} compact />
          )}
          aside={dateLabel}
        />
        {request.message && (
          <blockquote className="card-body italic text-muted-foreground">
            {quoteEl ? (
              <BilingualText en={request.message} el={quoteEl} wrap />
            ) : (
              request.message
            )}
          </blockquote>
        )}
        <p className="text-xs text-muted-foreground">
          <BilingualText en={messagesEn('intro_accept_to_chat')} el={messagesEl('intro_accept_to_chat')} />
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="gap-1.5"
            disabled={responding}
            onClick={onAccept}
          >
            <Check className="icon-sm" />
            <BilingualText en={messagesEn('accept')} el={messagesEl('accept')} compact />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={responding}
            onClick={onDecline}
          >
            <X className="icon-sm" />
            <BilingualText en={messagesEn('decline')} el={messagesEl('decline')} compact />
          </Button>
        </div>
        {/* Outline, not ghost: a ghost button that starts the row put its
            padding in front of its letters, off the pane's left edge. */}
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button asChild size="sm" variant="outline">
            <Link href={`/profiles/${request.requester.id}`}>
              <CfbGlyph name="people" className="icon-sm mr-1.5" />
              <BilingualText en={messagesEn('view_profile')} el={messagesEl('view_profile')} compact />
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/matches/${request.requester.id}`}>
              <CfbGlyph name="matches" className="icon-sm mr-1.5" />
              <BilingualText en={messagesEn('view_match')} el={messagesEl('view_match')} compact />
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/discover">
              <CfbGlyph name="discover" className="icon-sm mr-1.5" />
              <BilingualText en={messagesEn('discover_people')} el={messagesEl('discover_people')} compact />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { success, error: showError } = useToast();
  const t = useMessagesPrimaryText();
  const { primary } = useLanguagePreference();
  const { open: openAskAi } = usePopupChat();
  const { hasSession, mounted: sessionReady } = useSession();
  const canUseMessaging = sessionReady && (hasSession || isPreviewDemo());
  const openInboxAi = useCallback(() => openAskAi(undefined, 'ai'), [openAskAi]);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isMobileViewingChat, setIsMobileViewingChat] = useState(false);
  const [isRecipientTyping, setIsRecipientTyping] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'chats' | 'intros'>('chats');
  const [introRequests, setIntroRequests] = useState<ConnectionRequestItem[]>([]);
  const [acceptedConnections, setAcceptedConnections] = useState<ConnectionRequestItem[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [introLoading, setIntroLoading] = useState(false);
  const [introResponding, setIntroResponding] = useState<Record<string, boolean>>({});
  const [selectedIntroId, setSelectedIntroId] = useState<string | null>(null);
  const [composerDraft, setComposerDraft] = useState<string | undefined>();
  const [reportBlockModal, setReportBlockModal] = useState<{ open: boolean; mode: 'report' | 'block' | 'both' }>({ open: false, mode: 'both' });
  const [validationStates, setValidationStates] = useState<Record<string, ConversationValidationState>>({});
  const { setActiveConversationId, markConversationRead } = useMessaging();
  // Every list this page fetches is published to the shared conversation
  // cache, which the unread badges derive from (MessagingContext).
  const queryClient = useQueryClient();

  useEffect(() => {
    return () => { setActiveConversationId(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const socketRef = useRef<ReturnType<typeof createMessagingSocket> | null>(null);
  const selectedConversationIdRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string>('');

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversation?.id ?? null;
  }, [selectedConversation]);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  // Bootstrap: auth, conversations, socket
  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    if (!hasSession && !isPreviewDemo()) {
      router.replace('/login');
      return;
    }

    let mounted = true;
    let socket: ReturnType<typeof createMessagingSocket> | null = null;

    const onNew: ServerToClientEvents['message:new'] = ({ message }) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== message.conversationId) return c;
          const isSelected = selectedConversationIdRef.current === c.id;
          return {
            ...c,
            lastMessage: message.body,
            lastMessageTime: new Date(message.createdAt),
            unreadCount: isSelected ? 0 : (c.unreadCount ?? 0) + 1,
          };
        }),
      );

      if (selectedConversationIdRef.current === message.conversationId) {
        setMessages((prev) => [...prev, mapMessage(message, currentUserIdRef.current)]);
      }
    };

    const onAck: ServerToClientEvents['message:ack'] = ({ tempId, message }) => {
      if (!tempId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                id: message.id,
                timestamp: new Date(message.createdAt),
                status: 'sent',
                attachments: mapMessage(message, currentUserIdRef.current).attachments,
              }
            : m,
        ),
      );

      setConversations((prev) =>
        prev.map((c) =>
          c.id === message.conversationId
            ? { ...c, lastMessage: message.body, lastMessageTime: new Date(message.createdAt), unreadCount: 0 }
            : c,
        ),
      );
    };

    const onTypingStart: ServerToClientEvents['typing:start'] = ({ conversationId }) => {
      if (selectedConversationIdRef.current === conversationId) {
        setIsRecipientTyping(true);
      }
    };

    const onTypingStop: ServerToClientEvents['typing:stop'] = ({ conversationId }) => {
      if (selectedConversationIdRef.current === conversationId) {
        setIsRecipientTyping(false);
      }
    };

    const onPresence: ServerToClientEvents['presence:update'] = ({ userId, isOnline }) => {
      setConversations((prev) =>
        prev.map((c) => (c.recipientId === userId ? { ...c, isOnline } : c))
      );
    };

    const bootstrap = async () => {
      try {
        const rawUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
        let resolvedUserId = '';

        if (rawUser) {
          try {
            resolvedUserId = (JSON.parse(rawUser) as { id?: string }).id ?? '';
          } catch {
            resolvedUserId = '';
          }
        }

        if (!resolvedUserId) {
          const { user } = await getMe();
          resolvedUserId = user.id;

          if (typeof window !== 'undefined') {
            let fallbackUser: Record<string, unknown> = {};
            if (rawUser) {
              try {
                fallbackUser = JSON.parse(rawUser) as Record<string, unknown>;
              } catch {
                fallbackUser = {};
              }
            }
            localStorage.setItem('user', JSON.stringify({
              ...fallbackUser,
              id: user.id,
              email: fallbackUser.email ?? user.email,
              role: fallbackUser.role ?? user.role,
            }));
            window.dispatchEvent(new CustomEvent('cfb:user'));
          }
        }

        if (!mounted) return;
        setCurrentUserId(resolvedUserId);

        const { conversations: list } = await listMessageConversations();
        queryClient.setQueryData(queryKeys.conversationsList, { conversations: list });
        if (!mounted) return;
        setConversations(list.map(mapConversation));

        socket = createMessagingSocket();
        socketRef.current = socket;
        socket.on('message:new', onNew);
        socket.on('message:ack', onAck);
        socket.on('typing:start', onTypingStart);
        socket.on('typing:stop', onTypingStop);
        socket.on('presence:update', onPresence);
      } catch (error) {
        if (!mounted) return;
        if (error instanceof ApiError && error.status === 401 && !isPreviewDemo()) {
          router.replace('/login');
          return;
        }
        const previewDemo =
          typeof document !== 'undefined' &&
          (document.cookie.includes('cfb_preview_demo=1') ||
            window.localStorage.getItem('cfb_demo_data') === '1');
        if (!previewDemo) {
          showError(
            t(messagesEn('init_fail'), messagesEl('init_fail')),
            error instanceof Error ? error.message : t(messagesEn('try_again'), messagesEl('try_again')),
          );
        }
      }
    };

    void bootstrap();

    return () => {
      mounted = false;
      socket?.off('message:new', onNew);
      socket?.off('message:ack', onAck);
      socket?.off('typing:start', onTypingStart);
      socket?.off('typing:stop', onTypingStop);
      socket?.off('presence:update', onPresence);
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [hasSession, router, sessionReady, showError]);

  // Load pending intro (connection) requests
  const loadIntroRequests = useCallback(async () => {
    if (!canUseMessaging) {
      return;
    }

    setIntroLoading(true);
    try {
      const [{ connections: received }, { connections: accepted }] = await Promise.all([
        listConnectionRequests({ type: 'received', limit: 50 }),
        listConnectionRequests({ type: 'accepted', limit: 50 }),
      ]);
      setIntroRequests(received.filter((c) => c.status === 'pending'));
      setAcceptedConnections(accepted.filter((c) => c.status === 'accepted'));
    } catch {
      // silently fail
    } finally {
      setIntroLoading(false);
    }
  }, [canUseMessaging]);

  useEffect(() => {
    if (!canUseMessaging) {
      return;
    }

    loadIntroRequests();
  }, [canUseMessaging, loadIntroRequests]);

  const handleIntroRespond = async (id: string, action: 'accepted' | 'declined') => {
    setIntroResponding((prev) => ({ ...prev, [id]: true }));
    try {
      await respondToConnectionRequest(id, action);
      setIntroRequests((prev) => prev.filter((r) => r.id !== id));
      success(
        action === 'accepted'
          ? t(messagesEn('connection_accepted'), messagesEl('connection_accepted'))
          : t(messagesEn('request_declined'), messagesEl('request_declined')),
        action === 'accepted'
          ? t(messagesEn('connection_accepted_hint'), messagesEl('connection_accepted_hint'))
          : undefined,
      );
      if (action === 'accepted') {
        const { connections: updated } = await listConnectionRequests({ type: 'received', limit: 50 });
        const accepted = updated.find((c) => c.id === id);
        if (accepted) {
          const { conversationId } = await getOrCreateDirectConversation(accepted.requesterId);
          const { conversations: list } = await listMessageConversations();
          queryClient.setQueryData(queryKeys.conversationsList, { conversations: list });
          const mapped = list.map(mapConversation);
          setConversations(mapped);
          const conv = mapped.find((c) => c.id === conversationId);
          if (conv) {
            setSidebarTab('chats');
            setSelectedConversation(conv);
            setIsMobileViewingChat(true);
          }
        }
      }
    } catch (e) {
      showError(
        t(messagesEn('action_fail'), messagesEl('action_fail')),
        e instanceof Error ? e.message : t(messagesEn('try_again'), messagesEl('try_again')),
      );
    } finally {
      setIntroResponding((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleComposePick = async (userId: string) => {
    setComposeOpen(false);
    try {
      const { conversationId } = await getOrCreateDirectConversation(userId);
      socketRef.current?.emit('conversation:join', { conversationId });
      const { conversations: list } = await listMessageConversations();
      queryClient.setQueryData(queryKeys.conversationsList, { conversations: list });
      const mapped = list.map(mapConversation);
      setConversations(mapped);
      const conv = mapped.find((c) => c.id === conversationId);
      if (conv) {
        setSidebarTab('chats');
        setSelectedConversation(conv);
        setActiveConversationId(conv.id);
        setIsMobileViewingChat(true);
      }
    } catch (e) {
      showError(
        t(messagesEn('start_fail'), messagesEl('start_fail')),
        e instanceof Error ? e.message : t(messagesEn('try_again'), messagesEl('try_again')),
      );
    }
  };

  // Handle URL param for direct messaging
  const toUserId = searchParams?.get('to');
  const openConversationId = searchParams?.get('c');
  useEffect(() => {
    if (!canUseMessaging || !toUserId || openConversationId) return;

    let cancelled = false;
    const run = async () => {
      try {
        const { conversationId } = await getOrCreateDirectConversation(toUserId);
        socketRef.current?.emit('conversation:join', { conversationId });

        const { conversations: list } = await listMessageConversations();
        queryClient.setQueryData(queryKeys.conversationsList, { conversations: list });
        if (cancelled) return;
        const mapped = list.map(mapConversation);
        setConversations(mapped);
        const conv = mapped.find((c) => c.id === conversationId);
        if (conv) {
          setSelectedConversation(conv);
          setIsMobileViewingChat(true);
        }
      } catch (e) {
        if (cancelled) return;
        showError(
          t(messagesEn('start_fail'), messagesEl('start_fail')),
          e instanceof Error ? e.message : t(messagesEn('try_again'), messagesEl('try_again')),
        );
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [canUseMessaging, toUserId, showError, openConversationId]);

  // Handle URL param for opening an existing conversation
  useEffect(() => {
    if (!canUseMessaging || !openConversationId) return;
    const conv = conversations.find((c) => c.id === openConversationId);
    if (!conv) return;
    setSelectedConversation(conv);
    setIsMobileViewingChat(true);
    socketRef.current?.emit('conversation:join', { conversationId: conv.id });
  }, [canUseMessaging, openConversationId, conversations]);

  // Reset typing indicator when conversation changes
  useEffect(() => {
    setIsRecipientTyping(false);
  }, [selectedConversation?.id]);

  // Load messages when conversation is selected
  useEffect(() => {
    if (!canUseMessaging || !selectedConversation) {
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        const { messages: list } = await listConversationMessages(selectedConversation.id, 200);
        if (cancelled) return;
        setMessages(list.map((m) => mapMessage(m, currentUserId)));
        setConversations((prev) =>
          prev.map((c) => (c.id === selectedConversation.id ? { ...c, unreadCount: 0 } : c)),
        );
        socketRef.current?.emit('conversation:join', { conversationId: selectedConversation.id });
      } catch (e) {
        if (cancelled) return;
        showError(
          t(messagesEn('load_fail'), messagesEl('load_fail')),
          e instanceof Error ? e.message : t(messagesEn('try_again'), messagesEl('try_again')),
        );
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [canUseMessaging, selectedConversation, currentUserId, showError]);

  // Desktop: open the most relevant thread so the right pane is not an empty void.
  useEffect(() => {
    if (!canUseMessaging || selectedConversation || toUserId || openConversationId) return;
    if (typeof window === 'undefined' || window.matchMedia('(max-width: 767px)').matches) return;
    const live = conversations.filter((c) => !c.isArchived);
    if (!live.length) return;
    const first =
      live.find((c) => c.unreadCount > 0) ??
      live.find((c) => c.isPinned) ??
      live[0];
    setSelectedConversation(first);
    setActiveConversationId(first.id);
    markConversationRead(first.id);
  }, [
    canUseMessaging,
    conversations,
    selectedConversation,
    toUserId,
    openConversationId,
    setActiveConversationId,
    markConversationRead,
  ]);

  useEffect(() => {
    if (selectedIntroId && introRequests.some((r) => r.id === selectedIntroId)) return;
    setSelectedIntroId(introRequests[0]?.id ?? null);
  }, [introRequests, selectedIntroId]);

  useEffect(() => {
    if (searchParams?.get('action') !== 'schedule' || !selectedConversation) {
      return;
    }
    setComposerDraft(t(messagesEn('schedule_draft'), messagesEl('schedule_draft')));
  }, [searchParams, selectedConversation?.id, t]);

  // Typing indicator emit
  const handleTypingStart = useCallback(() => {
    if (selectedConversation) {
      socketRef.current?.emit('typing:start', { conversationId: selectedConversation.id });
    }
  }, [selectedConversation]);

  const handleTypingStop = useCallback(() => {
    if (selectedConversation) {
      socketRef.current?.emit('typing:stop', { conversationId: selectedConversation.id });
    }
  }, [selectedConversation]);

  // Handle send message
  const handleSendMessage = async (content: string, attachments?: File[]) => {
    if (!selectedConversation) return;
    const s = socketRef.current;
    const preview = isPreviewDemo();
    if (!preview && (!s || !s.connected)) {
      showError(
        t(messagesEn('not_connected'), messagesEl('not_connected')),
        t(messagesEn('reconnect'), messagesEl('reconnect')),
      );
      return;
    }

    const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const newMessage: Message = {
      id: tempId,
      senderId: currentUserId,
      content,
      timestamp: new Date(),
      status: preview && (!s || !s.connected) ? 'sent' : 'sending',
      attachments: attachments?.length
        ? attachments.slice(0, 5).map((f) => ({ type: f.type || 'file', url: '', name: f.name }))
        : undefined,
    };

    setMessages((prev) => [...prev, newMessage]);
    setComposerDraft(undefined);

    if (preview && (!s || !s.connected)) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConversation.id
            ? { ...c, lastMessage: content, lastMessageTime: new Date() }
            : c,
        ),
      );
      return;
    }

    if (!s) return;

    let attachmentUploadIds: string[] | undefined = undefined;
    if (attachments?.length) {
      const results = await Promise.allSettled(attachments.slice(0, 5).map((f) => uploadMessageAttachment(f)));
      const ok = results
        .map((r) => (r.status === 'fulfilled' ? r.value.upload : null))
        .filter((x): x is NonNullable<typeof x> => x !== null);

      const failed = results.some((r) => r.status === 'rejected');
      if (failed) {
        showError(
          t(messagesEn('attach_fail'), messagesEl('attach_fail')),
          t(messagesEn('attach_fail_hint'), messagesEl('attach_fail_hint')),
        );
      }

      const mapped = ok.map((u) => ({
        type: u.mimeType ?? 'file',
        url: u.url,
        name: u.originalName ?? 'attachment',
      }));

      attachmentUploadIds = ok.length ? ok.map((u) => u.id) : undefined;

      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, attachments: mapped.length ? mapped : undefined } : m)),
      );
    }

    s.emit('message:send', {
      conversationId: selectedConversation.id,
      body: content,
      tempId,
      attachmentUploadIds,
    });

    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConversation.id
          ? { ...c, lastMessage: content, lastMessageTime: new Date() }
          : c
      )
    );
  };

  // Handle pin
  const handlePin = async (id: string): Promise<PageControlRunResult> => {
    const nextPinned = !conversations.find((c) => c.id === id)?.isPinned;
    try {
      await updateConversationFlags(id, { isPinned: nextPinned });
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isPinned: nextPinned } : c)),
      );
      success(
        t(messagesEn('updated'), messagesEl('updated')),
        nextPinned
          ? t(messagesEn('pinned_toast'), messagesEl('pinned_toast'))
          : t(messagesEn('unpinned_toast'), messagesEl('unpinned_toast')),
      );
    } catch (e) {
      showError(
        t(messagesEn('update_fail'), messagesEl('update_fail')),
        e instanceof Error ? e.message : t(messagesEn('try_again'), messagesEl('try_again')),
      );
      return { error: e instanceof Error && e.message ? e.message : 'The conversation did not change.' };
    }
  };

  // Handle archive
  const handleArchive = async (id: string): Promise<PageControlRunResult> => {
    try {
      await updateConversationFlags(id, { isArchived: true });
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, isArchived: true } : c)));
      if (selectedConversation?.id === id) setSelectedConversation(null);
      success(
        t(messagesEn('archived_toast'), messagesEl('archived_toast')),
        t(messagesEn('archived_hint'), messagesEl('archived_hint')),
      );
    } catch (e) {
      showError(
        t(messagesEn('update_fail'), messagesEl('update_fail')),
        e instanceof Error ? e.message : t(messagesEn('try_again'), messagesEl('try_again')),
      );
      return { error: e instanceof Error && e.message ? e.message : 'The conversation was not archived.' };
    }
  };


  const pendingIntrosCount = introRequests.length;
  const unreadTotal = conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
  const composeCandidates = candidatesFromInbox(conversations, acceptedConnections, currentUserId);
  const selectedIntro = introRequests.find((r) => r.id === selectedIntroId) ?? introRequests[0] ?? null;
  const recentForEmpty = conversations
    .filter((c) => !c.isArchived)
    .slice(0, 4)
    .map((c) => ({
      id: c.id,
      name: c.recipientName,
      avatarUrl: c.recipientAvatar,
      userId: c.recipientId,
    }));

  // Offered to the assistant, above the preparing return: Chats / Intros,
  // New message, opening a conversation, and each row's pin / unpin /
  // archive - the same handlers. The conversations go out as a list: who,
  // how many unread, and the last line, which the reader already sees.
  const inbox = conversations.filter((c) => !c.isArchived);
  const byPerson = (list: typeof conversations) => rowOptions(list, (c) => c.id, (c) => c.recipientName);
  usePageList([
    {
      id: 'conversations',
      labelEn: 'Conversations',
      labelEl: 'Συνομιλίες',
      rows: inbox.map((c) => `${c.recipientName}${c.unreadCount ? ` · ${c.unreadCount} unread` : ''}${c.isPinned ? ' · pinned' : ''} · "${c.lastMessage}"`),
    },
  ]);
  usePageControls([
    choiceControl('inbox_tab', 'Inbox section', 'Ενότητα εισερχομένων', [
      { value: 'chats', en: 'Chats', el: 'Συνομιλίες' },
      { value: 'intros', en: 'Intro requests', el: 'Αιτήματα γνωριμίας' },
    ], sidebarTab, (v) => setSidebarTab(v as 'chats' | 'intros')),
    { id: 'new_message', labelEn: 'Start a new message', labelEl: 'Νέο μήνυμα', writes: false, run: () => setComposeOpen(true) },
    {
      id: 'open_conversation',
      labelEn: 'Open conversation with',
      labelEl: 'Άνοιγμα συνομιλίας με',
      writes: false,
      options: byPerson(inbox),
      run: (v) => {
        const conv = inbox.find((c) => c.id === v);
        if (!conv) return;
        setSelectedConversation(conv);
        setActiveConversationId(conv.id);
        markConversationRead(conv.id);
        setIsMobileViewingChat(true);
      },
    },
    // updateConversationFlags sends one flag; pinning and unpinning are each
    // other's opposite. Archive has no opposite on this page.
    { id: 'pin_conversation', labelEn: 'Pin conversation', labelEl: 'Καρφίτσωμα συνομιλίας', writes: true, options: byPerson(inbox.filter((c) => !c.isPinned)), undo: (v) => ({ control: 'unpin_conversation', value: v }), run: (v) => (v ? handlePin(v) : undefined) },
    { id: 'unpin_conversation', labelEn: 'Unpin conversation', labelEl: 'Ξεκαρφίτσωμα συνομιλίας', writes: true, options: byPerson(inbox.filter((c) => c.isPinned)), undo: (v) => ({ control: 'pin_conversation', value: v }), run: (v) => (v ? handlePin(v) : undefined) },
    { id: 'archive_conversation', labelEn: 'Archive conversation', labelEl: 'Αρχειοθέτηση συνομιλίας', writes: true, options: byPerson(inbox), run: (v) => (v ? handleArchive(v) : undefined) },
    // The open chat's header menu: report or block the other person. Both
    // open the same dialog, which asks for the reason and confirms.
    { id: 'report_person', labelEn: 'Report the person in this chat', labelEl: 'Αναφορά του ατόμου της συνομιλίας', writes: false, unavailableEn: selectedConversation ? undefined : 'Open a conversation first.', unavailableEl: selectedConversation ? undefined : 'Ανοίξτε πρώτα μια συνομιλία.', run: () => setReportBlockModal({ open: true, mode: 'report' }) },
    { id: 'block_person', labelEn: 'Block the person in this chat', labelEl: 'Αποκλεισμός του ατόμου της συνομιλίας', writes: false, unavailableEn: selectedConversation ? undefined : 'Open a conversation first.', unavailableEl: selectedConversation ? undefined : 'Ανοίξτε πρώτα μια συνομιλία.', run: () => setReportBlockModal({ open: true, mode: 'block' }) },
  ]);

  const rail: PageRailSection[] = [
    {
      id: 'people',
      glyph: 'discover',
      labelEn: 'Find people',
      labelEl: 'Βρείτε άτομα',
      content: (
        <div className="grid grid-cols-1 gap-2">
          {([
            { href: '/discover', glyph: 'discover' as const, en: messagesEn('find_people'), el: messagesEl('find_people'), hintEn: 'Search the directory.', hintEl: 'Αναζήτηση στον κατάλογο.' },
            { href: '/matches', glyph: 'matches' as const, en: messagesEn('browse_matches'), el: messagesEl('browse_matches'), hintEn: 'Open a ranked match and write from there.', hintEl: 'Ανοίξτε μια κατάταξη και γράψτε από εκεί.' },
          ]).map((step) => (
            <Button key={step.href} asChild variant="outline" className="h-auto min-h-14 justify-start gap-3 whitespace-normal px-3 py-3 text-left">
              <Link href={step.href}>
                <CfbGlyph name={step.glyph} className="icon-sm shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-snug">
                    <BilingualText en={step.en} el={step.el} wrap />
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                    <BilingualText en={step.hintEn} el={step.hintEl} wrap />
                  </span>
                </span>
              </Link>
            </Button>
          ))}
        </div>
      ),
    },
    {
      id: 'network',
      glyph: 'people',
      labelEn: 'Your network',
      labelEl: 'Το δίκτυό σας',
      content: (
        <div className="grid grid-cols-1 gap-2">
          {([
            { href: '/connections', glyph: 'people' as const, en: 'Connections', el: 'Συνδέσεις', hintEn: 'People you already know.', hintEl: 'Άτομα που ήδη γνωρίζετε.' },
            { href: '/calendar', glyph: 'calendar' as const, en: 'Calendar', el: 'Ημερολόγιο', hintEn: 'Schedule the next conversation.', hintEl: 'Προγραμματίστε την επόμενη συνομιλία.' },
          ]).map((step) => (
            <Button key={step.href} asChild variant="outline" className="h-auto min-h-14 justify-start gap-3 whitespace-normal px-3 py-3 text-left">
              <Link href={step.href}>
                <CfbGlyph name={step.glyph} className="icon-sm shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-snug">
                    <BilingualText en={step.en} el={step.el} wrap />
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                    <BilingualText en={step.hintEn} el={step.hintEl} wrap />
                  </span>
                </span>
              </Link>
            </Button>
          ))}
        </div>
      ),
    },
  ];

  if (!canUseMessaging) {
    return (
      <AppShell fullHeight contentClassName="min-h-0" rail={rail}>
        <div className="flex flex-1 items-center justify-center bg-background/40">
          <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
            <BilingualText en={messagesEn('preparing')} el={messagesEl('preparing')} />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell fullHeight contentClassName="min-h-0" rail={rail}>
      <div className="flex h-full min-h-0 flex-col p-2 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:p-3 lg:p-4 lg:pb-4">
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_64px_-28px_hsl(var(--foreground)/0.35)]">
          <div
            className={cn(
              'grid h-full min-h-0 min-w-0 w-full shrink-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden border-r border-border bg-muted/40 md:w-[340px] md:max-w-[340px] lg:w-[392px] lg:max-w-[392px]',
              isMobileViewingChat && 'hidden md:grid',
            )}
          >
            <div className="min-w-0 shrink-0 space-y-3 px-4 pb-3 pt-4">
              {/* The compose button gets its own row. This pane is a fixed 392px
                  at every desktop width, and with the button beside the title the
                  heading block was left 138px of a 365px row -- the lead wrapped
                  to five lines of about 23 characters, at every width, not just
                  the wide ones. A full-width compose action at the top of a list
                  pane is also what the reader expects it to be. */}
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg font-semibold tracking-tight text-foreground">
                    <BilingualText en={messagesEn('page_title')} el={messagesEl('page_title')} />
                  </h1>
                  <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                    <BilingualText en={messagesEn('inbox_lead')} el={messagesEl('inbox_lead')} compact wrap />
                  </p>
                </div>
                <PageContextualHelp defaultOpen={false} compact />
              </div>
              <div>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 w-full gap-1.5 rounded-full px-3 text-xs text-primary-foreground shadow-none"
                  onClick={() => setComposeOpen(true)}
                  aria-label={bilingualAria(messagesEn('new_message'), messagesEl('new_message'))}
                >
                  {t(messagesEn('new_message'), messagesEl('new_message'))}
                </Button>
              </div>
              <button
                type="button"
                onClick={openInboxAi}
                className="flex min-w-0 w-full items-center gap-2.5 overflow-hidden rounded-xl border border-border px-3 py-2 text-left transition-colors hover:bg-muted/40"
              >
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-foreground">
                    {t(messagesEn('ask_ai'), messagesEl('ask_ai'))}
                  </span>
                  {/* line-clamp, not truncate: this hint is a sentence, and one
                      line cut it by a third ("Draft a reply, summarise this thread,
                      or s…"). Two lines still bound the button's height. */}
                  <span className="block line-clamp-2 text-2xs text-muted-foreground">
                    <BilingualText en={messagesEn('ask_ai_hint')} el={messagesEl('ask_ai_hint')} compact wrap />
                  </span>
                </span>
              </button>
            </div>
            <Tabs value={sidebarTab} onValueChange={(v) => setSidebarTab(v as 'chats' | 'intros')} className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
              <div className="shrink-0 px-3 pb-1">
                <TabsList className="flex h-11 w-full overflow-hidden rounded-full bg-background/70 p-1 shadow-sm ring-1 ring-border/40">
                  <TabsTrigger value="chats" className="min-w-0 flex-1 shrink gap-1.5 rounded-full data-[state=active]:shadow-sm">
                    <CfbGlyph name="messages" className="icon-sm" />
                    {t(messagesEn('chats'), messagesEl('chats'))}
                    {unreadTotal > 0 && (
                      <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-2xs font-bold text-primary-foreground">
                        {unreadTotal > 99 ? '99+' : unreadTotal}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="intros" className="min-w-0 flex-1 shrink gap-1.5 rounded-full data-[state=active]:shadow-sm">
                    <CfbGlyph name="people" className="icon-sm" />
                    {t(messagesEn('intros'), messagesEl('intros'))}
                    {pendingIntrosCount > 0 && (
                      <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-2xs font-bold text-accent-foreground">
                        {pendingIntrosCount > 99 ? '99+' : pendingIntrosCount}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="chats" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
                <ConversationList
                  conversations={conversations}
                  selectedId={selectedConversation?.id}
                  onSelect={(conv) => {
                    setSelectedConversation(conv);
                    setActiveConversationId(conv.id);
                    markConversationRead(conv.id);
                    setIsMobileViewingChat(true);
                  }}
                  onNewMessage={() => setComposeOpen(true)}
                  onPin={handlePin}
                  onArchive={handleArchive}
                />
              </TabsContent>

              <TabsContent value="intros" className="mt-0 min-h-0 flex-1 overflow-y-auto">
                {introLoading ? (
                  <div className="space-y-3 p-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse rounded-2xl bg-background/60 p-4 ring-1 ring-border/40">
                        <div className="flex gap-3">
                          <div className="h-10 w-10 rounded-full bg-secondary" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3 w-24 rounded bg-secondary" />
                            <div className="h-3 w-full rounded bg-secondary" />
                            <div className="h-3 w-3/4 rounded bg-secondary" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : introRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
                    <CfbGlyph name="people" className="icon-lg text-muted-foreground/50" />
                    <p className="text-sm font-medium text-foreground">
                      <BilingualText en={messagesEn('no_pending')} el={messagesEl('no_pending')} />
                    </p>
                    <p className="max-w-[16rem] text-xs text-muted-foreground">
                      <BilingualText en={messagesEn('intro_empty_hint')} el={messagesEl('intro_empty_hint')} />
                    </p>
                    {/* Below md only: the detail pane beside this one shows the
                        same two links, and above md both panes are on screen,
                        so the pair was drawn twice. The detail pane is hidden
                        below md until a request is tapped, which cannot happen
                        with an empty list - so the recovery lives here there. */}
                    <div className="flex flex-wrap justify-center gap-2 md:hidden">
                      <Link
                        href="/matches"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary-accessible hover:bg-primary/20"
                      >
                        <CfbGlyph name="matches" className="icon-sm" />
                        <BilingualText en={messagesEn('browse_matches')} el={messagesEl('browse_matches')} compact />
                      </Link>
                      <Link
                        href="/discover"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary-accessible hover:bg-primary/20"
                      >
                        <CfbGlyph name="discover" className="icon-sm" />
                        <BilingualText en={messagesEn('find_people')} el={messagesEl('find_people')} compact />
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 p-2">
                    {introRequests.map((req) => (
                      // A row of the list, set like a card's head: the
                      // person's mark, the name and the headline under it, the
                      // date at the right; the note and the answers start on
                      // the mark's edge. A row, not a tile: the pane is the card.
                      <div
                        key={req.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setSelectedIntroId(req.id);
                          setIsMobileViewingChat(true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedIntroId(req.id);
                          }
                        }}
                        className={cn(
                          'animate-fade-in cursor-pointer space-y-3 rounded-2xl p-3 transition-colors',
                          selectedIntro?.id === req.id ? 'bg-muted/50' : 'hover:bg-muted/30',
                        )}
                      >
                        <CardHead
                          titleAs="p"
                          mark={(
                            <ThreadAvatar
                              name={req.requester.displayName}
                              src={req.requester?.avatarUrl}
                              seed={req.requester.id}
                              size="md"
                            />
                          )}
                          title={(
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <Link
                                href={`/profiles/${req.requester.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="transition-colors hover:text-primary-accessible"
                              >
                                {req.requester.displayName}
                              </Link>
                              <RoleBadge role={req.requester?.role || 'founder'} size="sm" />
                            </span>
                          )}
                          subtitle={req.requester.headline ? <span className="line-clamp-2">{req.requester.headline}</span> : undefined}
                          aside={new Date(req.createdAt).toLocaleDateString(primary === 'el' ? 'el-GR' : 'en-GB', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        />
                        {req.message && (
                          <p className="card-body line-clamp-3 italic text-muted-foreground">
                            {PREVIEW_MESSAGE_EL[req.message] ? (
                              <BilingualText en={req.message} el={PREVIEW_MESSAGE_EL[req.message]} />
                            ) : (
                              <>&ldquo;{req.message}&rdquo;</>
                            )}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            className="gap-1"
                            disabled={introResponding[req.id]}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleIntroRespond(req.id, 'accepted');
                            }}
                          >
                            <Check className="icon-sm" />
                            <BilingualText en={messagesEn('accept')} el={messagesEl('accept')} compact />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            disabled={introResponding[req.id]}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleIntroRespond(req.id, 'declined');
                            }}
                          >
                            <X className="icon-sm" />
                            <BilingualText en={messagesEn('decline')} el={messagesEl('decline')} compact />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <div
            className={cn(
              'flex h-full min-w-0 flex-1 flex-col',
              !isMobileViewingChat && 'hidden md:flex',
            )}
          >
            {sidebarTab === 'intros' ? (
              <IntroDetailPane
                request={selectedIntro}
                responding={Boolean(selectedIntro && introResponding[selectedIntro.id])}
                onAccept={() => {
                  if (selectedIntro) void handleIntroRespond(selectedIntro.id, 'accepted');
                }}
                onDecline={() => {
                  if (selectedIntro) void handleIntroRespond(selectedIntro.id, 'declined');
                }}
                locale={primary}
                onBack={() => setIsMobileViewingChat(false)}
              />
            ) : selectedConversation ? (
              <>
                <ChatWindow
                  conversation={{
                    ...selectedConversation,
                    recipientHeadline: selectedConversation.recipientHeadline,
                    lastSeen: undefined,
                  }}
                  messages={messages}
                  currentUserId={currentUserId}
                  onSendMessage={handleSendMessage}
                  onTypingStart={handleTypingStart}
                  onTypingStop={handleTypingStop}
                  isRecipientTyping={isRecipientTyping}
                  onAskAi={openInboxAi}
                  initialDraft={composerDraft}
                  onBack={() => {
                    setIsMobileViewingChat(false);
                  }}
                  onReport={() => setReportBlockModal({ open: true, mode: 'report' })}
                  onBlock={() => setReportBlockModal({ open: true, mode: 'block' })}
                  validationState={validationStates[selectedConversation.id] ?? {
                    mode: 'casual' as const,
                    initiatedBy: null,
                    initiatedAt: null,
                    acceptedBy: null,
                    acceptedAt: null,
                    lastValidatedAt: null,
                    validationHash: null,
                    transcriptAvailable: false,
                  }}
                  onValidationModeChange={(mode) => {
                    setValidationStates((prev) => ({
                      ...prev,
                      [selectedConversation.id]: {
                        ...(prev[selectedConversation.id] ?? {
                          mode: 'casual' as const,
                          initiatedBy: null,
                          initiatedAt: null,
                          acceptedBy: null,
                          acceptedAt: null,
                          lastValidatedAt: null,
                          validationHash: null,
                          transcriptAvailable: false,
                        }),
                        mode,
                        initiatedBy: mode !== 'casual' ? currentUserId : null,
                        initiatedAt: mode !== 'casual' ? new Date().toISOString() : null,
                        transcriptAvailable: mode !== 'casual',
                      },
                    }));
                  }}
                />
                <ReportBlockModal
                  open={reportBlockModal.open}
                  onOpenChange={(open) => setReportBlockModal((prev) => ({ ...prev, open }))}
                  userId={selectedConversation.recipientId}
                  userName={selectedConversation.recipientName}
                  mode={reportBlockModal.mode}
                  onBlocked={(blockedUserId) => {
                    setConversations((prev) => prev.filter((conversation) => conversation.recipientId !== blockedUserId));
                    setSelectedConversation((current) =>
                      current?.recipientId === blockedUserId ? null : current,
                    );
                    setMessages((prev) =>
                      selectedConversation?.recipientId === blockedUserId ? [] : prev,
                    );
                    setIsMobileViewingChat(false);
                  }}
                />
              </>
            ) : (
              <NoChatSelected
                onNewMessage={() => setComposeOpen(true)}
                onAskAi={openInboxAi}
                recent={recentForEmpty}
                onSelectRecent={(id) => {
                  const conv = conversations.find((c) => c.id === id);
                  if (!conv) return;
                  setSelectedConversation(conv);
                  setActiveConversationId(conv.id);
                  markConversationRead(conv.id);
                  setIsMobileViewingChat(true);
                }}
              />
            )}
          </div>
        </div>
      </div>

      <ComposeMessageDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        candidates={composeCandidates}
        onPick={(userId) => void handleComposePick(userId)}
      />
    </AppShell>
  );
}
