'use client';

import type { ReactNode } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

/**
 * The top of a profile, read the way a professional profile is read: a quiet
 * cover band, the person's photo over it, then name, how they are verified,
 * what they do, where they are, what they are open to, and what you can do
 * next - in that order and in one place. One component for one's own profile
 * and for anyone else's, so both read alike.
 *
 * Our own rules apply, not the source's: the cover is a calm tint and never
 * an image wall, "Open to" is a line and never a frame on the photo, the
 * photo is a circle because people are circles, and the type is the
 * product's ladder (name `text-xl`/`md:text-2xl`, headline `text-base`, the
 * rest `text-sm`).
 *
 * An organisation's page (`/org/[slug]`) reads the same way, the way a
 * company page does: `shape="organisation"` draws the logo as a rounded
 * square, because organisations are rounded squares (AGENTS.md).
 */
export function ProfileHero({
  name,
  avatarUrl,
  avatarMark,
  nameBadge,
  headline,
  meta,
  openTo,
  aside,
  actions,
  className,
  headingLevel = 'h2',
  shape = 'person',
  ariaLabel,
}: {
  name: string;
  avatarUrl?: string | null;
  /** Drawn over the photo's corner (the verified check on one's own profile). */
  avatarMark?: ReactNode;
  /** Beside the name: the Verified badge. */
  nameBadge?: ReactNode;
  /** The headline, or a prompt to write one. */
  headline?: ReactNode;
  /** Short facts on one wrapping line: place, time zone, languages, joined. */
  meta?: ReactNode[];
  /** The "Open to" line (someone else's) or setting (one's own). */
  openTo?: ReactNode;
  /** Role and similar marks, beside the text on wide screens. */
  aside?: ReactNode;
  /** What the reader can do: connect, message, follow, edit, share. */
  actions?: ReactNode;
  className?: string;
  /** A standalone page (the public /p/ profile) names the person in its h1. */
  headingLevel?: 'h1' | 'h2';
  /** People are circles; organisations, startups and programmes are rounded squares. */
  shape?: 'person' | 'organisation';
  /** The region's name; defaults to "<name> · Profile · Προφίλ". */
  ariaLabel?: string;
}) {
  const Heading = headingLevel;
  const facts = (meta ?? []).filter(Boolean);
  return (
    <section aria-label={ariaLabel ?? `${name} · Profile · Προφίλ`} className={cn('relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm', className)}>
      <div className="h-20 w-full bg-primary/[0.05] sm:h-24 md:h-28" aria-hidden="true" />
      <div className="relative px-5 pb-5 sm:px-6 sm:pb-6">
        <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 md:-mt-16">
          <div className="relative inline-block self-start">
            <Avatar className={cn('h-24 w-24 ring-4 ring-background sm:h-28 sm:w-28 md:h-32 md:w-32', shape === 'organisation' && 'rounded-2xl')}>
              <AvatarImage src={avatarUrl ?? undefined} alt="" className={shape === 'organisation' ? 'rounded-2xl' : undefined} />
              <AvatarFallback className={cn('bg-primary/10 text-3xl font-semibold text-primary-accessible', shape === 'organisation' && 'rounded-2xl')} data-keep-icon="">
                {name?.[0]?.toUpperCase() ?? '?'}
              </AvatarFallback>
            </Avatar>
            {avatarMark}
          </div>

          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-1.5">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Heading className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">{name}</Heading>
                {nameBadge}
              </div>
              {headline ? <div className="text-base text-muted-foreground">{headline}</div> : null}
              {facts.length ? (
                <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-sm text-muted-foreground">
                  {facts.map((fact, i) => (
                    <li key={i} className="flex min-w-0 items-center gap-1.5">{fact}</li>
                  ))}
                </ul>
              ) : null}
              {openTo ? <div className="pt-1">{openTo}</div> : null}
            </div>
            {aside ? <div className="flex shrink-0 flex-wrap items-center gap-2">{aside}</div> : null}
          </div>

          {actions ? <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">{actions}</div> : null}
        </div>
      </div>
    </section>
  );
}
