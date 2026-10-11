import type { BilingualPair } from './types';

/**
 * Notifications page — bilingual EN + EL.
 */
export const NOTIFICATIONS_STRINGS: Record<string, BilingualPair> = {
  // ── Page header ──
  page_title: { en: 'Notifications', el: 'Ειδοποιήσεις' },
  page_description: {
    en: 'Stay on top of connection requests, messages, and platform activity. Click a card to jump straight to context.',
    el: 'Ενημερωθείτε για αιτήματα σύνδεσης, μηνύματα και δραστηριότητα πλατφόρμας. Πατήστε μία κάρτα για άμεση μετάβαση.',
  },

  // ── Filter tabs ──
  filter_all: { en: 'All', el: 'Όλες' },
  filter_connections: { en: 'Connections', el: 'Συνδέσεις' },
  filter_messages: { en: 'Messages', el: 'Μηνύματα' },
  filter_matches: { en: 'Matches', el: 'Αντιστοιχίσεις' },
  filter_events: { en: 'Events', el: 'Εκδηλώσεις' },
  filter_achievements: { en: 'Achievements', el: 'Επιτεύγματα' },
  filter_community: { en: 'Community', el: 'Κοινότητα' },
  filter_system: { en: 'System', el: 'Σύστημα' },

  // ── Type labels ──
  type_connection: { en: 'Connection', el: 'Σύνδεση' },
  type_message: { en: 'Message', el: 'Μήνυμα' },
  type_event: { en: 'Event', el: 'Εκδήλωση' },
  type_match: { en: 'Match', el: 'Αντιστοίχιση' },
  type_achievement: { en: 'Achievement', el: 'Επίτευγμα' },
  type_job: { en: 'Job', el: 'Εργασία' },
  type_community: { en: 'Community', el: 'Κοινότητα' },
  type_system: { en: 'System', el: 'Σύστημα' },

  // ── Time groups ──
  group_today: { en: 'Today', el: 'Σήμερα' },
  group_yesterday: { en: 'Yesterday', el: 'Χθες' },
  group_this_week: { en: 'This Week', el: 'Αυτή την εβδομάδα' },
  group_older: { en: 'Older', el: 'Παλαιότερες' },

  // ── Time-ago ──
  just_now: { en: 'just now', el: 'μόλις τώρα' },

  // ── Actions ──
  mark_read: { en: 'Mark read', el: 'Σημείωση ως αναγνωσμένη' },
  mark_all_read: { en: 'Mark all read', el: 'Σημείωση όλων ως αναγνωσμένες' },
  delete: { en: 'Delete', el: 'Διαγραφή' },
  view: { en: 'View', el: 'Προβολή' },
  retry: { en: 'Retry', el: 'Επανάληψη' },
  refresh: { en: 'Refresh', el: 'Ανανέωση' },
  select: { en: 'Select', el: 'Επιλογή' },
  exit_select: { en: 'Exit select', el: 'Έξοδος επιλογής' },
  select_all: { en: 'Select all', el: 'Επιλογή όλων' },
  show_all_notifications: { en: 'Show all notifications', el: 'Εμφάνιση όλων των ειδοποιήσεων' },

  // ── Filters ──
  unread: { en: 'Unread', el: 'Αδιάβαστες' },
  unread_by_type: { en: 'Unread by type:', el: 'Αδιάβαστες ανά τύπο:' },

  // ── Empty / Error states ──
  error_load: { en: 'Failed to load notifications.', el: 'Αποτυχία φόρτωσης ειδοποιήσεων.' },
  empty_no_unread_title: { en: 'No unread notifications', el: 'Καμία αδιάβαστη ειδοποίηση' },
  empty_all_caught_up: { en: 'All caught up!', el: 'Είστε ενημερωμένοι!' },
  empty_no_unread_desc: { en: 'You have no unread notifications right now.', el: 'Δεν έχετε αδιάβαστες ειδοποιήσεις αυτή τη στιγμή.' },
  empty_desc: {
    en: "We'll notify you about connections, messages, and activity.",
    el: 'Θα σας ειδοποιήσουμε για συνδέσεις, μηνύματα και δραστηριότητα.',
  },

  // ── Summary ──
  showing: { en: 'Showing', el: 'Εμφάνιση' },
  notification_singular: { en: 'notification', el: 'ειδοποίηση' },
  notifications_plural: { en: 'notifications', el: 'ειδοποιήσεις' },
  selected: { en: 'selected', el: 'επιλεγμένες' },
};

export function notificationsEn(key: keyof typeof NOTIFICATIONS_STRINGS): string {
  return NOTIFICATIONS_STRINGS[key].en;
}

export function notificationsEl(key: keyof typeof NOTIFICATIONS_STRINGS): string {
  return NOTIFICATIONS_STRINGS[key].el;
}
