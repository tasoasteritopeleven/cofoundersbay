'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { bilingualAria } from '@/lib/i18n/format';
import { BilingualText } from '@/components/common/BilingualText';
import { CfbGlyph } from '@/components/icons/CfbGlyph';

/**
 * Contextual help block. Each page passes a unique `id` so dismissed state
 * is remembered per page in localStorage. Users can reopen via the pill button.
 *
 * The heading is bilingual like the rest of the chrome, but the body is not:
 * `children` arrives already resolved to one language. Two paragraphs rendered
 * as `English · Ελληνικά` would read as one long run-on — the inline pairing
 * that works for a label does not scale to prose.
 */
export function HelpCallout({
  id,
  title,
  titleEl,
  children,
  badge,
  defaultOpen = false,
  compact = false,
  className,
  titleClassName,
}: {
  id: string;
  title: string;
  /** Greek heading; falls back to the English one when absent. */
  titleEl?: string;
  children: ReactNode;
  badge?: string;
  defaultOpen?: boolean;
  /** Icon-only trigger when the callout is collapsed (for tight headers). */
  compact?: boolean;
  className?: string;
  /** Size/weight for the help title only (trigger label + popover heading). */
  titleClassName?: string;
}) {
  const storageKey = `cfb.help.${id}`;
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(storageKey);
    if (saved === 'closed') setOpen(false);
    if (saved === 'open') setOpen(true);
  }, [storageKey]);

  const persist = (next: boolean) => {
    setOpen(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, next ? 'open' : 'closed');
    }
  };

  const trigger = (
    <button
      type="button"
      onClick={() => persist(!open)}
      aria-expanded={open}
      aria-label={bilingualAria(title, titleEl)}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary-accessible transition-colors hover:bg-primary/10',
        compact && 'h-11 w-11 justify-center p-0 md:h-9 md:w-9 lg:h-[calc(36px*var(--chrome-y))] lg:w-[36px]',
      )}
    >
      <CfbGlyph name="book" className="icon-sm text-primary" />
      <span className={cn(compact && 'sr-only', titleClassName)}>
        <BilingualText en={title} el={titleEl} compact />
      </span>
    </button>
  );

  const body = (
    <div className="space-y-1.5 text-muted-foreground [&_a]:text-primary-accessible [&_a]:underline-offset-2 [&_a:hover]:underline [&_strong]:font-semibold [&_strong]:text-foreground">
      {children}
    </div>
  );

  if (compact) {
    return (
      <div className={cn('relative', className)}>
        {trigger}
        {open && (
          <div
            role="note"
            aria-label={bilingualAria(title, titleEl)}
            className="absolute right-0 top-full z-50 mt-2 w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-border bg-background p-4 text-sm leading-relaxed shadow-lg"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold text-primary-accessible">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15">
                  <CfbGlyph name="book" className="icon-sm text-primary" />
                </span>
                <BilingualText en={title} el={titleEl} className={titleClassName} />
                {badge && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary-accessible">
                    {badge}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => persist(false)}
                aria-label={bilingualAria('Dismiss help', 'Απόρριψη βοήθειας')}
                className="rounded-xl p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="icon-sm" aria-hidden="true" />
              </button>
            </div>
            {body}
          </div>
        )}
      </div>
    );
  }

  if (!open) {
    return <div className={className}>{trigger}</div>;
  }

  return (
    <div
      role="note"
      aria-label={bilingualAria(title, titleEl)}
      className={cn(
        'rounded-2xl border border-primary/20 bg-primary/[0.03] p-4 text-sm leading-relaxed shadow-sm',
        className,
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-primary-accessible">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15">
            <CfbGlyph name="book" className="icon-sm text-primary" />
          </span>
          <BilingualText en={title} el={titleEl} className={titleClassName} />
          {badge && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary-accessible">
              {badge}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => persist(false)}
          aria-label={bilingualAria('Dismiss help', 'Απόρριψη βοήθειας')}
          className="rounded-xl p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          {/* Decorative: the button already carries its name via aria-label. */}
          <X className="icon-sm" aria-hidden="true" />
        </button>
      </div>
      {/* One column, the full width of the banner.
          
          This replaced both a 90ch measure that left 413px of empty banner
          beside it and the two- and three-column split that filled that space
          by folding the text. Columns were the wrong trade here: a notice of
          two short paragraphs does not need a fold, and the fold cost the
          reader a vertical jump back to the top for the second column.

          Across the full width each of those paragraphs sets on a single line,
          so the block is shorter than either earlier version — which is the
          point of a dismissible notice that pushes the page down. The measure
          is long at 1440px and above, and that is the accepted cost: it applies
          to two lines of supporting text, read once and then dismissed, not to
          body copy anyone reads at length.

          The body starts on the callout's own left edge, like the body of
          every card under its head: on the book mark's edge where the mark
          shows, on the title's where the page body hides decorative glyphs
          (globals.css "Decorative icons"). The old `pl-9` hung it 36px in
          from a title that, with its glyph hidden, started at the edge. */}
      {body}
    </div>
  );
}
