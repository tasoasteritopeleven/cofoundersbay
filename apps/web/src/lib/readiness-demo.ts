/**
 * The demo showcase on /readiness, made writable.
 *
 * The page used to say "Changes are disabled" under its demo banner, which
 * made the showcase a screenshot: a visitor could read six dimensions and
 * thirty-odd criteria but could not touch one, and the assistant could not
 * either. Every score on that page is already derived from the criteria and
 * their weights, so the only thing standing between the demo and a working
 * page was somewhere to keep which boxes the visitor ticked.
 *
 * That is all this is. It follows `fundraising-demo`, which solved the same
 * problem for the investor pipeline: a `sessionStorage` overlay under a
 * `cfb:demo-` key, merged over the seed on read.
 *
 * `sessionStorage`, deliberately: a demo that survived into next week would be
 * indistinguishable from real saved data, and the banner promises the opposite.
 * Closing the tab is the reset.
 */

const STORAGE_KEY = 'cfb:demo-readiness';

/** Keyed `dimension/criterionId`, holding the state the visitor put it in. */
export type ReadinessOverlay = Record<string, boolean>;

export function overlayKey(dimension: string, criterionId: string): string {
  return `${dimension}/${criterionId}`;
}

export function readReadinessOverlay(): ReadinessOverlay {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    // Anything that is not a boolean is dropped rather than coerced: a stray
    // value would otherwise tick a box the visitor never touched.
    const clean: ReadinessOverlay = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'boolean') clean[key] = value;
    }
    return clean;
  } catch {
    return {};
  }
}

export function writeReadinessOverlay(overlay: ReadinessOverlay): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(overlay));
  } catch {
    /* a blocked write costs the visitor persistence, not the interaction */
  }
}

/** Returns the new overlay so a caller can put it straight into state. */
export function toggleDemoCriterion(
  dimension: string,
  criterionId: string,
  completed: boolean,
): ReadinessOverlay {
  const next = { ...readReadinessOverlay(), [overlayKey(dimension, criterionId)]: completed };
  writeReadinessOverlay(next);
  return next;
}

export function resetReadinessOverlay(): ReadinessOverlay {
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing to clear if it could not be written in the first place */
    }
  }
  return {};
}

/** True when the visitor has changed anything away from the seed. */
export function overlayIsEmpty(overlay: ReadinessOverlay): boolean {
  return Object.keys(overlay).length === 0;
}

/**
 * Applies the overlay to one dimension's criteria.
 *
 * Returns the same array instance when nothing is overridden, so the callers
 * that memoise on it are not woken by a demo nobody has touched.
 */
export function applyOverlay<T extends { id: string; completed: boolean }>(
  dimension: string,
  criteria: readonly T[],
  overlay: ReadinessOverlay,
): readonly T[] {
  if (overlayIsEmpty(overlay)) return criteria;

  let changed = false;
  const next = criteria.map((criterion) => {
    const override = overlay[overlayKey(dimension, criterion.id)];
    if (override === undefined || override === criterion.completed) return criterion;
    changed = true;
    return { ...criterion, completed: override };
  });
  return changed ? next : criteria;
}

/**
 * The showcase's criteria.
 *
 * They live here rather than inside the page because the page is no longer
 * the only thing that changes them: the assistant's `readiness_tick_criterion`
 * validates a criterion id against this list before writing, and it cannot
 * import a route component to do it.
 */
export const DEMO_CRITERIA: Record<string, { id: string; name: string; completed: boolean; weight: number }[]> = {
  team:      [
    { id: 't1', name: 'Co-founder identified',           completed: true,  weight: 30 },
    { id: 't2', name: 'Complementary skills covered',    completed: true,  weight: 25 },
    { id: 't3', name: 'Full-time commitment secured',    completed: true,  weight: 20 },
    { id: 't4', name: 'Previous startup experience',     completed: false, weight: 15 },
    { id: 't5', name: 'Advisory board in place',         completed: false, weight: 10 },
  ],
  market:    [
    { id: 'm1', name: 'Target market defined',           completed: true,  weight: 25 },
    { id: 'm2', name: 'Market size validated (TAM/SAM)', completed: true,  weight: 25 },
    { id: 'm3', name: 'Competitive analysis completed',  completed: false, weight: 20 },
    { id: 'm4', name: 'Customer interviews (10+)',       completed: false, weight: 20 },
    { id: 'm5', name: 'Market timing analysis',          completed: false, weight: 10 },
  ],
  product:   [
    { id: 'p1', name: 'Problem validated with users',    completed: true,  weight: 25 },
    { id: 'p2', name: 'Solution clearly defined',        completed: true,  weight: 25 },
    { id: 'p3', name: 'MVP built and tested',            completed: true,  weight: 20 },
    { id: 'p4', name: 'User feedback collected',         completed: true,  weight: 15 },
    { id: 'p5', name: 'Product roadmap documented',      completed: false, weight: 15 },
  ],
  business:  [
    { id: 'b1', name: 'Revenue model defined',           completed: true,  weight: 30 },
    { id: 'b2', name: 'Pricing strategy validated',      completed: false, weight: 25 },
    { id: 'b3', name: 'Unit economics calculated',       completed: false, weight: 20 },
    { id: 'b4', name: 'Go-to-market strategy defined',   completed: true,  weight: 15 },
    { id: 'b5', name: 'Partnership strategy outlined',   completed: false, weight: 10 },
  ],
  funding:   [
    { id: 'f1', name: 'Pitch deck ready (10-12 slides)', completed: true,  weight: 25 },
    { id: 'f2', name: 'Financial projections (3 years)', completed: false, weight: 25 },
    { id: 'f3', name: 'Data room prepared',              completed: false, weight: 20 },
    { id: 'f4', name: 'Target investor list built',      completed: false, weight: 15 },
    { id: 'f5', name: 'Term sheet knowledge ready',      completed: true,  weight: 15 },
  ],
  execution: [
    { id: 'e1', name: 'OKRs / quarterly goals set',      completed: true,  weight: 25 },
    { id: 'e2', name: 'Key milestones defined',          completed: true,  weight: 25 },
    { id: 'e3', name: 'Core metrics tracked',            completed: true,  weight: 20 },
    { id: 'e4', name: 'Regular retrospectives held',     completed: false, weight: 15 },
    { id: 'e5', name: 'Documentation practices in place',completed: false, weight: 15 },
  ],
};

/** Every criterion id the showcase knows, for validating a request against. */
export function demoCriterion(dimension: string, criterionId: string) {
  return DEMO_CRITERIA[dimension]?.find((criterion) => criterion.id === criterionId);
}

/** The state a criterion is in right now, seed overridden by the overlay. */
export function demoCriterionState(dimension: string, criterionId: string): boolean | undefined {
  const criterion = demoCriterion(dimension, criterionId);
  if (!criterion) return undefined;
  const override = readReadinessOverlay()[overlayKey(dimension, criterionId)];
  return override === undefined ? criterion.completed : override;
}
