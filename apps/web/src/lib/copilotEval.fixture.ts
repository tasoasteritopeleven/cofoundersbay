/**
 * Wave F: seventy-eight requests a person might type, thirty-nine tasks each asked
 * once in English and once in Greek, with what the assistant should propose.
 * Four (2026-10-06) are the commitment ladder's: reading where need cards
 * stand, and drafting one. Six (2026-10-07) are founder updates: reading
 * them, drafting one, and following a person. Four (2026-10-07) ask about
 * warm introductions, by name and in general; two ask what backs one's skills; two
 * what the co-founder scout found.
 *
 * Written as people phrase things, not as the planner's keys: mixed tonos,
 * polite and terse forms, names inside quotes the way a phone keyboard types
 * them. A case passes when the planner proposes the expected tool with at
 * least the expected arguments, and - for a question - proposes no write
 * beside it. `copilotEval.test.ts` holds the bar at 95%.
 */

export type EvalCase = {
  message: string;
  tool: string;
  args?: Record<string, string>;
  /** A question: proposing any write beside it is a failure. */
  read?: boolean;
};

export const EVAL_CASES: EvalCase[] = [
  // ── Reads ──────────────────────────────────────────────────────────────
  { message: 'What events are coming up this month?', tool: 'get_events', read: true },
  { message: 'Τι εκδηλώσεις έχει αυτόν τον μήνα;', tool: 'get_events', read: true },
  { message: 'Which of my milestones are overdue?', tool: 'get_milestones', read: true },
  { message: 'Ποια ορόσημα έχουν καθυστερήσει;', tool: 'get_milestones', read: true },
  { message: 'Are there any open jobs I could apply to?', tool: 'get_jobs', read: true },
  { message: 'Υπάρχουν αγγελίες για θέσεις εργασίας;', tool: 'get_jobs', read: true },
  { message: 'Who is on my shortlist?', tool: 'get_shortlist', read: true },
  { message: 'Δείξε μου τα αποθηκευμένα προφίλ', tool: 'get_shortlist', read: true },
  { message: 'Do I have unread messages?', tool: 'get_messages', read: true },
  { message: 'Έχω αδιάβαστα μηνύματα;', tool: 'get_messages', read: true },
  { message: 'Any connection requests waiting for me?', tool: 'get_connections', read: true },
  { message: 'Έχω αιτήματα σύνδεσης σε αναμονή;', tool: 'get_connections', read: true },
  { message: 'Which accelerator programmes are open right now?', tool: 'get_programs', read: true },
  { message: 'Ποια προγράμματα επιτάχυνσης δέχονται αιτήσεις;', tool: 'get_programs', read: true },
  { message: 'How many of the people I invited actually joined?', tool: 'get_invites', read: true },
  { message: 'Πόσοι από όσους προσκάλεσα έγιναν μέλη;', tool: 'get_invites', read: true },
  { message: 'What level am I and which badges have I earned?', tool: 'get_reputation', read: true },
  { message: 'Ποια σήματα έχω κερδίσει;', tool: 'get_reputation', read: true },
  { message: 'How investor ready is my startup?', tool: 'get_readiness', read: true },
  { message: 'Where do my commitments stand and what is waiting on me?', tool: 'get_commitments', read: true },
  { message: 'Τι γίνεται με τις δεσμεύσεις μου;', tool: 'get_commitments', read: true },
  { message: 'Πόσο καλή είναι η ετοιμότητα της startup μου;', tool: 'get_readiness', read: true },
  { message: 'Which mentors are available for sessions?', tool: 'get_mentors', read: true },
  { message: 'Ποιοι μέντορες είναι διαθέσιμοι;', tool: 'get_mentors', read: true },
  { message: 'What bookings do I have next week?', tool: 'get_bookings', read: true },
  { message: 'Τι κρατήσεις έχω την επόμενη εβδομάδα;', tool: 'get_bookings', read: true },
  { message: 'Any new inquiries from clients?', tool: 'get_inquiries', read: true },
  { message: 'Ήρθαν νέα αιτήματα πελατών;', tool: 'get_inquiries', read: true },
  { message: 'Which cohorts are running in my organisation?', tool: 'get_org_cohorts', read: true },
  { message: 'Ποιες κοόρτες τρέχουν στον οργανισμό μου;', tool: 'get_org_cohorts', read: true },
  { message: 'Show me my best matches', tool: 'get_recommendations', read: true },
  { message: 'Δείξε μου τις καλύτερες αντιστοιχίσεις μου', tool: 'get_recommendations', read: true },

  // ── Searches, writes, drafts and navigation ────────────────────────────
  { message: 'Find a technical cofounder in Athens', tool: 'search_people', args: { location: 'Athens' } },
  { message: 'Βρες τεχνικό συνιδρυτή στην Αθήνα', tool: 'search_people', args: { location: 'Athens' } },
  { message: 'Save Elena to my shortlist', tool: 'shortlist_add', args: { name: 'Elena' } },
  { message: 'Αποθήκευσε την Έλενα στη λίστα μου', tool: 'shortlist_add', args: { name: 'Elena' } },
  { message: 'Connect me with Nikos', tool: 'send_connection', args: { name: 'Nikos' } },
  { message: 'Στείλε αίτημα σύνδεσης στον Νίκο', tool: 'send_connection', args: { name: 'Nikos' } },
  { message: 'Message Sarah', tool: 'start_or_send_message', args: { name: 'Sarah' } },
  { message: 'Στείλε μήνυμα στη Sarah', tool: 'start_or_send_message', args: { name: 'Sarah' } },
  { message: 'Show my analytics for the last 30 days', tool: 'analytics_set_period', args: { period: '30d' } },
  { message: 'Δείξε τα στατιστικά μου για τις τελευταίες 7 ημέρες', tool: 'analytics_set_period', args: { period: '7d' } },
  { message: 'Create a workspace called "Helios"', tool: 'workspace_create', args: { name: 'Helios' } },
  { message: 'Δημιούργησε χώρο εργασίας «Ήλιος»', tool: 'workspace_create', args: { name: 'Ήλιος' } },
  { message: 'Open my matches', tool: 'navigate', args: { href: '/matches' } },
  { message: 'Άνοιξε τα μηνύματα', tool: 'navigate', args: { href: '/messages' } },
  { message: 'Join the Athens Founders group', tool: 'join_group', args: { groupName: 'Athens Founders' } },
  { message: 'Γράψε με στην ομάδα Athens Founders', tool: 'join_group', args: { groupName: 'Athens Founders' } },
  { message: 'Leave the Climate Builders group please', tool: 'leave_group', args: { groupName: 'Climate Builders' } },
  { message: 'Βγάλε με από την ομάδα Climate Builders', tool: 'leave_group', args: { groupName: 'Climate Builders' } },
  { message: 'Apply to the Pre-seed Bootcamp', tool: 'apply_to_program', args: { programTitle: 'Pre-seed Bootcamp' } },
  { message: 'Κάνε αίτηση στο πρόγραμμα Pre-seed Bootcamp', tool: 'apply_to_program', args: { programTitle: 'Pre-seed Bootcamp' } },
  { message: 'Invite ana@meltemi.example to CoFounderBay', tool: 'send_invite', args: { email: 'ana@meltemi.example' } },
  { message: 'Προσκάλεσε την ana@meltemi.example', tool: 'send_invite', args: { email: 'ana@meltemi.example' } },
  { message: 'Accept Sofia’s mentoring request', tool: 'respond_to_mentor_request', args: { decision: 'accept' } },
  { message: 'Απόρριψε το αίτημα mentoring του Γιώργου', tool: 'respond_to_mentor_request', args: { decision: 'decline' } },
  { message: 'Draft a milestone “Close the pre-seed round”', tool: 'draft_milestone', args: { title: 'Close the pre-seed round' } },
  { message: 'Ετοίμασε ένα ορόσημο «Πρόσληψη πρώτου μηχανικού»', tool: 'draft_milestone', args: { title: 'Πρόσληψη πρώτου μηχανικού' } },
  { message: 'Draft an event "Founder breakfast"', tool: 'draft_event', args: { title: 'Founder breakfast' } },
  { message: 'Ετοίμασε εκδήλωση «Πρωινό ιδρυτών»', tool: 'draft_event', args: { title: 'Πρωινό ιδρυτών' } },
  { message: 'Write a need card for an angel investor in Orion Grid', tool: 'draft_need_card', args: { kind: 'investor_intro' } },
  { message: 'Φτιάξε μου μια κάρτα ανάγκης «Τεχνικός συνιδρυτής για το Harbor»', tool: 'draft_need_card', args: { title: 'Τεχνικός συνιδρυτής για το Harbor', kind: 'cofounder' } },
  { message: 'Any new founder updates from people I follow?', tool: 'get_founder_updates', read: true },
  { message: 'Τι νέες ενημερώσεις ιδρυτών έχω;', tool: 'get_founder_updates', read: true },
  { message: 'Draft a founder update “September: twelve interviews”', tool: 'draft_founder_update', args: { title: 'September: twelve interviews' } },
  { message: 'Ετοίμασε δημόσια ενημέρωση ιδρυτή «Σεπτέμβριος: δώδεκα συνεντεύξεις»', tool: 'draft_founder_update', args: { title: 'Σεπτέμβριος: δώδεκα συνεντεύξεις', visibility: 'public' } },
  { message: 'Follow Elena Papadopoulos', tool: 'follow_person', args: { name: 'Elena' } },
  { message: 'Who could introduce me to Nikos?', tool: 'get_intros', args: { name: 'Nikos' }, read: true },
  { message: 'Ποιος μπορεί να με συστήσει στον Νίκο;', tool: 'get_intros', args: { name: 'Nikos' }, read: true },
  { message: 'Show my warm introductions', tool: 'get_intros', read: true },
  { message: 'Δείξε μου τις συστάσεις γνωριμίας', tool: 'get_intros', read: true },
  { message: 'What evidence backs my skills?', tool: 'get_skill_evidence', read: true },
  { message: 'Ποια τεκμήρια στηρίζουν τις δεξιότητές μου;', tool: 'get_skill_evidence', read: true },
  { message: 'What did my co-founder scout find?', tool: 'get_scout', read: true },
  { message: 'Τι βρήκε ο ανιχνευτής συνιδρυτών;', tool: 'get_scout', read: true },
  { message: 'Ακολούθησε την Έλενα', tool: 'follow_person', args: { name: 'Elena' } },
  { message: 'Tick the team readiness criterion', tool: 'readiness_tick_criterion', args: { dimension: 'team' } },
  { message: 'Σημείωσε το κριτήριο ετοιμότητας για την αγορά', tool: 'readiness_tick_criterion', args: { dimension: 'market' } },
  // Plain-language search: known words become the Discover filters.
  { message: 'Find a cofounder for fintech in Thessaloniki, part-time', tool: 'search_people', args: { roles: 'founder', industries: 'Fintech', commitment: 'part-time', location: 'Thessaloniki' }, read: true },
  { message: 'Ψάχνω συνιδρυτή SaaS στην Αθήνα, πλήρης απασχόληση', tool: 'search_people', args: { roles: 'founder', industries: 'SaaS', commitment: 'full-time', location: 'Athens' }, read: true },
  { message: 'Show me angel investors for pre-seed in Limassol', tool: 'search_people', args: { roles: 'investor', fundingStage: 'pre-seed', location: 'Limassol' }, read: true },
  // «τεχνικό» contains «νικο»: this searched for Nikos until names had to start a word.
  { message: 'Ψάξε τεχνικό συνιδρυτή για fintech', tool: 'search_people', args: { q: 'technical', roles: 'founder', industries: 'Fintech' }, read: true },
];

/** Writes the planner may propose; a question proposing one of these fails. */
export const WRITE_TOOLS = new Set([
  'shortlist_add', 'shortlist_remove', 'send_connection', 'start_or_send_message', 'readiness_tick_criterion',
  'workspace_create', 'investor_track_startup', 'investor_move_stage', 'update_profile', 'respond_to_connection',
  'create_milestone', 'update_milestone_status', 'rsvp_event', 'create_event', 'canvas_command', 'join_group',
  'leave_group', 'apply_to_program', 'send_invite', 'write_endorsement', 'respond_to_mentor_request', 'run_page_command',
  'express_interest', 'close_need_card', 'follow_person', 'request_intro', 'set_open_to', 'link_skill_evidence', 'run_scout',
]);
