import type { BilingualPair } from './types';

/**
 * /saved-searches — the searches a founder keeps, and the alerts they raise.
 *
 * «Αναζήτηση» for the search itself and «ειδοποιήσεις» for the alerts, which is
 * the same word the notification settings use — a founder should not have to
 * learn that these are two different things.
 *
 * The alert cadences are adjectives in English ("instant", "daily") and adverbs
 * of frequency in Greek, because that is how a Greek speaker answers "how
 * often": «αμέσως», «καθημερινά», «εβδομαδιαία».
 */
export const SAVED_SEARCHES_STRINGS: Record<string, BilingualPair> = {
  // ── The three counters ──
  stat_searches: { en: 'Saved Searches', el: 'Αποθηκευμένες αναζητήσεις' },
  stat_alerts: { en: 'Active Alerts', el: 'Ενεργές ειδοποιήσεις' },
  stat_new: { en: 'New Results', el: 'Νέα αποτελέσματα' },
  count_line: { en: '{n} saved searches', el: '{n} αποθηκευμένες αναζητήσεις' },
  new_results_suffix: { en: '{n} new results', el: '{n} νέα αποτελέσματα' },
  new_badge: { en: '{n} new', el: '{n} νέα' },
  new_search: { en: 'New Search', el: 'Νέα αναζήτηση' },

  // ── A saved search ──
  results_count: { en: '{n} results', el: '{n} αποτελέσματα' },
  last_run: { en: 'Last run {when}', el: 'Τελευταία εκτέλεση {when}' },
  never_run: { en: 'never', el: 'ποτέ' },
  more_filters: { en: '+{n} more', el: '+{n} ακόμη' },
  run: { en: 'Run', el: 'Εκτέλεση' },
  toggle_alerts: { en: 'Toggle alerts', el: 'Εναλλαγή ειδοποιήσεων' },
  more_actions: { en: 'More actions', el: 'Περισσότερες ενέργειες' },
  edit: { en: 'Edit', el: 'Επεξεργασία' },
  delete: { en: 'Delete', el: 'Διαγραφή' },
  cancel: { en: 'Cancel', el: 'Ακύρωση' },

  // ── Relative time, short because it sits in a row of stats ──
  time_minutes: { en: '{n}m ago', el: 'πριν {n}λ' },
  time_hours: { en: '{n}h ago', el: 'πριν {n}ω' },
  time_days: { en: '{n}d ago', el: 'πριν {n}η' },

  // ── Editing ──
  edit_title: { en: 'Edit Saved Search', el: 'Επεξεργασία αποθηκευμένης αναζήτησης' },
  name_label: { en: 'Search Name', el: 'Όνομα αναζήτησης' },
  name_placeholder: { en: 'My saved search', el: 'Η αναζήτησή μου' },
  frequency_label: { en: 'Alert Frequency', el: 'Συχνότητα ειδοποιήσεων' },
  freq_instant: { en: 'Instant', el: 'Αμέσως' },
  freq_daily: { en: 'Daily', el: 'Καθημερινά' },
  freq_weekly: { en: 'Weekly', el: 'Εβδομαδιαία' },
  save_changes: { en: 'Save Changes', el: 'Αποθήκευση αλλαγών' },

  // ── Deleting ──
  delete_title: { en: 'Delete Saved Search?', el: 'Διαγραφή αποθηκευμένης αναζήτησης;' },
  delete_body: {
    en: 'This will permanently delete this saved search and stop any associated alerts.',
    el: 'Η αναζήτηση θα διαγραφεί οριστικά και οι ειδοποιήσεις της θα σταματήσουν.',
  },

  // ── Feedback ──
  alerts_updated: { en: 'Alert settings updated', el: 'Οι ειδοποιήσεις ενημερώθηκαν' },
  alerts_failed: { en: 'Failed to update alerts', el: 'Οι ειδοποιήσεις δεν ενημερώθηκαν' },
  search_updated: { en: 'Search updated', el: 'Η αναζήτηση ενημερώθηκε' },
  search_update_failed: { en: 'Failed to update search', el: 'Η αναζήτηση δεν ενημερώθηκε' },
  search_deleted: { en: 'Search deleted', el: 'Η αναζήτηση διαγράφηκε' },
  search_delete_failed: { en: 'Failed to delete search', el: 'Η αναζήτηση δεν διαγράφηκε' },

  // ── Emptiness ──
  empty_title: { en: 'No saved searches', el: 'Καμία αποθηκευμένη αναζήτηση' },
  empty_description: {
    en: 'Save your search queries to quickly find matching profiles and get alerts for new results',
    el: 'Αποθηκεύστε τις αναζητήσεις σας για να βρίσκετε γρήγορα προφίλ που ταιριάζουν και να ειδοποιείστε για νέα αποτελέσματα',
  },
  empty_action: { en: 'Create Your First Search', el: 'Δημιουργήστε την πρώτη σας αναζήτηση' },
};

export function savedSearchesEn(key: keyof typeof SAVED_SEARCHES_STRINGS): string {
  return SAVED_SEARCHES_STRINGS[key].en;
}

export function savedSearchesEl(key: keyof typeof SAVED_SEARCHES_STRINGS): string {
  return SAVED_SEARCHES_STRINGS[key].el;
}
