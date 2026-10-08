'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { COMMITMENT_KINDS, type CommitmentKind } from '@cofounderbay/shared';
import { BilingualText } from '@/components/common/BilingualText';
import { Button } from '@/components/ui/button';
import { listCommitmentCards } from '@/lib/commitments-api';
import { CMT } from '@/lib/i18n/strings-commitments';
import { qk } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

/**
 * The first screen a new founder meets: one move, not a dashboard.
 *
 * A founder who has never posted a need card is asked one question - who
 * the startup needs - and offered the three kinds of card, each opening the
 * two-minute guide already set to that kind. The rest of the dashboard
 * (checklist, figures, readiness, outcomes) is folded under one disclosure
 * for a founder who has not finished getting started either, so nothing is
 * removed: it is one press away and the choice is remembered. A founder who
 * has used the product (checklist done or dismissed) keeps the full
 * dashboard with this card above it, and "Not now" hides the card.
 *
 * The card list is read on the same key as `CommitmentOutcomes`, so the two
 * cannot disagree and posting a card (which invalidates `commitments`) turns
 * this screen into the ordinary dashboard without a reload.
 */

export const FIRST_MOVE_LATER_KEY = 'cfb.dashboard.founder.first-move';
export const FULL_DASHBOARD_KEY = 'cfb.dashboard.founder.full';

/** `unknown` until the list answers; an error stays `unknown`, never "no cards". */
export type FirstMoveState = 'unknown' | 'first' | 'posted';

export function useFirstMoveState(enabled = true): { state: FirstMoveState; count: number | null; settled: boolean } {
  const cardsQ = useQuery({
    queryKey: qk('commitments', 'cards', 'mine'),
    queryFn: () => listCommitmentCards({ mine: true }),
    enabled,
  });
  // `settled` lets the page tour wait for the answer without waiting forever on a failure.
  const settled = cardsQ.isSuccess || cardsQ.isError;
  if (!cardsQ.isSuccess) return { state: 'unknown', count: null, settled };
  const mine = (cardsQ.data ?? []).filter((c) => c?.isMine !== false);
  return { state: mine.length === 0 ? 'first' : 'posted', count: mine.length, settled };
}

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string, on: boolean) {
  try {
    if (on) window.localStorage.setItem(key, '1');
    else window.localStorage.removeItem(key);
  } catch {
    /* storage unavailable: the choice lasts for this visit */
  }
}

/** A remembered on/off, `undefined` until read after mount so server and client agree. */
export function useStoredFlag(key: string): [boolean | undefined, (on: boolean) => void] {
  const [value, setValue] = useState<boolean | undefined>(undefined);
  useEffect(() => setValue(readFlag(key)), [key]);
  const set = useCallback(
    (on: boolean) => {
      writeFlag(key, on);
      setValue(on);
    },
    [key],
  );
  return [value, set];
}

/**
 * What the dashboard shows, from what is known. Every `undefined` (storage
 * not read yet) waits rather than flashing one layout and then the other.
 * - the first move: while no need card exists and the founder has not said "Not now";
 * - the fold: only for a founder who is also just starting (checklist open, not dismissed);
 * - folded: until they open it, which is remembered.
 */
export function firstMoveLayout({
  state,
  later,
  checklistDone,
  checklistDismissed,
  full,
}: {
  state: FirstMoveState;
  later: boolean | undefined;
  checklistDone: boolean;
  checklistDismissed: boolean | undefined;
  full: boolean | undefined;
}): { showFirstMove: boolean; restFoldable: boolean; restFolded: boolean } {
  const showFirstMove = state === 'first' && later === false;
  const justStarting = !checklistDone && checklistDismissed === false;
  const restFoldable = showFirstMove && justStarting && full !== undefined;
  return { showFirstMove, restFoldable, restFolded: restFoldable && full === false };
}

const KIND_COPY: Record<CommitmentKind, { label: { en: string; el: string }; hint: { en: string; el: string } }> = {
  cofounder: { label: CMT.kind_cofounder, hint: CMT.kind_cofounder_hint },
  equity_role: { label: CMT.kind_equity_role, hint: CMT.kind_equity_role_hint },
  investor_intro: { label: CMT.kind_investor_intro, hint: CMT.kind_investor_intro_hint },
};

const LADDER: { en: string; el: string }[] = [
  { en: 'You post the card', el: 'Δημοσιεύετε την κάρτα' },
  { en: 'People who fit express interest', el: 'Όσοι ταιριάζουν δείχνουν ενδιαφέρον' },
  { en: 'You choose whom to talk to, then agree terms', el: 'Επιλέγετε με ποιον θα μιλήσετε και συμφωνείτε όρους' },
];

export function FounderFirstMove({
  onLater,
  assist,
}: {
  /** Hide this card; the dashboard's own outcomes card still offers the first card. */
  onLater: () => void;
  /** The assistant's way in (drafts the card with the reader). */
  assist?: ReactNode;
}) {
  return (
    <section
      aria-labelledby="founder-first-move-title"
      className="rounded-2xl border border-primary/15 bg-primary/[0.03] p-5 sm:p-6"
      data-first-move=""
    >
      <div className="space-y-2">
        <p className="text-xs font-medium text-primary-accessible">
          <BilingualText en="Start here" el="Ξεκινήστε εδώ" compact />
        </p>
        <h2 id="founder-first-move-title" className="text-xl font-semibold tracking-tight text-foreground">
          <BilingualText en="Who does your startup need?" el="Ποιον χρειάζεται η startup σας;" wrap />
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          <BilingualText
            en="Post one need card. People who fit answer it, and you choose whom to talk to. Nothing is promised until both of you confirm the terms."
            el="Δημοσιεύστε μία κάρτα ανάγκης. Όσοι ταιριάζουν απαντούν και εσείς επιλέγετε με ποιον θα μιλήσετε. Τίποτα δεν υπόσχεται κανείς πριν επιβεβαιώσετε και οι δύο τους όρους."
            wrap
          />
        </p>
      </div>

      <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Kinds of need card · Είδη κάρτας ανάγκης">
        {COMMITMENT_KINDS.map((kind) => (
          <li key={kind} className="min-w-0">
            <Link
              href={`/commitments/new?kind=${kind}`}
              className="group flex h-full min-w-0 flex-col gap-1.5 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex items-center justify-between gap-2 text-sm font-medium text-foreground">
                <BilingualText en={KIND_COPY[kind].label.en} el={KIND_COPY[kind].label.el} compact />
                <ArrowRight className="icon-sm shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
              <span className="text-xs text-muted-foreground">
                <BilingualText en={KIND_COPY[kind].hint.en} el={KIND_COPY[kind].hint.el} wrap />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <ol className="mt-5 grid grid-cols-1 gap-2 text-sm text-muted-foreground sm:grid-cols-3" aria-label="What happens next · Τι ακολουθεί">
        {LADDER.map((step, i) => (
          <li key={step.en} className="flex min-w-0 items-start gap-2">
            <span
              className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xs font-semibold tabular-nums text-primary-accessible"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <span className="min-w-0">
              <BilingualText en={step.en} el={step.el} wrap />
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-primary/10 pt-4">
        {assist}
        <Link href="/opportunities" className="text-sm font-medium text-primary-accessible underline-offset-4 hover:underline">
          <BilingualText en="See what others are asking for" el="Δείτε τι ζητούν άλλοι" compact />
        </Link>
        <span className="text-xs text-muted-foreground">
          <BilingualText en={CMT.two_minutes.en} el={CMT.two_minutes.el} compact />
        </span>
        <Button type="button" variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={onLater}>
          <BilingualText en="Not now" el="Όχι τώρα" compact />
        </Button>
      </div>
    </section>
  );
}

/**
 * The fold over the rest of the dashboard for a founder who is just starting:
 * it names what is inside, with the getting-started count, so the reader
 * knows what one press opens.
 */
export function RestOfDashboardToggle({
  open,
  onToggle,
  controls,
  stepsDone,
  stepsTotal,
}: {
  open: boolean;
  onToggle: () => void;
  controls: string;
  stepsDone: number;
  stepsTotal: number;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-auto min-h-11 w-full justify-between gap-3 py-2.5 text-left"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">
          {open ? (
            <BilingualText en="Hide the rest of the dashboard" el="Απόκρυψη του υπόλοιπου πίνακα" compact />
          ) : (
            <BilingualText en="Show the rest of the dashboard" el="Εμφάνιση του υπόλοιπου πίνακα" compact />
          )}
        </span>
        <span className="block text-xs font-normal text-muted-foreground">
          <BilingualText
            en={`Getting started ${stepsDone} of ${stepsTotal} · figures · readiness · outcomes`}
            el={`Πρώτα βήματα ${stepsDone} από ${stepsTotal} · αριθμοί · ετοιμότητα · αποτελέσματα`}
            wrap
          />
        </span>
      </span>
      <ChevronDown className={cn('icon-sm shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden="true" />
    </Button>
  );
}
