/**
 * The transparency report: what the safety rules refused, and what people
 * reported, per half year.
 *
 * Every number is a count of something the platform recorded, never an
 * estimate. A refusal is recorded as its kind, the surface it happened on
 * and the time - no user, no text - so the report can say "1,204 messages
 * were refused for contact details" without anyone being identifiable in
 * the data behind it. Reports come from the moderation queue as they are.
 */

export const TRANSPARENCY_EVENT_KINDS = ['contact_refused', 'promise_refused'] as const;
export type TransparencyEventKind = (typeof TRANSPARENCY_EVENT_KINDS)[number];

export const TRANSPARENCY_SURFACES = ['need_card', 'interest', 'conversation', 'terms', 'founder_update', 'scout_brief', 'intro'] as const;
export type TransparencySurface = (typeof TRANSPARENCY_SURFACES)[number];

export interface HalfYear {
  /** `2026-H2` */
  key: string;
  from: string;
  /** Exclusive. */
  to: string;
}

/** The half year a moment falls in: January-June is H1, July-December H2 (UTC). */
export function halfYearOf(at: Date | number): HalfYear {
  const d = new Date(at);
  const year = d.getUTCFullYear();
  const second = d.getUTCMonth() >= 6;
  return halfYear(year, second ? 2 : 1);
}

function halfYear(year: number, half: 1 | 2): HalfYear {
  const from = new Date(Date.UTC(year, half === 1 ? 0 : 6, 1));
  const to = new Date(Date.UTC(half === 1 ? year : year + 1, half === 1 ? 6 : 0, 1));
  return { key: `${year}-H${half}`, from: from.toISOString(), to: to.toISOString() };
}

/** `2026-H2` → the period, or null for anything else (or before 2025). */
export function parseHalfYear(key: string | null | undefined): HalfYear | null {
  const m = /^(\d{4})-H([12])$/.exec(String(key ?? '').trim());
  if (!m) return null;
  const year = Number(m[1]);
  if (year < 2025 || year > 2100) return null;
  return halfYear(year, Number(m[2]) as 1 | 2);
}

/** The period before this one. */
export function previousHalfYear(p: HalfYear): HalfYear {
  const [y, h] = p.key.split('-H').map(Number);
  return h === 2 ? halfYear(y, 1) : halfYear(y - 1, 2);
}

export interface TransparencyReport {
  period: HalfYear;
  /** True while the period is still running: the counts so far. */
  inProgress: boolean;
  refusals: Record<TransparencyEventKind, { total: number; bySurface: Partial<Record<TransparencySurface, number>> }>;
  reports: { received: number; resolved: number; dismissed: number; open: number };
  blocks: number;
  generatedAt: string;
  /** Set only by the preview demo, whose figures are illustrative. */
  sample?: boolean;
}

export const TRANSPARENCY_COPY = {
  contact_refused: {
    en: 'Refused for contact details',
    el: 'Απορρίφθηκαν για στοιχεία επικοινωνίας',
    hintEn: 'Phone numbers, emails, links, handles or payment details caught before the two sides had both confirmed. Refused, never rewritten.',
    hintEl: 'Τηλέφωνα, email, σύνδεσμοι, λογαριασμοί ή στοιχεία πληρωμής πριν επιβεβαιώσουν και οι δύο πλευρές. Απορρίπτονται, δεν ξαναγράφονται.',
  },
  promise_refused: {
    en: 'Refused for promised returns',
    el: 'Απορρίφθηκαν για υποσχέσεις αποδόσεων',
    hintEn: 'Wording such as "guaranteed return" or "risk-free" in cards, notes, briefs and updates.',
    hintEl: 'Διατυπώσεις όπως «εγγυημένη απόδοση» ή «χωρίς ρίσκο» σε κάρτες, σημειώματα και ενημερώσεις.',
  },
  surfaces: {
    need_card: { en: 'Need cards', el: 'Κάρτες ανάγκης' },
    interest: { en: 'Notes of interest', el: 'Σημειώματα ενδιαφέροντος' },
    conversation: { en: 'Protected conversations', el: 'Προστατευμένες συζητήσεις' },
    terms: { en: 'Terms', el: 'Όροι' },
    founder_update: { en: 'Founder updates', el: 'Ενημερώσεις ιδρυτών' },
    scout_brief: { en: 'Scout briefs', el: 'Σημειώματα ανιχνευτή' },
    intro: { en: 'Introduction requests', el: 'Αιτήματα σύστασης' },
  } as Record<TransparencySurface, { en: string; el: string }>,
  notCounted: {
    en: 'Not counted here: drafts the browser warned about before they were sent, and anything outside the platform.',
    el: 'Δεν μετρώνται εδώ: πρόχειρα για τα οποία προειδοποίησε ο browser πριν σταλούν, και οτιδήποτε εκτός πλατφόρμας.',
  },
} as const;
