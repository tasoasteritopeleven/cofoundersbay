import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type RelativeTimeOptions = {
  /** "5m" / «5 λ.» rather than "5m ago" / «πριν 5 λ.», for tight rows such as a feed. */
  short?: boolean;
  /** From this many days on, the date itself ("16 Sep" / «16 Σεπ») instead of an age. */
  absoluteAfterDays?: number;
};

const RELATIVE_UNITS = {
  en: { minute: 'm', hour: 'h', day: 'd', week: 'w', month: 'mo', year: 'y', now: 'just now' },
  el: { minute: ' λ.', hour: ' ώ.', day: ' ημ.', week: ' εβδ.', month: ' μήν.', year: ' έτ.', now: 'μόλις τώρα' },
} as const;

/**
 * The one way the product says how long ago something happened, in either
 * language: "3h ago" / «πριν 3 ώ.», "2w ago" / «πριν 2 εβδ.». Thirteen pages
 * used to keep their own copy of this arithmetic, all in English only, which
 * is how a Greek screen ended up reading «πριν 2w».
 */
export function relativeTimeLabel(dateStr: string | Date, lang: 'en' | 'el' = 'en', options: RelativeTimeOptions = {}): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  // A value that is not a date ("Never", or a sample row's "2 hours ago")
  // used to come out as "NaNy ago". Show what was given instead.
  if (Number.isNaN(date.getTime())) return typeof dateStr === 'string' && dateStr.trim() ? dateStr : '—';
  const u = RELATIVE_UNITS[lang];
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  const days = Math.floor(seconds / 86_400);
  if (options.absoluteAfterDays !== undefined && days >= options.absoluteAfterDays) {
    return date.toLocaleDateString(lang === 'el' ? 'el-GR' : 'en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' });
  }
  if (seconds < 60) return u.now;
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const [n, unit] =
    minutes < 60 ? [minutes, u.minute]
      : hours < 24 ? [hours, u.hour]
        : days < 7 ? [days, u.day]
          : weeks < 5 ? [weeks, u.week]
            : months < 12 ? [months, u.month]
              : [Math.floor(months / 12), u.year];
  const age = `${n}${unit}`;
  if (options.short) return age;
  return lang === 'el' ? `πριν ${age}` : `${age} ago`;
}

export function formatRelativeTime(dateStr: string | Date): string {
  return relativeTimeLabel(dateStr, 'en');
}

/**
 * Greek counterpart of `formatRelativeTime`, same thresholds. `RelativeTime`
 * switches to it when the reader's primary language is Greek; a timestamp is a
 * tight slot, so it shows one language rather than both.
 */
export function formatRelativeTimeEl(dateStr: string | Date): string {
  return relativeTimeLabel(dateStr, 'el');
}

/**
 * Reads a message off a caught value. `catch` binds `unknown`, and the app's
 * API errors are plain Errors or `{ message }` objects; this keeps call sites
 * from reaching for `any`.
 */
export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}

/** HTTP status carried by API errors thrown from lib/api. */
export function errorStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number') return status;
  }
  return undefined;
}

/** True for the DOMException thrown when a fetch/stream is aborted. */
export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      (error as { name?: unknown }).name === 'AbortError')
  );
}

/**
 * Two letters for an avatar: first and last word, titles skipped.
 *
 * Twenty call sites built initials with `name.split(' ').map(n => n[0])`,
 * which gave "DSK" for "Dr. Sarah Kim" - three letters in a 32px circle,
 * drawn over the avatar beside it.
 */
const NAME_TITLES = new Set(['dr', 'mr', 'mrs', 'ms', 'mx', 'prof', 'sir']);
export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter((w) => w && !NAME_TITLES.has(w.replace(/\.$/, '').toLowerCase()));
  if (!words.length) return '?';
  const first = words[0][0] ?? '';
  const last = words.length > 1 ? words[words.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
}

/**
 * A company stage as people write it: "Pre-seed", "Seed", "Series A".
 *
 * The API stores stages as identifiers (`pre_seed`, `series_a`), and the
 * investor pages printed them as stored, so one deal read "pre_seed" on the
 * pipeline beside a sample row reading "Pre-seed". Already-written labels
 * pass through unchanged; an empty stage stays empty for the caller's dash.
 */
export function companyStageLabel(stage: string | null | undefined): string {
  const words = (stage ?? '').trim().split(/[_\s-]+/).filter(Boolean);
  if (!words.length) return '';
  if (words[0].toLowerCase() === 'mvp') return 'MVP';
  if (words[0].toLowerCase() === 'pre' && words.length > 1) {
    return `Pre-${words.slice(1).join(' ').toLowerCase()}`;
  }
  if (words[0].toLowerCase() === 'series' && words.length > 1) {
    return `Series ${words.slice(1).join(' ').toUpperCase()}`;
  }
  const text = words.join(' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
