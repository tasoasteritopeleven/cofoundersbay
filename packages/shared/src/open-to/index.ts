import { contactKinds } from '../commitments/contact';
import { hasPromiseClaims } from '../commitments/promises';

/**
 * "Open to": a quiet signal that someone would take a co-founder seat, advise,
 * invest as an angel or mentor.
 *
 * LinkedIn's #OpenToWork frame is public and reads as a stigma to many
 * people. Here the signal feeds matching first; whether anyone *sees* it is
 * the person's choice in three steps — nobody (matching only, the default),
 * verified members, or everyone — and even then it is a line on the profile,
 * never a frame on the photo. It lapses after `OPEN_TO_DAYS` unless renewed,
 * so ranking never leans on intent someone forgot they declared.
 */

export const OPEN_TO_KINDS = ['cofounder', 'advisor', 'angel', 'mentor'] as const;
export type OpenToKind = (typeof OPEN_TO_KINDS)[number];

export const OPEN_TO_VISIBILITIES = ['nobody', 'verified', 'everyone'] as const;
export type OpenToVisibility = (typeof OPEN_TO_VISIBILITIES)[number];

export const OPEN_TO_DAYS = 90;
export const OPEN_TO_NOTE_MAX = 160;

export interface OpenToSignal {
  kinds: OpenToKind[];
  visibility: OpenToVisibility;
  note: string | null;
  expiresAt: string;
}

export type OpenToProblem = 'kinds' | 'note_too_long' | 'contact' | 'promise';

export function isOpenToKind(value: unknown): value is OpenToKind {
  return typeof value === 'string' && (OPEN_TO_KINDS as readonly string[]).includes(value);
}

/** Validates a submitted signal: at least one kind, a short note with no contact details or promises. */
export function readOpenTo(raw: unknown): { ok: true; value: Omit<OpenToSignal, 'expiresAt'> } | { ok: false; problems: OpenToProblem[] } {
  const b = (raw ?? {}) as Record<string, unknown>;
  const kinds = [...new Set((Array.isArray(b.kinds) ? b.kinds : []).filter(isOpenToKind))];
  const note = typeof b.note === 'string' ? b.note.trim() : '';
  const visibility: OpenToVisibility = (OPEN_TO_VISIBILITIES as readonly string[]).includes(b.visibility as string) ? (b.visibility as OpenToVisibility) : 'nobody';
  const problems: OpenToProblem[] = [];
  if (!kinds.length) problems.push('kinds');
  if (note.length > OPEN_TO_NOTE_MAX) problems.push('note_too_long');
  if (note && contactKinds(note).length) problems.push('contact');
  if (note && hasPromiseClaims(note)) problems.push('promise');
  if (problems.length) return { ok: false, problems };
  // Keep the canonical order so two equal signals compare equal.
  return { ok: true, value: { kinds: OPEN_TO_KINDS.filter((k) => kinds.includes(k)), visibility, note: note || null } };
}

export function openToActive(signal: Pick<OpenToSignal, 'expiresAt'> | null | undefined, now = Date.now()): boolean {
  return !!signal && Date.parse(signal.expiresAt) > now;
}

export function openToExpiry(now = Date.now()): string {
  return new Date(now + OPEN_TO_DAYS * 86_400_000).toISOString();
}

/**
 * What a viewer may see of someone's signal: the kinds, or nothing. The owner
 * always sees their own; others see it only when its visibility allows, and
 * a lapsed signal shows to nobody.
 */
export function openToShownTo(
  signal: OpenToSignal | null | undefined,
  viewer: { isOwner: boolean; verified: boolean },
  now = Date.now(),
): OpenToKind[] {
  if (!signal) return [];
  if (viewer.isOwner) return signal.kinds;
  if (!openToActive(signal, now)) return [];
  if (signal.visibility === 'everyone') return signal.kinds;
  if (signal.visibility === 'verified' && viewer.verified) return signal.kinds;
  return [];
}

/**
 * What a seeker is looking for, in the signal's words. `MatchProfile.lookingForRoles`
 * says "investor" where the signal says "angel"; a founder with no stated
 * preference is looking for a co-founder first.
 */
export function seekerWants(lookingForRoles: readonly string[] | null | undefined, seekerRole?: string | null): OpenToKind[] {
  const map: Record<string, OpenToKind> = { cofounder: 'cofounder', 'co-founder': 'cofounder', advisor: 'advisor', investor: 'angel', angel: 'angel', mentor: 'mentor' };
  const wants = [...new Set((lookingForRoles ?? []).map((r) => map[String(r).toLowerCase()]).filter((k): k is OpenToKind => !!k))];
  if (wants.length) return wants;
  return seekerRole === 'founder' ? ['cofounder', 'advisor'] : [];
}

/**
 * How much an active signal lifts a candidate for this seeker: 0 when it is
 * lapsed or offers nothing the seeker wants, up to `OPEN_TO_BOOST` when it
 * covers all of it. Small on purpose: it orders people who already fit; it
 * never makes a poor fit look good.
 */
export const OPEN_TO_BOOST = 0.08;
export function openToBoost(signal: OpenToSignal | null | undefined, wants: readonly OpenToKind[], now = Date.now()): number {
  if (!signal || !openToActive(signal, now) || !wants.length) return 0;
  const hits = wants.filter((w) => signal.kinds.includes(w)).length;
  return hits ? OPEN_TO_BOOST * (hits / wants.length) : 0;
}

export const OPEN_TO_COPY: Record<OpenToKind, { en: string; el: string }> = {
  cofounder: { en: 'Co-founding', el: 'Συνίδρυση' },
  advisor: { en: 'Advising', el: 'Συμβουλευτικό ρόλο' },
  angel: { en: 'Angel investing', el: 'Επένδυση ως angel' },
  mentor: { en: 'Mentoring', el: 'Καθοδήγηση' },
};

export const OPEN_TO_VISIBILITY_COPY: Record<OpenToVisibility, { en: string; el: string; hintEn: string; hintEl: string }> = {
  nobody: {
    en: 'Matching only',
    el: 'Μόνο για τις αντιστοιχίσεις',
    hintEn: 'Nobody sees it. It only helps the right people find you.',
    hintEl: 'Δεν το βλέπει κανείς. Βοηθά μόνο να σας βρουν οι κατάλληλοι.',
  },
  verified: {
    en: 'Verified members',
    el: 'Επαληθευμένα μέλη',
    hintEn: 'A line on your profile, shown only to members who verified who they are.',
    hintEl: 'Μια γραμμή στο προφίλ σας, μόνο για μέλη που έχουν επαληθευτεί.',
  },
  everyone: {
    en: 'Everyone signed in',
    el: 'Όλα τα συνδεδεμένα μέλη',
    hintEn: 'A line on your profile for every member. Never a frame on your photo.',
    hintEl: 'Μια γραμμή στο προφίλ σας για κάθε μέλος. Ποτέ πλαίσιο στη φωτογραφία.',
  },
};

export const OPEN_TO_PROBLEM_COPY: Record<OpenToProblem, { en: string; el: string }> = {
  kinds: { en: 'Choose at least one thing you are open to.', el: 'Επιλέξτε τουλάχιστον ένα πράγμα στο οποίο είστε ανοιχτοί.' },
  note_too_long: { en: `Keep the note under ${OPEN_TO_NOTE_MAX} characters.`, el: `Η σημείωση έως ${OPEN_TO_NOTE_MAX} χαρακτήρες.` },
  contact: { en: 'Leave contact details out; people reach you through the platform.', el: 'Χωρίς στοιχεία επικοινωνίας· σας βρίσκουν μέσα από την πλατφόρμα.' },
  promise: { en: 'Remove promised returns from the note.', el: 'Αφαιρέστε τις υποσχέσεις αποδόσεων από τη σημείωση.' },
};
