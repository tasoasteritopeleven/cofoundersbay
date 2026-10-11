'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { COMMITMENT_OUTCOMES, isInHistory } from '@cofounderbay/shared';
import { BilingualText } from '@/components/common/BilingualText';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listCommitmentCards, listCommitmentThreads } from '@/lib/commitments-api';
import { waitsOnMe } from '@/lib/commitments-next';
import { CMT } from '@/lib/i18n/strings-commitments';
import { qk } from '@/lib/query-keys';
import { OutcomeChip } from './OutcomeChip';

/**
 * Where the founder's commitments stand, beside the readiness score.
 *
 * Readiness says how ready the startup is; this says whether the people it
 * needs are coming: each outcome with its count, the steps waiting on the
 * reader, and a link to the list. Settled items older than thirty days are
 * history and are not counted here.
 */
export function CommitmentOutcomes() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  const cardsQ = useQuery({ queryKey: qk('commitments', 'cards', 'mine'), queryFn: () => listCommitmentCards({ mine: true }) });
  const threadsQ = useQuery({ queryKey: qk('commitments', 'threads', 'all'), queryFn: () => listCommitmentThreads('all') });
  const cards = (cardsQ.data ?? []).filter((c) => c.isMine && (now === null || !isInHistory(c.settledAt, now)));
  const waiting = (threadsQ.data ?? []).filter(waitsOnMe).length;

  return (
    <Card data-commitment-outcomes="">
      <CardHeader className="pb-2">
        <CardTitle className="text-base"><BilingualText en={CMT.outcomes.en} el={CMT.outcomes.el} compact /></CardTitle>
        <p className="text-xs text-muted-foreground"><BilingualText en={CMT.outcomes_hint.en} el={CMT.outcomes_hint.el} wrap /></p>
      </CardHeader>
      <CardContent className="space-y-3">
        {cardsQ.isLoading || now === null ? (
          <p className="text-sm text-muted-foreground">…</p>
        ) : cards.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground"><BilingualText en={CMT.empty_mine.en} el={CMT.empty_mine.el} wrap /></p>
            <Button asChild size="sm">
              <Link href="/commitments/new"><BilingualText en={CMT.first_card.en} el={CMT.first_card.el} compact /></Link>
            </Button>
          </div>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {COMMITMENT_OUTCOMES.map((o) => {
              const n = cards.filter((c) => c.outcome === o).length;
              return n ? (
                <li key={o} className="flex items-center gap-1.5">
                  <OutcomeChip outcome={o} />
                  <span className="text-sm font-semibold tabular-nums text-foreground">{n}</span>
                </li>
              ) : null;
            })}
          </ul>
        )}
        {waiting > 0 ? (
          <p className="text-sm text-foreground">
            <BilingualText en={`${waiting} ${waiting === 1 ? 'step waits' : 'steps wait'} on you`} el={`${waiting} ${waiting === 1 ? 'βήμα περιμένει' : 'βήματα περιμένουν'} από εσάς`} wrap />
          </p>
        ) : null}
        <Link href="/commitments" className="inline-block text-sm font-medium text-primary-accessible underline-offset-4 hover:underline">
          <BilingualText en={CMT.area.en} el={CMT.area.el} compact />
        </Link>
      </CardContent>
    </Card>
  );
}
