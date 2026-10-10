'use client';

import { cn } from '@/lib/utils';
import {
  resolveBilingualPair,
  useLanguagePreference,
} from '@/lib/i18n/LanguagePreferenceContext';

type BilingualTextProps = {
  en: string;
  el?: string | null;
  className?: string;
  /** Smaller secondary line instead of inline separator (sidebar labels). */
  stacked?: boolean;
  /** Single-line inline with truncation — for tight containers (mode switcher). */
  compact?: boolean;
  /**
   * Let the text wrap instead of truncating.
   *
   * Truncation is right for the sidebar, where the column width is fixed and a
   * clipped label is recoverable by expanding the rail. It is wrong in a stat
   * card, where the column is ~88px on a phone and there is nothing to expand —
   * "Κορυφαίες αντιστοιχίσεις" simply lost a third of itself. Wrapping to a
   * second line costs a few pixels of height and keeps the whole word.
   *
   * It used to be honoured by `stacked` alone, which left the variant that stat
   * cards actually use — `compact` — unable to opt out of truncating, the exact
   * case the paragraph above describes. All three variants honour it now;
   * `false` remains the default, so nothing that did not ask changes.
   */
  wrap?: boolean;
  /**
   * Keep the second language on phones. Off by default so a phone shows one
   * language everywhere — mixing "one language here, two there" on the same
   * screen reads as noise, and the second line is what pushed stat-card labels
   * past their column.
   *
   * The mobile bottom nav opts in: its labels are short, each tab owns a fixed
   * cell, and the two-line label is the design rather than an overflow risk.
   */
  keepSecondaryOnMobile?: boolean;
  /**
   * Width from which the *inline* second language appears.
   *
   * `'sm'` (default) is the product-wide phone rule. `'lg'` is for chrome that
   * is already at capacity on a tablet -- the top bar's demo chips, whose two
   * languages pushed the header 154px past an 834px viewport. Both variants
   * keep the primary line, which is the reader's chosen language.
   */
  secondaryFrom?: 'sm' | 'lg';
  primaryClassName?: string;
  secondaryClassName?: string;
};

/**
 * Renders primary language + optional secondary (user preference).
 * English is never removed from the codebase; secondary visibility follows `cfb:language-display`.
 *
 * Narrow viewports drop the secondary language for the two *inline* variants
 * (see `.bilingual-secondary--inline` in globals.css). Putting both languages on
 * one line roughly doubles every string, and at 360px that was measured pushing
 * labels past 90% clipped — milestone titles rendered as a single letter, and
 * "Open tracker · Άνοιγμα παρακολούθησης" ran 179px beyond the viewport.
 *
 * Nothing is lost: the primary line is already the language the reader chose, and
 * the top-bar switcher changes it. The `stacked` variant keeps both lines, because
 * it was built for two lines and fits — the mobile bottom nav depends on it.
 */
export function BilingualText({
  en,
  el,
  className,
  stacked = false,
  compact = false,
  wrap = false,
  keepSecondaryOnMobile = false,
  secondaryFrom = 'sm',
  primaryClassName,
  secondaryClassName,
}: BilingualTextProps) {
  const { primary, showSecondary } = useLanguagePreference();
  const resolved = resolveBilingualPair(en, el, primary, showSecondary);
  // Marks a span whose Greek this component supplies itself. Under the Greek
  // locale the DOM pass (DomI18n) must leave it alone: before the page subtree
  // hydrates, the span still holds the server's English, and translating it
  // in place made React find "Ρυθμίσεις" where it rendered "Settings" — a
  // hydration failure on /settings and a full client re-render. The pair needs
  // no help: React renders the Greek the moment the preference applies. A span
  // with no Greek half stays unmarked, so the pass still translates it, and a
  // third locale ignores the mark (Spanish reads the English, translated).
  const pairMark = el && el.trim() && el !== en ? { 'data-bilingual-pair': '' } : undefined;
  // Written out in full, never assembled from parts: these live in
  // `@layer utilities` in globals.css, and Tailwind tree-shakes a custom
  // utility whose class name it cannot find literally in the source. A
  // template string here silently deleted the rule from the built stylesheet.
  const { secondary: secondaryNarrow, separator: separatorNarrow } =
    secondaryFrom === 'lg'
      ? { secondary: 'bilingual-secondary--chrome', separator: 'bilingual-separator--chrome' }
      : { secondary: 'bilingual-secondary--inline', separator: 'bilingual-separator--inline' };
  const hideOnMobile = keepSecondaryOnMobile ? '' : secondaryNarrow;

  if (!resolved.secondaryText) {
    return (
      <span
        lang={resolved.primaryLang}
        {...pairMark}
        className={cn(className, primaryClassName, compact && (wrap ? 'break-words' : 'truncate'))}
      >
        {resolved.primaryText}
      </span>
    );
  }

  if (compact) {
    const separatorClassName = cn('bilingual-separator shrink-0', separatorNarrow);
    if (wrap) {
      return (
        <span className={cn('inline-flex min-w-0 max-w-full flex-wrap items-baseline gap-0.5', className)}>
          <span lang={resolved.primaryLang}
          {...pairMark} className={cn('break-words', primaryClassName)}>
            {resolved.primaryText}
            {/* Inside the first language's span, so a wrapped pair never leaves the dot on a line of its own. */}
            <span className={cn(separatorClassName, 'ml-0.5')} aria-hidden="true">
              ·
            </span>
          </span>
          <span
            lang={resolved.secondaryLang ?? undefined}
            className={cn('bilingual-secondary text-muted-foreground break-words', secondaryNarrow, secondaryClassName)}
          >
            {resolved.secondaryText}
          </span>
        </span>
      );
    }
    /*
     * One line, and the reader's language is never the half that is cut.
     *
     * This used to truncate the pair as a unit: in a 312px card "Link
     * Unavailable · Ο σύνδεσμος…" became "Link Unav… · Ο σύνδεσμος δεν είναι …",
     * and where the parent did not constrain width (a button in a card, a
     * line in a flex column) the pair ran past its surface instead — 13
     * labels across 160 routes, up to 182px outside their box.
     *
     * The pair is now a wrapping row clipped to one line box. When both
     * halves fit, both show, exactly as before. When they do not, the second
     * language (with its dot) drops to the clipped second line and the first
     * stays whole; only a first half that alone exceeds the width still
     * ellipsises. Its min-content is now the first half, so a shrink-to-fit
     * parent (a button) sizes to its surface instead of escaping it.
     */
    return (
      <span
        className={cn(
          'inline-flex min-w-0 max-w-full flex-wrap items-baseline overflow-hidden max-h-[calc(1lh+2px)]',
          className,
        )}
      >
        <span lang={resolved.primaryLang}
        {...pairMark} className={cn('min-w-0 max-w-full truncate', primaryClassName)}>
          {resolved.primaryText}
        </span>
        <span
          lang={resolved.secondaryLang ?? undefined}
          // Breakable anywhere so it adds nothing to the pair's min-content:
          // a nowrap second half held a 203px card open at 237px. Whether it
          // shares the first line is still decided by its one-line width.
          className={cn(
            'bilingual-secondary text-muted-foreground min-w-0 [overflow-wrap:anywhere]',
            secondaryNarrow,
            secondaryClassName,
          )}
        >
          <span className={cn(separatorClassName, 'mx-0.5')} aria-hidden="true">
            ·
          </span>
          {resolved.secondaryText}
        </span>
      </span>
    );
  }

  if (stacked) {
    return (
      <span className={cn('flex min-w-0 flex-col', wrap ? 'overflow-visible' : 'overflow-hidden', className)}>
        {/* leading-tight, not leading-none: leading-none clips Greek diacritics
            on capitals (Ά, Έ, Ό) and Latin descenders. A wrapping line opens
            to leading-snug: at 1.25 two wrapped lines read as one block. */}
        <span
          lang={resolved.primaryLang}
        {...pairMark}
          className={cn(wrap ? 'break-words leading-snug' : 'truncate leading-tight', primaryClassName)}
        >
          {resolved.primaryText}
        </span>
        <span
          lang={resolved.secondaryLang ?? undefined}
          className={cn(
            'bilingual-secondary text-muted-foreground',
            hideOnMobile,
            wrap ? 'break-words' : 'truncate',
            secondaryClassName,
          )}
        >
          {resolved.secondaryText}
        </span>
      </span>
    );
  }

  return (
    <span className={cn('min-w-0', className)}>
      <span lang={resolved.primaryLang}
        {...pairMark} className={primaryClassName}>
        {resolved.primaryText}
      </span>
      <span className={cn('bilingual-separator mx-1.5', separatorNarrow)} aria-hidden="true">
        ·
      </span>
      <span
        lang={resolved.secondaryLang ?? undefined}
        className={cn(
          'bilingual-secondary text-muted-foreground',
          secondaryNarrow,
          secondaryClassName,
        )}
      >
        {resolved.secondaryText}
      </span>
    </span>
  );
}

