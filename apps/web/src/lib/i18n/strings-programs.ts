import type { BilingualPair } from './types';

/**
 * /programs — accelerators, incubators and the rest, and the state of your
 * applications to them.
 *
 * This page is where /readiness sends a founder whose accelerator score is
 * high enough to apply («Περιήγηση προγραμμάτων»), and where the Builder's
 * progress card now points as well, so it was the last English-only stop on a
 * chain of Greek ones.
 *
 * On the vocabulary. «Επιταχυντής» and «Θερμοκοιτίδα» are the established
 * Greek terms for accelerator and incubator in the startup press and in the
 * names of the Greek programmes themselves, so they are translated. «Bootcamp»
 * is not: it is used untranslated in Greek tech writing, and «στρατόπεδο
 * εκπαίδευσης» would read as a military camp. «Cohort» becomes «Κύκλος» — the
 * word Greek programmes use for an intake — rather than the literal «κοόρτη»,
 * which is epidemiological.
 *
 * «Αίτηση» is the application as a document you submit; «Υποβλήθηκε» is its
 * state afterwards. They are deliberately different words, because a founder
 * scanning the list needs to tell "you can apply" from "you already did".
 */
export const PROGRAMS_STRINGS: Record<string, BilingualPair> = {
  // ── Search and filters ──
  search_placeholder: {
    en: 'Search programs, organizations, industries...',
    el: 'Αναζήτηση προγραμμάτων, οργανισμών, κλάδων...',
  },
  filter_program_type: { en: 'Program Type', el: 'Τύπος προγράμματος' },
  filter_status: { en: 'Status', el: 'Κατάσταση' },
  clear_filters: { en: 'Clear filters', el: 'Καθαρισμός φίλτρων' },

  type_all: { en: 'All Types', el: 'Όλοι οι τύποι' },
  type_accelerator: { en: 'Accelerator', el: 'Επιταχυντής' },
  type_incubator: { en: 'Incubator', el: 'Θερμοκοιτίδα' },
  type_bootcamp: { en: 'Bootcamp', el: 'Bootcamp' },
  type_competition: { en: 'Competition', el: 'Διαγωνισμός' },
  type_cohort: { en: 'Cohort', el: 'Κύκλος' },

  status_all: { en: 'All Status', el: 'Όλες οι καταστάσεις' },
  status_open: { en: 'Open Now', el: 'Ανοιχτά τώρα' },
  status_upcoming: { en: 'Upcoming', el: 'Προσεχώς' },
  status_active: { en: 'Active', el: 'Σε εξέλιξη' },
  status_closed: { en: 'Closed', el: 'Έκλεισαν' },

  // ── The same states on one programme's badge.
  //
  // Separate from the filter labels above, and not out of duplication: the
  // filter counts many programmes and the badge describes one, and Greek
  // marks that difference where English does not. «Έκλεισαν» on a single card
  // would be a plural verb attached to one thing.
  badge_open: { en: 'Open', el: 'Ανοιχτό' },
  badge_upcoming: { en: 'Upcoming', el: 'Προσεχώς' },
  badge_active: { en: 'Active', el: 'Σε εξέλιξη' },
  badge_closed: { en: 'Closed', el: 'Έκλεισε' },

  // ── Tabs ──
  tab_all: { en: 'All Programs', el: 'Όλα τα προγράμματα' },
  tab_open: { en: 'Open', el: 'Ανοιχτά' },
  tab_mine: { en: 'My Applications', el: 'Οι αιτήσεις μου' },
  featured: { en: 'Featured & Closing Soon', el: 'Προτεινόμενα & κλείνουν σύντομα' },

  // ── A program's own facts ──
  program_type: { en: 'Program type', el: 'Τύπος προγράμματος' },
  application_deadline: { en: 'Application deadline', el: 'Προθεσμία αίτησης' },
  capacity: { en: 'Capacity', el: 'Χωρητικότητα' },

  // ── Applying ──
  apply_now: { en: 'Apply Now', el: 'Κάντε αίτηση' },
  applied: { en: 'Applied', el: 'Υποβλήθηκε' },
  fit_label: { en: 'Why are you a good fit?', el: 'Γιατί ταιριάζετε;' },
  optional: { en: '(optional)', el: '(προαιρετικό)' },
  fit_placeholder: {
    en: 'Describe your startup, stage, and why this program is the right fit...',
    el: 'Περιγράψτε τη startup σας, το στάδιό της και γιατί σας ταιριάζει το πρόγραμμα...',
  },
  cancel: { en: 'Cancel', el: 'Άκυρο' },
  submit_application: { en: 'Submit Application', el: 'Υποβολή αίτησης' },
  apply_to: { en: 'Apply to', el: 'Αίτηση σε' },
  apply_intro: {
    en: 'Include a brief note about why you are a great fit.',
    el: 'Προσθέστε μια σύντομη σημείωση για το γιατί ταιριάζετε.',
  },
  spots_taken: { en: 'spots taken', el: 'θέσεις καλυμμένες' },
  refresh: { en: 'Refresh', el: 'Ανανέωση' },
  stat_total: { en: 'Total programs', el: 'Συνολικά προγράμματα' },
  stat_open: { en: 'Open applications', el: 'Ανοιχτές αιτήσεις' },
  stat_applied: { en: 'Applied to', el: 'Αιτήσεις σας' },
  stat_remote: { en: 'Remote options', el: 'Εξ αποστάσεως' },

  // ── Empty states. Each one names the next move, not just the absence. ──
  none_found: { en: 'No programs found', el: 'Δεν βρέθηκαν προγράμματα' },
  none_found_hint: {
    en: 'Try adjusting your filters or search terms',
    el: 'Δοκιμάστε να αλλάξετε τα φίλτρα ή τους όρους αναζήτησης',
  },
  none_open: { en: 'No open programs right now', el: 'Κανένα ανοιχτό πρόγραμμα τώρα' },
  none_open_hint: {
    en: 'Check back soon — new programs open regularly',
    el: 'Επανελέγξτε σύντομα — νέα προγράμματα ανοίγουν τακτικά',
  },
  none_applied: { en: 'No applications yet', el: 'Καμία αίτηση ακόμη' },
  none_applied_hint: {
    en: 'Apply to open programs above to track them here',
    el: 'Κάντε αίτηση στα ανοιχτά προγράμματα πιο πάνω για να τις παρακολουθείτε εδώ',
  },
};

export function programsEn(key: keyof typeof PROGRAMS_STRINGS): string {
  return PROGRAMS_STRINGS[key].en;
}

export function programsEl(key: keyof typeof PROGRAMS_STRINGS): string {
  return PROGRAMS_STRINGS[key].el;
}
