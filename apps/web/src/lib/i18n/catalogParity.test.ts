import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every language the product offers knows the same sentences.
 *
 * The DOM pass translates English copy by exact match against these
 * catalogues, so a sentence missing from one of them simply stays English for
 * that reader. On 2026-10-03 the seven other catalogues had 3,073 entries and
 * Greek had 2,501: the platform's own second language — the one most readers
 * here choose — was the least covered, and 140 English sentences showed on 42
 * pages under Greek. They were closed in one pass; this keeps them closed.
 *
 * Placeholders are part of the sentence: "{n} intros waiting" translated
 * without its {n} renders the count as nothing.
 */
const DIR = join(__dirname, 'messages');

const catalogs = Object.fromEntries(
  readdirSync(DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => [f.replace(/\.json$/, ''), JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Record<string, string>]),
);

const placeholders = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort().join(',');

describe('translation catalogues', () => {
  it('has the locales the language switcher offers', () => {
    expect(Object.keys(catalogs).sort()).toEqual(['de', 'el', 'es', 'fr', 'it', 'ja', 'pt', 'zh']);
  });

  it('gives Greek every sentence the other languages have', () => {
    const union = new Set<string>();
    for (const [loc, cat] of Object.entries(catalogs)) if (loc !== 'el') Object.keys(cat).forEach((k) => union.add(k));
    const missing = [...union].filter((k) => !(k in catalogs.el));
    expect(missing).toEqual([]);
  });

  it('keeps every placeholder in every translation', () => {
    const broken: string[] = [];
    for (const [loc, cat] of Object.entries(catalogs)) {
      for (const [source, target] of Object.entries(cat)) {
        if (placeholders(source) !== placeholders(target)) broken.push(`${loc}: ${source} -> ${target}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('never leaves a translation empty', () => {
    const empty: string[] = [];
    for (const [loc, cat] of Object.entries(catalogs)) {
      for (const [source, target] of Object.entries(cat)) if (!target.trim()) empty.push(`${loc}: ${source}`);
    }
    expect(empty).toEqual([]);
  });
});
