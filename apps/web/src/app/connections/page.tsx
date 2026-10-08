'use client';

import { choiceControl, ROW_GONE, rowOptions, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  UserCheck,
  Clock,
  Send,
  MessageCircle,
  Check,
  X,
  UserPlus,
  Compass,
  Handshake,
  Quote,
  TrendingUp,
} from 'lucide-react';
import {
  listConnectionRequests,
  respondToConnectionRequest,
  getOrCreateDirectConversation,
  type ConnectionRequestItem,
} from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { RailAction, RailStats } from '@/components/layout/RailParts';
import { useStoredUser } from '@/hooks/useStoredUser';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { RoleBadge } from '@/components/common/RoleBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { useToast } from '@/components/ui/toast';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, initialsOf } from '@/lib/utils';
import { STATUS } from '@/lib/semantic-colors';
import { AIInsightButton } from '@/components/ai/AIInsightButton';
import { BilingualText } from '@/components/common/BilingualText';
import { connectionsEn, connectionsEl } from '@/lib/i18n/strings-connections';
import { bilingualAria, bilingualInline } from '@/lib/i18n/format';
import { qk } from '@/lib/query-keys';
import { PeopleYouMayKnow } from '@/components/network/PeopleYouMayKnow';

const CollaborationStarter = dynamic(
  () => import('@/components/collaboration/CollaborationStarter').then((m) => ({ default: m.CollaborationStarter })),
  { ssr: false },
);
const PostAcceptCollaborationModal = dynamic(
  () => import('@/components/collaboration/CollaborationStarter').then((m) => ({ default: m.PostAcceptCollaborationModal })),
  { ssr: false },
);

function ConnectionCard({
  connection,
  viewerId,
  onAccept,
  onDecline,
  onMessage,
  isPending,
}: {
  connection: ConnectionRequestItem;
  viewerId: string | null;
  onAccept?: () => void;
  onDecline?: () => void;
  onMessage?: () => void;
  isPending?: boolean;
}) {
  const isReceiver = connection.receiverId === viewerId;
  const other = isReceiver ? connection.requester : connection.receiver;
  const isAccepted = connection.status === 'accepted';

  return (
    <Card className="card-interactive">
      <CardContent className="flex items-center gap-4">
        <Link href={`/profiles/${other.id}`}>
          <Avatar className="h-10 w-10 shrink-0 ring-2 ring-primary/20">
            <AvatarImage src={other.avatarUrl ?? undefined} />
            <AvatarFallback className="bg-primary/20 text-primary-accessible font-semibold">
              {initialsOf(other.displayName)}
            </AvatarFallback>
          </Avatar>
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/profiles/${other.id}`} className="person-name inline-flex tap-target-y items-center font-semibold text-foreground transition-colors hover:text-primary-accessible">
              {other.displayName}
            </Link>
            <RoleBadge role={other.role} size="sm" />
          </div>
          {other.headline && (
            <p className="text-sm text-muted-foreground truncate">{other.headline}</p>
          )}
          {connection.message && !isAccepted && (
            <p className="mt-1 text-xs text-muted-foreground italic line-clamp-2">
              &ldquo;{connection.message}&rdquo;
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isAccepted ? (
            <>
              <AIInsightButton
                prompt={`Analyze collaboration potential with ${other.displayName}, a ${other.role}${other.headline ? ` — ${other.headline}` : ''}. What working dynamic would we likely have?`}
                agentId="matching"
                cacheKey={`conn-match-${connection.id}`}
                variant="icon"
                label={bilingualAria(connectionsEn('ai_collaboration'), connectionsEl('ai_collaboration'))}
              />
              <Button variant="secondary" size="sm" className="gap-2" onClick={onMessage}>
                <MessageCircle className="icon-sm" />
                <BilingualText en={connectionsEn('message')} el={connectionsEl('message')} compact />
              </Button>
            </>
          ) : isReceiver && connection.status === 'pending' ? (
            <>
              <Button
                size="sm"
                className="gap-1"
                onClick={onAccept}
                disabled={isPending}
              >
                <Check className="icon-sm" />
                <BilingualText en={connectionsEn('accept')} el={connectionsEl('accept')} compact />
              </Button>
              <Button aria-label={bilingualAria(connectionsEn('decline'), connectionsEl('decline'))}
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground hover:text-destructive-accessible"
                onClick={onDecline}
                disabled={isPending}
              >
                <X className="icon-sm" aria-hidden="true" />
              </Button>
            </>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              <Clock className="mr-1 icon-sm" />
              <BilingualText en={connectionsEn('pending')} el={connectionsEl('pending')} compact />
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function IntroRequestCard({
  connection,
  onAccept,
  onDecline,
  isPending,
}: {
  connection: ConnectionRequestItem;
  onAccept: () => void;
  onDecline: () => void;
  isPending?: boolean;
}) {
  const sender = connection.requester;
  return (
    <Card className="card-interactive border-primary/20 bg-primary/5">
      <CardContent>
        <div className="flex items-start gap-4">
          <Link href={`/profiles/${sender.id}`}>
            <Avatar className="h-10 w-10 shrink-0 ring-2 ring-primary/30">
              <AvatarImage src={sender.avatarUrl ?? undefined} />
              <AvatarFallback className="bg-primary/20 text-primary-accessible font-semibold">
                {initialsOf(sender.displayName)}
              </AvatarFallback>
            </Avatar>
          </Link>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/profiles/${sender.id}`} className="person-name inline-flex tap-target-y items-center font-semibold text-foreground transition-colors hover:text-primary-accessible">
                {sender.displayName}
              </Link>
              <RoleBadge role={sender.role} size="sm" />
              <Badge variant="outline" size="sm" className="ml-auto border-primary/40 text-primary-accessible gap-1">
                <Handshake className="icon-sm" />
                <BilingualText en={connectionsEn('intro_request')} el={connectionsEl('intro_request')} compact />
              </Badge>
            </div>

            {sender.headline && (
              <p className="text-sm text-muted-foreground">{sender.headline}</p>
            )}

            {connection.message && (
              <div className="flex gap-2 rounded-xl bg-secondary/50 px-3 py-2.5">
                <Quote className="icon-sm shrink-0 mt-0.5 text-primary/60" />
                <p className="text-sm text-foreground/80 italic">{connection.message}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button size="sm" className="gap-1.5" onClick={onAccept} disabled={isPending}>
                <Check className="icon-sm" />
                <BilingualText en={connectionsEn('accept_intro')} el={connectionsEl('accept_intro')} compact />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-muted-foreground hover:text-destructive-accessible"
                onClick={onDecline}
                disabled={isPending}
              >
                <X className="icon-sm" />
                <BilingualText en={connectionsEn('decline')} el={connectionsEl('decline')} compact />
              </Button>
              <p className="ml-auto shrink-0 text-xs text-muted-foreground">
                {new Date(connection.createdAt).toLocaleDateString('en-GB', { timeZone: 'UTC' })}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ConnectionSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-8 w-20" />
      </CardContent>
    </Card>
  );
}

export default function ConnectionsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  const [tab, setTab] = useState<'intros' | 'received' | 'sent' | 'accepted'>('intros');
  // Offered to the assistant: the tab, through the same setter. Accepting and
  // declining are offered below, once the rows are known.
  usePageControls([
    choiceControl('tab', 'Connections tab', 'Καρτέλα συνδέσεων', [
      { value: 'intros', en: 'Intros', el: 'Γνωριμίες' },
      { value: 'received', en: 'Received requests', el: 'Ληφθέντα αιτήματα' },
      { value: 'sent', en: 'Sent requests', el: 'Σταλμένα αιτήματα' },
      { value: 'accepted', en: 'Connected', el: 'Συνδεδεμένοι' },
    ], tab, (v) => setTab(v as typeof tab)),
  ]);
  const [justAcceptedUser, setJustAcceptedUser] = useState<{
    id: string; displayName: string; avatarUrl?: string | null; role?: string; headline?: string | null;
  } | null>(null);

  // Read after mount, so the server and the first client render agree.
  const viewerId = useStoredUser()?.id ?? null;

  // Intros and Received are the same read (requests waiting on the reader),
  // so they share one cache entry.
  const listType = tab === 'intros' ? 'received' : tab;
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: qk('connections', listType),
    queryFn: () => listConnectionRequests({ type: listType }),
    staleTime: 30_000,
  });

  /*
   * The network figures were counted from whichever tab was open: on Intros
   * (requests received) "Sent, pending" was always 0 and "Connected" counted
   * only accepted requests the reader had received. Each figure now comes
   * from its own read - the same three the tabs use, so they share a cache.
   */
  const [receivedQ, sentQ, acceptedQ] = useQueries({
    queries: (['received', 'sent', 'accepted'] as const).map((type) => ({
      queryKey: qk('connections', type),
      queryFn: () => listConnectionRequests({ type }),
      staleTime: 30_000,
    })),
  });
  const countOf = (q: typeof receivedQ) => {
    const list = q.data?.connections;
    return q.data ? (Array.isArray(list) ? list.length : 0) : null;
  };
  const receivedCount = countOf(receivedQ);
  const sentCount = countOf(sentQ);
  const acceptedCount = countOf(acceptedQ);
  // Everyone already connected, or with a request either way, stays out of
  // "People you may know".
  const knownIds = useMemo(() => {
    const ids = new Set<string>();
    for (const q of [receivedQ, sentQ, acceptedQ]) {
      for (const c of q.data?.connections ?? []) {
        if (c?.requesterId) ids.add(c.requesterId);
        if (c?.receiverId) ids.add(c.receiverId);
      }
    }
    return ids;
  }, [receivedQ.data, sentQ.data, acceptedQ.data]);

  const respondMutation = useMutation({
    mutationFn: ({ id, status, otherUserId }: { id: string; status: 'accepted' | 'declined'; otherUserId?: string; acceptedUserInfo?: { id: string; displayName: string; avatarUrl?: string | null; role?: string; headline?: string | null } }) =>
      respondToConnectionRequest(id, status).then(() => otherUserId),
    onSuccess: (otherUserId, { status, acceptedUserInfo }) => {
      queryClient.invalidateQueries({ queryKey: qk('connections') });
      if (status === 'accepted' && otherUserId && acceptedUserInfo) {
        setJustAcceptedUser(acceptedUserInfo);
      } else if (status !== 'accepted') {
        success(bilingualInline('Request declined', 'Το αίτημα απορρίφθηκε'), bilingualInline('The request has been removed.', 'Το αίτημα αφαιρέθηκε.'));
      }
    },
    onError: (err) => {
      showError(bilingualInline('Could not respond', 'Δεν ήταν δυνατή η απάντηση'), err instanceof Error ? err.message : bilingualInline('Please try again', 'Δοκιμάστε ξανά'));
    },
  });

  const handleMessage = async (userId: string) => {
    try {
      const { conversationId } = await getOrCreateDirectConversation(userId);
      router.push(`/messages?c=${conversationId}`);
    } catch {
      router.push(`/messages?to=${userId}`);
    }
  };

  const allConnections = data?.connections ?? [];
  const connections =
    tab === 'intros'
      ? allConnections.filter((c) => c.receiverId === viewerId && c.status === 'pending')
      : allConnections;

  const introCount = receivedCount ?? 0;

  // What the tab shows, and the row buttons as commands: Accept and Decline
  // on a request someone sent the reader - the same mutation the buttons run.
  const otherOf = (c: (typeof connections)[number]) => (c.requesterId === viewerId ? c.receiver : c.requester);
  const incoming = connections.filter((c) => c.receiverId === viewerId && c.status === 'pending');
  // Kept pending until the answer is stored, so the assistant's card turns
  // green only once the request has actually been accepted or declined.
  const respond = async (id: string | undefined, status: 'accepted' | 'declined'): Promise<PageControlRunResult> => {
    const c = incoming.find((row) => row.id === id);
    if (!c) return ROW_GONE;
    const other = otherOf(c);
    await respondMutation.mutateAsync({
      id: c.id,
      status,
      otherUserId: c.requesterId,
      acceptedUserInfo: { id: c.requesterId, displayName: other?.displayName ?? '', avatarUrl: other?.avatarUrl ?? null, role: other?.role, headline: other?.headline ?? null },
    });
  };
  usePageList([
    {
      id: 'connections',
      labelEn: 'Connections',
      labelEl: 'Συνδέσεις',
      rows: isLoading ? undefined : connections.map((c) => {
        const other = otherOf(c);
        return `${other?.displayName ?? 'Someone'}${other?.role ? ` · ${other.role}` : ''}${other?.headline ? ` · ${other.headline}` : ''} · ${c.status}`;
      }),
    },
  ]);
  usePageControls([
    {
      id: 'accept_request',
      labelEn: 'Accept connection request',
      labelEl: 'Αποδοχή αιτήματος σύνδεσης',
      writes: true,
      options: rowOptions(incoming, (c) => c.id, (c) => otherOf(c)?.displayName ?? 'Request'),
      unavailableEn: incoming.length ? undefined : 'No request is waiting on this tab.',
      unavailableEl: incoming.length ? undefined : 'Κανένα αίτημα δεν περιμένει σε αυτή την καρτέλα.',
      run: (v) => respond(v, 'accepted'),
    },
    {
      id: 'decline_request',
      labelEn: 'Decline connection request',
      labelEl: 'Απόρριψη αιτήματος σύνδεσης',
      writes: true,
      options: rowOptions(incoming, (c) => c.id, (c) => otherOf(c)?.displayName ?? 'Request'),
      unavailableEn: incoming.length ? undefined : 'No request is waiting on this tab.',
      unavailableEl: incoming.length ? undefined : 'Κανένα αίτημα δεν περιμένει σε αυτή την καρτέλα.',
      run: (v) => respond(v, 'declined'),
    },
  ]);

  // Unknown until its own read answers: a dash, never a 0 that means "loading".
  const figure = (n: number | null) => (n == null ? '—' : n);
  const networkStats = [
    { labelEn: connectionsEn('stat_connected'), labelEl: connectionsEl('stat_connected'), value: figure(acceptedCount), icon: Users, tone: 'accent' as const },
    { labelEn: connectionsEn('stat_intro_requests'), labelEl: connectionsEl('stat_intro_requests'), value: figure(receivedCount), icon: Handshake, tone: 'warning' as const },
    { labelEn: connectionsEn('stat_sent_pending'), labelEl: connectionsEl('stat_sent_pending'), value: figure(sentCount), icon: Send, tone: 'info' as const },
    {
      labelEn: connectionsEn('stat_total_interactions'),
      labelEl: connectionsEl('stat_total_interactions'),
      value: receivedCount == null || sentCount == null || acceptedCount == null ? '—' : receivedCount + sentCount + acceptedCount,
      icon: TrendingUp,
      tone: 'success' as const,
    },
  ];

  const rail: PageRailSection[] = [
    {
      id: 'summary',
      glyph: 'people',
      labelEn: 'Network',
      labelEl: 'Δίκτυο',
      content: (
        <RailStats
          items={networkStats.map((s) => ({
            key: s.labelEn,
            label: s.labelEn,
            labelEl: s.labelEl,
            value: s.value,
            icon: s.icon,
            tone: `${STATUS[s.tone].bg} ${STATUS[s.tone].icon}`,
          }))}
        />
      ),
    },
    {
      id: 'go',
      glyph: 'discover',
      labelEn: 'Where to go next',
      labelEl: 'Πού να πάτε μετά',
      content: (
        <div className="space-y-1">
          <RailAction icon={UserPlus} en={connectionsEn('find_people')} el={connectionsEl('find_people')} onClick={() => router.push('/discover')} />
          <RailAction icon={Compass} en="Open matches" el="Άνοιγμα αντιστοιχίσεων" onClick={() => router.push('/matches')} />
          <RailAction icon={MessageCircle} en="Open messages" el="Άνοιγμα μηνυμάτων" onClick={() => router.push('/messages')} />
        </div>
      ),
    },
  ];

  return (
    <>
    {justAcceptedUser && (
      <PostAcceptCollaborationModal
        otherUser={justAcceptedUser}
        onDismiss={() => setJustAcceptedUser(null)}
      />
    )}
    <AppShell
      showHelp
      rail={rail}
    >
      <div className="space-y-6 pb-10">
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="intros" className="gap-2">
            <Handshake className="icon-sm" />
            <BilingualText en={connectionsEn('intro_requests')} el={connectionsEl('intro_requests')} compact />
            {introCount > 0 && (
              <Badge variant="destructive" size="sm" className="ml-1 px-1.5">
                {introCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="received" className="gap-2">
            <UserCheck className="icon-sm" />
            <BilingualText en={connectionsEn('received')} el={connectionsEl('received')} compact />
          </TabsTrigger>
          <TabsTrigger value="sent" className="gap-2">
            <Send className="icon-sm" />
            <BilingualText en={connectionsEn('sent')} el={connectionsEl('sent')} compact />
          </TabsTrigger>
          <TabsTrigger value="accepted" className="gap-2">
            <Users className="icon-sm" />
            <BilingualText en={connectionsEn('connected')} el={connectionsEl('connected')} compact />
          </TabsTrigger>
        </TabsList>

        {/* Intro Requests tab */}
        <TabsContent value="intros" className="mt-6 space-y-3">
          {isError ? (
            <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-sm text-muted-foreground"><BilingualText en="Requests could not be loaded." el="Δεν ήταν δυνατή η φόρτωση των αιτημάτων." wrap /></p>
              <Button variant="secondary" size="sm" onClick={() => refetch()}><BilingualText en="Try again" el="Δοκιμάστε ξανά" compact /></Button>
            </CardContent></Card>
          ) : isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <ConnectionSkeleton key={i} />)
          ) : connections.length === 0 ? (
            <EmptyState
              illustration="default"
              title={<BilingualText en={connectionsEn('no_intro_requests')} el={connectionsEl('no_intro_requests')} />}
              description={<BilingualText en={connectionsEn('no_intro_desc')} el={connectionsEl('no_intro_desc')} />}
              askAiPrompt="I have no intro requests. Help me find people to connect with and draft a first intro."
              action={
                <Button variant="secondary" className="gap-2" asChild>
                  <Link href="/discover">
                    <Compass className="icon-sm" />
                    <BilingualText en={connectionsEn('discover_people')} el={connectionsEl('discover_people')} />
                  </Link>
                </Button>
              }
            />
          ) : (
            connections.map((c) => (
              <IntroRequestCard
                key={c.id}
                connection={c}
                isPending={respondMutation.isPending}
                onAccept={() => respondMutation.mutate({ id: c.id, status: 'accepted', otherUserId: c.requesterId, acceptedUserInfo: { id: c.requester.id, displayName: c.requester.displayName, avatarUrl: c.requester.avatarUrl, role: c.requester.role, headline: c.requester?.headline ?? null } })}
                onDecline={() => respondMutation.mutate({ id: c.id, status: 'declined' })}
              />
            ))
          )}
        </TabsContent>

        {/* Standard tabs */}
        {(['received', 'sent', 'accepted'] as const).map((t) => (
          <TabsContent key={t} value={t} className="mt-6 space-y-3">
            {isError && tab === t ? (
              <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <p className="text-sm text-muted-foreground"><BilingualText en="Connections could not be loaded." el="Δεν ήταν δυνατή η φόρτωση των συνδέσεων." wrap /></p>
                <Button variant="secondary" size="sm" onClick={() => refetch()}><BilingualText en="Try again" el="Δοκιμάστε ξανά" compact /></Button>
              </CardContent></Card>
            ) : isLoading && tab === t ? (
              Array.from({ length: 3 }).map((_, i) => <ConnectionSkeleton key={i} />)
            ) : connections.length === 0 ? (
              <EmptyState
                illustration={t === 'accepted' ? 'connection' : 'default'}
                title={
                  <BilingualText
                    en={
                      t === 'received' ? connectionsEn('no_pending_requests')
                        : t === 'sent' ? connectionsEn('no_sent_requests')
                        : connectionsEn('no_connections_yet')
                    }
                    el={
                      t === 'received' ? connectionsEl('no_pending_requests')
                        : t === 'sent' ? connectionsEl('no_sent_requests')
                        : connectionsEl('no_connections_yet')
                    }
                  />
                }
                description={
                  <BilingualText
                    en={
                      t === 'accepted' ? connectionsEn('start_connecting')
                        : t === 'sent' ? connectionsEn('browse_profiles')
                        : connectionsEn('when_people_send')
                    }
                    el={
                      t === 'accepted' ? connectionsEl('start_connecting')
                        : t === 'sent' ? connectionsEl('browse_profiles')
                        : connectionsEl('when_people_send')
                    }
                  />
                }
                askAiPrompt="My connections list is empty. Who should I reach out to first from my matches?"
                action={
                  t !== 'received' ? (
                    <Button variant="secondary" className="gap-2" asChild>
                      <Link href="/discover">
                        <Compass className="icon-sm" />
                        <BilingualText en={connectionsEn('discover_people')} el={connectionsEl('discover_people')} />
                      </Link>
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              connections.map((c) => {
                const otherUser = c.requesterId === viewerId
                  ? { id: c.receiverId, displayName: c.receiver?.displayName ?? '', avatarUrl: c.receiver?.avatarUrl ?? null, role: c.receiver?.role, headline: c.receiver?.headline ?? null }
                  : { id: c.requesterId, displayName: c.requester?.displayName ?? '', avatarUrl: c.requester?.avatarUrl ?? null, role: c.requester?.role, headline: c.requester?.headline ?? null };
                return (
                  <div key={c.id} className="rounded-xl overflow-hidden border border-border shadow-sm">
                    <ConnectionCard
                      connection={c}
                      viewerId={viewerId}
                      isPending={respondMutation.isPending}
                      onAccept={() => {
                        const uid = c.requesterId === viewerId ? c.receiverId : c.requesterId;
                        respondMutation.mutate({ id: c.id, status: 'accepted', otherUserId: uid, acceptedUserInfo: otherUser });
                      }}
                      onDecline={() => respondMutation.mutate({ id: c.id, status: 'declined' })}
                      onMessage={() => handleMessage(otherUser.id)}
                    />
                    {t === 'accepted' && c.status === 'accepted' && (
                      <CollaborationStarter otherUser={otherUser} mode="inline" />
                    )}
                  </div>
                );
              })
            )}
          </TabsContent>
        ))}
      </Tabs>
      <PeopleYouMayKnow excludeIds={knownIds} />
      </div>
    </AppShell>
    </>
  );
}
