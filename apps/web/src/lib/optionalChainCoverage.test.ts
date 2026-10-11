import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Catches `a.b.c ?? fallback` — a guard written at the wrong depth.
 *
 * `??` and `||` only protect against the *leaf* being nullish. If `a.b` is
 * undefined the expression throws while evaluating `.c`, before the operator is
 * ever reached, so the fallback the author wrote protects nothing. The pattern
 * is especially easy to miss in review precisely because it looks guarded.
 *
 * This class of defect took the platform down twice: `/analytics` on
 * `overview.metrics.profileViews`, then `/milestones` and the founder dashboard
 * on `summary.counts.in_progress ?? 0`. The fix is `a.b?.c ?? fallback`, which
 * is behaviour-preserving where `a.b` exists and yields the intended default
 * where it does not.
 */

const ROOT = 'src';

/**
 * Receivers that cannot be undefined at these call sites, where `?.` would be
 * noise rather than safety: a prototype object, a DOM event target inside its
 * own handler, and a class's own initialised field.
 */
const SAFE_RECEIVER = /^(Element\.prototype|e\.target|this\.metrics)\./;

const GLOBALS =
  /^(Math|Object|JSON|Number|String|Array|Boolean|console|process|window|document|React|localStorage|sessionStorage|navigator|performance|crypto|Date|Intl|globalThis)\./;

const CHAIN =
  /(?<![?.\w])([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\s*(?:\?\?|\|\|)/g;

/**
 * A test that proves a guard works has to evaluate the unguarded form too, or it
 * is asserting against a straw man. Such a line carries this marker so the sweep
 * skips it — per line, so the rest of the file is still covered.
 */
const OPT_OUT = 'unguarded-by-design';

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

describe('optional-chain coverage', () => {
  it('has no fallback guarding a leaf while an intermediate stays unguarded', () => {
    const offenders: string[] = [];

    for (const file of walk(ROOT)) {
      // This file documents the pattern it forbids, so it must not scan itself.
      if (file.endsWith('optionalChainCoverage.test.ts')) continue;
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (line.includes(OPT_OUT)) continue;
        for (const match of line.match(CHAIN) ?? []) {
          if (GLOBALS.test(match) || SAFE_RECEIVER.test(match)) continue;
          offenders.push(`${file.replace(/\\/g, '/')}: ${match.trim()}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('actually scans the source tree', () => {
    // A wrong ROOT would make the assertion above vacuously pass.
    const files = walk(ROOT);
    expect(files.length).toBeGreaterThan(200);
  });
});
