import { describe, expect, it } from 'vitest';
// The census is a plain Node script so it also runs from the command line
// (`node scripts/ai-coverage.mjs`); the test reads the same function.
import { census, loadReasons } from '../../../../scripts/ai-coverage.mjs';

type Row = { route: string; level: 'operable' | 'askable' | 'dark'; controls: string[]; list: boolean };

/**
 * Wave A of the assistant plan: for every page, what the assistant can do
 * there, or why not. A page the assistant can neither operate (page controls)
 * nor read (a published list) needs a stated reason in
 * `scripts/ai-coverage-reasons.json` - a redirect, a sign-in form, a public
 * page, a form the person submits. A new page therefore cannot ship out of the
 * assistant's reach without somebody writing down why.
 */
describe('assistant coverage census', () => {
  const rows = census() as Row[];
  const reasons = loadReasons() as Record<string, string>;

  it('finds every page', () => {
    expect(rows.length).toBeGreaterThan(150);
  });

  it('gives every page the assistant cannot operate a reason', () => {
    const unexplained = rows.filter((r) => r.level !== 'operable' && !reasons[r.route]).map((r) => r.route);
    expect(unexplained).toEqual([]);
  });

  it('keeps no reason for a page that is operable or gone', () => {
    // A reason outlives its page's gap only by mistake: once a page publishes
    // controls or a list, the excuse must go, or it reads as a gap that is not.
    const byRoute = new Map(rows.map((r) => [r.route, r]));
    const stale = Object.keys(reasons).filter((route) => !byRoute.has(route) || byRoute.get(route)!.level === 'operable');
    expect(stale).toEqual([]);
  });

  it('keeps most pages operable', () => {
    // 79 when the census was first taken; a drop means controls were lost.
    expect(rows.filter((r) => r.level === 'operable').length).toBeGreaterThanOrEqual(105);
  });
});
