'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BilingualText } from '@/components/common/BilingualText';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listCommitmentCards } from '@/lib/commitments-api';
import { CMT } from '@/lib/i18n/strings-commitments';
import { qk } from '@/lib/query-keys';
import { NeedCard } from './NeedCard';

/**
 * A project's need card, on the project's own page.
 *
 * The project says what it is; the card says what it needs and what it
 * offers for it. The author sees a two-minute prompt when there is none;
 * anyone else sees the card, or nothing.
 */
export function ProjectNeedCard({ projectId, owned }: { projectId: string; owned: boolean }) {
  const query = useQuery({
    queryKey: qk('commitments', 'cards', 'project', projectId),
    queryFn: () => listCommitmentCards({ projectRefs: [projectId] }),
    enabled: Boolean(projectId),
  });
  const card = (query.data ?? []).find((c) => c.outcome !== 'closed') ?? (query.data ?? [])[0];

  if (query.isLoading) return null;
  if (!card) {
    if (!owned) return null;
    return (
      <Card className="border-primary/15 bg-primary/[0.03]">
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground"><BilingualText en={CMT.write_card.en} el={CMT.write_card.el} compact /></p>
            <p className="text-xs text-muted-foreground"><BilingualText en={CMT.guide_intro.en} el={CMT.guide_intro.el} wrap /></p>
          </div>
          <Button size="sm" asChild>
            <Link href={`/commitments/new?project=${encodeURIComponent(projectId)}`}>
              <BilingualText en={CMT.two_minutes.en} el={CMT.two_minutes.el} compact />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground"><BilingualText en={CMT.needs_cards.en} el={CMT.needs_cards.el} compact /></CardTitle>
      </CardHeader>
      <CardContent>
        <NeedCard
          card={card}
          compact
          showOwner={!card.isMine}
          actions={
            <Button size="sm" asChild>
              <Link href={`/commitments/${encodeURIComponent(card.id)}`}>
                <BilingualText
                  en={card.isMine ? `${CMT.responses.en} · ${card.interestCount ?? 0}` : card.myThreadId ? CMT.open_board.en : CMT.interest_title.en}
                  el={card.isMine ? `${CMT.responses.el} · ${card.interestCount ?? 0}` : card.myThreadId ? CMT.open_board.el : CMT.interest_title.el}
                  compact
                />
              </Link>
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}
