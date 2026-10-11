'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { formatRelativeTime, relativeTimeLabel } from '@/lib/utils';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';

/**
 * Hydration-stable wrapper for anything formatted relative to "now".
 *
 * React #418 haunted every page that rendered a relative timestamp: the
 * server formats "2 minutes ago" at render time, the client re-formats it at
 * hydration time, and when the clock crosses a minute boundary between those
 * two instants the text differs and React regenerates the subtree. Tracked in
 * `e2e/authenticated-a11y.spec.ts` as known debt, with the fix prescribed
 * there: route the renders through one component that emits a stable value on
 * the server and upgrades after mount. This is that component.
 *
 * How it stays stable: `useSyncExternalStore` returns the server snapshot
 * (`false`) during server render *and* during hydration, so both sides render
 * the same deterministic absolute date and the DOM matches. Immediately after
 * hydration the store reads `true` and the component re-renders with the
 * site's own relative wording — same words as before, one frame later, zero
 * mismatch.
 *
 * Call sites keep their formatter and hand it over instead of calling it:
 *
 *   {formatTimeAgo(item.createdAt)}                             // before
 *   <RelativeTime date={item.createdAt} format={formatTimeAgo} /> // after
 */

const emptySubscribe = () => () => {};

/**
 * `false` on the server and through hydration, `true` one frame later.
 *
 * Exported so anything else that has to read the clock during render uses the
 * same primitive rather than inventing a second one: a presence dot derived
 * from `lastSeenAt`, for instance, is the same hazard as a relative timestamp.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

/**
 * Deterministic on both sides of hydration: fixed locale, fixed UTC zone.
 * Shown for a single frame, so it favours being unambiguous over being in
 * the reader's language — "16 Sep" reads in both of the product's languages.
 */
function stableAbsolute(d: Date): string {
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

type DateInput = string | number | Date;

export function RelativeTime<T extends DateInput>({
  date,
  format,
  formatEl,
  short,
  absoluteAfterDays,
  className,
}: {
  date: T;
  /**
   * A page's own wording, for the rare case the shared one does not fit
   * ("Active 2h ago"). Omitted, the product's one wording is used, in the
   * reader's language: "3h ago" / «πριν 3 ώ.».
   */
  format?: (date: T) => ReactNode;
  /** The Greek of a custom `format`; without it a custom format is shown as given. */
  formatEl?: (date: T) => ReactNode;
  /** "5m" / «5 λ.», for tight rows. */
  short?: boolean;
  /** From this many days on, show the date rather than its age. */
  absoluteAfterDays?: number;
  className?: string;
}) {
  const hydrated = useHydrated();
  const { primary } = useLanguagePreference();
  const d = date instanceof Date ? date : new Date(date);
  const iso = Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  const greek = primary === 'el';

  // One wording for the whole product, in the reader's language. Thirteen
  // call sites used to pass their own English-only arithmetic here, which a
  // Greek page then showed as «πριν 2w» or plain "5m ago".
  const relative = () => {
    if (format && format !== formatRelativeTime) return greek && formatEl ? formatEl(date) : format(date);
    if (!iso && typeof date !== 'string') return '';
    return relativeTimeLabel(date as string | Date, greek ? 'el' : 'en', { short, absoluteAfterDays });
  };

  return (
    <time dateTime={iso} className={className}>
      {hydrated ? relative() : stableAbsolute(d)}
    </time>
  );
}
