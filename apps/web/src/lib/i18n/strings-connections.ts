import type { BilingualPair } from './types';

/**
 * Connections page — bilingual EN + EL.
 */
export const CONNECTIONS_STRINGS: Record<string, BilingualPair> = {
  page_title: { en: 'Connections', el: 'Συνδέσεις' },
  page_description: {
    en: 'Pending requests, active relationships, and intros you sent or received.',
    el: 'Εκκρεμή αιτήματα, ενεργές σχέσεις και αιτήματα γνωριμίας που στείλατε ή λάβατε.',
  },
  find_people: { en: 'Find people', el: 'Εύρεση ατόμων' },
  message: { en: 'Message', el: 'Μήνυμα' },
  accept: { en: 'Accept', el: 'Αποδοχή' },
  decline: { en: 'Decline', el: 'Απόρριψη' },
  accept_intro: { en: 'Accept intro', el: 'Αποδοχή γνωριμίας' },
  pending: { en: 'Pending', el: 'Εκκρεμεί' },
  retry: { en: 'Retry', el: 'Επανάληψη' },
  discover_people: { en: 'Discover people', el: 'Ανακάλυψη ατόμων' },

  // tabs
  intro_requests: { en: 'Intro Requests', el: 'Αιτήματα γνωριμίας' },
  received: { en: 'Received', el: 'Ληφθέντα' },
  sent: { en: 'Sent', el: 'Απεσταλμένα' },
  connected: { en: 'Connected', el: 'Συνδεδεμένα' },

  // stats
  stat_connected: { en: 'Connected', el: 'Συνδεδεμένοι' },
  stat_intro_requests: { en: 'Intro Requests', el: 'Αιτήματα γνωριμίας' },
  stat_sent_pending: { en: 'Sent Pending', el: 'Αποσταλέντα εκκρεμή' },
  stat_total_interactions: { en: 'Total Interactions', el: 'Σύνολο αλληλεπιδράσεων' },

  // empty states
  no_intro_requests: { en: 'No intro requests', el: 'Δεν υπάρχουν αιτήματα γνωριμίας' },
  no_intro_desc: {
    en: 'When someone sends you a connection request with a message, it appears here.',
    el: 'Όταν κάποιος σας στέλνει αίτημα σύνδεσης με μήνυμα, εμφανίζεται εδώ.',
  },
  no_pending_requests: { en: 'No pending requests', el: 'Δεν υπάρχουν εκκρεμή αιτήματα' },
  no_sent_requests: { en: 'No sent requests', el: 'Δεν υπάρχουν αποσταλέντα αιτήματα' },
  no_connections_yet: { en: 'No connections yet', el: 'Δεν υπάρχουν συνδέσεις ακόμα' },
  start_connecting: {
    en: 'Start connecting with founders, mentors, and investors.',
    el: 'Ξεκινήστε να συνδέεστε με ιδρυτές, μέντορες και επενδυτές.',
  },
  browse_profiles: {
    en: 'Browse profiles and send connection requests.',
    el: 'Περιηγηθείτε σε προφίλ και στείλτε αιτήματα σύνδεσης.',
  },
  when_people_send: {
    en: 'When people send you requests, they appear here.',
    el: 'Όταν σας στέλνουν αιτήματα, εμφανίζονται εδώ.',
  },
  failed_to_load_requests: { en: 'Failed to load requests.', el: 'Αποτυχία φόρτωσης αιτημάτων.' },
  failed_to_load_connections: { en: 'Failed to load connections.', el: 'Αποτυχία φόρτωσης συνδέσεων.' },

  // toast
  request_declined: { en: 'Request declined', el: 'Το αίτημα απορρίφθηκε' },
  request_removed: { en: 'The request has been removed.', el: 'Το αίτημα αφαιρέθηκε.' },
  could_not_respond: { en: 'Could not respond', el: 'Αδυναμία απόκρισης' },

  // intro card label
  intro_request: { en: 'Intro request', el: 'Αίτημα γνωριμίας' },
  ai_collaboration: { en: 'AI collaboration insight', el: 'Ανάλυση συνεργασίας AI' },
};

export function connectionsEn(key: keyof typeof CONNECTIONS_STRINGS): string {
  return CONNECTIONS_STRINGS[key].en;
}

export function connectionsEl(key: keyof typeof CONNECTIONS_STRINGS): string {
  return CONNECTIONS_STRINGS[key].el;
}
