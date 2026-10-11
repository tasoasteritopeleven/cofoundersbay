import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A CSS grid always states how many columns it has on a phone.
 *
 * `grid md:grid-cols-4` leaves the base column implicit, and an implicit
 * column is sized `auto`: it grows to its widest child's min-content. One long
 * row ("Grant Submission Deadline · High · Deadline") then made the whole
 * column - and the page - wider than the screen. Round 13 measured eleven
 * product pages rendering wider than a 390px phone, every one of them this or
 * a row that could not wrap. `grid-cols-1` is `minmax(0, 1fr)`, which cannot
 * outgrow its container.
 *
 * What this checks: in every `className="..."` / `cn('...')` / template class
 * string, a `grid` either carries a base `grid-cols-*` (or rows / column flow /
 * a `place-*` centring box), or it is not a grid.
 */

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.tsx') && !entry.includes('.test.')) out.push(full);
  }
  return out;
}

const CLASS_STRING = /className=(?:"([^"]*)"|\{cn\(\s*'([^']*)'|\{`([^`]*)`)|['"]((?:[\w:/[\]().%-]+\s+)*grid(?:\s+[\w:/[\]().%-]+)+)['"]/g;
/** A bare string is a class list only if it also carries a utility, not prose. */
const UTILITY = /^(gap-|[a-z0-9]+:|p[xytrbl]?-|m[xytrbl]?-|w-|h-|items-|justify-|rounded|border|space-)/;
const BASE = /^(grid-cols-|grid-rows-|grid-flow-col|auto-cols|place-items|place-content)/;

function offenders(): string[] {
  const found: string[] = [];
  for (const file of walk('src')) {
    const source = readFileSync(file, 'utf8');
    for (const m of source.matchAll(CLASS_STRING)) {
      const classes = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? '').split(/\s+/);
      if (!classes.includes('grid')) continue;
      if (m[4] && !classes.some((c) => UTILITY.test(c))) continue;
      if (classes.some((c) => BASE.test(c))) continue;
      found.push(`${file}: ${classes.join(' ').slice(0, 80)}`);
    }
  }
  return found;
}

describe('grids on a phone', () => {
  it('every grid states its base column count', () => {
    expect(offenders()).toEqual([]);
  });
});
