import type { BilingualPair } from './types';

export const ANALYTICS_STRINGS: Record<string, BilingualPair> = {
  page_title: { en: 'Analytics', el: 'Αναλυτικά' },
  page_description: {
    en: 'Track your profile performance and network growth.',
    el: 'Παρακολουθήστε την απόδοση προφίλ και την ανάπτυξη δικτύου.',
  },
  refresh: { en: 'Refresh', el: 'Ανανέωση' },
  ask_ai: { en: 'Ask AI', el: 'Ρωτήστε το AI' },
  ask_ai_insights: {
    en: 'Ask AI to interpret these metrics',
    el: 'Ρωτήστε το AI να ερμηνεύσει τις μετρήσεις',
  },
  vs_prev: { en: 'vs prev period', el: 'vs προηγ. περίοδο' },
  network_velocity: { en: 'Network Velocity', el: 'Ταχύτητα δικτύου' },
  profile_funnel: { en: 'Profile Funnel', el: 'Χοάνη προφίλ' },
  funnel_note: {
    en: 'Recorded counts, not attributed conversion rates.',
    el: 'Καταγεγραμμένα πλήθη, όχι τεκμηριωμένα ποσοστά μετατροπής.',
  },
  funnel_untracked_requests: {
    en: 'Connection requests are not counted yet — open Discover to send some.',
    el: 'Τα αιτήματα σύνδεσης δεν μετρώνται ακόμη — ανοίξτε την Εξερεύνηση για να στείλετε.',
  },
  funnel_untracked_conversations: {
    en: 'Conversations started are not counted yet — open Messages to reply.',
    el: 'Οι συνομιλίες που ξεκίνησαν δεν μετρώνται ακόμη — ανοίξτε τα Μηνύματα για να απαντήσετε.',
  },
  stage_views: { en: 'Profile Views', el: 'Προβολές προφίλ' },
  stage_requests: { en: 'Connection Requests', el: 'Αιτήματα σύνδεσης' },
  stage_accepted: { en: 'Accepted Connections', el: 'Αποδεκτές συνδέσεις' },
  stage_conversations: { en: 'Conversations Started', el: 'Συνομιλίες που ξεκίνησαν' },
  weekly_summary: { en: 'Weekly Summary', el: 'Εβδομαδιαία σύνοψη' },
  most_active_day: { en: 'Most Active Day', el: 'Πιο ενεργή ημέρα' },
  peak_hour: { en: 'Peak Hour', el: 'Ώρα αιχμής' },
  avg_response: { en: 'Avg. Response Time', el: 'Μέσος χρόνος απάντησης' },
  total_interactions: { en: 'Total Interactions', el: 'Συνολικές αλληλεπιδράσεις' },
  top_content: { en: 'Top Performing Content', el: 'Κορυφαίο περιεχόμενο' },
  views: { en: 'views', el: 'προβολές' },
  engagements: { en: 'engagements', el: 'αλληλεπιδράσεις' },
  achievements: { en: 'Achievements', el: 'Επιτεύγματα' },
  unlocked: { en: 'Unlocked', el: 'Ξεκλειδωμένο' },
  no_engagement: { en: 'No engagement data available yet.', el: 'Δεν υπάρχουν ακόμα δεδομένα αφοσίωσης.' },
  no_views: { en: 'Not enough profile-view data yet.', el: 'Δεν υπάρχουν ακόμα αρκετά δεδομένα προβολών.' },
  load_failed: { en: 'Failed to load analytics data.', el: 'Αποτυχία φόρτωσης αναλυτικών δεδομένων.' },
  try_again: { en: 'Try again', el: 'Επανάληψη' },
  tab_overview: { en: 'Overview', el: 'Επισκόπηση' },
  tab_engagement: { en: 'Engagement', el: 'Αφοσίωση' },
  tab_growth: { en: 'Growth', el: 'Ανάπτυξη' },
  metric_views: { en: 'Profile Views', el: 'Προβολές προφίλ' },
  metric_connections: { en: 'New Connections', el: 'Νέες συνδέσεις' },
  metric_messages: { en: 'Messages Sent', el: 'Μηνύματα που στάλθηκαν' },
  metric_engagement: { en: 'Engagement Rate', el: 'Ποσοστό αφοσίωσης' },
  metric_search: { en: 'Search Appearances', el: 'Εμφανίσεις αναζήτησης' },
  metric_activity: { en: 'Activity Score', el: 'Βαθμός δραστηριότητας' },
  view_to_connect: {
    en: 'of views became connections',
    el: 'των προβολών έγιναν συνδέσεις',
  },
  spark_caption: { en: 'This window', el: 'Αυτό το διάστημα' },
  open_profile: { en: 'Open profile', el: 'Άνοιγμα προφίλ' },
  open_connections: { en: 'Open connections', el: 'Άνοιγμα συνδέσεων' },
  open_messages: { en: 'Open messages', el: 'Άνοιγμα μηνυμάτων' },
  open_discover: { en: 'Open Discover', el: 'Άνοιγμα Εξερεύνησης' },
  view_engagement: { en: 'View engagement', el: 'Δείτε την αφοσίωση' },
  view_growth: { en: 'View growth', el: 'Δείτε την ανάπτυξη' },
  declining_prefix: { en: 'Down this window', el: 'Πτώση σε αυτό το διάστημα' },
  build_profile: { en: 'Build your profile', el: 'Χτίστε το προφίλ σας' },
  grow_network: { en: 'Grow your network', el: 'Αναπτύξτε το δίκτυό σας' },
  follow_up: { en: 'Follow up with people you know', el: 'Συνεχίστε με όσους ήδη γνωρίζετε' },
  plan_peak_hour: { en: 'Plan around your peak hour', el: 'Προγραμματίστε στην ώρα αιχμής' },
  reply_faster: { en: 'Reply in Messages', el: 'Απαντήστε στα Μηνύματα' },
  window_highlights: { en: 'This window', el: 'Αυτό το διάστημα' },
  export_csv: { en: 'CSV', el: 'CSV' },
  series_views: { en: 'Views', el: 'Προβολές' },
  series_unique: { en: 'Unique', el: 'Μοναδικές' },
  open_achievements: { en: 'Open achievements', el: 'Άνοιγμα επιτευγμάτων' },
};

export function analyticsEn(key: keyof typeof ANALYTICS_STRINGS): string {
  return ANALYTICS_STRINGS[key].en;
}

export function analyticsEl(key: keyof typeof ANALYTICS_STRINGS): string {
  return ANALYTICS_STRINGS[key].el;
}
