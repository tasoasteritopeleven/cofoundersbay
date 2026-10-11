import type { BilingualPair } from './types';

/**
 * /opportunities — co-founder calls, jobs, and collaboration proposals.
 *
 * «Ευκαιρία» is the word Greek founders already use for an opening (role,
 * gig, or co-founder call). «Πρόταση» is a collaboration offer someone sent
 * you; it is not an «αίτηση», which is the document you send the other way.
 *
 * «Συνιδρυτής» is the established term. «Freelance» stays untranslated — it
 * is how Greek tech writing names that engagement, and «ελεύθερος επαγγελματίας»
 * would describe a person, not a listing type.
 */
export const OPPORTUNITIES_STRINGS: Record<string, BilingualPair> = {
  post: { en: 'Post opportunity', el: 'Δημοσίευση ευκαιρίας' },
  post_job: { en: 'Post a job', el: 'Δημοσίευση θέσης' },

  stat_listings: { en: 'Total listings', el: 'Συνολικές καταχωρίσεις' },
  stat_remote: { en: 'Remote roles', el: 'Εξ αποστάσεως' },
  stat_cofounder: { en: 'Co-founder', el: 'Συνιδρυτής' },
  stat_proposals: { en: 'Proposals', el: 'Προτάσεις' },

  tab_listings: { en: 'Co-founder & freelance', el: 'Συνιδρυτής & freelance' },
  tab_jobs: { en: 'Jobs', el: 'Θέσεις' },
  tab_applications: { en: 'My applications', el: 'Οι αιτήσεις μου' },
  tab_proposals: { en: 'Proposals', el: 'Προτάσεις' },

  search_roles: { en: 'Search roles, skills, companies…', el: 'Αναζήτηση ρόλων, δεξιοτήτων, εταιρειών…' },
  search_jobs: { en: 'Search jobs…', el: 'Αναζήτηση θέσεων…' },
  remote_only: { en: 'Remote only', el: 'Μόνο εξ αποστάσεως' },
  all_types: { en: 'All types', el: 'Όλοι οι τύποι' },
  remote: { en: 'Remote', el: 'Εξ αποστάσεως' },
  job: { en: 'Job', el: 'Θέση' },

  type_cofounder: { en: 'Co-founder', el: 'Συνιδρυτής' },
  type_job: { en: 'Job', el: 'Θέση' },
  type_investment: { en: 'Investment', el: 'Επένδυση' },
  type_partnership: { en: 'Partnership', el: 'Συνεργασία' },
  type_mentorship: { en: 'Mentorship', el: 'Mentorship' },
  type_other: { en: 'Other', el: 'Άλλο' },

  apply_now: { en: 'Apply now', el: 'Κάντε αίτηση' },
  save: { en: 'Save', el: 'Αποθήκευση' },
  saved: { en: 'Saved', el: 'Αποθηκεύτηκε' },
  saved_body: { en: '{title} saved on this device.', el: 'Το «{title}» αποθηκεύτηκε σε αυτή τη συσκευή.' },
  expired: { en: 'Expired', el: 'Έληξε' },
  days_left: { en: '{n}d left', el: 'Απομένουν {n}η' },
  deadline: { en: 'Deadline: {date}', el: 'Προθεσμία: {date}' },
  count_one: { en: '1 opportunity', el: '1 ευκαιρία' },
  count_many: { en: '{n} opportunities', el: '{n} ευκαιρίες' },

  load_failed: { en: 'Failed to load opportunities.', el: 'Οι ευκαιρίες δεν φορτώθηκαν.' },
  jobs_failed: { en: 'Failed to load jobs.', el: 'Οι θέσεις δεν φορτώθηκαν.' },
  try_again: { en: 'Try again', el: 'Δοκιμάστε ξανά' },

  none_found: { en: 'No opportunities found', el: 'Δεν βρέθηκαν ευκαιρίες' },
  none_found_hint: {
    en: 'Try adjusting your search or filters, or post the first opportunity.',
    el: 'Αλλάξτε την αναζήτηση ή τα φίλτρα, ή δημοσιεύστε την πρώτη ευκαιρία.',
  },
  none_jobs: { en: 'No jobs posted yet', el: 'Καμία θέση ακόμη' },
  none_jobs_hint: {
    en: 'Be the first to post a role in the community.',
    el: 'Δημοσιεύστε την πρώτη θέση στην κοινότητα.',
  },
  applications_title: { en: 'Applications tracked here', el: 'Οι αιτήσεις εμφανίζονται εδώ' },
  applications_hint: {
    en: 'When you apply to listings or program applications, they appear here.',
    el: 'Όταν κάνετε αίτηση σε καταχωρίσεις ή προγράμματα, εμφανίζονται εδώ.',
  },
  browse_opportunities: { en: 'Browse opportunities', el: 'Περιήγηση ευκαιριών' },
  browse_jobs: { en: 'Browse jobs', el: 'Περιήγηση θέσεων' },
  none_proposals: { en: 'No proposals yet', el: 'Καμία πρόταση ακόμη' },
  none_proposals_hint: {
    en: 'Collaboration proposals from other members will appear here.',
    el: 'Οι προτάσεις συνεργασίας από άλλα μέλη εμφανίζονται εδώ.',
  },

  status_pending: { en: 'Pending', el: 'Εκκρεμεί' },
  status_accepted: { en: 'Accepted', el: 'Αποδεκτή' },
  status_declined: { en: 'Declined', el: 'Απορρίφθηκε' },
  accept: { en: 'Accept', el: 'Αποδοχή' },
  decline: { en: 'Decline', el: 'Απόρριψη' },
  proposal_accepted: { en: 'Proposal accepted', el: 'Η πρόταση έγινε αποδεκτή' },
  proposal_accepted_body: {
    en: 'You can now message them to coordinate next steps.',
    el: 'Μπορείτε να τους στείλετε μήνυμα για τα επόμενα βήματα.',
  },

  sample_proposals: { en: 'Sample proposals', el: 'Δείγμα προτάσεων' },
  sample_proposals_detail: {
    en: 'Incoming collaboration proposals are not a live API yet. These two cards show the layout so you can learn Accept and Decline.',
    el: 'Οι εισερχόμενες προτάσεις δεν έχουν ακόμη live API. Αυτές οι δύο κάρτες δείχνουν τη διάταξη ώστε να δείτε Αποδοχή και Απόρριψη.',
  },
};

export function opportunitiesEn(key: keyof typeof OPPORTUNITIES_STRINGS): string {
  return OPPORTUNITIES_STRINGS[key].en;
}

export function opportunitiesEl(key: keyof typeof OPPORTUNITIES_STRINGS): string {
  return OPPORTUNITIES_STRINGS[key].el;
}
