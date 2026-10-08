'use client';

import type { ReactNode } from 'react';
import type { VerificationMethod } from '@cofounderbay/shared';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { BilingualText } from '@/components/common/BilingualText';
import { StatusText } from '@/components/common/StatusText';
import { CMT, evidenceCopy, kindCopy } from '@/lib/i18n/strings-commitments';
import { cn, initialsOf } from '@/lib/utils';
import { NonGuaranteeNote } from './NonGuaranteeNote';
import { OutcomeChip } from './OutcomeChip';
import { VerifiedBadge } from './VerifiedBadge';

/** What a need card needs to render: the API's card, the public card, or the guide's live draft. */
export type NeedCardView = {
  kind: string;
  title: string;
  exists: string;
  goal: string;
  missing: string;
  offer: { role: string; equity: string | null; hoursPerWeek: number; scope: string };
  category: string;
  place: string | null;
  isRemote: boolean;
  stage: string;
  commitment: string;
  evidence?: Array<{ id: string; count?: number; value?: boolean }>;
  version?: number;
  outcome?: 'open' | 'in_discussion' | 'agreed' | 'closed';
  closedReason?: string | null;
  owner?: { displayName: string; headline: string | null; verifiedMethods?: readonly VerificationMethod[] };
};

function Sentence({ label, text }: { label: { en: string; el: string }; text: string }) {
  if (!text) return null;
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium text-muted-foreground">
        <BilingualText en={label.en} el={label.el} compact wrap />
      </dt>
      <dd className="text-sm leading-relaxed text-foreground">{text}</dd>
    </div>
  );
}

/**
 * A need card: three sentences and an offer, readable on one phone screen.
 *
 * The same component renders the card on its board, in lists (`compact`),
 * on the public link and as the posting guide's live preview, so what an
 * author previews is exactly what a reader sees. Equity and funding words
 * always come with the non-guarantee sentence.
 */
export function NeedCard({
  card,
  compact = false,
  actions,
  footer,
  className,
  headingLevel = 3,
}: {
  card: NeedCardView;
  compact?: boolean;
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
  headingLevel?: 1 | 2 | 3;
}) {
  const kind = kindCopy(card.kind);
  const Heading = headingLevel === 1 ? 'h1' : headingLevel === 2 ? 'h2' : 'h3';
  const evidence = (card.evidence ?? []).map(evidenceCopy).filter((pair): pair is { en: string; el: string } => Boolean(pair));
  const showsMoney = Boolean(card.offer.equity) || card.kind === 'investor_intro';
  const offerLine = [
    card.offer.equity ? card.offer.equity : null,
    card.offer.hoursPerWeek ? `${card.offer.hoursPerWeek} ${CMT.per_week.en}` : null,
  ].filter(Boolean);

  return (
    <article data-need-card="" className={cn('space-y-4', className)}>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="chip rounded-full bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground">
            <BilingualText en={kind.en} el={kind.el} compact />
          </span>
          {card.outcome ? <OutcomeChip outcome={card.outcome} reason={card.closedReason} /> : null}
          {card.version && card.version > 1 ? (
            <span className="text-2xs text-muted-foreground tabular-nums">
              <BilingualText en={`${CMT.version.en} ${card.version}`} el={`${CMT.version.el} ${card.version}`} compact />
            </span>
          ) : null}
        </div>
        <Heading className={cn('font-semibold leading-snug text-foreground', compact ? 'text-base' : 'text-lg')}>{card.title || '—'}</Heading>
        {card.owner ? (
          <div className="flex min-w-0 items-center gap-2">
            <Avatar className="h-6 w-6" data-keep-icon="">
              <AvatarFallback className="bg-primary/15 text-2xs text-foreground">{initialsOf(card.owner.displayName)}</AvatarFallback>
            </Avatar>
            <p className="min-w-0 truncate text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{card.owner.displayName}</span>
              {card.owner.headline ? ` · ${card.owner.headline}` : ''}
            </p>
            <VerifiedBadge methods={card.owner?.verifiedMethods ?? []} />
          </div>
        ) : null}
      </header>

      <dl className="space-y-2.5">
        {compact ? (
          <Sentence label={CMT.missing} text={card.missing} />
        ) : (
          <>
            <Sentence label={CMT.exists} text={card.exists} />
            <Sentence label={CMT.goal} text={card.goal} />
            <Sentence label={CMT.missing} text={card.missing} />
          </>
        )}
      </dl>

      {/* The offer reads by its label, on the card's axis: a box around it
          inset the text 13px off the title and added a second frame. */}
      <section aria-label={`${CMT.offer.en} · ${CMT.offer.el}`} className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">
          <BilingualText en={CMT.offer.en} el={CMT.offer.el} compact />
        </p>
        <p className="text-sm font-semibold text-foreground">{card.offer?.role || '—'}</p>
        {offerLine.length ? <p className="text-sm tabular-nums text-foreground">{offerLine.join(' · ')}</p> : null}
        {!compact && card.offer.scope ? <p className="text-sm leading-relaxed text-muted-foreground">{card.offer.scope}</p> : null}
      </section>

      <ul aria-label={`${CMT.filters.en} · ${CMT.filters.el}`} className="flex flex-wrap gap-1.5">
        {card.category ? <li className="chip rounded-full border border-border px-2 py-0.5 text-2xs text-foreground">{card.category}</li> : null}
        {card.isRemote ? (
          <li className="chip rounded-full border border-border px-2 py-0.5 text-2xs text-foreground"><BilingualText en={CMT.remote.en} el={CMT.remote.el} compact /></li>
        ) : null}
        {card.place ? <li className="chip rounded-full border border-border px-2 py-0.5 text-2xs text-foreground">{card.place}</li> : null}
        {card.stage ? <li className="chip rounded-full border border-border px-2 py-0.5 text-2xs text-foreground"><StatusText value={card.stage} /></li> : null}
        {card.commitment ? <li className="chip rounded-full border border-border px-2 py-0.5 text-2xs text-foreground"><StatusText value={card.commitment} /></li> : null}
      </ul>

      {!compact && evidence.length ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground"><BilingualText en={CMT.evidence.en} el={CMT.evidence.el} compact /></p>
          <ul className="flex flex-wrap gap-1.5">
            {evidence.map((pair) => (
              <li key={pair.en} className="chip rounded-full bg-status-success-bg px-2 py-0.5 text-2xs text-status-success">
                <BilingualText en={pair.en} el={pair.el} compact />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showsMoney ? <NonGuaranteeNote /> : null}
      {footer}
      {actions ? <div className="flex flex-wrap items-center gap-2 pt-1">{actions}</div> : null}
    </article>
  );
}
