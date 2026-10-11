import { contactKinds, type ContactKind } from './contact';
import { hasPromiseClaims } from './promises';

/**
 * The commitment model: a need card, the ladder that leads from interest to
 * agreed terms, and the rules both apps enforce.
 *
 * A *need card* says three things in one sentence each - what already
 * exists, the goal it is for (`goal`; `outcome` is the card's state), and
 * the person who is missing - and what is
 * offered for it: a role, equity, hours a week and a scope. Category, place,
 * stage and commitment are filters, not decoration, so they are required.
 * Only commitments that bind people get the ladder: a co-founder seat, an
 * equity role, an introduction to an investor. Mentoring and simple intros
 * keep the ordinary messages.
 *
 * The ladder: interest, a protected first conversation (no contact details
 * either way), each side confirming separately that they want to discuss
 * terms, then a terms space where every substantive change is a new version.
 * Three revisions after the first proposal; then agree or step back. When
 * both accept the same version the commitment is agreed and a deal room
 * opens; the terms are frozen while it is open, and the first conversation
 * has been read-only since the terms space opened.
 */

export const COMMITMENT_KINDS = ['cofounder', 'equity_role', 'investor_intro'] as const;
export type CommitmentKind = (typeof COMMITMENT_KINDS)[number];

export const COMMITMENT_OUTCOMES = ['open', 'in_discussion', 'agreed', 'closed'] as const;
export type CommitmentOutcome = (typeof COMMITMENT_OUTCOMES)[number];

export const COMMITMENT_STEPS = ['interest', 'conversation', 'terms', 'agreed', 'closed'] as const;
export type CommitmentStep = (typeof COMMITMENT_STEPS)[number];

export const CARD_STAGES = ['idea', 'validating', 'building', 'launched', 'scaling'] as const;
export type CardStage = (typeof CARD_STAGES)[number];

export const CARD_COMMITMENTS = ['full_time', 'part_time', 'advisory', 'flexible'] as const;
export type CardCommitment = (typeof CARD_COMMITMENTS)[number];

export const CARD_CLOSE_REASONS = ['filled', 'withdrawn', 'expired'] as const;
export type CardCloseReason = (typeof CARD_CLOSE_REASONS)[number];

/** Revisions allowed after the first proposal: v1 plus three, so v4 is the last. */
export const MAX_TERMS_REVISIONS = 3;

/** An agreed or closed card stays in view this long, then moves to history. */
export const SETTLED_VISIBLE_DAYS = 30;

export const NEED_CARD_LIMITS = {
  title: 90,
  sentence: 220,
  sentenceMin: 20,
  scope: 200,
  equity: 40,
  role: 80,
  note: 500,
  message: 1000,
  /** Title, three sentences and the scope together: one phone screen. */
  screen: 640,
} as const;

export type NeedCardInput = {
  kind: CommitmentKind;
  title: string;
  exists: string;
  goal: string;
  missing: string;
  offerRole: string;
  offerEquity: string;
  offerHours: number | null;
  offerScope: string;
  category: string;
  place: string;
  isRemote: boolean;
  stage: string;
  commitment: string;
  projectRef?: string | null;
};

/** The parts of the offer a candidate decides on: changing one is a new version. */
export const CARD_OFFER_FIELDS = ['offerRole', 'offerEquity', 'offerHours', 'offerScope', 'commitment'] as const;

export type TermsFields = {
  role: string;
  equityPct: number | null;
  vestingMonths: number | null;
  cliffMonths: number | null;
  hoursPerWeek: number | null;
  scope: string;
};

export const TERMS_FIELDS = ['role', 'equityPct', 'vestingMonths', 'cliffMonths', 'hoursPerWeek', 'scope'] as const;
export type TermsField = (typeof TERMS_FIELDS)[number];

export function isCommitmentKind(value: unknown): value is CommitmentKind {
  return typeof value === 'string' && (COMMITMENT_KINDS as readonly string[]).includes(value);
}

export function isCardStage(value: unknown): value is CardStage {
  return typeof value === 'string' && (CARD_STAGES as readonly string[]).includes(value);
}

export function isCardCommitment(value: unknown): value is CardCommitment {
  return typeof value === 'string' && (CARD_COMMITMENTS as readonly string[]).includes(value);
}

/** Equity is the point of a co-founder seat or an equity role; optional for an intro. */
export function equityRequired(kind: CommitmentKind): boolean {
  return kind === 'cofounder' || kind === 'equity_role';
}

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const norm = (value: unknown) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLowerCase() : value ?? null;

export type NeedCheckId =
  | 'title'
  | 'exists'
  | 'goal'
  | 'missing'
  | 'offer_role'
  | 'offer_equity'
  | 'offer_time'
  | 'offer_scope'
  | 'filters'
  | 'contact_free'
  | 'promise_free'
  | 'one_screen';

export type NeedCheck = {
  id: NeedCheckId;
  ok: boolean;
  /** A failing required check blocks publishing; the others are advice. */
  required: boolean;
  en: string;
  el: string;
};

export type NeedAssessment = {
  checks: NeedCheck[];
  ready: boolean;
  /** 0-100: every passing check, required ones counting double. */
  score: number;
  contact: ContactKind[];
};

function sentenceOk(text: string): boolean {
  const t = text.trim();
  return t.length >= NEED_CARD_LIMITS.sentenceMin && t.length <= NEED_CARD_LIMITS.sentence && words(t) >= 4;
}

/** Every text field a card publishes; the contact and promise checks read all of them. */
export function needCardText(input: Partial<NeedCardInput>): string {
  return [input.title, input.exists, input.goal, input.missing, input.offerRole, input.offerEquity, input.offerScope, input.place, input.category]
    .filter((part): part is string => typeof part === 'string')
    .join('\n');
}

/**
 * The posting guide's checklist, and the server's acceptance test.
 *
 * Required: the three sentences, the role, hours, scope, equity where the
 * kind is about equity, all four filters, and no contact details or promise
 * language anywhere. Advice: fitting one phone screen.
 */
export function assessNeedCard(input: Partial<NeedCardInput>): NeedAssessment {
  const kind: CommitmentKind = isCommitmentKind(input.kind) ? input.kind : 'cofounder';
  const text = needCardText(input);
  const contact = contactKinds(text);
  const hours = typeof input.offerHours === 'number' ? input.offerHours : null;
  const screenLength = [input.title, input.exists, input.goal, input.missing, input.offerScope]
    .map((part) => (typeof part === 'string' ? part.trim().length : 0))
    .reduce((a, b) => a + b, 0);

  const checks: NeedCheck[] = [
    {
      id: 'title',
      ok: Boolean(input.title?.trim()) && (input.title?.trim().length ?? 0) <= NEED_CARD_LIMITS.title,
      required: true,
      en: 'A short title',
      el: 'Σύντομος τίτλος',
    },
    { id: 'exists', ok: sentenceOk(input.exists ?? ''), required: true, en: 'One sentence on what already exists', el: 'Μία πρόταση για ό,τι υπάρχει ήδη' },
    { id: 'goal', ok: sentenceOk(input.goal ?? ''), required: true, en: 'One sentence on the outcome', el: 'Μία πρόταση για το αποτέλεσμα' },
    { id: 'missing', ok: sentenceOk(input.missing ?? ''), required: true, en: 'One sentence on the person who is missing', el: 'Μία πρόταση για το πρόσωπο που λείπει' },
    {
      id: 'offer_role',
      ok: Boolean(input.offerRole?.trim()) && (input.offerRole?.trim().length ?? 0) <= NEED_CARD_LIMITS.role,
      required: true,
      en: 'The role offered',
      el: 'Ο ρόλος που προσφέρεται',
    },
    {
      id: 'offer_equity',
      ok: equityRequired(kind) ? Boolean(input.offerEquity?.trim()) && (input.offerEquity?.trim().length ?? 0) <= NEED_CARD_LIMITS.equity : (input.offerEquity?.trim().length ?? 0) <= NEED_CARD_LIMITS.equity,
      required: equityRequired(kind),
      en: equityRequired(kind) ? 'The equity offered' : 'The terms offered, if any',
      el: equityRequired(kind) ? 'Το equity που προσφέρεται' : 'Οι όροι που προσφέρονται, αν υπάρχουν',
    },
    { id: 'offer_time', ok: hours !== null && hours >= 1 && hours <= 80, required: true, en: 'Hours a week', el: 'Ώρες την εβδομάδα' },
    {
      id: 'offer_scope',
      ok: (input.offerScope?.trim().length ?? 0) >= 10 && (input.offerScope?.trim().length ?? 0) <= NEED_CARD_LIMITS.scope,
      required: true,
      en: 'The scope of the role',
      el: 'Το εύρος του ρόλου',
    },
    {
      id: 'filters',
      ok: Boolean(input.category?.trim()) && (Boolean(input.place?.trim()) || input.isRemote === true) && isCardStage(input.stage) && isCardCommitment(input.commitment),
      required: true,
      en: 'Category, place, stage and commitment',
      el: 'Κατηγορία, τόπος, στάδιο και δέσμευση',
    },
    { id: 'contact_free', ok: contact.length === 0, required: true, en: 'No contact details or links', el: 'Χωρίς στοιχεία επικοινωνίας ή συνδέσμους' },
    { id: 'promise_free', ok: !hasPromiseClaims(text), required: true, en: 'No promised returns', el: 'Χωρίς υποσχέσεις αποδόσεων' },
    { id: 'one_screen', ok: screenLength > 0 && screenLength <= NEED_CARD_LIMITS.screen, required: false, en: 'Fits one phone screen', el: 'Χωράει σε μία οθόνη κινητού' },
  ];

  const weight = (check: NeedCheck) => (check.required ? 2 : 1);
  const total = checks.reduce((sum, check) => sum + weight(check), 0);
  const earned = checks.reduce((sum, check) => sum + (check.ok ? weight(check) : 0), 0);
  return {
    checks,
    ready: checks.every((check) => check.ok || !check.required),
    score: Math.round((earned / total) * 100),
    contact,
  };
}

/** Which offer fields differ, ignoring case and spacing. Any one is a new card version. */
export function cardOfferChanges(prev: Partial<NeedCardInput>, next: Partial<NeedCardInput>): Array<(typeof CARD_OFFER_FIELDS)[number]> {
  return CARD_OFFER_FIELDS.filter((field) => field in next && norm(prev[field]) !== norm(next[field]));
}

/** Which terms differ, ignoring case and spacing. Any one is a substantive revision. */
export function termsChanges(prev: Partial<TermsFields>, next: Partial<TermsFields>): TermsField[] {
  return TERMS_FIELDS.filter((field) => norm(prev[field]) !== norm(next[field]));
}

export type TermsProblem =
  | 'role'
  | 'scope'
  | 'equity_range'
  | 'vesting_range'
  | 'cliff_range'
  | 'cliff_after_vesting'
  | 'hours_range'
  | 'contact'
  | 'promise';

/** Problems with a proposal, before any rule about versions. Empty means valid. */
export function validateTerms(fields: Partial<TermsFields>, note?: string | null): TermsProblem[] {
  const problems: TermsProblem[] = [];
  const inRange = (value: unknown, min: number, max: number) =>
    value === null || value === undefined || (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max);
  if (!fields.role?.trim() || fields.role.trim().length > NEED_CARD_LIMITS.role) problems.push('role');
  if (!fields.scope?.trim() || fields.scope.trim().length > NEED_CARD_LIMITS.scope) problems.push('scope');
  if (!inRange(fields.equityPct, 0, 100)) problems.push('equity_range');
  if (!inRange(fields.vestingMonths, 0, 120)) problems.push('vesting_range');
  if (!inRange(fields.cliffMonths, 0, 60)) problems.push('cliff_range');
  if (
    typeof fields.cliffMonths === 'number' &&
    typeof fields.vestingMonths === 'number' &&
    fields.cliffMonths > fields.vestingMonths
  ) {
    problems.push('cliff_after_vesting');
  }
  if (!inRange(fields.hoursPerWeek, 1, 80)) problems.push('hours_range');
  const text = [fields.role, fields.scope, note].filter((part): part is string => typeof part === 'string').join('\n');
  if (contactKinds(text).length) problems.push('contact');
  if (hasPromiseClaims(text)) problems.push('promise');
  return problems;
}

/** Whether another substantive version may be proposed. */
export function canReviseTerms(state: { revisions: number; dealRoomActive: boolean; step: CommitmentStep; versions: number }): {
  ok: boolean;
  reason?: 'frozen' | 'limit' | 'step';
} {
  if (state.dealRoomActive) return { ok: false, reason: 'frozen' };
  if (state.step !== 'terms') return { ok: false, reason: 'step' };
  if (state.versions > 0 && state.revisions >= MAX_TERMS_REVISIONS) return { ok: false, reason: 'limit' };
  return { ok: true };
}

/** Revisions still open: three after the first proposal. */
export function revisionsLeft(state: { revisions: number; versions: number }): number {
  return state.versions === 0 ? MAX_TERMS_REVISIONS : Math.max(0, MAX_TERMS_REVISIONS - state.revisions);
}

/** A card's outcome from its own state and its threads' steps. */
export function deriveCardOutcome(closed: boolean, steps: readonly CommitmentStep[]): CommitmentOutcome {
  if (closed) return 'closed';
  if (steps.includes('agreed')) return 'agreed';
  if (steps.some((step) => step === 'conversation' || step === 'terms')) return 'in_discussion';
  return 'open';
}

/** Interest is welcome while nothing is agreed and the card is not closed. */
export function acceptsInterest(outcome: CommitmentOutcome): boolean {
  return outcome === 'open' || outcome === 'in_discussion';
}

/**
 * How many answers one person may have waiting on authors at once (threads
 * still at `interest`). LinkedIn's Easy Apply made a hundred applications
 * as cheap as one, and authors drowned; a small budget keeps each answer
 * considered. An answer stops counting the moment its author accepts it,
 * or when it is withdrawn.
 */
export const INTEREST_BUDGET = 5;

export function interestBudgetLeft(waiting: number): number {
  return Math.max(0, INTEREST_BUDGET - Math.max(0, waiting));
}

export const INTEREST_BUDGET_COPY = {
  en: `You have ${INTEREST_BUDGET} answers waiting for an author. Wait until one is accepted, or withdraw one, before answering another card.`,
  el: `Έχετε ${INTEREST_BUDGET} απαντήσεις που περιμένουν συντάκτη. Περιμένετε να γίνει δεκτή μία ή αποσύρετε μία πριν απαντήσετε σε άλλη κάρτα.`,
} as const;

/** The ladder applies only where people bind themselves. */
export function ladderApplies(kind: string): kind is CommitmentKind {
  return isCommitmentKind(kind);
}

const DAY_MS = 86_400_000;

/** Days left before a settled card moves to history; null when it is not settled. */
export function daysUntilHistory(settledAt: string | null | undefined, now: number): number | null {
  if (!settledAt) return null;
  const at = Date.parse(settledAt);
  if (!Number.isFinite(at)) return null;
  return Math.ceil((at + SETTLED_VISIBLE_DAYS * DAY_MS - now) / DAY_MS);
}

export function isInHistory(settledAt: string | null | undefined, now: number): boolean {
  const left = daysUntilHistory(settledAt, now);
  return left !== null && left <= 0;
}

/**
 * Where a thread sits on the five-rung ladder the UI draws: interest,
 * conversation, confirmation, terms, agreed. Confirmation is a rung of its
 * own once the viewer has confirmed and is waiting on the other side.
 */
export function ladderRung(step: CommitmentStep, viewerConfirmed: boolean): number {
  switch (step) {
    case 'interest':
      return 0;
    case 'conversation':
      return viewerConfirmed ? 2 : 1;
    case 'terms':
      return 3;
    case 'agreed':
      return 4;
    default:
      return -1;
  }
}
