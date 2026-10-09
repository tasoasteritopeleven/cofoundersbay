'use client';

import type { ReactNode } from 'react';
import { updateMentionsMoney } from '@cofounderbay/shared';
import { BilingualText } from '@/components/common/BilingualText';
import { RelativeTime } from '@/components/common/RelativeTime';
import { NonGuaranteeNote } from '@/components/commitments/NonGuaranteeNote';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { initialsOf } from '@/lib/utils';

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
  return (
    <article
      id={update.id ? `update-${update.id}` : undefined}
      data-card=""
      data-surface="card"
      className={highlight ? 'space-y-3 rounded-2xl border border-primary/40 bg-card p-4 sm:p-5' : 'space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5'}
      aria-labelledby={update.id ? `update-title-${update.id}` : undefined}
    >
      <header className="flex items-center gap-3">
        <Avatar className="h-9 w-9" data-keep-icon="">
          {update.author.avatarUrl ? <AvatarImage src={update.author.avatarUrl} alt="" /> : null}
          <AvatarFallback className="bg-primary/15 text-xs text-foreground">{initialsOf(update.author.displayName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{update.author.displayName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {update.createdAt ? <RelativeTime date={update.createdAt} /> : null}
            {update.author.headline ? <> · {update.author.headline}</> : null}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-2xs text-muted-foreground">
          <BilingualText en={update.visibility === 'public' ? 'Public' : 'Followers'} el={update.visibility === 'public' ? 'Δημόσιο' : 'Ακόλουθοι'} compact />
        </span>
      </header>
      <h3 id={update.id ? `update-title-${update.id}` : undefined} className="text-base font-semibold text-foreground">{update.title}</h3>
      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{update.body}</p>
      {update.metrics.length ? (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {update.metrics.map((m, i) => (
            <div key={i} className="rounded-xl border border-border px-3 py-2">
              <dt className="text-xs text-muted-foreground">{m.label}</dt>
              <dd className="text-base font-semibold tabular-nums text-foreground">{m.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {update.asks.length ? (
        <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-3">
          <p className="text-xs font-medium text-foreground"><BilingualText en="What would help" el="Τι θα βοηθούσε" compact /></p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-foreground">
            {update.asks.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {updateMentionsMoney(update) ? <NonGuaranteeNote /> : null}
      {actions ? <div className="flex flex-wrap gap-2 pt-1">{actions}</div> : null}
    </article>
  );
}
