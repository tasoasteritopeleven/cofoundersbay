import type { BilingualPair } from './types';

export type SearchCategoryKey =
  | 'all'
  | 'people'
  | 'jobs'
  | 'events'
  | 'groups'
  | 'mentors'
  | 'opportunities';

export type SearchResultTypeKey = 'user' | 'job' | 'event' | 'group' | 'opportunity';

/** Search page — bilingual EN + EL (additive; English never removed). */
export const SEARCH_STRINGS: Record<string, BilingualPair> = {
  input_placeholder: {
    en: 'Search for people, jobs, events, groups…',
    el: 'Αναζήτηση ατόμων, θέσεων εργασίας, εκδηλώσεων, κοινοτήτων…',
  },
  recent_searches: {
    en: 'Recent searches',
    el: 'Πρόσφατες αναζητήσεις',
  },
  clear: {
    en: 'Clear',
    el: 'Εκκαθάριση',
  },
  category_all: {
    en: 'All',
    el: 'Όλα',
  },
  category_people: {
    en: 'People',
    el: 'Άτομα',
  },
  category_jobs: {
    en: 'Jobs',
    el: 'Θέσεις εργασίας',
  },
  category_events: {
    en: 'Events',
    el: 'Εκδηλώσεις',
  },
  category_groups: {
    en: 'Groups',
    el: 'Κοινότητες',
  },
  category_mentors: {
    en: 'Mentors',
    el: 'Μέντορες',
  },
  category_opportunities: {
    en: 'Opportunities',
    el: 'Ευκαιρίες',
  },
  empty_title: {
    en: 'No results found',
    el: 'Δεν βρέθηκαν αποτελέσματα',
  },
  idle_title: {
    en: 'Search the network',
    el: 'Αναζητήστε στο δίκτυο',
  },
  empty_hint: {
    en: 'Enter a search term to find people, jobs, events, and more',
    el: 'Εισαγάγετε όρο αναζήτησης για εύρεση ατόμων, θέσεων εργασίας, εκδηλώσεων και άλλων',
  },
  browse_people: {
    en: 'Browse People',
    el: 'Περιήγηση σε άτομα',
  },
  browse_jobs: {
    en: 'Browse Jobs',
    el: 'Περιήγηση σε θέσεις εργασίας',
  },
  browse_events: {
    en: 'Browse Events',
    el: 'Περιήγηση σε εκδηλώσεις',
  },
  ask_ai: {
    en: 'Ask AI',
    el: 'Ρωτήστε το AI',
  },
  search_failed_title: {
    en: 'Search failed',
    el: 'Η αναζήτηση απέτυχε',
  },
  search_failed_body: {
    en: 'Something went wrong. Please try again.',
    el: 'Παρουσιάστηκε σφάλμα. Δοκιμάστε ξανά.',
  },
  retry: {
    en: 'Retry',
    el: 'Επανάληψη',
  },
  quick_links: {
    en: 'Quick Links',
    el: 'Σύνδεσμοι γρήγορης πρόσβασης',
  },
  discover_people_title: {
    en: 'Discover People',
    el: 'Ανακάλυψη ατόμων',
  },
  discover_people_desc: {
    en: 'Find co-founders and collaborators',
    el: 'Εύρεση συνιδρυτών και συνεργατών',
  },
  find_mentors_title: {
    en: 'Find Mentors',
    el: 'Εύρεση μεντόρων',
  },
  find_mentors_desc: {
    en: 'Connect with experienced advisors',
    el: 'Σύνδεση με έμπειρους συμβούλους',
  },
  browse_jobs_title: {
    en: 'Browse Jobs',
    el: 'Περιήγηση σε θέσεις εργασίας',
  },
  browse_jobs_desc: {
    en: 'Startup roles and opportunities',
    el: 'Ρόλοι και ευκαιρίες σε startups',
  },
  upcoming_events_title: {
    en: 'Upcoming Events',
    el: 'Επερχόμενες εκδηλώσεις',
  },
  upcoming_events_desc: {
    en: 'Meetups, webinars, and more',
    el: 'Συναντήσεις, διαδικτυακά σεμινάρια και άλλα',
  },
  type_user: {
    en: 'person',
    el: 'άτομο',
  },
  type_job: {
    en: 'job',
    el: 'θέση εργασίας',
  },
  type_event: {
    en: 'event',
    el: 'εκδήλωση',
  },
  type_group: {
    en: 'group',
    el: 'κοινότητα',
  },
  type_opportunity: {
    en: 'opportunity',
    el: 'ευκαιρία',
  },
  clear_search: {
    en: 'Clear search',
    el: 'Εκκαθάριση αναζήτησης',
  },
  remove_recent: {
    en: 'Remove from recent searches',
    el: 'Αφαίρεση από πρόσφατες αναζητήσεις',
  },
};

const CATEGORY_KEYS: Record<SearchCategoryKey, keyof typeof SEARCH_STRINGS> = {
  all: 'category_all',
  people: 'category_people',
  jobs: 'category_jobs',
  events: 'category_events',
  groups: 'category_groups',
  mentors: 'category_mentors',
  opportunities: 'category_opportunities',
};

const RESULT_TYPE_KEYS: Record<SearchResultTypeKey, keyof typeof SEARCH_STRINGS> = {
  user: 'type_user',
  job: 'type_job',
  event: 'type_event',
  group: 'type_group',
  opportunity: 'type_opportunity',
};

export function searchEn(key: keyof typeof SEARCH_STRINGS): string {
  return SEARCH_STRINGS[key].en;
}

export function searchEl(key: keyof typeof SEARCH_STRINGS): string {
  return SEARCH_STRINGS[key].el;
}

export function categoryLabelEn(category: SearchCategoryKey): string {
  return searchEn(CATEGORY_KEYS[category]);
}

export function categoryLabelEl(category: SearchCategoryKey): string {
  return searchEl(CATEGORY_KEYS[category]);
}

export function resultTypeEn(type: SearchResultTypeKey): string {
  return searchEn(RESULT_TYPE_KEYS[type]);
}

export function resultTypeEl(type: SearchResultTypeKey): string {
  return searchEl(RESULT_TYPE_KEYS[type]);
}

/** Dynamic: no matches for query in category. */
export function noMatchMessageEn(query: string, category: SearchCategoryKey): string {
  const scope =
    category === 'all' ? 'results' : categoryLabelEn(category).toLowerCase();
  return `We couldn't find any ${scope} matching "${query}"`;
}

export function noMatchMessageEl(query: string, category: SearchCategoryKey): string {
  if (category === 'all') {
    return `Δεν βρέθηκαν αποτελέσματα που να ταιριάζουν με «${query}»`;
  }
  return `Δεν βρέθηκαν ${categoryLabelEl(category).toLowerCase()} που να ταιριάζουν με «${query}»`;
}

export function resultsSummaryEn(total: number, query: string): string {
  const noun = total === 1 ? 'result' : 'results';
  return `${total} ${noun} for "${query}"`;
}

export function resultsSummaryEl(total: number, query: string): string {
  const noun = total === 1 ? 'αποτέλεσμα' : 'αποτελέσματα';
  return `${total} ${noun} για «${query}»`;
}
