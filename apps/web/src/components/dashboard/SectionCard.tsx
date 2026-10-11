import type { ElementType, ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BilingualText } from '@/components/common/BilingualText';
import { cn } from '@/lib/utils';

/**
 * A home-screen section: a bilingual title, at most one way out to the page
 * that holds the full list, and the rows.
 *
 * The role homes each wrote this header by hand, with an English-only title
 * and a ghost link whose wording, icon and spacing drifted from one page to
 * the next ("Pipeline ->", "All companies ->", "Manage >"). One header keeps
 * the title where the eye starts and the way out in the same corner of every
 * section on every home.
 */
export function SectionCard({
  title,
  titleEl,
  icon: Icon,
  action,
  children,
  className,
  contentClassName,
}: {
  title: string;
  titleEl?: string;
  icon?: ElementType;
  action?: { href: string; label: string; labelEl?: string };
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        {/* One row: the title wraps before the way out does. A ghost link
            that wrapped under the title started its own line with its
            padding in front of its letters, 12px off the card's axis
            (/dashboard/provider at 1440, "Recent reviews"). */}
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex min-w-0 flex-1 items-center gap-2">
            {Icon ? <Icon className="icon-sm shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
            <BilingualText en={title} el={titleEl} />
          </CardTitle>
          {action ? (
            // At most half the row: a long pair drops its second language
            // (compact) rather than squeezing the title.
            <Button variant="ghost" size="sm" className="-mr-2 min-w-0 max-w-[50%]" asChild>
              <Link href={action.href}>
                <BilingualText en={action.label} el={action.labelEl} compact />
                <ArrowRight className="ml-1 icon-sm shrink-0" aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className={cn('space-y-2', contentClassName)}>{children}</CardContent>
    </Card>
  );
}

export type QuickLink = { href: string; icon: ElementType; label: string; labelEl?: string };

/**
 * The pages of a role, as a list of links rather than a stack of full-width
 * outlined buttons: each row is the height of a text line, carries its own
 * icon, and reads as navigation to a screen reader.
 */
export function QuickLinks({ links, label, title = 'Go to', titleEl = 'Μετάβαση' }: { links: QuickLink[]; label: string; title?: string; titleEl?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>
          <BilingualText en={title} el={titleEl} />
        </CardTitle>
      </CardHeader>
      {/* Rows run to the card edge so the hover state is full-bleed; the row's
          own horizontal padding matches .card-comfortable, so the label still
          starts on the same inset as the title above it. */}
      <CardContent className="px-0 py-2">
        <nav aria-label={label} className="flex flex-col">
          {links.map(({ href, icon: Icon, label: text, labelEl }) => (
            <Link
              key={href}
              href={href}
              className="group flex min-h-10 items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-muted/60 focus-ring sm:px-6"
            >
              <Icon className="icon-sm shrink-0 text-muted-foreground group-hover:text-primary-accessible" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <BilingualText en={text} el={labelEl} />
              </span>
              <ChevronRight className="icon-sm shrink-0 text-muted-foreground/60" aria-hidden="true" />
            </Link>
          ))}
        </nav>
      </CardContent>
    </Card>
  );
}

/** An empty list's one line, on the card's left axis like the rows it stands in for. */
export function EmptyLine({ en, el }: { en: string; el?: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      <BilingualText en={en} el={el} stacked wrap />
    </p>
  );
}

/**
 * A row inside a section card, set like `CardHead`: a mark (a person's
 * circle, an organisation's rounded square, or nothing), the title with the
 * line under it, and one state, time or figure at the right - which drops
 * under the line on a phone unless `asideStays`. The row has no frame of its
 * own (`card-rows` draws the hairline between rows), and whatever it adds
 * under its head - a sentence, a bar, its actions - starts on the mark's left
 * edge, like the body of an Endorsements card.
 *
 * Its title sits a step under the section's own title (`text-sm
 * font-medium`, the Members row step): a row set on `.card-title` read as
 * loud as the section that holds it.
 */
export function RowHead({
  mark,
  title,
  subtitle,
  meta,
  aside,
  asideStays = false,
  titleAs: Title = 'p',
  className,
}: {
  mark?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  aside?: ReactNode;
  asideStays?: boolean;
  titleAs?: 'p' | 'h3' | 'h4';
  className?: string;
}) {
  const cols = mark
    ? asideStays && aside ? 'grid-cols-[auto_minmax(50%,1fr)_auto]' : 'grid-cols-[auto_minmax(0,1fr)] sm:grid-cols-[auto_minmax(50%,1fr)_auto]'
    : asideStays && aside ? 'grid-cols-[minmax(50%,1fr)_auto]' : 'grid-cols-[minmax(0,1fr)] sm:grid-cols-[minmax(50%,1fr)_auto]';
  const asidePlace = asideStays
    ? cn(mark ? 'col-start-3' : 'col-start-2', 'row-start-1 justify-end')
    : cn(mark ? 'col-start-2 sm:col-start-3' : 'col-start-1 sm:col-start-2', 'row-start-2 mt-1 sm:row-start-1 sm:mt-0 sm:justify-end');
  // `data-rail-keep-layout`: the page rail folds every `.grid` inside it to
  // one column, which stacked the mark over the title (Top Matches in the
  // founder's rail drew the avatar across the name).
  return (
    <div data-rail-keep-layout="" className={cn('grid grid-cols-1 items-start gap-x-3', cols, className)}>
      {mark ? <div className={cn('col-start-1 row-start-1 shrink-0', aside && !asideStays && 'row-span-2 sm:row-span-1')}>{mark}</div> : null}
      <div className={cn('min-w-0 row-start-1', mark ? 'col-start-2' : 'col-start-1')}>
        <Title className="break-words text-sm font-medium text-foreground">{title}</Title>
        {subtitle ? <div className="mt-0.5 break-words text-xs text-muted-foreground">{subtitle}</div> : null}
        {meta ? <div className="mt-0.5 text-xs text-muted-foreground">{meta}</div> : null}
      </div>
      {aside ? (
        <div className={cn('flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground', asidePlace)}>{aside}</div>
      ) : null}
    </div>
  );
}
