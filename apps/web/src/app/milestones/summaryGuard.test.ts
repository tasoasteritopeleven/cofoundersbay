import { describe, expect, it } from 'vitest';
import { resolvePreviewApi } from '@/lib/preview-api';
import type { MilestoneSummary } from '@/lib/api';

/**
 * Regression cover for "Cannot read properties of undefined (reading
 * 'in_progress')", which took down `/milestones` (SummaryBar) and the founder
 * dashboard's milestone widget.
 *
 * Two defences, tested independently because either alone leaves a hole:
 *
 *  1. the preview resolver answers `/api/milestones/summary` with a real
 *     `MilestoneSummary`. It previously fell through to the generic fallback,
 *     which carries `milestones: []` but no `counts` — so `summary` was truthy,
 *     `if (!summary) return null` passed, and the next line threw.
 *  2. the read is guarded at the depth that can actually be missing. The old
 *     form guarded only the leaf, so with `counts` undefined it threw while
 *     evaluating `.in_progress`, before `??` was ever reached.
 *
 * The live backend always sends `counts` (milestones.service.ts builds it
 * unconditionally), so this only ever failed against demo/partial payloads —
 * which is exactly the case a guard exists for.
 */

/** The expression SummaryBar evaluates, in both its old and current form. */
const unguarded = (s: MilestoneSummary) => (s as MilestoneSummary).counts.in_progress ?? 0; // unguarded-by-design
const guarded = (s: Partial<MilestoneSummary>) => s.counts?.in_progress ?? 0;

describe('milestones summary guard', () => {
  it('preview resolver returns a payload that actually has counts', () => {
    const res = resolvePreviewApi('/api/milestones/summary') as MilestoneSummary;
    expect(res.counts).toBeTruthy();
    expect(typeof res.counts.in_progress).toBe('number');
    expect(typeof res.total).toBe('number');
    expect(typeof res.completionRate).toBe('number');
  });

  it('reproduces the original crash, so the guard is not testing a straw man', () => {
    const withoutCounts = { total: 0, overdue: 0, dueSoon: 0, completionRate: 0 } as unknown as MilestoneSummary;
    expect(() => unguarded(withoutCounts)).toThrow(TypeError);
  });

  it('renders 0 instead of throwing when counts is absent', () => {
    expect(guarded({ total: 0, overdue: 0, dueSoon: 0, completionRate: 0 })).toBe(0);
    expect(guarded({})).toBe(0);
  });

  it('is unchanged when counts is present', () => {
    const full = { counts: { in_progress: 4 } } as unknown as MilestoneSummary;
    expect(guarded(full)).toBe(4);
    expect(guarded(full)).toBe(unguarded(full));
  });

  it('keeps the list in lockstep with the summary so the page never shows 12 and an empty state', () => {
    const summary = resolvePreviewApi('/api/milestones/summary') as MilestoneSummary;
    const list = resolvePreviewApi('/api/milestones') as { milestones: unknown[]; total: number };
    expect(list.milestones).toHaveLength(summary.total);
    expect(list.total).toBe(summary.total);
    const byStatus = (list.milestones as { status: string }[]).reduce<Record<string, number>>((acc, m) => {
      acc[m.status] = (acc[m.status] ?? 0) + 1;
      return acc;
    }, {});
    expect(byStatus.todo).toBe(summary.counts.todo);
    expect(byStatus.in_progress).toBe(summary.counts.in_progress);
    expect(byStatus.blocked).toBe(summary.counts.blocked);
    expect(byStatus.completed).toBe(summary.counts.completed);
  });
});
