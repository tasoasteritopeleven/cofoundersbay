'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Plus } from 'lucide-react';
import {
  COMMITMENT_KINDS,
  COMMITMENT_OUTCOMES,
  daysUntilHistory,
  isInHistory,
  type CommitmentKind,
  type CommitmentOutcome,
} from '@cofounderbay/shared';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { RailOptions } from '@/components/layout/RailParts';
import { usePageRail } from '@/components/layout/PageRailContext';
import { BilingualText } from '@/components/common/BilingualText';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';
import { NeedCard } from '@/components/commitments/NeedCard';
import { CommitmentLadder } from '@/components/commitments/CommitmentLadder';
import { OutcomeChip, StepChip } from '@/components/commitments/OutcomeChip';
import {
  closeCommitmentCard,
  listCommitmentCards,
  listCommitmentThreads,
  reopenCommitmentCard,
  revokeCommitmentShare,
  shareCommitmentCard,
  type CommitmentCard,
  type CommitmentThreadSummary,
} from '@/lib/commitments-api';
import { CMT, kindCopy } from '@/lib/i18n/strings-commitments';
import { bilingualAria } from '@/lib/i18n/format';
import { qk } from '@/lib/query-keys';
import { choiceControl, rowOptions, settle, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { publicCardUrl } from '@/lib/commitments-links';
import { nextAction } from '@/lib/commitments-next';

type Tab = 'mine' | 'responses' | 'history';
type OutcomeFilter = 'all' | CommitmentOutcome;
type KindFilter = 'all' | CommitmentKind;

const OUTCOME_COPY: Record<CommitmentOutcome, { en: string; el: string }> = {
  open: { en: 'Open', el: 'Ανοιχτές' },
  in_discussion: { en: 'In discussion', el: 'Σε συζήτηση' },
  agreed: { en: 'Agreed', el: 'Συμφωνημένες' },
  closed: { en: 'Closed', el: 'Κλειστές' },
};

/** When a response settled: agreed or closed, else never. */
function settledAt(thread: CommitmentThreadSummary): string | null {
  if (thread.step === 'agreed') return thread.agreedAt;
  if (thread.step === 'closed') return thread.closedAt;
  return null;
}

function threadHref(thread: CommitmentThreadSummary) {
  return `/commitments/${encodeURIComponent(thread.cardId)}?thread=${encodeURIComponent(thread.id)}`;
}

function HistoryNote({ settled, now }: { settled: string | null; now: number }) {
  const left = daysUntilHistory(settled, now);
  if (left === null || left <= 0) return null;
  return (
    <p className="text-2xs text-muted-foreground tabular-nums">
      <BilingualText en={`${CMT.to_history_in.en} ${left} ${CMT.days.en}`} el={`${CMT.to_history_in.el} ${left} ${CMT.days.el}`} compact />
    </p>
  );
}

function ResponseRow({ thread, now }: { thread: CommitmentThreadSummary; now: number }) {
  const next = nextAction(thread);
  const kind = kindCopy(thread.cardKind);
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="text-xs text-muted-foreground">
            <BilingualText en={kind.en} el={kind.el} compact />
          </span>
          <StepChip step={thread.step} />
          {thread.answeredVersion < thread.cardVersion ? (
            <span className="rounded-full bg-status-info-bg px-2 py-0.5 text-2xs text-status-info">
              v{thread.answeredVersion} → v{thread.cardVersion}
            </span>
          ) : null}
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground">
            <Link href={threadHref(thread)} className="hover:underline">{thread.cardTitle}</Link>
          </h3>
          <p className="truncate text-xs text-muted-foreground">
            <BilingualText en={CMT.by.en} el={CMT.by.el} compact /> {thread.counterpart.displayName}
            {thread.counterpart.headline ? ` · ${thread.counterpart.headline}` : ''}
          </p>
        </div>
        {thread.step !== 'closed' ? <CommitmentLadder step={thread.step} myConfirmed={thread.myConfirmed} /> : null}
        {next ? (
          <p className="text-sm font-medium text-foreground"><BilingualText en={next.en} el={next.el} wrap /></p>
        ) : thread.step !== 'closed' && thread.step !== 'agreed' ? (
          <p className="text-sm text-muted-foreground">
            <BilingualText en={`${CMT.waiting_on.en} ${thread.counterpart.displayName}`} el={`${CMT.waiting_on.el} ${thread.counterpart.displayName}`} wrap />
          </p>
        ) : null}
        {thread.closedReason ? <p className="text-sm italic text-muted-foreground">“{thread.closedReason}”</p> : null}
        <HistoryNote settled={settledAt(thread)} now={now} />
        <Button size="sm" variant="outline" asChild>
          <Link href={threadHref(thread)}><BilingualText en={CMT.open_board.en} el={CMT.open_board.el} compact /></Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function CommitmentsPage() {
  const qc = useQueryClient();
  const { success } = useToast();
  const { openRailSection } = usePageRail();
  const [tab, setTab] = useState<Tab>('mine');
  const [outcome, setOutcome] = useState<OutcomeFilter>('all');
  const [kind, setKind] = useState<KindFilter>('all');
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  const cardsQ = useQuery({ queryKey: qk('commitments', 'cards', 'mine'), queryFn: () => listCommitmentCards({ mine: true }) });
  const threadsQ = useQuery({ queryKey: qk('commitments', 'threads', 'all'), queryFn: () => listCommitmentThreads('all') });
  const cards = useMemo(() => (cardsQ.data ?? []).filter((c) => c.isMine), [cardsQ.data]);
  const threads = useMemo(() => threadsQ.data ?? [], [threadsQ.data]);
  const at = now ?? 0;

  const passes = (c: { outcome: CommitmentOutcome; kind: CommitmentKind }) => (outcome === 'all' || c.outcome === outcome) && (kind === 'all' || c.kind === kind);
  const liveCards = cards.filter((c) => !isInHistory(c.settledAt, at));
  const historyCards = cards.filter((c) => isInHistory(c.settledAt, at));
  const responses = threads.filter((t) => t.role === 'candidate');
  const liveResponses = responses.filter((t) => !isInHistory(settledAt(t), at));
  const historyResponses = responses.filter((t) => isInHistory(settledAt(t), at));
  const shownCards = liveCards.filter(passes);
  const shownResponses = liveResponses.filter((t) => passes({ outcome: t.cardOutcome, kind: t.cardKind }));
  const needsYou = threads.filter((t) => nextAction(t) !== null);
  const interestsFor = (cardId: string) => threads.filter((t) => t.cardId === cardId && t.role === 'owner' && t.step !== 'closed').length;
  const filtered = outcome !== 'all' || kind !== 'all';

  const refresh = () => qc.invalidateQueries({ queryKey: qk('commitments') });
  const write = useMutation({ mutationFn: (fn: () => Promise<unknown>) => fn(), onSettled: refresh });
  const run = (fn: () => Promise<unknown>) => settle(() => write.mutateAsync(fn));

  async function copyLink(card: CommitmentCard): Promise<PageControlRunResult> {
    let token = card.shareToken;
    const result = await run(async () => {
      if (!token) token = (await shareCommitmentCard(card.id)).token;
    });
    if (result) return result;
    if (token) {
      void navigator.clipboard?.writeText(publicCardUrl(token)).catch(() => undefined);
      success('Public link copied', 'No email or phone on the card. It leads to sign-up and then to the card.');
    }
  }

  const closeCard = async (card: CommitmentCard, reason: 'filled' | 'withdrawn') => {
    const result = await run(() => closeCommitmentCard(card.id, reason));
    if (!result) success('Card closed', 'Reopen it any time; nobody was notified.');
    return result;
  };
  const reopen = async (card: CommitmentCard) => {
    const result = await run(() => reopenCommitmentCard(card.id));
    if (!result) success('Card reopened');
    return result;
  };
  const revoke = async (card: CommitmentCard) => {
    const result = await run(() => revokeCommitmentShare(card.id));
    if (!result) success('Public link turned off');
    return result;
  };

  const byId = (id?: string) => cards.find((c) => c.id === id);
  const openCards = liveCards.filter((c) => c.outcome !== 'closed');
  const closedCards = cards.filter((c) => c.outcome === 'closed' && c.closedReason !== 'expired');
  const sharedCards = cards.filter((c) => c.shared);

  usePageControls([
    choiceControl(
      'commitments_tab',
      'Show needs, responses or history',
      'Εμφάνιση αναγκών, απαντήσεων ή ιστορικού',
      [
        { value: 'mine', en: CMT.tab_mine.en, el: CMT.tab_mine.el },
        { value: 'responses', en: CMT.tab_responses.en, el: CMT.tab_responses.el },
        { value: 'history', en: CMT.tab_history.en, el: CMT.tab_history.el },
      ],
      tab,
      (v) => setTab(v as Tab),
    ),
    choiceControl(
      'outcome_filter',
      'Filter by outcome',
      'Φιλτράρισμα ανά έκβαση',
      [{ value: 'all', en: CMT.all.en, el: CMT.all.el }, ...COMMITMENT_OUTCOMES.map((o) => ({ value: o, en: OUTCOME_COPY[o].en, el: OUTCOME_COPY[o].el }))],
      outcome,
      (v) => setOutcome(v as OutcomeFilter),
    ),
    choiceControl(
      'kind_filter',
      'Filter by kind of commitment',
      'Φιλτράρισμα ανά είδος δέσμευσης',
      [{ value: 'all', en: CMT.all.en, el: CMT.all.el }, ...COMMITMENT_KINDS.map((k) => ({ value: k, en: kindCopy(k).en, el: kindCopy(k).el }))],
      kind,
      (v) => setKind(v as KindFilter),
    ),
    {
      id: 'close_card_filled',
      labelEn: 'Close a need card as filled',
      labelEl: 'Κλείσιμο κάρτας ανάγκης ως καλυμμένης',
      writes: true,
      options: rowOptions(openCards, (c) => c.id, (c) => c.title),
      unavailableEn: openCards.length ? undefined : 'You have no open need card.',
      unavailableEl: openCards.length ? undefined : 'Δεν έχετε ανοιχτή κάρτα ανάγκης.',
      // Closing leaves every response as it was and tells nobody, so reopening
      // recomputes the same outcome: the API's reopen restores what close set.
      undo: (v) => (byId(v) ? { control: 'reopen_card', value: v } : undefined),
      run: (v) => {
        const card = byId(v);
        return card ? closeCard(card, 'filled') : { error: 'Choose one of your open cards.' };
      },
    },
    {
      id: 'withdraw_card',
      labelEn: 'Withdraw a need card',
      labelEl: 'Απόσυρση κάρτας ανάγκης',
      writes: true,
      options: rowOptions(openCards, (c) => c.id, (c) => c.title),
      unavailableEn: openCards.length ? undefined : 'You have no open need card.',
      unavailableEl: openCards.length ? undefined : 'Δεν έχετε ανοιχτή κάρτα ανάγκης.',
      undo: (v) => (byId(v) ? { control: 'reopen_card', value: v } : undefined),
      run: (v) => {
        const card = byId(v);
        return card ? closeCard(card, 'withdrawn') : { error: 'Choose one of your open cards.' };
      },
    },
    {
      id: 'reopen_card',
      labelEn: 'Reopen a closed need card',
      labelEl: 'Επανενεργοποίηση κλειστής κάρτας ανάγκης',
      writes: true,
      options: rowOptions(closedCards, (c) => c.id, (c) => c.title),
      unavailableEn: closedCards.length ? undefined : 'You have no closed card to reopen.',
      unavailableEl: closedCards.length ? undefined : 'Δεν έχετε κλειστή κάρτα για επανενεργοποίηση.',
      run: (v) => {
        const card = byId(v);
        return card ? reopen(card) : { error: 'Choose one of your closed cards.' };
      },
    },
    {
      id: 'copy_public_link',
      labelEn: 'Copy the public link of a need card',
      labelEl: 'Αντιγραφή του δημόσιου συνδέσμου κάρτας ανάγκης',
      writes: true,
      options: rowOptions(liveCards, (c) => c.id, (c) => c.title),
      unavailableEn: liveCards.length ? undefined : 'You have no need card to share.',
      unavailableEl: liveCards.length ? undefined : 'Δεν έχετε κάρτα ανάγκης για κοινοποίηση.',
      // Copying an existing link writes nothing; making the first one is
      // taken back by turning it off, which leaves the card as it was.
      undo: (v) => (byId(v) && !byId(v)?.shared ? { control: 'revoke_public_link', value: v } : undefined),
      run: (v) => {
        const card = byId(v);
        return card ? copyLink(card) : { error: 'Choose one of your cards.' };
      },
    },
    {
      id: 'revoke_public_link',
      labelEn: 'Turn off a need card’s public link',
      labelEl: 'Απενεργοποίηση δημόσιου συνδέσμου κάρτας ανάγκης',
      writes: true,
      options: rowOptions(sharedCards, (c) => c.id, (c) => c.title),
      unavailableEn: sharedCards.length ? undefined : 'None of your cards has a public link.',
      unavailableEl: sharedCards.length ? undefined : 'Καμία κάρτα σας δεν έχει δημόσιο σύνδεσμο.',
      run: (v) => {
        const card = byId(v);
        return card ? revoke(card) : { error: 'Choose a card with a public link.' };
      },
    },
  ]);
  usePageList([
    {
      id: 'my_need_cards',
      labelEn: 'My need cards',
      labelEl: 'Οι κάρτες ανάγκης μου',
      rows: tab === 'mine' ? shownCards.map((c) => `${c.title} — ${OUTCOME_COPY[c.outcome].en.toLowerCase()}, v${c.version}, ${interestsFor(c.id)} responses${c.shared ? ', public link on' : ''}`) : undefined,
    },
    {
      id: 'my_responses',
      labelEn: 'My responses',
      labelEl: 'Οι απαντήσεις μου',
      rows: tab === 'responses' ? shownResponses.map((t) => `${t.cardTitle} by ${t.counterpart.displayName} — ${t.step}${nextAction(t) ? `; next: ${nextAction(t)?.en}` : ''}`) : undefined,
    },
    {
      id: 'needs_you',
      labelEn: 'Needs you',
      labelEl: 'Σας χρειάζονται',
      rows: needsYou.map((t) => `${nextAction(t)?.en} on “${t.cardTitle}”`),
    },
  ]);

  const rail: PageRailSection[] = [
    {
      id: 'needs',
      glyph: 'bell',
      labelEn: 'Needs you',
      labelEl: 'Σας χρειάζονται',
      badge: needsYou.length || null,
      content: needsYou.length ? (
        <ul className="space-y-1">
          {needsYou.map((t) => {
            const next = nextAction(t)!;
            return (
              <li key={t.id}>
                <Link href={threadHref(t)} className="block rounded-lg px-2.5 py-2 text-sm hover:bg-muted/70">
                  <span className="block font-medium text-foreground"><BilingualText en={next.en} el={next.el} compact wrap /></span>
                  <span className="block truncate text-xs text-muted-foreground">{t.cardTitle}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-2.5 text-sm text-muted-foreground"><BilingualText en={CMT.nothing_waiting.en} el={CMT.nothing_waiting.el} wrap /></p>
      ),
    },
    {
      id: 'filters',
      glyph: 'sliders',
      labelEn: 'Filters',
      labelEl: 'Φίλτρα',
      badge: (outcome !== 'all' ? 1 : 0) + (kind !== 'all' ? 1 : 0) || null,
      content: (
        <div className="space-y-4">
          <RailOptions
            title={CMT.outcome_filter.en}
            titleEl={CMT.outcome_filter.el}
            value={outcome}
            onChange={setOutcome}
            options={[
              { value: 'all', en: CMT.all.en, el: CMT.all.el },
              ...COMMITMENT_OUTCOMES.map((o) => ({ value: o as OutcomeFilter, en: OUTCOME_COPY[o].en, el: OUTCOME_COPY[o].el, count: liveCards.filter((c) => c.outcome === o).length })),
            ]}
          />
          <RailOptions
            title={CMT.kind.en}
            titleEl={CMT.kind.el}
            value={kind}
            onChange={setKind}
            options={[
              { value: 'all', en: CMT.all.en, el: CMT.all.el },
              ...COMMITMENT_KINDS.map((k) => ({ value: k as KindFilter, en: kindCopy(k).en, el: kindCopy(k).el })),
            ]}
          />
        </div>
      ),
    },
    {
      id: 'rules',
      glyph: 'book',
      labelEn: 'How the ladder works',
      labelEl: 'Πώς λειτουργεί η κλίμακα',
      content: (
        <ol className="space-y-2 px-2.5 text-sm text-muted-foreground">
          <li><BilingualText en="1. Interest: a line on why you fit." el="1. Ενδιαφέρον: μια γραμμή για το γιατί ταιριάζετε." wrap /></li>
          <li><BilingualText en="2. A protected conversation: no contact details." el="2. Προστατευμένη συζήτηση: χωρίς στοιχεία επικοινωνίας." wrap /></li>
          <li><BilingualText en="3. Each side confirms separately, unseen by the other." el="3. Ο καθένας επιβεβαιώνει χωριστά, χωρίς να το βλέπει ο άλλος." wrap /></li>
          <li><BilingualText en="4. Terms in versions: three revisions, then agree or step back." el="4. Όροι σε εκδόσεις: τρεις αναθεωρήσεις, μετά συμφωνία ή αποχώρηση." wrap /></li>
          <li><BilingualText en="5. Agreed: the deal room opens and the terms freeze." el="5. Συμφωνία: ανοίγει η αίθουσα συμφωνίας και οι όροι παγώνουν." wrap /></li>
          <li><BilingualText en="Agreed and closed items stay in view for 30 days, then move to History." el="Συμφωνημένα και κλειστά μένουν ορατά 30 ημέρες και μετά πάνε στο Ιστορικό." wrap /></li>
        </ol>
      ),
    },
  ];

  const loading = cardsQ.isLoading || threadsQ.isLoading || now === null;

  const emptyFiltered = (
    <div className="space-y-2 rounded-xl border border-dashed border-border p-6 text-center">
      <p className="text-sm text-muted-foreground"><BilingualText en={CMT.empty_filtered.en} el={CMT.empty_filtered.el} wrap /></p>
      <Button size="sm" variant="outline" onClick={() => openRailSection('filters')}>
        <BilingualText en={CMT.open_filters.en} el={CMT.open_filters.el} compact />
      </Button>
    </div>
  );

  return (
    <AppShell
      showHelp
      rail={rail}
      askAi="Which of my commitments needs me next, and what should I say?"
      actions={
        <Button className="gap-2" asChild>
          <Link href="/commitments/new">
            <Plus className="icon-sm" />
            <BilingualText en={CMT.write_card.en} el={CMT.write_card.el} compact />
          </Link>
        </Button>
      }
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="mine"><BilingualText en={CMT.tab_mine.en} el={CMT.tab_mine.el} compact /></TabsTrigger>
          <TabsTrigger value="responses"><BilingualText en={CMT.tab_responses.en} el={CMT.tab_responses.el} compact /></TabsTrigger>
          <TabsTrigger value="history"><BilingualText en={CMT.tab_history.en} el={CMT.tab_history.el} compact /></TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="space-y-4">
          {loading ? (
            <Skeleton className="h-48 w-full rounded-2xl" />
          ) : liveCards.length === 0 ? (
            <div className="space-y-3 rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted-foreground"><BilingualText en={CMT.empty_mine.en} el={CMT.empty_mine.el} wrap /></p>
              <Button size="sm" asChild>
                <Link href="/commitments/new"><BilingualText en={CMT.two_minutes.en} el={CMT.two_minutes.el} compact /></Link>
              </Button>
            </div>
          ) : shownCards.length === 0 ? (
            emptyFiltered
          ) : (
            shownCards.map((card) => (
              <Card key={card.id}>
                <CardContent>
                  <NeedCard
                    card={card}
                    compact
                    showOwner={false}
                    footer={<HistoryNote settled={card.settledAt} now={at} />}
                    actions={
                      <>
                        <Button size="sm" asChild>
                          <Link href={`/commitments/${encodeURIComponent(card.id)}`}>
                            <BilingualText
                              en={`${CMT.responses.en} · ${interestsFor(card.id)}`}
                              el={`${CMT.responses.el} · ${interestsFor(card.id)}`}
                              compact
                            />
                          </Link>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" aria-label={bilingualAria(`More for ${card.title}`, `Περισσότερα για ${card.title}`)}>
                              <MoreHorizontal className="icon-sm" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => void copyLink(card)}>
                              <BilingualText en={CMT.share_copy.en} el={CMT.share_copy.el} compact />
                            </DropdownMenuItem>
                            {card.shared ? (
                              <DropdownMenuItem onClick={() => void revoke(card)}>
                                <BilingualText en={CMT.share_revoke.en} el={CMT.share_revoke.el} compact />
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem asChild>
                              <Link href={`/commitments/new?edit=${encodeURIComponent(card.id)}`}>
                                <BilingualText en={CMT.edit_card.en} el={CMT.edit_card.el} compact />
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {card.outcome === 'closed' ? (
                              <DropdownMenuItem onClick={() => void reopen(card)}>
                                <BilingualText en={CMT.reopen.en} el={CMT.reopen.el} compact />
                              </DropdownMenuItem>
                            ) : (
                              <>
                                <DropdownMenuItem onClick={() => void closeCard(card, 'filled')}>
                                  <BilingualText en={CMT.close_filled.en} el={CMT.close_filled.el} compact />
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => void closeCard(card, 'withdrawn')}>
                                  <BilingualText en={CMT.close_withdrawn.en} el={CMT.close_withdrawn.el} compact />
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    }
                  />
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="responses" className="space-y-4">
          {loading ? (
            <Skeleton className="h-40 w-full rounded-2xl" />
          ) : liveResponses.length === 0 ? (
            <div className="space-y-3 rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted-foreground"><BilingualText en={CMT.empty_responses.en} el={CMT.empty_responses.el} wrap /></p>
              <Button size="sm" variant="outline" asChild>
                <Link href="/opportunities"><BilingualText en="Opportunities" el="Ευκαιρίες" compact /></Link>
              </Button>
            </div>
          ) : shownResponses.length === 0 ? (
            emptyFiltered
          ) : (
            shownResponses.map((thread) => <ResponseRow key={thread.id} thread={thread} now={at} />)
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {loading ? (
            <Skeleton className="h-32 w-full rounded-2xl" />
          ) : historyCards.length + historyResponses.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              <BilingualText en={CMT.empty_history.en} el={CMT.empty_history.el} wrap />
            </p>
          ) : (
            <>
              {historyCards.map((card) => (
                <Card key={card.id}>
                  <CardContent className="flex flex-wrap items-center gap-3">
                    <OutcomeChip outcome={card.outcome} reason={card.closedReason} />
                    <Link href={`/commitments/${encodeURIComponent(card.id)}`} className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:underline">
                      {card.title}
                    </Link>
                  </CardContent>
                </Card>
              ))}
              {historyResponses.map((thread) => (
                <Card key={thread.id}>
                  <CardContent className="flex flex-wrap items-center gap-3">
                    <StepChip step={thread.step} />
                    <Link href={threadHref(thread)} className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:underline">
                      {thread.cardTitle}
                    </Link>
                    <span className="text-xs text-muted-foreground">{thread.counterpart.displayName}</span>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </TabsContent>
      </Tabs>
      {filtered ? <span className="sr-only" aria-live="polite">{`${shownCards.length + shownResponses.length} shown`}</span> : null}
    </AppShell>
  );
}
