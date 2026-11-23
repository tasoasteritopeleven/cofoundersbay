import { findBuilderField } from '@/lib/builder-fields';
import { readNaturalSearch } from '@cofounderbay/shared';
import { resolveRouteTarget } from '@/lib/action-registry';
import { canShortcut } from '@/lib/usage-profile';
import { detectNotificationPref, wantsTriage } from '@/lib/notification-chat';
import { namesCanvasSurface, planCanvasCommandArgs } from '@/lib/canvas/plan-canvas-command';
import type { AreaReadId } from './copilot-reads';
import { isWhereIsQuestion, whereIsTerms } from './where-is';
import type { CopilotToolName, PlannedTool } from './copilot-types';

const ROUTE_ALIASES: Array<{ keys: string[]; href: string; label: string }> = [
  { keys: ['dashboard', 'home', 'overview', 'αρχική'], href: '/dashboard', label: 'Dashboard' },
  { keys: ['match', 'matches', 'ταιριά', 'ταιριασματα'], href: '/matches', label: 'Matches' },
  { keys: ['discover', 'explore', 'ανακάλυψε'], href: '/discover', label: 'Discover' },
  { keys: ['search', 'αναζήτηση'], href: '/search', label: 'Search' },
  { keys: ['message', 'messages', 'inbox', 'μηνύματα'], href: '/messages', label: 'Messages' },
  { keys: ['connection', 'connections', 'intros', 'συνδέσεις'], href: '/connections', label: 'Connections' },
  { keys: ['profile', 'προφίλ'], href: '/profile', label: 'Profile' },
  { keys: ['settings', 'ρυθμίσεις'], href: '/settings', label: 'Settings' },
  { keys: ['research', 'canvas', 'έρευνα'], href: '/research', label: 'Research' },
  { keys: ['builder', 'pitch'], href: '/builder', label: 'Builder' },
  { keys: ['notification', 'ειδοποιήσεις'], href: '/notifications', label: 'Notifications' },
  { keys: ['shortlist', 'saved profile', 'αποθηκευμ'], href: '/shortlist', label: 'Saved Profiles' },
  { keys: ['calendar', 'ημερολόγ', 'ημερολογ'], href: '/calendar', label: 'Calendar' },
  { keys: ['fundraising', 'χρηματοδ'], href: '/fundraising', label: 'Fundraising' },
  { keys: ['job', 'jobs', 'θέσεις', 'θεσεις'], href: '/jobs', label: 'Jobs' },
  { keys: ['event', 'events', 'εκδήλωσ', 'εκδηλωσ'], href: '/events', label: 'Events' },
  { keys: ['mentor', 'mentoring', 'μέντορ', 'μεντορ'], href: '/mentoring', label: 'Mentoring' },
  { keys: ['assistant', 'copilot', 'ai chat'], href: '/ai', label: 'AI Assistant' },
];

const LOCATION_ALIASES: Array<{ keys: string[]; value: string }> = [
  { keys: ['athens', 'αθήνα', 'αθηνα', 'greece', 'ελλάδα', 'ελλαδα'], value: 'Athens' },
  { keys: ['berlin', 'berlín', 'germany'], value: 'Berlin' },
  { keys: ['london', 'uk'], value: 'London' },
  { keys: ['limassol', 'λεμεσ'], value: 'Limassol' },
  { keys: ['cyprus', 'κύπρο', 'κυπρο'], value: 'Cyprus' },
];

const PERSON_ALIASES: Array<{ keys: string[]; name: string }> = [
  { keys: ['elena', 'papadopoulos', 'έλεν', 'ελεν'], name: 'Elena' },
  { keys: ['marcus', 'chen', 'μάρκους', 'μαρκους'], name: 'Marcus' },
  { keys: ['sarah', 'kim'], name: 'Sarah' },
  // Greek names decline - «ο Νίκος», «στον Νίκο», «του Νίκου» - so the stem
  // without its ending is the key.
  { keys: ['nikos', 'andreou', 'νίκο', 'νικο'], name: 'Nikos' },
];

/**
 * The analytics windows, longest spelling first so "14 days" is not captured
 * by "4 days" and "90" is not captured inside "190".
 */
const PERIOD_ALIASES: Array<{ keys: string[]; period: string }> = [
  { keys: ['90 day', '90d', '3 month', '90 ημέρ', '90 ημερ', '3 μήν', '3 μην', 'τρίμην', 'τριμην'], period: '90d' },
  // 'μήνα', not 'μήν': the shorter stem is inside 'μήνυμα' (message).
  { keys: ['30 day', '30d', 'last month', 'μήνα', 'μηνα', '30 ημέρ', '30 ημερ'], period: '30d' },
  { keys: ['14 day', '14d', 'two week', 'fortnight', '14 ημέρ', '14 ημερ', 'δεκαπενθ'], period: '14d' },
  { keys: ['7 day', '7d', 'last week', 'this week', '7 ημέρ', '7 ημερ', 'εβδομάδ', 'εβδομαδ'], period: '7d' },
];

const READINESS_DIMENSION_ALIASES: Array<{ keys: string[]; dimension: string }> = [
  { keys: ['team', 'ομάδ', 'ομαδ'], dimension: 'team' },
  { keys: ['market', 'αγορά', 'αγορα'], dimension: 'market' },
  { keys: ['product', 'προϊόν', 'προιον', 'προϊον'], dimension: 'product' },
  { keys: ['business', 'μοντέλο', 'μοντελο', 'επιχειρηματικ'], dimension: 'business' },
  { keys: ['funding', 'χρηματοδ', 'επένδυσ', 'επενδυσ'], dimension: 'funding' },
  { keys: ['execution', 'εκτέλεσ', 'εκτελεσ', 'υλοποίησ', 'υλοποιησ'], dimension: 'execution' },
];

/**
 * Substring match that ignores Greek stress marks on both sides.
 *
 * Greek moves the accent between forms of one word - «αντιστοίχιση» but
 * «αντιστοιχίσεις» - so a key spelled with one accent missed the other forms,
 * and lists grew a second unaccented spelling per key to compensate.
 * `fold` is defined below and used by `includesWord` for the same reason.
 */
function includesAny(haystack: string, needles: string[]): boolean {
  const folded = fold(haystack);
  return needles.some((n) => haystack.includes(n) || folded.includes(fold(n)));
}

/**
 * Lower case, with Greek tonos and diaeresis removed.
 *
 * A Greek stem written with an accent matches only the forms that keep the
 * accent in the same place, and Greek moves it: «εκδήλωση» but «εκδηλώσεις».
 * Listing each variant is how a key goes missing, so both sides are folded to
 * unaccented letters before they are compared.
 */
function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Whether any key names a whole word in the message.
 *
 * The older phrase lists match substrings and can, because their phrases are
 * long. The area keys are short nouns: "event" sits inside "prevent", "job"
 * inside "jobless", "group" inside "subgroup". So an English key must be the
 * whole word, with an optional plural — "events" still names "event" — and a
 * key ending in `*` is a stem that may continue, for words whose endings vary
 * ("communit*" covers community and communities).
 *
 * Greek keys are compared as folded substrings. JavaScript’s `\b` knows only
 * ASCII word characters, and the Greek keys are stems chosen to be unambiguous.
 */
function includesWord(haystack: string, needles: string[]): boolean {
  const text = fold(haystack);
  return needles.some((raw) => {
    const needle = fold(raw);
    const stem = needle.endsWith('*');
    const body = stem ? needle.slice(0, -1) : needle;
    if (!/^[\x00-\x7f]+$/.test(body)) return text.includes(body);
    const escaped = body.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(stem ? `\\b${escaped}` : `\\b${escaped}s?\\b`).test(text);
  });
}

/**
 * Questions about a product area, answered by reading it.
 *
 * Each maps to a reader in `copilot-reads.ts`. The keys are nouns, not verbs:
 * "what events are coming up", "show my milestones" and «ποιες εκδηλώσεις
 * έρχονται» all name the area, and naming it is enough to be worth reading.
 */
const AREA_READ_ALIASES: Array<{ keys: string[]; tool: AreaReadId }> = [
  { keys: ['my profile', 'my bio', 'my headline', 'founder profile', 'this profile', 'το προφιλ μου', 'προφιλ μου', 'ιδρυτικο προφιλ', 'αυτο το προφιλ'], tool: 'get_profile' },
  {
    keys: ['message', 'inbox', 'unread', 'conversation', 'συνομιλι', 'μηνυματ', 'αδιαβαστ'],
    tool: 'get_messages',
  },
  {
    // «Αιτήματα γνωριμίας» is what the Connections page calls a pending
    // request, as "intro request" is in English; warm introductions are
    // «γνωριμίες» (get_intros), once «συστάσεις γνωριμίας».
    keys: ['connection', 'my network', 'intro request', 'συνδεσ', 'αιτημα συνδεσ', 'αιτηματα γνωριμιας', 'αιτημα γνωριμιας', 'δικτυο μου'],
    tool: 'get_connections',
  },
  // "My calendar" is what the Calendar page gathers: events, sessions and milestone dates.
  { keys: ['event', 'meetup', 'webinar', 'workshop', 'demo day', 'my calendar', 'εκδηλωσ', 'ημερολογιο μου'], tool: 'get_events' },
  { keys: ['milestone', 'overdue', 'my calendar', 'οροσημ', 'εκπροθεσμ', 'ημερολογιο μου'], tool: 'get_milestones' },
  { keys: ['job', 'open role', 'hiring', 'θεσεις εργασιας', 'αγγελι', 'προσληψ'], tool: 'get_jobs' },
  { keys: ['group', 'communit*', 'κοινοτητ'], tool: 'get_groups' },
  // The Endorsements page is «Συστάσεις», so that is the word a Greek reader
  // asks with; «προσυπογραφή» is kept for anyone who learnt the older term.
  { keys: ['endorse*', 'προσυπογραφ', 'συστασ'], tool: 'get_endorsements' },
  { keys: ['opportunit*', 'gig', 'paid gig', 'ευκαιρι'], tool: 'get_opportunities' },
  // Need cards and the ladder: «δεσμεύσεις» is the area's Greek name.
  { keys: ['commitment*', 'need card*', 'my needs', 'δεσμευσ', 'καρτα αναγκ', 'καρτες αναγκ', 'καρτων αναγκ'], tool: 'get_commitments' },
  // What the founding team lacks: "what skills is my team missing".
  {
    keys: ['team missing', 'my team missing', 'missing skills', 'skill gap*', 'gaps in my team', 'gap in my team', 'what roles do i need', 'who should i add to my team', 'λειπουν απο την ομαδα', 'λειπει απο την ομαδα', 'κενα στην ομαδα', 'κενο στην ομαδα', 'τι ρολους χρειαζομαι'],
    tool: 'get_team_gaps',
  },
  // One match explained: "why do I match with Elena", «γιατί ταιριάζω με την Έλενα».
  {
    keys: ['why do i match', 'why we match', 'why are we matched', 'how well do i fit', 'how well do we fit', 'how do we fit', 'compatibility with', 'my match with', 'γιατι ταιριαζ', 'ποσο ταιριαζ', 'πως ταιριαζουμε', 'συμβατοτητα με'],
    tool: 'get_match_detail',
  },
  // Warm introductions: «γνωριμίες» on the page since §111. «Συστάσεις»
  // alone is endorsements, so the older «συστάσεις γνωριμίας» keeps its own
  // keys; "introduce me" alone is a connection request.
  {
    keys: ['introductions', 'warm intro*', 'my intros', 'who could introduce', 'who can introduce', 'γνωριμιες', 'γνωριμια μεσω', 'συστασεις γνωριμιας', 'συσταση γνωριμιας', 'ζεστη συσταση', 'ζεστες συστασεις', 'να με συστησει'],
    tool: 'get_intros',
  },
  // Partner perks: «προσφορές» alone is a provider's own services, so the
  // Greek keys carry «συνεργατ», «εκπτωσ» or «πιστωσ».
  {
    keys: ['perk*', 'partner offer*', 'partner discount*', 'startup credit*', 'cloud credit*', 'discount code*', 'προσφορες συνεργατ', 'προσφορα συνεργατ', 'εκπτωσεις', 'εκπτωση για', 'πιστωσεις'],
    tool: 'get_perks',
  },
  // The Legal Hub catalogue: a template by name, or the legal area itself.
  {
    keys: ['legal hub', 'legal template*', 'legal document*', 'legal office hours', 'nda', 'safe (post', 'safe agreement', 'post-money safe', 'term sheet', 'bylaws', 'articles of incorporation', 'founder stock', 'inventions agreement', 'offer letter', 'contractor agreement', 'adviser agreement', 'advisor agreement', 'employee handbook', 'trademark assignment', 'board consent', 'vesting', 'νομικος κομβος', 'νομικα προτυπα', 'νομικα εγγραφα', 'νομικες ωρες', 'καταστατικ', 'εσωτερικος κανονισμος', 'εκχωρηση σηματος', 'συμφωνια συμβουλου', 'επιστολη προσφορας'],
    tool: 'get_legal_templates',
  },
  // Who viewed my profile: asked as a person, not as a figure («προβολές» is analytics).
  {
    keys: ['who viewed', 'who has viewed', 'who looked at my profile', 'who visited my profile', 'viewed my profile', 'profile viewers', 'ποιος ειδε', 'ποιοι ειδαν', 'ποιος εχει δει', 'ειδαν το προφιλ', 'επισκεπτες του προφιλ'],
    tool: 'get_profile_viewers',
  },
  // The co-founder scout («ανιχνευτής συνιδρυτών»).
  { keys: ['co-founder scout', 'cofounder scout', 'my scout', 'the scout', 'ανιχνευτ'], tool: 'get_scout' },
  // Skills and the work that shows them.
  { keys: ['skill evidence', 'evidence for my skill*', 'backs my skill*', 'evidence behind my skill*', 'τεκμηρια', 'τεκμηριο'], tool: 'get_skill_evidence' },
  // Founder updates: named as the kind of update, or by who wrote them.
  {
    keys: ['founder update*', 'investor update*', 'updates from', 'people i follow', 'ενημερωσεις ιδρυτ', 'ενημερωση ιδρυτ', 'ενημερωσεις επενδυτ', 'ενημερωση επενδυτ', 'ενημερωσεις απο', 'οσους ακολουθω'],
    tool: 'get_founder_updates',
  },
  // A mentor's mentees are the people on the other side of the sessions.
  { keys: ['session', 'mentee*', 'my calendar', 'συνεδρι', 'καθοδηγουμεν', 'οσους καθοδηγω', 'ημερολογιο μου'], tool: 'get_mentorship_sessions' },
  {
    keys: ['saved profile', 'my shortlist', 'αποθηκευμενα προφιλ', 'αποθηκευμενους'],
    tool: 'get_shortlist',
  },
  { keys: ['research board', 'πινακες ερευνας', 'πινακα ερευνας'], tool: 'get_research_boards' },
  {
    keys: ['my workspace', 'my workspaces', 'this workspace', 'startup builder', 'builder workspace', 'builder section*', 'χωρους εργασιας', 'χωρο εργασιας', 'χωροι εργασιας', 'ενοτητα του builder'],
    tool: 'get_builder_state',
  },
  // The investor's board is one list: watchlist, pipeline and portfolio.
  {
    keys: ['investor board', 'my pipeline', 'my watchlist', 'my portfolio', 'investor portfolio', 'investment pipeline', 'πινακας επενδυσεων', 'πινακα επενδυσεων', 'pipeline μου', 'χαρτοφυλακιο μου', 'επενδυτικο χαρτοφυλακιο', 'pipeline επενδυσεων'],
    tool: 'get_investor_board',
  },
  // The founder's own round and leads. Narrow: "investors for my round" is a
  // search, and "fundraising" alone is often a topic, as in "mentors for fundraising".
  {
    keys: ['my fundraising', 'fundraising round', 'fundraising going', 'fundraising status', 'my raise', 'investor leads', 'data room', 'round going', 'χρηματοδοτηση μου', 'χρηματοδοτησης μου', 'γυρο χρηματοδοτησης', 'γυρος χρηματοδοτησης', 'γυρου χρηματοδοτησης', 'παει ο γυρος', 'επαφες επενδυτων'],
    tool: 'get_fundraising',
  },
  // Wave B. Each key names the area as a noun, as the ones above do.
  {
    keys: ['my program', 'my programme', 'my application', 'applied to', 'αιτησεις μου', 'αιτηση μου', 'προγραμματα μου'],
    tool: 'get_my_programs',
  },
  {
    keys: ['program', 'programme', 'accelerator', 'incubator', 'bootcamp', 'προγραμμα', 'επιταχυντ', 'θερμοκοιτιδ'],
    tool: 'get_programs',
  },
  { keys: ['invite*', 'invitation*', 'referral*', 'προσκλησ', 'προσκαλεσ'], tool: 'get_invites' },
  { keys: ['badge*', 'my level', 'xp', 'reputation', 'streak', 'σηματα', 'εμβληματ', 'επιπεδο μου', 'φημη μου', 'σερι'], tool: 'get_reputation' },
  { keys: ['readiness score', 'my readiness', 'how ready', 'investor ready', 'venture readiness', 'startup readiness', 'readiness gap*', 'lowest dimension', 'weakest dimension', 'ετοιμοτητα'], tool: 'get_readiness' },
  {
    keys: ['profile view*', 'my analytics', 'my stats', 'my statistics', 'my activity', 'προβολες', 'στατιστικα μου', 'αναλυτικα μου', 'δραστηριοτητα μου'],
    tool: 'get_analytics',
  },
  {
    keys: ['mentor directory', 'available mentor*', 'which mentors', 'mentors taking', 'mentors available', 'καταλογο μεντορων', 'καταλογος μεντορων', 'διαθεσιμοι μεντορες', 'ποιοι μεντορες'],
    tool: 'get_mentors',
  },
  {
    keys: ['mentoring request*', 'mentorship request*', 'mentor request*', 'αιτηματα mentoring', 'αιτημα mentoring', 'αιτηματα καθοδηγησ', 'αιτημα καθοδηγησ'],
    tool: 'get_mentor_requests',
  },
  { keys: ['booking*', 'booked', 'κρατησ', 'κλεισμεν'], tool: 'get_bookings' },
  {
    keys: ['my availability', 'my hours', 'weekly hours', 'bookable', 'διαθεσιμοτητα μου', 'ωρες μου', 'εβδομαδιαιες ωρες'],
    tool: 'get_availability',
  },
  { keys: ['my service*', 'service offer*', 'my offer*', 'υπηρεσιες μου', 'προσφορες μου'], tool: 'get_services' },
  { keys: ['inquir*', 'enquir*', 'αιτηματα πελατ', 'αιτημα πελατ', 'ερωτηματα πελατ'], tool: 'get_inquiries' },
  { keys: ['learning', 'course', 'tutorial', 'εκπαιδευτικ', 'μαθηματα', 'μαθημα'], tool: 'get_learning' },
  { keys: ['expert review*', 'αξιολογησεις ειδικ', 'αξιολογηση ειδικ', 'αξιολογησεων ειδικ'], tool: 'get_expert_reviews' },
  // The UI says «κύκλος» for a cohort; only the plural, because «κύκλος» alone is also a funding round.
  { keys: ['cohort*', 'κοορτ', 'κυκλοι', 'κυκλους', 'κυκλων'], tool: 'get_org_cohorts' },
  {
    keys: ['organisation member*', 'organization member*', 'org member*', 'members of my organi*', 'μελη του οργανισμου', 'μελη οργανισμου'],
    tool: 'get_org_members',
  },
  {
    keys: ['platform stat*', 'platform figure*', 'how many users', 'total users', 'στατιστικα πλατφορμας', 'ποσοι χρηστες', 'χρηστες της πλατφορμας'],
    tool: 'get_platform_stats',
  },
  {
    keys: ['moderation queue', 'open report*', 'pending report*', 'reported user*', 'reports waiting', 'reports to review', 'reports for review', 'ουρα ελεγχου', 'αναφορες σε αναμονη', 'ανοιχτες αναφορες', 'αναφορες για ελεγχο'],
    tool: 'get_moderation_queue',
  },
  // The whole studio in one answer (docs §114).
  {
    keys: ['audit my studio', 'studio audit', 'studio check', 'check my studio', 'check my whole studio', 'ελεγχος studio', 'ελεγχος του studio', 'ελεγχο στο studio', 'ελεγχο σε ολο το studio', 'ελεγξε το studio'],
    tool: 'get_studio_check',
  },
  // How the reader uses the platform, and the quicker ways it suggests (docs §107).
  {
    keys: [
      'how i use', 'how do i use', 'my usage', 'work faster', 'faster way*', 'quicker way*', 'shortcut*', 'personali*', 'my pages', 'pinned', 'pages i open',
      'πως χρησιμοποιω', 'πως δουλευω', 'πιο γρηγορα', 'πιο συντομ', 'συντομευσ', 'εξατομικ', 'οι σελιδες μου', 'σελιδες που ανοιγω', 'καρφιτσωμεν',
    ],
    tool: 'get_usage_insights',
  },
];

/**
 * Phrasing that asks rather than instructs.
 *
 * Used for one decision only: "open events" is a request to go somewhere and
 * reads nothing, while "open events — which ones are this week?" is both. With
 * no navigation verb in the message, naming an area is already a question.
 */
const QUESTION_PHRASES = [
  'what', 'which', 'who', 'show', 'list', 'how many', 'any ', 'do i have', 'coming up', 'upcoming',
  'τι ', 'ποια', 'ποιες', 'ποιοι', 'ποιος', 'δείξε', 'δειξε', 'πόσ', 'ποσα', 'ποσες', 'ποσοι',
  'έχω', 'εχω', 'επερχόμεν', 'επερχομεν', 'έρχονται', 'ερχονται',
];

/**
 * Verbs that mean "go and search", as opposed to a noun that happens to be a role.
 *
 * Deliberately no "who is": it is how a question about a list begins — "who is
 * on my shortlist" — and treating it as a search verb ran a people search for
 * that whole sentence beside the shortlist it had already read.
 */
const EXPLICIT_SEARCH_PHRASES = ['find', 'search', 'look for', 'βρες', 'ψάξε', 'ψαξε', 'αναζήτη'];

/** Verbs that mean "add to the list", as opposed to asking what is on it. */
const EXPLICIT_SAVE_PHRASES = [
  'save', 'add ', 'bookmark', 'αποθήκευσε', 'αποθηκευσε', 'πρόσθεσε', 'προσθεσε',
];

/** Verbs that mean "take off the list", as opposed to asking what is on it. */
const EXPLICIT_REMOVE_PHRASES = [
  'remove', 'unsave', 'take off', 'drop from', 'βγάλε', 'βγαλε', 'αφαίρεσε', 'αφαιρεσε',
];

export function detectAreaReads(message: string): AreaReadId[] {
  const lower = message.toLowerCase();
  const found = AREA_READ_ALIASES.filter((alias) => includesWord(lower, alias.keys)).map((alias) => alias.tool);
  return found.filter((tool) => {
    // "My programmes" is the narrower question; the open-programme list
    // beside it would answer one nobody asked.
    if (tool === 'get_programs' && found.includes('get_my_programs')) return false;
    // A named window is analytics_set_period's job; a 7-day read beside it
    // would report figures for a period the reader just moved away from.
    if (tool === 'get_analytics' && detectAnalyticsPeriod(lower) !== undefined) return false;
    // «Συστάσεις γνωριμίας» are introductions, not endorsements.
    if (tool === 'get_endorsements' && found.includes('get_intros') && !includesWord(lower, ['endorse*', 'προσυπογραφ'])) return false;
    // "Who viewed my profile" is a question about people, not the profile or its view count.
    if ((tool === 'get_profile' || tool === 'get_analytics') && found.includes('get_profile_viewers') && !includesWord(lower, ['analytics', 'stats', 'bio', 'headline', 'αναλυτικα', 'στατιστικα'])) return false;
    // Perks asked about are partners' offers, not the reader's own services.
    if (tool === 'get_services' && found.includes('get_perks')) return false;
    return true;
  });
}

/**
 * Whether the reader is asking about the screen in front of them.
 *
 * Narrow on purpose. A question about the page is one the page’s own snapshot
 * can answer; anything broader belongs to the network tools, and answering it
 * by describing the current page would be a non-sequitur.
 *
 * It lives here rather than in the engine because every other phrase list does
 * — and because the engine’s source is scanned for user-facing prose, where a
 * list of matching keys reads as untranslated copy.
 */
const THIS_PAGE_PHRASES = [
  'this page', 'this screen', 'what am i looking at', 'what is here', 'what do i see',
  'where am i', 'what should i do here', 'explain this',
  'αυτή τη σελίδα', 'αυτη τη σελιδα', 'αυτή η σελίδα', 'αυτη η σελιδα',
  'τι βλέπω', 'τι βλεπω', 'πού βρίσκομαι', 'που βρισκομαι',
  'τι κάνω εδώ', 'τι κανω εδω', 'τι είναι αυτό', 'τι ειναι αυτο',
];

/**
 * Whether the reader asks why rows are samples, or whether they are real:
 * "Why does the earnings page show sample transactions?", «Γιατί βλέπω
 * δείγματα;», "Is this data real?". Every "Sample data" note offers this
 * question, and the general summary that answered it was about something else.
 * A statement about samples followed by another question ("These endorsements
 * are samples. Who should I ask first?") is that other question.
 */
export function asksAboutSamples(message: string): boolean {
  const m = message.toLowerCase();
  return includesAny(m, ['sample', 'demo data', 'δειγμα', 'δειγματ']) &&
    (includesWord(m, ['why', 'real']) || includesAny(m, ['γιατι', 'πραγματικ']));
}

export function asksAboutThisPage(message: string): boolean {
  return includesAny(message.toLowerCase(), THIS_PAGE_PHRASES);
}

/**
 * Which section of the page rail the reader is asking for, if any.
 *
 * A railed page keeps its filters, totals, period and exports in the panel on
 * the right; the page context lists that panel's sections by id and label.
 * Each family pairs what a reader says with how sections are named, in both
 * languages, and a match needs a verb of looking ("show", "where", "open") so
 * that "filter founders in Athens" stays a search. Export is its own verb.
 *
 * Returns the first listed section the asked-for family names, so a page's
 * own order decides between two candidates.
 */
const RAIL_FAMILIES: { ask: RegExp; section: RegExp; selfVerb?: boolean }[] = [
  // A status picker is a filter too (/tenant/programs calls its section
  // "Program status").
  { ask: /\b(filters?|narrow)\b|φίλτρ|φιλτρ/i, section: /filter|narrow|status|φίλτρ|φιλτρ|κατάστασ/i },
  {
    ask: /\b(totals?|figures?|stats|statistics|numbers|counts|at a glance|summary)\b|σύνολ|συνολ|στατιστ|αριθμ/i,
    section: /total|figure|glance|summary|σύνολ|συνολ|στατιστ/i,
  },
  { ask: /\b(export|download|csv)\b|εξαγωγ|εξάγ|κατέβασ/i, section: /export|tools|εξαγωγ|εργαλεί/i, selfVerb: true },
  { ask: /\b(period|window|date range|time range|timeframe)\b|περίοδ|περιοδ/i, section: /period|window|range|περίοδ/i },
  { ask: /\b(sort|sorting|order by)\b|ταξινόμ|ταξινομ/i, section: /sort|order|ταξινόμ/i },
  { ask: /\b(settings|preferences|options)\b|ρυθμίσ|ρυθμισ|προτιμήσ/i, section: /setting|preference|option|ρυθμίσ|προτιμ/i },
];
const LOOK_VERBS = /\b(open|show|see|view|where|find|display|bring up|take me|go to)\b|άνοιξ|ανοιξ|δείξ|δειξ|πού|που είναι|εμφάνισ|βρίσκ/i;

export function railSectionFor<T extends { id: string; label: string }>(
  message: string,
  sections: readonly T[],
): T | undefined {
  for (const family of RAIL_FAMILIES) {
    if (!family.ask.test(message)) continue;
    if (!family.selfVerb && !LOOK_VERBS.test(message)) continue;
    const hit = sections.find((s) => family.section.test(`${s.id} ${s.label}`));
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Which of the page's own controls a message asks for, and with which choice.
 *
 * Pages register their controls (`usePageControls`); the page context lists
 * them with their options. A control is matched by the words of its label
 * and, when it takes a choice, by the words of one option - "show only
 * suspended users" picks the status filter's Suspended; "suspend Mike
 * Johnson" picks the Suspend command's Mike Johnson row.
 *
 * Words are compared without accents and by a five-letter stem, so
 * "suspended" meets "Suspend" and «φίλτρα» meets «Φιλτράρισμα». A control
 * that takes a choice needs one option to match and, unless its own label
 * matched too, a verb of looking or acting, so a passing mention of a value
 * does not press anything. The best score wins; ties go to the page's order.
 */
type ControlLike = {
  id: string;
  label: string;
  writes: boolean;
  options?: { value: string; label: string }[];
  unavailable?: string;
};

const CONTROL_STOPWORDS = new Set([
  'the', 'and', 'for', 'only', 'all', 'any', 'this', 'that', 'page', 'show', 'with', 'from', 'into', 'please', 'can', 'you',
  'και', 'του', 'της', 'των', 'τον', 'την', 'για', 'από', 'μόνο', 'μονο', 'όλα', 'ολα', 'όλοι', 'ολοι', 'όλες', 'αυτή', 'αυτη',
  'σελίδα', 'σελιδα', 'δείξε', 'δειξε', 'μου', 'οποιαδήποτε', 'οποιαδηποτε', 'οποιοσδήποτε', 'οποιοσδηποτε',
]);
const CONTROL_VERBS =
  /\b(show|only|filter|narrow|list|set|switch|change|pick|choose|use|sort|export|download|open|run|make|mark|apply)\b|δείξ|δειξ|μόνο|μονο|φίλτρ|φιλτρ|άλλαξ|αλλαξ|βάλε|βαλε|κάνε|κανε|εξαγ|άνοιξ|ανοιξ|ταξιν/i;

function wordsOf(text: string): string[] {
  return fold(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3 && !/^\d+$/.test(w) && !CONTROL_STOPWORDS.has(w));
}
function stem(word: string): string {
  return word.length > 5 ? word.slice(0, 5) : word;
}

export function pageControlFor<T extends ControlLike>(
  message: string,
  controls: readonly T[],
): { control: T; option?: NonNullable<T['options']>[number] } | undefined {
  const said = new Set(wordsOf(message).map(stem));
  const hits = (text: string) => wordsOf(text).filter((w) => said.has(stem(w))).length;
  const verb = CONTROL_VERBS.test(message);

  let best: { control: T; option?: NonNullable<T['options']>[number]; score: number } | undefined;
  for (const control of controls) {
    const labelWords = wordsOf(control.label);
    const labelScore = hits(control.label);
    if (control.options?.length) {
      for (const option of control.options) {
        const optionWords = wordsOf(option.label);
        const optionScore = hits(option.label);
        // Every word of the option must be there: "Mike" alone should not
        // pick "Mike Johnson" over "Mike Chen".
        if (optionScore === 0 || optionScore < optionWords.length) continue;
        // A command that writes needs its own words ("suspend", "ban"): a
        // message that only names a row - "show Mike Johnson" - must never
        // pick something that changes stored data.
        if (control.writes && labelScore === 0) continue;
        if (labelScore === 0 && !verb) continue;
        const score = optionScore * 2 + labelScore;
        if (!best || score > best.score) best = { control, option, score };
      }
    } else {
      // A plain button: most of its label's words, and at least two when it
      // has two ("Export users"), so "users" alone does not export them.
      const needed = Math.min(2, labelWords.length);
      if (labelScore < Math.max(1, needed)) continue;
      const score = labelScore;
      if (!best || score > best.score) best = { control, score };
    }
  }
  return best ? { control: best.control, option: best.option } : undefined;
}

/**
 * Which list on the page the reader asks about, if any.
 *
 * Pages publish what their lists show (`usePageList`). A message asks about
 * one when it has a question word - what, which, who, how many, «ποιοι»,
 * «πόσα» - and names the list by its label's words ("which deals…", «ποιοι
 * χρήστες…»), or points at it ("the list", "here", «εδώ»). A request to act
 * ("suspend Mike Chen") has no question word and never matches, so the page's
 * commands still get it.
 */
const LIST_QUESTION =
  /\b(what|which|who|whose|how many|list|read|name|tell me)\b|ποιο|ποια|ποιε|ποιοι|πόσ|ποσα|ποσοι|ποσες|τι έχει|τι εχει|τι δείχνει|τι δειχνει|τι υπάρχει|τι υπαρχει|διάβασ|διαβασ/i;
const LIST_REFERENCE = /\b(list|shown|on screen|here|these|visible|in view)\b|λίστα|λιστα|εδώ|εδω|οθόνη|οθονη|αυτές|αυτες|αυτοί|αυτοι|αυτά/i;

export function pageListFor<T extends { id: string; label: string }>(
  message: string,
  lists: readonly T[],
): T | undefined {
  if (/since (?:my|the|our) last visit|what changed since|τι αλλαξε απο|τελευταια επισκεψη/.test(fold(message))) {
    return lists.find((list) => list.id === 'since_last_visit');
  }
  if (!lists.length || !LIST_QUESTION.test(message)) return undefined;
  const said = new Set(wordsOf(message).map(stem));
  let best: { list: T; score: number } | undefined;
  for (const list of lists) {
    const score = wordsOf(list.label).filter((w) => said.has(stem(w))).length;
    if (score > 0 && (!best || score > best.score)) best = { list, score };
  }
  if (best) return best.list;
  return LIST_REFERENCE.test(message) ? lists[0] : undefined;
}

export function detectAnalyticsPeriod(message: string): string | undefined {
  return PERIOD_ALIASES.find((alias) => includesAny(message, alias.keys))?.period;
}

export function detectReadinessDimension(message: string): string | undefined {
  return READINESS_DIMENSION_ALIASES.find((alias) => includesAny(message, alias.keys))?.dimension;
}

/**
 * Pulls a workspace name out of quotes.
 *
 * Only quoted, deliberately. Guessing a name from free prose would create
 * something the user has to go and rename, and the engine’s "what should I
 * call it?" is a better answer than a wrong name. Handles the curly quotes a
 * phone keyboard produces as well as the straight ones a desktop does.
 */
export function detectQuotedName(rawMessage: string): string | undefined {
  const match = rawMessage.match(/["“'«]([^"”'»]{1,100})["”'»]/);
  return match?.[1].trim() || undefined;
}

const GROUP_NOUNS = ['group', 'community', 'ομάδα', 'ομαδα', 'κοινότητα', 'κοινοτητα'];
const PROGRAM_NOUNS = ['programme', 'program', 'accelerator', 'incubator', 'bootcamp', 'πρόγραμμα', 'προγραμμα', 'επιταχυντ', 'θερμοκοιτίδ', 'θερμοκοιτιδ'];
const MENTOR_REQUEST_NOUNS = ['mentoring request', 'mentorship request', 'mentor request', 'αίτημα mentoring', 'αιτημα mentoring', 'αίτημα καθοδήγησ', 'αιτημα καθοδηγησ'];

/** An email address written in the message, as typed. */
export function detectEmail(rawMessage: string): string | undefined {
  return rawMessage.match(/[^\s@<>"'«»]+@[^\s@<>"'«»]+\.[^\s@<>"'«».,;:!?]+/)?.[0];
}

/**
 * The group a join or leave names: quoted, or the words between the verb and
 * "group" ("join the Athens Founders group"), or what follows «ομάδα».
 */
export function detectGroupName(rawMessage: string): string | undefined {
  const quoted = detectQuotedName(rawMessage);
  if (quoted) return quoted;
  const en = rawMessage.match(/\b(?:join|leave|exit)\s+(?:the\s+)?(.+?)\s+(?:group|community)\b/i);
  if (en?.[1]) return en[1].trim();
  const el = rawMessage.match(/(?:ομάδα|ομαδα|κοινότητα|κοινοτητα)\s+(.+?)[.;;!?]*$/i);
  return el?.[1]?.trim() || undefined;
}

/** The programme an application names: quoted, or what follows "apply to/for". */
export function detectProgramTitle(rawMessage: string): string | undefined {
  const quoted = detectQuotedName(rawMessage);
  if (quoted) return quoted;
  const en = rawMessage.match(/\bapply\s+(?:to|for)\s+(?:the\s+)?(.+?)(?:\s+(?:programme|program))?[.?!]*$/i);
  if (en?.[1]) return en[1].trim();
  const el = rawMessage.match(/(?:πρόγραμμα|προγραμμα)\s+(.+?)[.;;!?]*$/i);
  return el?.[1]?.trim() || undefined;
}

/**
 * The programme an application note is drafted for: quoted, or what follows
 * "application to/for" or «αίτηση (μου) στο / για το». Without it, "Draft my
 * application for Seed Accelerator" asked for the name again, in quotes.
 */
export function detectApplicationProgramTitle(rawMessage: string): string | undefined {
  const quoted = detectQuotedName(rawMessage);
  if (quoted) return quoted;
  const en = rawMessage.match(/\bapplication\s+(?:to|for)\s+(?:the\s+)?(.+?)(?:\s+(?:programme|program))?[.?!]*$/i);
  if (en?.[1]) return en[1].trim();
  const el = rawMessage.match(/α[ίι]τησ[ηή](?:\s+μου)?\s+(?:στο|για\s+το)\s+(?:πρόγραμμα\s+|προγραμμα\s+)?(.+?)[.;;!?]*$/iu);
  if (el?.[1]) return el[1].trim();
  return detectProgramTitle(rawMessage);
}

/** Whose mentoring request is being answered: "accept Sofia's…", «…της Σοφίας». */
export function detectRequesterName(rawMessage: string): string | undefined {
  const en = rawMessage.match(/\b(?:[Aa]ccept|[Dd]ecline|[Rr]eject)\s+([\p{Lu}][\p{L}-]+(?:\s[\p{Lu}][\p{L}-]+)?)(?:'s|’s)\s/u);
  if (en?.[1]) return en[1];
  const el = rawMessage.match(/(?:του|της)\s+([\p{Lu}][\p{L}-]+)/u);
  return el?.[1] || detectPersonName(rawMessage.toLowerCase());
}

export function detectLocation(message: string): string | undefined {
  const hit = LOCATION_ALIASES.find((alias) => includesAny(message, alias.keys));
  return hit?.value;
}

export function detectPersonName(message: string): string | undefined {
  // A name starts a word: «νίκο» is inside «τεχνικό», and "Find a technical
  // co-founder" in Greek used to search for Nikos.
  const words = fold(message).split(/[^\p{L}]+/u).filter(Boolean);
  const hit = PERSON_ALIASES.find((alias) => alias.keys.some((key) => words.some((w) => w.startsWith(fold(key)))));
  return hit?.name;
}

/**
 * The /discover reading of a request added to `search_people` arguments:
 * "συνιδρυτή SaaS full-time" is a role, an industry and a commitment, not
 * text every profile must contain. Words read as filters leave the text.
 */
function withNaturalFilters(args: Record<string, string>, rawMessage: string): Record<string, string> {
  const natural = readNaturalSearch(rawMessage);
  if (natural.roles.length) args.roles = natural.roles.join(',');
  if (natural.industries.length) args.industries = natural.industries.join(',');
  if (natural.availability.length) args.commitment = natural.availability.join(',');
  if (natural.fundingStage.length) args.fundingStage = natural.fundingStage.join(',');
  if (!args.location && natural.location) args.location = natural.location;
  if (args.q && natural.understood.length) {
    const rest = [...new Set(readNaturalSearch(args.q).rest.split(/\s+/).filter(Boolean))].join(' ');
    if (rest) args.q = rest;
    else delete args.q;
  }
  return args;
}

/**
 * How the reader wants the assistant to answer (docs §110): a style, when the
 * sentence is about the assistant’s answers, and emoji on or off. «Σύνταξε
 * μια πιο σύντομη απάντηση στην Έλενα» is a draft, not a style: it names no
 * answer of the assistant’s, so nothing is changed.
 */
const ANSWER_PHRASES = [
  'your answers', 'your replies', 'answer me', 'answer more', 'answer in ', 'reply more', 'respond more', 'talk to me',
  'be more concise', 'be more detailed', 'be more casual', 'be more formal', 'be brief', 'be concise', 'keep it short', 'keep answers',
  'απαντα', 'απαντησεις σου', 'μιλα μου', 'μιλας', 'γραφε μου',
];
const REPLY_STYLE_ALIASES: Array<{ keys: string[]; style: string }> = [
  { keys: ['concise', 'shorter', 'brief', 'keep it short', 'πιο συντομ', 'πιο συνοπτικ', 'συντομοτερ', 'συντομα'], style: 'concise' },
  { keys: ['more detail', 'longer', 'in depth', 'πιο αναλυτικ', 'πιο λεπτομερ', 'αναλυτικα'], style: 'detailed' },
  { keys: ['casual', 'friendlier', 'more friendly', 'πιο φιλικ', 'πιο χαλαρ', 'φιλικα'], style: 'casual' },
  { keys: ['formal', 'πιο επισημ', 'επισημα'], style: 'formal' },
];

export function detectReplyStyle(message: string): Record<string, string> | undefined {
  const text = fold(message);
  const emojiOff = /\b(no|without|stop using|drop the)\s+emoji/.test(text) || text.includes('χωρις emoji');
  const emojiOn = !emojiOff && (/\b(with|use|add)\s+emoji/.test(text) || text.includes('με emoji'));
  const aboutAnswers = ANSWER_PHRASES.some((phrase) => text.includes(fold(phrase)));
  const hit = aboutAnswers ? REPLY_STYLE_ALIASES.find((alias) => alias.keys.some((key) => text.includes(fold(key)))) : undefined;
  if (!hit && !emojiOff && !emojiOn) return undefined;
  return { ...(hit ? { style: hit.style } : {}), ...(emojiOff ? { emoji: 'false' } : emojiOn ? { emoji: 'true' } : {}) };
}

/**
 * The page a pin names, with or without a navigation verb: "pin messages",
 * «καρφίτσωσε τα μηνύματα». Only a page that can be one of the reader's
 * pages (not a home), so the planner never proposes a pin it would refuse.
 */
function detectPinTarget(message: string): { href: string; label: string } | undefined {
  const hit = ROUTE_ALIASES.find((alias) => includesAny(message, alias.keys));
  const target = hit ? { href: hit.href, label: hit.label } : resolveRouteTarget(message);
  return target && canShortcut(target.href) ? { href: target.href, label: target.label } : undefined;
}

export function detectNavigateHref(message: string): { href: string; label: string } | undefined {
  const wantsNav = includesAny(message, [
    'open',
    'go to',
    'take me',
    'navigate',
    'άνοιξε',
    'ανοιξε',
    'πήγαινε',
    'πηγαινε',
    'δείξε μου τη σελίδα',
  ]);
  if (!wantsNav) return undefined;
  const hit = ROUTE_ALIASES.find((alias) => includesAny(message, alias.keys));
  if (hit) return { href: hit.href, label: hit.label };

  // The aliases above cover 18 destinations; the product has 155, and
  // `PAGE_REGISTRY` already carries a bilingual title for each one. Consulted
  // only after an alias misses, so every phrase that resolved before still
  // resolves to exactly the same route as before.
  const fromRegistry = resolveRouteTarget(message);
  return fromRegistry ? { href: fromRegistry.href, label: fromRegistry.label } : undefined;
}

/**
 * Words that are never what a person is searched by: possessives, "for",
 * and the round a founder means when asking for investors ("investors for my
 * round"). The role and stage are read as filters; left in the query, these
 * made the search look for people whose profile says "my round".
 * Compared folded and word by word, because JavaScript's \b does not see
 * Greek letters, so a Greek word in the pattern above never matched.
 */
const SEARCH_FILLERS = new Set(['my', 'me', 'our', 'for', 'round', 'rounds', 'μου', 'μας', 'για', 'γυρο', 'γυρος', 'γυρου', 'τον', 'την', 'το', 'τη', 'να']);

function searchQueryFromMessage(message: string): string {
  const stripped = message
    .replace(/\b(find|search|look for|show me|βρες|βρες μου|ψάξε|δείξε|co-?founders?|technical|business|mentors?|investors?|στην|στον|στη|the|a|an|μου|να)\b/gi, ' ')
    .replace(/[?!.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((word) => word && !SEARCH_FILLERS.has(fold(word)))
    .join(' ');
  return stripped.slice(0, 80);
}

/*
 * A search through the reader's own messages: a search verb with
 * "messages"/«μηνύματα», or "where did we talk about…", «πού μιλήσαμε για…»,
 * "when did Elena mention…", «πότε μου ανέφερε…». It is decided before the
 * area reads, because «μηνύματα» alone reads the inbox and "find" alone
 * searches people. Returns the words to look for ('' when none were given),
 * or null when the message is not a message search.
 */
const MESSAGE_SEARCH_PATTERNS: RegExp[] = [
  /\b(?:search|find|look)\b.*\b(?:in|through)\s+(?:my\s+|our\s+)?(?:messages|chats|conversations|inbox)\b/,
  /\b(?:search|find|look\s+for)\s+(?:in\s+)?(?:my\s+|our\s+)?(?:messages|chats|conversations)\b/,
  /\bwhere\s+did\s+(?:we|i|\w+(?:\s+and\s+i)?)\s+(?:talk|write|speak|chat)\s+about\b/,
  /\bwhen\s+did\s+\w+\s+(?:mention|say|write|talk\s+about)\b/,
  /\b(?:messages?|chats?)\s+(?:about|mentioning)\b/,
  // Greek: JavaScript's \b knows only ASCII letters, so a Greek word is
  // bounded by the start or a space, never by \b.
  /(?:^|\s)(?:βρες|ψαξε|αναζητησε|αναζητηση)(?:\s.*)?\sμηνυματ/,
  /(?:^|\s)που\s+(?:μιλησαμε|γραψαμε|ειπαμε|συζητησαμε)(?:\s|$)/,
  /(?:^|\s)ποτε\s+(?:μου\s+)?(?:ειπε|ανεφερε|εγραψε|μιλησε)(?:\s|$)/,
  /(?:^|\s)μηνυματα?\s+(?:για|σχετικα\s+με)(?:\s|$)/,
];

const MESSAGE_SEARCH_FILLER = /^(?:the|a|an|my|our|το|τη|την|τον|τα|τις|τους|οι|ο|η|μου|μας)\s+/i;
const MESSAGE_SEARCH_VERB = /^(?:please\s+)?(?:search|find|look\s+for|look|βρες(?:\s+μου)?|ψάξε|ψαξε|αναζήτησε|αναζητησε)(?:\s+|$)/i;
// «Πότε μου ανέφερε ο Μάρκος το Next.js»: the person after a Greek verb is not the query.
const MESSAGE_SEARCH_SUBJECT = /^(?:ο|η|τη|την|τον)\s+\p{Lu}\p{L}+\s+(?=\S)/u;
const MESSAGE_SEARCH_PLACE = /(?:^|\s)(?:(?:in|through)\s+(?:my|our)\s+(?:messages|chats|conversations|inbox)|my\s+(?:messages|chats|conversations)|(?:στα\s+)?μηνύματ[άα]\s+(?:μου|μας)|(?:στα\s+)?μηνυματα\s+(?:μου|μας)|στα\s+μηνύματα|στα\s+μηνυματα)(?=\s|$|[?;!.])/gi;

export function messageSearchQuery(rawMessage: string): string | null {
  const folded = fold(rawMessage.trim().toLowerCase());
  if (!MESSAGE_SEARCH_PATTERNS.some((re) => re.test(folded))) return null;
  // Quoted words are the query, in any of the quotes people type.
  const quoted = rawMessage.match(/[«“"]([^«»“”"]{2,80})[»”"]/);
  if (quoted) return quoted[1].trim();
  // Otherwise what follows "about / for / mention / για / σχετικά με",
  // or, failing that, the message without its verb and "in my messages".
  const after = rawMessage.match(/(?:^|\s)(?:about|for|mention(?:ed)?|σχετικά με|σχετικα με|για|ανέφερε|ανεφερε)\s+(.+)$/i);
  let words = (after ? after[1] : rawMessage).replace(MESSAGE_SEARCH_PLACE, ' ');
  // Question marks anywhere; a full stop only at the end, so "Next.js" survives.
  words = words.replace(/[?;!]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/[.]+$/, '').trim();
  for (let i = 0; i < 3; i += 1) {
    const next = words.replace(MESSAGE_SEARCH_VERB, '').replace(MESSAGE_SEARCH_SUBJECT, '').replace(MESSAGE_SEARCH_FILLER, '');
    if (next === words) break;
    words = next;
  }
  return words.slice(0, 80);
}

/**
 * Rule-based planner used when the LLM has no tools (preview, Ollama down).
 * Returns 1–3 tools; never proposes destructive admin actions.
 */
const THEME_WORDS: Array<[string[], string]> = [
  [['dark', 'σκοτειν'], 'dark'],
  [['lilac', 'λιλα'], 'lilac'],
  [['terracotta', 'τερακοτα'], 'terra'],
  [['playful', 'παιχνιδι'], 'playful'],
  [['apricot', 'βερικοκ'], 'apricot'],
  [['mint', 'μεντα'], 'minimal'],
  [['light', 'φωτειν'], 'light'],
];

/** A theme only when the sentence is about the theme: "dark" alone says nothing. */
function detectTheme(message: string): string | undefined {
  if (!includesWord(message, ['theme', 'θεμα', 'dark mode', 'light mode'])) return undefined;
  return THEME_WORDS.find(([words]) => includesWord(message, words))?.[1];
}

const LANGUAGE_WORDS: Array<[string[], string]> = [
  [['greek', 'ελληνικα'], 'el'],
  [['english', 'αγγλικα'], 'en'],
  [['spanish', 'ισπανικα'], 'es'],
  [['french', 'γαλλικα'], 'fr'],
  [['german', 'γερμανικα'], 'de'],
  [['italian', 'ιταλικα'], 'it'],
];

function detectLanguage(message: string): string | undefined {
  if (!includesWord(message, ['language', 'γλωσσα'])) return undefined;
  if (!includesWord(message, ['change', 'switch', 'set', 'αλλαξε', 'βαλε'])) return undefined;
  return LANGUAGE_WORDS.find(([words]) => includesWord(message, words))?.[1];
}

const WEEKDAYS: Array<[RegExp, number]> = [
  [/\b(sunday)\b|κυριακ/i, 0], [/\b(monday)\b|δευτερ/i, 1], [/\b(tuesday)\b|τριτη/i, 2], [/\b(wednesday)\b|τεταρτ/i, 3],
  [/\b(thursday)\b|πεμπτ/i, 4], [/\b(friday)\b|παρασκευ/i, 5], [/\b(saturday)\b|σαββατ/i, 6],
];

const stripAccents = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** The day a sentence names: a date, tomorrow, or the next such weekday. */
function followUpDate(text: string, now = new Date()): string | undefined {
  const exact = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (exact) return exact[0];
  const plain = stripAccents(text.toLowerCase());
  // The reader's own calendar. Through toISOString, UTC was still on yesterday
  // just after midnight in Athens, and "Friday" came out as a Thursday.
  const day = (offset: number) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  if (/\btomorrow\b|αυριο/.test(plain)) return day(1);
  const weekday = WEEKDAYS.find(([pattern]) => pattern.test(plain))?.[1];
  if (weekday === undefined) return undefined;
  return day(((weekday - now.getDay() + 6) % 7) + 1);
}

/** "follow up with Nikos on Friday: send the deck", «follow-up με τον Νίκο την Παρασκευή». */
function detectFollowUp(rawMessage: string): { investor: string; date: string; step?: string } | undefined {
  if (!/follow[- ]?up|next step|επόμενο βήμα|θύμισέ μου|θυμισε μου/i.test(rawMessage)) return undefined;
  const person = rawMessage.match(/(?:\bwith|\bto|με τον|με την|με το|στον|στην|στο)\s+([A-ZΑ-ΩΆ-Ώ][\p{L}.'’-]+(?:\s+[A-ZΑ-ΩΆ-Ώ][\p{L}.'’-]+)?)/u);
  const date = followUpDate(rawMessage);
  if (!person || !date) return undefined;
  const step = rawMessage.match(/[:«"“](.+?)[»"”]?\s*$/)?.[1]?.trim();
  return { investor: person[1], date, ...(step ? { step } : {}) };
}

/** "Write an email to Irini Kosta", «γράψε email στην Irini Kosta». A name is what makes it a draft, not a question about email. */
function detectInvestorEmail(rawMessage: string): { investor: string } | undefined {
  const asks = /(?:write|draft|send|compose|γράψε|γραψε|στείλε|στειλε|ετοίμασε|ετοιμασε|σύνταξε|συνταξε)\b.*\b(?:e-?mail|mail|μέιλ|μειλ)\b/iu.test(rawMessage)
    || /(?:γράψε|γραψε|στείλε|στειλε|ετοίμασε|ετοιμασε|σύνταξε|συνταξε).*(?:e-?mail|mail|μέιλ|μειλ)/iu.test(rawMessage);
  if (!asks) return undefined;
  const person = rawMessage.match(/(?:\bto|στον|στην|στο|σε)\s+([A-ZΑ-ΩΆ-Ώ][\p{L}'’.-]*(?:\s+[A-ZΑ-ΩΆ-Ώ][\p{L}'’.-]*){0,3})/u);
  return person ? { investor: person[1].trim() } : undefined;
}

/** «Άλλαξε τη διαφάνεια Πρόβλημα σε: …», "rewrite slide 2 to: …". The colon marks where the new text starts. */
function detectSlideRewrite(rawMessage: string): { slide: string; content: string } | undefined {
  const hit = rawMessage.match(/(?:άλλαξε|αλλαξε|ξαναγράψε|ξαναγραψε|γράψε|γραψε|βάλε|βαλε|rewrite|change|update|set)\s+(?:the\s+|τη\s+|την\s+|στη\s+|στην\s+)?(?:slide|διαφάνεια|διαφανεια)\s+(.+?)(?:\s+(?:to|σε))?\s*:\s*(.+)$/iu);
  const slide = hit?.[1]?.trim();
  const content = hit?.[2]?.trim();
  return slide && content ? { slide, content } : undefined;
}

/** «Άλλαξε τα Κανάλια σε: …», "set the value proposition to: …". Only a block the Builder has. */
function detectBuilderWrite(rawMessage: string): { field: string; content: string } | undefined {
  const hit = rawMessage.match(/(?:άλλαξε|αλλαξε|ξαναγράψε|ξαναγραψε|γράψε|γραψε|βάλε|βαλε|rewrite|change|update|set|write)\s+(.{3,40}?)(?:\s+(?:to|σε))?\s*:\s*(.+)$/iu);
  const field = hit?.[1] ? findBuilderField(hit[1]) : undefined;
  const content = hit?.[2]?.trim();
  return field && content ? { field: field.key, content } : undefined;
}

export function planCopilotTools(rawMessage: string): PlannedTool[] {
  const message = rawMessage.trim().toLowerCase();
  if (!message) return [{ name: 'get_graph', args: {} }];

  // Typed as a command, it is the whole request (docs §114).
  if (message === '/audit') return [{ name: 'get_studio_check', args: {} }];

  const tools: PlannedTool[] = [];
  const add = (name: CopilotToolName, args: Record<string, string> = {}) => {
    if (!tools.some((t) => t.name === name && JSON.stringify(t.args) === JSON.stringify(args))) {
      tools.push({ name, args });
    }
  };

  // A search through the reader's own messages is a request of its own.
  const inMessages = messageSearchQuery(rawMessage);
  if (inMessages !== null) return [{ name: 'search_messages', args: inMessages ? { query: inMessages } : {} }];

  const location = detectLocation(message);
  const person = detectPersonName(message);
  const nav = detectNavigateHref(message);
  // Ends with a question mark (the Greek one is ";").
  const asksQuestion = /[?;\u037e]\s*$/.test(rawMessage.trim());
  // Whether the message opens with one of these verbs: "send an intro",
  // "message her", «στείλε μήνυμα». A change to a person with nobody named is
  // planned only then, so the reply can ask who; inside a question or a
  // request for advice ("how should I ask for an intro?", "help me find
  // people to connect with") it was answered with "I need a specific person
  // before I can send an intro".
  const opensWith = (verbs: string[]) => {
    const head = fold(message).replace(/^(?:please|can you|could you|παρακαλω)\s+/, '');
    return verbs.some((verb) => head.startsWith(fold(verb)));
  };

  // Area reads are decided first, because two of the older intents need to
  // know about them. "My upcoming mentoring sessions" contains "mentor", which
  // plans a people search; "who is on my shortlist" contains "shortlist", which
  // plans a save. Neither asked for that. Each older intent still fires when its
  // own verb is there — "find a mentor", "save Elena to my shortlist".
  const areaReads = !nav || includesAny(message, QUESTION_PHRASES) ? detectAreaReads(message) : [];

  // "Where do I export my pitch?" asks for a place. When no area read already
  // answers it with data (mentors, invites, groups), the page registry does.
  if (!areaReads.length && !person && isWhereIsQuestion(rawMessage) && whereIsTerms(rawMessage).length) {
    return [{ name: 'where_is', args: { query: rawMessage.trim().slice(0, 120) } }];
  }
  const explicitSearch = includesAny(message, EXPLICIT_SEARCH_PHRASES);
  const explicitSave = includesAny(message, EXPLICIT_SAVE_PHRASES);
  const explicitRemove = includesAny(message, EXPLICIT_REMOVE_PHRASES);

  const wantsGraph = includesAny(message, [
    'what should i do',
    'next',
    'summary',
    'unread',
    'status',
    'graph',
    'τι να κάνω',
    'τι να κανω',
    'σύνοψη',
    'συνοψη',
    'αδιάβαστα',
    'αδιαβαστα',
    'επόμενο',
    'επομενο',
  ]);

  const searchVerb = includesAny(message, ['find', 'search', 'look for', 'who is', 'βρες', 'ψάξε', 'ψαξε', 'αναζήτη']);
  const wantsSearchWords = !(areaReads.length > 0 && !explicitSearch) && includesAny(message, [
    'find',
    'search',
    'look for',
    'who is',
    'βρες',
    'ψάξε',
    'ψαξε',
    'αναζήτη',
    'technical cofounder',
    'co-founder',
    'cofounder',
    'mentor',
    'investor',
    // The same roles in Greek: «δείξε μου επενδυτές» is the request "show me
    // investors" is, and planned nothing.
    'συνιδρυτ',
    'μεντορ',
    'επενδυτ',
  ]);

  // A question about one match ("why do I match with Elena") is that match's
  // read, not the whole list.
  const wantsMatches = !areaReads.includes('get_match_detail') && includesAny(message, [
    'match',
    'recommend',
    'αντιστοίχισ',
    'αντιστοιχισ',
    'for you',
    'compatible',
    'ταιρι',
    // Not «σύσταση»: in the product that word is an endorsement, and asking
    // for one used to plan a match search beside the endorsements read.
    'προτάσ',
    'προτασ',
  ]);

  // A role named beside matches ("pick two people from my matches to compare
  // as cofounders") is about the matches; only a search verb searches then.
  const wantsSearch = wantsSearchWords && (searchVerb || !wantsMatches);

  const wantsNotifications = includesAny(message, [
    'notification',
    'alert',
    'inbox alert',
    'ειδοποιή',
    'ειδοποιη',
  ]);

  const namesTheList = includesAny(message, [
    'shortlist',
    'saved profile',
    'λίστα',
    'λιστα',
    'αποθηκευμ',
  ]);
  const wantsShortlist =
    !explicitRemove &&
    !(areaReads.includes('get_shortlist') && !explicitSave) &&
    (Boolean(person) || opensWith(['save', 'bookmark', 'shortlist', 'add ', 'αποθήκευσε', 'πρόσθεσε'])) &&
    includesAny(message, [
      'shortlist',
      'bookmark',
      'save to',
      'save them',
      'save her',
      'save him',
      'αποθήκευσε',
      'αποθηκευσε',
      'λίστα',
      'λιστα',
    ]);
  const wantsShortlistRemove = explicitRemove && namesTheList;

  // "Any connection requests?" and "do I have unread messages?" name the
  // area, and "connect" sits inside "connection": a question about the area
  // reads it, and only an explicit request to connect or to write proposes one.
  const explicitConnect = includesAny(message, [
    'connect with', 'connect me', 'send an intro', 'send intro', 'introduce me', 'send a connection', 'send connection',
    'σύνδεσέ με', 'συνδεσε με', 'στείλε αίτημα σύνδεσης', 'στειλε αιτημα συνδεσης', 'στείλε intro', 'στειλε intro',
  ]) || /^\s*(?:please\s+)?connect\b/.test(message);
  const explicitMessage = includesAny(message, [
    'send a message', 'send message', 'write to', 'chat with', 'dm ', 'στείλε μήνυμα', 'στειλε μηνυμα', 'γράψε στ', 'γραψε στ',
  ]) || /^\s*(?:please\s+)?message\s+\S/.test(message);
  const asksAboutConnections = areaReads.includes('get_connections') && !explicitConnect;
  const asksAboutMessages = areaReads.includes('get_messages') && !explicitMessage;

  // "intro" proposes one; "intros", the plural, is a list being asked about
  // ("the next action among intros, matches, messages").
  const wantsConnect =
    !asksAboutConnections &&
    !areaReads.includes('get_intros') &&
    !namesCanvasSurface(message) &&
    (Boolean(person) || opensWith(['connect', 'send an intro', 'send intro', 'send a connection', 'send connection', 'introduce me', 'σύνδεσέ με', 'στείλε αίτημα σύνδεσης', 'στείλε intro'])) &&
    (/\bintro(?!s\b)/.test(message) || includesAny(message, [
    'connect',
    'introduction',
    'σύνδεσε',
    'συνδεσε',
    'σύνδεση',
    'συνδεση',
    'στείλε intro',
    'στειλε intro',
  ]));

  // "dm" is a word of its own ("dm Elena"), never the letters inside "admin",
  // which proposed a message to someone on every question about admins.
  // A bare «γράψε» is "write" - an update, a reply, a card - and was proposing
  // a message beside each of them; writing to someone says to whom («γράψε
  // στην Έλενα») or what («γράψε μήνυμα»), as "message" does in English.
  const wantsMessage = !asksAboutMessages &&
    (Boolean(person) || opensWith(['message', 'send a message', 'send message', 'write to', 'dm ', 'chat with', 'στείλε μήνυμα', 'γράψε μήνυμα', 'γράψε στ'])) &&
    (includesAny(message, [
    'message',
    'chat with',
    'γράψε στ',
    'γραψε στ',
    'γράψε μήνυμα',
    'γραψε μηνυμα',
    'μήνυμα στ',
    'μηνυμα στ',
    'στείλε μήνυμα',
    'στειλε μηνυμα',
  ]) || /\bdms?\b/.test(message));

  // "Follow Elena", «ακολούθησε την Έλενα»: the verb and a person. "Follow
  // up" is another request, and "who I follow" is a question the updates
  // read answers.
  const wantsFollow =
    Boolean(person) &&
    includesAny(message, ['follow', 'ακολούθησε', 'ακολουθησε', 'ακολούθα', 'ακολουθα']) &&
    !includesAny(message, ['follow up', 'follow-up', 'unfollow', 'i follow', 'ακολουθώ', 'ακολουθω']);

  // Analytics, readiness and workspace intents. Each needs both an object and
  // a verb before it plans anything: "readiness" alone is a question about a
  // score, not a request to change one.
  const wantsPeriod =
    includesAny(message, ['analytic', 'metric', 'αναλυτικ', 'μετρήσ', 'μετρησ', 'στατιστικ']) &&
    detectAnalyticsPeriod(message) !== undefined;

  const wantsWorkspace = includesAny(message, [
    'create a workspace',
    'create workspace',
    'new workspace',
    'start a workspace',
    'set up a workspace',
    'δημιούργησε χώρο',
    'δημιουργησε χωρο',
    'νέο χώρο εργασίας',
    'νεο χωρο εργασιας',
    'φτιάξε χώρο',
    'φτιαξε χωρο',
  ]);

  // The criterion is named, or readiness is ticked: "what should I complete
  // next" about readiness is a question, and "mark" was matching inside
  // "go-to-market", so asking which expert review to request proposed a tick.
  const criterionVerbs = ['tick', 'check off', 'mark', 'complete', 'done', 'τσέκαρε', 'τσεκαρε', 'σημείωσε', 'σημειωσε', 'ολοκλήρωσ', 'ολοκληρωσ'];
  const wantsCriterion =
    (includesAny(message, ['criteri', 'κριτήρι', 'κριτηρι']) ||
      (includesAny(message, ['readiness', 'ετοιμότητ', 'ετοιμοτητ']) && includesWord(message, ['tick', 'check off', 'τσέκαρε', 'τσεκαρε']))) &&
    includesWord(message, criterionVerbs);

  if (wantsGraph) add('get_graph');

  if (wantsSearch) {
    const args: Record<string, string> = {};
    // A keyword search is a few words ("fintech", "React Thessaloniki"). More
    // left over means the message was a sentence about something else, and
    // the sentence as a query found nobody ("Discover returned nobody Suggest
    // filters prompt technical"); the role, place and stage filters remain.
    const words = searchQueryFromMessage(rawMessage);
    const q = words.split(' ').length <= 3 ? words : '';
    if (person) args.q = person;
    else if (q) args.q = q;
    if (location) args.location = location;
    if (includesAny(message, ['technical', 'τεχνικ', 'engineer', 'developer'])) {
      // «τεχνικό» is the same request as "technical": keep one of them.
      const words = (args.q ?? '').split(/\s+/).filter((w) => w && !fold(w).startsWith('τεχνικ') && w.toLowerCase() !== 'technical');
      args.q = [...words, 'technical'].join(' ');
    }
    add('search_people', withNaturalFilters(args, rawMessage));
  }

  if (wantsMatches) add('get_recommendations');

  if (wantsNotifications) add('get_notifications');

  // "Who could introduce me to Nikos" reads the paths to that person.
  for (const read of areaReads) add(read, (read === 'get_intros' || read === 'get_match_detail') && person ? { name: person } : read === 'get_legal_templates' ? { query: rawMessage.trim().slice(0, 120) } : {});

  if (wantsShortlistRemove) {
    const args: Record<string, string> = {};
    if (person) args.name = person;
    add('shortlist_remove', args);
  }

  if (wantsShortlist) {
    const args: Record<string, string> = {};
    if (person) args.name = person;
    if (person && !tools.some((t) => t.name === 'search_people')) {
      add('search_people', { q: person });
    }
    add('shortlist_add', args);
  }

  if (wantsFollow && person) {
    if (!tools.some((t) => t.name === 'search_people')) add('search_people', { q: person });
    add('follow_person', { name: person });
  }

  if (wantsConnect) {
    const args: Record<string, string> = {};
    if (person) args.name = person;
    add('send_connection', args);
    if (person && !tools.some((t) => t.name === 'search_people')) {
      add('search_people', { q: person });
    }
  }

  // "Draft a first message to Elena" wants the words, not just the thread:
  // the match read writes them from the reasons and hands back the card that
  // opens the thread with the draft in the composer (docs §108).
  const wantsFirstDraft = Boolean(person) && includesAny(message, [
    'first message', 'draft a message', 'draft message', 'draft me a message', 'write a message to', 'write a first',
    'πρώτο μήνυμα', 'πρωτο μηνυμα', 'σύνταξε μήνυμα', 'συνταξε μηνυμα', 'σύνταξε ένα μήνυμα', 'συνταξε ενα μηνυμα', 'προσχέδιο μηνύματος', 'προσχεδιο μηνυματος',
  ]);
  if (wantsFirstDraft && person && !tools.some((t) => t.name === 'get_match_detail')) add('get_match_detail', { name: person });

  if (wantsMessage && (person || !nav) && !wantsFirstDraft) {
    const args: Record<string, string> = {};
    if (person) args.name = person;
    add('start_or_send_message', args);
    if (person && !tools.some((t) => t.name === 'search_people')) {
      add('search_people', { q: person });
    }
  }

  if (wantsPeriod) {
    const period = detectAnalyticsPeriod(message);
    if (period) add('analytics_set_period', { period });
  }

  if (wantsWorkspace) {
    const name = detectQuotedName(rawMessage);
    add('workspace_create', name ? { name } : {});
  }

  if (wantsCriterion) {
    const dimension = detectReadinessDimension(message);
    // Without a criterion id there is nothing to write, and one cannot be
    // guessed from prose — the engine turns this into a question naming the
    // six dimensions rather than a half-formed write.
    add('readiness_tick_criterion', dimension ? { dimension } : {});
  }

  // Wave C writes. Each needs its verb and its noun, like the intents above,
  // and each replaces the read of the same area it would otherwise trigger:
  // "join the Athens Founders group" is not also a question about groups.
  // "join" as a word: "I have not joined any groups" is not a request.
  const joinVerb = includesWord(message, ['join']) || includesAny(message, ['μπες ', 'γίνε μέλος', 'γινε μελος', 'γράψε με', 'γραψε με']);
  const leaveVerb = includesAny(message, ['leave', 'exit', 'αποχώρησ', 'αποχωρησ', 'βγες από', 'βγες απο', 'βγάλε με από', 'βγαλε με απο']);
  const wantsJoinGroup = joinVerb && !leaveVerb && includesAny(message, GROUP_NOUNS);
  const wantsLeaveGroup = leaveVerb && includesAny(message, GROUP_NOUNS);
  const wantsApply =
    includesAny(message, ['apply', 'κάνε αίτηση', 'κανε αιτηση', 'κάνε μου αίτηση', 'υπέβαλε αίτηση', 'υποβαλε αιτηση']) &&
    includesAny(message, PROGRAM_NOUNS);
  const email = detectEmail(rawMessage);
  const wantsInvite = Boolean(email) && includesAny(message, ['invite', 'προσκάλεσε', 'προσκαλεσε', 'πρόσκληση', 'προσκληση']);
  const acceptVerb = includesAny(message, ['accept', 'αποδέξου', 'αποδεξου', 'δέξου', 'δεξου']);
  const declineVerb = includesAny(message, ['decline', 'reject', 'turn down', 'απόρριψε', 'απορριψε']);
  const wantsMentorAnswer = (acceptVerb || declineVerb) && includesAny(message, MENTOR_REQUEST_NOUNS);

  // "Which communities should I join?" and "which programme should I apply
  // to?" ask for advice: with nothing named they read the area instead.
  if (wantsJoinGroup || wantsLeaveGroup) {
    const groupName = detectGroupName(rawMessage);
    if (groupName || !asksQuestion) add(wantsLeaveGroup ? 'leave_group' : 'join_group', groupName ? { groupName } : {});
    else add('get_groups');
  }
  if (wantsApply) {
    const programTitle = detectProgramTitle(rawMessage);
    if (programTitle || !asksQuestion) add('apply_to_program', programTitle ? { programTitle } : {});
    else add('get_programs');
  }
  if (wantsInvite && email) add('send_invite', { email });
  if (wantsMentorAnswer) {
    const requesterName = detectRequesterName(rawMessage);
    add('respond_to_mentor_request', { decision: declineVerb ? 'decline' : 'accept', ...(requesterName ? { requesterName } : {}) });
  }
  // Wave D drafts: "draft a milestone …", «ετοίμασε εκδήλωση …». A draft only
  // opens a filled form, so it never competes with a write; it replaces the
  // read of its own area, as the writes above do.
  const draftVerb = includesAny(message, ['draft', 'prepare', 'fill in', 'fill out', 'ετοίμασε', 'ετοιμασε', 'ετοιμάσω', 'ετοιμασω', 'πρόχειρ', 'προχειρ', 'συμπλήρωσε', 'συμπληρωσε', 'σύνταξ', 'συνταξ', 'συντάξ']);
  const quoted = detectQuotedName(rawMessage);
  // A need card is asked for with "write" or "make" as often as "draft".
  const needCardNoun = includesAny(message, ['need card', 'need-card', 'κάρτα ανάγκης', 'καρτα αναγκης', 'κάρτας ανάγκης', 'καρτας αναγκης']);
  // "new" asks for one only when it is not a question: "Any new founder
  // updates?" reads the feed, "New founder update: September" drafts one.
  const needCardVerb =
    draftVerb ||
    includesAny(message, ['write', 'create', 'make', 'γράψε', 'γραψε', 'φτιάξε', 'φτιαξε', 'δημιούργησε', 'δημιουργησε']) ||
    (!asksQuestion && includesAny(message, ['new ', 'νέα ', 'νεα ']));
  // A founder update, like a need card, is asked for with "write" as often as "draft".
  const updateNoun = includesAny(message, ['founder update', 'investor update', 'update for my followers', 'ενημέρωση ιδρυτ', 'ενημερωση ιδρυτ', 'ενημέρωση επενδυτ', 'ενημερωση επενδυτ', 'ενημέρωση για τους ακολούθους', 'ενημερωση για τους ακολουθους']);
  const scoutNoun = includesAny(message, ['scout brief', 'brief for the scout', 'σημείωμα ανιχνευτ', 'σημειωμα ανιχνευτ']);
  // The listings other members search: a mentor's and a service provider's.
  // Checked before the personal profile, whose nouns ("headline") they share.
  const mentorListingNoun = includesAny(message, [
    'mentor listing', 'mentor profile', 'mentoring listing', 'mentoring profile',
    'καταχώριση μέντορα', 'καταχωριση μεντορα', 'καταχώρισή μου ως μέντορ', 'καταχωριση μου ως μεντορ', 'προφίλ μέντορα', 'προφιλ μεντορα',
  ]);
  const providerListingNoun = includesAny(message, [
    'provider listing', 'provider profile', 'service listing', 'services listing',
    'καταχώριση παρόχου', 'καταχωριση παροχου', 'προφίλ παρόχου', 'προφιλ παροχου', 'καταχώριση υπηρεσιών', 'καταχωριση υπηρεσιων',
    'καταχώριση υπηρεσίας', 'καταχωριση υπηρεσιας',
  ]);
  // A programme's application note, and a review asked of the reader (§111).
  // "Request a review" is the other side: it asks, it does not write one.
  const programApplicationNoun = includesAny(message, [
    'programme application', 'program application', 'application to', 'my application',
    'αίτηση στο πρόγραμμα', 'αιτηση στο προγραμμα', 'αίτηση για το πρόγραμμα', 'αιτηση για το προγραμμα',
    'αίτησή μου', 'αιτηση μου', 'αίτηση στο', 'αιτηση στο',
  ]);
  const reviewNoun = !includesAny(message, ['request a review', 'request review', 'ζήτα αξιολόγηση', 'ζητα αξιολογηση', 'αίτημα αξιολόγησης', 'αιτημα αξιολογησης'])
    && includesAny(message, [
      'review asked of me', 'asked of me', 'my review for', 'my review of', 'the review for', 'review i was asked',
      'αξιολόγηση που μου ζήτησ', 'αξιολογηση που μου ζητησ', 'αξιολόγηση για τ', 'αξιολογηση για τ', 'κριτική για τ', 'κριτικη για τ',
    ]);
  const draftKind = programApplicationNoun && draftVerb
    ? 'draft_program_application'
    : reviewNoun && needCardVerb
    ? 'draft_expert_review'
    : needCardNoun && needCardVerb
    ? 'draft_need_card'
    : scoutNoun && needCardVerb
    ? 'draft_scout_brief'
    : updateNoun && needCardVerb
    ? 'draft_founder_update'
    : mentorListingNoun && needCardVerb
    ? 'draft_mentor_listing'
    : providerListingNoun && needCardVerb
    ? 'draft_provider_listing'
    : !draftVerb
    ? null
    : includesAny(message, ['milestone', 'ορόσημ', 'οροσημ'])
      ? 'draft_milestone'
      : includesAny(message, ['event', 'meetup', 'webinar', 'workshop', 'εκδήλωσ', 'εκδηλωσ'])
        ? 'draft_event'
        : includesAny(message, ['project', 'πρότζεκτ', 'προτζεκτ', 'έργο ', 'εργο '])
          ? 'draft_project'
          : includesAny(message, ['headline', 'bio', 'my profile', 'τίτλο μου', 'τιτλο μου', 'βιογραφικ', 'προφίλ μου', 'προφιλ μου'])
            ? 'draft_profile'
            : null;
  if (draftKind === 'draft_program_application') {
    const programTitle = detectApplicationProgramTitle(rawMessage);
    add('draft_program_application', programTitle ? { programTitle } : {});
  }
  if (draftKind === 'draft_expert_review') {
    const asker = detectPersonName(rawMessage);
    add('draft_expert_review', asker ? { requesterName: asker } : {});
  }
  if (draftKind === 'draft_milestone') add('draft_milestone', quoted ? { title: quoted } : {});
  if (draftKind === 'draft_event') add('draft_event', quoted ? { title: quoted } : {});
  if (draftKind === 'draft_project') add('draft_project', quoted ? { name: quoted } : {});
  if (draftKind === 'draft_need_card') {
    const kind = includesAny(message, ['investor', 'angel', 'επενδυτ'])
      ? 'investor_intro'
      : includesAny(message, ['equity role', 'role with equity', 'ρόλο με equity', 'ρολο με equity'])
        ? 'equity_role'
        : 'cofounder';
    add('draft_need_card', { kind, ...(quoted ? { title: quoted } : {}) });
  }
  if (draftKind === 'draft_scout_brief') {
    add('draft_scout_brief', { role: quoted || (includesAny(message, ['technical', 'τεχνικ']) ? 'Technical co-founder' : 'Co-founder') });
  }
  if (draftKind === 'draft_founder_update') {
    const isPublic = includesAny(message, ['public', 'linkedin', 'δημόσι', 'δημοσι']);
    add('draft_founder_update', { ...(quoted ? { title: quoted } : {}), ...(isPublic ? { visibility: 'public' } : {}) });
  }
  if (draftKind === 'draft_mentor_listing') add('draft_mentor_listing', quoted ? { headline: quoted } : {});
  if (draftKind === 'draft_provider_listing') add('draft_provider_listing', quoted ? { headline: quoted } : {});
  if (draftKind === 'draft_profile') {
    const field = includesAny(message, ['bio', 'βιογραφικ']) ? 'bio' : 'headline';
    add('draft_profile', quoted ? { [field]: quoted } : {});
  }

  // The reader's own pages (docs §107): "pin messages", «ξεκαρφίτσωσε τα
  // μηνύματα». Unpin first: its Greek stem contains the pin stem.
  const wantsUnpin = includesWord(message, ['unpin', 'ξεκαρφιτσ']);
  const wantsPin = !wantsUnpin && includesWord(message, ['pin', 'καρφιτσωσ', 'καρφιτσωμα']);
  const pinTarget = wantsPin || wantsUnpin ? detectPinTarget(message) : undefined;
  if (pinTarget) add(wantsUnpin ? 'unpin_shortcut' : 'pin_shortcut', { href: pinTarget.href, label: pinTarget.label });

  // The look and the language, and a next step with an investor (docs §112).
  const theme = detectTheme(message);
  if (theme) add('set_theme', { theme });
  const language = detectLanguage(message);
  if (language) add('set_language', { language });
  const followUp = detectFollowUp(rawMessage);
  if (followUp) add('set_investor_followup', followUp);
  const investorEmail = detectInvestorEmail(rawMessage);
  if (investorEmail) add('draft_investor_email', investorEmail);
  const slideRewrite = detectSlideRewrite(rawMessage);
  if (slideRewrite) add('set_pitch_slide', slideRewrite);
  const builderWrite = slideRewrite ? undefined : detectBuilderWrite(rawMessage);
  if (builderWrite) add('set_builder_field', builderWrite);

  // How the assistant answers (docs §110): «απάντα πιο σύντομα», "no emoji".
  const replyStyle = detectReplyStyle(rawMessage);
  if (replyStyle) add('set_reply_style', replyStyle);

  // Notifications from the conversation (docs §111): "mark the rest read",
  // «σταμάτα τα email για εκδηλώσεις», "weekly digest".
  const triage = wantsTriage(rawMessage);
  if (triage) add('triage_notifications', {});
  const notificationPref = triage ? undefined : detectNotificationPref(rawMessage);
  if (notificationPref) add('set_notification_pref', notificationPref);

  const replacedReads = new Set<string>([
    ...(pinTarget ? ['get_usage_insights'] : []),
    ...(triage || notificationPref ? ['get_notifications'] : []),
    ...(draftKind === 'draft_milestone' ? ['get_milestones'] : []),
    ...(draftKind === 'draft_event' ? ['get_events'] : []),
    ...(draftKind === 'draft_profile' ? ['get_profile'] : []),
    ...(draftKind === 'draft_need_card' ? ['get_commitments'] : []),
    ...(draftKind === 'draft_founder_update' ? ['get_founder_updates'] : []),
    ...(draftKind === 'draft_scout_brief' ? ['get_scout'] : []),
    // "mentor", "founders", "seed" in a listing's headline are its words, not a search.
    ...(draftKind === 'draft_mentor_listing' || draftKind === 'draft_provider_listing' ? ['search_people'] : []),
    ...(wantsJoinGroup || wantsLeaveGroup ? ['get_groups'] : []),
    ...(wantsApply ? ['get_programs', 'get_my_programs'] : []),
    ...(wantsInvite ? ['get_invites'] : []),
    ...(wantsMentorAnswer ? ['get_mentor_requests', 'get_mentorship_sessions'] : []),
  ]);
  for (let i = tools.length - 1; i >= 0; i--) if (replacedReads.has(tools[i].name)) tools.splice(i, 1);

  const canvasArgs = planCanvasCommandArgs(rawMessage);
  if (canvasArgs?.op) add('canvas_command', canvasArgs);

  if (nav && !pinTarget && !tools.some((t) => t.name === 'canvas_command')) add('navigate', { href: nav.href, label: nav.label });

  if (tools.length === 0) {
    const natural = readNaturalSearch(rawMessage);
    // "ψάχνω συνιδρυτή SaaS στην Αθήνα" names who, not a verb the intents know.
    const describesPeople = natural.roles.length > 0 && natural.understood.length > 1;
    if (person || location || describesPeople) add('search_people', withNaturalFilters({ ...(person ? { q: person } : {}), ...(location ? { location } : {}) }, rawMessage));
    else add('get_graph');
  }

  // The workspace summary leads short turns because it is usually the context a
  // vague question needs. A question about one area is not vague, and leading
  // "what events are coming up" with unread-message counts buries the answer.
  if (!tools.some((t) => t.name === 'get_graph') && tools.length <= 2 && areaReads.length === 0 && !tools.some((t) => t.name === 'canvas_command')) {
    tools.unshift({ name: 'get_graph', args: {} });
  }

  return tools.slice(0, 4);
}
