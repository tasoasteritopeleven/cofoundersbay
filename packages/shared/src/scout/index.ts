import { contactKinds } from '../commitments/contact';
import { hasPromiseClaims } from '../commitments/promises';
import { CARD_COMMITMENTS, CARD_STAGES, type CardCommitment, type CardStage } from '../commitments/model';
import { sameSkill } from '../evidence';
import type { OpenToKind } from '../open-to';

/**
 * The co-founder scout: an agent that proposes, and never sends.
 *
 * A founder writes a brief — the role, the skills, where, how much time, at
 * what stage — and the scout reads the member base against it and proposes a
 * handful of people, each with the reasons it chose them and a first note the
 * founder may use. It does not message, connect, follow or express interest
 * on anyone's behalf; it does not tell the people it proposes. What happens
 * next is the founder's own click: open the profile, save to the shortlist,
 * ask for an introduction, or dismiss (a dismissed person is not proposed
 * again).
 *
 * The scoring is deterministic and explainable on purpose: each point has a
 * reason the founder can read, and an "Open to" signal counts toward the
 * ranking but is only *named* where its owner's visibility allows.
 */

export const SCOUT_LIMITS = { role: 80, skills: 8, skill: 40, place: 60, note: 280, proposalsPerRun: 5, minScore: 30 } as const;

export interface ScoutBrief {
  role: string;
  skills: string[];
  place: string | null;
  remoteOk: boolean;
  commitment: CardCommitment | null;
  stage: CardStage | null;
  note: string | null;
  active: boolean;
}

export type ScoutProblem = 'role' | 'too_long' | 'contact' | 'promise';

export function readScoutBrief(raw: unknown): { ok: true; value: ScoutBrief } | { ok: false; problems: ScoutProblem[] } {
  const b = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const role = str(b.role);
  const skillsRaw = Array.isArray(b.skills) ? b.skills : typeof b.skills === 'string' ? b.skills.split(',') : [];
  const skills: string[] = [];
  for (const s of skillsRaw) {
    const v = str(s);
    if (v && !skills.some((x) => sameSkill(x, v))) skills.push(v);
  }
  const place = str(b.place);
  const note = str(b.note);
  const problems: ScoutProblem[] = [];
  if (!role) problems.push('role');
  if (role.length > SCOUT_LIMITS.role || skills.length > SCOUT_LIMITS.skills || skills.some((s) => s.length > SCOUT_LIMITS.skill) || place.length > SCOUT_LIMITS.place || note.length > SCOUT_LIMITS.note) {
    problems.push('too_long');
  }
  const text = [role, note, ...skills].join('\n');
  if (contactKinds(text).length) problems.push('contact');
  if (hasPromiseClaims(text)) problems.push('promise');
  if (problems.length) return { ok: false, problems };
  return {
    ok: true,
    value: {
      role,
      skills,
      place: place || null,
      remoteOk: b.remoteOk !== false,
      commitment: (CARD_COMMITMENTS as readonly string[]).includes(b.commitment as string) ? (b.commitment as CardCommitment) : null,
      stage: (CARD_STAGES as readonly string[]).includes(b.stage as string) ? (b.stage as CardStage) : null,
      note: note || null,
      active: b.active !== false,
    },
  };
}

export interface ScoutCandidate {
  userId: string;
  displayName: string;
  headline: string | null;
  location: string | null;
  skills: string[];
  /** Active "Open to" kinds, whatever their visibility: they count toward ranking. */
  openTo: OpenToKind[];
  /** The kinds this founder may see named, per the signal's own visibility. */
  openToVisible: OpenToKind[];
  verified: boolean;
}

export interface ScoutReason {
  en: string;
  el: string;
}

/** Words every founder-side headline shares; matching on them would match everyone. */
const GENERIC = new Set(['founder', 'founders', 'cofounder', 'co-founder', 'the', 'and', 'for', 'with', 'someone', 'person', 'partner', 'συνιδρυτής', 'συνιδρυτή', 'ιδρυτής', 'ιδρυτή']);
const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^\p{L}\p{N}+#]+/u)
    .filter((w) => w.length > 2 && !GENERIC.has(w));

/** 0–100, with a reason for every part of the score the founder may see. */
export function scoreScoutCandidate(brief: ScoutBrief, c: ScoutCandidate): { score: number; reasons: ScoutReason[] } {
  const reasons: ScoutReason[] = [];
  let score = 0;

  const matched = brief.skills.filter((s) => c.skills.some((cs) => sameSkill(cs, s)));
  if (brief.skills.length && matched.length) {
    score += Math.round((50 * matched.length) / brief.skills.length);
    reasons.push({ en: `Skills you asked for: ${matched.join(', ')}`, el: `Δεξιότητες που ζητήσατε: ${matched.join(', ')}` });
  }

  const roleWords = words(brief.role);
  const headline = words(c.headline ?? '');
  if (roleWords.length && roleWords.some((w) => headline.includes(w))) {
    score += 15;
    reasons.push({ en: 'Their headline matches the role', el: 'Ο τίτλος του/της ταιριάζει με τον ρόλο' });
  }

  const here = (brief.place ?? '').toLowerCase();
  const there = (c.location ?? '').toLowerCase();
  if (here && there && (there.includes(here) || here.includes(there))) {
    score += 15;
    reasons.push({ en: `In ${c.location}`, el: `Στην περιοχή: ${c.location}` });
  } else if (brief.remoteOk) {
    score += 5;
  }

  if (c.openTo.includes('cofounder')) {
    score += 10;
    if (c.openToVisible.includes('cofounder')) reasons.push({ en: 'Open to co-founding', el: 'Ανοιχτός/ή σε συνίδρυση' });
  }

  if (c.verified) {
    score += 10;
    reasons.push({ en: 'Verified', el: 'Επαληθευμένος/η' });
  }

  return { score: Math.min(100, score), reasons };
}

/**
 * A first note the founder may send themselves, in their language. It names
 * the role and what stood out, asks for a conversation on the platform, and
 * carries no contact details and no promises.
 */
export function draftScoutNote(brief: ScoutBrief, c: Pick<ScoutCandidate, 'displayName' | 'skills'>, lang: 'en' | 'el' = 'en'): string {
  const first = c.displayName.split(/\s+/)[0] || c.displayName;
  const matched = brief.skills.filter((s) => c.skills.some((cs) => sameSkill(cs, s))).slice(0, 3);
  if (lang === 'el') {
    return [
      `Γεια σας ${first}, ψάχνω ${brief.role}${brief.stage ? ` για startup στο στάδιο «${brief.stage}»` : ''}.`,
      matched.length ? `Μου έκανε εντύπωση η εμπειρία σας σε ${matched.join(', ')}.` : 'Το προφίλ σας μου έκανε εντύπωση.',
      'Θα σας ενδιέφερε μια σύντομη συζήτηση εδώ στο CoFounderBay;',
    ].join(' ');
  }
  return [
    `Hi ${first}, I am looking for a ${brief.role}${brief.stage ? ` for a startup at the ${brief.stage} stage` : ''}.`,
    matched.length ? `Your work in ${matched.join(', ')} stood out.` : 'Your profile stood out.',
    'Would you be open to a short conversation here on CoFounderBay?',
  ].join(' ');
}

/** Best first, at most `limit`, never below `SCOUT_LIMITS.minScore`. */
export function pickScoutProposals<T extends { score: number }>(scored: readonly T[], limit: number = SCOUT_LIMITS.proposalsPerRun): T[] {
  return [...scored].filter((s) => s.score >= SCOUT_LIMITS.minScore).sort((a, b) => b.score - a.score).slice(0, limit);
}

export const SCOUT_PROBLEM_COPY: Record<ScoutProblem, { en: string; el: string }> = {
  role: { en: 'Name the role you are looking for.', el: 'Ονομάστε τον ρόλο που ψάχνετε.' },
  too_long: { en: 'Keep the brief short: a role, up to eight skills, a short note.', el: 'Σύντομο σημείωμα: ένας ρόλος, έως οκτώ δεξιότητες, μια σύντομη σημείωση.' },
  contact: { en: 'Leave contact details out of the brief.', el: 'Χωρίς στοιχεία επικοινωνίας στο σημείωμα.' },
  promise: { en: 'Remove promised returns from the brief.', el: 'Αφαιρέστε τις υποσχέσεις αποδόσεων από το σημείωμα.' },
};

/**
 * A scout brief started from one of the founder's own need cards: the role
 * offered, where, how much time and at what stage, with the "who is
 * missing" sentence as the note. Skills are left for the founder to add;
 * nothing is saved until they press Save on /scout.
 */
export function briefFromNeedCard(card: {
  offer?: { role?: string | null } | null;
  place?: string | null;
  isRemote?: boolean;
  commitment?: string | null;
  stage?: string | null;
  missing?: string | null;
}): { role: string; place: string; commitment: string; stage: string; note: string; remoteOk: boolean } {
  const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n).trimEnd() : s);
  return {
    role: clip(String(card.offer?.role ?? '').trim(), SCOUT_LIMITS.role),
    place: clip(String(card.place ?? '').trim(), SCOUT_LIMITS.place),
    commitment: (CARD_COMMITMENTS as readonly string[]).includes(String(card.commitment)) ? String(card.commitment) : '',
    stage: (CARD_STAGES as readonly string[]).includes(String(card.stage)) ? String(card.stage) : '',
    note: clip(String(card.missing ?? '').trim(), SCOUT_LIMITS.note),
    remoteOk: card.isRemote !== false,
  };
}
