import type { BilingualPair } from './types';

/**
 * Discover / Explore page — bilingual EN + EL.
 */
export const DISCOVER_STRINGS: Record<string, BilingualPair> = {
  page_title: { en: 'Explore', el: 'Εξερεύνηση' },
  page_description: {
    en: 'Discover founders, mentors, investors, and team members',
    el: 'Ανακαλύψτε ιδρυτές, μέντορες, επενδυτές και μέλη ομάδας',
  },
  view_matches: { en: 'View Matches', el: 'Προβολή αντιστοιχίσεων' },

  // tabs
  search: { en: 'Search', el: 'Αναζήτηση' },
  for_you: { en: 'For You', el: 'Για εσάς' },
  top_matches: { en: 'Top Matches', el: 'Κορυφαίες αντιστοιχίσεις' },

  // role filters
  all: { en: 'All', el: 'Όλοι' },
  founders: { en: 'Founders', el: 'Ιδρυτές' },
  cofounders: { en: 'Co-founders', el: 'Συνιδρυτές' },
  mentors: { en: 'Mentors', el: 'Μέντορες' },
  investors: { en: 'Investors', el: 'Επενδυτές' },
  service_providers: { en: 'Service Providers', el: 'Πάροχοι υπηρεσιών' },
  clear: { en: 'Clear', el: 'Εκκαθάριση' },

  // platform stats
  active_founders: { en: 'Active Founders', el: 'Ενεργοί ιδρυτές' },
  expert_mentors: { en: 'Expert Mentors', el: 'Ειδικοί μέντορες' },
  successful_matches: { en: 'Successful Matches', el: 'Επιτυχείς αντιστοιχίσεις' },
  communities: { en: 'Communities', el: 'Κοινότητες' },

  // empty / action
  no_results: { en: 'No results found', el: 'Δεν βρέθηκαν αποτελέσματα' },
  try_broader: { en: 'Try broadening your filters or search term.', el: 'Δοκιμάστε ευρύτερα φίλτρα ή αναζήτηση.' },
  no_suggestions: { en: 'No suggestions yet', el: 'Δεν υπάρχουν προτάσεις ακόμα' },
  no_suggestions_desc: {
    en: 'Complete your profile to receive personalized recommendations.',
    el: 'Ολοκληρώστε το προφίλ σας για εξατομικευμένες προτάσεις.',
  },
  sign_in_for_suggestions: { en: 'Sign in to see suggestions', el: 'Συνδεθείτε για προτάσεις' },
  find_people: { en: 'Find people', el: 'Εύρεση ατόμων' },
  view_all: { en: 'View all', el: 'Προβολή όλων' },
  explore_more: { en: 'Explore more', el: 'Εξερεύνηση περισσότερων' },

  // save search
  save_search: { en: 'Save search', el: 'Αποθήκευση αναζήτησης' },
  save_search_title: { en: 'Save this search', el: 'Αποθήκευση αναζήτησης' },
  save_search_desc: {
    en: 'Re-run these filters anytime and get alerted to new matches.',
    el: 'Τρέξτε ξανά αυτά τα φίλτρα όποτε θέλετε και ενημερωθείτε για νέες αντιστοιχίσεις.',
  },
  save_name_label: { en: 'Search name', el: 'Όνομα αναζήτησης' },
  save_name_placeholder: {
    en: 'e.g. Technical cofounders in Athens',
    el: 'π.χ. Τεχνικοί συνιδρυτές στην Αθήνα',
  },
  save_alerts: { en: 'Alert me to new matches', el: 'Ειδοποίηση για νέες αντιστοιχίσεις' },
  save_cancel: { en: 'Cancel', el: 'Ακύρωση' },
  save_confirm: { en: 'Save', el: 'Αποθήκευση' },
  saving: { en: 'Saving…', el: 'Αποθήκευση…' },
  saved_searches_link: { en: 'Open saved searches', el: 'Αποθηκευμένες αναζητήσεις' },

  // toast
  connection_sent: { en: 'Connection request sent!', el: 'Το αίτημα σύνδεσης στάλθηκε!' },
  profile_saved: { en: 'Profile saved', el: 'Προφίλ αποθηκεύτηκε' },
  added_bookmarks: { en: 'added to your bookmarks', el: 'προστέθηκε στους σελιδοδείκτες' },
  could_not_send: { en: 'Could not send request', el: 'Αδυναμία αποστολής αιτήματος' },
  search_failed: { en: 'Search failed', el: 'Η αναζήτηση απέτυχε' },
};

export function discoverEn(key: keyof typeof DISCOVER_STRINGS): string {
  return DISCOVER_STRINGS[key].en;
}

export function discoverEl(key: keyof typeof DISCOVER_STRINGS): string {
  return DISCOVER_STRINGS[key].el;
}
