'use client';

import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { useVoiceRecorder, voiceRecordingSupported } from '@/hooks/useVoiceRecorder';
import Link from 'next/link';
import {
  Send,
  Paperclip,
  Smile,
  MoreVertical,
  SlidersHorizontal,
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
  Forward,
  Pencil,
  Mic,
  ChevronUp,
  ChevronDown,
  ListFilter,
  UserRound,
  Users,
  CalendarPlus,
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
import { useAskAssistant } from '@/hooks/useAskAssistant';
import type { AskText } from '@/lib/page-questions';
import { highlightParts, stepMatch, threadMatches } from '@/lib/thread-search';
import { clockTime, dayDividerLabel, type ThreadLang } from '@/lib/thread-time';
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
  editedAt?: Date | null;
  forwarded?: boolean;
};

/** As the API allows it: after this a sent message stays as written. */
const EDIT_WINDOW_MS = 15 * 60 * 1000;

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
  onEditMessage?: (messageId: string, body: string) => void;
  onDeleteMessage?: (message: Message) => void;
  onForwardMessage?: (message: Message) => void;
  canForwardMessage?: (message: Message) => boolean;
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
  /** Words to open the thread's search with (the assistant's message search links here). */
  initialSearch?: string;
  /**
   * Whether this thread's messages have been read. Until they have, no
   * messages is not an empty thread: "Say hello" was offered under a thread
   * that failed to load, and the last thread's messages stayed under the
   * next one's name while it loaded (docs §73).
   */
  threadState?: 'loading' | 'failed' | 'ready';
  onRetryThread?: () => void;
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

function MessageBubble({
  message,
  isOwn,
  showAvatar,
  recipientAvatar,
  recipientName,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onForward,
  highlight,
  hit = 'none',
  lang,
}: {
  lang: ThreadLang;
  message: Message;
  isOwn: boolean;
  showAvatar: boolean;
  recipientAvatar?: string | null;
  recipientName: string;
  onReply?: (msg: Message) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onEdit?: (msg: Message) => void;
  onDelete?: (msg: Message) => void;
  onForward?: (msg: Message) => void;
  /** The thread search's words, marked where they occur. */
  highlight?: string;
  /** 'active' is the hit the search is on; 'hit' any other match. */
  hit?: 'none' | 'hit' | 'active';
}) {
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);
  // A message still on its way has no id the server knows.
  const sent = !message.id.startsWith('temp-');
  const editable = isOwn && sent && Boolean(onEdit) && !message.attachments?.length && Date.now() - message.timestamp.getTime() < EDIT_WINDOW_MS;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      className={cn('group flex gap-2', isOwn ? 'flex-row-reverse' : 'flex-row')}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'mouse') return;
        if (window.matchMedia('(hover: none)').matches) return;
        setShowActions(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'mouse') return;
        if (window.matchMedia('(hover: none)').matches) return;
        setShowActions(false);
      }}
    >
      <div className="w-8 flex-shrink-0">
        {showAvatar && !isOwn && (
          <ThreadAvatar name={recipientName} src={recipientAvatar} size="sm" />
        )}
      </div>

      {/* Message content */}
      <div className={cn('flex max-w-[85%] flex-col sm:max-w-[70%]', isOwn ? 'items-end' : 'items-start')}>
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
          <div
            data-own-message={isOwn ? '' : undefined}
            onClick={() => {
              if (window.matchMedia('(hover: hover)').matches) return;
              setShowActions((open) => !open);
            }}
            className={cn(
              'px-4 py-2.5 text-xs leading-relaxed shadow-sm',
              isOwn
                ? 'rounded-2xl rounded-br-sm bg-primary text-primary-foreground'
                : 'rounded-2xl rounded-bl-sm border border-border bg-background/90 text-foreground backdrop-blur-sm',
              // The hit the search is on carries a ring; the others a faint one,
              // so the eye finds them while scrolling the whole thread.
              hit === 'active' && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
              hit === 'hit' && 'ring-1 ring-ring/40',
            )}
          >
            {message.forwarded ? (
              <p className="mb-0.5 flex items-center gap-1 text-2xs opacity-70" data-forwarded="">
                <Forward className="h-3 w-3" aria-hidden="true" />
                <BilingualText en={messagesEn('forwarded')} el={messagesEl('forwarded')} compact />
              </p>
            ) : null}
            <p className="text-sm whitespace-pre-wrap break-words">
              {PREVIEW_MESSAGE_EL[message.content]
                ? <BilingualText en={message.content} el={PREVIEW_MESSAGE_EL[message.content]} wrap />
                : highlight
                  ? highlightParts(message.content, highlight).map((part, i) =>
                      part.hit ? (
                        <mark key={i} className="rounded-sm bg-status-warning-mark/45 px-0.5 text-inherit">{part.text}</mark>
                      ) : (
                        <span key={i}>{part.text}</span>
                      ),
                    )
                  : message.content}
            </p>
            {message.attachments?.length ? (
              <div className="mt-2 space-y-1">
                {message.attachments.map((a, idx) => (a.type.startsWith('audio/') && a.url ? (
                  <audio key={`${message.id}-att-${idx}`} controls preload="metadata" src={a.url} className="h-10 w-60 max-w-full" data-voice-note="" />
                ) : (
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
                )))}
              </div>
            ) : null}
          </div>

          {showActions && (
            <div
              className={cn(
                'z-10 mt-1 flex max-w-full flex-wrap items-center gap-0.5 rounded-xl border border-border bg-card px-1 py-0.5 shadow-md',
                'sm:absolute sm:-top-8 sm:mt-0 sm:w-max sm:flex-nowrap sm:rounded-full',
                isOwn ? 'sm:right-0' : 'sm:left-0',
              )}
              onClick={(event) => event.stopPropagation()}
            >
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-sm transition-colors hover:bg-secondary/80 sm:h-8 sm:w-8"
                  title={bilingualAria(messagesEn('add_reaction'), messagesEl('add_reaction'))}
                  aria-label={bilingualAria(messagesEn('add_reaction'), messagesEl('add_reaction'))}
                  onClick={() => onReact?.(message.id, emoji)}
                >
                  {emoji}
                </button>
              ))}
              <div className="mx-0.5 hidden h-4 w-px bg-border/60 sm:block" />
              <button
                type="button"
                className="inline-flex h-11 items-center gap-1 rounded-full px-2 transition-colors hover:bg-secondary/80 sm:h-8 sm:px-1.5"
                title={bilingualAria(messagesEn('reply'), messagesEl('reply'))}
                onClick={() => onReply?.(message)}
              >
                <Reply className="icon-sm text-muted-foreground" />
                <span className="text-xs font-medium text-foreground sm:sr-only">
                  <BilingualText en={messagesEn('reply')} el={messagesEl('reply')} compact />
                </span>
              </button>
              <button
                type="button"
                className="inline-flex h-11 items-center gap-1 rounded-full px-2 transition-colors hover:bg-secondary/80 sm:h-8 sm:px-1.5"
                title={copied ? bilingualAria(messagesEn('copied'), messagesEl('copied')) : bilingualAria(messagesEn('copy'), messagesEl('copy'))}
                onClick={handleCopy}
              >
                <Copy className="icon-sm text-muted-foreground" />
                <span className="text-xs font-medium text-foreground sm:sr-only">
                  <BilingualText
                    en={copied ? messagesEn('copied') : messagesEn('copy')}
                    el={copied ? messagesEl('copied') : messagesEl('copy')}
                    compact
                  />
                </span>
              </button>
              {sent && onForward ? (
                <button
                  type="button"
                  className="inline-flex h-11 items-center gap-1 rounded-full px-2 transition-colors hover:bg-secondary/80 sm:h-8 sm:px-1.5"
                  title={bilingualAria(messagesEn('forward'), messagesEl('forward'))}
                  onClick={() => onForward(message)}
                >
                  <Forward className="icon-sm text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground sm:sr-only">
                    <BilingualText en={messagesEn('forward')} el={messagesEl('forward')} compact />
                  </span>
                </button>
              ) : null}
              {editable ? (
                <button
                  type="button"
                  className="inline-flex h-11 items-center gap-1 rounded-full px-2 transition-colors hover:bg-secondary/80 sm:h-8 sm:px-1.5"
                  title={bilingualAria(messagesEn('edit'), messagesEl('edit'))}
                  onClick={() => onEdit?.(message)}
                >
                  <Pencil className="icon-sm text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground sm:sr-only">
                    <BilingualText en={messagesEn('edit')} el={messagesEl('edit')} compact />
                  </span>
                </button>
              ) : null}
              {isOwn && sent && onDelete ? (
                <button
                  type="button"
                  className="inline-flex h-11 items-center gap-1 rounded-full px-2 transition-colors hover:bg-secondary/80 sm:h-8 sm:px-1.5"
                  title={bilingualAria(messagesEn('delete'), messagesEl('delete'))}
                  onClick={() => onDelete(message)}
                >
                  <Trash2 className="icon-sm text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground sm:sr-only">
                    <BilingualText en={messagesEn('delete')} el={messagesEl('delete')} compact />
                  </span>
                </button>
              ) : null}
            </div>
          )}

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
          <span className="text-2xs tabular-nums text-muted-foreground">{clockTime(message.timestamp, lang)}</span>
          {message.editedAt ? (
            <span className="text-2xs text-muted-foreground" data-edited=""><BilingualText en={messagesEn('edited')} el={messagesEl('edited')} compact /></span>
          ) : null}
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
        {dayDividerLabel(date, primary, { today: t(messagesEn('today'), messagesEl('today')), yesterday: t(messagesEn('yesterday'), messagesEl('yesterday')) })}
      </span>
    </div>
  );
}

/** Wording only. The planner must not treat this as a request to send. */
export function draftReplyPrompt(recipientName?: string | null): AskText {
  const name = recipientName?.trim();
  return name
    ? {
        en: `Draft a reply to ${name} in this conversation. Suggest the wording only. Do not send it.`,
        el: `Ετοίμασε μια απάντηση προς ${name} σε αυτή τη συνομιλία. Πρότεινε μόνο τη διατύπωση· μην τη στείλεις.`,
      }
    : {
        en: 'Draft a reply in this conversation. Suggest the wording only. Do not send it.',
        el: 'Ετοίμασε μια απάντηση σε αυτή τη συνομιλία. Πρότεινε μόνο τη διατύπωση· μην τη στείλεις.',
      };
}

export function ChatWindow({
  conversation,
  messages,
  currentUserId,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onForwardMessage,
  canForwardMessage,
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
  initialSearch,
  threadState = 'ready',
  onRetryThread,
}: ChatWindowProps) {
  const t = useMessagesPrimaryText();
  const { primary: lang } = useLanguagePreference();
  const { ask, inPlace } = useAskAssistant();
  // The draft sits on the composer, where the reply is written.
  // It opens the assistant on this page and asks for wording only, in the
  // reader's language. Send stays the only control that delivers a message.
  const draftReply = () => {
    if (inPlace) ask(draftReplyPrompt(conversation.recipientName));
    else onAskAi?.();
  };
  const [inputValue, setInputValue] = useState(initialDraft ?? '');
  const [searchOpen, setSearchOpen] = useState(false);
  // Tells the page rail that this thread is showing the tools icon, so the
  // floating pill steps aside. 'unmount' is explicit: the cleanup can run
  // while the button is still in the document.
  useLayoutEffect(() => {
    window.dispatchEvent(new CustomEvent('cfb-messages-tools-anchor', { detail: 'mount' }));
    return () => {
      window.dispatchEvent(new CustomEvent('cfb-messages-tools-anchor', { detail: 'unmount' }));
    };
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  // Which hit the search is on (index into hitIds), and whether the thread
  // shows only the matching messages, as the search did before it marked hits.
  const [activeHit, setActiveHit] = useState(-1);
  const [onlyHits, setOnlyHits] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [editing, setEditing] = useState<Message | null>(null);
  const voice = useVoiceRecorder((file) => onSendMessage(t(messagesEn('voice_note'), messagesEl('voice_note')), [file]));
  const [canRecord, setCanRecord] = useState(false);
  useEffect(() => { setCanRecord(voiceRecordingSupported()); }, []);
  const [voiceProblem, setVoiceProblem] = useState<'voice_denied' | 'voice_unavailable' | null>(null);
  const startVoice = async () => {
    const failure = await voice.start();
    setVoiceProblem(failure === 'denied' ? 'voice_denied' : failure ? 'voice_unavailable' : null);
  };
  const [localReactions, setLocalReactions] = useState<Record<string, { emoji: string; count: number }[]>>({});
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalReactions({});
    setReplyTo(null);
    setSearchOpen(Boolean(initialSearch));
    setSearchQuery(initialSearch ?? '');
    setOnlyHits(false);
    setPendingFiles([]);
    setInputValue(initialDraft ?? '');
  }, [conversation.id, initialDraft, initialSearch]);

  // The window stays mounted when another thread opens, so the recorder's own
  // unmount cleanup never runs. Leaving mid-note drops it and frees the mic.
  useEffect(() => () => { voice.cancel(); }, [conversation.id, voice.cancel]);

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
    if (editing) {
      const body = inputValue.trim();
      if (!body) return;
      if (body !== editing.content) onEditMessage?.(editing.id, body);
      setEditing(null);
      setInputValue('');
      return;
    }
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

  // Search: every hit in the whole thread, accents and case ignored, in the
  // text the reader sees (a demo message shows its Greek too). The thread
  // stays whole unless the reader asks for only the matches.
  const hitIds = useMemo(
    () => threadMatches(messages, searchQuery, (m) => (PREVIEW_MESSAGE_EL[m.content] ? [m.content, PREVIEW_MESSAGE_EL[m.content]] : [m.content])),
    [messages, searchQuery],
  );
  const searching = searchOpen && searchQuery.trim().length > 0;
  // A new query starts on the newest hit, nearest where the reader is.
  useEffect(() => {
    setActiveHit(hitIds.length ? hitIds.length - 1 : -1);
  }, [searchQuery, hitIds.length]);
  const activeHitId = activeHit >= 0 ? hitIds[activeHit] : undefined;
  useEffect(() => {
    if (!activeHitId) return;
    const rows = scrollRef.current?.querySelectorAll<HTMLElement>('[data-message-id]') ?? [];
    [...rows].find((row) => row.dataset.messageId === activeHitId)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [activeHitId]);
  const goToHit = (step: -1 | 1) => setActiveHit((current) => stepMatch(current, hitIds.length, step));
  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
    setOnlyHits(false);
  };
  const filteredMessages = searching && onlyHits ? messages.filter((m) => hitIds.includes(m.id)) : messages;

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
        className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_52%)] sm:block"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(hsl(var(--foreground)/0.07)_1px,transparent_1px)] bg-[size:18px_18px] opacity-40 sm:block"
      />
      {/* Header */}
      <div className="relative z-10 flex flex-col border-b border-border bg-background/75 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
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
                        ? `${t(messagesEn('last_seen'), messagesEl('last_seen'))} ${clockTime(conversation.lastSeen, lang)}`
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
                className="hidden sm:inline-flex"
              />
            )}
            {validationState && validationState.mode !== 'casual' && (
              <TranscriptExportButton
                conversationId={conversation.id}
                validationState={validationState}
              />
            )}
            <Button variant="ghost" size="icon" className="hidden h-9 w-9 rounded-xl sm:inline-flex" title={bilingualAria(messagesEn('search_messages'), messagesEl('search_messages'))} aria-label={bilingualAria(messagesEn('search_messages'), messagesEl('search_messages'))} onClick={() => { setSearchOpen((v) => !v); setSearchQuery(''); }}>
              <Search className="icon-sm" />
            </Button>
            {/* No calendar icon: "Schedule" under the name goes to the same
                place. Ask AI only between sm and md, where the thread takes
                the screen; from md the inbox's Ask AI sits beside it and
                does the same thing (docs §73). */}
            {onAskAi ? (
              <Button variant="ghost" size="icon" className="hidden h-9 w-9 rounded-xl sm:inline-flex md:hidden" title={bilingualAria(messagesEn('ask_ai_about'), messagesEl('ask_ai_about'))} aria-label={bilingualAria(messagesEn('ask_ai_about'), messagesEl('ask_ai_about'))} onClick={onAskAi}>
                <CfbGlyph name="spark" className="icon-sm" />
              </Button>
            ) : (
              <Button asChild variant="ghost" size="icon" className="hidden h-9 w-9 rounded-xl sm:inline-flex md:hidden" title={bilingualAria(messagesEn('open_ai_page'), messagesEl('open_ai_page'))} aria-label={bilingualAria(messagesEn('open_ai_page'), messagesEl('open_ai_page'))}>
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
                {/* Search, the profile, the match and Schedule are in the
                    header from sm; the menu carries them only on a phone,
                    where the header has no room for them (docs §73). Lucide
                    icons: an overlay hides a decorative CfbGlyph, so two of
                    these four lost theirs and their words sat out of line. */}
                <DropdownMenuItem className="sm:hidden" onClick={() => { setSearchOpen(true); setSearchQuery(''); }}>
                  <Search className="icon-sm mr-2" />
                  <BilingualText en={messagesEn('search_messages')} el={messagesEl('search_messages')} compact />
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="sm:hidden">
                  <Link href={`/profiles/${conversation.recipientId}`}>
                    <UserRound className="icon-sm mr-2" />
                    <BilingualText en={messagesEn('view_profile')} el={messagesEl('view_profile')} compact />
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="sm:hidden">
                  <Link href={`/matches/${conversation.recipientId}`}>
                    <Users className="icon-sm mr-2" />
                    <BilingualText en={messagesEn('view_match')} el={messagesEl('view_match')} compact />
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="sm:hidden">
                  <Link href={`/calendar?with=${encodeURIComponent(conversation.recipientId)}`}>
                    <CalendarPlus className="icon-sm mr-2" />
                    <BilingualText en={messagesEn('schedule_meet')} el={messagesEl('schedule_meet')} compact />
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="sm:hidden" />
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
            <button
              type="button"
              data-messages-tools-anchor=""
              aria-label={bilingualAria('Page tools', 'Εργαλεία σελίδας')}
              className="tap-target inline-flex h-9 w-9 items-center justify-center rounded-xl bg-transparent text-foreground/70 hover:bg-secondary/60 hover:text-foreground sm:hidden"
              onClick={() => window.dispatchEvent(new CustomEvent('cfb-open-page-tools'))}
            >
              <SlidersHorizontal className="icon-md" aria-hidden="true" />
            </button>
          </div>
          {validationState && (
            <div className="basis-full sm:hidden">
              <ConversationValidationMenu
                labeled
                conversationId={conversation.id}
                currentUserId={currentUserId}
                otherUserId={conversation.recipientId}
                otherUserName={conversation.recipientName}
                validationState={validationState}
                onModeChange={onValidationModeChange}
              />
            </div>
          )}
        </div>
        <div className="hidden flex-wrap items-center gap-1.5 border-t border-border px-3 py-2 sm:flex sm:px-4 sm:py-1.5">
          <Link
            href={`/profiles/${conversation.recipientId}`}
            className="tap-target-y hidden items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-2xs font-medium text-foreground/80 transition-colors hover:bg-muted sm:inline-flex"
          >
            <CfbGlyph name="people" className="h-3 w-3" />
            {t(messagesEn('view_profile'), messagesEl('view_profile'))}
          </Link>
          <Link
            href={`/matches/${conversation.recipientId}`}
            className="tap-target-y hidden items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-2xs font-medium text-foreground/80 transition-colors hover:bg-muted sm:inline-flex"
          >
            <CfbGlyph name="matches" className="h-3 w-3" />
            {t(messagesEn('view_match'), messagesEl('view_match'))}
          </Link>
          <Link
            href={`/calendar?with=${encodeURIComponent(conversation.recipientId)}`}
            className="tap-target-y hidden items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-2xs font-medium text-foreground/80 transition-colors hover:bg-muted sm:inline-flex"
          >
            <CfbGlyph name="calendar" className="h-3 w-3" />
            {t(messagesEn('schedule_meet'), messagesEl('schedule_meet'))}
          </Link>
        </div>
        {/* Search bar */}
        {searchOpen && (
          <div className="px-4 pb-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
              <input
                autoFocus
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Enter goes up the thread to the next older hit, as a
                  // reader searching back in time expects; Shift+Enter comes down.
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    goToHit(e.shiftKey ? 1 : -1);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    closeSearch();
                  }
                }}
                placeholder={t(messagesEn('search_in_chat'), messagesEl('search_in_chat'))}
                aria-label={bilingualAria(messagesEn('search_messages'), messagesEl('search_messages'))}
                className="w-full rounded-xl border border-border bg-secondary/50 py-1.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            {searching && (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground" aria-live="polite">
                {hitIds.length === 0
                  ? t(messagesEn('no_matches'), messagesEl('no_matches'))
                  : onlyHits
                    ? `${hitIds.length} ${hitIds.length === 1 ? t(messagesEn('result_one'), messagesEl('result_one')) : t(messagesEn('results_n'), messagesEl('results_n'))}`
                    : t(messagesEn('match_position'), messagesEl('match_position'))
                        .replace('{n}', String(activeHit + 1))
                        .replace('{total}', String(hitIds.length))}
              </span>
            )}
            {searching && hitIds.length > 0 && !onlyHits && (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => goToHit(-1)} aria-label={bilingualAria(messagesEn('older_match'), messagesEl('older_match'))} title={t(messagesEn('older_match'), messagesEl('older_match'))}>
                  <ChevronUp className="icon-sm" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => goToHit(1)} aria-label={bilingualAria(messagesEn('newer_match'), messagesEl('newer_match'))} title={t(messagesEn('newer_match'), messagesEl('newer_match'))}>
                  <ChevronDown className="icon-sm" />
                </Button>
              </>
            )}
            {searching && hitIds.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-7 w-7', onlyHits && 'bg-secondary text-foreground')}
                onClick={() => setOnlyHits((v) => !v)}
                aria-pressed={onlyHits}
                aria-label={bilingualAria(messagesEn('only_matches'), messagesEl('only_matches'))}
                title={t(messagesEn('only_matches'), messagesEl('only_matches'))}
              >
                <ListFilter className="icon-sm" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={closeSearch} aria-label={bilingualAria(messagesEn('close_search'), messagesEl('close_search'))}>
              <X className="icon-sm" />
            </Button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="relative z-10 min-h-0 flex-1 overflow-y-auto">
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
        {threadState === 'loading' && messages.length === 0 && (
          <div aria-busy="true" className="mb-6 space-y-3">
            <span className="sr-only">{t(messagesEn('loading'), messagesEl('loading'))}</span>
            {['w-2/5', 'ml-auto w-1/3', 'w-1/2'].map((w) => (
              <div key={w} aria-hidden className={cn('h-10 animate-pulse rounded-2xl bg-secondary', w)} />
            ))}
          </div>
        )}
        {threadState === 'failed' && messages.length === 0 && (
          <div className="mb-6 flex flex-col items-center gap-3 px-4 py-8 text-center">
            <p role="alert" className="max-w-sm text-sm font-medium text-foreground">
              <BilingualText en={messagesEn('thread_failed')} el={messagesEl('thread_failed')} wrap />
            </p>
            {onRetryThread && (
              <Button type="button" size="sm" variant="outline" onClick={onRetryThread}>
                <BilingualText en={messagesEn('retry')} el={messagesEl('retry')} compact />
              </Button>
            )}
          </div>
        )}
        {threadState === 'ready' && messages.length === 0 && !searchQuery && (
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
                <div key={msg.id} className="mb-1.5" data-message-id={msg.id}>
                  <MessageBubble
                    lang={lang}
                    message={msg}
                    highlight={searching ? searchQuery : undefined}
                    hit={!searching || !hitIds.includes(msg.id) ? 'none' : msg.id === activeHitId ? 'active' : 'hit'}
                    isOwn={isOwn}
                    showAvatar={showAvatar}
                    recipientAvatar={conversation.recipientAvatar}
                    recipientName={conversation.recipientName}
                    onReply={(m) => { setReplyTo(m); textareaRef.current?.focus(); }}
                    onReact={handleReact}
                    onEdit={onEditMessage ? (m) => { setReplyTo(null); setEditing(m); applyDraft(m.content); } : undefined}
                    onDelete={onDeleteMessage}
                    onForward={canForwardMessage?.(msg) === false ? undefined : onForwardMessage}
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

        {editing && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-1.5" data-editing-banner="">
            <Pencil className="icon-sm shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
              <BilingualText en={messagesEn('editing')} el={messagesEl('editing')} compact />
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0"
              onClick={() => { setEditing(null); setInputValue(''); }}
              aria-label={bilingualAria(messagesEn('voice_cancel'), messagesEl('voice_cancel'))}
            >
              <X className="icon-sm" />
            </Button>
          </div>
        )}

        {voiceProblem && (
          <p className="mb-2 text-xs text-muted-foreground" role="alert">
            <BilingualText en={messagesEn(voiceProblem)} el={messagesEl(voiceProblem)} wrap />
          </p>
        )}

        {voice.recording && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-1.5" data-voice-banner="">
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-destructive" aria-hidden="true" />
            <p className="min-w-0 flex-1 text-xs font-medium text-foreground" role="status">
              <BilingualText en={messagesEn('voice_recording')} el={messagesEl('voice_recording')} compact />
              <span className="ml-1 tabular-nums text-muted-foreground">{Math.floor(voice.seconds / 60)}:{String(voice.seconds % 60).padStart(2, '0')}</span>
            </p>
            <Button variant="ghost" size="sm" onClick={voice.cancel}><BilingualText en={messagesEn('voice_cancel')} el={messagesEl('voice_cancel')} compact /></Button>
            <Button size="sm" onClick={voice.stop}><BilingualText en={messagesEn('voice_send')} el={messagesEl('voice_send')} compact /></Button>
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
        <div className="mb-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto min-h-9 gap-1.5 px-2"
            onClick={draftReply}
          >
            <CfbGlyph name="spark" className="icon-sm shrink-0" aria-hidden="true" />
            <BilingualText en={messagesEn('draft_with_ai')} el={messagesEl('draft_with_ai')} compact />
          </Button>
        </div>
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
          {canRecord && !voice.recording && !editing ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full"
              onClick={() => { void startVoice(); }}
              aria-label={bilingualAria(messagesEn('voice'), messagesEl('voice'))}
            >
              <Mic className="icon-md" />
            </Button>
          ) : null}
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label={t(messagesEn('type_message'), messagesEl('type_message'))}
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
        <p className="mt-1.5 px-1 text-xs leading-snug text-muted-foreground sm:hidden">
          <BilingualText en={messagesEn('tap_message_hint')} el={messagesEl('tap_message_hint')} compact />
        </p>
        <p className="mt-1.5 hidden px-3 text-2xs text-muted-foreground sm:block">
          <span>{t(messagesEn('type_message_hint'), messagesEl('type_message_hint'))}</span>
        </p>
      </div>
    </div>
  );
}

/**
 * The pane beside the inbox when no thread is open (docs §73).
 *
 * It said "Pick a conversation — select someone from the list" over an
 * empty list, and over a list that had failed to load; and it repeated the
 * inbox beside it: New message, the recent threads, Ask AI under another
 * name ("Open full AI assistant" opened the same panel). Now it says what
 * is true of the list, once, from md where the list sits beside it:
 * - loading: nothing yet;
 * - failed: that the conversations could not be read, and Try again;
 * - empty: that there are none, and where to find people;
 * - pick: choose one. On a phone it shows only when the list is out of
 *   view, so there it carries the recent threads, New message and Ask AI.
 */
export type NoChatState = 'loading' | 'failed' | 'empty' | 'pick';

export function NoChatSelected({
  state = 'pick',
  hasConnections = false,
  onRetry,
  onNewMessage,
  onAskAi,
  recent,
  onSelectRecent,
}: {
  state?: NoChatState;
  /** Whether the reader has someone to write to (the empty inbox says how). */
  hasConnections?: boolean;
  onRetry?: () => void;
  onNewMessage?: () => void;
  onAskAi?: () => void;
  recent?: { id: string; name: string; avatarUrl?: string | null; userId: string }[];
  onSelectRecent?: (id: string) => void;
}) {
  const backdrop = (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.12),transparent_58%)]"
    />
  );
  if (state === 'loading') {
    return (
      <div aria-busy="true" className="relative flex h-full flex-col overflow-hidden">
        {backdrop}
      </div>
    );
  }
  const title =
    state === 'failed' ? 'inbox_failed' : state === 'empty' ? 'no_conversations' : 'empty_inbox_title';
  const hint =
    state === 'failed'
      ? null
      : state === 'empty'
        ? hasConnections ? 'write_to_connection' : 'connect_to_chat'
        : 'empty_inbox_hint';
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden p-8 text-center">
      {backdrop}
      {/* No glyph: the page hides decorative glyphs and their wells, and
          this one left its ring behind, an empty grey circle over the
          words (docs §73). The state reads by its words. */}
      <div className="relative flex max-w-md flex-col items-center gap-5">
        <div role={state === 'failed' ? 'alert' : undefined} className="space-y-1.5">
          {/* A step under the inbox's own h1 (text-lg, text-xl on a
              desktop), and the hint a step under this title on a phone too. */}
          <h3 className="text-lg font-semibold tracking-tight text-foreground">
            <BilingualText en={messagesEn(title)} el={messagesEl(title)} wrap />
          </h3>
          {hint && (
            <p className="card-body text-muted-foreground">
              <BilingualText en={messagesEn(hint)} el={messagesEl(hint)} />
            </p>
          )}
        </div>
        {state === 'failed' && onRetry && (
          <Button type="button" variant="outline" className="rounded-full px-5" onClick={onRetry}>
            <BilingualText en={messagesEn('retry')} el={messagesEl('retry')} compact />
          </Button>
        )}
        {state === 'pick' && recent && recent.length > 0 && onSelectRecent && (
          <div className="w-full space-y-2 md:hidden">
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
        {state === 'pick' && onNewMessage && (
          <Button type="button" className="h-11 rounded-full px-6 shadow-sm md:hidden" onClick={onNewMessage}>
            <CfbGlyph name="messages" className="icon-sm mr-2" />
            <BilingualText
              en={messagesEn('new_message')}
              el={messagesEl('new_message')}
              compact
              secondaryClassName="text-primary-foreground"
            />
          </Button>
        )}
        {state === 'empty' && (
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
            {hasConnections && (
              <>
                <span className="text-muted-foreground">
                  <BilingualText en={messagesEn('empty_or')} el={messagesEl('empty_or')} compact />
                </span>
                <Link href="/connections" className="font-medium text-primary-accessible underline-offset-4 hover:underline">
                  <BilingualText en={messagesEn('view_connections')} el={messagesEl('view_connections')} compact />
                </Link>
              </>
            )}
          </p>
        )}
        {state === 'pick' && onAskAi && (
          <button
            type="button"
            onClick={onAskAi}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-accessible underline-offset-4 hover:underline md:hidden"
          >
            <CfbGlyph name="spark" className="icon-sm" />
            <BilingualText en={messagesEn('ask_ai')} el={messagesEl('ask_ai')} compact />
          </button>
        )}
      </div>
    </div>
  );
}
