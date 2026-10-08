import type { BilingualPair } from './types';
import {
  resolveBilingualPair,
  useLanguagePreference,
} from './LanguagePreferenceContext';

export const FUNDRAISING_STRINGS: Record<string, BilingualPair> = {
  ask_ai: { en: 'Ask AI', el: 'Ρωτήστε το AI' },
  ask_ai_plan: {
    en: 'Ask AI who to contact next in this round',
    el: 'Ρωτήστε το AI ποιον να προσεγγίσετε μετά σε αυτόν τον γύρο',
  },
  ask_ai_hint: {
    en: 'Prioritise the pipeline from Builder, Pitch deck, and Data Room gaps.',
    el: 'Ιεραρχήστε το pipeline με βάση τον Builder, το pitch deck και τα κενά του Data Room.',
  },
  ask_ai_hint_harbor: {
    en: 'Propose who to contact next on Harbor\'s $750K seed (Athens Tech Angels, $375K committed; $375K remaining; warm intro from Athens founder networks) from Idea Core, the pitch deck, Research, and data-room gaps.',
    el: 'Προτείνετε ποιον να προσεγγίσετε μετά στον γύρο Harbor $750K (Athens Tech Angels, $375K δεσμευμένα· απομένουν $375K· ζεστή γνωριμία μέσω δικτύων ιδρυτών στην Αθήνα) από τον Πυρήνα ιδέας, το pitch deck, την Έρευνα και τα κενά του Data Room.',
  },
  link_into: { en: 'Carry this round into', el: 'Μεταφέρετε αυτόν τον γύρο στο' },
  link_idea: { en: 'Idea Core', el: 'Πυρήνας ιδέας' },
  link_pitch: { en: 'Pitch deck', el: 'Pitch deck' },
  link_research: { en: 'Research boards', el: 'Πίνακες έρευνας' },
  link_milestones: { en: 'Milestones', el: 'Ορόσημα' },
  link_projects: { en: 'Projects', el: 'Έργα' },
  link_readiness: { en: 'Readiness', el: 'Ετοιμότητα' },
  add_investor: { en: 'Add investor', el: 'Προσθήκη επενδυτή' },
  add_lead: { en: 'Add contact', el: 'Προσθήκη επαφής' },
  add_to_stage: { en: 'Add', el: 'Προσθήκη' },
  find_investors: { en: 'Find investors', el: 'Εύρεση επενδυτών' },
  tab_pipeline: { en: 'Pipeline', el: 'Pipeline' },
  tab_kanban: { en: 'Kanban', el: 'Kanban' },
  tab_dataroom: { en: 'Data room', el: 'Data room' },

  round_active: { en: 'Active', el: 'Ενεργός' },
  round_planning: { en: 'Planning', el: 'Σχεδιασμός' },
  round_closing: { en: 'Closing', el: 'Κλείσιμο' },
  round_closed: { en: 'Closed', el: 'Κλειστός' },
  pre_money: { en: 'pre-money valuation', el: 'pre-money αποτίμηση' },
  valuation_tbd: { en: 'Valuation TBD', el: 'Αποτίμηση εκκρεμεί' },
  raised: { en: 'raised', el: 'αντλήθηκαν' },
  target: { en: 'target', el: 'στόχος' },
  of_target: { en: 'of target', el: 'του στόχου' },
  remaining: { en: 'remaining', el: 'απομένουν' },
  stat_investors: { en: 'Investors', el: 'Επενδυτές' },
  stat_committed_amt: { en: 'Committed', el: 'Δεσμευμένα' },
  stat_closing: { en: 'Closing', el: 'Κλείσιμο' },
  days_left: { en: '{count} days left', el: '{count} ημέρες ακόμη' },
  days_left_one: { en: '1 day left', el: '1 ημέρα ακόμη' },
  overdue: { en: 'Overdue', el: 'Εκπρόθεσμο' },
  closing_tbd: { en: 'TBD', el: 'Εκκρεμεί' },
  lead_investor: { en: 'Lead investor', el: 'Επικεφαλής επενδυτής' },
  none_yet: { en: 'None yet', el: 'Κανένας ακόμα' },

  // Counted labels. Greek inflects the noun with the number, so each carries a
  // singular form the tile picks when the count is exactly one; English repeats
  // itself because "Total contacts" and "Committed" do not decline.
  stat_leads: { en: 'Total contacts', el: 'Συνολικές επαφές' },
  stat_leads_one: { en: 'Total contacts', el: 'Συνολική επαφή' },
  stat_active: { en: 'Active discussions', el: 'Ενεργές συζητήσεις' },
  stat_active_one: { en: 'Active discussions', el: 'Ενεργή συζήτηση' },
  stat_committed: { en: 'Committed', el: 'Δεσμευμένοι' },
  stat_committed_one: { en: 'Committed', el: 'Δεσμευμένος' },
  stat_conversion: { en: 'Conversion rate', el: 'Ποσοστό μετατροπής' },

  st_prospect: { en: 'Prospect', el: 'Υποψήφιος' },
  st_contacted: { en: 'Contacted', el: 'Επικοινωνία' },
  st_meeting: { en: 'Meeting', el: 'Συνάντηση' },
  st_dd: { en: 'Due diligence', el: 'Due diligence' },
  st_committed: { en: 'Committed', el: 'Δεσμευμένος' },
  st_passed: { en: 'Passed', el: 'Δεν προχώρησε' },

  last_contact: { en: 'Last contact', el: 'Τελευταία επαφή' },
  message: { en: 'Message', el: 'Μήνυμα' },
  view_details: { en: 'View details', el: 'Λεπτομέρειες' },
  move_to: { en: 'Move to', el: 'Μετακίνηση σε' },

  empty_pipeline_title: { en: 'No contacts in the pipeline', el: 'Δεν υπάρχουν επαφές στο pipeline' },
  empty_pipeline_hint: {
    en: 'Add a contact or find investors. Ask AI who fits this round.',
    el: 'Προσθέστε επαφή ή βρείτε επενδυτές. Ρωτήστε το AI ποιος ταιριάζει σε αυτόν τον γύρο.',
  },
  empty_round_title: { en: 'No active round yet', el: 'Δεν υπάρχει ενεργός γύρος' },
  empty_round_hint: {
    en: 'Ask AI to draft target, instrument, and a first investor list from Builder artefacts.',
    el: 'Ρωτήστε το AI να συντάξει στόχο, εργαλείο και πρώτη λίστα επενδυτών από τον Builder.',
  },

  dr_health: { en: 'Data room health', el: 'Πληρότητα data room' },
  dr_required: { en: 'required docs ready', el: 'υποχρεωτικά έγγραφα έτοιμα' },
  dr_total: { en: 'total docs ready', el: 'σύνολο εγγράφων έτοιμα' },
  dr_complete: { en: 'complete', el: 'ολοκληρωμένο' },
  share_room: { en: 'Share room', el: 'Κοινοποίηση data room' },
  share_done: { en: 'Data room link copied', el: 'Ο σύνδεσμος του data room αντιγράφηκε' },
  share_hint: {
    en: 'Tokenised link — nothing is public unless you send it.',
    el: 'Σύνδεσμος με token — τίποτα δεν είναι δημόσιο αν δεν τον στείλετε.',
  },
  required: { en: 'Required', el: 'Υποχρεωτικό' },
  updated: { en: 'Updated', el: 'Ενημερώθηκε' },
  doc_draft: { en: 'Draft', el: 'Πρόχειρο' },
  doc_ready: { en: 'Ready', el: 'Έτοιμο' },
  doc_shared: { en: 'Shared', el: 'Κοινοποιημένο' },
  cat_all: { en: 'All', el: 'Όλα' },
  cat_pitch: { en: 'Pitch', el: 'Pitch' },
  cat_financials: { en: 'Financials', el: 'Οικονομικά' },
  cat_legal: { en: 'Legal', el: 'Νομικά' },
  cat_product: { en: 'Product', el: 'Προϊόν' },
  cat_market: { en: 'Market', el: 'Αγορά' },
  cat_team: { en: 'Team', el: 'Ομάδα' },
  cat_traction: { en: 'Traction', el: 'Traction' },
  upload: { en: 'Upload', el: 'Μεταφόρτωση' },
  download: { en: 'Download', el: 'Λήψη' },
  mark_ready: { en: 'Mark as ready', el: 'Σήμανση ως έτοιμο' },
  no_file: { en: 'No file is stored for this document yet; open it from its link or the data room.', el: 'Δεν έχει αποθηκευτεί αρχείο για αυτό το έγγραφο ακόμη· ανοίξτε το από τον σύνδεσμό του ή την αίθουσα δεδομένων.' },
  upload_done: { en: 'Upload queued', el: 'Η μεταφόρτωση μπήκε στην ουρά' },
  download_done: { en: 'Download started', el: 'Η λήψη ξεκίνησε' },
  empty_docs: { en: 'No documents in this category', el: 'Δεν υπάρχουν έγγραφα σε αυτή την κατηγορία' },

  resources: { en: 'Fundraising resources', el: 'Πόροι χρηματοδότησης' },
  res_playbook: { en: 'Seed fundraising playbook', el: 'Οδηγός seed χρηματοδότησης' },
  res_playbook_desc: { en: 'From first pitch to close', el: 'Από το πρώτο pitch μέχρι το κλείσιμο' },
  res_find: { en: 'Find investors', el: 'Εύρεση επενδυτών' },
  res_find_desc: { en: 'Browse active investors on CoFounderBay', el: 'Δείτε ενεργούς επενδυτές στο CoFounderBay' },
  res_ready: { en: 'Readiness score', el: 'Βαθμός ετοιμότητας' },
  res_ready_desc: { en: 'See how investor-ready the startup is', el: 'Δείτε πόσο έτοιμο είναι το startup για επενδυτές' },
  res_deck: { en: 'Pitch deck builder', el: 'Κατασκευή pitch deck' },
  res_deck_desc: { en: 'Draft slides from Builder artefacts', el: 'Συντάξτε διαφάνειες από τον Builder' },

  modal_new: { en: 'New investor contact', el: 'Νέα επαφή επενδυτή' },
  field_name: { en: 'Name', el: 'Όνομα' },
  name_ph: { en: 'e.g. Athens Tech Angels', el: 'π.χ. Athens Tech Angels' },
  field_firm: { en: 'Firm', el: 'Εταιρεία' },
  firm_ph: { en: 'Optional', el: 'Προαιρετικό' },
  field_type: { en: 'Type', el: 'Τύπος' },
  field_stage: { en: 'Stage focus', el: 'Εστίαση σταδίου' },
  field_check: { en: 'Check size', el: 'Ύψος επένδυσης' },
  field_status: { en: 'Pipeline stage', el: 'Στάδιο στο pipeline' },
  field_notes: { en: 'Notes', el: 'Σημειώσεις' },
  notes_ph: { en: 'Interest, intro path, next step…', el: 'Ενδιαφέρον, γνωριμία, επόμενο βήμα…' },
  cancel: { en: 'Cancel', el: 'Ακύρωση' },
  save: { en: 'Save contact', el: 'Αποθήκευση επαφής' },
  created: { en: 'Contact added', el: 'Η επαφή προστέθηκε' },
  created_hint: { en: 'It now appears in Pipeline and Kanban.', el: 'Εμφανίζεται πλέον στο Pipeline και στο Kanban.' },
  moved: { en: 'Stage updated', el: 'Το στάδιο ενημερώθηκε' },
};

export function fundraisingEn(key: keyof typeof FUNDRAISING_STRINGS): string {
  return FUNDRAISING_STRINGS[key].en;
}

export function fundraisingEl(key: keyof typeof FUNDRAISING_STRINGS): string {
  return FUNDRAISING_STRINGS[key].el;
}

export function useFundraisingPrimaryText() {
  const { primary, showSecondary } = useLanguagePreference();
  return (en: string, el: string) => resolveBilingualPair(en, el, primary, showSecondary).primaryText;
}

export const INVESTOR_STATUS_KEYS: Record<string, keyof typeof FUNDRAISING_STRINGS> = {
  prospect: 'st_prospect',
  contacted: 'st_contacted',
  meeting: 'st_meeting',
  dd: 'st_dd',
  committed: 'st_committed',
  passed: 'st_passed',
};

export const ROUND_STATUS_KEYS: Record<string, keyof typeof FUNDRAISING_STRINGS> = {
  planning: 'round_planning',
  active: 'round_active',
  closing: 'round_closing',
  closed: 'round_closed',
};

export const DOC_STATUS_KEYS: Record<string, keyof typeof FUNDRAISING_STRINGS> = {
  draft: 'doc_draft',
  ready: 'doc_ready',
  shared: 'doc_shared',
};

export const DOC_CATEGORY_KEYS: Record<string, keyof typeof FUNDRAISING_STRINGS> = {
  All: 'cat_all',
  Pitch: 'cat_pitch',
  Financials: 'cat_financials',
  Legal: 'cat_legal',
  Product: 'cat_product',
  Market: 'cat_market',
  Team: 'cat_team',
  Traction: 'cat_traction',
};

export const INVESTOR_TYPE_EL: Record<string, string> = {
  Angel: 'Angel',
  VC: 'VC',
  Syndicate: 'Syndicate',
  Scout: 'Scout',
  'Family Office': 'Family office',
};
