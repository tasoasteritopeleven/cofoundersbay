'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { ConversationList, type Conversation, type InboxReadState } from '@/components/messaging/ConversationList';
import { ChatWindow, NoChatSelected, type Message, type NoChatState } from '@/components/messaging/ChatWindow';
import { ForwardMessageDialog } from '@/components/messaging/ForwardMessageDialog';
import { useConfirm } from '@/components/ui/confirm-dialog';
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
import { RowHead } from '@/components/dashboard/SectionCard';
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
  apiRequest,
  type ConversationSummary,
  type MessageItem,
  type ConnectionRequestItem,
} from '@/lib/api';
import { createMessagingSocket, type MessageReply, type ServerToClientEvents } from '@/lib/messagingSocket';
import { useSession } from '@/hooks/useSession';
import { isPreviewDemo } from '@/lib/preview-demo';
import { useMessaging } from '@/contexts/MessagingContext';
import { qk, queryKeys } from '@/lib/query-keys';
import { choiceControl, rowOptions, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { useQueryClient } from '@tanstack/react-query';
import type { ConversationValidationState } from '@/components/messaging/ConversationValidation';
import { PersonHovercard } from '@/components/common/PersonHovercard';
import { confirmSentMessage, conversationDraft, mergeReopenedMessages, pendingConversation } from '@/lib/message-selection';

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

/** What the server says when it refuses a change. */
const MESSAGE_REFUSALS_EL: Record<string, string> = {
  'A message can be edited for 15 minutes': 'Ένα μήνυμα επεξεργάζεται για 15 λεπτά.',
  'This conversation is validated, so its messages stay as written': 'Η συνομιλία είναι επικυρωμένη, οπότε τα μηνύματα μένουν όπως γράφτηκαν.',
  'Only the sender can change a message': 'Μόνο όποιος το έστειλε μπορεί να το αλλάξει.',
  'Cannot message this user': 'Δεν μπορείτε να στείλετε μήνυμα σε αυτό το μέλος.',
  'Not connected': 'Χωρίς σύνδεση.',
  'No answer from the server': 'Δεν υπήρξε απάντηση από τον διακομιστή.',
};

function mapMessage(m: MessageItem, currentUserId: string): Message {
  return {
    id: m.id,
    senderId: m.senderId,
    content: m.body,
    timestamp: new Date(m.createdAt),
    editedAt: m.editedAt ? new Date(m.editedAt) : null,
    forwarded: m.forwarded,
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
  readState,
  onRetry,
  responding,
  onAccept,
  onDecline,
  locale,
  onBack,
}: {
  request: ConnectionRequestItem | null;
  /** Until the requests are read, no request is not "No pending requests" (§73). */
  readState: InboxReadState;
  onRetry: () => void;
  responding: boolean;
  onAccept: () => void;
  onDecline: () => void;
  locale: 'en' | 'el';
  onBack?: () => void;
}) {
  if (!request && readState === 'loading') {
    return <div aria-busy="true" className="h-full" />;
  }
  if (!request && readState === 'failed') {
    return (
      <div className="relative flex h-full flex-col items-center justify-center overflow-hidden p-8 text-center">
        <div className="relative flex max-w-sm flex-col items-center gap-4">
          <CfbGlyph name="people" className="h-10 w-10 text-muted-foreground/50" />
          <p role="alert" className="text-sm font-medium text-foreground">
            <BilingualText en={messagesEn('intros_failed')} el={messagesEl('intros_failed')} wrap />
          </p>
          <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={onRetry}>
            <BilingualText en={messagesEn('retry')} el={messagesEl('retry')} compact />
          </Button>
        </div>
      </div>
    );
  }
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
              <PersonHovercard userId={request.requester.id}><Link href={`/profiles/${request.requester.id}`} className="transition-colors hover:text-primary-accessible">{request.requester.displayName}</Link></PersonHovercard>
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
            padding in front of its letters, off the pane's left edge. The
            person's profile and match only: "Discover" opened the directory,
            which has nothing to do with this request (the page tools carry
            it; docs §73). */}
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
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { success, error: showError } = useToast();
  const confirm = useConfirm();
  const [forwarding, setForwarding] = useState<Message | null>(null);
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
  // Whether each list has been read (docs §73). An unread list is not an
  // empty one: the inbox said "No conversations yet" while it loaded and
  // when the read failed, Intros said "No pending requests", and New message
  // said "You have no connections" to someone whose connections failed to load.
  const [inboxState, setInboxState] = useState<InboxReadState>('loading');
  const [inboxReload, setInboxReload] = useState(0);
  const [introsState, setIntrosState] = useState<InboxReadState>('loading');
  const [connectionsFailed, setConnectionsFailed] = useState(false);
  const [threadState, setThreadState] = useState<InboxReadState>('loading');
  const [threadReload, setThreadReload] = useState(0);
  const loadedThread = useRef<{ id: string; userId: string } | null>(null);
  const [introResponding, setIntroResponding] = useState<Record<string, boolean>>({});
  const [selectedIntroId, setSelectedIntroId] = useState<string | null>(null);
  const [composerDraft, setComposerDraft] = useState<{ id: string; text: string }>();
  const [reportBlockModal, setReportBlockModal] = useState<{ open: boolean; mode: 'report' | 'block' | 'both' }>({ open: false, mode: 'both' });
  const [validationStates, setValidationStates] = useState<Record<string, ConversationValidationState>>({});
  const { setActiveConversationId, markConversationRead } = useMessaging();
  // Every list this page fetches is published to the shared conversation
  // cache, which the unread badges derive from (MessagingContext).
  const queryClient = useQueryClient();
  const inboxTitleRef = useRef<HTMLHeadingElement>(null);
  const threadPaneRef = useRef<HTMLDivElement>(null);
  const mobileOpenerRef = useRef<HTMLElement | null>(null);
  const restoreInboxFocus = useRef(false);
  const collapsedChatId = useRef<string | null>(null);
  const openedLinkRef = useRef<string | null>(null);
  const rememberOpener = useCallback(() => {
    if (window.matchMedia('(max-width: 767px)').matches) {
      const focused = document.activeElement;
      mobileOpenerRef.current = focused instanceof HTMLElement && focused !== document.body ? focused : null;
    }
  }, []);
  const openConversation = useCallback((conv: Conversation, options?: { draft?: string; markRead?: boolean }) => {
    rememberOpener();
    if (collapsedChatId.current === conv.id) setThreadReload((n) => n + 1);
    collapsedChatId.current = null;
    setSidebarTab('chats');
    setSelectedConversation((current) => current?.id === conv.id ? current : conv);
    setComposerDraft((current) => conversationDraft(current, conv.id, options?.draft));
    setActiveConversationId(conv.id);
    if (options?.markRead) markConversationRead(conv.id);
    setIsMobileViewingChat(true);
  }, [markConversationRead, rememberOpener, setActiveConversationId]);
  const returnToInbox = useCallback(() => {
    if (sidebarTab === 'chats') collapsedChatId.current = selectedConversation?.id ?? null;
    restoreInboxFocus.current = true;
    setIsMobileViewingChat(false);
    setActiveConversationId(null);
  }, [selectedConversation?.id, setActiveConversationId, sidebarTab]);

  useEffect(() => {
    if (!window.matchMedia('(max-width: 767px)').matches) return;
    if (isMobileViewingChat) {
      threadPaneRef.current?.focus({ preventScroll: true });
    } else if (restoreInboxFocus.current) {
      restoreInboxFocus.current = false;
      const opener = mobileOpenerRef.current;
      mobileOpenerRef.current = null;
      (opener?.isConnected && opener.getClientRects().length ? opener : inboxTitleRef.current)?.focus({ preventScroll: true });
    }
  }, [isMobileViewingChat]);

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

    const onUpdated: ServerToClientEvents['message:updated'] = ({ message }) => {
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, content: message.body, editedAt: message.editedAt ? new Date(message.editedAt) : null } : m)));
      const editedAt = new Date(message.createdAt).getTime();
      setConversations((prev) => prev.map((c) => (
        c.id === message.conversationId && c.lastMessageTime && new Date(c.lastMessageTime).getTime() === editedAt
          ? { ...c, lastMessage: message.body }
          : c
      )));
    };
    const onRemoved: ServerToClientEvents['message:removed'] = ({ id, conversationId }) => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
      // The list keeps its own preview, which must not go on showing the words.
      void listMessageConversations().then(({ conversations: list }) => {
        const fresh = list.find((c) => c.id === conversationId);
        if (fresh) setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, lastMessage: fresh.lastMessage?.body ?? '' } : c)));
      }).catch(() => {});
    };
    const onAck: ServerToClientEvents['message:ack'] = ({ tempId, message }) => {
      if (!tempId) return;
      setMessages((prev) => confirmSentMessage(prev, tempId, {
        id: message.id,
        timestamp: new Date(message.createdAt),
        status: 'sent',
        attachments: mapMessage(message, currentUserIdRef.current).attachments,
      }));

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
      setInboxState('loading');
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
        setInboxState('ready');

        socket = createMessagingSocket();
        socketRef.current = socket;
        socket.on('message:new', onNew);
        socket.on('message:ack', onAck);
        socket.on('message:updated', onUpdated);
        socket.on('message:removed', onRemoved);
        socket.on('typing:start', onTypingStart);
        socket.on('typing:stop', onTypingStop);
        socket.on('presence:update', onPresence);
      } catch (error) {
        if (!mounted) return;
        if (error instanceof ApiError && error.status === 401 && !isPreviewDemo()) {
          router.replace('/login');
          return;
        }
        // Said where the list would be, with Try again; a toast went away
        // and left "No conversations yet" behind it (docs §73).
        setInboxState('failed');
      }
    };

    void bootstrap();

    return () => {
      mounted = false;
      socket?.off('message:new', onNew);
      socket?.off('message:ack', onAck);
      socket?.off('message:updated', onUpdated);
      socket?.off('message:removed', onRemoved);
      socket?.off('typing:start', onTypingStart);
      socket?.off('typing:stop', onTypingStop);
      socket?.off('presence:update', onPresence);
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [hasSession, router, sessionReady, queryClient, inboxReload]);

  // Pending intro (connection) requests, and the accepted connections New
  // message offers. Each read is its own: a failed one says so.
  const loadIntroRequests = useCallback(async () => {
    if (!canUseMessaging) {
      return;
    }

    setIntrosState('loading');
    const [received, accepted] = await Promise.allSettled([
      listConnectionRequests({ type: 'received', limit: 50 }),
      listConnectionRequests({ type: 'accepted', limit: 50 }),
    ]);
    if (received.status === 'fulfilled') {
      setIntroRequests(received.value.connections.filter((c) => c.status === 'pending'));
      setIntrosState('ready');
    } else {
      setIntrosState('failed');
    }
    if (accepted.status === 'fulfilled') {
      setAcceptedConnections(accepted.value.connections.filter((c) => c.status === 'accepted'));
      setConnectionsFailed(false);
    } else {
      setConnectionsFailed(true);
    }
  }, [canUseMessaging]);

  useEffect(() => {
    if (!canUseMessaging) {
      return;
    }

    loadIntroRequests();
  }, [canUseMessaging, loadIntroRequests]);

  const handleIntroRespond = async (id: string, action: 'accepted' | 'declined') => {
    // The request in hand names the person: the conversation opens with them
    // without reading the requests again.
    const request = introRequests.find((r) => r.id === id);
    setIntroResponding((prev) => ({ ...prev, [id]: true }));
    try {
      await respondToConnectionRequest(id, action);
      setIntroRequests((prev) => prev.filter((r) => r.id !== id));
      // Every surface that offers Connect / Accept / Message reads these keys
      // (useConnectionWith): the founder home stops offering Accept.
      void queryClient.invalidateQueries({ queryKey: qk('connections') });
      success(
        action === 'accepted'
          ? t(messagesEn('connection_accepted'), messagesEl('connection_accepted'))
          : t(messagesEn('request_declined'), messagesEl('request_declined')),
        action === 'accepted'
          ? t(messagesEn('connection_accepted_hint'), messagesEl('connection_accepted_hint'))
          : undefined,
      );
      if (action === 'accepted' && request) {
        setAcceptedConnections((prev) => (prev.some((c) => c.id === id) ? prev : [...prev, { ...request, status: 'accepted' }]));
        // The answer is in; opening the chat is a second step, and its
        // failure is not "Action failed" on an accepted request.
        try {
          const { conversationId } = await getOrCreateDirectConversation(request.requesterId);
          const { conversations: list } = await listMessageConversations();
          queryClient.setQueryData(queryKeys.conversationsList, { conversations: list });
          const mapped = list.map(mapConversation);
          setConversations(mapped);
          const conv = mapped.find((c) => c.id === conversationId);
          if (conv) {
            openConversation(conv);
          }
        } catch (e) {
          showError(
            t(messagesEn('start_fail'), messagesEl('start_fail')),
            e instanceof Error ? e.message : t(messagesEn('try_again'), messagesEl('try_again')),
          );
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
        openConversation(conv);
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
  const draftParam = searchParams?.get('text');
  // From the assistant's message search: the thread opens with the words
  // already searched, so the hit is marked where it sits.
  const findParam = searchParams?.get('find') ?? undefined;
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
          // "Request" on a marketplace card opens the thread with the
          // message already started; the reader edits it before sending.
          openConversation(conv, { draft: draftParam?.slice(0, 2000) });
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
  }, [canUseMessaging, toUserId, showError, openConversationId, openConversation, draftParam]);

  // Handle URL param for opening an existing conversation
  useEffect(() => {
    if (!openConversationId) openedLinkRef.current = null;
    if (!canUseMessaging) return;
    const conv = pendingConversation(openConversationId, openedLinkRef.current, conversations);
    if (!conv) return;
    openedLinkRef.current = conv.id;
    openConversation(conv);
    socketRef.current?.emit('conversation:join', { conversationId: conv.id });
  }, [canUseMessaging, openConversationId, conversations, openConversation]);

  // Reset typing indicator when conversation changes
  useEffect(() => {
    setIsRecipientTyping(false);
  }, [selectedConversation?.id]);

  // Load messages when conversation is selected
  useEffect(() => {
    if (!canUseMessaging || !selectedConversation) {
      loadedThread.current = null;
      return;
    }

    let cancelled = false;
    const retainMessages = loadedThread.current?.id === selectedConversation.id && loadedThread.current.userId === currentUserId;
    // The last thread's messages do not stay under the next one's name
    // while it loads, or after its read fails (docs §73).
    if (!retainMessages) {
      loadedThread.current = null;
      setMessages([]);
      setThreadState('loading');
    }
    const run = async () => {
      try {
        const { messages: list } = await listConversationMessages(selectedConversation.id, 200);
        if (cancelled) return;
        const fetched = list.map((m) => mapMessage(m, currentUserId));
        setMessages((current) => retainMessages ? mergeReopenedMessages(current, fetched) : fetched);
        loadedThread.current = { id: selectedConversation.id, userId: currentUserId };
        setThreadState('ready');
        setConversations((prev) =>
          prev.map((c) => (c.id === selectedConversation.id ? { ...c, unreadCount: 0 } : c)),
        );
        socketRef.current?.emit('conversation:join', { conversationId: selectedConversation.id });
      } catch {
        if (cancelled || retainMessages) return;
        setThreadState('failed');
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [canUseMessaging, selectedConversation, currentUserId, threadReload]);

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
    setComposerDraft({ id: selectedConversation.id, text: t(messagesEn('schedule_draft'), messagesEl('schedule_draft')) });
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
        // A voice note plays at once in the demo, which has no upload to wait for.
        ? attachments.slice(0, 5).map((f) => ({ type: f.type || 'file', url: preview && f.type.startsWith('audio/') ? URL.createObjectURL(f) : '', name: f.name }))
        : undefined,
    };

    setMessages((prev) => [...prev, newMessage]);
    setComposerDraft(undefined);

    if (preview && (!s || !s.connected)) {
      // The demo keeps what the visitor writes for the session, so the
      // thread is still there after a reload (demo/messages-world).
      void apiRequest<{ message: MessageItem | null }>(`/api/messages/conversations/${encodeURIComponent(selectedConversation.id)}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: content }),
      }).then((result) => {
        const message = result?.message;
        if (!message?.id) return;
        setMessages((prev) => confirmSentMessage(prev, tempId, { id: message.id, timestamp: new Date(message.createdAt) }));
      }).catch(() => {});
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

  // Editing, deleting and forwarding ask the server and wait for its answer, so a
  // refused change (the time window, a validated conversation) never looks done.
  const askServer = (event: 'message:edit' | 'message:delete' | 'message:forward', payload: { conversationId: string; messageId: string; body?: string }) =>
    new Promise<MessageReply>((resolve) => {
      const s = socketRef.current;
      if (!s?.connected) {
        resolve({ ok: false, error: 'Not connected' });
        return;
      }
      (s.timeout(8000).emit as unknown as (name: string, data: unknown, answer: (err: Error | null, reply: MessageReply) => void) => void)(
        event,
        payload,
        (err, reply) => resolve(err ? { ok: false, error: 'No answer from the server' } : reply),
      );
    });
  const refusal = (reason?: string) => (reason ? t(reason, MESSAGE_REFUSALS_EL[reason] ?? reason) : undefined);

  const handleEditMessage = async (messageId: string, body: string) => {
    if (!selectedConversation) return;
    const before = messages.find((m) => m.id === messageId);
    const conversationId = selectedConversation.id;
    const isLatest = messages[messages.length - 1]?.id === messageId;
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, content: body, editedAt: new Date() } : m)));
    if (isLatest) setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, lastMessage: body } : c)));
    if (isPreviewDemo()) return;
    const reply = await askServer('message:edit', { conversationId, messageId, body });
    if (reply.ok) return;
    if (before) {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? before : m)));
      if (isLatest) setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, lastMessage: before.content } : c)));
    }
    showError(t(messagesEn('edit_failed'), messagesEl('edit_failed')), refusal(reply.error));
  };

  const handleDeleteMessage = async (message: Message) => {
    if (!selectedConversation) return;
    const agreed = await confirm({
      title: t(messagesEn('delete_title'), messagesEl('delete_title')),
      description: t(messagesEn('delete_hint'), messagesEl('delete_hint')),
      confirmLabel: t(messagesEn('delete'), messagesEl('delete')),
    });
    if (!agreed) return;
    if (!isPreviewDemo()) {
      const reply = await askServer('message:delete', { conversationId: selectedConversation.id, messageId: message.id });
      if (!reply.ok) {
        showError(t(messagesEn('delete_failed'), messagesEl('delete_failed')), refusal(reply.error));
        return;
      }
    }
    const remaining = messages.filter((m) => m.id !== message.id);
    setMessages(remaining);
    setConversations((prev) => prev.map((c) => (c.id === selectedConversation.id ? { ...c, lastMessage: remaining[remaining.length - 1]?.content ?? '' } : c)));
    success(t(messagesEn('deleted'), messagesEl('deleted')));
  };

  const handleForward = async (conversationId: string) => {
    const message = forwarding;
    setForwarding(null);
    if (!message) return;
    if (isPreviewDemo()) {
      await apiRequest(`/api/messages/conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: message.content }),
      }).catch(() => {});
    } else {
      const reply = await askServer('message:forward', { conversationId, messageId: message.id });
      if (!reply.ok) {
        showError(t(messagesEn('forward_failed'), messagesEl('forward_failed')), refusal(reply.error));
        return;
      }
    }
    setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, lastMessage: message.content, lastMessageTime: new Date() } : c)));
    success(t(messagesEn('forward_done'), messagesEl('forward_done')));
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
      if (selectedConversation?.id === id) {
        setSelectedConversation(null);
        // On a phone the thread was the screen; the inbox comes back rather
        // than "Pick a conversation" over a list that is out of view.
        setIsMobileViewingChat(false);
      }
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
  const liveCount = conversations.filter((c) => !c.isArchived).length;
  const paneState: NoChatState =
    inboxState === 'loading' ? 'loading' : inboxState === 'failed' ? 'failed' : liveCount === 0 ? 'empty' : 'pick';
  const retryInbox = () => setInboxReload((n) => n + 1);
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
      rowsEl: inbox.map((c) => `${c.recipientName}${c.unreadCount ? ` · ${c.unreadCount} αδιάβαστα` : ''}${c.isPinned ? ' · καρφιτσωμένη' : ''} · "${c.lastMessage}"`),
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
        openConversation(conv, { markRead: true });
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
      <div className="flex h-full min-h-0 flex-col p-0 sm:p-3 sm:pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:p-4 lg:pb-4">
        <div className="flex min-h-0 flex-1 overflow-hidden bg-background sm:rounded-2xl sm:border sm:border-border sm:bg-card sm:shadow-[0_24px_64px_-28px_hsl(var(--foreground)/0.35)]">
          {/* One column that may shrink: an implicit `auto` column took the
              width of the longest message preview (479px at 320), and the
              pane cut its cards, tabs and search at the right edge (docs §107). */}
          <div
            className={cn(
              'grid h-full min-h-0 min-w-0 w-full shrink-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden border-border bg-background max-sm:border-0 sm:border-r sm:bg-muted/40 md:w-[340px] md:max-w-[340px] lg:w-[392px] lg:max-w-[392px]',
              isMobileViewingChat && 'hidden md:grid',
            )}
          >
            {/* From sm the inbox axis is 20px, the same edge as the avatars
                (the list's px-2 and each row's px-3). On a phone the pane is
                tighter, and the title row keeps clear of the tools icon. */}
            <div className="min-w-0 shrink-0 space-y-2 px-3 pb-2 pt-3 sm:space-y-3 sm:px-5 sm:pb-3 sm:pt-4">
              <div className="flex items-center gap-2 max-sm:pr-10 sm:items-start">
                <div className="min-w-0 flex-1">
                  {/* The page-title step every page header uses: at text-lg
                      the inbox title sat 0.17px over the card title step on a
                      desktop, level with a thread's or a request's name. */}
                  <h1 ref={inboxTitleRef} tabIndex={-1} className="page-title font-semibold tracking-tight text-foreground">
                    <BilingualText en={messagesEn('page_title')} el={messagesEl('page_title')} />
                  </h1>
                  <p className="mt-0.5 hidden text-xs leading-snug text-muted-foreground sm:block">
                    <BilingualText en={messagesEn('inbox_lead')} el={messagesEl('inbox_lead')} compact wrap />
                  </p>
                </div>
                <PageContextualHelp defaultOpen={false} compact />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
                <Button
                  type="button"
                  size="sm"
                  className="h-auto min-h-11 w-full flex-col items-start gap-0 whitespace-normal rounded-xl px-3 py-2 text-left text-primary-foreground shadow-none sm:h-8 sm:flex-row sm:items-center sm:rounded-full sm:px-3 sm:py-0"
                  onClick={() => setComposeOpen(true)}
                  aria-label={bilingualAria(messagesEn('new_message'), messagesEl('new_message'))}
                >
                  <span className="text-sm font-medium">{t(messagesEn('new_message'), messagesEl('new_message'))}</span>
                  {/* Wraps rather than cuts: at 320-375px a half-width card holds
                      «Γράψτε σε μια σύνδε» and stopped there (docs §107). */}
                  <span className="text-xs font-normal leading-snug sm:hidden">
                    <BilingualText en={messagesEn('new_message_short')} el={messagesEl('new_message_short')} compact wrap />
                  </span>
                </Button>
                <button
                  type="button"
                  onClick={openInboxAi}
                  className="flex min-h-11 min-w-0 w-full flex-col items-start justify-center gap-0 overflow-hidden rounded-xl border border-border px-3 py-2 text-left transition-colors hover:bg-muted/40 sm:min-h-0"
                >
                  <span className="block text-sm font-medium text-foreground">
                    {t(messagesEn('ask_ai'), messagesEl('ask_ai'))}
                  </span>
                  <span className="block text-xs leading-snug text-muted-foreground sm:hidden">
                    <BilingualText en={messagesEn('ask_ai_short')} el={messagesEl('ask_ai_short')} compact wrap />
                  </span>
                  {/* line-clamp, not truncate: this hint is a sentence, and one
                      line cut it by a third. Two lines still bound the height. */}
                  <span className="hidden line-clamp-2 text-2xs text-muted-foreground sm:block">
                    <BilingualText en={messagesEn('ask_ai_hint')} el={messagesEl('ask_ai_hint')} compact wrap />
                  </span>
                </button>
              </div>
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
                  state={inboxState}
                  onRetry={retryInbox}
                  selectedId={selectedConversation?.id}
                  onSelect={(conv) => openConversation(conv, { markRead: true })}
                  onPin={handlePin}
                  onArchive={handleArchive}
                />
              </TabsContent>

              <TabsContent value="intros" className="mt-0 min-h-0 flex-1 overflow-y-auto">
                {introsState === 'loading' ? (
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
                ) : introsState === 'failed' ? (
                  // Below md only, as the empty list below: from md the pane
                  // beside it says this, with Try again (docs §73).
                  <div className="flex flex-col items-center justify-center gap-3 p-10 text-center md:hidden">
                    <CfbGlyph name="people" className="icon-lg text-muted-foreground/50" />
                    <p role="alert" className="max-w-[16rem] text-sm font-medium text-foreground">
                      <BilingualText en={messagesEn('intros_failed')} el={messagesEl('intros_failed')} wrap />
                    </p>
                    <Button type="button" size="sm" variant="outline" onClick={() => void loadIntroRequests()}>
                      <BilingualText en={messagesEn('retry')} el={messagesEl('retry')} compact />
                    </Button>
                  </div>
                ) : introRequests.length === 0 ? (
                  // Below md only: from md the detail pane beside this one
                  // says the same, with the same two links. The links were
                  // already kept to one pane; the words were still said twice
                  // side by side (docs §73). The detail pane is hidden below
                  // md until a request is tapped, which cannot happen with an
                  // empty list - so here is where a phone reads it.
                  <div className="flex flex-col items-center justify-center gap-3 p-10 text-center md:hidden">
                    <CfbGlyph name="people" className="icon-lg text-muted-foreground/50" />
                    <p className="text-sm font-medium text-foreground">
                      <BilingualText en={messagesEn('no_pending')} el={messagesEl('no_pending')} />
                    </p>
                    <p className="max-w-[16rem] text-xs text-muted-foreground">
                      <BilingualText en={messagesEn('intro_empty_hint')} el={messagesEl('intro_empty_hint')} />
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
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
                      // A row of the list (RowHead: a card title here would
                      // outrank the pane's own h1 on a phone): the person's
                      // mark, the name and the headline under it, the date at
                      // the right; the note and the answers start on the
                      // mark's edge. A row, not a tile: the pane is the card.
                      // The row opens the request with a real button stretched
                      // over it, as a conversation row does: the row was a
                      // role="button" holding a link and two buttons
                      // (nested-interactive), and Enter on it chose the
                      // request without opening it on a phone (docs §73).
                      <div
                        key={req.id}
                        className={cn(
                          'group relative animate-fade-in space-y-2 rounded-2xl p-3 transition-colors',
                          selectedIntro?.id === req.id ? 'bg-muted/50' : 'hover:bg-muted/30',
                        )}
                      >
                        <button
                          type="button"
                          aria-current={selectedIntro?.id === req.id ? 'true' : undefined}
                          aria-label={bilingualAria(`Open the request from ${req.requester.displayName}`, `Άνοιγμα του αιτήματος από ${req.requester.displayName}`)}
                          onClick={() => {
                            rememberOpener();
                            setSelectedIntroId(req.id);
                            setIsMobileViewingChat(true);
                          }}
                          className="absolute inset-0 z-0 cursor-pointer rounded-2xl focus-ring"
                        />
                        <RowHead
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
                                className="relative z-10 transition-colors hover:text-primary-accessible"
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
                          <p className="line-clamp-3 text-xs italic leading-relaxed text-muted-foreground">
                            {PREVIEW_MESSAGE_EL[req.message] ? (
                              <BilingualText en={req.message} el={PREVIEW_MESSAGE_EL[req.message]} />
                            ) : (
                              <>&ldquo;{req.message}&rdquo;</>
                            )}
                          </p>
                        )}
                        {/* Below md only: from md the request opens in the pane
                            beside the list with the same two answers, and
                            every row repeated them - a column of filled
                            Accept buttons next to the one in the pane. */}
                        <div className="relative z-10 flex flex-wrap items-center gap-2 md:hidden">
                          <Button
                            size="sm"
                            className="gap-1"
                            disabled={introResponding[req.id]}
                            onClick={() => {
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
                            onClick={() => {
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
            ref={threadPaneRef}
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key !== 'Escape' || event.defaultPrevented || !isMobileViewingChat || !window.matchMedia('(max-width: 767px)').matches) return;
              if (!(event.target instanceof HTMLElement) || !event.currentTarget.contains(event.target)) return;
              event.stopPropagation();
              returnToInbox();
            }}
            className={cn(
              'flex h-full min-w-0 flex-1 flex-col',
              !isMobileViewingChat && 'hidden md:flex',
            )}
          >
            {sidebarTab === 'intros' ? (
              <IntroDetailPane
                request={selectedIntro}
                readState={introsState}
                onRetry={() => void loadIntroRequests()}
                responding={Boolean(selectedIntro && introResponding[selectedIntro.id])}
                onAccept={() => {
                  if (selectedIntro) void handleIntroRespond(selectedIntro.id, 'accepted');
                }}
                onDecline={() => {
                  if (selectedIntro) void handleIntroRespond(selectedIntro.id, 'declined');
                }}
                locale={primary}
                onBack={returnToInbox}
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
                  onEditMessage={(id, body) => { void handleEditMessage(id, body); }}
                  onDeleteMessage={(message) => { void handleDeleteMessage(message); }}
                  onForwardMessage={setForwarding}
                  onTypingStart={handleTypingStart}
                  onTypingStop={handleTypingStop}
                  isRecipientTyping={isRecipientTyping}
                  onAskAi={openInboxAi}
                  initialDraft={composerDraft?.id === selectedConversation.id ? composerDraft.text : undefined}
                  initialSearch={selectedConversation?.id === openConversationId ? findParam : undefined}
                  threadState={threadState}
                  onRetryThread={() => setThreadReload((n) => n + 1)}
                  onBack={returnToInbox}
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
                state={paneState}
                hasConnections={composeCandidates.length > 0}
                onRetry={retryInbox}
                onNewMessage={() => setComposeOpen(true)}
                onAskAi={openInboxAi}
                recent={recentForEmpty}
                onSelectRecent={(id) => {
                  const conv = conversations.find((c) => c.id === id);
                  if (!conv) return;
                  openConversation(conv, { markRead: true });
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
        connectionsFailed={connectionsFailed}
        onPick={(userId) => void handleComposePick(userId)}
      />
      <ForwardMessageDialog
        open={forwarding !== null}
        preview={forwarding?.content ?? ''}
        targets={conversations.filter((c) => c.id !== selectedConversation?.id).map((c) => ({ id: c.id, recipientName: c.recipientName, recipientAvatar: c.recipientAvatar }))}
        onClose={() => setForwarding(null)}
        onForward={(id) => { void handleForward(id); }}
      />
    </AppShell>
  );
}
