import type { BilingualPair } from './types';

/**
 * Readiness page — bilingual EN + EL.
 */
export const READINESS_STRINGS: Record<string, BilingualPair> = {
  // ── Page header ──
  page_title: { en: 'Readiness Score', el: 'Βαθμολογία ετοιμότητας' },
  page_description: {
    en: 'Assess your startup\u2019s readiness across 6 key dimensions and see what to fix next.',
    el: 'Αξιολογήστε την ετοιμότητα του startup σας σε 6 βασικές διαστάσεις και δείτε τι να διορθώσετε στη συνέχεια.',
  },
  reassess: { en: 'Reassess', el: 'Επαναξιολόγηση' },

  // ── Dimensions ──
  dim_team: { en: 'Team', el: 'Ομάδα' },
  dim_team_desc: {
    en: 'Founder & team strength, commitment, and complementarity',
    el: 'Δύναμη ιδρυτή & ομάδας, δέσμευση και συμπληρωματικότητα',
  },
  dim_market: { en: 'Market', el: 'Αγορά' },
  dim_market_desc: {
    en: 'Market size, validation, and competitive positioning',
    el: 'Μέγεθος αγοράς, επικύρωση και ανταγωνιστική θέση',
  },
  dim_product: { en: 'Product', el: 'Προϊόν' },
  dim_product_desc: {
    en: 'Solution clarity, MVP progress, and product-market fit signals',
    el: 'Σαφήνεια λύσης, πρόοδος MVP και σήματα ταιριάσματος προϊόντος-αγοράς',
  },
  dim_business: { en: 'Business Model', el: 'Επιχειρηματικό μοντέλο' },
  dim_business_desc: {
    en: 'Revenue model, pricing, unit economics, and go-to-market clarity',
    el: 'Μοντέλο εσόδων, τιμολόγηση, μοναδιαία οικονομικά και στρατηγική εισόδου στην αγορά',
  },
  dim_funding: { en: 'Funding Readiness', el: 'Ετοιμότητα χρηματοδότησης' },
  dim_funding_desc: {
    en: 'Pitch deck, financials, data room, and investor targeting readiness',
    el: 'Pitch deck, οικονομικά στοιχεία, data room και ετοιμότητα στόχευσης επενδυτών',
  },
  dim_execution: { en: 'Execution', el: 'Εκτέλεση' },
  dim_execution_desc: {
    en: 'Goal-setting, milestone tracking, metrics, and execution discipline',
    el: 'Θέσπιση στόχων, παρακολούθηση ορόσημων, μετρικές και πειθαρχία εκτέλεσης',
  },

  // ── Criteria (team) ──
  crit_cofounder_identified: { en: 'Co-founder identified', el: 'Συνιδρυτής εντοπίστηκε' },
  crit_complementary_skills: { en: 'Complementary skills covered', el: 'Συμπληρωματικές δεξιότητες καλύφθηκαν' },
  crit_fulltime_commitment: { en: 'Full-time commitment secured', el: 'Πλήρης δέσμευση εξασφαλίστηκε' },
  crit_previous_experience: { en: 'Previous startup experience', el: 'Προηγούμενη εμπειρία σε startup' },
  crit_advisory_board: { en: 'Advisory board in place', el: 'Συμβουλευτικό σώμα εγκαθιδρύθηκε' },

  // ── Criteria (market) ──
  crit_target_market: { en: 'Target market defined', el: 'Στοχευόμενη αγορά ορίστηκε' },
  crit_market_size: { en: 'Market size validated (TAM/SAM)', el: 'Μέγεθος αγοράς επικυρώθηκε (TAM/SAM)' },
  crit_competitive_analysis: { en: 'Competitive analysis completed', el: 'Ανταγωνιστική ανάλυση ολοκληρώθηκε' },
  crit_customer_interviews: { en: 'Customer interviews (10+)', el: 'Συνεντεύξεις πελατών (10+)' },
  crit_market_timing: { en: 'Market timing analysis', el: 'Ανάλυση χρονισμού αγοράς' },

  // ── Criteria (product) ──
  crit_problem_validated: { en: 'Problem validated with users', el: 'Πρόβλημα επικυρώθηκε με χρήστες' },
  crit_solution_defined: { en: 'Solution clearly defined', el: 'Λύση σαφώς ορισμένη' },
  crit_mvp_built: { en: 'MVP built and tested', el: 'MVP κατασκευάστηκε και δοκιμάστηκε' },
  crit_user_feedback: { en: 'User feedback collected', el: 'Σχόλια χρηστών συλλέχθηκαν' },
  crit_roadmap: { en: 'Product roadmap documented', el: 'Χάρτης πορείας προϊόντος τεκμηριωμένος' },

  // ── Criteria (business) ──
  crit_revenue_model: { en: 'Revenue model defined', el: 'Μοντέλο εσόδων ορίστηκε' },
  crit_pricing_validated: { en: 'Pricing strategy validated', el: 'Στρατηγική τιμολόγησης επικυρώθηκε' },
  crit_unit_economics: { en: 'Unit economics calculated', el: 'Μοναδιαία οικονομικά υπολογίστηκαν' },
  crit_gtm_strategy: { en: 'Go-to-market strategy defined', el: 'Στρατηγική εισόδου στην αγορά ορίστηκε' },
  crit_partnerships: { en: 'Partnership strategy outlined', el: 'Στρατηγική συνεργασιών σκιαγραφήθηκε' },

  // ── Criteria (funding) ──
  crit_pitch_deck: { en: 'Pitch deck ready (10-12 slides)', el: 'Pitch deck έτοιμο (10-12 διαφάνειες)' },
  crit_financial_projections: { en: 'Financial projections (3 years)', el: 'Οικονομικές προβλέψεις (3 έτη)' },
  crit_data_room: { en: 'Data room prepared', el: 'Data room έτοιμο' },
  crit_investor_list: { en: 'Target investor list built', el: 'Λίστα επενδυτών-στόχων έτοιμη' },
  crit_term_sheet: { en: 'Term sheet knowledge ready', el: 'Γνώση όρων χρηματοδότησης έτοιμη' },

  // ── Criteria (execution) ──
  crit_okrs: { en: 'OKRs / quarterly goals set', el: 'OKR / τριμηνιαίοι στόχοι τέθηκαν' },
  crit_milestones: { en: 'Key milestones defined', el: 'Βασικά ορόσημα ορίστηκαν' },
  crit_metrics_tracked: { en: 'Core metrics tracked', el: 'Βασικές μετρικές παρακολουθούνται' },
  // "ανασκοπήσεις", not "αναδρομές": αναδρομή is a flashback/recursion, not a
  // team retrospective.
  crit_retrospectives: { en: 'Regular retrospectives held', el: 'Τακτικές ανασκοπήσεις πραγματοποιούνται' },
  crit_documentation: { en: 'Documentation practices in place', el: 'Πρακτικές τεκμηρίωσης σε εφαρμογή' },

  // ── Score status ──
  status_excellent: { en: 'excellent', el: 'εξαιρετικό' },
  status_good: { en: 'good', el: 'καλό' },
  status_needs_work: { en: 'needs work', el: 'χρειάζεται εργασία' },
  status_critical: { en: 'critical', el: 'κρίσιμο' },

  // ── Score card ──
  overall_readiness: { en: 'Overall Readiness', el: 'Συνολική ετοιμότητα' },
  based_on_dimensions: { en: 'Based on 6 dimensions', el: 'Βάσει 6 διαστάσεων' },
  criteria_completed: { en: 'criteria completed', el: 'κριτήρια ολοκληρώθηκαν' },

  // ── Accelerator ──
  accelerator_readiness: { en: 'Accelerator Readiness', el: 'Ετοιμότητα επιταχυντή' },
  accel_programs_cohorts: { en: 'Program & cohort applications', el: 'Αιτήσεις προγραμμάτων & ομάδων' },
  ready_to_apply: { en: 'Ready to apply', el: 'Έτοιμος για αίτηση' },
  almost_ready: { en: 'Almost ready', el: 'Σχεδόν έτοιμο' },
  not_ready_yet: { en: 'Not ready yet', el: 'Δεν είναι ακόμα έτοιμο' },
  accel_threshold_note: {
    en: 'Most accelerators expect 65–75%+ readiness. Focus on team, market, and product dimensions.',
    el: 'Οι περισσότεροι επιταχυντές αναμένουν 65–75%+ ετοιμότητα. Εστιάστε σε ομάδα, αγορά και προϊόν.',
  },
  browse_programs: { en: 'Browse Programs', el: 'Περιήγηση προγραμμάτων' },

  // ── Investor ──
  investor_readiness: { en: 'Investor Readiness', el: 'Ετοιμότητα επενδυτή' },
  investor_seed_preseed: { en: 'Seed & pre-seed fundraising', el: 'Χρηματοδότηση seed & pre-seed' },
  fundable_signal: { en: 'Fundable signal', el: 'Σήμα χρηματοδότησης' },
  // "traction" stays untranslated: Greek startup vocabulary uses the English
  // term — "έλξη" (literal pull/attraction) reads as physics, not growth.
  building_traction: { en: 'Building traction', el: 'Χτίσιμο traction' },
  pre_investment_stage: { en: 'Pre-investment stage', el: 'Στάδιο πριν την επένδυση' },
  investor_weight_note: {
    en: 'Investors weight team (30%) and market (25%) most heavily. Build strong validation first.',
    // "σταθμίζουν" (weigh/weight), not "βαρύνουν" (burden) — the old wording
    // read as "investors burden the team".
    el: 'Οι επενδυτές σταθμίζουν περισσότερο την ομάδα (30%) και την αγορά (25%). Χτίστε ισχυρή επικύρωση πρώτα.',
  },
  find_investors: { en: 'Find Investors', el: 'Εύρεση επενδυτών' },

  // ── Charts ──
  readiness_radar: { en: 'Readiness Radar', el: 'Ραντάρ ετοιμότητας' },
  your_score: { en: 'Your Score', el: 'Η βαθμολογία σας' },
  benchmark: { en: 'Accelerator target (65%)', el: 'Στόχος επιταχυντή (65%)' },
  radar_benchmark_note: {
    en: 'The dashed ring is the 65% line used on Benchmarks — apply-ready for accelerators.',
    el: 'Ο διακεκομμένος δακτύλιος είναι η γραμμή 65% στα Σημεία αναφοράς — έτοιμο για αίτηση σε επιταχυντή.',
  },
  score_progression: { en: 'Score Progression (7 weeks)', el: 'Εξέλιξη βαθμολογίας (7 εβδομάδες)' },
  export: { en: 'Export', el: 'Εξαγωγή' },
  overall: { en: 'Overall', el: 'Συνολικά' },
  accelerator: { en: 'Accelerator', el: 'Επιταχυντής' },
  investor: { en: 'Investor', el: 'Επενδυτής' },

  // ── AI Insight ──
  ai_insight: { en: 'AI Insight', el: 'Πληροφορία AI' },
  all_dimensions_strong: {
    en: 'All dimensions look strong. Keep up the momentum!',
    el: 'Όλες οι διαστάσεις είναι ισχυρές. Συνεχίστε τη δυναμική!',
  },
  score_change_7_weeks: { en: 'Score change (7 weeks)', el: 'Μεταβολή βαθμολογίας (7 εβδομάδες)' },

  // ── Tabs ──
  tab_all_dimensions: { en: 'All Dimensions', el: 'Όλες οι διαστάσεις' },
  tab_priority_actions: { en: 'Priority Actions', el: 'Ενέργειες προτεραιότητας' },
  tab_benchmarks: { en: 'Benchmarks', el: 'Σημεία αναφοράς' },
  tab_history: { en: 'History', el: 'Ιστορικό' },

  // ── Workspace warning ──
  // Natural Greek negation — the word-for-word "Κανένας χώρος εργασίας
  // συνδεδεμένος" is an anglicism (no verb).
  no_workspace_title: { en: 'No workspace connected', el: 'Δεν έχει συνδεθεί χώρος εργασίας' },
  no_workspace_desc: {
    en: 'Create a workspace in the Startup Builder to track and update your readiness criteria.',
    el: 'Δημιουργήστε χώρο εργασίας στο Startup Builder για παρακολούθηση και ενημέρωση κριτηρίων ετοιμότητας.',
  },

  // ── Priority Actions ──
  priority_action_plan: { en: 'Priority Action Plan', el: 'Σχέδιο ενεργειών προτεραιότητας' },
  all_dimensions_excellent: { en: 'Excellent! All dimensions are strong.', el: 'Εξαιρετικά! Όλες οι διαστάσεις είναι ισχυρές.' },
  keep_iterating: { en: 'Keep iterating and maintain your momentum.', el: 'Συνεχίστε τις βελτιώσεις και διατηρήστε τη δυναμική σας.' },
  recommendation: { en: 'Recommendation', el: 'Συμβουλή' },
  show_less: { en: 'Show less', el: 'Λιγότερα' },

  // ── Benchmarks ──
  accelerator_benchmark: { en: 'Accelerator Benchmark', el: 'Σημείο αναφοράς επιταχυντή' },
  investor_benchmark: { en: 'Investor Benchmark', el: 'Σημείο αναφοράς επενδυτή' },
  accel_threshold_line: {
    en: 'Vertical line = typical accelerator threshold (65%)',
    el: 'Κατακόρυφη γραμμή = τυπικό κατώφλι επιταχυντή (65%)',
  },
  investor_threshold_line: {
    en: 'Vertical line = investor-ready threshold (70%)',
    el: 'Κατακόρυφη γραμμή = κατώφλι ετοιμότητας επενδυτή (70%)',
  },
  dimension_weights: { en: 'Dimension Weights & Weighted Scores', el: 'Βάρη διαστάσεων & σταθμισμένες βαθμολογίες' },

  // ── History ──
  assessment_log: { en: 'Assessment Log', el: 'Αρχείο αξιολογήσεων' },

  // ── Quick Actions ──
  open_builder: { en: 'Open Builder', el: 'Άνοιγμα Builder' },
  build_workspace: { en: 'Build your workspace', el: 'Χτίστε τον χώρο εργασίας σας' },
  find_mentor: { en: 'Find a Mentor', el: 'Εύρεση μέντορα' },
  get_expert_guidance: { en: 'Get expert guidance', el: 'Λάβετε ειδική καθοδήγηση' },
  accelerators_cohorts: { en: 'Accelerators & cohorts', el: 'Επιταχυντές & ομάδες' },

  // ── Mode / AI / explainability ──
  view_live_readiness: { en: 'View live readiness', el: 'Πραγματική ετοιμότητα' },
  view_demo_showcase: { en: 'View demo showcase', el: 'Προβολή επίδειξης' },
  ask_ai: { en: 'Ask AI', el: 'Ρωτήστε το AI' },
  ask_ai_plan: {
    en: 'Ask AI for a readiness plan',
    el: 'Ρωτήστε το AI για πλάνο ετοιμότητας',
  },
  next_open: { en: 'Next to tick', el: 'Επόμενο προς ολοκλήρωση' },
  pts_to: { en: 'pts to', el: 'μον. έως' },
  jump_to: { en: 'Jump to dimension', el: 'Μετάβαση στη διάσταση' },
  expert_review: { en: 'Expert review', el: 'Αξιολόγηση ειδικού' },
  expert_review_hint: { en: 'Get a specialist to score this', el: 'Αξιολόγηση από ειδικό' },
  show_n_more: { en: 'Show more', el: 'Περισσότερα' },
  last_assessed_prefix: { en: 'Last saved assessment', el: 'Τελευταία αποθηκευμένη αξιολόγηση' },
  reassess_reloads: {
    en: 'Reassess reloads saved scores.',
    el: 'Η επαναξιολόγηση φορτώνει τις αποθηκευμένες βαθμολογίες.',
  },
  pts: { en: 'pts', el: 'μον.' },
  overall_short: { en: 'overall', el: 'συνολικά' },
  accel_short: { en: 'accel', el: 'επιταχ.' },
  invest_short: { en: 'invest', el: 'επενδ.' },
  score_pct: { en: 'Score', el: 'Βαθμός' },
  target_65: { en: 'Target: 65%', el: 'Στόχος: 65%' },
  target_70: { en: 'Target: 70%', el: 'Στόχος: 70%' },
  weight_hint: { en: 'weight', el: 'βάρος' },
  status_excellent_label: { en: 'Excellent', el: 'Εξαιρετικό' },
  status_good_label: { en: 'Good', el: 'Καλό' },
  status_needs_work_label: { en: 'Needs work', el: 'Χρειάζεται δουλειά' },
  status_critical_label: { en: 'Critical', el: 'Κρίσιμο' },
  update_failed: { en: 'Failed to update criterion', el: 'Αποτυχία ενημέρωσης κριτηρίου' },
  export_history: { en: 'Export history as CSV', el: 'Εξαγωγή ιστορικού σε CSV' },
};

export function readinessEn(key: keyof typeof READINESS_STRINGS): string {
  return READINESS_STRINGS[key].en;
}

export function readinessEl(key: keyof typeof READINESS_STRINGS): string {
  return READINESS_STRINGS[key].el;
}
