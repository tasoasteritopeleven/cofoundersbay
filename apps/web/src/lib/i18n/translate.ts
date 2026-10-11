import { APP_LOCALES, type AppLocale } from '@/lib/locale';
import { CATALOG } from './catalog';

const extraCache: Partial<Record<Exclude<AppLocale, 'en'>, Record<string, string>>> = {};

const extraLoaders: Record<Exclude<AppLocale, 'en'>, () => Promise<{ default: Record<string, string> }>> = {
  el: () => import('./messages/el.json'),
  es: () => import('./messages/es.json'),
  fr: () => import('./messages/fr.json'),
  de: () => import('./messages/de.json'),
  it: () => import('./messages/it.json'),
  pt: () => import('./messages/pt.json'),
  zh: () => import('./messages/zh.json'),
  ja: () => import('./messages/ja.json'),
};

/**
 * Loads the on-demand message catalog for a locale.
 *
 * Returns whether this call actually added a catalog. Callers use that to decide
 * whether re-rendering is warranted: English has no catalog and an already-cached
 * locale has nothing new, so in both cases the translation output is unchanged and
 * invalidating consumers would be pure churn.
 */
export async function ensureExtraCatalog(locale: AppLocale): Promise<boolean> {
  if (locale === 'en') return false;
  if (extraCache[locale]) return false;
  const mod = await extraLoaders[locale]();
  extraCache[locale] = mod.default as Record<string, string>;
  delete patternCache[locale];
  delete dynamicMemo[locale];
  return true;
}

export const LOCALE_BCP47: Record<AppLocale, string> = {
  en: 'en-US',
  el: 'el-GR',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-PT',
  zh: 'zh-CN',
  ja: 'ja-JP',
};

export type TranslateVars = Record<string, string | number>;

function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] === undefined || vars[key] === null ? `{${key}}` : String(vars[key]),
  );
}

export function isAppLocale(value: string): value is AppLocale {
  return APP_LOCALES.some((l) => l.value === value);
}

function lookup(locale: Exclude<AppLocale, 'en'>, source: string): string | undefined {
  return CATALOG[locale]?.[source] ?? extraCache[locale]?.[source];
}

/*
 * Rendered text carries its numbers and dates already filled in: "4 of 5 steps
 * complete", "Due 3 Oct", "2h ago". No exact catalog key can match those, so the
 * DOM pass left every counter, date and status line in English. Catalog keys
 * with `{slots}` double as patterns for that text, and dates and relative times
 * are re-formatted by Intl in the reader's locale.
 */
type Pattern = { key: string; re: RegExp; slots: string[]; literal: string };

const TEXT_SLOTS = new Set(['name', 'title', 'label', 'text', 'dimension', 'status', 'stage']);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DATE_SOURCE = '\\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)(?: \\d{4})?';
const DATE_RE = new RegExp(`^${DATE_SOURCE}$`);
const RELATIVE_RE =
  /^(?:(in) )?(\d+)\s?(m|h|d|w|mo|minutes?|hours?|days?|weeks?|months?)(?: (ago))?$/i;
const RELATIVE_UNITS: Record<string, Intl.RelativeTimeFormatUnit> = {
  m: 'minute', minute: 'minute', minutes: 'minute',
  h: 'hour', hour: 'hour', hours: 'hour',
  d: 'day', day: 'day', days: 'day',
  w: 'week', week: 'week', weeks: 'week',
  mo: 'month', month: 'month', months: 'month',
};

const patternCache: Partial<Record<Exclude<AppLocale, 'en'>, Pattern[]>> = {};
const dynamicMemo: Partial<Record<Exclude<AppLocale, 'en'>, Map<string, string | null>>> = {};

function slotSource(slot: string): string {
  if (slot === 'date') return `(${DATE_SOURCE})`;
  if (slot.endsWith('pct')) return '(\\d[\\d.,]*%)';
  if (TEXT_SLOTS.has(slot)) return '(.+?)';
  return '(\\d[\\d.,]*)';
}

function patternsFor(locale: Exclude<AppLocale, 'en'>): Pattern[] {
  const cached = patternCache[locale];
  if (cached) return cached;
  const keys = new Set([...Object.keys(CATALOG[locale] ?? {}), ...Object.keys(extraCache[locale] ?? {})]);
  const patterns: Pattern[] = [];
  for (const key of keys) {
    if (!/\{\w+\}/.test(key)) continue;
    const slots: string[] = [];
    const parts = key.split(/(\{\w+\})/);
    const source = parts
      .map((part) => {
        const slot = /^\{(\w+)\}$/.exec(part)?.[1];
        if (!slot) return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        slots.push(slot);
        return slotSource(slot);
      })
      .join('');
    const literal = parts.filter((part) => !/^\{\w+\}$/.test(part)).sort((a, b) => b.length - a.length)[0] ?? '';
    patterns.push({ key, re: new RegExp(`^${source}$`), slots, literal: literal.trim() });
  }
  // Most specific first: "{n} pts to {label}" must win over "{label} {pct}".
  patterns.sort((a, b) => b.literal.length - a.literal.length);
  patternCache[locale] = patterns;
  return patterns;
}

function formatDate(locale: Exclude<AppLocale, 'en'>, text: string): string | null {
  if (!DATE_RE.test(text)) return null;
  const [day, month, year] = text.split(' ');
  const index = MONTHS.indexOf(month.slice(0, 3));
  if (index < 0) return null;
  const date = new Date(year ? Number(year) : 2024, index, Number(day));
  return new Intl.DateTimeFormat(LOCALE_BCP47[locale], {
    day: 'numeric',
    month: 'short',
    ...(year ? { year: 'numeric' } : {}),
  }).format(date);
}

function formatRelative(locale: Exclude<AppLocale, 'en'>, text: string): string | null {
  const match = RELATIVE_RE.exec(text);
  if (!match) return null;
  const [, future, amount, rawUnit, past] = match;
  if (!future === !past) return null;
  const unit = RELATIVE_UNITS[rawUnit.toLowerCase()];
  if (!unit) return null;
  const style = rawUnit.length <= 2 ? 'short' : 'long';
  const value = Number(amount);
  // Greek gets the product's own compact form (`relativeTimeLabel`), so a
  // timestamp the DOM pass rewrites reads like every other one on the page.
  if (locale === 'el' && style === 'short') {
    const abbr = { minute: 'λ.', hour: 'ώ.', day: 'ημ.', week: 'εβδ.', month: 'μήν.' }[unit as 'minute' | 'hour' | 'day' | 'week' | 'month'];
    if (abbr) return future ? `σε ${value} ${abbr}` : `πριν ${value} ${abbr}`;
  }
  return new Intl.RelativeTimeFormat(LOCALE_BCP47[locale], { numeric: 'always', style }).format(
    future ? value : -value,
    unit,
  );
}

function translateDynamic(locale: Exclude<AppLocale, 'en'>, text: string, depth = 0): string | null {
  const memo = (dynamicMemo[locale] ??= new Map());
  if (memo.has(text)) return memo.get(text) ?? null;
  let result = formatDate(locale, text) ?? formatRelative(locale, text);
  if (result === null && depth < 2) {
    for (const pattern of patternsFor(locale)) {
      if (pattern.literal && !text.includes(pattern.literal)) continue;
      const match = pattern.re.exec(text);
      if (!match) continue;
      const values = new Map(pattern.slots.map((slot, i) => [slot, match[i + 1]]));
      const template = lookup(locale, pattern.key) ?? pattern.key;
      const filled = template.replace(/\{(\w+)\}/g, (whole, slot: string) => {
        const value = values.get(slot);
        if (value === undefined) return whole;
        if (slot === 'date') return formatDate(locale, value) ?? value;
        if (!TEXT_SLOTS.has(slot)) return value;
        return lookup(locale, value) ?? translateDynamic(locale, value, depth + 1) ?? value;
      });
      if (filled !== text) {
        result = filled;
        break;
      }
    }
  }
  memo.set(text, result);
  return result;
}

/** Translate an English UI string for the active locale. Unknown strings stay in English. */
export function translate(locale: AppLocale, source: string, vars?: TranslateVars): string {
  if (!source) return source;
  if (locale === 'en') return interpolate(source, vars);
  const translated = lookup(locale, source);
  if (translated !== undefined) return interpolate(translated, vars);
  if (vars) return interpolate(source, vars);
  return translateDynamic(locale, source) ?? source;
}
