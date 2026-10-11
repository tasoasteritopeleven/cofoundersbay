import { contactKinds } from '../commitments/contact';
import { hasPromiseClaims } from '../commitments/promises';

/**
 * Warm introductions, with consent at every hop.
 *
 * LinkedIn sells this as TeamLink inside Sales Navigator: it shows who could
 * introduce you and leaves the asking to email. Here a founder asks someone
 * they already know — a connection, their mentor or mentee, a cohort-mate —
 * to introduce them to someone *that* person knows, for one of the founder's
 * own need cards. The intermediary decides whether to forward; the person
 * introduced decides whether to answer, and answering is expressing interest
 * on the card, so the conversation continues on the commitment ladder (the
 * protected first conversation, then terms) rather than in a cold inbox.
 *
 * Nobody is asked twice for the same introduction, a founder has at most
 * `INTRO_LIMITS.openPerRequester` waiting at once, and a decline is never
 * explained to the founder: "not forwarded" is the whole answer.
 */

export const INTRO_STATUSES = ['pending', 'forwarded', 'declined', 'accepted', 'not_now', 'withdrawn'] as const;
export type IntroStatus = (typeof INTRO_STATUSES)[number];

/** Requests still waiting on someone. */
export const OPEN_INTRO_STATUSES: readonly IntroStatus[] = ['pending', 'forwarded'];

export const INTRO_LIMITS = { note: 600, forwardNote: 300, openPerRequester: 5 } as const;

export type IntroRelation = 'connection' | 'mentor' | 'cohort';
export type IntroRole = 'requester' | 'intermediary' | 'target';
export type IntroAction = 'withdraw' | 'forward' | 'decline' | 'accept' | 'not_now';

export type IntroProblem = 'people' | 'self' | 'card' | 'note' | 'note_too_long' | 'contact' | 'promise';

export interface IntroRequestInput {
  intermediaryId: string;
  targetId: string;
  cardId: string;
  note: string;
}

/** Validates a request: three different people, a card, and a note with no contact details or promises. */
export function readIntroRequest(raw: unknown, requesterId: string): { ok: true; value: IntroRequestInput } | { ok: false; problems: IntroProblem[] } {
  const b = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const value = { intermediaryId: str(b.intermediaryId), targetId: str(b.targetId), cardId: str(b.cardId), note: str(b.note) };
  const problems: IntroProblem[] = [];
  if (!value.intermediaryId || !value.targetId) problems.push('people');
  else if (new Set([requesterId, value.intermediaryId, value.targetId]).size < 3) problems.push('self');
  if (!value.cardId) problems.push('card');
  if (!value.note) problems.push('note');
  if (value.note.length > INTRO_LIMITS.note) problems.push('note_too_long');
  if (value.note && contactKinds(value.note).length) problems.push('contact');
  if (value.note && hasPromiseClaims(value.note)) problems.push('promise');
  return problems.length ? { ok: false, problems } : { ok: true, value };
}

/** The intermediary's optional line to the target, under the same rules. */
export function readForwardNote(raw: unknown): { ok: true; value: string | null } | { ok: false; problems: IntroProblem[] } {
  const note = typeof (raw as { note?: unknown })?.note === 'string' ? ((raw as { note: string }).note).trim() : '';
  const problems: IntroProblem[] = [];
  if (note.length > INTRO_LIMITS.forwardNote) problems.push('note_too_long');
  if (note && contactKinds(note).length) problems.push('contact');
  if (note && hasPromiseClaims(note)) problems.push('promise');
  return problems.length ? { ok: false, problems } : { ok: true, value: note || null };
}

/** Who may do what, and what it leads to. `null` is a refusal. */
export function introTransition(status: IntroStatus, role: IntroRole, action: IntroAction): IntroStatus | null {
  if (role === 'requester' && action === 'withdraw' && status === 'pending') return 'withdrawn';
  if (role === 'intermediary' && status === 'pending') {
    if (action === 'forward') return 'forwarded';
    if (action === 'decline') return 'declined';
  }
  if (role === 'target' && status === 'forwarded') {
    if (action === 'accept') return 'accepted';
    if (action === 'not_now') return 'not_now';
  }
  return null;
}

/** What the founder is told: a decline is "not forwarded", without a reason. */
export function introStatusForRequester(status: IntroStatus): IntroStatus | 'not_forwarded' {
  return status === 'declined' ? 'not_forwarded' : status;
}

export interface IntroGraph {
  /** Accepted connections, as pairs of user ids (either order). */
  connections: ReadonlyArray<readonly [string, string]>;
  /** Mentoring relationships that are or were active. */
  mentorships: ReadonlyArray<{ mentorId: string; menteeId: string }>;
  /** Cohort memberships. */
  cohorts: ReadonlyArray<{ cohortId: string; userId: string }>;
}

export interface IntroPath {
  intermediaryId: string;
  /** How the founder knows the intermediary. */
  toRequester: IntroRelation[];
  /** How the intermediary knows the target. */
  toTarget: IntroRelation[];
}

function relationsOf(graph: IntroGraph, a: string): Map<string, Set<IntroRelation>> {
  const out = new Map<string, Set<IntroRelation>>();
  const add = (other: string, rel: IntroRelation) => {
    if (other === a) return;
    if (!out.has(other)) out.set(other, new Set());
    out.get(other)!.add(rel);
  };
  for (const [x, y] of graph.connections) {
    if (x === a) add(y, 'connection');
    else if (y === a) add(x, 'connection');
  }
  for (const m of graph.mentorships) {
    if (m.mentorId === a) add(m.menteeId, 'mentor');
    else if (m.menteeId === a) add(m.mentorId, 'mentor');
  }
  const mine = new Set(graph.cohorts.filter((c) => c.userId === a).map((c) => c.cohortId));
  for (const c of graph.cohorts) if (mine.has(c.cohortId)) add(c.userId, 'cohort');
  return out;
}

const ORDER: IntroRelation[] = ['connection', 'mentor', 'cohort'];
const sorted = (s: Set<IntroRelation>) => ORDER.filter((r) => s.has(r));

/**
 * The people who know both the founder and the target, strongest first: two
 * relations beat one, a connection beats a cohort. Neither the founder nor
 * the target is ever their own intermediary.
 */
/** Whether the founder already knows the target directly, so no introduction is needed. */
export function knowsDirectly(graph: IntroGraph, requesterId: string, targetId: string): boolean {
  return relationsOf(graph, requesterId).has(targetId);
}

export function introPaths(graph: IntroGraph, requesterId: string, targetId: string): IntroPath[] {
  if (requesterId === targetId) return [];
  const mine = relationsOf(graph, requesterId);
  const theirs = relationsOf(graph, targetId);
  const paths: IntroPath[] = [];
  for (const [person, rels] of mine) {
    if (person === targetId || person === requesterId) continue;
    const toTarget = theirs.get(person);
    if (!toTarget) continue;
    paths.push({ intermediaryId: person, toRequester: sorted(rels), toTarget: sorted(toTarget) });
  }
  const weight = (p: IntroPath) =>
    p.toRequester.length + p.toTarget.length + (p.toRequester.includes('connection') ? 0.5 : 0) + (p.toTarget.includes('connection') ? 0.5 : 0);
  return paths.sort((a, b) => weight(b) - weight(a) || a.intermediaryId.localeCompare(b.intermediaryId));
}

export const INTRO_RELATION_COPY: Record<IntroRelation, { en: string; el: string }> = {
  connection: { en: 'connection', el: 'σύνδεση' },
  mentor: { en: 'mentoring', el: 'καθοδήγηση' },
  cohort: { en: 'same cohort', el: 'ίδιος κύκλος' },
};

export const INTRO_STATUS_COPY: Record<IntroStatus | 'not_forwarded', { en: string; el: string }> = {
  pending: { en: 'Waiting on the intermediary', el: 'Περιμένει τον ενδιάμεσο' },
  forwarded: { en: 'Forwarded', el: 'Προωθήθηκε' },
  declined: { en: 'Declined', el: 'Απορρίφθηκε' },
  not_forwarded: { en: 'Not forwarded', el: 'Δεν προωθήθηκε' },
  accepted: { en: 'Accepted: on the ladder', el: 'Αποδεκτή: στην κλίμακα' },
  not_now: { en: 'Not now', el: 'Όχι τώρα' },
  withdrawn: { en: 'Withdrawn', el: 'Αποσύρθηκε' },
};

export const INTRO_PROBLEM_COPY: Record<IntroProblem, { en: string; el: string }> = {
  people: { en: 'Choose who introduces you, and to whom.', el: 'Επιλέξτε ποιος θα σας συστήσει και σε ποιον.' },
  self: { en: 'The three people in an introduction must be different.', el: 'Τα τρία πρόσωπα μιας σύστασης πρέπει να είναι διαφορετικά.' },
  card: { en: 'Choose the need card the introduction is for.', el: 'Επιλέξτε την κάρτα ανάγκης για την οποία είναι η σύσταση.' },
  note: { en: 'Say in a sentence or two why this introduction, and why now.', el: 'Πείτε σε μία-δύο προτάσεις γιατί αυτή η σύσταση και γιατί τώρα.' },
  note_too_long: { en: 'Keep the note short.', el: 'Κρατήστε τη σημείωση σύντομη.' },
  contact: { en: 'Leave contact details out; the conversation continues on the platform.', el: 'Χωρίς στοιχεία επικοινωνίας· η συζήτηση συνεχίζει μέσα στην πλατφόρμα.' },
  promise: { en: 'Remove promised returns from the note.', el: 'Αφαιρέστε τις υποσχέσεις αποδόσεων από τη σημείωση.' },
};
