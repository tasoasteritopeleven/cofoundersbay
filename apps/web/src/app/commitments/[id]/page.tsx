'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Linkedin, Link2, Link2Off, MoreHorizontal, Search } from 'lucide-react';
import { acceptsInterest, contactKinds, findPromiseClaims, INTEREST_BUDGET_COPY, NEED_CARD_LIMITS, briefFromNeedCard } from '@cofounderbay/shared';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { RailAction } from '@/components/layout/RailParts';
import { BilingualText } from '@/components/common/BilingualText';
import { StatusText } from '@/components/common/StatusText';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';
import { NeedCard } from '@/components/commitments/NeedCard';
import { StepChip } from '@/components/commitments/OutcomeChip';
import { ContactWarning } from '@/components/commitments/ContactWarning';
import { ThreadWorkspace } from '@/components/commitments/ThreadWorkspace';
import {
  closeCommitmentCard,
  commitmentRefusal,
  expressCommitmentInterest,
  getInterestBudget,
  getCommitmentCard,
  listCommitmentThreads,
  reopenCommitmentCard,
  revokeCommitmentShare,
  shareCommitmentCard,
  withdrawCommitmentInterest,
  type CommitmentCard,
} from '@/lib/commitments-api';
import { linkedInShareUrl, publicCardUrl } from '@/lib/commitments-links';
import { CMT } from '@/lib/i18n/strings-commitments';
import { bilingualAria } from '@/lib/i18n/format';
import { qk } from '@/lib/query-keys';
import { rowOptions, settle, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { cn } from '@/lib/utils';
import { needCardPost, useSuggestedPost } from '@/lib/share-text';
import { FORM_DRAFT_ROUTES, stashFormDraft } from '@/lib/form-draft';

const OFFER_FIELD_COPY: Record<string, { en: string; el: string }> = {
  offerRole: CMT.offer_role,
  offerEquity: CMT.offer_equity,
  offerHours: CMT.offer_hours,
  offerScope: CMT.offer_scope,
  commitment: CMT.commitment,
};

function InterestForm({ card, onSent }: { card: CommitmentCard; onSent: () => void }) {
  const { success } = useToast();
  const [note, setNote] = useState('');
  const [error, setError] = useState<{ en: string; el: string; reason?: string | null } | null>(null);
  const [sending, setSending] = useState(false);
  // A small budget of answers waiting on authors keeps each one considered.
  const budget = useQuery({ queryKey: qk('commitments', 'interest-budget'), queryFn: getInterestBudget });
  const full = budget.data ? budget.data.left <= 0 : false;
  const blocked = contactKinds(note).length > 0 || findPromiseClaims(note).length > 0;
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (blocked || sending) return;
        setSending(true);
        setError(null);
        try {
          await expressCommitmentInterest(card.id, note.trim());
          success('Interest sent', 'The author sees your profile and your note.');
          onSent();
        } catch (err) {
          setError(commitmentRefusal(err));
        } finally {
          setSending(false);
        }
      }}
    >
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground"><BilingualText en={CMT.interest_title.en} el={CMT.interest_title.el} compact /></h2>
        <p id="interest-hint" className="text-sm text-muted-foreground"><BilingualText en={CMT.interest_hint.en} el={CMT.interest_hint.el} wrap /></p>
      </div>
      <Label htmlFor="interest-note" className="sr-only">{CMT.interest_title.en}</Label>
      <Textarea
        id="interest-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={NEED_CARD_LIMITS.note}
        className="min-h-20"
        aria-describedby="interest-hint"
        placeholder="I have shipped… and could start with…"
      />
      <ContactWarning text={note} promises />
      {error ? <p role="alert" className="text-sm text-status-danger"><BilingualText en={error.en} el={error.el} wrap /></p> : null}
      {error?.reason === 'role_verification_required' || error?.reason === 'verification_required' ? (
        <Button size="sm" variant="outline" asChild>
          <Link href="/settings#verification"><BilingualText en="Verify in Settings" el="Επαλήθευση στις Ρυθμίσεις" compact /></Link>
        </Button>
      ) : null}
      {budget.data ? (
        <p className="text-xs text-muted-foreground">
          {full ? (
            <BilingualText en={INTEREST_BUDGET_COPY.en} el={INTEREST_BUDGET_COPY.el} wrap />
          ) : (
            <BilingualText
              en={`${budget.data.waiting} of ${budget.data.budget} answers waiting on authors. One frees up when it is accepted or withdrawn.`}
              el={`${budget.data.waiting} από ${budget.data.budget} απαντήσεις περιμένουν συντάκτη. Μία ελευθερώνεται όταν γίνει δεκτή ή αποσυρθεί.`}
              wrap
            />
          )}
        </p>
      ) : null}
      <Button type="submit" disabled={blocked || sending || full} title={full ? `${INTEREST_BUDGET_COPY.en} · ${INTEREST_BUDGET_COPY.el}` : undefined}>
        <BilingualText en={CMT.interest_send.en} el={CMT.interest_send.el} compact />
      </Button>
    </form>
  );
}

function Board() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { success } = useToast();
  const suggested = useSuggestedPost();
  const cardId = String(params?.id ?? '');
  const threadParam = search?.get('thread') ?? '';

  const cardQ = useQuery({ queryKey: qk('commitments', 'card', cardId), queryFn: () => getCommitmentCard(cardId), enabled: Boolean(cardId) });
  const card = cardQ.data;
  const isOwner = card?.isMine === true;
  const threadsQ = useQuery({ queryKey: qk('commitments', 'threads', 'owner'), queryFn: () => listCommitmentThreads('owner'), enabled: isOwner });
  const responses = useMemo(() => (threadsQ.data ?? []).filter((t) => t.cardId === cardId), [threadsQ.data, cardId]);

  const [selected, setSelected] = useState(threadParam);
  useEffect(() => setSelected(threadParam), [threadParam]);
  const ownerThread = isOwner ? (responses.find((t) => t.id === selected) ?? responses.find((t) => t.step !== 'closed') ?? responses[0]) : undefined;
  const activeThreadId = isOwner ? ownerThread?.id ?? '' : card?.myThreadId ?? '';

  const refresh = () => qc.invalidateQueries({ queryKey: qk('commitments') });
  const write = useMutation({ mutationFn: (fn: () => Promise<unknown>) => fn(), onSettled: refresh });
  const run = (fn: () => Promise<unknown>) => settle(() => write.mutateAsync(fn));

  const shareUrl = card?.shareToken ? publicCardUrl(card.shareToken) : '';

  async function copyLink(): Promise<PageControlRunResult> {
    if (!card) return { error: 'The card is still loading.' };
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
  async function revoke(): Promise<PageControlRunResult> {
    if (!card) return { error: 'The card is still loading.' };
    const result = await run(() => revokeCommitmentShare(card.id));
    if (!result) success('Public link turned off');
    return result;
  }
  async function close(reason: 'filled' | 'withdrawn'): Promise<PageControlRunResult> {
    if (!card) return { error: 'The card is still loading.' };
    const result = await run(() => closeCommitmentCard(card.id, reason));
    if (!result) success('Card closed', 'Reopen it any time; nobody was notified.');
    return result;
  }
  async function reopen(): Promise<PageControlRunResult> {
    if (!card) return { error: 'The card is still loading.' };
    const result = await run(() => reopenCommitmentCard(card.id));
    if (!result) success('Card reopened');
    return result;
  }
  async function withdrawInterest(): Promise<PageControlRunResult> {
    if (!card?.myThreadId) return { error: 'You have not answered this card.' };
    const threadId = card.myThreadId;
    const result = await run(() => withdrawCommitmentInterest(threadId));
    if (!result) success('Interest withdrawn');
    return result;
  }
  async function sendBareInterest(): Promise<PageControlRunResult> {
    if (!card) return { error: 'The card is still loading.' };
    const result = await run(() => expressCommitmentInterest(card.id, ''));
    if (!result) success('Interest sent', 'The author sees your profile and your note.');
    return result;
  }

  const loadingEn = card ? undefined : 'The card is still loading.';
  const loadingEl = card ? undefined : 'Η κάρτα φορτώνει ακόμη.';
  const notOwnerEn = isOwner ? undefined : 'Only the card’s author can do this.';
  const notOwnerEl = isOwner ? undefined : 'Μόνο ο συντάκτης της κάρτας μπορεί να το κάνει.';
  const closed = card?.outcome === 'closed';
  usePageControls([
    {
      id: 'brief_scout_from_card',
      labelEn: 'Brief the co-founder scout from this card (opens the scout, saves nothing)',
      labelEl: 'Σημείωμα στον ανιχνευτή συνιδρυτών από αυτή την κάρτα (ανοίγει τον ανιχνευτή, δεν αποθηκεύει)',
      writes: false,
      ...(isOwner && card && (card.kind === 'cofounder' || card.kind === 'equity_role') && acceptsInterest(card.outcome)
        ? {}
        : { unavailableEn: 'Only the author of an open co-founder or equity-role card can brief the scout from it.', unavailableEl: 'Μόνο ο συντάκτης ανοιχτής κάρτας συνιδρυτή ή ρόλου με μετοχές μπορεί να ενημερώσει τον ανιχνευτή από αυτήν.' }),
      run: () => scoutFromCard(),
    },
    {
      id: 'open_response',
      labelEn: 'Open one response to this card',
      labelEl: 'Άνοιγμα μιας απάντησης στην κάρτα',
      writes: false,
      options: rowOptions(responses, (t) => t.id, (t) => `${t.counterpart.displayName} (${t.step})`),
      current: ownerThread?.id,
      unavailableEn: loadingEn ?? notOwnerEn ?? (responses.length ? undefined : 'Nobody has answered yet.'),
      unavailableEl: loadingEl ?? notOwnerEl ?? (responses.length ? undefined : 'Δεν έχει απαντήσει κανείς ακόμη.'),
      run: (v) => {
        if (v) router.replace(`/commitments/${encodeURIComponent(cardId)}?thread=${encodeURIComponent(v)}`);
      },
    },
    {
      id: 'send_interest',
      labelEn: 'Send interest in this card (without a note)',
      labelEl: 'Αποστολή ενδιαφέροντος για την κάρτα (χωρίς σημείωμα)',
      writes: true,
      unavailableEn: loadingEn ?? (isOwner ? 'This is your own card.' : card?.myThreadId ? 'You have already answered this card.' : card && !acceptsInterest(card.outcome) ? 'This card is not taking interest.' : undefined),
      unavailableEl: loadingEl ?? (isOwner ? 'Αυτή είναι η δική σας κάρτα.' : card?.myThreadId ? 'Έχετε ήδη απαντήσει σε αυτή την κάρτα.' : card && !acceptsInterest(card.outcome) ? 'Η κάρτα δεν δέχεται ενδιαφέρον.' : undefined),
      // The author is notified on arrival, so withdrawing takes the interest
      // off their list but cannot unsend that (run_page_command is partial).
      undo: () => ({ control: 'withdraw_interest' }),
      run: sendBareInterest,
    },
    {
      id: 'withdraw_interest',
      labelEn: 'Withdraw my interest in this card',
      labelEl: 'Ανάκληση του ενδιαφέροντός μου για την κάρτα',
      writes: true,
      unavailableEn: loadingEn ?? (isOwner ? 'This is your own card.' : !card?.myThreadId ? 'You have not answered this card.' : card.myThreadStep !== 'interest' ? 'The author already answered; step back instead.' : undefined),
      unavailableEl: loadingEl ?? (isOwner ? 'Αυτή είναι η δική σας κάρτα.' : !card?.myThreadId ? 'Δεν έχετε απαντήσει σε αυτή την κάρτα.' : card.myThreadStep !== 'interest' ? 'Ο συντάκτης έχει απαντήσει· αποχωρήστε αντί γι’ αυτό.' : undefined),
      run: withdrawInterest,
    },
    {
      id: 'copy_public_link',
      labelEn: 'Copy this card’s public link',
      labelEl: 'Αντιγραφή του δημόσιου συνδέσμου της κάρτας',
      writes: true,
      unavailableEn: loadingEn ?? notOwnerEn,
      unavailableEl: loadingEl ?? notOwnerEl,
      undo: () => (card && !card.shared ? { control: 'revoke_public_link' } : undefined),
      run: copyLink,
    },
    {
      id: 'revoke_public_link',
      labelEn: 'Turn off this card’s public link',
      labelEl: 'Απενεργοποίηση του δημόσιου συνδέσμου της κάρτας',
      writes: true,
      unavailableEn: loadingEn ?? notOwnerEn ?? (card?.shared ? undefined : 'There is no public link.'),
      unavailableEl: loadingEl ?? notOwnerEl ?? (card?.shared ? undefined : 'Δεν υπάρχει δημόσιος σύνδεσμος.'),
      run: revoke,
    },
    {
      id: 'close_card_filled',
      labelEn: 'Close this card as filled',
      labelEl: 'Κλείσιμο της κάρτας ως καλυμμένης',
      writes: true,
      unavailableEn: loadingEn ?? notOwnerEn ?? (closed ? 'The card is already closed.' : undefined),
      unavailableEl: loadingEl ?? notOwnerEl ?? (closed ? 'Η κάρτα έχει ήδη κλείσει.' : undefined),
      undo: () => ({ control: 'reopen_card' }),
      run: () => close('filled'),
    },
    {
      id: 'withdraw_card',
      labelEn: 'Withdraw this card',
      labelEl: 'Απόσυρση της κάρτας',
      writes: true,
      unavailableEn: loadingEn ?? notOwnerEn ?? (closed ? 'The card is already closed.' : undefined),
      unavailableEl: loadingEl ?? notOwnerEl ?? (closed ? 'Η κάρτα έχει ήδη κλείσει.' : undefined),
      undo: () => ({ control: 'reopen_card' }),
      run: () => close('withdrawn'),
    },
    {
      id: 'reopen_card',
      labelEn: 'Reopen this card',
      labelEl: 'Επανενεργοποίηση της κάρτας',
      writes: true,
      unavailableEn: loadingEn ?? notOwnerEn ?? (!closed ? 'The card is not closed.' : undefined),
      unavailableEl: loadingEl ?? notOwnerEl ?? (!closed ? 'Η κάρτα δεν είναι κλειστή.' : undefined),
      run: reopen,
    },
  ]);
  usePageList([
    {
      id: 'card_responses',
      labelEn: 'Responses to this card',
      labelEl: 'Απαντήσεις στην κάρτα',
      rows: isOwner ? responses.map((t) => `${t.counterpart.displayName} — ${t.step}${t.myConfirmed ? ', you confirmed' : ''}${t.latestTermsVersion ? `, terms v${t.latestTermsVersion}` : ''}`) : undefined,
    },
  ]);

  // The public link is the author's alone to make, copy or turn off.
  const shareSection: PageRailSection[] = isOwner && card
    ? [
      {
        id: 'share',
        glyph: 'discover',
        labelEn: 'Public card',
        labelEl: 'Δημόσια κάρτα',
        badge: card.shared ? '•' : null,
        content: (
          <div className="space-y-2">
            <p className="px-2.5 text-xs text-muted-foreground"><BilingualText en={CMT.share_hint.en} el={CMT.share_hint.el} wrap /></p>
            {card.shared && shareUrl ? (
              <>
                <p className="break-all px-2.5 font-mono text-2xs text-muted-foreground">{shareUrl}</p>
                <RailAction icon={Copy} en={CMT.share_copy.en} el={CMT.share_copy.el} onClick={() => void copyLink()} />
                <a
                  href={linkedInShareUrl(shareUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => suggested.copy(needCardPost(card, shareUrl, suggested.lang))}
                  className="tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted/70"
                >
                  <Linkedin className="icon-sm shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1"><BilingualText en={CMT.share_linkedin.en} el={CMT.share_linkedin.el} compact wrap /></span>
                </a>
                <RailAction icon={Link2Off} en={CMT.share_revoke.en} el={CMT.share_revoke.el} onClick={() => void revoke()} />
              </>
            ) : (
              <RailAction icon={Link2} en={CMT.share_create.en} el={CMT.share_create.el} onClick={() => void copyLink()} />
            )}
          </div>
        ),
      },
      ]
    : [];
  // The scout, briefed from this card: role, place, time, stage and the
  // "who is missing" sentence. Nothing is saved until Save on /scout.
  const scoutFromCard = () => {
    if (!card) return;
    const brief = briefFromNeedCard(card);
    stashFormDraft('scout_brief', { role: brief.role, place: brief.place, commitment: brief.commitment, stage: brief.stage, note: brief.note });
    router.push(FORM_DRAFT_ROUTES.scout_brief);
  };
  const scoutable = isOwner && card && (card.kind === 'cofounder' || card.kind === 'equity_role') && acceptsInterest(card.outcome);
  const scoutSection: PageRailSection[] = scoutable
    ? [
      {
        id: 'scout',
        glyph: 'discover',
        labelEn: 'Find people',
        labelEl: 'Εύρεση ανθρώπων',
        content: (
          <div className="space-y-2">
            <p className="px-2.5 text-xs text-muted-foreground">
              <BilingualText
                en="The co-founder scout reads the members against this card and proposes people with its reasons. It contacts nobody."
                el="Ο ανιχνευτής συνιδρυτών διαβάζει τα μέλη με βάση αυτή την κάρτα και προτείνει ανθρώπους με τους λόγους του. Δεν επικοινωνεί με κανέναν."
                wrap
              />
            </p>
            <RailAction icon={Search} en="Brief the scout from this card" el="Σημείωμα στον ανιχνευτή από αυτή την κάρτα" onClick={scoutFromCard} />
          </div>
        ),
      },
      ]
    : [];
  const rail: PageRailSection[] = [
    ...shareSection,
    ...scoutSection,
    {
      id: 'versions',
      glyph: 'research',
      labelEn: 'Card versions',
      labelEl: 'Εκδόσεις κάρτας',
      badge: card && card.version > 1 ? card.version : null,
      content: card && card.history.length ? (
        <ol className="space-y-3 px-2.5">
          <li className="text-sm font-medium text-foreground">v{card.version} · <BilingualText en="current" el="τρέχουσα" compact /></li>
          {[...card.history].reverse().map((h) => (
            <li key={h.version} className="space-y-0.5 text-sm">
              <p className="font-medium text-foreground">v{h.version}</p>
              <p className="text-xs text-muted-foreground">
                {[h.offer.role, h.offer.equity, h.offer.hoursPerWeek ? `${h.offer.hoursPerWeek} h/week` : null].filter(Boolean).join(' · ')}
              </p>
              {h.changed.length ? (
                <p className="text-2xs text-muted-foreground">
                  <BilingualText
                    en={`Changed in v${h.version + 1}: ${h.changed.map((f) => OFFER_FIELD_COPY[f]?.en ?? f).join(', ')}`}
                    el={`Άλλαξαν στην v${h.version + 1}: ${h.changed.map((f) => OFFER_FIELD_COPY[f]?.el ?? f).join(', ')}`}
                    compact
                    wrap
                  />
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-2.5 text-sm text-muted-foreground"><BilingualText en={CMT.no_versions.en} el={CMT.no_versions.el} wrap /></p>
      ),
    },
    {
      id: 'rules',
      glyph: 'book',
      labelEn: 'How the ladder works',
      labelEl: 'Πώς λειτουργεί η κλίμακα',
      content: (
        <div className="space-y-2 px-2.5 text-sm text-muted-foreground">
          <p><BilingualText en={CMT.protected_hint.en} el={CMT.protected_hint.el} wrap /></p>
          <p><BilingualText en={CMT.confirm_hint.en} el={CMT.confirm_hint.el} wrap /></p>
          <p><BilingualText en={CMT.terms_hint.en} el={CMT.terms_hint.el} wrap /></p>
        </div>
      ),
    },
  ];

  if (cardQ.isLoading) {
    return (
      <AppShell showHelp>
        <div className="space-y-6">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </AppShell>
    );
  }
  if (!card || !card.id) {
    return (
      <AppShell showHelp>
        <div className="space-y-6 rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground"><BilingualText en="This need card was not found." el="Η κάρτα ανάγκης δεν βρέθηκε." wrap /></p>
          <Button size="sm" variant="outline" asChild>
            <Link href="/commitments"><BilingualText en={CMT.area.en} el={CMT.area.el} compact /></Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      showHelp
      rail={rail}
      askAi={isOwner ? `Help me answer the responses to my need card “${card.title}”.` : `Help me decide whether to answer “${card.title}” and what to say.`}
      actions={
        isOwner ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href={`/commitments/new?edit=${encodeURIComponent(card.id)}`}>
                <BilingualText en={CMT.edit_card.en} el={CMT.edit_card.el} compact />
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={bilingualAria('More card actions', 'Περισσότερες ενέργειες κάρτας')}>
                  <MoreHorizontal className="icon-md" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {closed ? (
                  <DropdownMenuItem onClick={() => void reopen()}><BilingualText en={CMT.reopen.en} el={CMT.reopen.el} compact /></DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => void close('filled')}><BilingualText en={CMT.close_filled.en} el={CMT.close_filled.el} compact /></DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void close('withdrawn')}><BilingualText en={CMT.close_withdrawn.en} el={CMT.close_withdrawn.el} compact /></DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <Card>
          <CardContent>
            <NeedCard card={card} headingLevel={2} />
            {card.projectRef ? (
              <p className="pt-4 text-sm">
                <Link href={`/projects/${encodeURIComponent(card.projectRef)}`} className="text-primary-accessible underline-offset-4 hover:underline">
                  <BilingualText en="Open the project" el="Άνοιγμα του έργου" compact />
                </Link>
              </p>
            ) : null}
          </CardContent>
        </Card>

        {isOwner ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                <BilingualText en={CMT.responses.en} el={CMT.responses.el} compact />
                <span className="ml-1.5 font-normal tabular-nums text-muted-foreground">{responses.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {responses.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  <BilingualText en="No responses yet. Share the public card to reach people outside the platform." el="Δεν υπάρχουν απαντήσεις ακόμη. Μοιραστείτε τη δημόσια κάρτα για να φτάσει και εκτός πλατφόρμας." wrap />
                </p>
              ) : (
                <div role="tablist" aria-label={bilingualAria(CMT.responses.en, CMT.responses.el)} className="flex flex-wrap gap-2">
                  {responses.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={t.id === ownerThread?.id}
                      onClick={() => router.replace(`/commitments/${encodeURIComponent(cardId)}?thread=${encodeURIComponent(t.id)}`)}
                      className={cn(
                        'flex min-h-10 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors',
                        t.id === ownerThread?.id ? 'border-primary bg-primary/10 font-medium' : 'border-border hover:bg-accent',
                      )}
                    >
                      <span className="max-w-[12rem] truncate">{t.counterpart.displayName}</span>
                      <StepChip step={t.step} />
                    </button>
                  ))}
                </div>
              )}
              {activeThreadId ? <ThreadWorkspace key={activeThreadId} threadId={activeThreadId} /> : null}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent>
              {activeThreadId ? (
                <ThreadWorkspace key={activeThreadId} threadId={activeThreadId} />
              ) : acceptsInterest(card.outcome) ? (
                <InterestForm card={card} onSent={() => void refresh()} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  <BilingualText en={CMT.not_taking.en} el={CMT.not_taking.el} wrap />
                  {card.closedReason ? <span className="ml-1"><StatusText value={card.closedReason} /></span> : null}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

export default function NeedCardBoardPage() {
  return (
    <Suspense fallback={null}>
      <Board />
    </Suspense>
  );
}
