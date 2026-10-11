import type { BilingualPair } from './types';

/**
 * /learning — courses, guides, and paths aligned with readiness gaps.
 *
 * «Μάθηση» is the hub. A «μονοπάτι» is a sequenced curriculum (learning path);
 * a «πόρος» is one article, video, or course. «Course» stays untranslated in
 * the type chip because Greek ed-tech writing keeps it, while the hub title
 * «Κέντρο μάθησης» is already in the page registry.
 */
export const LEARNING_STRINGS: Record<string, BilingualPair> = {
  stat_resources: { en: 'Resources', el: 'Πόροι' },
  stat_courses: { en: 'Courses', el: 'Courses' },
  stat_hours: { en: 'Total hours', el: 'Συνολικές ώρες' },
  stat_progress: { en: 'In progress', el: 'Σε εξέλιξη' },

  paths: { en: 'Learning paths', el: 'Μονοπάτια μάθησης' },
  paths_count: { en: 'paths', el: 'μονοπάτια' },
  recommended: { en: 'Recommended for you', el: 'Προτεινόμενα για εσάς' },
  featured: { en: 'Featured resources', el: 'Προτεινόμενοι πόροι' },
  all_resources: { en: 'All resources', el: 'Όλοι οι πόροι' },
  tab_all: { en: 'All resources', el: 'Όλοι οι πόροι' },
  tab_saved: { en: 'Saved', el: 'Αποθηκευμένα' },
  tab_completed: { en: 'Completed', el: 'Ολοκληρωμένα' },

  search: { en: 'Search courses, guides, topics…', el: 'Αναζήτηση courses, οδηγών, θεμάτων…' },
  type_all: { en: 'All types', el: 'Όλοι οι τύποι' },
  type_course: { en: 'Courses', el: 'Courses' },
  type_guide: { en: 'Guides', el: 'Οδηγοί' },
  type_video: { en: 'Videos', el: 'Βίντεο' },
  type_article: { en: 'Articles', el: 'Άρθρα' },
  cat_all: { en: 'All', el: 'Όλα' },

  difficulty_beginner: { en: 'Beginner', el: 'Αρχάριοι' },
  difficulty_intermediate: { en: 'Intermediate', el: 'Μεσαίο' },
  difficulty_advanced: { en: 'Advanced', el: 'Προχωρημένο' },
  featured_badge: { en: 'Featured', el: 'Προτεινόμενο' },
  start: { en: 'Start', el: 'Έναρξη' },
  open: { en: 'Open', el: 'Άνοιγμα' },
  modules: { en: '{n} modules', el: '{n} ενότητες' },
  percent_done: { en: '{n}% done', el: '{n}% ολοκληρωμένο' },
  continue_path: { en: 'Continue path', el: 'Συνέχεια μονοπατιού' },
  start_path: { en: 'Start path', el: 'Έναρξη μονοπατιού' },

  path_fast_title: { en: 'Founder fast track', el: 'Γρήγορη πορεία ιδρυτή' },
  path_fast_desc: {
    en: 'Go from idea to funded startup in structured steps',
    el: 'Από την ιδέα στο χρηματοδοτημένο startup με δομημένα βήματα',
  },
  path_fund_title: { en: 'Fundraising mastery', el: 'Χρηματοδότηση' },
  path_fund_desc: {
    en: 'Seed to Series A — pitching, term sheets, VC psychology',
    el: 'Από seed σε Series A — pitch, term sheets, ψυχολογία VC',
  },
  path_growth_title: { en: 'Growth playbook', el: 'Playbook ανάπτυξης' },
  path_growth_desc: {
    en: 'Proven frameworks for user acquisition and retention',
    el: 'Δοκιμασμένα πλαίσια για απόκτηση και διατήρηση χρηστών',
  },
  path_team_title: { en: 'Team & culture builder', el: 'Ομάδα και κουλτούρα' },
  path_team_desc: {
    en: 'Hire, retain, and lead high-performance startup teams',
    el: 'Πρόσληψη, διατήρηση και ηγεσία ομάδων υψηλής απόδοσης',
  },

  empty: { en: 'No resources found', el: 'Δεν βρέθηκαν πόροι' },
  empty_hint: { en: 'Try adjusting your search or filters', el: 'Αλλάξτε την αναζήτηση ή τα φίλτρα' },
};

export function learningEn(key: keyof typeof LEARNING_STRINGS): string {
  return LEARNING_STRINGS[key].en;
}

export function learningEl(key: keyof typeof LEARNING_STRINGS): string {
  return LEARNING_STRINGS[key].el;
}
