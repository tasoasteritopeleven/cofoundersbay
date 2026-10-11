import { hasPromiseClaims } from '../commitments/promises';

/**
 * Founder updates: a short, regular note to the people who follow a founder
 * (investors, mentors, the curious) — what moved, a few figures, what is
 * needed. LinkedIn's newsletter, narrowed to the relationship that matters.
 * The rules live here so the API, the demo and the composer agree.
 */

export const FOUNDER_UPDATE_LIMITS = { title: 120, body: 5000, metrics: 6, metricLabel: 40, metricValue: 40, asks: 3, ask: 140 } as const;
export const FOUNDER_UPDATE_VISIBILITIES = ['followers', 'public'] as const;
export type FounderUpdateVisibility = (typeof FOUNDER_UPDATE_VISIBILITIES)[number];

export interface FounderUpdateInput {
  title: string;
  body: string;
  metrics: Array<{ label: string; value: string }>;
  asks: string[];
  visibility: FounderUpdateVisibility;
  milestoneId: string | null;
}

export type FounderUpdateProblem = 'title' | 'body' | 'too_long' | 'promise';

/** Validates and trims a submitted update; empty metric rows and asks are dropped. */
export function readFounderUpdate(raw: unknown): { ok: true; value: FounderUpdateInput } | { ok: false; problems: FounderUpdateProblem[] } {
  const b = (raw ?? {}) as Record<string, unknown>;
  const title = typeof b.title === 'string' ? b.title.trim() : '';
  const body = typeof b.body === 'string' ? b.body.trim() : '';
  const metrics = (Array.isArray(b.metrics) ? b.metrics : [])
    .map((m) => {
      const r = (m ?? {}) as Record<string, unknown>;
      return { label: typeof r.label === 'string' ? r.label.trim() : '', value: typeof r.value === 'string' ? r.value.trim() : String(r.value ?? '').trim() };
    })
    .filter((m) => m.label && m.value);
  const asks = (Array.isArray(b.asks) ? b.asks : []).filter((a): a is string => typeof a === 'string').map((a) => a.trim()).filter(Boolean);
  const problems: FounderUpdateProblem[] = [];
  if (!title) problems.push('title');
  if (!body) problems.push('body');
  const L = FOUNDER_UPDATE_LIMITS;
  if (
    title.length > L.title ||
    body.length > L.body ||
    metrics.length > L.metrics ||
    asks.length > L.asks ||
    metrics.some((m) => m.label.length > L.metricLabel || m.value.length > L.metricValue) ||
    asks.some((a) => a.length > L.ask)
  ) {
    problems.push('too_long');
  }
  if (hasPromiseClaims([title, body, ...asks, ...metrics.map((m) => m.value)].join('\n'))) problems.push('promise');
  if (problems.length) return { ok: false, problems };
  return {
    ok: true,
    value: {
      title,
      body,
      metrics,
      asks,
      visibility: b.visibility === 'public' ? 'public' : 'followers',
      milestoneId: typeof b.milestoneId === 'string' && b.milestoneId ? b.milestoneId : null,
    },
  };
}

/** Money, equity or percentages in an update: the reader sees the non-guarantee note. */
export function updateMentionsMoney(update: { title: string; body: string; metrics: Array<{ label: string; value: string }>; asks: string[] }): boolean {
  const text = [update.title, update.body, ...update.asks, ...update.metrics.flatMap((m) => [m.label, m.value])].join(' ');
  return /[€$£%]|\b(?:mrr|arr|revenue|raise|raising|funding|round|equity|valuation|investment)\b|χρηματοδότ|γύρο|μετοχ|αποτίμησ|επένδυσ|έσοδ/i.test(text);
}

export const FOUNDER_UPDATE_PROBLEM_COPY: Record<FounderUpdateProblem, { en: string; el: string }> = {
  title: { en: 'Give the update a title.', el: 'Δώστε τίτλο στην ενημέρωση.' },
  body: { en: 'Write what moved since the last update.', el: 'Γράψτε τι άλλαξε από την προηγούμενη ενημέρωση.' },
  too_long: { en: 'Keep it short: 120-character title, 6 figures, 3 asks.', el: 'Σύντομα: τίτλος έως 120 χαρακτήρες, 6 μεγέθη, 3 αιτήματα.' },
  promise: { en: 'Remove promised returns; an update reports, it does not guarantee.', el: 'Αφαιρέστε τις υποσχέσεις αποδόσεων· η ενημέρωση αναφέρει, δεν εγγυάται.' },
};
