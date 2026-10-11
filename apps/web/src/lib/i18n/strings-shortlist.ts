import type { BilingualPair } from './types';

/**
 * /shortlist — the profiles a founder has set aside to come back to.
 *
 * Greek that a founder here would actually use, not a word-for-word rendering:
 * "shortlist" is the working list you keep while you are still deciding, which
 * in Greek reads as «λίστα» with the sense carried by the surrounding sentence
 * rather than by a coined compound.
 */
export const SHORTLIST_STRINGS: Record<string, BilingualPair> = {
  page_title: { en: 'Saved Profiles', el: 'Αποθηκευμένα προφίλ' },
  page_description: {
    en: "Profiles you've bookmarked to revisit, compare, and reach out to",
    el: 'Προφίλ που κρατήσατε για να τα ξαναδείτε, να τα συγκρίνετε και να επικοινωνήσετε',
  },

  // ── The private note ──
  note_placeholder: {
    en: 'Add a private note about this person…',
    el: 'Προσθέστε ιδιωτική σημείωση για αυτό το άτομο…',
  },
  note_edit: { en: 'Edit note', el: 'Επεξεργασία σημείωσης' },
  saving: { en: 'Saving…', el: 'Αποθήκευση…' },
  save: { en: 'Save', el: 'Αποθήκευση' },
  cancel: { en: 'Cancel', el: 'Ακύρωση' },

  // ── Row actions ──
  message: { en: 'Message', el: 'Μήνυμα' },
  view_profile: { en: 'View profile', el: 'Προβολή προφίλ' },
  remove: { en: 'Remove', el: 'Αφαίρεση' },
  compare: { en: 'Compare', el: 'Σύγκριση' },
  label: { en: 'Label:', el: 'Ετικέτα:' },

  // ── Search and sort ──
  search_placeholder: {
    en: 'Search saved profiles…',
    el: 'Αναζήτηση στα αποθηκευμένα…',
  },
  sort_newest: { en: 'Newest first', el: 'Νεότερα πρώτα' },
  sort_oldest: { en: 'Oldest first', el: 'Παλαιότερα πρώτα' },
  sort_name: { en: 'Name A–Z', el: 'Όνομα Α–Ω' },
  sort_match: { en: 'Best match', el: 'Καλύτερη αντιστοίχιση' },

  // ── Comparison bar ──
  compare_now: { en: 'Compare now', el: 'Σύγκριση τώρα' },

  // ── Failure and emptiness ──
  load_failed: {
    en: 'Failed to load shortlist.',
    el: 'Η λίστα δεν φορτώθηκε.',
  },
  retry: { en: 'Retry', el: 'Επανάληψη' },
  browse_matches: { en: 'Browse matches', el: 'Περιήγηση αντιστοιχίσεων' },
  ask_ai: { en: 'Ask AI', el: 'Ρωτήστε το AI' },

  // ── Role tabs ──
  role_all: { en: 'All', el: 'Όλα' },
  role_founder: { en: 'Founders', el: 'Ιδρυτές' },
  role_cofounder: { en: 'Co-founders', el: 'Συνιδρυτές' },
  role_mentor: { en: 'Mentors', el: 'Μέντορες' },
  role_investor: { en: 'Investors', el: 'Επενδυτές' },
  role_org: { en: 'Orgs', el: 'Οργανισμοί' },

  // ── The four counters above the list ──
  stat_total: { en: 'Total saved', el: 'Σύνολο αποθηκευμένων' },
  stat_notes: { en: 'With notes', el: 'Με σημειώσεις' },
  stat_avg_match: { en: 'Avg match score', el: 'Μέση αντιστοίχιση' },
  stat_roles: { en: 'Roles covered', el: 'Ρόλοι που καλύπτονται' },

  // ── Comparison mode and the count line ──
  compare_start: { en: 'Compare', el: 'Σύγκριση' },
  compare_cancel: { en: 'Cancel compare', el: 'Ακύρωση σύγκρισης' },
  showing_of: { en: 'Showing {shown} of {total} profiles', el: 'Εμφανίζονται {shown} από {total} προφίλ' },
  selected_max: { en: '{n} profiles selected (max 3)', el: '{n} προφίλ επιλεγμένα (έως 3)' },

  // ── The label a founder puts on someone while deciding ──
  status_hot: { en: 'Hot lead', el: 'Ζεστή επαφή' },
  status_follow_up: { en: 'Follow up', el: 'Επανεπικοινωνία' },
  status_contacted: { en: 'Contacted', el: 'Επικοινωνήσαμε' },
  status_not_relevant: { en: 'Not relevant', el: 'Μη σχετικό' },

  match_suffix: { en: 'match', el: 'αντιστοίχιση' },
  saved_on: { en: 'Saved {date}', el: 'Αποθηκεύτηκε {date}' },
};

export function shortlistEn(key: keyof typeof SHORTLIST_STRINGS): string {
  return SHORTLIST_STRINGS[key].en;
}

export function shortlistEl(key: keyof typeof SHORTLIST_STRINGS): string {
  return SHORTLIST_STRINGS[key].el;
}
