import type { BilingualPair } from './types';

/**
 * Matches page — bilingual EN + EL.
 * English is canonical; Greek is additive.
 */
export const MATCHES_STRINGS: Record<string, BilingualPair> = {
  // ── Page header ──
  page_title: { en: 'Matches', el: 'Αντιστοιχίσεις' },
  page_description: {
    en: 'AI-ranked co-founder and team matches based on your profile compatibility',
    el: 'Αντιστοιχίσεις συνιδρυτών και ομάδων με βάση τη συμβατότητα του προφίλ σας, κατάταξη AI',
  },

  // ── Actions ──
  refresh: { en: 'Refresh', el: 'Ανανέωση' },
  explore: { en: 'Explore', el: 'Εξερεύνηση' },
  connect: { en: 'Connect', el: 'Σύνδεση' },
  message: { en: 'Message', el: 'Μήνυμα' },
  pass: { en: 'Pass', el: 'Παράλειψη' },
  save: { en: 'Save', el: 'Αποθήκευση' },
  saved: { en: 'Saved', el: 'Αποθηκεύτηκε' },
  undo: { en: 'Undo', el: 'Αναίρεση' },
  view: { en: 'View', el: 'Προβολή' },
  view_breakdown: { en: 'View breakdown', el: 'Προβολή ανάλυσης' },
  full_profile: { en: 'Full profile', el: 'Πλήρες προφίλ' },
  breakdown: { en: 'Breakdown', el: 'Ανάλυση' },
  compare: { en: 'Compare', el: 'Σύγκριση' },
  pass_all: { en: 'Pass All', el: 'Παράλειψη όλων' },
  select: { en: 'Select', el: 'Επιλογή' },
  selected: { en: 'selected', el: 'επιλεγμένα' },
  clear_all_filters: { en: 'Clear all filters', el: 'Εκκαθάριση όλων των φίλτρων' },
  clear_all: { en: 'Clear all', el: 'Εκκαθάριση όλων' },
  clear: { en: 'Clear', el: 'Εκκαθάριση' },
  explore_more: { en: 'Explore more', el: 'Εξερεύνηση περισσότερων' },
  sign_in: { en: 'Sign in', el: 'Σύνδεση' },
  retry: { en: 'Retry', el: 'Επανάληψη' },
  complete_profile: { en: 'Complete profile', el: 'Συμπλήρωση προφίλ' },

  // ── Tier labels ──
  tier_all: { en: 'All', el: 'Όλα' },
  tier_excellent: { en: 'Excellent', el: 'Εξαιρετική' },
  tier_strong: { en: 'Strong', el: 'Ισχυρή' },
  tier_good: { en: 'Good', el: 'Καλή' },
  tier_potential: { en: 'Potential', el: 'Δυνητική' },

  // ── Filter sections ──
  match_tier: { en: 'Match Tier', el: 'Βαθμίδα αντιστοίχισης' },
  role: { en: 'Role', el: 'Ρόλος' },
  location: { en: 'Location', el: 'Τοποθεσία' },
  location_placeholder: { en: 'City or country...', el: 'Πόλη ή χώρα...' },
  availability: { en: 'Availability', el: 'Διαθεσιμότητα' },
  sort_by: { en: 'Sort by', el: 'Ταξινόμηση κατά' },
  filters: { en: 'Filters', el: 'Φίλτρα' },
  tier: { en: 'Tier', el: 'Βαθμίδα' },

  // ── Role filter labels ──
  all_roles: { en: 'All roles', el: 'Όλοι οι ρόλοι' },
  founders: { en: 'Founders', el: 'Ιδρυτές' },
  mentors: { en: 'Mentors', el: 'Μέντορες' },
  investors: { en: 'Investors', el: 'Επενδυτές' },
  orgs: { en: 'Orgs', el: 'Οργανισμοί' },

  // ── Sort labels ──
  sort_best_match: { en: 'Best Match', el: 'Καλύτερη αντιστοίχιση' },
  sort_name_az: { en: 'Name A–Z', el: 'Όνομα Α–Ω' },
  sort_newest: { en: 'Newest First', el: 'Νεότερα πρώτα' },

  // ── Availability options ──
  full_time: { en: 'Full-time', el: 'Πλήρης απασχόληση' },
  part_time: { en: 'Part-time', el: 'Μερική απασχόληση' },
  advisory: { en: 'Advisory', el: 'Συμβουλευτική' },
  contract: { en: 'Contract', el: 'Σύμβαση' },

  // ── Stats bar ──
  total_matches: { en: 'Total Matches', el: 'Συνολικές αντιστοιχίσεις' },
  excellent_80: { en: 'Excellent ≥80%', el: 'Εξαιρετικές ≥80%' },
  avg_score: { en: 'Avg Score', el: 'Μέσος βαθμός' },
  top_score: { en: 'Top Score', el: 'Υψηλότερος βαθμός' },

  // ── Insights banner ──
  excellent_matches_ready: { en: 'Excellent Match', el: 'Εξαιρετική αντιστοίχιση' },
  ready_to_connect: { en: 'Ready to Connect', el: 'Έτοιμες για σύνδεση' },
  top_score_prefix: { en: 'Top score', el: 'Κορυφαίος βαθμός' },
  highly_compatible: {
    en: 'These profiles are highly compatible — reach out now',
    el: 'Αυτά τα προφίλ είναι πολύ συμβατά — επικοινωνήστε τώρα',
  },

  // ── Empty states ──
  sign_in_to_see: { en: 'Sign in to see matches', el: 'Συνδεθείτε για προβολή αντιστοιχίσεων' },
  sign_in_desc: {
    en: 'Your matches are personalized based on your profile and preferences.',
    el: 'Οι αντιστοιχίσεις σας εξατομικεύονται βάσει του προφίλ και των προτιμήσεών σας.',
  },
  no_matches_yet: { en: 'No matches yet', el: 'Δεν υπάρχουν αντιστοιχίσεις ακόμα' },
  no_matches_desc: {
    en: 'Complete your profile (stage, commitment, roles sought) to get better cofounder and team suggestions.',
    el: 'Ολοκληρώστε το προφίλ σας (στάδιο, δέσμευση, ρόλοι) για καλύτερες προτάσεις συνιδρυτών.',
  },
  failed_to_load: { en: 'Failed to load matches.', el: 'Αποτυχία φόρτωσης αντιστοιχίσεων.' },
  no_matches_filters: { en: 'No matches for these filters', el: 'Δεν βρέθηκαν αντιστοιχίσεις με αυτά τα φίλτρα' },
  adjust_filters: {
    en: 'Try adjusting your tier, role, or location filter',
    el: 'Δοκιμάστε να τροποποιήσετε τη βαθμίδα, τον ρόλο ή τη τοποθεσία',
  },

  // ── Compatibility modal ──
  compatibility_with: { en: 'Compatibility with', el: 'Συμβατότητα με' },
  overall_match: { en: 'Overall Match', el: 'Συνολική αντιστοίχιση' },
  why_you_match: { en: 'Why you match', el: 'Γιατί ταιριάζετε' },
  match_confidence: { en: 'confidence', el: 'βεβαιότητα' },
  shared_strengths: { en: 'Shared strengths', el: 'Κοινά δυνατά σημεία' },
  watch_outs: { en: 'Worth discussing', el: 'Αξίζει να συζητηθούν' },
  breakdown_loading: { en: 'Scoring this pairing…', el: 'Αξιολόγηση της σύζευξης…' },
  breakdown_unavailable: {
    en: 'The per-dimension breakdown is not available for this profile yet.',
    el: 'Η ανάλυση ανά διάσταση δεν είναι ακόμη διαθέσιμη για αυτό το προφίλ.',
  },

  // ── Match reasons ──
  complementary_skills: { en: 'Complementary role & skills', el: 'Συμπληρωματικός ρόλος & δεξιότητες' },
  matching_stage: { en: 'Matching startup stage', el: 'Ίδιο στάδιο startup' },
  similar_industry: { en: 'Similar industry focus', el: 'Παρόμοια εστίαση κλάδου' },
  same_location: { en: 'Same location', el: 'Ίδια τοποθεσία' },
  potential_match: { en: 'Potential match', el: 'Δυνητική αντιστοίχιση' },

  // ── Preview panel ──
  profile_preview: { en: 'Profile Preview', el: 'Προεπισκόπηση προφίλ' },
  skills: { en: 'Skills', el: 'Δεξιότητες' },
  match: { en: 'match', el: 'αντιστοίχιση' },
  matches_word: { en: 'matches', el: 'αντιστοιχίσεις' },
  passed: { en: 'passed', el: 'παραλείφθηκαν' },
  showing: { en: 'Showing', el: 'Εμφάνιση' },
  of: { en: 'of', el: 'από' },
  shown: { en: 'shown', el: 'εμφανιζόμενες' },

  // ── Search ──
  search_placeholder: {
    en: 'Search by name, headline, or skill...',
    el: 'Αναζήτηση με όνομα, τίτλο ή δεξιότητα...',
  },

  // ── Chart dimensions ──
  dim_skills: { en: 'Skills', el: 'Δεξιότητες' },
  dim_stage: { en: 'Stage', el: 'Στάδιο' },
  dim_industry: { en: 'Industry', el: 'Κλάδος' },
  dim_location: { en: 'Location', el: 'Τοποθεσία' },
  dim_values: { en: 'Values', el: 'Αξίες' },

  // ── Toast messages ──
  connection_sent: { en: 'Connection request sent!', el: 'Το αίτημα σύνδεσης στάλθηκε!' },
  request_to: { en: 'Your request to', el: 'Το αίτημά σας στον/στην' },
  has_been_sent: { en: 'has been sent.', el: 'στάλθηκε.' },
  could_not_send: { en: 'Could not send request', el: 'Αδυναμία αποστολής αιτήματος' },
  passed_toast: { en: 'Passed', el: 'Παραλείφθηκε' },
  removed_undo: { en: 'removed · Undo?', el: 'αφαιρέθηκε · Αναίρεση;' },
  saved_to_shortlist: { en: 'Saved to shortlist', el: 'Αποθηκεύτηκε στη λίστα επιλεγμένων' },
  added_to_saved: { en: 'added to your saved profiles', el: 'προστέθηκε στα αποθηκευμένα προφίλ' },
  save_to_shortlist: { en: 'Save to shortlist', el: 'Αποθήκευση στη λίστα' },
};

export function matchesEn(key: keyof typeof MATCHES_STRINGS): string {
  return MATCHES_STRINGS[key].en;
}

export function matchesEl(key: keyof typeof MATCHES_STRINGS): string {
  return MATCHES_STRINGS[key].el;
}

/**
 * Greek for the dimension labels the match endpoints return. The API names
 * axes in English ("Skills & Expertise", "Location Fit"); pages show both.
 */
const MATCH_AXIS_EL: Record<string, string> = {
  skills: 'Δεξιότητες',
  'skills & expertise': 'Δεξιότητες & εμπειρία',
  stage: 'Στάδιο',
  industry: 'Κλάδος',
  'industry alignment': 'Ταύτιση κλάδου',
  'industry & stage': 'Κλάδος & στάδιο',
  location: 'Τοποθεσία',
  'location fit': 'Εγγύτητα τοποθεσίας',
  values: 'Αξίες',
  product: 'Προϊόν',
  growth: 'Ανάπτυξη',
  fundraising: 'Χρηματοδότηση',
  'role complementarity': 'Συμπληρωματικότητα ρόλων',
  'role fit': 'Ταίριασμα ρόλου',
  'vision & goals': 'Όραμα & στόχοι',
  'goals & vision': 'Στόχοι & όραμα',
  'platform activity': 'Δραστηριότητα στην πλατφόρμα',
};

export function matchAxisEl(label: string | null | undefined): string | undefined {
  return label ? MATCH_AXIS_EL[label.toLowerCase()] : undefined;
}
