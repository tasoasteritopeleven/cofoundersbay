/**
 * Theme-aware semantic status colors.
 *
 * Use these instead of hardcoded Tailwind palette classes (e.g. text-emerald-600)
 * so status hues stay consistent while foreground/background contrast adapts across
 * light, dark, alliance, cofounder, and system themes.
 *
 * CSS variables are defined in globals.css; Tailwind tokens in tailwind.config.ts.
 */

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'neutral';

export type StatusChipClasses = {
  bg: string;
  text: string;
  border: string;
  /** bg + text + border — for badges, chips, icon wraps */
  chip: string;
  /** text only — for icons, stat numbers, inline emphasis */
  icon: string;
};

/** Canonical class sets per semantic tone — safe for Tailwind JIT (no dynamic strings). */
export const STATUS: Record<StatusTone, StatusChipClasses> = {
  success: {
    bg: 'bg-status-success-bg',
    text: 'text-status-success',
    border: 'border-status-success-border',
    chip: 'bg-status-success-bg text-status-success border-transparent',
    icon: 'text-status-success',
  },
  warning: {
    bg: 'bg-status-warning-bg',
    text: 'text-status-warning',
    border: 'border-status-warning-border',
    chip: 'bg-status-warning-bg text-status-warning border-transparent',
    icon: 'text-status-warning',
  },
  danger: {
    bg: 'bg-status-danger-bg',
    text: 'text-status-danger',
    border: 'border-status-danger-border',
    chip: 'bg-status-danger-bg text-status-danger border-transparent',
    icon: 'text-status-danger',
  },
  info: {
    bg: 'bg-status-info-bg',
    text: 'text-status-info',
    border: 'border-status-info-border',
    chip: 'bg-status-info-bg text-status-info border-transparent',
    icon: 'text-status-info',
  },
  accent: {
    bg: 'bg-status-accent-bg',
    text: 'text-status-accent',
    border: 'border-status-accent-border',
    chip: 'bg-status-accent-bg text-status-accent border-transparent',
    icon: 'text-status-accent',
  },
  neutral: {
    bg: 'bg-status-neutral-bg',
    text: 'text-status-neutral',
    border: 'border-status-neutral-border',
    chip: 'bg-status-neutral-bg text-status-neutral border-transparent',
    icon: 'text-status-neutral',
  },
};

/** Trend / delta indicators (up = success, down = danger). */
export const TREND = {
  up: STATUS.success.icon,
  down: STATUS.danger.icon,
  flat: 'text-muted-foreground',
} as const;

/** 0–10 score text class (≥8 success, ≥6 warning, else danger). */
export function scoreTenPointClass(score: number): string {
  if (score >= 8) return STATUS.success.text;
  if (score >= 6) return STATUS.warning.text;
  return STATUS.danger.text;
}

/** Map common entity/category labels to a semantic tone (groups, org lists, etc.). */
export const CATEGORY_TONE: Record<string, StatusTone> = {
  industry: 'info',
  stage: 'warning',
  role: 'accent',
  learning: 'success',
  tech: 'info',
  marketing: 'accent',
  design: 'accent',
  finance: 'warning',
  product: 'info',
  operations: 'neutral',
  legal: 'neutral',
};

export function categoryChip(category: string): StatusChipClasses {
  const tone = CATEGORY_TONE[category.toLowerCase()] ?? 'info';
  return STATUS[tone];
}

/**
 * Readiness ladder → semantic tone. Used by the builder's readiness scoring and
 * by anything else that grades a dimension on the same four-step scale.
 *
 * Centralising it matters beyond theming: the same ladder was previously spelled
 * out as a copy-pasted ternary chain at five call sites, and they had already
 * drifted — one rendered "excellent" as `text-green-500`, another as
 * `text-green-600`, so the identical status looked like two different states.
 */
export type ReadinessStatus = 'excellent' | 'good' | 'needs-work' | 'critical';

export const READINESS_TONE: Record<ReadinessStatus, StatusTone> = {
  excellent: 'success',
  good: 'info',
  'needs-work': 'warning',
  critical: 'danger',
};

export function readinessClasses(status: ReadinessStatus): StatusChipClasses {
  return STATUS[READINESS_TONE[status]];
}

/** Solid fill for meters/progress bars, keyed by the same ladder. */
export const READINESS_FILL: Record<ReadinessStatus, string> = {
  excellent: 'bg-status-success-mark',
  good: 'bg-status-info-mark',
  'needs-work': 'bg-status-warning-mark',
  critical: 'bg-status-danger-mark',
};

/**
 * Same fills, but targeting the inner bar of `<Progress>`.
 *
 * Written out in full rather than composed as `` `[&>div]:${FILL[s]}` `` — Tailwind
 * scans source text at build time, so a class assembled at runtime is never
 * generated and the bar would silently render unpainted.
 */
export const READINESS_BAR: Record<ReadinessStatus, string> = {
  excellent: '[&>div]:bg-status-success-mark',
  good: '[&>div]:bg-status-info-mark',
  'needs-work': '[&>div]:bg-status-warning-mark',
  critical: '[&>div]:bg-status-danger-mark',
};

/**
 * A row that is waiting on the reader: a request to review, an application to
 * score, an endorsement to approve.
 *
 * A neutral surface with a warning edge, not a card filled amber. The filled
 * version shouted on every dashboard that had a queue - two amber slabs above
 * the reader's own programmes - and made "waiting on you" look like "something
 * went wrong". The edge carries the same signal at the weight of a list row,
 * the way milestones already mark overdue work.
 */
export const ATTENTION_ROW = 'rounded-lg border border-border/70 border-l-2 border-l-status-warning bg-card p-3';
