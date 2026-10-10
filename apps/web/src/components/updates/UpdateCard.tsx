'use client';

import type { ReactNode } from 'react';
import { updateMentionsMoney } from '@cofounderbay/shared';
import { BilingualText } from '@/components/common/BilingualText';
import { RelativeTime } from '@/components/common/RelativeTime';
import { NonGuaranteeNote } from '@/components/commitments/NonGuaranteeNote';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { initialsOf } from '@/lib/utils';
import { CardHead } from '@/components/common/CardAnatomy';

/**
 * One founder update: who, when, what moved, a few figures, what is needed.
 * Money in it brings the non-guarantee note, as everywhere else.
 */
export function UpdateCard({
  update,
  actions,
  highlight,
}: {
  update: {
    id?: string;
    author: { displayName: string; headline: string | null; avatarUrl: string | null };
    title: string;
    body: string;
    metrics: Array<{ label: string; value: string }>;
    asks: string[];
    visibility: 'followers' | 'public';
    createdAt: string;
  };
  actions?: ReactNode;
  highlight?: boolean;
}) {
  // The update's title is the card's title and the author is the line under
  // it, beside their avatar; the body, figures and asks read a notch under
  // both and start on the avatar's edge. The body and the figures used to
  // match or outrank the title.
  return (
    <article
      id={update.id ? `update-${update.id}` : undefined}
      data-card=""
      data-surface="card"
      className={highlight ? 'space-y-3 rounded-2xl border border-primary/40 bg-card p-4 sm:p-5' : 'space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5'}
      aria-labelledby={update.id ? `update-title-${update.id}` : undefined}
    >
      <CardHead
        mark={(
          <Avatar className="h-10 w-10" data-keep-icon="">
            {update.author.avatarUrl ? <AvatarImage src={update.author.avatarUrl} alt="" /> : null}
            <AvatarFallback className="bg-primary/15 text-xs text-foreground">{initialsOf(update.author.displayName)}</AvatarFallback>
          </Avatar>
        )}
        title={<span id={update.id ? `update-title-${update.id}` : undefined}>{update.title}</span>}
        subtitle={(
          <>
            <span className="font-medium text-foreground">{update.author.displayName}</span>
            {update.createdAt ? <> · <RelativeTime date={update.createdAt} /></> : null}
          </>
        )}
        meta={update.author.headline ?? undefined}
        aside={(
          <span className="rounded-full border border-border px-2 py-0.5 text-2xs text-muted-foreground">
            <BilingualText en={update.visibility === 'public' ? 'Public' : 'Followers'} el={update.visibility === 'public' ? 'Δημόσιο' : 'Ακόλουθοι'} compact />
          </span>
        )}
      />
      <p className="card-body whitespace-pre-line text-foreground">{update.body}</p>
      {update.metrics.length ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          {update.metrics.map((m, i) => (
            <div key={i} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{m.label}</dt>
              <dd className="card-body font-semibold tabular-nums text-foreground">{m.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {update.asks.length ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground"><BilingualText en="What would help" el="Τι θα βοηθούσε" compact /></p>
          <ul className="card-body mt-0.5 space-y-0.5 text-foreground">
            {update.asks.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {updateMentionsMoney(update) ? <NonGuaranteeNote /> : null}
      {actions ? <div className="flex flex-wrap gap-2 border-t border-border pt-3">{actions}</div> : null}
    </article>
  );
}
