import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The head of a card, set the way the Endorsements, Connections and
 * Opportunities cards set it: a mark (a person's circle, an organisation's
 * rounded square), and beside it the title with the line under it. A state
 * or a time sits at the right of the head and never wraps under it.
 *
 * Everything under the head starts on the mark's left edge - the card's own
 * padding - never indented under the title, so a card has one left axis
 * (`.probes/card_audit.mjs` measures it). Sizes come from the card ladder in
 * globals.css: `.card-title` over `.card-subtitle`, and the body a notch
 * under both (`.card-body`).
 */
export function CardHead({
  mark,
  title,
  subtitle,
  meta,
  aside,
  asideStays = false,
  asideClassName,
  titleAs: Title = 'h3',
  titleClassName,
  className,
}: {
  /** An Avatar (h-10 w-10; people round, organisations rounded-xl), or nothing. */
  mark?: ReactNode;
  title: ReactNode;
  /** The line under the title: headline, firm, organiser, kind. */
  subtitle?: ReactNode;
  /** A caption line under the subtitle (relationship, place, a count). */
  meta?: ReactNode;
  /** A state pill, a time or a control at the right of the head. On a phone
   * it moves under the subtitle, on the title's edge, so it never squeezes
   * the title into a narrow column. */
  aside?: ReactNode;
  /** Keep the aside at the right on a phone too (an icon button, a menu). */
  asideStays?: boolean;
  /** Classes for the aside's box (`hidden sm:flex` when a phone shows the
   * same controls elsewhere). */
  asideClassName?: string;
  titleAs?: 'h2' | 'h3' | 'h4' | 'p';
  titleClassName?: string;
  className?: string;
}) {
  // The title's column keeps at least half the head: an aside of two pills
  // in a narrow card once left the title a 10px column.
  const cols = mark
    ? asideStays && aside ? 'grid-cols-[auto_minmax(50%,1fr)_auto]' : 'grid-cols-[auto_minmax(0,1fr)] sm:grid-cols-[auto_minmax(50%,1fr)_auto]'
    : asideStays && aside ? 'grid-cols-[minmax(50%,1fr)_auto]' : 'grid-cols-[minmax(0,1fr)] sm:grid-cols-[minmax(50%,1fr)_auto]';
  const asidePlace = asideStays
    ? cn(mark ? 'col-start-3' : 'col-start-2', 'row-start-1')
    : cn(mark ? 'col-start-2 sm:col-start-3' : 'col-start-1 sm:col-start-2', 'row-start-2 mt-1.5 sm:row-start-1 sm:mt-0 sm:pt-0.5');
  return (
    // `data-rail-keep-layout`: the page rail folds every `.grid` inside it
    // to one column, which would stack the mark over the title.
    <div data-rail-keep-layout="" className={cn('grid grid-cols-1 items-start gap-x-3', cols, className)}>
      {mark ? <div className={cn('col-start-1 row-start-1 shrink-0', aside && !asideStays && 'row-span-2 sm:row-span-1')}>{mark}</div> : null}
      <div className={cn('min-w-0 row-start-1', mark ? 'col-start-2' : 'col-start-1')}>
        <Title className={cn('card-title break-words text-foreground', titleClassName)}>{title}</Title>
        {subtitle ? <div className="card-subtitle mt-0.5 break-words">{subtitle}</div> : null}
        {meta ? <div className="mt-0.5 text-xs text-muted-foreground">{meta}</div> : null}
      </div>
      {aside ? (
        <div className={cn('flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground sm:justify-end', asidePlace, asideStays && 'justify-end pt-0.5', asideClassName)}>{aside}</div>
      ) : null}
    </div>
  );
}

/**
 * The foot of a card, above a hairline: a caption at the left (a date, a
 * count, a note) and the card's actions at the right; without a caption the
 * actions start on the card's axis. On a phone they wrap under the caption
 * and start on the axis too.
 */
export function CardFoot({
  meta,
  children,
  className,
}: {
  meta?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  if (!meta && !children) return null;
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border pt-3', className)}>
      {meta ? <div className="min-w-0 text-xs text-muted-foreground">{meta}</div> : null}
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
