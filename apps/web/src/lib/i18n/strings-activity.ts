import type { BilingualPair } from './types';

/**
 * /activity — the feed of what happened around the founder: network events,
 * notifications and upcoming dates.
 *
 * Terms that carry a settled Greek form in the startup world are used as they
 * are used, not translated word for word:
 *   match       → «αντιστοίχιση», the result of the platform pairing two people
 *   endorsement → «σύσταση», what one founder writes to vouch for another
 *   milestone   → «ορόσημο»
 *   streak      → «σερί», the everyday word, not a coined compound
 * The relative times stay short because they sit under a clock icon inside a
 * row: «πριν 2ω» reads the way a Greek speaker writes it in a chat, and the
 * long form would push the badge beside it out of the row.
 */
export const ACTIVITY_STRINGS: Record<string, BilingualPair> = {
  page_title: { en: 'Activity Feed', el: 'Ροή δραστηριότητας' },
  page_description: {
    en: 'Track your network activity, notifications, and events',
    el: 'Παρακολουθήστε τη δραστηριότητα του δικτύου σας, τις ειδοποιήσεις και τις εκδηλώσεις',
  },

  // ── The kinds of thing that can appear in the feed ──
  type_all: { en: 'All', el: 'Όλα' },
  type_connection: { en: 'Connections', el: 'Συνδέσεις' },
  type_message: { en: 'Messages', el: 'Μηνύματα' },
  type_match: { en: 'Matches', el: 'Αντιστοιχίσεις' },
  type_milestone: { en: 'Milestones', el: 'Ορόσημα' },
  type_achievement: { en: 'Achievements', el: 'Επιτεύγματα' },
  type_event: { en: 'Events', el: 'Εκδηλώσεις' },
  type_endorsement: { en: 'Endorsements', el: 'Συστάσεις' },
  type_job: { en: 'Jobs', el: 'Θέσεις εργασίας' },
  type_system: { en: 'System', el: 'Σύστημα' },
  type_invite: { en: 'Invites', el: 'Προσκλήσεις' },

  // ── Date group headers ──
  group_today: { en: 'Today', el: 'Σήμερα' },
  group_yesterday: { en: 'Yesterday', el: 'Χθες' },
  group_week: { en: 'This Week', el: 'Αυτή την εβδομάδα' },
  group_earlier: { en: 'Earlier', el: 'Παλαιότερα' },

  // ── Relative time, short enough to sit inside a row ──
  time_now: { en: 'just now', el: 'μόλις τώρα' },
  time_minutes: { en: '{n}m ago', el: 'πριν {n}λ' },
  time_hours: { en: '{n}h ago', el: 'πριν {n}ω' },
  time_days: { en: '{n}d ago', el: 'πριν {n}η' },

  // ── The four counters above the feed ──
  stat_today: { en: "Today's Activity", el: 'Σημερινή δραστηριότητα' },
  stat_unread: { en: 'Unread Notifications', el: 'Αδιάβαστες ειδοποιήσεις' },
  stat_connections: { en: 'New Connections', el: 'Νέες συνδέσεις' },
  stat_matches: { en: 'New Matches', el: 'Νέες αντιστοιχίσεις' },

  // ── Tabs ──
  tab_network: { en: 'Network', el: 'Δίκτυο' },
  tab_notifications: { en: 'Notifications', el: 'Ειδοποιήσεις' },
  tab_events: { en: 'Events', el: 'Εκδηλώσεις' },

  // ── Controls ──
  mark_all_read: { en: 'Mark all read', el: 'Όλα ως αναγνωσμένα' },
  refresh: { en: 'Refresh', el: 'Ανανέωση' },
  clear_filter: { en: 'Clear', el: 'Καθαρισμός' },
  retry: { en: 'Retry', el: 'Επανάληψη' },
  load_more: { en: 'Load more', el: 'Περισσότερα' },
  loading: { en: 'Loading…', el: 'Φόρτωση…' },
  by_author: { en: 'By {name}', el: 'Από {name}' },
  badge_new: { en: 'New', el: 'Νέο' },
  open_item: { en: 'Open', el: 'Άνοιγμα' },

  // ── When there is nothing, or nothing loaded ──
  activity_failed: { en: 'Failed to load activity.', el: 'Η δραστηριότητα δεν φορτώθηκε.' },
  notifications_failed: { en: 'Failed to load notifications.', el: 'Οι ειδοποιήσεις δεν φορτώθηκαν.' },
  empty_activity: { en: 'No network activity yet', el: 'Καμία δραστηριότητα δικτύου ακόμη' },
  empty_activity_filtered: { en: 'Nothing under this filter', el: 'Τίποτα με αυτό το φίλτρο' },
  empty_activity_hint: {
    en: 'Connect with people to see updates here.',
    el: 'Συνδεθείτε με άτομα για να βλέπετε ενημερώσεις εδώ.',
  },
  empty_filter_hint: { en: 'Try a different filter.', el: 'Δοκιμάστε άλλο φίλτρο.' },
  discover_people: { en: 'Discover people', el: 'Ανακαλύψτε άτομα' },
  all_caught_up: { en: 'All caught up!', el: 'Είστε ενημερωμένοι!' },
  no_notifications: { en: 'No notifications right now.', el: 'Καμία ειδοποίηση αυτή τη στιγμή.' },
  unread_of_total: {
    en: '{unread} unread of {total} total',
    el: '{unread} αδιάβαστες από {total} συνολικά',
  },
  view_all: { en: 'View all', el: 'Προβολή όλων' },
  no_events: { en: 'No upcoming events', el: 'Καμία επερχόμενη εκδήλωση' },
  no_events_hint: {
    en: 'Browse and join events in your ecosystem.',
    el: 'Δείτε και δηλώστε συμμετοχή σε εκδηλώσεις του οικοσυστήματός σας.',
  },
  browse_events: { en: 'Browse events', el: 'Περιήγηση εκδηλώσεων' },

  // ── The rail ──
  quick_actions: { en: 'Quick Actions', el: 'Γρήγορες ενέργειες' },
  explore_people: { en: 'Explore People', el: 'Εξερεύνηση ατόμων' },
  view_matches: { en: 'View Matches', el: 'Προβολή αντιστοιχίσεων' },
  achievements: { en: 'Achievements', el: 'Επιτεύγματα' },
  activity_breakdown: { en: 'Activity Breakdown', el: 'Ανάλυση δραστηριότητας' },
  stay_active: { en: 'Stay Active', el: 'Μείνετε ενεργοί' },
  stay_active_hint: {
    en: 'Connect, engage, and grow your network daily.',
    el: 'Συνδεθείτε, συμμετέχετε και μεγαλώστε το δίκτυό σας καθημερινά.',
  },
  view_analytics: { en: 'View Analytics', el: 'Προβολή αναλυτικών' },
};

export function activityEn(key: keyof typeof ACTIVITY_STRINGS): string {
  return ACTIVITY_STRINGS[key].en;
}

export function activityEl(key: keyof typeof ACTIVITY_STRINGS): string {
  return ACTIVITY_STRINGS[key].el;
}
