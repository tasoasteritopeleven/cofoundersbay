import { readNaturalSearch } from '@cofounderbay/shared';
import { resolveRouteTarget } from '@/lib/action-registry';
import { namesCanvasSurface, planCanvasCommandArgs } from '@/lib/canvas/plan-canvas-command';
import type { AreaReadId } from './copilot-reads';
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
  { keys: ['my profile', 'my bio', 'my headline', 'το προφιλ μου', 'προφιλ μου'], tool: 'get_profile' },
  {
    keys: ['message', 'inbox', 'unread', 'conversation', 'συνομιλι', 'μηνυματ', 'αδιαβαστ'],
    tool: 'get_messages',
  },
  {
    keys: ['connection', 'my network', 'intro request', 'συνδεσ', 'αιτημα συνδεσ', 'δικτυο μου'],
    tool: 'get_connections',
  },
  { keys: ['event', 'meetup', 'webinar', 'workshop', 'demo day', 'εκδηλωσ'], tool: 'get_events' },
  { keys: ['milestone', 'overdue', 'οροσημ', 'εκπροθεσμ'], tool: 'get_milestones' },
  { keys: ['job', 'open role', 'hiring', 'θεσεις εργασιας', 'αγγελι', 'προσληψ'], tool: 'get_jobs' },
  { keys: ['group', 'communit*', 'κοινοτητ'], tool: 'get_groups' },
  // The Endorsements page is «Συστάσεις», so that is the word a Greek reader
  // asks with; «προσυπογραφή» is kept for anyone who learnt the older term.
  { keys: ['endorse*', 'προσυπογραφ', 'συστασ'], tool: 'get_endorsements' },
  { keys: ['opportunit*', 'gig', 'paid gig', 'ευκαιρι'], tool: 'get_opportunities' },
  // Need cards and the ladder: «δεσμεύσεις» is the area's Greek name.
  { keys: ['commitment*', 'need card*', 'my needs', 'δεσμευσ', 'καρτα αναγκ', 'καρτες αναγκ', 'καρτων αναγκ'], tool: 'get_commitments' },
  // Warm introductions. «Συστάσεις» alone is endorsements here, so the Greek
  // keys carry «γνωριμ»; "introduce me" alone is a connection request.
  {
    keys: ['introductions', 'warm intro*', 'my intros', 'who could introduce', 'who can introduce', 'συστασεις γνωριμιας', 'συσταση γνωριμιας', 'ζεστη συσταση', 'ζεστες συστασεις', 'να με συστησει'],
    tool: 'get_intros',
  },
  // The co-founder scout («ανιχνευτής συνιδρυτών»).
  { keys: ['co-founder scout', 'cofounder scout', 'my scout', 'the scout', 'ανιχνευτ'], tool: 'get_scout' },
  // Skills and the work that shows them.
  { keys: ['skill evidence', 'evidence for my skill*', 'backs my skill*', 'evidence behind my skill*', 'τεκμηρια', 'τεκμηριο'], tool: 'get_skill_evidence' },
  // Founder updates: named as the kind of update, or by who wrote them.
  {
    keys: ['founder update*', 'investor update*', 'updates from', 'people i follow', 'ενημερωσεις ιδρυτ', 'ενημερωση ιδρυτ', 'ενημερωσεις απο', 'οσους ακολουθω'],
    tool: 'get_founder_updates',
  },
  { keys: ['session', 'συνεδρι'], tool: 'get_mentorship_sessions' },
  {
    keys: ['saved profile', 'my shortlist', 'αποθηκευμενα προφιλ', 'αποθηκευμενους'],
    tool: 'get_shortlist',
  },
  { keys: ['research board', 'πινακες ερευνας', 'πινακα ερευνας'], tool: 'get_research_boards' },
  {
    keys: ['my workspace', 'my workspaces', 'startup builder', 'builder workspace', 'χωρους εργασιας', 'χωρο εργασιας', 'χωροι εργασιας'],
    tool: 'get_builder_state',
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
  { keys: ['readiness score', 'my readiness', 'how ready', 'investor ready', 'ετοιμοτητα'], tool: 'get_readiness' },
  {
    keys: ['profile view*', 'my analytics', 'my stats', 'my statistics', 'my activity', 'προβολες', 'στατιστικα μου', 'αναλυτικα μου', 'δραστηριοτητα μου'],
    tool: 'get_analytics',
  },
  {
    keys: ['mentor directory', 'available mentor*', 'which mentors', 'mentors taking', 'mentors available', 'καταλογο μεντορων', 'καταλογος μεντορων', 'διαθεσιμοι μεντορες', 'ποιοι μεντορες'],
    tool: 'get_mentors',
  },
  {
    keys: ['mentoring request*', 'mentorship request*', 'mentor request*', 'αιτηματα mentoring', 'αιτημα mentoring', 'αιτηματα καθοδηγησ'],
    tool: 'get_mentor_requests',
  },
  { keys: ['booking*', 'booked', 'κρατησ', 'κλεισμεν'], tool: 'get_bookings' },
  {
    keys: ['my availability', 'my hours', 'weekly hours', 'bookable', 'διαθεσιμοτητα μου', 'ωρες μου', 'εβδομαδιαιες ωρες'],
    tool: 'get_availability',
  },
  { keys: ['my service*', 'service offer*', 'my offer*', 'υπηρεσιες μου', 'προσφορες μου'], tool: 'get_services' },
  { keys: ['inquir*', 'enquir*', 'αιτηματα πελατ', 'ερωτηματα πελατ'], tool: 'get_inquiries' },
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
    keys: ['moderation queue', 'open report*', 'pending report*', 'reported user*', 'ουρα ελεγχου', 'αναφορες σε αναμονη', 'ανοιχτες αναφορες'],
    tool: 'get_moderation_queue',
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

function searchQueryFromMessage(message: string): string {
  const stripped = message
    .replace(/\b(find|search|look for|show me|βρες|βρες μου|ψάξε|δείξε|co-?founders?|technical|business|mentor|investor|στην|στον|στη|the|a|an|μου|να)\b/gi, ' ')
    .replace(/[?!.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.slice(0, 80);
}

/**
 * Rule-based planner used when the LLM has no tools (preview, Ollama down).
 * Returns 1–3 tools; never proposes destructive admin actions.
 */
export function planCopilotTools(rawMessage: string): PlannedTool[] {
  const message = rawMessage.trim().toLowerCase();
  if (!message) return [{ name: 'get_graph', args: {} }];

  const tools: PlannedTool[] = [];
  const add = (name: CopilotToolName, args: Record<string, string> = {}) => {
    if (!tools.some((t) => t.name === name && JSON.stringify(t.args) === JSON.stringify(args))) {
      tools.push({ name, args });
    }
  };

  const location = detectLocation(message);
  const person = detectPersonName(message);
  const nav = detectNavigateHref(message);

  // Area reads are decided first, because two of the older intents need to
  // know about them. "My upcoming mentoring sessions" contains "mentor", which
  // plans a people search; "who is on my shortlist" contains "shortlist", which
  // plans a save. Neither asked for that. Each older intent still fires when its
  // own verb is there — "find a mentor", "save Elena to my shortlist".
  const areaReads = !nav || includesAny(message, QUESTION_PHRASES) ? detectAreaReads(message) : [];
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

  const wantsSearch = !(areaReads.length > 0 && !explicitSearch) && includesAny(message, [
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
  ]);

  const wantsMatches = includesAny(message, [
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

  const wantsConnect =
    !asksAboutConnections &&
    !areaReads.includes('get_intros') &&
    !namesCanvasSurface(message) &&
    includesAny(message, [
    'connect',
    'intro',
    'introduction',
    'σύνδεσε',
    'συνδεσε',
    'σύνδεση',
    'συνδεση',
    'στείλε intro',
    'στειλε intro',
  ]);

  const wantsMessage = !asksAboutMessages && includesAny(message, [
    'message',
    'dm',
    'chat with',
    'γράψε',
    'γραψε',
    'στείλε μήνυμα',
    'στειλε μηνυμα',
  ]);

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

  const wantsCriterion =
    includesAny(message, ['readiness', 'criteri', 'ετοιμότητ', 'ετοιμοτητ', 'κριτήρι', 'κριτηρι']) &&
    includesAny(message, [
      'tick',
      'check off',
      'mark',
      'complete',
      'done',
      'τσέκαρε',
      'τσεκαρε',
      'σημείωσε',
      'σημειωσε',
      'ολοκλήρωσ',
      'ολοκληρωσ',
    ]);

  if (wantsGraph) add('get_graph');

  if (wantsSearch) {
    const args: Record<string, string> = {};
    const q = searchQueryFromMessage(rawMessage);
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
  for (const read of areaReads) add(read, read === 'get_intros' && person ? { name: person } : {});

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

  if (wantsMessage && (person || !nav)) {
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
  const joinVerb = includesAny(message, ['join', 'μπες ', 'γίνε μέλος', 'γινε μελος', 'γράψε με', 'γραψε με']);
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

  if (wantsJoinGroup || wantsLeaveGroup) {
    const groupName = detectGroupName(rawMessage);
    add(wantsLeaveGroup ? 'leave_group' : 'join_group', groupName ? { groupName } : {});
  }
  if (wantsApply) {
    const programTitle = detectProgramTitle(rawMessage);
    add('apply_to_program', programTitle ? { programTitle } : {});
  }
  if (wantsInvite && email) add('send_invite', { email });
  if (wantsMentorAnswer) {
    const requesterName = detectRequesterName(rawMessage);
    add('respond_to_mentor_request', { decision: declineVerb ? 'decline' : 'accept', ...(requesterName ? { requesterName } : {}) });
  }
  // Wave D drafts: "draft a milestone …", «ετοίμασε εκδήλωση …». A draft only
  // opens a filled form, so it never competes with a write; it replaces the
  // read of its own area, as the writes above do.
  const draftVerb = includesAny(message, ['draft', 'prepare', 'fill in', 'fill out', 'ετοίμασε', 'ετοιμασε', 'πρόχειρ', 'προχειρ', 'συμπλήρωσε', 'συμπληρωσε']);
  const quoted = detectQuotedName(rawMessage);
  // A need card is asked for with "write" or "make" as often as "draft".
  const needCardNoun = includesAny(message, ['need card', 'need-card', 'κάρτα ανάγκης', 'καρτα αναγκης', 'κάρτας ανάγκης', 'καρτας αναγκης']);
  // "new" asks for one only when it is not a question: "Any new founder
  // updates?" reads the feed, "New founder update: September" drafts one.
  const asksQuestion = /[?;\u037e]\s*$/.test(rawMessage.trim());
  const needCardVerb =
    draftVerb ||
    includesAny(message, ['write', 'create', 'make', 'γράψε', 'γραψε', 'φτιάξε', 'φτιαξε', 'δημιούργησε', 'δημιουργησε']) ||
    (!asksQuestion && includesAny(message, ['new ', 'νέα ', 'νεα ']));
  // A founder update, like a need card, is asked for with "write" as often as "draft".
  const updateNoun = includesAny(message, ['founder update', 'investor update', 'update for my followers', 'ενημέρωση ιδρυτ', 'ενημερωση ιδρυτ', 'ενημέρωση για τους ακολούθους', 'ενημερωση για τους ακολουθους']);
  const scoutNoun = includesAny(message, ['scout brief', 'brief for the scout', 'σημείωμα ανιχνευτ', 'σημειωμα ανιχνευτ']);
  const draftKind = needCardNoun && needCardVerb
    ? 'draft_need_card'
    : scoutNoun && needCardVerb
    ? 'draft_scout_brief'
    : updateNoun && needCardVerb
    ? 'draft_founder_update'
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
  if (draftKind === 'draft_profile') {
    const field = includesAny(message, ['bio', 'βιογραφικ']) ? 'bio' : 'headline';
    add('draft_profile', quoted ? { [field]: quoted } : {});
  }

  const replacedReads = new Set<string>([
    ...(draftKind === 'draft_milestone' ? ['get_milestones'] : []),
    ...(draftKind === 'draft_event' ? ['get_events'] : []),
    ...(draftKind === 'draft_profile' ? ['get_profile'] : []),
    ...(draftKind === 'draft_need_card' ? ['get_commitments'] : []),
    ...(draftKind === 'draft_founder_update' ? ['get_founder_updates'] : []),
    ...(draftKind === 'draft_scout_brief' ? ['get_scout'] : []),
    ...(wantsJoinGroup || wantsLeaveGroup ? ['get_groups'] : []),
    ...(wantsApply ? ['get_programs', 'get_my_programs'] : []),
    ...(wantsInvite ? ['get_invites'] : []),
    ...(wantsMentorAnswer ? ['get_mentor_requests', 'get_mentorship_sessions'] : []),
  ]);
  for (let i = tools.length - 1; i >= 0; i--) if (replacedReads.has(tools[i].name)) tools.splice(i, 1);

  const canvasArgs = planCanvasCommandArgs(rawMessage);
  if (canvasArgs?.op) add('canvas_command', canvasArgs);

  if (nav && !tools.some((t) => t.name === 'canvas_command')) add('navigate', { href: nav.href, label: nav.label });

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
