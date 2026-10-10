import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The card text ladder (globals.css "Card text ladder"): every card reads
 * title over subtitle over body over meta, at every width, the way the
 * Endorsements and Connections cards do. A sentence inside a card sits a
 * notch under the line beneath the title; a field's text sits under its
 * label. `.probes/card_audit.mjs` measures the rendered result; this test
 * keeps the steps themselves in order.
 */

const CSS = readFileSync('src/app/globals.css', 'utf8').replace(/\r\n/g, '\n');

function block(marker: string): string {
  const at = CSS.indexOf(marker);
  if (at < 0) throw new Error(`Missing ${marker}`);
  // From the opening of the comment that names the block.
  const from = CSS.lastIndexOf('/*', at);
  return CSS.slice(from, CSS.indexOf('/* A row label inside a card', from));
}

const LADDER = block('Card text ladder');

function px(value: string, root: number): number {
  const n = parseFloat(value);
  return value.endsWith('rem') ? n * root : n;
}

/** The font-size a rule in `scope` gives `selector` (first match). */
function size(scope: string, selector: string, root: number): number {
  const rules = scope.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of rules.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].split(',').map((part) => part.trim());
    if (!selectors.includes(selector)) continue;
    const value = /font-size:\s*([^;!]+)/.exec(match[2])?.[1]?.trim();
    if (value) return px(value, root);
  }
  throw new Error(`No font-size for ${selector}`);
}

function media(scope: string, query: string): string {
  const at = scope.indexOf(`@media (${query})`);
  if (at < 0) throw new Error(`No @media (${query})`);
  let depth = 0;
  let i = scope.indexOf('{', at);
  const start = i + 1;
  for (; i < scope.length; i += 1) {
    if (scope[i] === '{') depth += 1;
    else if (scope[i] === '}') {
      depth -= 1;
      if (depth === 0) return scope.slice(start, i);
    }
  }
  throw new Error('Unclosed media block');
}

describe('card text ladder', () => {
  it('orders title over subtitle over body on tablet (16px root)', () => {
    const base = LADDER.slice(0, LADDER.indexOf('@media'));
    const title = size(base, '.card-title', 16);
    const subtitle = size(base, '.card-subtitle', 16);
    const body = size(base, '.card-body', 16);
    expect(title).toBeGreaterThan(subtitle);
    expect(subtitle).toBeGreaterThan(body);
    // The body stays above the meta step (text-xs, 13.26px).
    expect(body).toBeGreaterThan(13.26);
  });

  it('keeps the order against the 82% desktop root', () => {
    const desk = media(LADDER, 'min-width: 1024px');
    const title = size(desk, '.card-title', 13.12);
    const subtitle = size(desk, '.card-subtitle', 13.12);
    const body = size(desk, '.card-body', 13.12);
    expect(title).toBeCloseTo(16.32, 1);
    expect(subtitle).toBeCloseTo(14.28, 1);
    expect(body).toBeCloseTo(13.77, 1);
  });

  it('keeps the order on a phone, above the caption step', () => {
    const phone = media(LADDER, 'max-width: 639.98px');
    expect(size(phone, '#main-content .card-title', 16)).toBe(15.343);
    expect(size(phone, '#main-content .card-subtitle', 16)).toBe(14.906);
    expect(size(phone, '#main-content .card-body', 16)).toBe(14.406);
  });

  it('sets field text under its label (text-sm) at every width', () => {
    const fields = CSS.slice(CSS.lastIndexOf('/*', CSS.indexOf('── Fields read under their labels')));
    const field = "input:not([type='checkbox']):not([type='radio']):not([type='range']):not([type='color']):not([type='file'])";
    // Tablet: under text-sm (14.28px).
    expect(size(fields.slice(0, fields.indexOf('@media')), field, 16)).toBeLessThan(14.28);
    expect(size(media(fields, 'min-width: 1024px'), field, 13.12)).toBeLessThan(14.28);
    // Phone: the control step, under the phone text-sm (14.906px).
    expect(size(media(fields, 'max-width: 639.98px'), field, 16)).toBe(14.406);
    expect(CSS).not.toMatch(/font-size:\s*16\.16px\s*!important/);
  });

  it('gives a card title on a phone the title step, over its rows', () => {
    expect(CSS).toContain('#main-content [data-card] h3.page-section:not(.page-section--compact)');
  });
});
