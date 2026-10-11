/**
 * Referral rewards follow confirmed activity, never a sign-up alone.
 *
 * An invitation counts toward rewards once the person who accepted it has
 * verified their email and taken one real step on the platform: an accepted
 * connection, a published need card, a completed milestone, or an answer
 * to someone's need card. A sign-up that does nothing earns nothing, so
 * inviting in bulk is not worth anyone's while.
 */

export const REFERRAL_POINTS_PER_ACTIVE = 10;

export type ReferralActivity = 'connection' | 'need_card' | 'milestone' | 'interest';

export function isActiveReferral(invitee: { emailVerified: boolean; activity: readonly ReferralActivity[] }): boolean {
  return invitee.emailVerified && invitee.activity.length > 0;
}

export function referralPoints(activeReferrals: number): number {
  return Math.max(0, Math.floor(activeReferrals)) * REFERRAL_POINTS_PER_ACTIVE;
}

export const REFERRAL_REWARD_COPY = {
  en: 'An invitation counts once the person has verified their email and taken a first real step: a connection, a need card, a milestone or an answer to a card. A sign-up alone earns nothing.',
  el: 'Μια πρόσκληση μετράει όταν ο/η προσκεκλημένος/η επαληθεύσει το email του/της και κάνει ένα πρώτο πραγματικό βήμα: μια σύνδεση, μια κάρτα ανάγκης, ένα ορόσημο ή μια απάντηση σε κάρτα. Η εγγραφή μόνη της δεν αποφέρει τίποτα.',
} as const;
