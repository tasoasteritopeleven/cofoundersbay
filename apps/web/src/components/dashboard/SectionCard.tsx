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
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <CardTitle className="flex min-w-0 items-center gap-2 text-base">
            {Icon ? <Icon className="icon-sm shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
            <BilingualText en={title} el={titleEl} />
          </CardTitle>
          {action ? (
            <Button variant="ghost" size="sm" className="-mr-2 shrink-0" asChild>
              <Link href={action.href}>
                <BilingualText en={action.label} el={action.labelEl} />
                <ArrowRight className="ml-1 icon-sm" aria-hidden="true" />
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
        <CardTitle className="text-base">
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

/** What a section says when it has no rows: one quiet, centred line in both languages. */
/** An empty list's one line, on the card's left axis like the rows it stands in for. */
export function EmptyLine({ en, el }: { en: string; el?: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      <BilingualText en={en} el={el} stacked wrap />
    </p>
  );
}
