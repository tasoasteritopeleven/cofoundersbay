import type { BilingualPair } from './types';
import {
  resolveBilingualPair,
  useLanguagePreference,
} from './LanguagePreferenceContext';

/**
 * Messages page — bilingual EN + EL.
 */
export const MESSAGES_STRINGS: Record<string, BilingualPair> = {
  page_title: { en: 'Messages', el: 'Μηνύματα' },
  page_description: {
    en: 'Direct conversations with your connections and collaborators.',
    el: 'Άμεσες συνομιλίες με τις συνδέσεις και τους συνεργάτες σας.',
  },
  ask_ai: { en: 'Ask AI', el: 'Ρωτήστε το AI' },
  ask_ai_hint: {
    en: 'Draft a reply, summarise this thread, or suggest who to message next.',
    el: 'Συντάξτε απάντηση, συνοψίστε το νήμα ή προτείνετε ποιον να γράψετε μετά.',
  },
  ask_ai_short: {
    en: 'Draft a reply for you',
    el: 'Συντάσσει μια απάντηση',
  },
  new_message_short: {
    en: 'Write to a connection',
    el: 'Γράψτε σε μια σύνδεση',
  },

  all: { en: 'All', el: 'Όλα' },
  unread: { en: 'Unread', el: 'Αδιάβαστα' },
  pinned: { en: 'Pinned', el: 'Καρφιτσωμένα' },
  archived: { en: 'Archived', el: 'Αρχειοθετημένα' },
  requests: { en: 'Requests', el: 'Αιτήματα' },
  chats: { en: 'Chats', el: 'Συνομιλίες' },
  intros: { en: 'Intros', el: 'Γνωριμίες' },
  all_messages: { en: 'All messages', el: 'Όλα τα μηνύματα' },

  new_message: { en: 'New message', el: 'Νέο μήνυμα' },
  new_message_hint: {
    en: 'Pick someone you already connected with, or find people on Discover.',
    el: 'Επιλέξτε κάποιον με τον οποίο είστε ήδη συνδεδεμένοι, ή βρείτε άτομα στην Εξερεύνηση.',
  },
  type_message: { en: 'Type a message…', el: 'Πληκτρολογήστε μήνυμα…' },
  type_message_hint: {
    en: 'Enter to send, Shift+Enter for a new line',
    el: 'Enter για αποστολή, Shift+Enter για νέα γραμμή',
  },
  tap_message_hint: {
    en: 'Tap a message to reply or react.',
    el: 'Πατήστε ένα μήνυμα για απάντηση ή αντίδραση.',
  },
  send: { en: 'Send', el: 'Αποστολή' },
  pin: { en: 'Pin', el: 'Καρφίτσωμα' },
  unpin: { en: 'Unpin', el: 'Ξεκαρφίτσωμα' },
  archive: { en: 'Archive', el: 'Αρχειοθέτηση' },
  unarchive: { en: 'Unarchive', el: 'Αναίρεση αρχειοθέτησης' },
  mark_read: { en: 'Mark as read', el: 'Σήμανση ως αναγνωσμένο' },
  delete_chat: { en: 'Delete chat', el: 'Διαγραφή συνομιλίας' },
  report_block: { en: 'Report / Block', el: 'Αναφορά / Αποκλεισμός' },
  view_profile: { en: 'View profile', el: 'Προβολή προφίλ' },
  report: { en: 'Report', el: 'Αναφορά' },
  block: { en: 'Block', el: 'Αποκλεισμός' },
  reply: { en: 'Reply', el: 'Απάντηση' },
  copy: { en: 'Copy', el: 'Αντιγραφή' },
  copied: { en: 'Copied', el: 'Αντιγράφηκε' },
  attach: { en: 'Attach a file', el: 'Επισύναψη αρχείου' },
  emoji: { en: 'Insert emoji', el: 'Εισαγωγή emoji' },
  search_in_chat: { en: 'Search messages…', el: 'Αναζήτηση μηνυμάτων…' },
  search_messages: { en: 'Search messages', el: 'Αναζήτηση μηνυμάτων' },
  results_n: { en: 'results', el: 'αποτελέσματα' },
  result_one: { en: 'result', el: 'αποτέλεσμα' },
  load_older: { en: 'Load older messages', el: 'Φόρτωση παλαιότερων' },
  loading: { en: 'Loading…', el: 'Φόρτωση…' },
  preparing: { en: 'Preparing your messages…', el: 'Προετοιμασία μηνυμάτων…' },
  you: { en: 'You', el: 'Εσείς' },
  voice_soon: { en: 'Voice call (coming soon)', el: 'Κλήση φωνής (σύντομα)' },
  video_soon: { en: 'Video call (coming soon)', el: 'Βιντεοκλήση (σύντομα)' },
  last_seen: { en: 'Last seen', el: 'Τελευταία εμφάνιση' },
  today: { en: 'Today', el: 'Σήμερα' },
  yesterday: { en: 'Yesterday', el: 'Χθες' },
  no_messages_yet: { en: 'No messages yet', el: 'Δεν υπάρχουν μηνύματα ακόμα' },
  no_results_for: { en: 'No results for', el: 'Κανένα αποτέλεσμα για' },
  no_conversations_found: { en: 'No conversations found', el: 'Δεν βρέθηκαν συνομιλίες' },
  connect_to_chat: {
    en: 'Connect with founders, mentors, and investors to start chatting',
    el: 'Συνδεθείτε με ιδρυτές, μέντορες και επενδυτές για να ξεκινήσετε συνομιλία',
  },
  find_people_message: { en: 'Find people to message', el: 'Βρείτε άτομα για μήνυμα' },
  view_connections: { en: 'View connections', el: 'Προβολή συνδέσεων' },
  empty_inbox_title: { en: 'Pick a conversation', el: 'Επιλέξτε συνομιλία' },
  empty_inbox_hint: {
    en: 'Select someone from the list, or start a new thread with a connection.',
    el: 'Επιλέξτε κάποιον από τη λίστα, ή ξεκινήστε νέο νήμα με μια σύνδεση.',
  },
  empty_or: { en: 'or', el: 'ή' },
  inbox_lead: {
    en: 'Pinned, unread, and recent threads.',
    el: 'Καρφιτσωμένα, αδιάβαστα και πρόσφατα νήματα.',
  },
  intro_empty_hint: {
    en: 'When someone sends you a connection request, it will appear here.',
    el: 'Όταν κάποιος σας στείλει αίτημα σύνδεσης, θα εμφανιστεί εδώ.',
  },
  compose_search: { en: 'Search connections…', el: 'Αναζήτηση συνδέσεων…' },
  compose_empty: { en: 'No connections match', el: 'Καμία σύνδεση δεν ταιριάζει' },
  compose_none: {
    en: 'You have no connections to message yet.',
    el: 'Δεν έχετε ακόμα συνδέσεις για μήνυμα.',
  },
  open_chat: { en: 'Open chat', el: 'Άνοιγμα συνομιλίας' },

  no_conversations: { en: 'No conversations yet', el: 'Δεν υπάρχουν συνομιλίες ακόμα' },
  no_conversations_desc: {
    en: 'Start chatting with your connections or send a message from a profile.',
    el: 'Ξεκινήστε να συνομιλείτε με τις συνδέσεις σας ή στείλτε μήνυμα από ένα προφίλ.',
  },
  no_unread: { en: 'No unread messages', el: 'Δεν υπάρχουν αδιάβαστα μηνύματα' },
  no_pinned: { en: 'No pinned conversations', el: 'Δεν υπάρχουν καρφιτσωμένες συνομιλίες' },
  no_archived: { en: 'No archived conversations', el: 'Δεν υπάρχουν αρχειοθετημένες συνομιλίες' },
  select_conversation: { en: 'Select a conversation to start messaging', el: 'Επιλέξτε συνομιλία για να ξεκινήσετε' },
  find_people: { en: 'Find people', el: 'Εύρεση ατόμων' },

  accept: { en: 'Accept', el: 'Αποδοχή' },
  decline: { en: 'Decline', el: 'Απόρριψη' },
  pending_requests: { en: 'Pending Requests', el: 'Εκκρεμή αιτήματα' },
  no_pending: { en: 'No pending requests', el: 'Δεν υπάρχουν εκκρεμή αιτήματα' },
  wants_to_connect: { en: 'wants to connect', el: 'θέλει να συνδεθεί' },

  // Neutral, so no slash: «Συνδεδεμένος/η» read as a form field.
  online: { en: 'Online', el: 'Σε σύνδεση' },
  offline: { en: 'Offline', el: 'Εκτός σύνδεσης' },
  typing: { en: 'typing…', el: 'γράφει…' },

  message_sent: { en: 'Message sent', el: 'Το μήνυμα στάλθηκε' },
  connection_accepted: { en: 'Connection accepted', el: 'Η σύνδεση αποδέχτηκε' },
  connection_accepted_hint: { en: 'You can now message this person.', el: 'Μπορείτε πλέον να στείλετε μήνυμα.' },
  request_declined: { en: 'Request declined', el: 'Το αίτημα απορρίφθηκε' },
  could_not_load: { en: 'Could not load messages', el: 'Αδυναμία φόρτωσης μηνυμάτων' },
  try_again: { en: 'Please try again', el: 'Δοκιμάστε ξανά' },
  not_connected: { en: 'Not connected', el: 'Χωρίς σύνδεση' },
  reconnect: { en: 'Reconnect and try again', el: 'Επανασυνδεθείτε και δοκιμάστε ξανά' },
  start_fail: { en: 'Could not start conversation', el: 'Αδυναμία έναρξης συνομιλίας' },
  load_fail: { en: 'Failed to load messages', el: 'Αποτυχία φόρτωσης μηνυμάτων' },
  update_fail: { en: 'Update failed', el: 'Η ενημέρωση απέτυχε' },
  action_fail: { en: 'Action failed', el: 'Η ενέργεια απέτυχε' },
  pinned_toast: { en: 'Pinned', el: 'Καρφιτσώθηκε' },
  unpinned_toast: { en: 'Unpinned', el: 'Ξεκαρφιτσώθηκε' },
  updated: { en: 'Conversation updated', el: 'Η συνομιλία ενημερώθηκε' },
  archived_toast: { en: 'Conversation archived', el: 'Η συνομιλία αρχειοθετήθηκε' },
  archived_hint: { en: 'It will be hidden from your inbox', el: 'Θα κρυφτεί από τα εισερχόμενα' },
  attach_fail: { en: 'Some attachments failed', el: 'Ορισμένα συνημμένα απέτυχαν' },
  attach_fail_hint: { en: 'Message will be sent with uploaded files only', el: 'Το μήνυμα θα σταλεί μόνο με τα αρχεία που ανέβηκαν' },
  init_fail: { en: 'Failed to initialize messages', el: 'Αποτυχία αρχικοποίησης μηνυμάτων' },

  search_conversations: { en: 'Search conversations…', el: 'Αναζήτηση συνομιλιών…' },

  popup_ai: { en: 'AI', el: 'Βοηθός' },
  popup_title: { en: 'Chat', el: 'Συνομιλία' },
  open_full_inbox: { en: 'Open full inbox', el: 'Πλήρη εισερχόμενα' },
  say_hello: { en: 'Say hello', el: 'Πείτε ένα γεια' },
  start_conversation_with: {
    en: 'Start a conversation with',
    el: 'Ξεκινήστε συνομιλία με',
  },
  find_matches: { en: 'Matches', el: 'Αντιστοιχίσεις' },
  discover_people: { en: 'Discover', el: 'Εξερεύνηση' },
  connections: { en: 'Connections', el: 'Συνδέσεις' },
  reconnecting: {
    en: 'Reconnecting to live chat…',
    el: 'Επανασύνδεση στη ζωντανή συνομιλία…',
  },
  drag_panel: {
    en: 'Drag the header to move',
    el: 'Σύρετε την κεφαλίδα για μετακίνηση',
  },
  no_messages_yet_short: { en: 'No messages yet', el: 'Χωρίς μηνύματα ακόμα' },
  empty_inbox_cta: {
    en: 'Message a match, or find someone on Discover.',
    el: 'Στείλτε μήνυμα σε αντιστοίχιση, ή βρείτε κάποιον στην Εξερεύνηση.',
  },
  schedule_meet: { en: 'Schedule', el: 'Προγραμματισμός' },
  ask_ai_about: { en: 'Ask AI', el: 'Ρωτήστε το AI' },
  view_match: { en: 'View match', el: 'Προβολή αντιστοίχισης' },
  open_calendar: { en: 'Calendar', el: 'Ημερολόγιο' },
  draft_with_ai: { en: 'Draft with AI', el: 'Σύνταξη με AI' },
  propose_time: { en: 'Propose a time', el: 'Προτείνετε ώρα' },
  empty_thread_title: { en: 'Start the conversation', el: 'Ξεκινήστε τη συνομιλία' },
  empty_thread_hint: {
    en: 'Say hello, propose a time, or ask AI to draft the first message.',
    el: 'Πείτε ένα γεια, προτείνετε ώρα, ή ζητήστε από το AI να συντάξει το πρώτο μήνυμα.',
  },
  say_hello_draft: {
    en: 'Hi {name}, great to connect — would love to compare notes.',
    el: 'Γεια σου {name}, χαίρομαι για τη σύνδεση — θα χαρώ να συγκρίνουμε σημειώσεις.',
  },
  schedule_draft: {
    en: 'Would you like to find a time on the calendar this week?',
    el: 'Θέλεις να βρούμε μια ώρα στο ημερολόγιο αυτή την εβδομάδα;',
  },
  intro_accept_to_chat: {
    en: 'Accept to start a private chat.',
    el: 'Αποδεχτείτε για να ξεκινήσετε ιδιωτική συνομιλία.',
  },
  connection_request: { en: 'Connection request', el: 'Αίτημα σύνδεσης' },
  recent_conversations: { en: 'Recent threads', el: 'Πρόσφατα νήματα' },
  browse_matches: { en: 'Browse matches', el: 'Δείτε αντιστοιχίσεις' },
  open_ai_page: { en: 'Open full AI assistant', el: 'Πλήρης βοηθός AI' },
  no_intro_selected: {
    en: 'Select a request to review it here.',
    el: 'Επιλέξτε ένα αίτημα για να το δείτε εδώ.',
  },
  headline_fallback: { en: 'CoFounderBay member', el: 'Μέλος του CoFounderBay' },
  conversation_options: { en: 'Conversation options', el: 'Επιλογές συνομιλίας' },
  back_to_conversations: { en: 'Back to conversations', el: 'Πίσω στις συνομιλίες' },
  close_search: { en: 'Close search', el: 'Κλείσιμο αναζήτησης' },
  cancel_reply: { en: 'Cancel reply', el: 'Ακύρωση απάντησης' },
  add_reaction: { en: 'Add reaction', el: 'Προσθήκη αντίδρασης' },

  val_change: { en: 'Change', el: 'Αλλαγή' },
  val_save_transcript: { en: 'Save transcript', el: 'Αποθήκευση αντιγράφου' },
  val_casual: { en: 'Casual chat', el: 'Απλή συνομιλία' },
  val_one: { en: 'One-party validation', el: 'Επικύρωση ενός μέρους' },
  val_two: { en: 'Two-party validation', el: 'Επικύρωση δύο μερών' },
  val_casual_desc: { en: 'Standard private messaging, no validation', el: 'Ιδιωτικά μηνύματα χωρίς επικύρωση' },
  val_one_desc: { en: 'You can save and validate your side of the conversation', el: 'Μπορείτε να αποθηκεύσετε και να επικυρώσετε τη δική σας πλευρά' },
  val_two_desc: { en: 'Both parties agree to a validated transcript', el: 'Και τα δύο μέρη συμφωνούν σε επικυρωμένο αντίγραφο' },
};

export function messagesEn(key: keyof typeof MESSAGES_STRINGS): string {
  return MESSAGES_STRINGS[key].en;
}

export function messagesEl(key: keyof typeof MESSAGES_STRINGS): string {
  return MESSAGES_STRINGS[key].el;
}

export function useMessagesPrimaryText() {
  const { primary, showSecondary } = useLanguagePreference();
  return (en: string, el: string) => resolveBilingualPair(en, el, primary, showSecondary).primaryText;
}

/** Demo thread bodies from `lib/preview-api.ts`, keyed by exact English text. */
export const PREVIEW_MESSAGE_EL: Record<string, string> = {
  'Want to compare notes on the research canvas this week?':
    'Θέλεις να συγκρίνουμε σημειώσεις στον πίνακα έρευνας αυτή την εβδομάδα;',
  'Loved your Harbor update — the founder OS angle is sharp.':
    'Μου άρεσε η ενημέρωση του Harbor — η οπτική του founder OS είναι εύστοχη.',
  'I sketched a Next.js + Nest starter we can reuse.':
    'Έφτιαξα ένα starter Next.js + Nest που μπορούμε να ξαναχρησιμοποιήσουμε.',
  'Would love to swap intros in the Athens founder circle.':
    'Θα ήθελα να ανταλλάξουμε γνωριμίες στον κύκλο ιδρυτών της Αθήνας.',
  'Marcus Chen is a 88% skill complement.':
    'Ο Marcus Chen συμπληρώνει τις δεξιότητες κατά 88%.',
};
