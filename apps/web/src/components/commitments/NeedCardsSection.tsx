'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { BilingualText } from '@/components/common/BilingualText';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageRail } from '@/components/layout/PageRailContext';
import { CMT } from '@/lib/i18n/strings-commitments';
import { bilingualInline } from '@/lib/i18n/format';
import {
  CHIP_KEYS,
  CHIP_LABEL,
  NO_CHIPS,
  activeChipCount,
  applyChips,
  chipSummary,
  type CardChips,
  type ChipKey,
} from '@/lib/need-card-wall';
import { cn } from '@/lib/utils';
import { NeedCard } from './NeedCard';
import { NeedCardAlertDialog } from './NeedCardAlertDialog';
import { useNeedCardWall } from './useNeedCardWall';

export { kindsForOpportunityType } from './useNeedCardWall';

const chipClass = (on: boolean) =>
  cn(
    'inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    on ? 'border-primary/40 bg-primary/10 text-foreground' : 'border-border bg-card text-foreground hover:bg-accent',
  );

/**
 * Other people's need cards, inside Opportunities, as a wall.
 *
 * Structured needs sit above the free-form listings and follow the page's
 * filters (type and remote in the rail, the search words). Four chips over
 * the wall narrow it further - category, place, stage, commitment - each
 * listing only choices that would show a card, with the count. Only cards
 * that still take interest appear, plus agreed ones for thirty days;
 * nothing here invites contact outside the ladder.
 */
export function NeedCardsSection({
  type,
  remoteOnly,
  search,
  chips: chipsProp,
  onChipsChange,
  alertOpen,
  onAlertOpenChange,
}: {
  type: string;
  remoteOnly: boolean;
  search: string;
  /** The chips, owned by the page so its assistant controls and the address bar share them. */
  chips?: CardChips;
  onChipsChange?: (chips: CardChips) => void;
  /** The "alert me" dialog, owned by the page so its assistant command can open it. */
  alertOpen?: boolean;
  onAlertOpenChange?: (open: boolean) => void;
}) {
  const [ownAlertOpen, setOwnAlertOpen] = useState(false);
  const isAlertOpen = alertOpen ?? ownAlertOpen;
  const setAlertOpen = onAlertOpenChange ?? setOwnAlertOpen;
  const [ownChips, setOwnChips] = useState<CardChips>(NO_CHIPS);
  const chips = chipsProp ?? ownChips;
  const setChips = onChipsChange ?? setOwnChips;
  const [openChip, setOpenChip] = useState<ChipKey | null>(null);
  const { openRailSection } = usePageRail();
  const wall = useNeedCardWall({ type, remoteOnly, search, chips });
  const { kinds, board, options, cards } = wall;
  if (!kinds || !wall.ready) return null;

  const active = activeChipCount(chips);
  const summary = chipSummary(chips);
  const choose = (key: ChipKey, value: string) => {
    setChips({ ...chips, [key]: value });
    setOpenChip(null);
  };

  return (
    <section aria-labelledby="need-cards-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 id="need-cards-heading" className="text-base font-semibold text-foreground">
            <BilingualText en={CMT.needs_cards.en} el={CMT.needs_cards.el} compact />
          </h2>
          <p className="text-xs text-muted-foreground"><BilingualText en={CMT.needs_cards_hint.en} el={CMT.needs_cards_hint.el} wrap /></p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => setAlertOpen(true)}>
            <BilingualText en="Alert me about new cards" el="Ειδοποίησέ με για νέες κάρτες" compact />
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/commitments/new"><BilingualText en={CMT.write_card.en} el={CMT.write_card.el} compact /></Link>
          </Button>
        </div>
      </div>
      <NeedCardAlertDialog open={isAlertOpen} onOpenChange={setAlertOpen} kinds={kinds} remoteOnly={remoteOnly} search={search} chips={chips} />

      <div className="space-y-2">
        <div role="group" aria-label={bilingualInline('Narrow the need cards', 'Περιορισμός των καρτών ανάγκης')} className="flex flex-wrap items-center gap-2">
          {CHIP_KEYS.map((key) => {
            const chosen = options[key].find((o) => o.value === chips[key]);
            return (
              <button
                key={key}
                type="button"
                className={chipClass(Boolean(chips[key]))}
                aria-expanded={openChip === key}
                aria-controls={`need-chip-${key}`}
                onClick={() => setOpenChip(openChip === key ? null : key)}
              >
                <span className="min-w-0 truncate">
                  <BilingualText
                    en={chips[key] ? `${CHIP_LABEL[key].en}: ${chosen?.en ?? chips[key]}` : CHIP_LABEL[key].en}
                    el={chips[key] ? `${CHIP_LABEL[key].el}: ${chosen?.el ?? chips[key]}` : CHIP_LABEL[key].el}
                    compact
                  />
                </span>
                <ChevronDown className={cn('icon-sm shrink-0 text-muted-foreground transition-transform', openChip === key && 'rotate-180')} aria-hidden="true" />
              </button>
            );
          })}
          {active > 0 ? (
            <button type="button" className={cn(chipClass(false), 'text-muted-foreground')} onClick={() => { setChips(NO_CHIPS); setOpenChip(null); }}>
              <X className="icon-sm shrink-0" aria-hidden="true" />
              <BilingualText en="Clear card filters" el="Καθαρισμός φίλτρων καρτών" compact />
            </button>
          ) : null}
        </div>

        {CHIP_KEYS.map((key) => (
          <div
            key={key}
            id={`need-chip-${key}`}
            role="group"
            aria-label={bilingualInline(CHIP_LABEL[key].en, CHIP_LABEL[key].el)}
            hidden={openChip !== key}
            // A display utility outranks the `hidden` attribute (same
            // specificity, later in the cascade), so the closed panel takes `hidden` as a class too.
            className={cn('flex-wrap gap-2 rounded-xl border border-border bg-card p-3', openChip === key ? 'flex' : 'hidden')}
          >
            <button type="button" aria-pressed={!chips[key]} className={chipClass(!chips[key])} onClick={() => choose(key, '')}>
              <BilingualText en="Any" el="Οποιοδήποτε" compact />
              <span className="text-xs tabular-nums text-muted-foreground">{applyChips(board, chips, key).length}</span>
            </button>
            {options[key].map((o) => (
              <button key={o.value} type="button" aria-pressed={chips[key] === o.value} className={chipClass(chips[key] === o.value)} onClick={() => choose(key, o.value)}>
                <span className="min-w-0 truncate"><BilingualText en={o.en} el={o.el} compact /></span>
                <span className="text-xs tabular-nums text-muted-foreground">{o.count}</span>
              </button>
            ))}
            {options[key].length === 0 ? (
              <p className="self-center text-xs text-muted-foreground">
                <BilingualText en="No card on the board names one yet." el="Καμία κάρτα δεν αναφέρει ακόμη κάτι εδώ." compact />
              </p>
            ) : null}
          </div>
        ))}

        {!wall.isLoading && !wall.isError && board.length > 0 ? (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            <BilingualText
              en={active ? `${cards.length} of ${board.length} cards` : `${board.length} ${board.length === 1 ? 'card' : 'cards'}`}
              el={active ? `${cards.length} από ${board.length} κάρτες` : `${board.length} ${board.length === 1 ? 'κάρτα' : 'κάρτες'}`}
              compact
            />
          </p>
        ) : null}
      </div>

      {wall.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-hidden="true">
          {[0, 1].map((i) => (
            <Card key={i}><CardContent className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-16 w-full" />
            </CardContent></Card>
          ))}
        </div>
      ) : wall.isError ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            <BilingualText en="The need cards could not be loaded." el="Δεν ήταν δυνατή η φόρτωση των καρτών ανάγκης." wrap />
          </p>
          <Button size="sm" variant="outline" onClick={() => wall.refetch()}>
            <BilingualText en="Try again" el="Δοκιμάστε ξανά" compact />
          </Button>
        </div>
      ) : cards.length === 0 ? (
        <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
          {summary && board.length > 0 ? (
            <>
              <p className="text-sm text-foreground">
                <BilingualText en={`No card fits ${summary.en}.`} el={`Καμία κάρτα δεν ταιριάζει σε ${summary.el}.`} wrap />
              </p>
              <Button size="sm" variant="outline" onClick={() => setChips(NO_CHIPS)}>
                <BilingualText en={`Show all ${board.length} cards`} el={`Εμφάνιση και των ${board.length} καρτών`} compact />
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground"><BilingualText en={CMT.empty_filtered.en} el={CMT.empty_filtered.el} wrap /></p>
              {type !== 'all' || remoteOnly ? (
                <Button size="sm" variant="outline" onClick={() => openRailSection('filters')}>
                  <BilingualText en="Show filters" el="Εμφάνιση φίλτρων" compact />
                </Button>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-label={bilingualInline(CMT.needs_cards.en, CMT.needs_cards.el)}>
          {cards.map((card) => (
            <li key={card.id} className="min-w-0">
              <Card className="h-full">
                <CardContent className="h-full">
                  <NeedCard
                    card={card}
                    compact
                    actions={
                      <Button size="sm" asChild>
                        <Link href={`/commitments/${encodeURIComponent(card.id)}`}>
                          <BilingualText
                            en={card.myThreadId ? CMT.open_board.en : CMT.interest_title.en}
                            el={card.myThreadId ? CMT.open_board.el : CMT.interest_title.el}
                            compact
                          />
                        </Link>
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
