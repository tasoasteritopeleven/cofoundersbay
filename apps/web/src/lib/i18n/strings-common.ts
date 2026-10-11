import type { BilingualPair } from './types';

/** Shell, auth chrome, and shared actions — bilingual EN + EL. */
export const COMMON_STRINGS: Record<string, BilingualPair> = {
  skip_to_content: {
    en: 'Skip to main content',
    el: 'Μετάβαση στο κύριο περιεχόμενο',
  },
  demo_mode_banner: {
    en: 'Demo mode — changes are not saved and data resets periodically.',
    el: 'Λειτουργία επίδειξης — οι αλλαγές δεν αποθηκεύονται και τα δεδομένα επαναφέρονται περιοδικά.',
  },
  create_free_account: {
    en: 'Create free account',
    el: 'Δημιουργία δωρεάν λογαριασμού',
  },
  main_navigation: {
    en: 'Main navigation',
    el: 'Κύρια πλοήγηση',
  },
  collapse_sidebar: {
    en: 'Collapse sidebar',
    el: 'Σύμπτυξη πλευρικής γραμμής',
  },
  expand_sidebar: {
    en: 'Expand sidebar',
    el: 'Ανάπτυξη πλευρικής γραμμής',
  },
  unread: {
    en: 'unread',
    el: 'αδιάβαστα',
  },
  profile: {
    en: 'Profile',
    el: 'Προφίλ',
  },
  user: {
    en: 'User',
    el: 'Χρήστης',
  },
  loading: {
    en: 'Loading…',
    el: 'Φόρτωση…',
  },
  cancel: {
    en: 'Cancel',
    el: 'Ακύρωση',
  },
  save: {
    en: 'Save',
    el: 'Αποθήκευση',
  },
  delete: {
    en: 'Delete',
    el: 'Διαγραφή',
  },
  edit: {
    en: 'Edit',
    el: 'Επεξεργασία',
  },
  create: {
    en: 'Create',
    el: 'Δημιουργία',
  },
  search: {
    en: 'Search',
    el: 'Αναζήτηση',
  },
  filter: {
    en: 'Filter',
    el: 'Φιλτράρισμα',
  },
  refresh: {
    en: 'Refresh',
    el: 'Ανανέωση',
  },
  back: {
    en: 'Back',
    el: 'Πίσω',
  },
  next: {
    en: 'Next',
    el: 'Επόμενο',
  },
  submit: {
    en: 'Submit',
    el: 'Υποβολή',
  },
  close: {
    en: 'Close',
    el: 'Κλείσιμο',
  },
  confirm: {
    en: 'Confirm',
    el: 'Επιβεβαίωση',
  },
  mark_all_read: {
    en: 'Mark all read',
    el: 'Σήμανση όλων ως αναγνωσμένων',
  },
  notifications: {
    en: 'Notifications',
    el: 'Ειδοποιήσεις',
  },
  language_display: {
    en: 'Display',
    el: 'Εμφάνιση',
  },
  bilingual_display: {
    en: 'Bilingual (primary + secondary)',
    el: 'Δίγλωσση (κύρια + δευτερεύουσα)',
  },
  primary_only_display: {
    en: 'Primary language only',
    el: 'Μόνο κύρια γλώσσα',
  },
  primary_language: {
    en: 'Primary language',
    el: 'Κύρια γλώσσα',
  },
};

export function commonEn(key: keyof typeof COMMON_STRINGS): string {
  return COMMON_STRINGS[key].en;
}

export function commonEl(key: keyof typeof COMMON_STRINGS): string {
  return COMMON_STRINGS[key].el;
}
