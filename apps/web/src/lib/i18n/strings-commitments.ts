import type { BilingualPair } from './types';

/**
 * Copy for need cards and the commitment ladder. English is canonical;
 * Greek uses the product's words: «δέσμευση» for a commitment, «κάρτα
 * ανάγκης» for a need card, «όροι» for terms, «αίθουσα συμφωνίας» for the
 * deal room.
 */
export const CMT = {
  // Area
  area: { en: 'Commitments', el: 'Δεσμεύσεις' },
  area_hint: {
    en: 'Need cards, and the ladder from interest to agreed terms.',
    el: 'Κάρτες ανάγκης και η κλίμακα από το ενδιαφέρον ως τους συμφωνημένους όρους.',
  },
  write_card: { en: 'Write a need card', el: 'Νέα κάρτα ανάγκης' },
  two_minutes: { en: 'About two minutes', el: 'Περίπου δύο λεπτά' },

  // Card kinds
  kind_cofounder: { en: 'Co-founder seat', el: 'Θέση συνιδρυτή' },
  kind_equity_role: { en: 'Role with equity', el: 'Ρόλος με equity' },
  kind_investor_intro: { en: 'Investor introduction', el: 'Σύσταση σε επενδυτή' },
  kind_cofounder_hint: { en: 'A partner who shares ownership and the work.', el: 'Συνέταιρος που μοιράζεται την ιδιοκτησία και τη δουλειά.' },
  kind_equity_role_hint: { en: 'A role paid partly or wholly in equity.', el: 'Ρόλος που αμείβεται εν μέρει ή εξ ολοκλήρου με equity.' },
  kind_investor_intro_hint: { en: 'An investor, or an introduction to one.', el: 'Επενδυτής ή μια σύσταση σε επενδυτή.' },

  // The three sentences
  exists: { en: 'What already exists', el: 'Τι υπάρχει ήδη' },
  goal: { en: 'The outcome it is for', el: 'Το αποτέλεσμα που επιδιώκεται' },
  missing: { en: 'Who is missing', el: 'Ποιος λείπει' },
  exists_hint: { en: 'One sentence: product, traction, money already in.', el: 'Μία πρόταση: προϊόν, έλξη, χρήματα που έχουν ήδη μπει.' },
  goal_hint: { en: 'One sentence: what this person helps reach, and by when.', el: 'Μία πρόταση: τι βοηθά να πετύχετε αυτό το πρόσωπο και έως πότε.' },
  missing_hint: { en: 'One sentence: the person, by what they have done.', el: 'Μία πρόταση: το πρόσωπο, με βάση όσα έχει κάνει.' },
  exists_example: { en: 'e.g. A paid pilot with three Piraeus terminals and an Idea Core in Builder.', el: 'π.χ. Πληρωμένο πιλοτικό με τρία τερματικά στον Πειραιά και Πυρήνα ιδέας στον Builder.' },
  goal_example: { en: 'e.g. Twenty paying terminals and a closed seed by spring.', el: 'π.χ. Είκοσι τερματικά που πληρώνουν και κλειστός γύρος seed έως την άνοιξη.' },
  missing_example: { en: 'e.g. A technical co-founder who has run real-time systems in production.', el: 'π.χ. Τεχνικός συνιδρυτής που έχει λειτουργήσει συστήματα πραγματικού χρόνου.' },

  // Offer
  offer: { en: 'What is offered', el: 'Τι προσφέρεται' },
  offer_role: { en: 'Role', el: 'Ρόλος' },
  offer_equity: { en: 'Equity', el: 'Equity' },
  offer_equity_terms: { en: 'Terms offered', el: 'Όροι που προσφέρονται' },
  offer_hours: { en: 'Hours a week', el: 'Ώρες την εβδομάδα' },
  offer_scope: { en: 'Scope', el: 'Εύρος' },
  per_week: { en: 'h/week', el: 'ώρ./εβδ.' },

  // Filters
  filters: { en: 'Filters people search by', el: 'Φίλτρα αναζήτησης' },
  category: { en: 'Category', el: 'Κατηγορία' },
  place: { en: 'Place', el: 'Τόπος' },
  remote: { en: 'Remote', el: 'Εξ αποστάσεως' },
  stage: { en: 'Stage', el: 'Στάδιο' },
  commitment: { en: 'Commitment', el: 'Δέσμευση' },
  kind: { en: 'Kind of commitment', el: 'Είδος δέσμευσης' },

  // Evidence
  evidence: { en: 'From their workspace', el: 'Από τον χώρο εργασίας τους' },
  ev_milestones: { en: 'milestones completed', el: 'ορόσημα ολοκληρωμένα' },
  ev_documents: { en: 'Builder documents finished', el: 'έγγραφα Builder ολοκληρωμένα' },
  ev_endorsements: { en: 'endorsements', el: 'συστάσεις' },
  ev_email: { en: 'Email verified', el: 'Επαληθευμένο email' },

  // Card meta
  version: { en: 'Version', el: 'Έκδοση' },
  offer_changed: { en: 'The offer changed since you answered', el: 'Η προσφορά άλλαξε από τότε που απαντήσατε' },
  to_history_in: { en: 'Moves to history in', el: 'Μεταφέρεται στο ιστορικό σε' },
  days: { en: 'days', el: 'ημέρες' },
  responses: { en: 'Responses', el: 'Απαντήσεις' },
  by: { en: 'by', el: 'από' },

  // Ladder
  ladder: { en: 'Commitment ladder', el: 'Κλίμακα δέσμευσης' },
  rung_interest: { en: 'Interest', el: 'Ενδιαφέρον' },
  rung_conversation: { en: 'Conversation', el: 'Συζήτηση' },
  rung_confirmation: { en: 'Confirmation', el: 'Επιβεβαίωση' },
  rung_terms: { en: 'Terms', el: 'Όροι' },
  rung_agreed: { en: 'Agreed', el: 'Συμφωνία' },

  // Interest
  interest_title: { en: 'Interested?', el: 'Ενδιαφέρεστε;' },
  interest_hint: {
    en: 'Say in a line why you fit. The author sees your profile; contact details wait until you both confirm.',
    el: 'Πείτε σε μία γραμμή γιατί ταιριάζετε. Ο συντάκτης βλέπει το προφίλ σας· τα στοιχεία επικοινωνίας περιμένουν μέχρι να επιβεβαιώσετε και οι δύο.',
  },
  interest_send: { en: 'Send interest', el: 'Αποστολή ενδιαφέροντος' },
  interest_withdraw: { en: 'Withdraw interest', el: 'Ανάκληση ενδιαφέροντος' },
  interest_waiting: { en: 'Waiting for the author to accept your interest.', el: 'Αναμονή αποδοχής του ενδιαφέροντός σας από τον συντάκτη.' },
  interest_accept: { en: 'Accept and start the conversation', el: 'Αποδοχή και έναρξη συζήτησης' },
  interest_decline: { en: 'Decline', el: 'Απόρριψη' },
  not_taking: { en: 'This card is not taking interest any more.', el: 'Αυτή η κάρτα δεν δέχεται πια ενδιαφέρον.' },
  own_card: { en: 'This is your card. Responses appear below.', el: 'Αυτή είναι η κάρτα σας. Οι απαντήσεις εμφανίζονται παρακάτω.' },

  // Conversation
  protected: { en: 'Protected conversation', el: 'Προστατευμένη συζήτηση' },
  protected_hint: {
    en: 'No phone numbers, emails, links, handles or payment details until you both confirm. It keeps first contact about the work.',
    el: 'Χωρίς τηλέφωνα, email, συνδέσμους, λογαριασμούς ή στοιχεία πληρωμής μέχρι να επιβεβαιώσετε και οι δύο. Η πρώτη επαφή μένει στη δουλειά.',
  },
  read_only: { en: 'Read-only since the terms space opened.', el: 'Μόνο για ανάγνωση από τότε που άνοιξαν οι όροι.' },
  write_message: { en: 'Write a message', el: 'Γράψτε μήνυμα' },
  send: { en: 'Send', el: 'Αποστολή' },
  would_share: { en: 'This would share', el: 'Αυτό θα μοιραζόταν' },
  no_messages: { en: 'No messages yet. Start with what you would do in the first month.', el: 'Δεν υπάρχουν μηνύματα. Ξεκινήστε με όσα θα κάνατε τον πρώτο μήνα.' },

  // Confirmation
  confirm_title: { en: 'Discuss terms?', el: 'Συζήτηση όρων;' },
  confirm_hint: {
    en: 'Each of you confirms separately. Neither sees the other’s answer until both have said yes; then the terms space opens.',
    el: 'Ο καθένας επιβεβαιώνει χωριστά. Κανείς δεν βλέπει την απάντηση του άλλου μέχρι να πουν και οι δύο ναι· τότε ανοίγουν οι όροι.',
  },
  confirm: { en: 'Confirm', el: 'Επιβεβαίωση' },
  confirmed_waiting: { en: 'You confirmed. You will both be told once you have both confirmed.', el: 'Επιβεβαιώσατε. Θα ενημερωθείτε και οι δύο μόλις επιβεβαιώσετε και οι δύο.' },
  confirm_retract: { en: 'Take back my confirmation', el: 'Ανάκληση της επιβεβαίωσής μου' },

  // Terms
  terms: { en: 'Terms', el: 'Όροι' },
  terms_hint: {
    en: 'Every change of substance is a new version. Three revisions after the first proposal; then agree or step back.',
    el: 'Κάθε ουσιαστική αλλαγή είναι νέα έκδοση. Τρεις αναθεωρήσεις μετά την πρώτη πρόταση· μετά συμφωνία ή αποχώρηση.',
  },
  revisions_left: { en: 'revisions left', el: 'αναθεωρήσεις απομένουν' },
  t_role: { en: 'Role', el: 'Ρόλος' },
  t_equity: { en: 'Equity %', el: 'Equity %' },
  t_vesting: { en: 'Vesting (months)', el: 'Κατοχύρωση (μήνες)' },
  t_cliff: { en: 'Cliff (months)', el: 'Cliff (μήνες)' },
  t_hours: { en: 'Hours a week', el: 'Ώρες την εβδομάδα' },
  t_scope: { en: 'Scope', el: 'Εύρος' },
  t_note: { en: 'Note', el: 'Σημείωση' },
  changed: { en: 'changed', el: 'άλλαξε' },
  accepted_by_you: { en: 'You accepted', el: 'Το αποδεχτήκατε' },
  accepted_by_them: { en: 'They accepted', el: 'Το αποδέχτηκαν' },
  not_accepted_by_you: { en: 'Not accepted by you yet', el: 'Δεν το έχετε αποδεχτεί ακόμη' },
  awaiting_them: { en: 'Waiting for them', el: 'Αναμονή της άλλης πλευράς' },
  accept_version: { en: 'Accept version', el: 'Αποδοχή έκδοσης' },
  propose: { en: 'Propose terms', el: 'Πρόταση όρων' },
  propose_version: { en: 'Propose version', el: 'Πρόταση έκδοσης' },
  propose_new: { en: 'Propose a change', el: 'Πρόταση αλλαγής' },
  note_only: { en: 'Only the note changed: no new version is made.', el: 'Άλλαξε μόνο η σημείωση: δεν δημιουργείται νέα έκδοση.' },
  uses_revision: { en: 'This uses one of your three revisions.', el: 'Αυτό χρησιμοποιεί μία από τις τρεις αναθεωρήσεις.' },
  limit_reached: { en: 'All three revisions are used. Accept the current terms or step back.', el: 'Χρησιμοποιήθηκαν και οι τρεις αναθεωρήσεις. Αποδεχτείτε τους τρέχοντες όρους ή αποχωρήστε.' },
  earlier_versions: { en: 'Earlier versions', el: 'Προηγούμενες εκδόσεις' },
  no_terms: { en: 'No terms yet. Either of you can make the first proposal.', el: 'Δεν υπάρχουν όροι ακόμη. Ο καθένας σας μπορεί να κάνει την πρώτη πρόταση.' },

  // Deal room
  deal_room: { en: 'Deal room', el: 'Αίθουσα συμφωνίας' },
  deal_room_open: {
    en: 'Agreed. The deal room is open and the terms are frozen while it is.',
    el: 'Συμφωνήθηκε. Η αίθουσα συμφωνίας είναι ανοιχτή και οι όροι παγωμένοι όσο είναι ανοιχτή.',
  },
  deal_room_data: { en: 'Open the data room', el: 'Άνοιγμα data room' },
  deal_room_close: { en: 'Close the deal room and revise', el: 'Κλείσιμο αίθουσας και αναθεώρηση' },
  frozen: { en: 'Frozen', el: 'Παγωμένοι' },

  // Stepping back
  step_back: { en: 'Step back', el: 'Αποχώρηση' },
  report_block: { en: 'Report or block', el: 'Αναφορά ή αποκλεισμός' },
  closed_thread: { en: 'This conversation is closed.', el: 'Αυτή η συζήτηση έκλεισε.' },

  // Owner
  share: { en: 'Public card', el: 'Δημόσια κάρτα' },
  share_hint: {
    en: 'A link without your email or phone. It leads to sign-up and then to this card.',
    el: 'Σύνδεσμος χωρίς email ή τηλέφωνο. Οδηγεί στην εγγραφή και μετά σε αυτή την κάρτα.',
  },
  share_create: { en: 'Create a public link', el: 'Δημιουργία δημόσιου συνδέσμου' },
  share_copy: { en: 'Copy link', el: 'Αντιγραφή συνδέσμου' },
  share_linkedin: { en: 'Share on LinkedIn', el: 'Κοινοποίηση στο LinkedIn' },
  share_revoke: { en: 'Turn the link off', el: 'Απενεργοποίηση συνδέσμου' },
  edit_card: { en: 'Edit card', el: 'Επεξεργασία κάρτας' },
  close_filled: { en: 'Close as filled', el: 'Κλείσιμο: καλύφθηκε' },
  close_withdrawn: { en: 'Withdraw card', el: 'Απόσυρση κάρτας' },
  reopen: { en: 'Reopen card', el: 'Επανενεργοποίηση κάρτας' },
  versions: { en: 'Card versions', el: 'Εκδόσεις κάρτας' },
  no_versions: { en: 'One version so far.', el: 'Μία έκδοση μέχρι στιγμής.' },
  rules: { en: 'How the ladder works', el: 'Πώς λειτουργεί η κλίμακα' },

  // Lists
  tab_mine: { en: 'My needs', el: 'Οι ανάγκες μου' },
  tab_responses: { en: 'My responses', el: 'Οι απαντήσεις μου' },
  tab_history: { en: 'History', el: 'Ιστορικό' },
  needs_you: { en: 'Needs you', el: 'Σας χρειάζονται' },
  nothing_waiting: { en: 'Nothing is waiting on you.', el: 'Τίποτα δεν περιμένει από εσάς.' },
  empty_mine: { en: 'No need cards yet. One card, three sentences: what exists, the outcome, who is missing.', el: 'Δεν υπάρχουν κάρτες ανάγκης. Μία κάρτα, τρεις προτάσεις: τι υπάρχει, το αποτέλεσμα, ποιος λείπει.' },
  first_card: { en: 'Write your first card', el: 'Γράψτε την πρώτη κάρτα' },
  empty_responses: { en: 'You have not answered a need card yet. Browse open cards in Opportunities.', el: 'Δεν έχετε απαντήσει ακόμη σε κάρτα ανάγκης. Δείτε ανοιχτές κάρτες στις Ευκαιρίες.' },
  empty_history: { en: 'Agreed and closed commitments move here thirty days after they settle.', el: 'Οι συμφωνημένες και κλειστές δεσμεύσεις έρχονται εδώ τριάντα ημέρες αφού κλείσουν.' },
  empty_filtered: { en: 'No cards match these filters.', el: 'Καμία κάρτα δεν ταιριάζει σε αυτά τα φίλτρα.' },
  open_filters: { en: 'Change filters', el: 'Αλλαγή φίλτρων' },
  open_board: { en: 'Open', el: 'Άνοιγμα' },
  outcome_filter: { en: 'Outcome', el: 'Έκβαση' },
  all: { en: 'All', el: 'Όλα' },
  needs_cards: { en: 'Need cards', el: 'Κάρτες ανάγκης' },
  needs_cards_hint: {
    en: 'Structured needs: what exists, the outcome, who is missing and what is offered.',
    el: 'Δομημένες ανάγκες: τι υπάρχει, το αποτέλεσμα, ποιος λείπει και τι προσφέρεται.',
  },

  // Next actions
  next_accept: { en: 'Accept or decline interest from', el: 'Αποδοχή ή απόρριψη ενδιαφέροντος από' },
  next_confirm: { en: 'Confirm or keep talking with', el: 'Επιβεβαίωση ή συνέχεια συζήτησης με' },
  next_accept_terms: { en: 'Read and accept terms from', el: 'Ανάγνωση και αποδοχή όρων από' },
  next_propose: { en: 'Propose the first terms to', el: 'Πρώτη πρόταση όρων προς' },
  waiting_on: { en: 'Waiting on', el: 'Αναμονή για' },

  // Guide
  guide_title: { en: 'Write a need card', el: 'Νέα κάρτα ανάγκης' },
  guide_edit_title: { en: 'Edit need card', el: 'Επεξεργασία κάρτας ανάγκης' },
  guide_intro: {
    en: 'People decide from what exists and what is offered, so say both plainly.',
    el: 'Οι άνθρωποι αποφασίζουν από ό,τι υπάρχει και ό,τι προσφέρεται, οπότε πείτε και τα δύο απλά.',
  },
  from_project: { en: 'Start from a project', el: 'Ξεκινήστε από ένα έργο' },
  from_project_none: { en: 'No project', el: 'Χωρίς έργο' },
  quality: { en: 'Before publishing', el: 'Πριν τη δημοσίευση' },
  preview: { en: 'Preview', el: 'Προεπισκόπηση' },
  publish: { en: 'Publish card', el: 'Δημοσίευση κάρτας' },
  save_changes: { en: 'Save changes', el: 'Αποθήκευση αλλαγών' },
  new_version_note: {
    en: 'Changing the role, equity, hours, scope or commitment makes a new version; people who answered see what changed.',
    el: 'Η αλλαγή ρόλου, equity, ωρών, εύρους ή δέσμευσης δημιουργεί νέα έκδοση· όσοι απάντησαν βλέπουν τι άλλαξε.',
  },
  checks_left: { en: 'checks left before publishing', el: 'έλεγχοι απομένουν πριν τη δημοσίευση' },
  ready: { en: 'Ready to publish', el: 'Έτοιμη για δημοσίευση' },

  // Public card
  public_by: { en: 'Shared by', el: 'Κοινοποιήθηκε από' },
  public_join: { en: 'Join to respond', el: 'Εγγραφή για απάντηση' },
  public_sign_in: { en: 'I have an account', el: 'Έχω ήδη λογαριασμό' },
  public_how: {
    en: 'Your first conversation stays on CoFounderBay, without contact details, until you both confirm you want to discuss terms.',
    el: 'Η πρώτη σας συζήτηση μένει στο CoFounderBay, χωρίς στοιχεία επικοινωνίας, μέχρι να επιβεβαιώσετε και οι δύο ότι θέλετε να συζητήσετε όρους.',
  },
  public_missing: { en: 'This link is not valid or was turned off.', el: 'Ο σύνδεσμος δεν είναι έγκυρος ή απενεργοποιήθηκε.' },

  // Outcomes panel (dashboard)
  outcomes: { en: 'Commitments', el: 'Δεσμεύσεις' },
  outcomes_hint: { en: 'Where your need cards and responses stand.', el: 'Πού βρίσκονται οι κάρτες και οι απαντήσεις σας.' },
} satisfies Record<string, BilingualPair>;

export type CmtKey = keyof typeof CMT;

/** The pair for a card kind. */
export function kindCopy(kind: string): BilingualPair {
  if (kind === 'equity_role') return CMT.kind_equity_role;
  if (kind === 'investor_intro') return CMT.kind_investor_intro;
  return CMT.kind_cofounder;
}

/** «2 milestones completed» / «Email verified», for an evidence chip. */
export function evidenceCopy(item: { id: string; count?: number; value?: boolean }): BilingualPair | null {
  const count = typeof item.count === 'number' ? item.count : null;
  const n = count === null ? '' : `${count} `;
  const one = count === 1;
  switch (item.id) {
    case 'milestones_completed':
      return one ? { en: '1 milestone completed', el: '1 ορόσημο ολοκληρωμένο' } : { en: `${n}${CMT.ev_milestones.en}`, el: `${n}${CMT.ev_milestones.el}` };
    case 'builder_documents':
      return one ? { en: '1 Builder document finished', el: '1 έγγραφο Builder ολοκληρωμένο' } : { en: `${n}${CMT.ev_documents.en}`, el: `${n}${CMT.ev_documents.el}` };
    case 'endorsements':
      return one ? { en: '1 endorsement', el: '1 σύσταση' } : { en: `${n}${CMT.ev_endorsements.en}`, el: `${n}${CMT.ev_endorsements.el}` };
    case 'email_verified':
      return item.value ? CMT.ev_email : null;
    default:
      return null;
  }
}
