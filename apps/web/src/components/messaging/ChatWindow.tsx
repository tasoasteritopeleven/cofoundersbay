'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Send,
  Paperclip,
  Smile,
  MoreVertical,
  Info,
  Check,
  CheckCheck,
  Flag,
  Ban,
  Trash2,
  ArrowLeft,
  Search,
  X,
  Copy,
  Reply,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ThreadAvatar } from '@/components/messaging/ThreadAvatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RoleBadge } from '@/components/common/RoleBadge';
import { BilingualText } from '@/components/common/BilingualText';
import { CfbGlyph } from '@/components/icons/CfbGlyph';
import {
  ConversationValidationMenu,
  TranscriptExportButton,
  type ConversationValidationState,
  type ValidationMode,
} from '@/components/messaging/ConversationValidation';
import { cn } from '@/lib/utils';
import { bilingualAria } from '@/lib/i18n/format';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';
import {
  messagesEn,
  messagesEl,
  useMessagesPrimaryText,
  PREVIEW_MESSAGE_EL,
} from '@/lib/i18n/strings-messages';

export type Message = {
  id: string;
  senderId: string;
  content: string;
  timestamp: Date;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  attachments?: { type: string; url: string; name: string }[];
  reactions?: { emoji: string; count: number }[];
  replyTo?: { id: string; content: string; senderName: string };
};

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '🙏', '🔥'];

type ChatWindowProps = {
  conversation: {
    id: string;
    recipientId: string;
    recipientName: string;
    recipientAvatar?: string | null;
    recipientRole: string;
    recipientHeadline?: string | null;
    isOnline?: boolean;
    lastSeen?: Date;
  };
  messages: Message[];
  currentUserId: string;
  onSendMessage: (content: string, attachments?: File[]) => void;
  onBack?: () => void;
  onReport?: () => void;
  onBlock?: () => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  isRecipientTyping?: boolean;
  hasMoreMessages?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  className?: string;
  validationState?: ConversationValidationState;
  onValidationModeChange?: (mode: ValidationMode) => void;
  onAskAi?: () => void;
  initialDraft?: string;
};

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || full;
}

function fillName(template: string, name: string): string {
  return template.replaceAll('{name}', firstName(name));
}

function toggleReactionList(
  current: { emoji: string; count: number }[] | undefined,
  emoji: string,
): { emoji: string; count: number }[] {
  const list = current ? [...current] : [];
  const idx = list.findIndex((r) => r.emoji === emoji);
  if (idx === -1) {
    list.push({ emoji, count: 1 });
    return list;
  }
  if (list[idx].count <= 1) {
    list.splice(idx, 1);
    return list;
  }
  list[idx] = { ...list[idx], count: list[idx].count - 1 };
  return list;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date: Date, today: string, yesterday: string, lang: 'en' | 'el'): string {
  const now = new Date();
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);

  if (date.toDateString() === now.toDateString()) return today;
  if (date.toDateString() === yest.toDateString()) return yesterday;
  return date.toLocaleDateString(lang === 'el' ? 'el-GR' : 'en-GB', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function MessageBubble({
  message,
  isOwn,
  showAvatar,
  recipientAvatar,
  recipientName,
  onReply,
  onReact,
}: {
  message: Message;
  isOwn: boolean;
  showAvatar: boolean;
  recipientAvatar?: string | null;
  recipientName: string;
  onReply?: (msg: Message) => void;
  onReact?: (messageId: string, emoji: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      className={cn('group flex gap-2', isOwn ? 'flex-row-reverse' : 'flex-row')}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="w-8 flex-shrink-0">
        {showAvatar && !isOwn && (
          <ThreadAvatar name={recipientName} src={recipientAvatar} size="sm" />
        )}
      </div>

      {/* Message content */}
      <div className={cn('max-w-[70%] flex flex-col', isOwn ? 'items-end' : 'items-start')}>
        {/* Reply preview */}
        {message.replyTo && (
          <div className={cn(
            'mb-1 rounded-lg border-l-2 border-primary/50 bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground max-w-full',
          )}>
            <span className="font-medium text-foreground/70">{message.replyTo.senderName}: </span>
            <span className="truncate">{message.replyTo.content.slice(0, 60)}{message.replyTo.content.length > 60 ? '…' : ''}</span>
          </div>
        )}

        <div className="relative">
          {/* Hover action bar */}
          {showActions && (
            <div className={cn(
              'absolute -top-8 flex items-center gap-0.5 rounded-full border border-border bg-card shadow-md px-1 py-0.5 z-10',
              isOwn ? 'right-0' : 'left-0',
            )}>
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="rounded-full p-1 text-sm hover:bg-secondary/80 transition-colors"
                  title={bilingualAria(messagesEn('add_reaction'), messagesEl('add_reaction'))}
                  aria-label={bilingualAria(messagesEn('add_reaction'), messagesEl('add_reaction'))}
                  onClick={() => onReact?.(message.id, emoji)}
                >
                  {emoji}
                </button>
              ))}
              <div className="w-px h-4 bg-border/60 mx-0.5" />
              <button
                type="button"
                className="rounded-full p-1 hover:bg-secondary/80 transition-colors"
                title={bilingualAria(messagesEn('reply'), messagesEl('reply'))}
                onClick={() => onReply?.(message)}
              >
                <Reply className="icon-sm text-muted-foreground" />
              </button>
              <button
                type="button"
                className="rounded-full p-1 hover:bg-secondary/80 transition-colors"
                title={copied ? bilingualAria(messagesEn('copied'), messagesEl('copied')) : bilingualAria(messagesEn('copy'), messagesEl('copy'))}
                onClick={handleCopy}
              >
                <Copy className="icon-sm text-muted-foreground" />
              </button>
            </div>
          )}

          <div
            className={cn(
              'px-4 py-2.5 text-xs leading-relaxed shadow-sm',
              isOwn
                ? 'rounded-2xl rounded-br-sm bg-primary text-primary-foreground'
                : 'rounded-2xl rounded-bl-sm border border-border bg-background/90 text-foreground backdrop-blur-sm',
            )}
          >
            <p className="text-sm whitespace-pre-wrap break-words">
              {PREVIEW_MESSAGE_EL[message.content]
                ? <BilingualText en={message.content} el={PREVIEW_MESSAGE_EL[message.content]} wrap />
                : message.content}
            </p>
            {message.attachments?.length ? (
              <div className="mt-2 space-y-1">
                {message.attachments.map((a, idx) => (
                  <a
                    key={`${message.id}-att-${idx}`}
                    href={a.url || undefined}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs',
                      isOwn ? 'bg-white/10 hover:bg-white/15' : 'bg-background/40 hover:bg-background/50',
                      a.url ? 'underline' : 'opacity-70 cursor-default'
                    )}
                    onClick={(e) => { if (!a.url) e.preventDefault(); }}
                  >
                    <Paperclip className="icon-sm shrink-0" />
                    {a.name}
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          {/* Reactions */}
          {message.reactions?.length ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {message.reactions.map((r) => (
                <button
                  key={r.emoji}
                  type="button"
                  onClick={() => onReact?.(message.id, r.emoji)}
                  className="inline-flex items-center gap-0.5 rounded-full border border-border bg-secondary/80 px-1.5 py-0.5 text-xs transition-colors hover:bg-secondary"
                  aria-label={bilingualAria(messagesEn('add_reaction'), messagesEl('add_reaction'))}
                >
                  {r.emoji} {r.count > 1 && <span className="text-muted-foreground">{r.count}</span>}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className={cn('flex items-center gap-1 mt-1', isOwn ? 'justify-end' : 'justify-start')}>
          <span className="text-2xs text-muted-foreground">{formatTime(message.timestamp)}</span>
          {isOwn && (
            <span className="text-muted-foreground">
              {message.status === 'sending' && <span className="text-2xs" title="Sending">•</span>}
              {message.status === 'sent' && <Check className="icon-sm" />}
              {message.status === 'delivered' && <CheckCheck className="icon-sm" />}
              {message.status === 'read' && <CheckCheck className="icon-sm text-primary-accessible" />}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function DateDivider({ date }: { date: Date }) {
  const t = useMessagesPrimaryText();
  const { primary } = useLanguagePreference();
  return (
    <div className="my-3 flex justify-center">
      <span className="px-1 text-2xs font-medium text-muted-foreground">
        {formatDate(date, t(messagesEn('today'), messagesEl('today')), t(messagesEn('yesterday'), messagesEl('yesterday')), primary)}
      </span>
    </div>
  );
}

export function ChatWindow({
  conversation,
  messages,
  currentUserId,
  onSendMessage,
  onBack,
  onReport,
  onBlock,
  onTypingStart,
  onTypingStop,
  isRecipientTyping = false,
  hasMoreMessages = false,
  isLoadingMore = false,
  onLoadMore,
  className,
  validationState,
  onValidationModeChange,
  onAskAi,
  initialDraft,
}: ChatWindowProps) {
  const t = useMessagesPrimaryText();
  const [inputValue, setInputValue] = useState(initialDraft ?? '');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [localReactions, setLocalReactions] = useState<Record<string, { emoji: string; count: number }[]>>({});
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalReactions({});
    setReplyTo(null);
    setSearchOpen(false);
    setSearchQuery('');
    setPendingFiles([]);
    setInputValue(initialDraft ?? '');
  }, [conversation.id, initialDraft]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(min-width: 768px)').matches) return;
    textareaRef.current?.focus();
  }, [conversation.id]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Typing indicator
  const handleTyping = (value: string) => {
    setInputValue(value);
    if (value.trim()) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        onTypingStart?.();
      }
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        isTypingRef.current = false;
        onTypingStop?.();
      }, 2000);
    } else if (isTypingRef.current) {
      isTypingRef.current = false;
      onTypingStop?.();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    }
  };

  // Handle send
  const handleSend = () => {
    if (!inputValue.trim() && pendingFiles.length === 0) return;
    onSendMessage(inputValue.trim(), pendingFiles.length ? pendingFiles : undefined);
    setInputValue('');
    setPendingFiles([]);
    setReplyTo(null);
    // Stop typing on send
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTypingStop?.();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    }
    textareaRef.current?.focus();
  };

  const handleReact = (messageId: string, emoji: string) => {
    setLocalReactions((prev) => {
      const base = prev[messageId] ?? messages.find((m) => m.id === messageId)?.reactions;
      return { ...prev, [messageId]: toggleReactionList(base, emoji) };
    });
  };

  const applyDraft = (text: string) => {
    setInputValue(text);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const el = textareaRef.current;
      if (el) el.setSelectionRange(el.value.length, el.value.length);
    });
  };

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Filter by search
  const filteredMessages = searchQuery.trim()
    ? messages.filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const visibleMessages = filteredMessages.map((m) =>
    localReactions[m.id] ? { ...m, reactions: localReactions[m.id] } : m,
  );

  // Group messages by date
  const groupedMessages: { date: Date; messages: Message[] }[] = [];
  let currentDate: string | null = null;

  visibleMessages.forEach((msg) => {
    const dateStr = msg.timestamp.toDateString();
    if (dateStr !== currentDate) {
      currentDate = dateStr;
      groupedMessages.push({ date: msg.timestamp, messages: [msg] });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg);
    }
  });

  return (
    <div className={cn('relative flex h-full min-h-0 flex-col bg-background', className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_52%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(hsl(var(--foreground)/0.07)_1px,transparent_1px)] bg-[size:18px_18px] opacity-40"
      />
      {/* Header */}
      <div className="relative z-10 flex flex-col border-b border-border bg-background/75 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl md:hidden" aria-label={bilingualAria(messagesEn('back_to_conversations'), messagesEl('back_to_conversations'))}>
                <ArrowLeft className="icon-md" />
              </Button>
            )}
            <Link href={`/profiles/${conversation.recipientId}`} className="flex min-w-0 items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ThreadAvatar
                name={conversation.recipientName}
                src={conversation.recipientAvatar}
                seed={conversation.recipientId}
                size="md"
                online={conversation.isOnline}
              />
              {/* The thread's head reads like a card's: the name on the
                  title step, the line under it on the subtitle step. */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="card-title truncate text-foreground">{conversation.recipientName}</span>
                  <RoleBadge role={conversation.recipientRole || 'founder'} size="sm" className="hidden sm:inline-flex" />
                </div>
                <p className="card-subtitle truncate">
                  {conversation.isOnline
                    ? <span className="font-medium text-status-success">{t(messagesEn('online'), messagesEl('online'))}</span>
                    : conversation.recipientHeadline
                      ? conversation.recipientHeadline
                      : conversation.lastSeen
                        ? `${t(messagesEn('last_seen'), messagesEl('last_seen'))} ${formatTime(conversation.lastSeen)}`
                        : t(messagesEn('offline'), messagesEl('offline'))}
                </p>
              </div>
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {validationState && (
              <ConversationValidationMenu
                conversationId={conversation.id}
                currentUserId={currentUserId}
                otherUserId={conversation.recipientId}
                otherUserName={conversation.recipientName}
                validationState={validationState}
                onModeChange={onValidationModeChange}
              />
            )}
            {validationState && validationState.mode !== 'casual' && (
              <TranscriptExportButton
                conversationId={conversation.id}
                validationState={validationState}
              />
            )}
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" title={bilingualAria(messagesEn('search_messages'), messagesEl('search_messages'))} aria-label={bilingualAria(messagesEn('search_messages'), messagesEl('search_messages'))} onClick={() => { setSearchOpen((v) => !v); setSearchQuery(''); }}>
              <Search className="icon-sm" />
            </Button>
            <Button asChild variant="ghost" size="icon" className="h-9 w-9 rounded-xl" title={bilingualAria(messagesEn('open_calendar'), messagesEl('open_calendar'))} aria-label={bilingualAria(messagesEn('open_calendar'), messagesEl('open_calendar'))}>
              <Link href={`/calendar?with=${encodeURIComponent(conversation.recipientId)}`}>
                <CfbGlyph name="calendar" className="icon-sm" />
              </Link>
            </Button>
            {onAskAi ? (
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" title={bilingualAria(messagesEn('ask_ai_about'), messagesEl('ask_ai_about'))} aria-label={bilingualAria(messagesEn('ask_ai_about'), messagesEl('ask_ai_about'))} onClick={onAskAi}>
                <CfbGlyph name="spark" className="icon-sm" />
              </Button>
            ) : (
              <Button asChild variant="ghost" size="icon" className="h-9 w-9 rounded-xl" title={bilingualAria(messagesEn('open_ai_page'), messagesEl('open_ai_page'))} aria-label={bilingualAria(messagesEn('open_ai_page'), messagesEl('open_ai_page'))}>
                <Link href="/ai">
                  <CfbGlyph name="spark" className="icon-sm" />
                </Link>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" aria-label={bilingualAria(messagesEn('conversation_options'), messagesEl('conversation_options'))}>
                  <MoreVertical className="icon-md" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuItem asChild>
                  <Link href={`/profiles/${conversation.recipientId}`}>
                    <Info className="icon-sm mr-2" />
                    <BilingualText en={messagesEn('view_profile')} el={messagesEl('view_profile')} compact />
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/matches/${conversation.recipientId}`}>
                    <CfbGlyph name="matches" className="icon-sm mr-2" />
                    <BilingualText en={messagesEn('view_match')} el={messagesEl('view_match')} compact />
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/calendar?with=${encodeURIComponent(conversation.recipientId)}`}>
                    <CfbGlyph name="calendar" className="icon-sm mr-2" />
                    <BilingualText en={messagesEn('schedule_meet')} el={messagesEl('schedule_meet')} compact />
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onReport}>
                  <Flag className="icon-sm mr-2" />
                  <BilingualText en={messagesEn('report')} el={messagesEl('report')} compact />
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onBlock} className="text-destructive-accessible">
                  <Ban className="icon-sm mr-2" />
                  <BilingualText en={messagesEn('block')} el={messagesEl('block')} compact />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-4 py-1.5">
          <Link
            href={`/profiles/${conversation.recipientId}`}
            className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-2xs font-medium text-foreground/80 transition-colors hover:bg-muted"
          >
            <CfbGlyph name="people" className="h-3 w-3" />
            {t(messagesEn('view_profile'), messagesEl('view_profile'))}
          </Link>
          <Link
            href={`/matches/${conversation.recipientId}`}
            className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-2xs font-medium text-foreground/80 transition-colors hover:bg-muted"
          >
            <CfbGlyph name="matches" className="h-3 w-3" />
            {t(messagesEn('view_match'), messagesEl('view_match'))}
          </Link>
          <Link
            href={`/calendar?with=${encodeURIComponent(conversation.recipientId)}`}
            className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-2xs font-medium text-foreground/80 transition-colors hover:bg-muted"
          >
            <CfbGlyph name="calendar" className="h-3 w-3" />
            {t(messagesEn('schedule_meet'), messagesEl('schedule_meet'))}
          </Link>
          {onAskAi ? (
            <button
              type="button"
              onClick={onAskAi}
              className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-2xs font-medium text-foreground/80 transition-colors hover:bg-muted"
            >
              <CfbGlyph name="spark" className="h-3 w-3" />
              {t(messagesEn('draft_with_ai'), messagesEl('draft_with_ai'))}
            </button>
          ) : (
            <Link
              href="/ai"
              className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-2xs font-medium text-foreground/80 transition-colors hover:bg-muted"
            >
              <CfbGlyph name="spark" className="h-3 w-3" />
              {t(messagesEn('draft_with_ai'), messagesEl('draft_with_ai'))}
            </Link>
          )}
        </div>
        {/* Search bar */}
        {searchOpen && (
          <div className="px-4 pb-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t(messagesEn('search_in_chat'), messagesEl('search_in_chat'))}
                className="w-full rounded-xl border border-border bg-secondary/50 py-1.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            {searchQuery && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {filteredMessages.length}{' '}
                {filteredMessages.length === 1
                  ? t(messagesEn('result_one'), messagesEl('result_one'))
                  : t(messagesEn('results_n'), messagesEl('results_n'))}
              </span>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSearchOpen(false); setSearchQuery(''); }} aria-label={bilingualAria(messagesEn('close_search'), messagesEl('close_search'))}>
              <X className="icon-sm" />
            </Button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col justify-end px-4 py-4 sm:px-6">
        {hasMoreMessages && (
          <div className="flex justify-center py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="text-xs text-muted-foreground"
            >
              {isLoadingMore ? t(messagesEn('loading'), messagesEl('loading')) : t(messagesEn('load_older'), messagesEl('load_older'))}
            </Button>
          </div>
        )}
        {messages.length === 0 && !searchQuery && (
          <div className="mb-6 flex flex-col items-center gap-3 px-4 py-8 text-center">
            <ThreadAvatar
              name={conversation.recipientName}
              src={conversation.recipientAvatar}
              seed={conversation.recipientId}
              size="lg"
            />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                <BilingualText en={messagesEn('empty_thread_title')} el={messagesEl('empty_thread_title')} />
              </p>
              <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                <BilingualText en={messagesEn('empty_thread_hint')} el={messagesEl('empty_thread_hint')} />
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => applyDraft(fillName(t(messagesEn('say_hello_draft'), messagesEl('say_hello_draft')), conversation.recipientName))}
              >
                <BilingualText en={messagesEn('say_hello')} el={messagesEl('say_hello')} compact />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => applyDraft(t(messagesEn('schedule_draft'), messagesEl('schedule_draft')))}
              >
                <BilingualText en={messagesEn('propose_time')} el={messagesEl('propose_time')} compact />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 rounded-full px-3 text-xs"
                onClick={onAskAi}
              >
                <CfbGlyph name="spark" className="icon-sm mr-1" />
                <BilingualText en={messagesEn('draft_with_ai')} el={messagesEl('draft_with_ai')} compact />
              </Button>
            </div>
          </div>
        )}
        {groupedMessages.map((group, groupIndex) => (
          <div key={groupIndex}>
            <DateDivider date={group.date} />
            {group.messages.map((msg, msgIndex) => {
              const isOwn = msg.senderId === currentUserId;
              const prevMsg = msgIndex > 0 ? group.messages[msgIndex - 1] : null;
              const showAvatar = !prevMsg || prevMsg.senderId !== msg.senderId;

              return (
                <div key={msg.id} className="mb-1.5">
                  <MessageBubble
                    message={msg}
                    isOwn={isOwn}
                    showAvatar={showAvatar}
                    recipientAvatar={conversation.recipientAvatar}
                    recipientName={conversation.recipientName}
                    onReply={(m) => { setReplyTo(m); textareaRef.current?.focus(); }}
                    onReact={handleReact}
                  />
                </div>
              );
            })}
          </div>
        ))}

        {/* Typing indicator */}
        {isRecipientTyping && (
          <div className="flex items-center gap-2">
            <ThreadAvatar name={conversation.recipientName} src={conversation.recipientAvatar} seed={conversation.recipientId} size="sm" />
            <div className="rounded-2xl rounded-bl-sm border border-border bg-background/90 px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="relative z-10 border-t border-border bg-background/80 px-3 pb-3 pt-2 backdrop-blur-xl sm:px-4">
        {/* Reply preview */}
        {replyTo && (
          <div className="mb-2 flex items-start gap-2 rounded-xl border-l-2 border-primary/60 bg-muted/60 px-3 py-2">
            <Reply className="mt-0.5 icon-sm shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground/70">
                {replyTo.senderId === currentUserId ? t(messagesEn('you'), messagesEl('you')) : conversation.recipientName}
              </p>
              <p className="truncate text-xs text-muted-foreground">{replyTo.content.slice(0, 80)}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => setReplyTo(null)} aria-label={bilingualAria(messagesEn('cancel_reply'), messagesEl('cancel_reply'))}>
              <X className="icon-sm" />
            </Button>
          </div>
        )}

        {pendingFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {pendingFiles.map((f) => (
              <div
                key={`${f.name}-${f.size}-${f.lastModified}`}
                className="flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs text-foreground"
              >
                <Paperclip className="icon-sm text-muted-foreground" />
                <span className="max-w-[220px] truncate">{f.name}</span>
                <button aria-label="Remove file"
                  type="button"
                  className="text-muted-foreground hover:text-destructive-accessible"
                  onClick={() =>
                    setPendingFiles((prev) =>
                      prev.filter((x) => !(x.name === f.name && x.size === f.size && x.lastModified === f.lastModified)),
                    )
                  }
                >
                  <Trash2 className="icon-sm" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-1 rounded-3xl border border-border bg-muted/40 p-1.5 shadow-[inset_0_1px_0_hsl(var(--background))]">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = '';
              if (!files.length) return;
              setPendingFiles((prev) => [...prev, ...files].slice(0, 5));
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full"
            onClick={() => fileInputRef.current?.click()}
            aria-label={bilingualAria(messagesEn('attach'), messagesEl('attach'))}
          >
            <Paperclip className="icon-md" />
          </Button>
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t(messagesEn('type_message'), messagesEl('type_message'))}
            rows={1}
            className="max-h-[120px] min-h-[40px] flex-1 resize-none border-0 bg-transparent px-1 py-2.5 shadow-none focus-visible:ring-0"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-full" aria-label={bilingualAria(messagesEn('emoji'), messagesEl('emoji'))}>
                <Smile className="icon-sm" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto p-2">
              <div className="grid grid-cols-8 gap-0.5">
                {['😀','😂','😍','🥰','😎','🤔','😅','🙈','👍','👎','❤️','🔥','🎉','✅','💡','🚀',
                  '💪','🙏','👏','😢','😡','🤝','💰','⭐','🌟','📈','💻','🎯'].map((e) => (
                  <button
                    key={e}
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-secondary/80 text-base transition-colors"
                    onClick={() => {
                      setInputValue((v) => v + e);
                      textareaRef.current?.focus();
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() && pendingFiles.length === 0}
            className="h-10 w-10 shrink-0 rounded-full p-0 shadow-sm"
            aria-label={bilingualAria(messagesEn('send'), messagesEl('send'))}
          >
            <Send className="icon-md" />
          </Button>
        </div>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 px-3 text-2xs text-muted-foreground">
          <span>{t(messagesEn('type_message_hint'), messagesEl('type_message_hint'))}</span>
          {onAskAi && (
            <button
              type="button"
              onClick={onAskAi}
              className="font-medium text-primary-accessible underline-offset-2 hover:underline"
            >
              {t(messagesEn('draft_with_ai'), messagesEl('draft_with_ai'))}
            </button>
          )}
        </p>
      </div>
    </div>
  );
}

// Empty state when no conversation is selected
export function NoChatSelected({
  onNewMessage,
  onAskAi,
  recent,
  onSelectRecent,
}: {
  onNewMessage?: () => void;
  onAskAi?: () => void;
  recent?: { id: string; name: string; avatarUrl?: string | null; userId: string }[];
  onSelectRecent?: (id: string) => void;
}) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden p-8 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.12),transparent_58%)]"
      />
      <div className="relative flex max-w-md flex-col items-center gap-5">
        <div className="relative">
          <div className="absolute -inset-6 rounded-full border border-primary/15 bg-primary/[0.04]" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/[0.06]">
            <CfbGlyph name="messages" className="h-10 w-10 text-primary-accessible" />
          </div>
        </div>
        <div className="space-y-1.5">
          <h3 className="text-xl font-semibold tracking-tight text-foreground">
            <BilingualText en={messagesEn('empty_inbox_title')} el={messagesEl('empty_inbox_title')} />
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            <BilingualText en={messagesEn('empty_inbox_hint')} el={messagesEl('empty_inbox_hint')} />
          </p>
        </div>
        {recent && recent.length > 0 && onSelectRecent && (
          <div className="w-full space-y-2">
            <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <BilingualText en={messagesEn('recent_conversations')} el={messagesEl('recent_conversations')} compact />
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {recent.slice(0, 4).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectRecent(item.id)}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-2.5 py-1.5 text-left text-xs font-medium transition-colors hover:bg-muted/70"
                >
                  <ThreadAvatar name={item.name} src={item.avatarUrl} seed={item.userId} size="sm" />
                  <span className="max-w-[9rem] truncate">{item.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {onNewMessage && (
          <Button type="button" className="h-11 rounded-full px-6 shadow-sm" onClick={onNewMessage}>
            <CfbGlyph name="messages" className="icon-sm mr-2" />
            <BilingualText
              en={messagesEn('new_message')}
              el={messagesEl('new_message')}
              compact
              secondaryClassName="text-primary-foreground"
            />
          </Button>
        )}
        <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
          <Link href="/matches" className="font-medium text-primary-accessible underline-offset-4 hover:underline">
            <BilingualText en={messagesEn('browse_matches')} el={messagesEl('browse_matches')} compact />
          </Link>
          <span className="text-muted-foreground">
            <BilingualText en={messagesEn('empty_or')} el={messagesEl('empty_or')} compact />
          </span>
          <Link href="/discover" className="font-medium text-primary-accessible underline-offset-4 hover:underline">
            <BilingualText en={messagesEn('find_people_message')} el={messagesEl('find_people_message')} compact />
          </Link>
          <span className="text-muted-foreground">
            <BilingualText en={messagesEn('empty_or')} el={messagesEl('empty_or')} compact />
          </span>
          <Link href="/connections" className="font-medium text-primary-accessible underline-offset-4 hover:underline">
            <BilingualText en={messagesEn('view_connections')} el={messagesEl('view_connections')} compact />
          </Link>
        </p>
        {onAskAi && (
          <button
            type="button"
            onClick={onAskAi}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-accessible underline-offset-4 hover:underline"
          >
            <CfbGlyph name="spark" className="icon-sm" />
            <BilingualText en={messagesEn('open_ai_page')} el={messagesEl('open_ai_page')} compact />
          </button>
        )}
      </div>
    </div>
  );
}
