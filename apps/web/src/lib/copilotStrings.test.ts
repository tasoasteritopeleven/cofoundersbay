import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATALOG } from '@/lib/i18n/catalog';
import { translate } from '@/lib/i18n/translate';

/**
 * Guards the copilot's replies against sliding back into English-only.
 *
 * `copilot-engine` does not render components, so `BilingualText` cannot reach
 * it — every sentence it composes was a bare English literal, which broke the
 * EN/EL rule this project documents on every single assistant reply. The
 * catalogue also already promised "AI replies will use {code}".
 *
 * It was worse than untranslated copy, too: `usePageContext` hardcoded
 * `locale: 'en'`, so the packet handed to the engine declared every reader
 * English no matter what they had chosen. Translating the strings without that
 * fix would have changed nothing for anyone.
 *
 * This reads the engine's source and requires a Greek entry for every English
 * sentence in it. What it cannot prove: translation quality, or that a reply
 * reads naturally once interpolated.
 */

const ENGINE_PATH = 'src/lib/copilot-engine.ts';
/**
 * The engine's replies are composed in two files now: the engine itself, and
 * `copilot-reads.ts`, which answers questions about product areas. Scanning
 * only the first would let every area reply ship in English without a failing
 * test, which is the exact regression this file exists to stop.
 */
const READS_PATH = 'src/lib/copilot-reads.ts';
const ENGINE = readFileSync(ENGINE_PATH, 'utf8') + '\n' + readFileSync(READS_PATH, 'utf8');

/**
 * Literals that are not user-facing copy. Kept explicit so a new sentence has
 * to be translated rather than quietly added to a pattern.
 */
const NOT_USER_FACING = new Set([
  // Route and API paths, ids and payload keys.
  'compose from existing endpoints',
]);

/** Prose = a quoted literal with a space in it, or one carrying a placeholder. */
function prose(source: string): string[] {
  const found = new Set<string>();

  // Single-quoted literals, honouring escaped quotes.
  for (const match of source.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)) {
    const value = match[1];
    if (!value) continue;
    // Paths, query keys and tool ids have no spaces; prose does.
    if (!value.includes(' ')) continue;
    if (value.startsWith('/') || value.startsWith('@/')) continue;
    // Join separators (' ', ' · ') carry no words and nothing to translate.
    if (!/\p{L}/u.test(value)) continue;
    found.add(value.replace(/\\'/g, "'"));
  }

  return [...found];
}

describe('copilot reply copy', () => {
  it('finds the engine and a meaningful amount of prose in it', () => {
    // Every assertion below is vacuous if the read or the scan returns nothing.
    expect(ENGINE.length).toBeGreaterThan(5000);
    expect(prose(ENGINE).length).toBeGreaterThan(20);
  });

  it('has a Greek translation for every sentence the engine composes', () => {
    const untranslated = prose(ENGINE)
      .filter((value) => !NOT_USER_FACING.has(value))
      .filter((value) => !CATALOG.el[value])
      .sort();

    expect(untranslated).toEqual([]);
  });

  it('returns Greek, not the English source, for each of them', () => {
    const unchanged = prose(ENGINE)
      .filter((value) => !NOT_USER_FACING.has(value))
      .filter((value) => translate('el', value) === value)
      .sort();

    expect(unchanged).toEqual([]);
  });

  it('has a translation in every catalogue locale, not only Greek', () => {
    // Greek alone was enforced, and that is exactly how 48 of the engine's
    // replies came to exist in Greek and nowhere else: a Spanish, French,
    // German, Italian, Portuguese, Chinese or Japanese reader got them in
    // English, with no failing test to say so. Every locale the catalogue
    // declares is held to the same bar now.
    const catalogues = CATALOG as Record<string, Record<string, string>>;
    const gaps: string[] = [];
    for (const [locale, entries] of Object.entries(catalogues)) {
      for (const value of prose(ENGINE)) {
        if (NOT_USER_FACING.has(value)) continue;
        if (!entries[value]) gaps.push(`${locale}: ${value}`);
      }
    }
    expect(gaps).toEqual([]);
  });

  it('keeps every placeholder intact in every locale', () => {
    const catalogues = CATALOG as Record<string, Record<string, string>>;
    const mismatched: string[] = [];
    for (const [locale, entries] of Object.entries(catalogues)) {
      for (const value of prose(ENGINE)) {
        const translated = entries[value];
        if (!translated) continue;
        const source = [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
        const target = [...translated.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
        if (source !== target) mismatched.push(`${locale}: ${value} → [${source}] vs [${target}]`);
      }
    }
    expect(mismatched).toEqual([]);
  });

  it('keeps every placeholder intact in the Greek copy', () => {
    // A dropped `{name}` renders the literal braces to the reader; an added one
    // renders as `{oops}` because interpolate leaves unknown keys alone.
    const mismatched: string[] = [];

    for (const value of prose(ENGINE)) {
      const greek = CATALOG.el[value];
      if (!greek) continue;

      const inEnglish = [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      const inGreek = [...greek.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

      if (inEnglish.join(',') !== inGreek.join(',')) {
        mismatched.push(`${value} → en[${inEnglish}] vs el[${inGreek}]`);
      }
    }

    expect(mismatched).toEqual([]);
  });

  it('composes every reply through the translator rather than a bare literal', () => {
    // The failure mode this catches is a later edit adding
    // `sections.push('...')` or `confirmLabel: '...'` straight back in.
    const bare: string[] = [];
    // `label:` is excluded on purpose. A nextAction's label travels as its own
    // English lookup key — `fetchGraph` has no locale to translate with — and is
    // resolved at the point of display via `t(graph.nextAction.label)`. The
    // Greek-coverage assertions above still require each of those keys to have
    // a translation, so the omission cannot hide an untranslated label.
    const site = /(sections\.push\(|title:|description:|confirmLabel:)\s*'((?:[^'\\\n]|\\.)*)'/g;

    for (const match of ENGINE.matchAll(site)) {
      if (match[2].includes(' ')) bare.push(`${match[1]} '${match[2]}'`);
    }

    expect(bare).toEqual([]);
  });

  it('reads the locale off the page context instead of assuming English', () => {
    const context = readFileSync('src/hooks/usePageContext.ts', 'utf8');
    expect(context).not.toMatch(/locale:\s*'en'/);
    expect(context).toContain('useI18n');
  });
});
