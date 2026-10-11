import type { BilingualPair } from './types';

/**
 * Founder Dashboard — bilingual EN + EL.
 * English is canonical; Greek is additive.
 */
export const DASHBOARD_STRINGS: Record<string, BilingualPair> = {
  // ── Greetings ──
  good_morning: { en: 'Good morning', el: 'Καλημέρα' },
  // «Καλό απόγευμα» / «Καλό βράδυ» are said on leaving; on arrival Greek uses
  // «Καλησπέρα» from midday on.
  good_afternoon: { en: 'Good afternoon', el: 'Καλησπέρα' },
  good_evening: { en: 'Good evening', el: 'Καλησπέρα' },

  // ── Page header ──
  page_title: { en: 'Founder dashboard', el: 'Πίνακας ελέγχου ιδρυτή' },
  page_description: {
    en: 'Your startup command center — readiness, matches, and next actions.',
    el: 'Το κέντρο ελέγχου της startup σας — ετοιμότητα, αντιστοιχίσεις και επόμενα βήματα.',
  },

  // ── Stat cards ──
  match_score: { en: 'Match Score', el: 'Βαθμός αντιστοίχισης' },
  connections: { en: 'Connections', el: 'Συνδέσεις' },
  pending_requests: { en: 'Pending Requests', el: 'Εκκρεμή αιτήματα' },
  profile_views: { en: 'Profile Views', el: 'Προβολές προφίλ' },
  readiness_score: { en: 'Readiness', el: 'Ετοιμότητα' },
  xp_level: { en: 'XP Level', el: 'Επίπεδο XP' },
  this_week: { en: 'this week', el: 'αυτή την εβδομάδα' },

  // ── Section titles ──
  startup_readiness: { en: 'Startup Readiness', el: 'Ετοιμότητα startup' },
  top_matches: { en: 'Top Matches', el: 'Κορυφαίες αντιστοιχίσεις' },
  view_all_matches: { en: 'View all matches', el: 'Προβολή όλων' },
  milestones: { en: 'Milestones', el: 'Ορόσημα' },
  view_all_milestones: { en: 'View all', el: 'Προβολή όλων' },
  upcoming: { en: 'Upcoming', el: 'Επερχόμενα' },
  recent_activity: { en: 'Recent Activity', el: 'Πρόσφατη δραστηριότητα' },
  fundraising: { en: 'Fundraising', el: 'Χρηματοδότηση' },
  quick_actions: { en: 'Quick Actions', el: 'Γρήγορες ενέργειες' },

  // ── Quick actions ──
  edit_profile: { en: 'Edit Profile', el: 'Επεξεργασία προφίλ' },
  find_matches: { en: 'Find Matches', el: 'Εύρεση αντιστοιχίσεων' },
  browse_mentors: { en: 'Browse Mentors', el: 'Περιήγηση μεντόρων' },
  explore_events: { en: 'Explore Events', el: 'Εξερεύνηση εκδηλώσεων' },
  startup_builder: { en: 'Startup Builder', el: 'Startup Builder' },
  learning_hub: { en: 'Learning Hub', el: 'Κέντρο μάθησης' },
  marketplace: { en: 'Marketplace', el: 'Αγορά υπηρεσιών' },
  community: { en: 'Community', el: 'Κοινότητα' },

  // ── Milestones ──
  in_progress: { en: 'In Progress', el: 'Σε εξέλιξη' },
  pending: { en: 'Pending', el: 'Εκκρεμεί' },
  completed: { en: 'Completed', el: 'Ολοκληρωμένο' },
  due_date: { en: 'Due', el: 'Λήξη' },
  priority_high: { en: 'High', el: 'Υψηλή' },
  priority_medium: { en: 'Medium', el: 'Μέτρια' },
  priority_low: { en: 'Low', el: 'Χαμηλή' },

  // ── Activity ──
  view_all_activity: { en: 'View all', el: 'Προβολή όλων' },

  // ── Events ──
  days_left: { en: 'days left', el: 'ημέρες απομένουν' },
  day_left: { en: 'day left', el: 'ημέρα απομένει' },
  tomorrow: { en: 'Tomorrow', el: 'Αύριο' },
  today: { en: 'Today', el: 'Σήμερα' },

  // ── Fundraising ──
  raised: { en: 'raised', el: 'συγκεντρώθηκαν' },
  target: { en: 'target', el: 'στόχος' },
  leads: { en: 'Leads', el: 'Υποψήφιοι' },
  committed: { en: 'Committed', el: 'Δεσμεύτηκαν' },
  manage_round: { en: 'Manage Round', el: 'Διαχείριση γύρου' },

  // ── Readiness dimensions ──
  problem_clarity: { en: 'Problem Clarity', el: 'Σαφήνεια προβλήματος' },
  solution_clarity: { en: 'Solution Clarity', el: 'Σαφήνεια λύσης' },
  market_understanding: { en: 'Market Understanding', el: 'Κατανόηση αγοράς' },
  product_definition: { en: 'Product Definition', el: 'Ορισμός προϊόντος' },
  team_completeness: { en: 'Team Completeness', el: 'Ολοκλήρωση ομάδας' },
  execution_readiness: { en: 'Execution Readiness', el: 'Ετοιμότητα εκτέλεσης' },
  validation_score: { en: 'Validation', el: 'Επικύρωση' },
  artifact_completeness: { en: 'Artifacts', el: 'Τεχνουργήματα' },

  // ── Onboarding ──
  getting_started: { en: 'Getting Started', el: 'Ξεκινήστε' },
  onboarding_desc: {
    en: 'Complete these steps to get the most out of CoFounderBay.',
    el: 'Ολοκληρώστε αυτά τα βήματα για μέγιστη αξιοποίηση του CoFounderBay.',
  },

  // ── Empty states ──
  no_matches_yet: { en: 'No matches yet', el: 'Δεν υπάρχουν αντιστοιχίσεις ακόμα' },
  complete_profile_for_matches: {
    en: 'Complete your profile to start receiving AI-powered match suggestions.',
    el: 'Ολοκληρώστε το προφίλ σας για AI-powered προτάσεις αντιστοιχίσεων.',
  },
  preparing_workspace: { en: 'Preparing your workspace…', el: 'Προετοιμασία του χώρου εργασίας…' },
  all_caught_up: { en: 'All caught up!', el: 'Όλα εντάξει!' },
  all_caught_up_explore: {
    en: "You're all caught up. Explore new matches or continue your research.",
    el: 'Τα έχετε όλα ενήμερα. Εξερευνήστε νέες αντιστοιχίσεις ή συνεχίστε την έρευνα.',
  },
  view_matches: { en: 'View Matches', el: 'Προβολή αντιστοιχίσεων' },
  explore: { en: 'Explore', el: 'Εξερεύνηση' },
  connection_requests: { en: 'Connection requests', el: 'Αιτήματα σύνδεσης' },
  unread_messages: { en: 'Unread messages', el: 'Αδιάβαστα μηνύματα' },
  active_milestones: { en: 'Active milestones', el: 'Ενεργά ορόσημα' },
  mentor_suggestions: { en: 'Mentor suggestions', el: 'Προτάσεις μεντόρων' },
  my_communities: { en: 'My communities', el: 'Οι κοινότητές μου' },
  upcoming_events: { en: 'Upcoming events', el: 'Επερχόμενες εκδηλώσεις' },
  your_progress: { en: 'Your progress', el: 'Η πρόοδός σας' },
  profile_completion: { en: 'Profile completion', el: 'Ολοκλήρωση προφίλ' },
  quick_links: { en: 'Quick links', el: 'Γρήγοροι σύνδεσμοι' },
  find_a_mentor: { en: 'Find a mentor', el: 'Βρείτε μέντορα' },
  opportunities: { en: 'Opportunities', el: 'Ευκαιρίες' },
  my_analytics: { en: 'My analytics', el: 'Τα αναλυτικά μου' },
  complete_profile: { en: 'Complete profile', el: 'Ολοκλήρωση προφίλ' },
  fill_remaining_profile: { en: 'Fill remaining details', el: 'Συμπλήρωση υπολοίπων' },
  ask_ai: { en: 'Ask AI', el: 'Ρωτήστε το AI' },
  ask_ai_matches: {
    en: 'Ask AI how to improve your matches',
    el: 'Ρωτήστε το AI πώς να βελτιώσετε τις αντιστοιχίσεις',
  },
  ask_ai_readiness: {
    en: 'Ask AI what to improve next',
    el: 'Ρωτήστε το AI τι να βελτιώσετε μετά',
  },
  ask_ai_fundraising: {
    en: 'Ask AI about this round',
    el: 'Ρωτήστε το AI για αυτόν τον γύρο',
  },
  ask_ai_milestones: {
    en: 'Ask AI how to hit these dates',
    el: 'Ρωτήστε το AI πώς να τηρήσετε τις προθεσμίες',
  },
  ask_ai_profile: {
    en: 'Ask AI to review your profile',
    el: 'Ρωτήστε το AI να αξιολογήσει το προφίλ',
  },
  ask_ai_briefing: {
    en: "Ask AI for this week's briefing",
    el: 'Ρωτήστε το AI για την εβδομαδιαία ενημέρωση',
  },
  inbox_clear: { en: 'Inbox is clear', el: 'Τα εισερχόμενα είναι καθαρά' },
  add_first_milestone: { en: 'Add your first', el: 'Προσθέστε το πρώτο' },
  milestones_all_complete: { en: 'All complete', el: 'Όλα ολοκληρωμένα' },
  keep_current: { en: 'View profile', el: 'Προβολή προφίλ' },
  view_achievements: { en: 'All badges', el: 'Όλα τα εμβλήματα' },
  badges_keep_going: {
    en: 'Keep going to unlock more',
    el: 'Συνεχίστε για να ξεκλειδώσετε περισσότερα',
  },
  open_tracker: { en: 'Open tracker', el: 'Άνοιγμα παρακολούθησης' },
  manage_pipeline: { en: 'Manage pipeline', el: 'Διαχείριση pipeline' },
  find_investors: { en: 'Find investors', el: 'Εύρεση επενδυτών' },
  leads_tracked: { en: 'leads tracked', el: 'υποψήφιοι σε παρακολούθηση' },
  lead_tracked: { en: 'lead tracked', el: 'υποψήφιος σε παρακολούθηση' },
  committed_count: { en: 'committed', el: 'δεσμεύτηκαν' },
  committed_one: { en: 'committed', el: 'δεσμεύτηκε' },
  pre_seed_round: { en: 'Pre-Seed Round', el: 'Γύρος Pre-Seed' },
  view_all: { en: 'View all', el: 'Προβολή όλων' },
  manage: { en: 'Manage', el: 'Διαχείριση' },
  profile_strength: { en: 'Profile strength', el: 'Ισχύς προφίλ' },
  completion: { en: 'Completion', el: 'Ολοκλήρωση' },
  greeting_lead: {
    en: 'Here is what needs attention, and what to do next.',
    el: 'Εδώ βλέπετε τι χρειάζεται προσοχή και τι να κάνετε μετά.',
  },
  fundraising_empty: {
    en: 'Start the round on Fundraising. The tracker, pipeline, and data room live there — this card will show the live figures once a round exists.',
    el: 'Ξεκινήστε τον γύρο στη Χρηματοδότηση. Εκεί μένουν tracker, pipeline και data room — εδώ θα φανούν τα ζωντανά μεγέθη όταν υπάρχει γύρος.',
  },
  investor_lead: {
    en: 'Deal flow, the deals in motion and your portfolio, in one view.',
    el: 'Ροή συμφωνιών, οι συμφωνίες σε εξέλιξη και το χαρτοφυλάκιό σας, με μια ματιά.',
  },
  mentor_lead: {
    en: 'Requests waiting on you, your next sessions and your mentees.',
    el: 'Αιτήματα που σας περιμένουν, οι επόμενες συνεδρίες και οι καθοδηγούμενοί σας.',
  },
  incubator_lead: {
    en: 'Applications waiting on you, your programmes and how your startups are doing.',
    el: 'Αιτήσεις που σας περιμένουν, τα προγράμματά σας και η πορεία των startups σας.',
  },
  provider_lead: {
    en: 'Inquiries waiting on you, active projects and your services.',
    el: 'Αιτήματα που σας περιμένουν, ενεργά έργα και οι υπηρεσίες σας.',
  },
  no_recent_activity: { en: 'No recent activity', el: 'Καμία πρόσφατη δραστηριότητα' },
  browse_all: { en: 'Browse all', el: 'Περιήγηση όλων' },
  all_groups: { en: 'All groups', el: 'Όλες οι κοινότητες' },
  see_all: { en: 'See all', el: 'Δείτε όλα' },
  match_short: { en: 'match', el: 'ταιριάσμα' },
  members: { en: 'members', el: 'μέλη' },
  next_actions: { en: 'Next actions', el: 'Επόμενες ενέργειες' },
};

export function dashboardEn(key: keyof typeof DASHBOARD_STRINGS): string {
  return DASHBOARD_STRINGS[key].en;
}

export function dashboardEl(key: keyof typeof DASHBOARD_STRINGS): string {
  return DASHBOARD_STRINGS[key].el;
}
