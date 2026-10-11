import {
  TRANSPARENCY_EVENT_KINDS,
  halfYearOf,
  parseHalfYear,
  type TransparencyEventKind,
  type TransparencyReport,
  type TransparencySurface,
} from '@cofounderbay/shared';
import { DemoRefusal } from './demo-refusal';

/**
 * The transparency report in the preview demo.
 *
 * The demo's own rules refuse contact details and promised returns exactly
 * as the API does; each refusal is counted here (kind and surface, nothing
 * else) for the current half year, so the report shows what this demo
 * session actually refused. The two moderation reports are the demo
 * admin queue's. The answer carries `sample: true` and the page says so.
 */

const STORAGE_KEY = 'cfb:demo-transparency:v1';
type Counts = Partial<Record<TransparencyEventKind, Partial<Record<TransparencySurface, number>>>>;
let memory: Counts | null = null;

function load(): Counts {
  if (memory) return memory;
  try {
    const raw = typeof window !== 'undefined' ? window.sessionStorage.getItem(STORAGE_KEY) : null;
    memory = raw ? (JSON.parse(raw) as Counts) : {};
  } catch {
    memory = {};
  }
  return memory;
}

export function resetDemoTransparency() {
  memory = null;
  try {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Called by the demo worlds where the API records a refusal. */
export function recordDemoRefusal(kind: TransparencyEventKind, surface: TransparencySurface) {
  const counts = load();
  const bucket = (counts[kind] ??= {});
  bucket[surface] = (bucket[surface] ?? 0) + 1;
  try {
    if (typeof window !== 'undefined') window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  } catch {
    // storage blocked: the count lasts this page view
  }
}

/** Answers `/api/public/transparency` for the demo, or `undefined` for any other path. */
export function previewTransparencyApi(pathname: string, path: string, now: number): unknown {
  if (pathname !== '/api/public/transparency') return undefined;
  const requested = new URLSearchParams(path.split('?')[1] ?? '').get('period');
  const current = halfYearOf(now);
  const period = requested ? parseHalfYear(requested) : current;
  if (!period || Date.parse(period.from) > now) throw new DemoRefusal(400, 'period must look like 2026-H2');
  const live = period.key === current.key;
  const counts = live ? load() : {};
  const refusals = Object.fromEntries(
    TRANSPARENCY_EVENT_KINDS.map((k) => {
      const bySurface = { ...(counts[k] ?? {}) };
      return [k, { total: Object.values(bySurface).reduce((a, b) => a + (b ?? 0), 0), bySurface }];
    }),
  ) as TransparencyReport['refusals'];
  const report: TransparencyReport = {
    period,
    inProgress: live,
    refusals,
    reports: live ? { received: 2, resolved: 1, dismissed: 0, open: 1 } : { received: 0, resolved: 0, dismissed: 0, open: 0 },
    blocks: 0,
    generatedAt: new Date(now).toISOString(),
    sample: true,
  };
  return report;
}
