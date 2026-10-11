import type { BilingualPair } from './types';

/**
 * /jobs — roles posted by startups on the platform.
 *
 * Distinct from /opportunities, which mixes co-founder calls with jobs. This
 * page is only employment: equity, full-time, contract. «Θέση» is the role
 * as listed; «ρόλος» is the function (engineering, design) used as a filter.
 *
 * Employment types that Greek founders already say in English (Full-time,
 * Contract, Advisor) stay that way. «Συνιδρυτής» is translated because it is
 * a person, not an HR category.
 */
export const JOBS_STRINGS: Record<string, BilingualPair> = {
  post: { en: 'Post a role', el: 'Δημοσίευση θέσης' },
  post_job: { en: 'Post a job', el: 'Δημοσίευση θέσης' },
  dialog_title: { en: 'Post a job', el: 'Δημοσίευση θέσης' },
  field_title: { en: 'Job title', el: 'Τίτλος θέσης' },
  field_role: { en: 'Role / function', el: 'Ρόλος / λειτουργία' },
  field_location: { en: 'Location', el: 'Τοποθεσία' },
  field_remote: { en: 'Remote-first', el: 'Πρώτα εξ αποστάσεως' },
  cancel: { en: 'Cancel', el: 'Άκυρο' },
  submit: { en: 'Publish role', el: 'Δημοσίευση' },
  posted: { en: 'Job posted', el: 'Η θέση δημοσιεύτηκε' },
  posted_body: { en: 'Your opportunity is now live.', el: 'Η ευκαιρία είναι πλέον ενεργή.' },
  post_failed: { en: 'Failed', el: 'Αποτυχία' },

  stat_open: { en: 'Open roles', el: 'Ανοιχτές θέσεις' },
  stat_remote: { en: 'Remote-first', el: 'Εξ αποστάσεως' },
  stat_hiring: { en: 'Startups hiring', el: 'Startups που προσλαμβάνουν' },

  search: { en: 'Search jobs, roles, companies…', el: 'Αναζήτηση θέσεων, ρόλων, εταιρειών…' },
  featured: { en: 'Featured roles', el: 'Προτεινόμενες θέσεις' },
  remote_section: { en: 'Remote opportunities', el: 'Εξ αποστάσεως' },
  onsite_section: { en: 'On-site / hybrid', el: 'Δια ζώσης / υβριδικό' },
  remote: { en: 'Remote', el: 'Εξ αποστάσεως' },
  location_unknown: { en: 'Location not specified', el: 'Χωρίς τοποθεσία' },
  view: { en: 'View', el: 'Προβολή' },
  found_one: { en: '1 role found', el: '1 θέση' },
  found_many: { en: '{n} roles found', el: '{n} θέσεις' },
  remote_suffix: { en: '{n} remote', el: '{n} εξ αποστάσεως' },

  role_all: { en: 'All', el: 'Όλα' },
  role_engineering: { en: 'Engineering', el: 'Engineering' },
  role_marketing: { en: 'Marketing', el: 'Marketing' },
  role_design: { en: 'Design', el: 'Design' },
  role_legal: { en: 'Legal', el: 'Νομικά' },
  role_analytics: { en: 'Analytics', el: 'Analytics' },
  role_operations: { en: 'Operations', el: 'Operations' },

  emp_all: { en: 'All', el: 'Όλα' },
  emp_full_time: { en: 'Full-time', el: 'Full-time' },
  emp_part_time: { en: 'Part-time', el: 'Part-time' },
  emp_contract: { en: 'Contract', el: 'Contract' },
  emp_cofounder: { en: 'Co-founder', el: 'Συνιδρυτής' },
  emp_advisor: { en: 'Advisor', el: 'Advisor' },

  load_failed: { en: 'Failed to load jobs. Please check your connection.', el: 'Οι θέσεις δεν φορτώθηκαν. Ελέγξτε τη σύνδεση.' },
  try_again: { en: 'Try again', el: 'Δοκιμάστε ξανά' },
  empty_search: { en: 'No jobs match your search', el: 'Καμία θέση δεν ταιριάζει' },
  empty_search_hint: { en: 'Try a different keyword or clear the search.', el: 'Δοκιμάστε άλλο όρο ή καθαρίστε την αναζήτηση.' },
  empty: { en: 'No jobs posted yet', el: 'Καμία θέση ακόμη' },
  empty_hint: {
    en: 'Be the first to post an opportunity for the community.',
    el: 'Δημοσιεύστε την πρώτη ευκαιρία για την κοινότητα.',
  },
  clear_search: { en: 'Clear search', el: 'Καθαρισμός αναζήτησης' },
};

export function jobsEn(key: keyof typeof JOBS_STRINGS): string {
  return JOBS_STRINGS[key].en;
}

export function jobsEl(key: keyof typeof JOBS_STRINGS): string {
  return JOBS_STRINGS[key].el;
}
