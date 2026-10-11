import type { BilingualPair } from './types';

/**
 * Achievements & Badges page — bilingual EN + EL.
 */
export const ACHIEVEMENTS_STRINGS: Record<string, BilingualPair> = {
  // ── Page header ──
  page_title: { en: 'Achievements & Badges', el: 'Επιτεύγματα & Εμβλήματα' },
  page_description: {
    en: 'Track your progress, unlock badges, and climb the leaderboard',
    el: 'Παρακολουθήστε την πρόοδό σας, ξεκλειδώστε εμβλήματα και ανεβείτε στην κατάταξη',
  },

  // ── Tabs ──
  tab_all: { en: 'All', el: 'Όλα' },
  tab_unlocked: { en: 'Unlocked', el: 'Ξεκλειδωμένα' },
  tab_in_progress: { en: 'In Progress', el: 'Σε εξέλιξη' },
  tab_leaderboard: { en: 'Leaderboard', el: 'Κατάταξη' },
  tab_reputation: { en: 'Reputation', el: 'Φήμη' },
  tab_badges: { en: 'Badges', el: 'Εμβλήματα' },

  // ── Categories ──
  cat_all: { en: 'All', el: 'Όλες' },
  cat_networking: { en: 'Networking', el: 'Δικτύωση' },
  cat_engagement: { en: 'Engagement', el: 'Αφοσίωση' },
  cat_profile: { en: 'Profile', el: 'Προφίλ' },
  cat_activity: { en: 'Activity', el: 'Δραστηριότητα' },
  cat_special: { en: 'Special', el: 'Ειδικά' },

  // ── Stats card ──
  current_level: { en: 'Current Level', el: 'Τρέχον επίπεδο' },
  progress_to_level: { en: 'Progress to Level', el: 'Πρόοδος προς επίπεδο' },
  total_points: { en: 'Total Points', el: 'Συνολικοί πόντοι' },
  achievements: { en: 'Achievements', el: 'Επιτεύγματα' },
  completion: { en: 'Completion', el: 'Ολοκλήρωση' },
  rank: { en: 'Rank', el: 'Κατάταξη' },

  // ── Achievement card ──
  progress: { en: 'Progress', el: 'Πρόοδος' },
  have_this: { en: 'have this', el: 'έχουν αυτό' },
  unlocked_on: { en: 'Unlocked', el: 'Ξεκλειδώθηκε' },

  // ── Tiers ──
  tier_bronze: { en: 'bronze', el: 'χάλκινο' },
  tier_silver: { en: 'silver', el: 'ασημένιο' },
  tier_gold: { en: 'gold', el: 'χρυσό' },
  tier_platinum: { en: 'platinum', el: 'πλατινένιο' },

  // ── Leaderboard ──
  community_leaderboard: { en: 'Community Leaderboard', el: 'Κατάταξη κοινότητας' },
  recently_unlocked: { en: 'Recently Unlocked', el: 'Πρόσφατα ξεκλειδωμένα' },
  tier_breakdown: { en: 'Tier Breakdown', el: 'Ανάλυση βαθμίδων' },
  no_unlocks_yet: { en: 'No unlocks yet', el: 'Κανένα ξεκλείδωμα ακόμα' },

  // ── Empty states ──
  no_achievements_found: { en: 'No achievements found', el: 'Δεν βρέθηκαν επιτεύγματα' },
  try_adjusting_filters: { en: 'Try adjusting your filters', el: 'Δοκιμάστε να αλλάξετε τα φίλτρα' },
  no_unlocked_achievements: { en: 'No unlocked achievements', el: 'Κανένα ξεκλειδωμένο επίτευγμα' },
  start_engaging: { en: 'Start engaging to unlock your first badge!', el: 'Αρχίστε να συμμετέχετε για να ξεκλειδώσετε το πρώτο σας έμβλημα!' },
  all_badges_unlocked: { en: 'All badges unlocked in this category!', el: 'Όλα τα εμβλήματα ξεκλειδώθηκαν σε αυτήν την κατηγορία!' },
};

export function achievementsEn(key: keyof typeof ACHIEVEMENTS_STRINGS): string {
  return ACHIEVEMENTS_STRINGS[key].en;
}

export function achievementsEl(key: keyof typeof ACHIEVEMENTS_STRINGS): string {
  return ACHIEVEMENTS_STRINGS[key].el;
}
