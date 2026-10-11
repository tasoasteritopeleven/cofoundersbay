import type { BilingualPair } from './types';

/**
 * /reputation — the founder's XP, level, streak and badges.
 *
 * Until this catalogue existed the page was a fixed tableau: "Profile
 * Completeness 85/100", twelve badges, a history of likes — the same numbers
 * for every account, English only, no sample notice, and a "Public View"
 * button with no handler. The founder dashboard one click away read the real
 * `gamification` API and said "Builder · 920 XP", so the two pages described
 * the same person differently. Now both read the same three endpoints
 * (`users/me/xp`, `users/me/badges`, `users/me/streak`) through the same
 * hooks, in live and in demo mode alike.
 *
 * On vocabulary. «Πόντοι εμπειρίας» for XP is what the dashboard already
 * uses; «σερί» for streak is the colloquial and correct term, and it is what
 * the streak card on the dashboard says. Level labels come from the API's own
 * ladder (`XP_LEVELS` in apps/api gamification.types.ts) and are given Greek
 * counterparts here by level number, not by translating the English string at
 * run time — so a renamed level on the server shows its new English name and
 * falls back cleanly on the Greek side until this table catches up.
 */
export const REPUTATION_STRINGS: Record<string, BilingualPair> = {
  // ── header ──
  my_profile: { en: 'My profile', el: 'Το προφίλ μου' },
  public_view: { en: 'Public view', el: 'Δημόσια προβολή' },
  public_view_hint: { en: 'See your profile the way another member sees it', el: 'Δείτε το προφίλ σας όπως το βλέπει ένα άλλο μέλος' },

  // ── sample notice ──
  sample_surface: { en: 'Reputation', el: 'Η φήμη' },
  sample_detail: {
    en: 'This is the showcase account. Its XP, badges and streak are illustrative; a live account reads its own from the gamification service.',
    el: 'Αυτός είναι ο λογαριασμός επίδειξης. Οι πόντοι, τα εμβλήματα και το σερί του είναι ενδεικτικά· ένας πραγματικός λογαριασμός διαβάζει τα δικά του από την υπηρεσία gamification.',
  },
  sample_ask: {
    en: 'The reputation page shows the showcase account. How do I earn XP and badges on my own account?',
    el: 'Η σελίδα φήμης δείχνει τον λογαριασμό επίδειξης. Πώς κερδίζω πόντους και εμβλήματα στον δικό μου λογαριασμό;',
  },

  // ── score card ──
  level: { en: 'Level', el: 'Επίπεδο' },
  xp: { en: 'XP', el: 'XP' },
  xp_long: { en: 'experience points', el: 'πόντοι εμπειρίας' },
  to_next_level: { en: 'to the next level', el: 'έως το επόμενο επίπεδο' },
  top_level: { en: 'Top of the ladder', el: 'Κορυφή της κλίμακας' },
  progress_in_level: { en: 'Progress in this level', el: 'Πρόοδος σε αυτό το επίπεδο' },
  badges_earned: { en: 'badges', el: 'εμβλήματα' },
  badge_earned_one: { en: 'badge', el: 'έμβλημα' },
  streak_days: { en: 'day streak', el: 'ημέρες σερί' },
  streak_day_one: { en: 'day streak', el: 'ημέρα σερί' },
  best_streak: { en: 'Best', el: 'Καλύτερο' },
  days: { en: 'days', el: 'ημέρες' },
  day_one: { en: 'day', el: 'ημέρα' },

  // ── tabs ──
  tab_overview: { en: 'Overview', el: 'Επισκόπηση' },
  tab_badges: { en: 'Badges', el: 'Εμβλήματα' },
  tab_history: { en: 'History', el: 'Ιστορικό' },

  // ── overview ──
  how_xp_title: { en: 'Where your XP comes from', el: 'Από πού προέρχονται οι πόντοι σας' },
  how_xp_desc: {
    en: 'Grouped from your most recent XP events. The server applies diminishing returns to repeated actions, so the same action is not always worth the same points.',
    el: 'Ομαδοποίηση από τα πιο πρόσφατα γεγονότα XP σας. Ο διακομιστής μειώνει την απόδοση επαναλαμβανόμενων ενεργειών, οπότε η ίδια ενέργεια δεν δίνει πάντα τους ίδιους πόντους.',
  },
  no_xp_yet_title: { en: 'No XP yet', el: 'Χωρίς πόντους ακόμη' },
  no_xp_yet_desc: {
    en: 'Points arrive as you build: creating and completing Builder artifacts, finishing milestones, giving and applying feedback, and showing up day after day.',
    el: 'Οι πόντοι έρχονται καθώς χτίζετε: δημιουργώντας και ολοκληρώνοντας παραδοτέα στον Builder, κλείνοντας ορόσημα, δίνοντας και εφαρμόζοντας ανατροφοδότηση, και εμφανιζόμενοι μέρα με τη μέρα.',
  },
  streak_title: { en: 'Streak', el: 'Σερί' },
  streak_desc: { en: 'Consecutive days with at least one qualifying action.', el: 'Συνεχόμενες ημέρες με τουλάχιστον μία ενέργεια που μετρά.' },
  streak_none: { en: 'No active streak. One qualifying action today starts it.', el: 'Κανένα ενεργό σερί. Μία ενέργεια που μετρά σήμερα το ξεκινά.' },
  last_active: { en: 'Last active', el: 'Τελευταία δραστηριότητα' },
  current: { en: 'Current', el: 'Τρέχον' },
  longest: { en: 'Longest', el: 'Μεγαλύτερο' },

  // ── badges ──
  badges_title: { en: 'Badges you have earned', el: 'Εμβλήματα που έχετε κερδίσει' },
  badges_desc: { en: 'Awarded by the platform when a threshold is crossed. Newly awarded badges are highlighted until you have seen them.', el: 'Απονέμονται από την πλατφόρμα όταν ξεπεραστεί ένα κατώφλι. Τα νέα εμβλήματα επισημαίνονται μέχρι να τα δείτε.' },
  no_badges_title: { en: 'No badges yet', el: 'Χωρίς εμβλήματα ακόμη' },
  no_badges_desc: { en: 'Badges follow XP and milestones. Keep building and they will appear here.', el: 'Τα εμβλήματα ακολουθούν τους πόντους και τα ορόσημα. Συνεχίστε να χτίζετε και θα εμφανιστούν εδώ.' },
  new_badge: { en: 'New', el: 'Νέο' },
  earned_on: { en: 'Earned', el: 'Κερδήθηκε' },
  mark_seen: { en: 'Mark all as seen', el: 'Σήμανση όλων ως ειδωμένων' },
  rarity_common: { en: 'Common', el: 'Κοινό' },
  rarity_uncommon: { en: 'Uncommon', el: 'Ασυνήθιστο' },
  rarity_rare: { en: 'Rare', el: 'Σπάνιο' },
  rarity_epic: { en: 'Epic', el: 'Επικό' },
  rarity_legendary: { en: 'Legendary', el: 'Θρυλικό' },

  // ── history ──
  history_title: { en: 'Recent XP events', el: 'Πρόσφατα γεγονότα XP' },
  history_desc: { en: 'The last twenty events the server recorded for you, newest first.', el: 'Τα είκοσι τελευταία γεγονότα που κατέγραψε ο διακομιστής για εσάς, τα νεότερα πρώτα.' },
  no_history: { en: 'Nothing recorded yet.', el: 'Δεν έχει καταγραφεί τίποτα ακόμη.' },

  // ── event types (mirror of EVENT_CONFIG keys in apps/api gamification.types.ts) ──
  ev_CREATE_ARTIFACT: { en: 'Created an artifact', el: 'Δημιουργία παραδοτέου' },
  ev_COMPLETE_ARTIFACT: { en: 'Completed an artifact', el: 'Ολοκλήρωση παραδοτέου' },
  ev_IMPROVE_ARTIFACT: { en: 'Improved an artifact', el: 'Βελτίωση παραδοτέου' },
  ev_CREATE_BOARD: { en: 'Created a research board', el: 'Δημιουργία πίνακα έρευνας' },
  ev_SYNTHESIZE_BOARD: { en: 'Synthesised a board', el: 'Σύνθεση πίνακα' },
  ev_LINK_ARTIFACTS: { en: 'Linked artifacts', el: 'Σύνδεση παραδοτέων' },
  ev_INVITE_COLLABORATOR: { en: 'Invited a collaborator', el: 'Πρόσκληση συνεργάτη' },
  ev_TEAM_CONTRIBUTION: { en: 'Team contribution', el: 'Συνεισφορά ομάδας' },
  ev_HIGH_QUALITY_CONTRIBUTION: { en: 'High-quality contribution', el: 'Συνεισφορά υψηλής ποιότητας' },
  ev_RECEIVE_MENTOR_FEEDBACK: { en: 'Received mentor feedback', el: 'Λήψη ανατροφοδότησης μέντορα' },
  ev_APPLY_FEEDBACK: { en: 'Applied feedback', el: 'Εφαρμογή ανατροφοδότησης' },
  ev_COMPLETE_REVIEW: { en: 'Completed a review', el: 'Ολοκλήρωση αξιολόγησης' },
  ev_PROVIDE_FEEDBACK: { en: 'Gave feedback', el: 'Παροχή ανατροφοδότησης' },
  ev_COMPLETE_MILESTONE: { en: 'Completed a milestone', el: 'Ολοκλήρωση ορόσημου' },
  ev_VALIDATED_PROGRESS: { en: 'Validated progress', el: 'Επικυρωμένη πρόοδος' },
  ev_STREAK_BONUS: { en: 'Streak bonus', el: 'Μπόνους σερί' },

  // ── groups the overview folds event types into ──
  grp_building: { en: 'Building', el: 'Χτίσιμο' },
  grp_research: { en: 'Research', el: 'Έρευνα' },
  grp_collaboration: { en: 'Collaboration', el: 'Συνεργασία' },
  grp_feedback: { en: 'Feedback', el: 'Ανατροφοδότηση' },
  grp_milestones: { en: 'Milestones', el: 'Ορόσημα' },
  grp_consistency: { en: 'Consistency', el: 'Συνέπεια' },
  grp_other: { en: 'Other', el: 'Άλλο' },

  // ── tips ──
  tips_title: { en: 'How to earn more', el: 'Πώς να κερδίσετε περισσότερα' },
  tip_build_title: { en: 'Build in the Startup Builder', el: 'Χτίστε στο Startup Builder' },
  tip_build_desc: { en: 'Creating and completing artifacts is the largest source of XP.', el: 'Η δημιουργία και ολοκλήρωση παραδοτέων είναι η μεγαλύτερη πηγή πόντων.' },
  tip_milestone_title: { en: 'Close a milestone', el: 'Κλείστε ένα ορόσημο' },
  tip_milestone_desc: { en: 'Completed milestones pay out once, and count toward validated progress.', el: 'Τα ολοκληρωμένα ορόσημα πληρώνουν μία φορά και μετρούν στην επικυρωμένη πρόοδο.' },
  tip_feedback_title: { en: 'Give and apply feedback', el: 'Δώστε και εφαρμόστε ανατροφοδότηση' },
  tip_feedback_desc: { en: 'Reviewing others and acting on a mentor’s notes both earn points.', el: 'Η αξιολόγηση άλλων και η εφαρμογή σημειώσεων μέντορα κερδίζουν πόντους.' },

  // ── states ──
  loading: { en: 'Loading your reputation…', el: 'Φόρτωση της φήμης σας…' },
  error_title: { en: 'Could not load your reputation', el: 'Δεν ήταν δυνατή η φόρτωση της φήμης σας' },
  error_desc: { en: 'The gamification service did not answer. Your points are safe; try again in a moment.', el: 'Η υπηρεσία gamification δεν απάντησε. Οι πόντοι σας είναι ασφαλείς· δοκιμάστε ξανά σε λίγο.' },
  retry: { en: 'Try again', el: 'Δοκιμή ξανά' },
};

/** Greek names for the API's XP ladder, by level number. English comes from the server. */
export const LEVEL_LABEL_EL: Record<number, string> = {
  1: 'Σπόρος ιδρυτή',
  2: 'Εξερευνητής ιδέας',
  3: 'Δημιουργός',
  4: 'Επικυρωμένος ιδρυτής',
  5: 'Αναζητητής market fit',
  6: 'Αρχιτέκτονας ανάπτυξης',
  7: 'Έτοιμος για venture',
  8: 'Διεκδικητής Series A',
  9: 'Χειριστής scale-up',
  10: 'Ηγέτης οικοσυστήματος',
};

/** Which overview group an event type belongs to. Unknown types fall to `other`. */
export const EVENT_GROUP: Record<string, string> = {
  CREATE_ARTIFACT: 'building',
  COMPLETE_ARTIFACT: 'building',
  IMPROVE_ARTIFACT: 'building',
  CREATE_BOARD: 'research',
  SYNTHESIZE_BOARD: 'research',
  LINK_ARTIFACTS: 'research',
  INVITE_COLLABORATOR: 'collaboration',
  TEAM_CONTRIBUTION: 'collaboration',
  HIGH_QUALITY_CONTRIBUTION: 'collaboration',
  RECEIVE_MENTOR_FEEDBACK: 'feedback',
  APPLY_FEEDBACK: 'feedback',
  COMPLETE_REVIEW: 'feedback',
  PROVIDE_FEEDBACK: 'feedback',
  COMPLETE_MILESTONE: 'milestones',
  VALIDATED_PROGRESS: 'milestones',
  STREAK_BONUS: 'consistency',
};

export function reputationEn(key: keyof typeof REPUTATION_STRINGS): string {
  return REPUTATION_STRINGS[key].en;
}
export function reputationEl(key: keyof typeof REPUTATION_STRINGS): string {
  return REPUTATION_STRINGS[key].el;
}
