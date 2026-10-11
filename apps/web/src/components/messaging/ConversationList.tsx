'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, MoreHorizontal, Archive, Pin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BilingualText } from '@/components/common/BilingualText';
import { CfbGlyph } from '@/components/icons/CfbGlyph';
import { ThreadAvatar } from '@/components/messaging/ThreadAvatar';
import { cn } from '@/lib/utils';
import { bilingualAria } from '@/lib/i18n/format';
import { UnavailableMenuItem } from '@/components/common/UnavailableMenuItem';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';
import {
  messagesEn,
  messagesEl,
  useMessagesPrimaryText,
  PREVIEW_MESSAGE_EL,
} from '@/lib/i18n/strings-messages';

export type Conversation = {
  id: string;
  recipientId: string;
  recipientName: string;
  recipientAvatar?: string | null;
  recipientRole: string;
  recipientHeadline?: string | null;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  isPinned?: boolean;
  isArchived?: boolean;
  isOnline?: boolean;
};

type ConversationListProps = {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (conversation: Conversation) => void;
  onNewMessage?: () => void;
  onArchive?: (id: string) => void;
  onPin?: (id: string) => void;
};

function formatListTime(date: Date, yesterday: string, lang: 'en' | 'el'): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / 86400000);
  const locale = lang === 'el' ? 'el-GR' : 'en-GB';

  if (days === 0) {
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }
  if (days === 1) return yesterday;
  if (days < 7) return date.toLocaleDateString(locale, { timeZone: 'UTC', weekday: 'short' });
  return date.toLocaleDateString(locale, { timeZone: 'UTC', month: 'short', day: 'numeric' });
}

function ConversationItem({
  conversation,
  isSelected,
  onSelect,
  onArchive,
  onPin,
  yesterdayLabel,
  lang,
}: {
  conversation: Conversation;
  isSelected: boolean;
  onSelect: () => void;
  onArchive?: () => void;
  onPin?: () => void;
  yesterdayLabel: string;
  lang: 'en' | 'el';
}) {
  const unread = conversation.unreadCount > 0;

  return (
    /* The row used to be `role="button" tabIndex={0}` wrapping the actions
       menu, which is a button inside a button: `nested-interactive (serious)`.
       A screen reader flattens the inner control out of existence and a
       keyboard user cannot reach the menu at all — Tab lands on the row and
       the menu is simply not in the order.
       The row is now a plain container. Its primary action is a real
       `<button>` stretched over the row by the `::after` inset overlay, which
       keeps the whole row clickable while leaving the menu a sibling rather
       than a descendant. Enter and Space work because it is a button, not
       because of a hand-written key handler. */
    <div
      className={cn(
        'group relative flex items-center gap-3 rounded-2xl px-3 py-3 transition-all duration-150 sm:py-2.5',
        isSelected
          ? 'bg-muted/50'
          : 'hover:bg-muted/30',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={isSelected ? 'true' : undefined}
        aria-label={conversation.recipientName}
        className="absolute inset-0 z-0 cursor-pointer rounded-2xl focus-ring"
      />
      <span
        className={cn(
          'absolute left-1 top-3 bottom-3 w-1 rounded-full transition-colors',
          isSelected ? 'bg-primary' : unread ? 'bg-primary/80' : 'bg-transparent',
        )}
      />
      <ThreadAvatar
        name={conversation.recipientName}
        src={conversation.recipientAvatar}
        seed={conversation.recipientId}
        size="lg"
        online={conversation.isOnline}
      />

      <div className="min-w-0 flex-1 pr-10 sm:pr-0">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {conversation.isPinned && (
              <Pin className="h-3 w-3 shrink-0 text-primary-accessible" />
            )}
            <span
              className={cn(
                'truncate text-sm font-semibold leading-tight',
                unread ? 'font-semibold text-foreground' : 'font-medium text-foreground',
              )}
            >
              {conversation.recipientName}
            </span>
          </div>
          <span
            className={cn(
              'shrink-0 text-xs tabular-nums',
              unread ? 'font-medium text-primary-accessible' : 'text-muted-foreground',
            )}
          >
            {formatListTime(conversation.lastMessageTime, yesterdayLabel, lang)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p
            className={cn(
              'truncate text-xs leading-snug',
              unread ? 'font-medium text-foreground/80' : 'text-muted-foreground',
            )}
          >
            {conversation.lastMessage ? (
              PREVIEW_MESSAGE_EL[conversation.lastMessage]
                ? <BilingualText en={conversation.lastMessage} el={PREVIEW_MESSAGE_EL[conversation.lastMessage]} compact />
                : conversation.lastMessage
            ) : (
              <span className="italic">
                <BilingualText en={messagesEn('no_messages_yet')} el={messagesEl('no_messages_yet')} compact />
              </span>
            )}
          </p>
          {unread && (
            <span className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-2xs font-bold text-primary-foreground">
              {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
            </span>
          )}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1.5 top-1.5 z-10 h-8 w-8 rounded-xl opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
            onClick={(e) => e.stopPropagation()}
            aria-label={bilingualAria(`Actions for ${conversation.recipientName}`, `Ενέργειες για ${conversation.recipientName}`)}
          >
            <MoreHorizontal className="icon-sm" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-xl">
          <DropdownMenuItem onClick={onPin} className="rounded-lg">
            <Pin className="icon-sm mr-2" />
            <BilingualText
              en={conversation.isPinned ? messagesEn('unpin') : messagesEn('pin')}
              el={conversation.isPinned ? messagesEl('unpin') : messagesEl('pin')}
              compact
            />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onArchive} className="rounded-lg">
            <Archive className="icon-sm mr-2" />
            <BilingualText en={messagesEn('archive')} el={messagesEl('archive')} compact />
          </DropdownMenuItem>
          {/*
            * "Delete chat" called the archive handler: the API has no way to
            * delete a conversation, so the reader who chose Delete got an
            * Archive under another name. It stays, unavailable, and says
            * what to use instead.
            */}
          <UnavailableMenuItem
            en={messagesEn('delete_chat')}
            el={messagesEl('delete_chat')}
            reasonEn="Conversations cannot be deleted yet. Archive hides this one from your inbox."
            reasonEl="Οι συνομιλίες δεν διαγράφονται ακόμη. Η αρχειοθέτηση την κρύβει από τα εισερχόμενα."
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onArchive,
  onPin,
}: ConversationListProps) {
  const t = useMessagesPrimaryText();
  const { primary } = useLanguagePreference();
  const [searchQuery, setSearchQuery] = useState('');
  const yesterday = t(messagesEn('yesterday'), messagesEl('yesterday'));

  const filteredConversations = conversations.filter((c) => {
    if (c.isArchived) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      c.recipientName.toLowerCase().includes(q) ||
      c.lastMessage.toLowerCase().includes(q) ||
      (c.recipientHeadline ?? '').toLowerCase().includes(q)
    );
  });

  const pinnedConversations = filteredConversations.filter((c) => c.isPinned);
  const regularConversations = filteredConversations.filter((c) => !c.isPinned);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-3 pb-2 pt-2">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 icon-sm -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t(messagesEn('search_conversations'), messagesEl('search_conversations'))}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 rounded-full border-transparent bg-background/80 pl-9 shadow-sm ring-1 ring-border/50"
              aria-label={bilingualAria(messagesEn('search_conversations'), messagesEl('search_conversations'))}
            />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {pinnedConversations.length > 0 && (
          <div className="mb-2">
            <p className="mb-1 px-2 pt-1 text-xs font-medium text-muted-foreground">
              <BilingualText en={messagesEn('pinned')} el={messagesEl('pinned')} compact />
            </p>
            {pinnedConversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isSelected={conv.id === selectedId}
                yesterdayLabel={yesterday}
                lang={primary}
                onSelect={() => onSelect(conv)}
                onArchive={() => onArchive?.(conv.id)}
                onPin={() => onPin?.(conv.id)}
              />
            ))}
          </div>
        )}

        {regularConversations.length > 0 && (
          <div>
            {pinnedConversations.length > 0 && (
              <p className="mb-1 px-2 pt-1 text-xs font-medium text-muted-foreground">
                <BilingualText en={messagesEn('all_messages')} el={messagesEl('all_messages')} compact />
              </p>
            )}
            {regularConversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isSelected={conv.id === selectedId}
                yesterdayLabel={yesterday}
                lang={primary}
                onSelect={() => onSelect(conv)}
                onArchive={() => onArchive?.(conv.id)}
                onPin={() => onPin?.(conv.id)}
              />
            ))}
          </div>
        )}

        {filteredConversations.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-14 text-center">
            <CfbGlyph name="messages" className="icon-lg text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">
              {searchQuery ? (
                <BilingualText en={messagesEn('no_conversations_found')} el={messagesEl('no_conversations_found')} />
              ) : (
                <BilingualText en={messagesEn('no_conversations')} el={messagesEl('no_conversations')} />
              )}
            </p>
            <p className="max-w-[16rem] text-xs text-muted-foreground">
              {searchQuery ? (
                <>
                  <BilingualText en={messagesEn('no_results_for')} el={messagesEl('no_results_for')} compact />
                  {` “${searchQuery}”`}
                </>
              ) : (
                <BilingualText en={messagesEn('connect_to_chat')} el={messagesEl('connect_to_chat')} />
              )}
            </p>
            {!searchQuery && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Link
                  href="/matches"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary-accessible transition-colors hover:bg-primary/20"
                >
                  <CfbGlyph name="matches" className="icon-sm" />
                  <BilingualText en={messagesEn('browse_matches')} el={messagesEl('browse_matches')} compact />
                </Link>
                <Link
                  href="/discover"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary-accessible transition-colors hover:bg-primary/20"
                >
                  <CfbGlyph name="people" className="icon-sm" />
                  <BilingualText en={messagesEn('find_people_message')} el={messagesEl('find_people_message')} compact />
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
