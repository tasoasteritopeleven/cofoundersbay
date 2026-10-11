'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RoleBadge } from '@/components/common/RoleBadge';
import { BilingualText } from '@/components/common/BilingualText';
import { CfbGlyph } from '@/components/icons/CfbGlyph';
import { ThreadAvatar } from '@/components/messaging/ThreadAvatar';
import { bilingualAria } from '@/lib/i18n/format';
import { messagesEn, messagesEl, useMessagesPrimaryText } from '@/lib/i18n/strings-messages';
import type { Conversation } from '@/components/messaging/ConversationList';
import type { ConnectionRequestItem } from '@/lib/api';

export type ComposeCandidate = {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  role: string;
  headline?: string | null;
};

export function candidatesFromInbox(
  conversations: Conversation[],
  connections: ConnectionRequestItem[],
  viewerId: string,
): ComposeCandidate[] {
  const byId = new Map<string, ComposeCandidate>();
  for (const conv of conversations) {
    if (conv.isArchived) continue;
    byId.set(conv.recipientId, {
      userId: conv.recipientId,
      name: conv.recipientName,
      avatarUrl: conv.recipientAvatar,
      role: conv.recipientRole,
      headline: conv.recipientHeadline,
    });
  }
  for (const conn of connections) {
    if (conn.status !== 'accepted') continue;
    const other = conn.requesterId === viewerId ? conn.receiver : conn.requester;
    if (!other?.id || byId.has(other.id)) continue;
    byId.set(other.id, {
      userId: other.id,
      name: other.displayName,
      avatarUrl: other.avatarUrl,
      role: other.role || 'founder',
      headline: other.headline,
    });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function ComposeMessageDialog({
  open,
  onOpenChange,
  candidates,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: ComposeCandidate[];
  onPick: (userId: string) => void;
}) {
  const t = useMessagesPrimaryText();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.headline ?? '').toLowerCase().includes(q),
    );
  }, [candidates, query]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery('');
        onOpenChange(next);
      }}
    >
      <DialogContent className="rounded-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            <BilingualText en={messagesEn('new_message')} el={messagesEl('new_message')} />
          </DialogTitle>
          <DialogDescription>
            <BilingualText en={messagesEn('new_message_hint')} el={messagesEl('new_message_hint')} />
          </DialogDescription>
        </DialogHeader>
        <div className="relative mt-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 icon-sm -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(messagesEn('compose_search'), messagesEl('compose_search'))}
            className="h-10 rounded-xl pl-9"
            aria-label={bilingualAria(messagesEn('compose_search'), messagesEl('compose_search'))}
          />
        </div>
        <div className="mt-3 max-h-[min(50vh,20rem)] space-y-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
              <CfbGlyph name="people" className="icon-lg text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {candidates.length === 0 ? (
                  <BilingualText en={messagesEn('compose_none')} el={messagesEl('compose_none')} />
                ) : (
                  <BilingualText en={messagesEn('compose_empty')} el={messagesEl('compose_empty')} />
                )}
              </p>
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline" className="rounded-xl">
                  <Link href="/discover">
                    <CfbGlyph name="discover" className="icon-sm mr-1.5" />
                    <BilingualText en={messagesEn('find_people')} el={messagesEl('find_people')} compact />
                  </Link>
                </Button>
                <Button asChild size="sm" variant="ghost" className="rounded-xl">
                  <Link href="/connections">
                    <BilingualText en={messagesEn('view_connections')} el={messagesEl('view_connections')} compact />
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            filtered.map((person) => (
              <button
                key={person.userId}
                type="button"
                onClick={() => {
                  onPick(person.userId);
                  setQuery('');
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-secondary/70"
              >
                <ThreadAvatar name={person.name} src={person.avatarUrl} seed={person.userId} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{person.name}</span>
                    <RoleBadge role={person.role || 'founder'} size="sm" showIcon={false} className="shrink-0 py-0 text-2xs" />
                  </div>
                  {person.headline && (
                    <p className="truncate text-xs text-muted-foreground">{person.headline}</p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
