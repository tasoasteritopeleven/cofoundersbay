import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The phone reading scale lives in one max-width: 639.98px block and nowhere
 * wider. Tablet and desktop keep the shared ladder; this test fails if the
 * phone steps leak into a min-width query or drop back to the 12.24px caption.
 */

const CSS = readFileSync('src/app/globals.css', 'utf8');

function phoneReadingBlock(): string {
  const marker = 'Phone reading scale';
  const from = CSS.indexOf(marker);
  if (from < 0) throw new Error('Missing phone reading scale');
  const media = CSS.indexOf('@media', from);
  const header = CSS.slice(media, CSS.indexOf('{', media) + 1);
  if (!header.includes('max-width: 639.98px')) {
    throw new Error(`Phone reading scale is not scoped to phones: ${header}`);
  }
  if (header.includes('min-width')) {
    throw new Error('Phone reading scale must not use min-width');
  }
  let depth = 0;
  let i = CSS.indexOf('{', media);
  const start = i + 1;
  for (; i < CSS.length; i += 1) {
    if (CSS[i] === '{') depth += 1;
    else if (CSS[i] === '}') {
      depth -= 1;
      if (depth === 0) return CSS.slice(start, i);
    }
  }
  throw new Error('Unclosed phone reading scale');
}

const BLOCK = phoneReadingBlock();

function fontSize(selector: string): string {
  for (const match of BLOCK.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].split(',').map((part) => part.trim());
    if (!selectors.includes(selector)) continue;
    const value = /font-size:\s*([^;]+)/.exec(match[2])?.[1];
    if (value) return value.trim();
  }
  throw new Error(`No phone font-size for ${selector}`);
}

describe('phone reading scale', () => {
  it('raises every reading step and leaves the query phone-only', () => {
    expect(fontSize('.text-2xs')).toBe('13.044px');
    expect(fontSize('.text-xs')).toBe('14.406px');
    expect(fontSize('.text-sm')).toBe('14.170px');
    expect(fontSize('.text-base')).toBe('15.520px');
    expect(fontSize('body')).toBe('15.520px');
    expect(fontSize('#main-content .text-sm')).toBe('14.170px');
    expect(fontSize('p.page-lead')).toBe('12.921px');
    expect(fontSize('#main-content .person-subtitle')).toBe('14.025px');
    expect(fontSize('.text-lg')).toBe('13.816px');
    expect(fontSize('#main-content .text-lg')).toBe('13.816px');
    expect(fontSize('#main-content h1.page-title')).toBe('14.148px');
    expect(fontSize('p.page-stat')).toBe('14.585px');
    expect(fontSize('#main-content p.page-stat-label')).toBe('13.044px');
    expect(fontSize('#main-content .person-name')).toBe('14.148px');
    expect(fontSize('.text-xl')).toBe('14.148px');
    expect(fontSize('.text-4xl')).toBe('14.148px');
    expect(fontSize('.text-7xl')).toBe('14.148px');
    expect(fontSize('#main-content .score-emblem-figure')).toBe('15.520px');
    expect(BLOCK).not.toMatch(/min-width/);
    expect(BLOCK).not.toMatch(/12\.2412px/);
  });
});
