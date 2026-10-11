import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Section kickers keep the `uppercase` + tracking classes (that is how a
 * kicker is recognised) but paint as the source title case. "Dashboard"
 * must not come back as DASHBOARD. Bare uppercase — badges, month tiles —
 * is a different rule and stays in capitals.
 */

const CSS = readFileSync('src/app/globals.css', 'utf8');

describe('section kicker case', () => {
  it('paints tracked uppercase labels as the source title case', () => {
    const rule = CSS.match(
      /\.uppercase\.tracking-wide,\s*\.uppercase\.tracking-wider,\s*\.uppercase\.tracking-widest,\s*\.uppercase\[class\*='tracking-\['\]\s*\{([^}]+)\}/,
    );
    expect(rule, 'missing section-kicker case rule').toBeTruthy();
    expect(rule![1]).toMatch(/text-transform:\s*none/);
    expect(rule![1]).toMatch(/letter-spacing:\s*normal/);
  });
});
