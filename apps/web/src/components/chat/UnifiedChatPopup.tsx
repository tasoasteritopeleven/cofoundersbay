'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { overlayOpener } from '@/components/ui/use-return-focus';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import {
  MessageSquare,
  X,
  ChevronDown,
  Send,
  Loader2,
  ArrowLeft,
  Search,
  MessageCircle,
  Maximize2,
  Check,
  CheckCheck,
  Bot,
  Compass,
  Heart,
  UserCheck,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RelativeTime } from '@/components/common/RelativeTime';
import { useDraggable } from '@/hooks/useDraggable';
import { usePopupChat } from '@/contexts/PopupChatContext';
import { useMessaging, useMessagingUnreadCount } from '@/contexts/MessagingContext';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { CopilotWorkspace } from '@/components/ai/CopilotWorkspace';
import {
  getMe, listMessageConversations, listConversationMessages,
  getOrCreateDirectConversation,
  type ConversationSummary, type MessageItem,
} from '@/lib/api';
import { createMessagingSocket, type ServerToClientEvents } from '@/lib/messagingSocket';
import { isPreviewDemo } from '@/lib/preview-demo';
import type { Conversation } from '@/components/messaging/ConversationList';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualAria } from '@/lib/i18n/format';
import {
  messagesEn,
  messagesEl,
  PREVIEW_MESSAGE_EL,
} from '@/lib/i18n/strings-messages';
import { useBilingualString } from '@/lib/i18n/LanguagePreferenceContext';
import { LogoIcon } from '@/components/brand/Logo';

type TabType = 'messages' | 'ai';

// ── Messaging types & helpers ──────────────────────────────────────────────────

type PopupMessage = {
  id: string;
  senderId: string;
  content: string;
  timestamp: Date;
  status: 'sending' | 'sent' | 'read';
};

function mapConversation(s: ConversationSummary): Conversation {
  const lastAt = s.lastMessage?.createdAt ?? s.updatedAt;
  return {
    id: s.id,
    recipientId: s.recipient?.id ?? 'unknown',
    recipientName: s.recipient?.displayName ?? 'Unknown',
    recipientAvatar: s.recipient?.avatarUrl ?? null,
    recipientRole: s.recipient?.role ?? 'founder',
    lastMessage: s.lastMessage?.body ?? '',
    lastMessageTime: new Date(lastAt),
    unreadCount: s.unreadCount ?? 0,
    isPinned: s.isPinned ?? false,
    isArchived: s.isArchived ?? false,
    isOnline: s.recipient?.isOnline ?? false,
  };
}

function mapMessage(m: MessageItem, myId: string): PopupMessage {
  return {
    id: m.id,
    senderId: m.senderId,
    content: m.body,
    timestamp: new Date(m.createdAt),
    status: m.senderId === myId ? 'sent' : 'read',
  };
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Messaging sub-components ───────────────────────────────────────────────────

function ConvoItem({ conv, selected, onClick }: { conv: Conversation; selected: boolean; onClick: () => void }) {
  const previewEl = PREVIEW_MESSAGE_EL[conv.lastMessage];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
        selected ? 'bg-primary/10' : 'hover:bg-muted/60',
      )}
    >
      <div className="relative shrink-0">
        <Avatar className="h-9 w-9">
          <AvatarImage src={conv.recipientAvatar ?? undefined} />
          <AvatarFallback className="text-xs font-semibold bg-primary/15 text-primary-accessible">
            {conv.recipientName[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {conv.isOnline && (
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-status-success-mark ring-2 ring-background" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className={cn(
            'text-sm truncate',
            conv.unreadCount > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground/90',
          )}>
            {conv.recipientName}
          </span>
          <span className="text-2xs text-muted-foreground shrink-0 tabular-nums">
            <RelativeTime date={conv.lastMessageTime} short />
          </span>
        </div>
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <p className={cn(
            'text-xs truncate',
            conv.unreadCount > 0 ? 'text-foreground/75 font-medium' : 'text-muted-foreground',
          )}>
            {conv.lastMessage
              ? (previewEl
                ? <BilingualText en={conv.lastMessage} el={previewEl} compact />
                : conv.lastMessage)
              : <BilingualText en={messagesEn('no_messages_yet_short')} el={messagesEl('no_messages_yet_short')} compact />}
          </p>
          {conv.unreadCount > 0 && (
            <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-2xs font-bold text-primary-foreground shrink-0">
              {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 px-4 py-1">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-muted px-3 py-2">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function UnifiedChatPopup() {
  const pathname = usePathname();
  const router = useRouter();
  const { hasSession, mounted: sessionReady } = useSession();
  const { isOpen, isMinimized, initialUserId, preferredTab, pendingPrompt, consumePrompt, close, minimize, restore } = usePopupChat();
  const { setActiveConversationId, markConversationRead } = useMessaging();
  const sharedUnread = useMessagingUnreadCount();
  const queryClient = useQueryClient();
  const sayOne = useBilingualString();

  const TAB_KEY = 'cfb-chat-popup-tab';

  // ── Tab ────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabType>('ai');

  // ── Messaging state ────────────────────────────────────────────────────────
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [msgMessages, setMsgMessages] = useState<PopupMessage[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [msgInput, setMsgInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [liveConnected, setLiveConnected] = useState(true);

  const socketRef = useRef<ReturnType<typeof createMessagingSocket> | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const currentUserIdRef = useRef('');
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const msgEndRef = useRef<HTMLDivElement>(null);
  const msgInputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // ── Draggable ──────────────────────────────────────────────────────────────
  const { position, isDragging, dragHandleProps } = useDraggable({
    storageKey: 'cfb-unified-chat-position',
    initialPosition: { x: 0, y: 0 },
    boundaryPadding: 20,
  });

  // Sync refs
  useEffect(() => { selectedIdRef.current = selected?.id ?? null; }, [selected]);
  useEffect(() => { currentUserIdRef.current = currentUserId; }, [currentUserId]);

  // ESC: thread → back to list; list/AI → close
  useEffect(() => {
    if (!isOpen || isMinimized) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (selected && activeTab === 'messages') {
        setSelected(null);
        setActiveConversationId(null);
      } else {
        close();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isMinimized, selected, activeTab, close, setActiveConversationId]);

  useEffect(() => {
    if (!isOpen) return;
    if (preferredTab) {
      setActiveTab(preferredTab);
      return;
    }
    try {
      const saved = sessionStorage.getItem(TAB_KEY);
      if (saved === 'messages' || saved === 'ai') setActiveTab(saved);
    } catch { /* ignore */ }
  }, [isOpen, preferredTab]);

  const selectTab = useCallback((tab: TabType) => {
    setActiveTab(tab);
    try { sessionStorage.setItem(TAB_KEY, tab); } catch { /* ignore */ }
  }, []);

  // Focus popup container when it opens or is restored (accessibility), and
  // hand focus back to whatever opened it when it closes. A page's "Ask AI" or
  // "Message" button opens the popup through context, so without this the
  // keyboard user who pressed Escape was left on <body>.
  const openerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (isOpen && !isMinimized) {
      const opener = overlayOpener(popupRef.current);
      if (opener && !popupRef.current?.contains(opener)) openerRef.current = opener;
      setTimeout(() => popupRef.current?.focus(), 50);
      return;
    }
    if (!isOpen) {
      const opener = openerRef.current;
      openerRef.current = null;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    }
  }, [isOpen, isMinimized]);

  // Hide on auth pages and the full AI workspace. Allowed on /messages so the
  // inbox "Ask AI" card can draft a reply without leaving the thread. The
  // floating bubble stays hidden on /messages to avoid a duplicate composer.
  const shouldHide =
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/register') ||
    pathname?.startsWith('/onboarding') ||
    pathname?.startsWith('/auth') ||
    pathname?.startsWith('/forgot-password') ||
    pathname?.startsWith('/reset-password') ||
    pathname === '/ai' ||
    pathname?.startsWith('/ai/');

  // ── Messaging: init socket + conversations on first open ───────────────────
  useEffect(() => {
    if (!isOpen || !sessionReady || !hasSession || initialized || isInitializing) return;

    let mounted = true;
    setIsInitializing(true);

    const onNew: ServerToClientEvents['message:new'] = ({ message }) => {
      setConversations(prev => prev.map(c => {
        if (c.id !== message.conversationId) return c;
        const isSelected = selectedIdRef.current === c.id;
        return {
          ...c,
          lastMessage: message.body,
          lastMessageTime: new Date(message.createdAt),
          unreadCount: isSelected ? 0 : (c.unreadCount ?? 0) + 1,
        };
      }));
      if (selectedIdRef.current === message.conversationId) {
        setMsgMessages(prev => [...prev, mapMessage(message, currentUserIdRef.current)]);
      }
    };

    const onAck: ServerToClientEvents['message:ack'] = ({ tempId, message }) => {
      if (!tempId) return;
      setMsgMessages(prev => prev.map(m =>
        m.id === tempId
          ? { ...m, id: message.id, timestamp: new Date(message.createdAt), status: 'sent' }
          : m,
      ));
      setConversations(prev => prev.map(c =>
        c.id === message.conversationId
          ? { ...c, lastMessage: message.body, lastMessageTime: new Date(message.createdAt) }
          : c,
      ));
    };

    const onTypingStart: ServerToClientEvents['typing:start'] = ({ conversationId }) => {
      if (selectedIdRef.current === conversationId) setIsTyping(true);
    };
    const onTypingStop: ServerToClientEvents['typing:stop'] = ({ conversationId }) => {
      if (selectedIdRef.current === conversationId) setIsTyping(false);
    };
    const onPresence: ServerToClientEvents['presence:update'] = ({ userId, isOnline }) => {
      setConversations(prev => prev.map(c => c.recipientId === userId ? { ...c, isOnline } : c));
    };

    const init = async () => {
      try {
        let uid = currentUserId;
        if (!uid) {
          const rawUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
          if (rawUser) {
            try { uid = (JSON.parse(rawUser) as { id?: string }).id ?? ''; } catch { uid = ''; }
          }
          if (!uid) {
            const { user } = await getMe();
            uid = user.id;
          }
          if (!mounted) return;
          setCurrentUserId(uid);
        }

        if (conversations.length === 0) {
          const { conversations: list } = await listMessageConversations();
          queryClient.setQueryData(queryKeys.conversationsList, { conversations: list });
          if (!mounted) return;
          setConversations(list.map(mapConversation));
        }

        const socket = createMessagingSocket();
        socketRef.current = socket;
        setLiveConnected(isPreviewDemo() || socket.connected);
        socket.on('connect', () => setLiveConnected(true));
        socket.on('disconnect', () => setLiveConnected(false));
        socket.on('message:new', onNew);
        socket.on('message:ack', onAck);
        socket.on('typing:start', onTypingStart);
        socket.on('typing:stop', onTypingStop);
        socket.on('presence:update', onPresence);

        if (initialUserId) {
          const { conversationId } = await getOrCreateDirectConversation(initialUserId);
          if (!mounted) return;
          const { conversations: refreshed } = await listMessageConversations();
          queryClient.setQueryData(queryKeys.conversationsList, { conversations: refreshed });
          const remapped = refreshed.map(mapConversation);
          if (!mounted) return;
          setConversations(remapped);
          const conv = remapped.find(c => c.id === conversationId);
          if (conv) setSelected(conv);
          setActiveTab('messages');
        }

        setInitialized(true);
      } catch {
        // silently fail — popup shows empty state
      } finally {
        if (mounted) setIsInitializing(false);
      }
    };

    void init();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sessionReady, hasSession]);

  // Disconnect socket on close; reset so it reconnects on next open
  useEffect(() => {
    if (!isOpen && socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setInitialized(false);
    }
  }, [isOpen]);

  // Reset messaging state on logout
  useEffect(() => {
    const handleLogout = () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setInitialized(false);
      setSelected(null);
      setMsgMessages([]);
      setConversations([]);
      setCurrentUserId('');
    };
    window.addEventListener('cfb:logout', handleLogout);
    return () => window.removeEventListener('cfb:logout', handleLogout);
  }, []);

  // When initialUserId changes while popup is already open+initialized, open that DM
  useEffect(() => {
    if (!initialUserId || !isOpen || !initialized) return;
    let cancelled = false;
    const openDm = async () => {
      try {
        const { conversationId } = await getOrCreateDirectConversation(initialUserId);
        if (cancelled) return;
        const { conversations: refreshed } = await listMessageConversations();
        queryClient.setQueryData(queryKeys.conversationsList, { conversations: refreshed });
        const remapped = refreshed.map(mapConversation);
        if (cancelled) return;
        setConversations(remapped);
        const conv = remapped.find(c => c.id === conversationId);
        if (conv) setSelected(conv);
        setActiveTab('messages');
      } catch { /* ignore */ }
    };
    void openDm();
    return () => { cancelled = true; };
  }, [initialUserId, isOpen, initialized]);

  // Load messages when conversation selected
  useEffect(() => {
    if (!selected || !currentUserId) return;
    let cancelled = false;
    setLoadingMessages(true);
    setMsgMessages([]);
    const run = async () => {
      try {
        const { messages: list } = await listConversationMessages(selected.id, 100);
        if (cancelled) return;
        setMsgMessages(list.map(m => mapMessage(m, currentUserId)));
        setConversations(prev => prev.map(c => c.id === selected.id ? { ...c, unreadCount: 0 } : c));
        socketRef.current?.emit('conversation:join', { conversationId: selected.id });
      } catch { /* ignore */ } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [selected?.id, currentUserId]);

  // Auto-scroll messages
  useEffect(() => {
    if (msgMessages.length) msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgMessages.length]);

  // Focus msg input when thread opens
  useEffect(() => {
    if (selected && !isMinimized && activeTab === 'messages') {
      setTimeout(() => msgInputRef.current?.focus(), 100);
    }
  }, [selected?.id, isMinimized, activeTab]);

  // Reset typing on conversation change
  useEffect(() => { setIsTyping(false); }, [selected?.id]);

  // Sync active conversation ID with MessagingContext (prevents double unread)
  useEffect(() => {
    if (activeTab === 'messages' && selected) {
      setActiveConversationId(selected.id);
      markConversationRead(selected.id);
    } else {
      setActiveConversationId(null);
    }
  }, [activeTab, selected?.id, setActiveConversationId, markConversationRead]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSelectConversation = useCallback((conv: Conversation) => {
    setSelected(conv);
    setMsgInput('');
    setActiveConversationId(conv.id);
    markConversationRead(conv.id);
  }, [setActiveConversationId, markConversationRead]);

  const handleMsgSend = useCallback(() => {
    const text = msgInput.trim();
    if (!text || !selected || !socketRef.current) return;
    if (!isPreviewDemo() && !socketRef.current.connected) {
      setSendError(true);
      return;
    }
    setSendError(false);
    const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setMsgMessages(prev => [...prev, {
      id: tempId, senderId: currentUserId, content: text, timestamp: new Date(), status: 'sending',
    }]);
    setConversations(prev => prev.map(c =>
      c.id === selected.id ? { ...c, lastMessage: text, lastMessageTime: new Date() } : c,
    ));
    setMsgInput('');
    socketRef.current.emit('message:send', { conversationId: selected.id, body: text, tempId });
    socketRef.current.emit('typing:stop', { conversationId: selected.id });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
  }, [msgInput, selected, currentUserId]);

  const handleMsgInputChange = useCallback((val: string) => {
    setMsgInput(val);
    if (!selected || !socketRef.current?.connected) return;
    socketRef.current.emit('typing:start', { conversationId: selected.id });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socketRef.current?.emit('typing:stop', { conversationId: selected.id });
    }, 2000);
  }, [selected]);

  const handleMsgKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleMsgSend(); }
  }, [handleMsgSend]);

  const handleAIExpand = useCallback(() => {
    close();
    router.push('/ai');
  }, [close, router]);

  const handleExpandToFullPage = useCallback(() => {
    const url = selected ? `/messages?c=${selected.id}` : '/messages';
    close();
    router.push(url);
  }, [selected, close, router]);

  // Derived
  const selectedId = selected?.id ?? null;
  const filteredConvos = conversations.filter(
    c => !c.isArchived && c.recipientName.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  // The shared count - the same number as the chat bubble and the sidebar.
  // Summing this popup's own list disagreed with both after every read.
  const totalMsgUnread = sharedUnread;

  // ── Render guards ──────────────────────────────────────────────────────────
  if (!hasSession || !sessionReady || !isOpen || shouldHide) return null;

  // ── Minimized pill ─────────────────────────────────────────────────────────
  if (isMinimized) {
    return (
      <div
        className="pointer-events-none fixed bottom-6 right-6 z-50 hidden animate-in slide-in-from-bottom-2 lg:block"
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      >
        <div
          {...dragHandleProps}
          className={cn(
            'pointer-events-auto flex items-center gap-1 rounded-full bg-primary py-1.5 pl-2 pr-1.5 shadow-none',
            isDragging && 'cursor-grabbing opacity-90',
          )}
          style={dragHandleProps.style}
        >
          <button
            type="button"
            onClick={restore}
            className="flex items-center gap-2 rounded-full px-1.5 py-0.5 text-primary-foreground hover:bg-white/10"
            aria-label={bilingualAria('Restore chat', 'Επαναφορά συνομιλίας')}
          >
            <LogoIcon size={22} mono className="pointer-events-none text-primary-foreground" />
            <span className="text-sm font-medium">
              <BilingualText en={messagesEn('popup_title')} el={messagesEl('popup_title')} compact />
            </span>
            {totalMsgUnread > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1.5 text-2xs font-bold text-primary-foreground">
                {totalMsgUnread > 99 ? '99+' : totalMsgUnread}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={close}
            className="rounded-full p-1 hover:bg-white/20 transition-colors"
            aria-label={bilingualAria('Close chat', 'Κλείσιμο συνομιλίας')}
          >
            <X className="icon-sm text-primary-foreground/80" />
          </button>
        </div>
      </div>
    );
  }

  // ── Full popup ─────────────────────────────────────────────────────────────
  return (
    <div
      ref={popupRef}
      tabIndex={-1}
      className="fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-modal animate-in fade-in slide-in-from-bottom-4 duration-200 focus:outline-none bottom-6 right-6"
      role="dialog"
      aria-label={bilingualAria('Chat', 'Συνομιλία')}
      style={{
        width: 'min(420px, calc(100vw - 2rem))',
        height: 'min(580px, calc(100dvh - 6rem))',
        transform: `translate(${position.x}px, ${position.y}px)`,
      }}
    >
      {/* ── Header: drag the bar itself ── */}
      <div
        {...dragHandleProps}
        className={cn(
          'flex shrink-0 items-center gap-1.5 border-b border-white/10 bg-primary px-2 py-2',
          isDragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
        tabIndex={0}
        style={dragHandleProps.style}
        title={bilingualAria(messagesEn('drag_panel'), messagesEl('drag_panel'))}
      >
        <div
          role="tablist"
          aria-label={bilingualAria('Chat sections', 'Ενότητες συνομιλίας')}
          className="flex min-w-0 flex-1 items-center gap-0.5 rounded-full bg-white/10 p-0.5"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'messages'}
            onClick={() => selectTab('messages')}
            className={cn(
              'flex min-w-0 flex-1 items-center justify-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition-all',
              activeTab === 'messages' ? 'bg-white text-primary-accessible shadow-sm' : 'text-primary-foreground/75 hover:bg-white/20 hover:text-primary-foreground',
            )}
          >
            <MessageSquare className="icon-sm shrink-0" />
            <span className="truncate">{sayOne(messagesEn('page_title'), messagesEl('page_title'))}</span>
            {totalMsgUnread > 0 && (
              <span className={cn(
                'flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-2xs font-bold',
                activeTab === 'messages' ? 'bg-primary text-primary-foreground' : 'bg-status-danger-mark text-ink',
              )}>
                {totalMsgUnread > 99 ? '99+' : totalMsgUnread}
              </span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'ai'}
            onClick={() => selectTab('ai')}
            className={cn(
              'flex min-w-0 flex-1 items-center justify-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition-all',
              activeTab === 'ai' ? 'bg-white text-primary-accessible shadow-sm' : 'text-primary-foreground/75 hover:bg-white/20 hover:text-primary-foreground',
            )}
          >
            <Bot className="icon-sm shrink-0" />
            <span className="truncate">{sayOne(messagesEn('popup_ai'), messagesEl('popup_ai'))}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={minimize}
          onMouseDown={(e) => e.stopPropagation()}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/20 focus-ring sm:h-8 sm:w-8"
          aria-label={bilingualAria('Minimise chat', 'Ελαχιστοποίηση συνομιλίας')}
          title={bilingualAria('Minimise chat', 'Ελαχιστοποίηση συνομιλίας')}
        >
          <ChevronDown className="icon-sm text-primary-foreground" />
        </button>
        <button
          type="button"
          onClick={close}
          onMouseDown={(e) => e.stopPropagation()}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/20 focus-ring sm:h-8 sm:w-8"
          aria-label={bilingualAria('Close chat', 'Κλείσιμο συνομιλίας')}
          title={bilingualAria('Close chat', 'Κλείσιμο συνομιλίας')}
        >
          <X className="icon-sm text-primary-foreground" />
        </button>
      </div>

      {/* ── AI Tab ── */}
      {activeTab === 'ai' && (
        <CopilotWorkspace
          variant="popup"
          onExpand={handleAIExpand}
          autoPrompt={pendingPrompt}
          onAutoPromptSent={consumePrompt}
        />
      )}

      {/* ── Messages Tab ── */}
      {activeTab === 'messages' && (
        <>
          {/* Thread sub-header */}
          {selected && (
            <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card/80 px-3 py-2">
              <button
                type="button"
                onClick={() => { setSelected(null); setActiveConversationId(null); }}
                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={bilingualAria('Back to conversations', 'Πίσω στις συνομιλίες')}
              >
                <ArrowLeft className="icon-sm" />
              </button>
              <button
                type="button"
                className="relative min-w-0 flex-1 text-left"
                onClick={() => { close(); router.push(`/matches/${selected.recipientId}`); }}
                aria-label={bilingualAria(messagesEn('view_profile'), messagesEl('view_profile'))}
              >
                <div className="flex items-center gap-2">
                  <div className="relative shrink-0">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={selected.recipientAvatar ?? undefined} />
                      <AvatarFallback className="text-2xs font-semibold bg-primary/15 text-primary-accessible">
                        {selected.recipientName[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {selected.isOnline && (
                      <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-status-success-mark ring-1 ring-background" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold leading-tight text-foreground">{selected.recipientName}</p>
                    <p className="text-2xs leading-tight text-muted-foreground">
                      <BilingualText
                        en={selected.isOnline ? messagesEn('online') : messagesEn('offline')}
                        el={selected.isOnline ? messagesEl('online') : messagesEl('offline')}
                        compact
                      />
                    </p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => { close(); router.push(`/matches/${selected.recipientId}`); }}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title={bilingualAria(messagesEn('view_profile'), messagesEl('view_profile'))}
                aria-label={bilingualAria(messagesEn('view_profile'), messagesEl('view_profile'))}
              >
                <User className="icon-sm" />
              </button>
              <button
                type="button"
                onClick={handleExpandToFullPage}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title={bilingualAria(messagesEn('open_full_inbox'), messagesEl('open_full_inbox'))}
                aria-label={bilingualAria(messagesEn('open_full_inbox'), messagesEl('open_full_inbox'))}
              >
                <Maximize2 className="icon-sm" />
              </button>
            </div>
          )}

          {isInitializing ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="icon-md text-muted-foreground animate-spin" />
            </div>
          ) : selected ? (
            /* Message thread */
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1 scroll-smooth">
                {loadingMessages ? (
                  <div className="flex justify-center pt-8">
                    <Loader2 className="icon-sm text-muted-foreground animate-spin" />
                  </div>
                ) : msgMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <MessageCircle className="icon-md text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">
                      <BilingualText en={messagesEn('say_hello')} el={messagesEl('say_hello')} compact />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <BilingualText
                        en={`${messagesEn('start_conversation_with')} ${selected.recipientName}`}
                        el={`${messagesEl('start_conversation_with')} ${selected.recipientName}`}
                      />
                    </p>
                  </div>
                ) : (
                  <>
                    {msgMessages.map((msg, idx) => {
                      const isMe = msg.senderId === currentUserId;
                      const prevMsg = idx > 0 ? msgMessages[idx - 1] : null;
                      const showTime = !prevMsg || msg.timestamp.getTime() - prevMsg.timestamp.getTime() > 3 * 60000;
                      return (
                        <React.Fragment key={msg.id}>
                          {showTime && (
                            <div className="text-center py-1">
                              <span className="text-2xs text-muted-foreground bg-muted/60 rounded-full px-2 py-0.5">
                                {formatTime(msg.timestamp)}
                              </span>
                            </div>
                          )}
                          <div className={cn('flex items-end gap-1.5', isMe ? 'flex-row-reverse' : 'flex-row')}>
                            {!isMe && (
                              <Avatar className="h-6 w-6 shrink-0 mb-0.5">
                                <AvatarImage src={selected.recipientAvatar ?? undefined} />
                                <AvatarFallback className="text-2xs bg-primary/15 text-primary-accessible">
                                  {selected.recipientName[0]?.toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <div className={cn(
                              'max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
                              isMe ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted text-foreground',
                            )}>
                              {PREVIEW_MESSAGE_EL[msg.content]
                                ? <BilingualText en={msg.content} el={PREVIEW_MESSAGE_EL[msg.content]} />
                                : msg.content}
                            </div>
                            {isMe && (
                              <span className="text-muted-foreground mb-0.5">
                                {msg.status === 'sending' ? (
                                  <Loader2 className="icon-sm animate-spin" />
                                ) : msg.status === 'read' ? (
                                  <CheckCheck className="icon-sm text-primary-accessible" />
                                ) : (
                                  <Check className="icon-sm" />
                                )}
                              </span>
                            )}
                          </div>
                        </React.Fragment>
                      );
                    })}
                    {isTyping && <TypingIndicator />}
                    <div ref={msgEndRef} />
                  </>
                )}
              </div>

              <div className="shrink-0 border-t border-border bg-card/80 px-3 py-2.5">
                {!liveConnected && !isPreviewDemo() && (
                  <p className="mb-2 text-2xs text-status-warning">
                    <BilingualText en={messagesEn('reconnecting')} el={messagesEl('reconnecting')} />
                  </p>
                )}
                {sendError && (
                  <p className="mb-2 text-2xs text-destructive-accessible">
                    <BilingualText en={messagesEn('not_connected')} el={messagesEl('not_connected')} />
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    ref={msgInputRef}
                    value={msgInput}
                    onChange={e => handleMsgInputChange(e.target.value)}
                    onKeyDown={handleMsgKeyDown}
                    placeholder={sayOne(messagesEn('type_message'), messagesEl('type_message'))}
                    aria-label={bilingualAria(messagesEn('type_message'), messagesEl('type_message'))}
                    className="h-9 flex-1 rounded-xl border-border bg-background text-sm"
                  />
                  <Button
                    type="button"
                    onClick={handleMsgSend}
                    disabled={!msgInput.trim()}
                    size="sm"
                    className="h-9 w-9 shrink-0 rounded-xl p-0"
                    aria-label={bilingualAria(messagesEn('send'), messagesEl('send'))}
                  >
                    <Send className="icon-sm" />
                  </Button>
                </div>
                <p className="mt-1.5 text-2xs text-muted-foreground">
                  <BilingualText en={messagesEn('type_message_hint')} el={messagesEl('type_message_hint')} compact wrap />
                </p>
              </div>
            </div>
          ) : (
            /* Conversation list */
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-3 pt-2.5 pb-2 shrink-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={sayOne(messagesEn('search_conversations'), messagesEl('search_conversations'))}
                    aria-label={bilingualAria(messagesEn('search_conversations'), messagesEl('search_conversations'))}
                    className="h-8 rounded-lg border-border bg-muted/40 pl-8 text-xs"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-2 pb-2">
                {filteredConvos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <MessageCircle className="icon-md text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">
                      {searchQuery
                        ? <BilingualText en={messagesEn('no_conversations_found')} el={messagesEl('no_conversations_found')} compact />
                        : <BilingualText en={messagesEn('no_conversations')} el={messagesEl('no_conversations')} compact />}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {searchQuery
                        ? <BilingualText en={`${messagesEn('no_results_for')} “${searchQuery}”`} el={`${messagesEl('no_results_for')} «${searchQuery}»`} />
                        : <BilingualText en={messagesEn('empty_inbox_cta')} el={messagesEl('empty_inbox_cta')} />}
                    </p>
                  </div>
                ) : (
                  filteredConvos.map(conv => (
                    <ConvoItem
                      key={conv.id}
                      conv={conv}
                      selected={selectedId === conv.id}
                      onClick={() => handleSelectConversation(conv)}
                    />
                  ))
                )}
              </div>

              <div className="shrink-0 space-y-1.5 border-t border-border px-3 py-2">
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => { close(); router.push('/matches'); }}
                    className="flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-2xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  >
                    <Heart className="icon-sm" />
                    <span className="truncate">{sayOne(messagesEn('find_matches'), messagesEl('find_matches'))}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { close(); router.push('/discover'); }}
                    className="flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-2xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  >
                    <Compass className="icon-sm" />
                    <span className="truncate">{sayOne(messagesEn('discover_people'), messagesEl('discover_people'))}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { close(); router.push('/connections'); }}
                    className="flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-2xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  >
                    <UserCheck className="icon-sm" />
                    <span className="truncate">{sayOne(messagesEn('connections'), messagesEl('connections'))}</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleExpandToFullPage}
                  className="flex w-full items-center justify-center gap-2 rounded-lg py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                >
                  <Maximize2 className="icon-sm" />
                  {sayOne(messagesEn('open_full_inbox'), messagesEl('open_full_inbox'))}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
