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

function Field({ label, children }: { label: { en: string; el: string }; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">
        <BilingualText en={label.en} el={label.el} compact wrap />
      </dt>
      <dd className="mt-0.5 text-sm leading-relaxed text-foreground">{children}</dd>
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
 *
 * Anatomy (one left axis, five text styles and one pill):
 *   meta     kind · version as plain text, the outcome as the card's only pill
 *   title    semibold
 *   byline   avatar, name with the verified mark, headline under it (never cut)
 *   fields   caption label over body text: missing (and exists, goal), offer
 *   facts    one muted line, dot-separated (category, remote, place, stage, commitment)
 *   footer   above a hairline: the non-guarantee sentence, the page's footer, actions
 * A phone sets captions a full step under the body, so a label never reads
 * as the same size as its sentence.
 */
export function NeedCard({
  card,
  compact = false,
  showOwner = true,
  actions,
  footer,
  className,
  headingLevel = 3,
}: {
  card: NeedCardView;
  compact?: boolean;
  /** False where the reader is the author (their own list): the byline would only repeat them. */
  showOwner?: boolean;
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
  const version = card.version && card.version > 1 ? card.version : null;
  const owner = showOwner ? card.owner : undefined;

  return (
    <article data-need-card="" className={cn('space-y-4', className)}>
      <header className="space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 pt-0.5 text-xs text-muted-foreground">
            <BilingualText
              en={version ? `${kind.en} · ${CMT.version.en} ${version}` : kind.en}
              el={version ? `${kind.el} · ${CMT.version.el} ${version}` : kind.el}
              compact
              wrap
            />
          </p>
          {card.outcome ? <OutcomeChip outcome={card.outcome} reason={card.closedReason} /> : null}
        </div>
        <Heading className="text-base font-semibold leading-snug text-foreground">{card.title || '—'}</Heading>
        {owner ? (
          <div className="flex min-w-0 items-center gap-2.5 pt-1.5">
            <Avatar className="h-8 w-8" data-keep-icon="">
              <AvatarFallback className="bg-primary/15 text-2xs text-foreground">{initialsOf(owner.displayName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="flex min-w-0 items-center gap-1 text-sm font-medium text-foreground">
                <span className="min-w-0 truncate">{owner.displayName}</span>
                <VerifiedBadge methods={owner.verifiedMethods ?? []} variant="mark" />
              </p>
              {owner.headline ? <p className="text-xs text-muted-foreground">{owner.headline}</p> : null}
            </div>
          </div>
        ) : null}
      </header>

      <dl className="space-y-3">
        {compact ? null : (
          <>
            {card.exists ? <Field label={CMT.exists}>{card.exists}</Field> : null}
            {card.goal ? <Field label={CMT.goal}>{card.goal}</Field> : null}
          </>
        )}
        {card.missing ? <Field label={CMT.missing}>{card.missing}</Field> : null}
        <Field label={CMT.offer}>
          <span className="block font-medium">{card.offer?.role || '—'}</span>
          {offerLine.length ? <span className="block tabular-nums">{offerLine.join(' · ')}</span> : null}
          {!compact && card.offer.scope ? <span className="mt-1 block">{card.offer.scope}</span> : null}
        </Field>
        {!compact && evidence.length ? (
          <Field label={CMT.evidence}>
            <ul className="facts-dotted flex flex-wrap gap-x-2">
              {evidence.map((pair) => (
                <li key={pair.en}><BilingualText en={pair.en} el={pair.el} compact /></li>
              ))}
            </ul>
          </Field>
        ) : null}
      </dl>

      <ul aria-label={`${CMT.filters.en} · ${CMT.filters.el}`} className="facts-dotted flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        {card.category ? <li>{card.category}</li> : null}
        {card.isRemote ? <li><BilingualText en={CMT.remote.en} el={CMT.remote.el} compact /></li> : null}
        {card.place ? <li>{card.place}</li> : null}
        {card.stage ? <li><StatusText value={card.stage} /></li> : null}
        {card.commitment ? <li><StatusText value={card.commitment} /></li> : null}
      </ul>

      {showsMoney || footer || actions ? (
        <footer className="space-y-3 border-t border-border pt-3">
          {showsMoney ? <NonGuaranteeNote /> : null}
          {footer}
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </footer>
      ) : null}
    </article>
  );
}
