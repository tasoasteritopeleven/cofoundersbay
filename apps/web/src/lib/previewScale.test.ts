import { describe, expect, it } from 'vitest';
import { resolvePreviewApi } from './preview-api';

/**
 * A preview payload has to use the same scale as the endpoint it stands in for.
 *
 * The mentor-metrics panel renders `speedScore * 100` because the service
 * derives speed, depth and burden in [0, 1]. The preview answered with 62, 54
 * and 38 — the same numbers on a 0-100 scale — so the showcase drew
 * "Speed 6200%", "Depth 5400%" and "Low Burden 3800%", every bar pinned to
 * full width. Nothing was wrong with the component or the endpoint; the two
 * sides of one contract disagreed about what a 1 meant.
 *
 * The scale is the part a type cannot hold — `number` is `number` either way —
 * so it is asserted here instead.
 */
describe('preview payloads keep the live scale', () => {
  it('states mentor feedback sub-scores as fractions, not percentages', () => {
    const m = resolvePreviewApi('/api/gamification/workspaces/preview-ws-harbor/mentor-metrics') as
      Record<string, number>;

    for (const field of ['speedScore', 'depthScore', 'burdenScore', 'appliedFeedbackRate']) {
      expect(m[field], field).toBeGreaterThanOrEqual(0);
      expect(m[field], field).toBeLessThanOrEqual(1);
    }
  });

  it('leaves the one 0-100 score on its own scale', () => {
    // improvementScore is weighted parts x 100 in the service and the panel
    // prints it as "46/100" without scaling, so it is not a fraction and must
    // not be "fixed" into one by a later sweep.
    const m = resolvePreviewApi('/api/gamification/workspaces/preview-ws-harbor/mentor-metrics') as
      Record<string, number>;
    expect(m.improvementScore).toBeGreaterThan(1);
    expect(m.improvementScore).toBeLessThanOrEqual(100);
  });

  it('keeps the XP ladder percentage a percentage', () => {
    // The sibling case the preview already carries a note about: levelProgress
    // is a percentage on this ladder, and 0.68 once rendered as "1%".
    const xp = resolvePreviewApi('/api/gamification/users/me/xp') as Record<string, number>;
    expect(xp.levelProgress).toBeGreaterThan(1);
    expect(xp.levelProgress).toBeLessThanOrEqual(100);
  });
});
