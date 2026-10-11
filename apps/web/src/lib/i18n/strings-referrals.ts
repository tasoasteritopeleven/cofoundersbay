import type { BilingualPair } from './types';

/**
 * /referrals — inviting people you know, and what you get when they stay.
 *
 * «Σύσταση» is the word for a referral in the sense this page means it: one
 * person putting another forward. It is the same word endorsements use, and
 * that is right — both are vouching. The tier names are translated rather than
 * left in English, because they are read as ranks and a rank in a foreign
 * language reads as jargon: «Πρεσβευτής» says what Ambassador says.
 *
 * Money stays in euros and digits; «πίστωση» is the account credit, not a bank
 * term.
 */
export const REFERRALS_STRINGS: Record<string, BilingualPair> = {
  // ── The four counters ──
  stat_invited: { en: 'Invited', el: 'Προσκλήθηκαν' },
  stat_signed_up: { en: 'Signed Up', el: 'Εγγράφηκαν' },
  stat_rewarded: { en: 'Rewarded', el: 'Ανταμείφθηκαν' },
  stat_earned: { en: 'Earned', el: 'Κερδίσατε' },

  // ── The link ──
  link_title: { en: 'Invite people', el: 'Προσκαλέστε ανθρώπους' },
  invite_by_email: { en: 'Invite by email', el: 'Πρόσκληση με email' },
  rewards_note: {
    en: 'Rewards are planned, not live: no credit is paid yet. The tier shows how far your invitations have gone.',
    el: 'Οι ανταμοιβές είναι σχεδιασμένες, όχι ενεργές: δεν καταβάλλεται ακόμη πίστωση. Η βαθμίδα δείχνει πόσο έχουν προχωρήσει οι προσκλήσεις σας.',
  },
  link_description: {
    en: 'Share the sign-up link, or invite someone by email so the invitation is tracked below.',
    el: 'Μοιραστείτε τον σύνδεσμο εγγραφής ή προσκαλέστε κάποιον με email, ώστε η πρόσκληση να φαίνεται παρακάτω.',
  },
  copy: { en: 'Copy', el: 'Αντιγραφή' },
  copied: { en: 'Link copied!', el: 'Ο σύνδεσμος αντιγράφηκε!' },
  share_email: { en: 'Email', el: 'Email' },
  share_subject: { en: 'Join CoFounderBay', el: 'Ελάτε στο CoFounderBay' },
  share_text: {
    en: 'Join me on CoFounderBay — the platform to find your perfect co-founder!',
    el: 'Ελάτε μαζί μου στο CoFounderBay — η πλατφόρμα για να βρείτε τον ιδανικό συνιδρυτή!',
  },

  // ── Tiers ──
  tier_title: { en: 'Your Tier', el: 'Η βαθμίδα σας' },
  tier_starter: { en: 'Starter', el: 'Ξεκίνημα' },
  tier_connector: { en: 'Connector', el: 'Συνδετής' },
  tier_ambassador: { en: 'Ambassador', el: 'Πρεσβευτής' },
  tier_champion: { en: 'Champion', el: 'Πρωταθλητής' },
  multiplier: { en: '{n}x reward multiplier', el: 'πολλαπλασιαστής ανταμοιβής {n}x' },
  progress_to: { en: 'Progress to {tier}', el: 'Πρόοδος προς {tier}' },
  more_to_unlock: {
    en: '{n} more referrals to unlock {tier}',
    el: '{n} ακόμη συστάσεις για {tier}',
  },
  perks_title: { en: 'Your Perks', el: 'Τα προνόμιά σας' },
  perk_credit: { en: '€{n} credit per referral', el: 'πίστωση €{n} ανά σύσταση' },
  perk_priority_support: { en: 'Priority support', el: 'Υποστήριξη κατά προτεραιότητα' },
  perk_exclusive_events: { en: 'Exclusive events', el: 'Αποκλειστικές εκδηλώσεις' },
  perk_featured_profile: { en: 'Featured profile', el: 'Προβεβλημένο προφίλ' },

  // ── The list and its statuses ──
  list_title: { en: 'Your Referrals', el: 'Οι συστάσεις σας' },
  tab_all: { en: 'All', el: 'Όλες' },
  tab_pending: { en: 'Pending', el: 'Σε εκκρεμότητα' },
  tab_rewarded: { en: 'Rewarded', el: 'Ανταμείφθηκαν' },
  empty_list: { en: 'No referrals in this category', el: 'Καμία σύσταση σε αυτή την κατηγορία' },
  status_pending: { en: 'Pending', el: 'Σε εκκρεμότητα' },
  status_signed_up: { en: 'Signed Up', el: 'Εγγράφηκε' },
  status_active: { en: 'Active', el: 'Ενεργός' },
  status_rewarded: { en: 'Rewarded', el: 'Ανταμείφθηκε' },
  status_expired: { en: 'Expired', el: 'Έληξε' },

  // ── How it works ──
  how_title: { en: 'How It Works', el: 'Πώς λειτουργεί' },
  step1_title: { en: 'Share your link', el: 'Μοιραστείτε τον σύνδεσμό σας' },
  step1_body: {
    en: 'Share the sign-up link, or send an email invite that is tracked here',
    el: 'Μοιραστείτε τον σύνδεσμο εγγραφής ή στείλτε πρόσκληση με email που καταγράφεται εδώ',
  },
  step2_title: { en: 'They sign up', el: 'Εγγράφονται' },
  step2_body: {
    en: 'An email invite shows as signed up once they create their account',
    el: 'Μια πρόσκληση με email εμφανίζεται ως εγγραφή μόλις δημιουργήσουν λογαριασμό',
  },
  step3_title: { en: 'Rewards come later', el: 'Οι ανταμοιβές έρχονται αργότερα' },
  step3_body: {
    en: 'Credits are planned; for now your tier records how far your invitations have gone',
    el: 'Οι πιστώσεις είναι σχεδιασμένες· προς το παρόν η βαθμίδα καταγράφει πόσο έχουν προχωρήσει οι προσκλήσεις σας',
  },
};

export function referralsEn(key: keyof typeof REFERRALS_STRINGS): string {
  return REFERRALS_STRINGS[key].en;
}

export function referralsEl(key: keyof typeof REFERRALS_STRINGS): string {
  return REFERRALS_STRINGS[key].el;
}
