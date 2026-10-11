import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The decorative-icon rules hide glyphs beside copy and keep the icon of an
 * icon-only control. Three ways they have broken, all silent in the browser:
 *
 * - `:has(> :not(svg))` read a screen-reader name, or a `hidden sm:inline`
 *   label on a phone, as a visible label and hid the only thing a sighted
 *   reader could see (364 blank buttons at 1440px, more on phones);
 * - a `:has()` nested in another `:has()` is invalid, and one invalid
 *   selector drops its whole rule, so every decorative glyph came back;
 * - hiding the glyph in a card left its tinted well behind as an empty box
 *   (181 on 37 routes), and took state glyphs and achievement badges with it.
 */
const raw = readFileSync('src/app/globals.css', 'utf8');
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');

/** The argument of each `:has(` in the stylesheet, with balanced parentheses. */
function hasArguments(source: string): string[] {
  const out: string[] = [];
  let at = source.indexOf(':has(');
  while (at !== -1) {
    let depth = 0;
    let end = at + 4;
    for (; end < source.length; end++) {
      if (source[end] === '(') depth++;
      else if (source[end] === ')' && --depth === 0) break;
    }
    out.push(source.slice(at + 5, end));
    at = source.indexOf(':has(', at + 5);
  }
  return out;
}

describe('decorative icon rules', () => {
  const args = hasArguments(css);

  it('never nest :has()', () => {
    expect(args.filter((arg) => arg.includes(':has('))).toEqual([]);
  });

  it('do not read a screen-reader name or a responsive label as a label', () => {
    const labelTests = args.filter((arg) => /^>\s*:not\(svg\)/.test(arg));
    expect(labelTests.length).toBeGreaterThan(10);
    expect(labelTests.filter((arg) => !arg.includes(':not(.sr-only)'))).toEqual([]);
    // A `hidden sm:inline` label is display:none on phones: no label there.
    expect(labelTests.filter((arg) => !arg.includes(':not(.hidden)'))).toEqual([]);
  });

  it('hide the well with its icon, and keep state glyphs and marked content', () => {
    const inCard = raw.slice(raw.indexOf('Decorative icons'), raw.indexOf('Labeled action buttons'));
    const hideLucide = inCard.split('\n').find((line) => line.includes('> svg.lucide') && line.includes(':not(button)'));
    for (const kept of ['.lucide-check', '.lucide-circle-check', '.lucide-lock', '.lucide-loader-2', '[data-keep-icon] > *']) {
      expect(hideLucide).toContain(`:not(${kept})`);
    }
    const well = inCard.split('\n').find((line) => line.startsWith('#main-content [data-surface="card"] :is(div, span)'));
    expect(well).toContain(':not([data-keep-icon])');
    expect(well).toContain(':not(:has(> :not(svg.lucide):not(svg.cfb-glyph)))');
  });

  it('count only a fixed-size or small-padding box as a well, so a text row keeps its words', () => {
    // `:has(> :not(svg))` cannot see a text node: without this guard
    // <span><Clock/>45 min</span> went with its glyph (2026-10-09: durations,
    // places, event dates and attendance, `.probes/hidden_text.mjs`).
    const GUARD = ':is(:is([class^="h-"], [class*=" h-"]):is([class^="w-"], [class*=" w-"]), [class^="size-"], [class*=" size-"], [class~="p-0.5"], [class~="p-1"], [class~="p-1.5"], [class~="p-2"], [class~="p-2.5"])';
    const wells = raw.split('\n').filter((line) => /^#main-content (\[data-surface="card"\] )?:is\(div, span\)/.test(line));
    expect(wells.length).toBe(2);
    for (const line of wells) expect(line).toContain(`:is(div, span)${GUARD}`);
  });
});
