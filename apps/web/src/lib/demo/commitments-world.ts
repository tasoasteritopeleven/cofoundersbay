import {
  acceptsInterest,
  assessNeedCard,
  canReviseTerms,
  cardOfferChanges,
  contactKinds,
  deriveCardOutcome,
  describeContactKinds,
  hasPromiseClaims,
  INTEREST_BUDGET,
  INTEREST_BUDGET_COPY,
  interestBudgetLeft,
  isCommitmentKind,
  NEED_CARD_LIMITS,
  termsChanges,
  validateTerms,
  type CommitmentOutcome,
  type CommitmentStep,
  type NeedCardInput,
  type TermsFields,
  LADDER_TERMS_METHODS,
  VERIFICATION_REQUIRED_COPY,
  ROLE_VERIFICATION_COPY,
  ROLE_VERIFICATION_METHODS,
  type TransparencySurface,
  foldSearchText,
  placeVariants,
} from '@cofounderbay/shared';
import { DemoRefusal } from './demo-refusal';
import { recordDemoRefusal } from './transparency-world';
import { demoMeVerified, demoPersonMethods, demoRoleCleared } from './verification-world';

export { DemoRefusal };

/**
 * The preview demo's commitments: the same ladder as the API, in the browser.
 *
 * The cast is the demo world's own (Elena and Harbor, Alex Demo's Athens
 * programme, the founders of Meltemi, Aegis Health, Orion Grid and Kolo
 * Labs), so a need card here is the Harbor project's need, not a stranger's.
 * Every rule is the shared one the server applies - the posting guide's
 * checks, the contact filter, terms versioning and the freeze - so the demo
 * refuses what production refuses, with the same bilingual reason.
 *
 * State lives in sessionStorage so a ladder walked across pages survives a
 * reload in the same tab; a new tab starts from the seed. Seeds carry ages
 * (days before now), never fixed dates.
 */

const ME = 'preview-demo-user';
const STORAGE_KEY = 'cfb:demo-commitments:v1';
const DAY = 86_400_000;

type Person = { displayName: string; headline: string | null; role: string };

const PEOPLE: Record<string, Person> = {
  [ME]: { displayName: 'Alex Demo', headline: 'Founder · Athens founder networks', role: 'founder' },
  'user-elena': { displayName: 'Elena Papadopoulos', headline: 'Founder & CEO at Harbor', role: 'founder' },
  'user-marcus': { displayName: 'Marcus Chen', headline: 'Technical cofounder · Full-stack', role: 'cofounder' },
  'user-sofia': { displayName: 'Sofia Alexiou', headline: 'Founder at Meltemi', role: 'founder' },
  'user-giorgos': { displayName: 'Giorgos Vlachos', headline: 'Founder at Agora B2B', role: 'founder' },
  'user-christina': { displayName: 'Christina Mavrou', headline: 'Founder at Aegis Health', role: 'founder' },
  'user-dimitris': { displayName: 'Dimitris Kostas', headline: 'Founder at Orion Grid', role: 'founder' },
  'user-yannis': { displayName: 'Yannis Petrou', headline: 'Founder at Kolo Labs', role: 'founder' },
  'user-katerina': { displayName: 'Katerina Nikolaou', headline: 'Founder at Ledgerly', role: 'founder' },
};

type Card = {
  id: string;
  ownerId: string;
  kind: NeedCardInput['kind'];
  title: string;
  exists: string;
  goal: string;
  missing: string;
  offerRole: string;
  offerEquity: string | null;
  offerHours: number;
  offerScope: string;
  category: string;
  place: string | null;
  isRemote: boolean;
  stage: string;
  commitment: string;
  projectRef: string | null;
  evidence: Array<{ id: string; count?: number; value?: boolean }>;
  version: number;
  history: unknown[];
  status: CommitmentOutcome;
  closedReason: string | null;
  settledAt: string | null;
  expiresAt: string | null;
  shareToken: string | null;
  createdAt: string;
  updatedAt: string;
};

type Thread = {
  id: string;
  cardId: string;
  candidateId: string;
  step: CommitmentStep;
  note: string | null;
  cardVersion: number;
  ownerConfirmedAt: string | null;
  candidateConfirmedAt: string | null;
  revisions: number;
  dealRoomActive: boolean;
  agreedAt: string | null;
  closedById: string | null;
  closedReason: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Message = { id: string; threadId: string; authorId: string; body: string; createdAt: string };

type Terms = TermsFields & {
  id: string;
  threadId: string;
  version: number;
  proposedById: string;
  note: string | null;
  ownerAcceptedAt: string | null;
  candidateAcceptedAt: string | null;
  createdAt: string;
};

type World = { cards: Card[]; threads: Thread[]; messages: Message[]; terms: Terms[] };

/** The API's gate on terms: the reader must be verified (see `verification-world`). */
function requireDemoVerified() {
  if (demoMeVerified()) return;
  throw new DemoRefusal(400, VERIFICATION_REQUIRED_COPY.en, { reason: 'verification_required', messageEl: VERIFICATION_REQUIRED_COPY.el, methods: [...LADDER_TERMS_METHODS] });
}

function seed(now: number): World {
  const ago = (days: number, hours = 0) => new Date(now - days * DAY - hours * 3_600_000).toISOString();
  const ahead = (days: number) => new Date(now + days * DAY).toISOString();
  const card = (c: Partial<Card> & Pick<Card, 'id' | 'ownerId' | 'kind' | 'title' | 'exists' | 'goal' | 'missing' | 'offerRole' | 'offerHours' | 'offerScope' | 'category' | 'stage' | 'commitment'>): Card => ({
    offerEquity: null,
    place: null,
    isRemote: false,
    projectRef: null,
    evidence: [],
    version: 1,
    history: [],
    status: 'open',
    closedReason: null,
    settledAt: null,
    expiresAt: ahead(60),
    shareToken: null,
    createdAt: ago(20),
    updatedAt: ago(2),
    ...c,
  });
  const thread = (t: Partial<Thread> & Pick<Thread, 'id' | 'cardId' | 'candidateId' | 'step'>): Thread => ({
    note: null,
    cardVersion: 1,
    ownerConfirmedAt: null,
    candidateConfirmedAt: null,
    revisions: 0,
    dealRoomActive: false,
    agreedAt: null,
    closedById: null,
    closedReason: null,
    closedAt: null,
    createdAt: ago(10),
    updatedAt: ago(1),
    ...t,
  });

  const cards: Card[] = [
    card({
      id: 'need-harbor',
      ownerId: 'user-elena',
      kind: 'cofounder',
      title: 'Commercial co-founder for Harbor',
      exists: 'Harbor runs a working founder workspace (graph, readiness, builder) with $375K of a $750K seed committed.',
      goal: 'Reach twenty paying founder teams in Athens and close the seed by spring.',
      missing: 'A commercial co-founder who has sold software to founders, studios or programmes.',
      offerRole: 'Co-founder, commercial',
      offerEquity: '8–12%',
      offerHours: 40,
      offerScope: 'Own sales, partnerships with programmes and the first commercial hire.',
      category: 'B2B SaaS',
      place: 'Athens, Greece',
      stage: 'building',
      commitment: 'full_time',
      projectRef: '1',
      evidence: [{ id: 'milestones_completed', count: 2 }, { id: 'builder_documents', count: 2 }, { id: 'endorsements', count: 3 }, { id: 'email_verified', value: true }],
      version: 2,
      history: [{ version: 1, at: ago(9), changed: ['offerEquity'], offer: { role: 'Co-founder, commercial', equity: '6–10%', hoursPerWeek: 40, scope: 'Own sales, partnerships with programmes and the first commercial hire.', commitment: 'full_time' } }],
      status: 'in_discussion',
      shareToken: 'harbor-commercial-demo',
      createdAt: ago(24),
      updatedAt: ago(1),
    }),
    card({
      id: 'need-athens-intros',
      ownerId: ME,
      kind: 'cofounder',
      title: 'Community co-founder for an Athens founder-intro programme',
      exists: 'A mapped list of 40 Athens founder communities and two warm-intro paths already tested.',
      goal: 'Run a weekly founder-intro programme in Athens with partner communities by spring.',
      missing: 'A community-minded co-founder who has run events or a founder programme before.',
      offerRole: 'Co-founder, community and partnerships',
      offerEquity: '5–10%',
      offerHours: 20,
      offerScope: 'Run the weekly intros and own relationships with partner communities.',
      category: 'Community',
      place: 'Athens, Greece',
      stage: 'idea',
      commitment: 'part_time',
      projectRef: '3',
      evidence: [{ id: 'milestones_completed', count: 1 }, { id: 'email_verified', value: true }],
      status: 'in_discussion',
      createdAt: ago(14),
      updatedAt: ago(0, 5),
    }),
    card({
      id: 'need-aegis-growth',
      ownerId: 'user-christina',
      kind: 'equity_role',
      title: 'Head of growth for Aegis Health',
      exists: 'Aegis Health has a clinic-scheduling pilot live in four private clinics in Thessaloniki.',
      goal: 'Grow to forty clinics across northern Greece within the next twelve months.',
      missing: 'A growth lead who has sold into clinics or other regulated small businesses.',
      offerRole: 'Head of growth',
      offerEquity: '1–2%',
      offerHours: 30,
      offerScope: 'Own clinic acquisition, onboarding and the referral programme.',
      category: 'HealthTech',
      place: 'Thessaloniki, Greece',
      stage: 'validating',
      commitment: 'part_time',
      evidence: [{ id: 'milestones_completed', count: 4 }, { id: 'email_verified', value: true }],
      createdAt: ago(6),
      updatedAt: ago(6),
    }),
    card({
      id: 'need-orion-angel',
      ownerId: 'user-dimitris',
      kind: 'investor_intro',
      title: 'Angel with grid-operator experience for Orion Grid',
      exists: 'Orion Grid forecasts rooftop-solar output for two Greek distribution partners in a paid pilot.',
      goal: 'Close a €500K pre-seed to hire two engineers and add three utility pilots.',
      missing: 'An angel investor who knows grid operators and can open one introduction.',
      offerRole: 'Lead angel or advisor',
      offerEquity: 'Pre-seed via SAFE',
      offerHours: 2,
      offerScope: 'Join a monthly call and open one utility introduction per quarter.',
      category: 'CleanTech',
      isRemote: true,
      stage: 'building',
      commitment: 'advisory',
      evidence: [{ id: 'builder_documents', count: 3 }, { id: 'email_verified', value: true }],
      createdAt: ago(4),
      updatedAt: ago(4),
    }),
    card({
      id: 'need-kolo-cto',
      ownerId: 'user-yannis',
      kind: 'cofounder',
      title: 'Technical co-founder for Kolo Labs',
      exists: 'Kolo Labs has a paid prototype for neighbourhood logistics used by two Athens couriers.',
      goal: 'Turn the prototype into a product three courier firms pay for monthly.',
      missing: 'A technical co-founder comfortable with route optimisation and mobile apps.',
      offerRole: 'CTO and co-founder',
      offerEquity: '15–20%',
      offerHours: 40,
      offerScope: 'Own the product, the routing engine and the first engineering hire.',
      category: 'Logistics',
      place: 'Athens, Greece',
      stage: 'validating',
      commitment: 'full_time',
      status: 'closed',
      closedReason: 'filled',
      settledAt: ago(12),
      createdAt: ago(50),
      updatedAt: ago(12),
    }),
    card({
      id: 'need-readiness-designer',
      ownerId: ME,
      kind: 'equity_role',
      title: 'Part-time product designer for the readiness score',
      exists: 'A readiness score with six dimensions that thirty founders used in a closed beta.',
      goal: 'Make the score readable in one screen for a founder and an investor alike.',
      missing: 'A product designer who has designed dashboards people read under time pressure.',
      offerRole: 'Product designer',
      offerEquity: '0.5–1%',
      offerHours: 12,
      offerScope: 'Design the score screen, the investor view and the weekly digest.',
      category: 'B2B SaaS',
      isRemote: true,
      stage: 'building',
      commitment: 'part_time',
      status: 'agreed',
      settledAt: ago(45),
      createdAt: ago(80),
      updatedAt: ago(45),
    }),
  ];

  const threads: Thread[] = [
    thread({
      id: 'thr-harbor-alex',
      cardId: 'need-harbor',
      candidateId: ME,
      step: 'terms',
      note: 'I have sold to founder programmes for four years and would like to talk about the commercial seat.',
      cardVersion: 1,
      ownerConfirmedAt: ago(5),
      candidateConfirmedAt: ago(5, 3),
      revisions: 1,
      createdAt: ago(9),
      updatedAt: ago(1),
    }),
    thread({ id: 'thr-harbor-marcus', cardId: 'need-harbor', candidateId: 'user-marcus', step: 'conversation', createdAt: ago(7), updatedAt: ago(3) }),
    thread({
      id: 'thr-intros-sofia',
      cardId: 'need-athens-intros',
      candidateId: 'user-sofia',
      step: 'interest',
      note: 'I ran Athens founder breakfasts for two years and would love to compare notes.',
      createdAt: ago(1),
      updatedAt: ago(1),
    }),
    thread({
      id: 'thr-intros-giorgos',
      cardId: 'need-athens-intros',
      candidateId: 'user-giorgos',
      step: 'conversation',
      note: 'Agora B2B hosts a monthly founders evening; this could plug into it.',
      // Giorgos has confirmed. Confirmations are blind, so the demo user does
      // not see this until they confirm too - and then the terms space opens.
      candidateConfirmedAt: ago(0, 20),
      createdAt: ago(6),
      updatedAt: ago(0, 5),
    }),
    thread({
      id: 'thr-kolo-alex',
      cardId: 'need-kolo-cto',
      candidateId: ME,
      step: 'closed',
      note: 'Interested in the routing side.',
      closedById: ME,
      closedReason: 'Timing did not work for me this quarter.',
      closedAt: ago(14),
      createdAt: ago(30),
      updatedAt: ago(14),
    }),
    thread({
      id: 'thr-designer-katerina',
      cardId: 'need-readiness-designer',
      candidateId: 'user-katerina',
      step: 'agreed',
      ownerConfirmedAt: ago(52),
      candidateConfirmedAt: ago(52),
      dealRoomActive: true,
      agreedAt: ago(45),
      createdAt: ago(70),
      updatedAt: ago(45),
    }),
  ];

  const messages: Message[] = [
    { id: 'msg-h1', threadId: 'thr-harbor-alex', authorId: 'user-elena', body: 'Thanks for answering. Which programmes have you sold to, and what did a typical deal look like?', createdAt: ago(8) },
    { id: 'msg-h2', threadId: 'thr-harbor-alex', authorId: ME, body: 'Two accelerators and a university incubator: annual licences, signed by the programme director after a six-week pilot.', createdAt: ago(8, -2) },
    { id: 'msg-h3', threadId: 'thr-harbor-alex', authorId: 'user-elena', body: 'That is exactly the motion we need. Shall we both confirm and move to terms?', createdAt: ago(6) },
    { id: 'msg-h4', threadId: 'thr-harbor-alex', authorId: ME, body: 'Yes. I will confirm now.', createdAt: ago(5, 4) },
    { id: 'msg-g1', threadId: 'thr-intros-giorgos', authorId: ME, body: 'Your founders evening sounds like the right first partner. How many founders come each month?', createdAt: ago(5) },
    { id: 'msg-g2', threadId: 'thr-intros-giorgos', authorId: 'user-giorgos', body: 'Between thirty and forty, mostly B2B. Half of them ask for intros we cannot make today.', createdAt: ago(4) },
    { id: 'msg-g3', threadId: 'thr-intros-giorgos', authorId: 'user-giorgos', body: 'I am in if the hours stay around twenty a week.', createdAt: ago(0, 21) },
  ];

  const terms: Terms[] = [
    {
      id: 'terms-h1',
      threadId: 'thr-harbor-alex',
      version: 1,
      proposedById: 'user-elena',
      role: 'Co-founder, commercial',
      equityPct: 8,
      vestingMonths: 48,
      cliffMonths: 12,
      hoursPerWeek: 40,
      scope: 'Sales, programme partnerships and the first commercial hire.',
      note: 'Standard four-year vesting with a one-year cliff.',
      ownerAcceptedAt: ago(4),
      candidateAcceptedAt: null,
      createdAt: ago(4),
    },
    {
      id: 'terms-h2',
      threadId: 'thr-harbor-alex',
      version: 2,
      proposedById: ME,
      role: 'Co-founder, commercial',
      equityPct: 10,
      vestingMonths: 48,
      cliffMonths: 12,
      hoursPerWeek: 40,
      scope: 'Sales, programme partnerships and the first commercial hire.',
      note: 'Ten percent reflects leading the seed conversations as well.',
      ownerAcceptedAt: null,
      candidateAcceptedAt: ago(1),
      createdAt: ago(1),
    },
    {
      id: 'terms-d1',
      threadId: 'thr-designer-katerina',
      version: 1,
      proposedById: ME,
      role: 'Product designer',
      equityPct: 0.75,
      vestingMonths: 24,
      cliffMonths: 6,
      hoursPerWeek: 12,
      scope: 'Score screen, investor view and the weekly digest.',
      note: null,
      ownerAcceptedAt: ago(46),
      candidateAcceptedAt: ago(45),
      createdAt: ago(46),
    },
  ];

  return { cards, threads, messages, terms };
}

/**
 * Who the demo founder is. As an aspiring founder (`cfb_primary_role`, the
 * role switcher's "Aspiring Founder") they have posted no card yet, so the
 * founder dashboard opens on its first move; otherwise they have the two
 * seeded cards and the threads on them. Each persona keeps its own world, so
 * a card posted as one stays there and switching never mixes the two.
 */
type Persona = 'founder' | 'starting';

function persona(): Persona {
  try {
    return typeof document !== 'undefined' && /(?:^|;\s*)cfb_primary_role=aspiring_founder(?:;|$)/.test(document.cookie) ? 'starting' : 'founder';
  } catch {
    return 'founder';
  }
}

const storageKeyOf = (p: Persona) => (p === 'starting' ? `${STORAGE_KEY}:starting` : STORAGE_KEY);

/** The seed as an aspiring founder meets it: other people's cards, none of one's own. */
function withoutOwnCards(world: World): World {
  const own = new Set(world.cards.filter((c) => c.ownerId === ME).map((c) => c.id));
  const threads = world.threads.filter((t) => !own.has(t.cardId));
  const kept = new Set(threads.map((t) => t.id));
  return {
    cards: world.cards.filter((c) => !own.has(c.id)),
    threads,
    messages: world.messages.filter((m) => kept.has(m.threadId)),
    terms: world.terms.filter((t) => kept.has(t.threadId)),
  };
}

const memory: Record<Persona, World | null> = { founder: null, starting: null };

function load(now: number): World {
  const p = persona();
  const held = memory[p];
  if (held) return held;
  try {
    const raw = typeof window !== 'undefined' ? window.sessionStorage.getItem(storageKeyOf(p)) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as World;
      if (Array.isArray(parsed?.cards) && Array.isArray(parsed?.threads)) {
        memory[p] = { cards: parsed.cards, threads: parsed.threads, messages: parsed.messages ?? [], terms: parsed.terms ?? [] };
        return memory[p]!;
      }
    }
  } catch {
    // Storage blocked or a stale shape: start from the seed.
  }
  memory[p] = p === 'starting' ? withoutOwnCards(seed(now)) : seed(now);
  return memory[p]!;
}

function save() {
  const p = persona();
  try {
    if (memory[p] && typeof window !== 'undefined') window.sessionStorage.setItem(storageKeyOf(p), JSON.stringify(memory[p]));
  } catch {
    // The demo still works for this page view.
  }
}

/** Test hook: forget the session's worlds. */
export function resetDemoCommitments() {
  memory.founder = null;
  memory.starting = null;
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(STORAGE_KEY);
      window.sessionStorage.removeItem(storageKeyOf('starting'));
    }
  } catch {
    /* ignore */
  }
}

const person = (id: string) => ({ id, displayName: PEOPLE[id]?.displayName ?? 'Member', avatarUrl: null, headline: PEOPLE[id]?.headline ?? null, role: PEOPLE[id]?.role ?? null });
/** A card's author, with the badge the API reads live beside their name. */
const author = (id: string) => ({ ...person(id), verifiedMethods: demoPersonMethods(id) });

function cardShape(world: World, card: Card) {
  const mine = card.ownerId === ME;
  const threads = world.threads.filter((t) => t.cardId === card.id);
  const myThread = threads.find((t) => t.candidateId === ME);
  return {
    id: card.id,
    kind: card.kind,
    title: card.title,
    exists: card.exists,
    goal: card.goal,
    missing: card.missing,
    offer: { role: card.offerRole, equity: card.offerEquity, hoursPerWeek: card.offerHours, scope: card.offerScope },
    category: card.category,
    place: card.place,
    isRemote: card.isRemote,
    stage: card.stage,
    commitment: card.commitment,
    projectRef: card.projectRef,
    evidence: card.evidence,
    version: card.version,
    history: card.history,
    outcome: card.status,
    closedReason: card.closedReason,
    settledAt: card.settledAt,
    expiresAt: card.expiresAt,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    owner: author(card.ownerId),
    isMine: mine,
    shareToken: mine ? card.shareToken : null,
    shared: Boolean(card.shareToken),
    interestCount: mine ? threads.filter((t) => t.step !== 'closed').length : undefined,
    myThreadId: myThread?.id ?? null,
    myThreadStep: myThread?.step ?? null,
  };
}

function refresh(world: World, cardId: string, nowIso: string) {
  const card = world.cards.find((c) => c.id === cardId);
  if (!card || card.status === 'closed') return;
  const threads = world.threads.filter((t) => t.cardId === cardId);
  const status = deriveCardOutcome(false, threads.map((t) => t.step));
  const agreedAt = threads.map((t) => t.agreedAt).filter((d): d is string => Boolean(d)).sort()[0];
  card.status = status;
  card.settledAt = status === 'agreed' ? agreedAt ?? nowIso : null;
  card.updatedAt = nowIso;
}

function contactRefusal(text: string, surface: TransparencySurface) {
  const kinds = contactKinds(text);
  if (!kinds.length) return;
  recordDemoRefusal('contact_refused', surface);
  const what = describeContactKinds(kinds);
  throw new DemoRefusal(400, `This conversation stays on CoFounderBay until you both confirm. Remove ${what.en} and send again.`, {
    reason: 'contact_details',
    kinds,
    messageEl: `Η συζήτηση μένει στο CoFounderBay μέχρι να επιβεβαιώσετε και οι δύο. Αφαιρέστε ${what.el} και στείλτε ξανά.`,
  });
}

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const numberOrNull = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

function readCard(body: Record<string, unknown>): NeedCardInput {
  const hours = numberOrNull(body.offerHours);
  return {
    kind: isCommitmentKind(body.kind) ? body.kind : 'cofounder',
    title: text(body.title, NEED_CARD_LIMITS.title),
    exists: text(body.exists, NEED_CARD_LIMITS.sentence),
    goal: text(body.goal, NEED_CARD_LIMITS.sentence),
    missing: text(body.missing, NEED_CARD_LIMITS.sentence),
    offerRole: text(body.offerRole, NEED_CARD_LIMITS.role),
    offerEquity: text(body.offerEquity, NEED_CARD_LIMITS.equity),
    offerHours: hours === null ? null : Math.round(hours),
    offerScope: text(body.offerScope, NEED_CARD_LIMITS.scope),
    category: text(body.category, 60),
    place: text(body.place, 80),
    isRemote: body.isRemote === true,
    stage: text(body.stage, 20),
    commitment: text(body.commitment, 20),
    projectRef: typeof body.projectRef === 'string' && body.projectRef ? body.projectRef : null,
  };
}

function incomplete(input: NeedCardInput) {
  const assessment = assessNeedCard(input);
  if (assessment.ready) return;
  if (assessment.contact.length) recordDemoRefusal('contact_refused', 'need_card');
  if (assessment.checks.some((c) => c.id === 'promise_free' && !c.ok)) recordDemoRefusal('promise_refused', 'need_card');
  throw new DemoRefusal(400, 'The card is not ready to publish yet.', {
    reason: 'card_incomplete',
    failing: assessment.checks.filter((c) => c.required && !c.ok).map((c) => c.id),
    kinds: assessment.contact,
    messageEl: 'Η κάρτα δεν είναι ακόμη έτοιμη για δημοσίευση.',
  });
}

function participant(world: World, threadId: string) {
  const thread = world.threads.find((t) => t.id === threadId);
  if (!thread) throw new DemoRefusal(404, 'Conversation not found');
  const card = world.cards.find((c) => c.id === thread.cardId);
  if (!card) throw new DemoRefusal(404, 'Need card not found');
  const isOwner = card.ownerId === ME;
  if (!isOwner && thread.candidateId !== ME) throw new DemoRefusal(403, 'Only the two people in this commitment can open it');
  return { thread, card, isOwner };
}

function threadShape(world: World, thread: Thread, card: Card, isOwner: boolean) {
  const rows = world.terms.filter((t) => t.threadId === thread.id).sort((a, b) => a.version - b.version);
  const latest = rows[rows.length - 1];
  return {
    id: thread.id,
    cardId: card.id,
    card: cardShape(world, card),
    role: isOwner ? 'owner' : 'candidate',
    counterpart: person(isOwner ? thread.candidateId : card.ownerId),
    verification: { meVerified: demoMeVerified(), counterpartMethods: demoPersonMethods(isOwner ? thread.candidateId : card.ownerId) },
    step: thread.step,
    note: thread.note,
    answeredVersion: thread.cardVersion,
    myConfirmed: Boolean(isOwner ? thread.ownerConfirmedAt : thread.candidateConfirmedAt),
    bothConfirmed: Boolean(thread.ownerConfirmedAt && thread.candidateConfirmedAt),
    conversationReadOnly: thread.step !== 'conversation',
    revisions: thread.revisions,
    dealRoomActive: thread.dealRoomActive,
    agreedAt: thread.agreedAt,
    closedReason: thread.closedReason,
    closedAt: thread.closedAt,
    messages: world.messages
      .filter((m) => m.threadId === thread.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((m) => ({ id: m.id, authorId: m.authorId, mine: m.authorId === ME, body: m.body, createdAt: m.createdAt })),
    terms: rows.map((t, index) => ({
      version: t.version,
      proposedByMe: t.proposedById === ME,
      role: t.role,
      equityPct: t.equityPct,
      vestingMonths: t.vestingMonths,
      cliffMonths: t.cliffMonths,
      hoursPerWeek: t.hoursPerWeek,
      scope: t.scope,
      note: t.note,
      changed: index > 0 ? termsChanges(rows[index - 1], t) : [],
      acceptedByMe: Boolean(isOwner ? t.ownerAcceptedAt : t.candidateAcceptedAt),
      acceptedByThem: Boolean(isOwner ? t.candidateAcceptedAt : t.ownerAcceptedAt),
      isLatest: t.version === latest?.version,
      createdAt: t.createdAt,
    })),
  };
}

let seq = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${++seq}`;

/**
 * Answers `/api/commitments/*` for the preview demo, or `undefined` for any
 * other path. Writes change the session's world and are saved after each.
 */
export function previewCommitmentsApi(pathname: string, path: string, method: string, body: Record<string, unknown>, nowMs: number): unknown {
  if (!pathname.startsWith('/api/commitments')) return undefined;
  const world = load(nowMs);
  const nowIso = new Date(nowMs).toISOString();
  const result = route(world, pathname, path, method, body ?? {}, nowMs, nowIso);
  if (method !== 'GET') save();
  return result;
}

function route(world: World, pathname: string, path: string, method: string, body: Record<string, unknown>, nowMs: number, nowIso: string): unknown {
  const parts = pathname.split('/').filter(Boolean).slice(2); // after api/commitments

  if (parts[0] === 'interest-budget' && method === 'GET') {
    const waiting = world.threads.filter((t) => t.candidateId === ME && t.step === 'interest').length;
    return { budget: INTEREST_BUDGET, waiting, left: interestBudgetLeft(waiting) };
  }

  // Quiet open cards expire on read, as on the server.
  for (const card of world.cards) {
    if (card.status === 'open' && card.expiresAt && Date.parse(card.expiresAt) < nowMs) {
      card.status = 'closed';
      card.closedReason = 'expired';
      card.settledAt = card.expiresAt;
    }
  }

  if (parts[0] === 'public' && parts[1] && method === 'GET') {
    const card = world.cards.find((c) => c.shareToken === decodeURIComponent(parts[1]));
    if (!card) throw new DemoRefusal(404, 'This link is not valid or was turned off');
    const shape = cardShape(world, card);
    return {
      card: {
        id: shape.id,
        kind: shape.kind,
        title: shape.title,
        exists: shape.exists,
        goal: shape.goal,
        missing: shape.missing,
        offer: shape.offer,
        category: shape.category,
        place: shape.place,
        isRemote: shape.isRemote,
        stage: shape.stage,
        commitment: shape.commitment,
        evidence: shape.evidence,
        version: shape.version,
        outcome: shape.outcome,
        settledAt: shape.settledAt,
        owner: { displayName: shape.owner.displayName, headline: shape.owner.headline, avatarUrl: null, verifiedMethods: shape.owner.verifiedMethods },
      },
    };
  }

  if (parts[0] === 'cards') {
    if (parts.length === 1 && method === 'GET') {
      const sp = new URLSearchParams(path.split('?')[1] ?? '');
      const refs = (sp.get('projectRefs') ?? '').split(',').filter(Boolean);
      const q = (sp.get('q') ?? '').toLowerCase();
      const cards = world.cards
        .filter((c) => sp.get('mine') !== '1' || c.ownerId === ME)
        .filter((c) => sp.get('mine') === '1' || !sp.get('owner') || c.ownerId === sp.get('owner'))
        .filter((c) => !sp.get('kind') || c.kind === sp.get('kind'))
        .filter((c) => !sp.get('stage') || c.stage === sp.get('stage'))
        .filter((c) => !sp.get('commitment') || c.commitment === sp.get('commitment'))
        .filter((c) => !sp.get('category') || c.category.toLowerCase() === (sp.get('category') ?? '').toLowerCase())
        // Every spelling of a known place, as the API reads it (placeVariants).
        .filter((c) => !sp.get('place') || placeVariants(sp.get('place') ?? '').some((v) => foldSearchText(c.place ?? '').includes(foldSearchText(v))))
        .filter((c) => !sp.get('outcome') || c.status === sp.get('outcome'))
        .filter((c) => !refs.length || (c.projectRef !== null && refs.includes(c.projectRef)))
        .filter((c) => !q || `${c.title} ${c.exists} ${c.goal} ${c.missing} ${c.offerRole}`.toLowerCase().includes(q))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((c) => cardShape(world, c));
      return { cards };
    }
    if (parts.length === 1 && method === 'POST') {
      const input = readCard(body);
      incomplete(input);
      const card: Card = {
        id: newId('need'),
        ownerId: ME,
        kind: input.kind,
        title: input.title,
        exists: input.exists,
        goal: input.goal,
        missing: input.missing,
        offerRole: input.offerRole,
        offerEquity: input.offerEquity || null,
        offerHours: input.offerHours ?? 0,
        offerScope: input.offerScope,
        category: input.category,
        place: input.place || null,
        isRemote: input.isRemote,
        stage: input.stage,
        commitment: input.commitment,
        projectRef: input.projectRef ?? null,
        evidence: [{ id: 'milestones_completed', count: 1 }, { id: 'email_verified', value: true }],
        version: 1,
        history: [],
        status: 'open',
        closedReason: null,
        settledAt: null,
        expiresAt: new Date(nowMs + 90 * DAY).toISOString(),
        shareToken: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      world.cards.unshift(card);
      return { card: cardShape(world, card) };
    }
    const card = world.cards.find((c) => c.id === decodeURIComponent(parts[1] ?? ''));
    if (!card) throw new DemoRefusal(404, 'Need card not found');
    const own = () => {
      if (card.ownerId !== ME) throw new DemoRefusal(403, 'Only the author can change this card');
    };
    if (parts.length === 2 && method === 'GET') return { card: cardShape(world, card) };
    if (parts.length === 2 && method === 'PATCH') {
      own();
      if (card.status === 'closed') throw new DemoRefusal(409, 'Reopen the card before editing it');
      const current = readCard({ ...card, offerEquity: card.offerEquity ?? '', place: card.place ?? '' } as unknown as Record<string, unknown>);
      const patch = readCard({ ...current, ...body, kind: card.kind });
      incomplete(patch);
      const changes = cardOfferChanges(current, patch);
      if (changes.length) {
        card.history = [...card.history, { version: card.version, at: nowIso, changed: changes, offer: { role: card.offerRole, equity: card.offerEquity, hoursPerWeek: card.offerHours, scope: card.offerScope, commitment: card.commitment } }];
        card.version += 1;
      }
      Object.assign(card, {
        title: patch.title,
        exists: patch.exists,
        goal: patch.goal,
        missing: patch.missing,
        offerRole: patch.offerRole,
        offerEquity: patch.offerEquity || null,
        offerHours: patch.offerHours ?? card.offerHours,
        offerScope: patch.offerScope,
        category: patch.category,
        place: patch.place || null,
        isRemote: patch.isRemote,
        stage: patch.stage,
        commitment: patch.commitment,
        updatedAt: nowIso,
      });
      return { card: cardShape(world, card), newVersion: changes.length > 0, changed: changes };
    }
    if (parts[2] === 'close' && method === 'POST') {
      own();
      if (card.status === 'closed') throw new DemoRefusal(409, 'The card is already closed');
      const previousOutcome = card.status;
      const reason = body.reason === 'filled' ? 'filled' : 'withdrawn';
      Object.assign(card, { status: 'closed', closedReason: reason, settledAt: nowIso, updatedAt: nowIso });
      return { ok: true, outcome: 'closed', closedReason: reason, previousOutcome };
    }
    if (parts[2] === 'reopen' && method === 'POST') {
      own();
      if (card.status !== 'closed') throw new DemoRefusal(409, 'The card is not closed');
      const stillRunning = card.expiresAt && Date.parse(card.expiresAt) > nowMs;
      Object.assign(card, { status: 'open', closedReason: null, settledAt: null, expiresAt: stillRunning ? card.expiresAt : new Date(nowMs + 90 * DAY).toISOString() });
      refresh(world, card.id, nowIso);
      return { card: cardShape(world, card) };
    }
    if (parts[2] === 'share' && method === 'POST') {
      own();
      if (card.shareToken) return { token: card.shareToken, created: false };
      card.shareToken = `demo-${card.id}-${Math.random().toString(36).slice(2, 8)}`;
      return { token: card.shareToken, created: true };
    }
    if (parts[2] === 'share' && method === 'DELETE') {
      own();
      card.shareToken = null;
      return { ok: true };
    }
    if (parts[2] === 'interest' && method === 'POST') {
      if (card.ownerId === ME) throw new DemoRefusal(400, 'This is your own card');
      if (!acceptsInterest(card.status)) throw new DemoRefusal(409, 'This card is not taking interest any more');
      const note = text(body.note, NEED_CARD_LIMITS.note);
      contactRefusal(note, 'interest');
      if (hasPromiseClaims(note)) {
        recordDemoRefusal('promise_refused', 'interest');
        throw new DemoRefusal(400, 'Remove promised returns from the note.', { reason: 'promise', messageEl: 'Αφαιρέστε τις υποσχέσεις αποδόσεων από το σημείωμα.' });
      }
      if (card.kind === 'investor_intro' && !demoRoleCleared(nowMs)) {
        throw new DemoRefusal(400, ROLE_VERIFICATION_COPY.en, { reason: 'role_verification_required', messageEl: ROLE_VERIFICATION_COPY.el, methods: [...ROLE_VERIFICATION_METHODS] });
      }
      if (world.threads.some((t) => t.cardId === card.id && t.candidateId === ME)) throw new DemoRefusal(409, 'You have already answered this card');
      const waiting = world.threads.filter((t) => t.candidateId === ME && t.step === 'interest').length;
      if (waiting >= INTEREST_BUDGET) {
        throw new DemoRefusal(400, INTEREST_BUDGET_COPY.en, { reason: 'interest_budget', messageEl: INTEREST_BUDGET_COPY.el, budget: INTEREST_BUDGET, waiting });
      }
      const thread: Thread = {
        id: newId('thr'),
        cardId: card.id,
        candidateId: ME,
        step: 'interest',
        note: note || null,
        cardVersion: card.version,
        ownerConfirmedAt: null,
        candidateConfirmedAt: null,
        revisions: 0,
        dealRoomActive: false,
        agreedAt: null,
        closedById: null,
        closedReason: null,
        closedAt: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      world.threads.push(thread);
      return { thread: { id: thread.id, cardId: card.id, step: thread.step } };
    }
    throw new DemoRefusal(404, 'Not found');
  }

  if (parts[0] === 'threads') {
    if (parts.length === 1 && method === 'GET') {
      const sp = new URLSearchParams(path.split('?')[1] ?? '');
      const as = sp.get('as') ?? 'all';
      const rows = world.threads
        .map((t) => ({ t, card: world.cards.find((c) => c.id === t.cardId) }))
        .filter((r): r is { t: Thread; card: Card } => Boolean(r.card))
        .filter(({ t, card }) => (as === 'owner' ? card.ownerId === ME : as === 'candidate' ? t.candidateId === ME : card.ownerId === ME || t.candidateId === ME))
        .sort((a, b) => b.t.updatedAt.localeCompare(a.t.updatedAt));
      return {
        threads: rows.map(({ t, card }) => {
          const isOwner = card.ownerId === ME;
          const latest = world.terms.filter((x) => x.threadId === t.id).sort((a, b) => b.version - a.version)[0];
          return {
            id: t.id,
            cardId: card.id,
            cardTitle: card.title,
            cardKind: card.kind,
            cardOutcome: card.status,
            cardVersion: card.version,
            answeredVersion: t.cardVersion,
            role: isOwner ? 'owner' : 'candidate',
            counterpart: person(isOwner ? t.candidateId : card.ownerId),
            step: t.step,
            myConfirmed: Boolean(isOwner ? t.ownerConfirmedAt : t.candidateConfirmedAt),
            latestTermsVersion: latest?.version ?? 0,
            myAcceptedLatest: latest ? Boolean(isOwner ? latest.ownerAcceptedAt : latest.candidateAcceptedAt) : false,
            dealRoomActive: t.dealRoomActive,
            revisions: t.revisions,
            closedReason: t.closedReason,
            agreedAt: t.agreedAt,
            closedAt: t.closedAt,
            updatedAt: t.updatedAt,
          };
        }),
      };
    }

    const { thread, card, isOwner } = participant(world, decodeURIComponent(parts[1] ?? ''));
    const touch = () => {
      thread.updatedAt = nowIso;
    };
    const shape = () => ({ thread: threadShape(world, thread, card, isOwner) });

    if (parts.length === 2 && method === 'GET') return shape();
    if (parts[2] === 'interest' && method === 'DELETE') {
      if (isOwner) throw new DemoRefusal(403, 'Only the person who sent the interest can withdraw it');
      if (thread.step !== 'interest') throw new DemoRefusal(409, 'The author has already answered; step back from the conversation instead');
      world.threads = world.threads.filter((t) => t.id !== thread.id);
      refresh(world, card.id, nowIso);
      return { ok: true };
    }
    if (parts[2] === 'accept' && method === 'POST') {
      if (!isOwner) throw new DemoRefusal(403, 'Only the author can accept interest');
      if (thread.step !== 'interest') throw new DemoRefusal(409, 'This interest was already answered');
      thread.step = 'conversation';
      touch();
      refresh(world, card.id, nowIso);
      return shape();
    }
    if (parts[2] === 'messages' && method === 'POST') {
      if (thread.step !== 'conversation') {
        throw new DemoRefusal(409, thread.step === 'interest' ? 'The author has not accepted this interest yet' : 'The first conversation is read-only now; discuss changes in the terms space');
      }
      const message = text(body.body, NEED_CARD_LIMITS.message);
      if (!message) throw new DemoRefusal(400, 'Write a message first');
      contactRefusal(message, 'conversation');
      const row: Message = { id: newId('msg'), threadId: thread.id, authorId: ME, body: message, createdAt: nowIso };
      world.messages.push(row);
      touch();
      return { message: { id: row.id, authorId: ME, mine: true, body: row.body, createdAt: row.createdAt } };
    }
    if (parts[2] === 'confirm' && method === 'POST') {
      if (thread.step !== 'conversation') throw new DemoRefusal(409, 'Confirmation belongs to the conversation step');
      if (isOwner) thread.ownerConfirmedAt = thread.ownerConfirmedAt ?? nowIso;
      else thread.candidateConfirmedAt = thread.candidateConfirmedAt ?? nowIso;
      const both = Boolean(thread.ownerConfirmedAt && thread.candidateConfirmedAt);
      if (both) {
        thread.step = 'terms';
        refresh(world, card.id, nowIso);
      }
      touch();
      return { ok: true, bothConfirmed: both, step: both ? 'terms' : 'conversation' };
    }
    if (parts[2] === 'confirm' && method === 'DELETE') {
      if (thread.step !== 'conversation') throw new DemoRefusal(409, 'You have both confirmed; the terms space is open');
      if (!(isOwner ? thread.ownerConfirmedAt : thread.candidateConfirmedAt)) throw new DemoRefusal(409, 'You have not confirmed');
      if (isOwner) thread.ownerConfirmedAt = null;
      else thread.candidateConfirmedAt = null;
      touch();
      return { ok: true };
    }
    if (parts[2] === 'terms' && parts.length === 3 && method === 'POST') {
      requireDemoVerified();
      const rows = world.terms.filter((t) => t.threadId === thread.id).sort((a, b) => b.version - a.version);
      const latest = rows[0];
      const gate = canReviseTerms({ revisions: thread.revisions, dealRoomActive: thread.dealRoomActive, step: thread.step, versions: latest?.version ?? 0 });
      if (!gate.ok) {
        throw new DemoRefusal(
          409,
          gate.reason === 'frozen'
            ? 'Terms are frozen while the deal room is open; close it to revise'
            : gate.reason === 'limit'
              ? 'All three revisions are used; accept the current terms or step back'
              : 'Terms open once you have both confirmed',
        );
      }
      const fields: TermsFields = {
        role: text(body.role, NEED_CARD_LIMITS.role),
        equityPct: numberOrNull(body.equityPct),
        vestingMonths: numberOrNull(body.vestingMonths),
        cliffMonths: numberOrNull(body.cliffMonths),
        hoursPerWeek: numberOrNull(body.hoursPerWeek),
        scope: text(body.scope, NEED_CARD_LIMITS.scope),
      };
      const note = text(body.note, NEED_CARD_LIMITS.note) || null;
      const problems = validateTerms(fields, note);
      if (problems.includes('promise')) recordDemoRefusal('promise_refused', 'terms');
      if (problems.includes('contact')) contactRefusal([fields.role, fields.scope, note ?? ''].join('\n'), 'terms');
      if (problems.length) throw new DemoRefusal(400, 'Check the terms and try again.', { reason: 'terms_invalid', problems, messageEl: 'Ελέγξτε τους όρους και δοκιμάστε ξανά.' });
      const changed = latest ? termsChanges(latest, fields) : [];
      if (latest && changed.length === 0) {
        latest.note = note;
        touch();
        return { version: latest.version, substantive: false, revisionsUsed: thread.revisions };
      }
      const created: Terms = {
        id: newId('terms'),
        threadId: thread.id,
        version: (latest?.version ?? 0) + 1,
        proposedById: ME,
        ...fields,
        note,
        ownerAcceptedAt: isOwner ? nowIso : null,
        candidateAcceptedAt: isOwner ? null : nowIso,
        createdAt: nowIso,
      };
      world.terms.push(created);
      if (latest) thread.revisions += 1;
      touch();
      return { version: created.version, substantive: true, revisionsUsed: thread.revisions, changed };
    }
    if (parts[2] === 'terms' && parts[4] === 'accept' && method === 'POST') {
      requireDemoVerified();
      if (thread.step !== 'terms') throw new DemoRefusal(409, 'There are no open terms to accept');
      const version = Number(parts[3]);
      if (!Number.isInteger(version)) throw new DemoRefusal(400, 'Validation failed (numeric string is expected)');
      const latest = world.terms.filter((t) => t.threadId === thread.id).sort((a, b) => b.version - a.version)[0];
      if (!latest) throw new DemoRefusal(409, 'No terms have been proposed yet');
      if (latest.version !== version) throw new DemoRefusal(409, `Version ${version} is not the latest; read v${latest.version} first`);
      if (isOwner) latest.ownerAcceptedAt = latest.ownerAcceptedAt ?? nowIso;
      else latest.candidateAcceptedAt = latest.candidateAcceptedAt ?? nowIso;
      const agreed = Boolean(latest.ownerAcceptedAt && latest.candidateAcceptedAt);
      if (agreed) {
        Object.assign(thread, { step: 'agreed', dealRoomActive: true, agreedAt: nowIso });
        refresh(world, card.id, nowIso);
      }
      touch();
      return { ok: true, agreed, step: agreed ? 'agreed' : 'terms' };
    }
    if (parts[2] === 'deal-room' && parts[3] === 'close' && method === 'POST') {
      if (thread.step !== 'agreed' || !thread.dealRoomActive) throw new DemoRefusal(409, 'The deal room is not open');
      const latest = world.terms.filter((t) => t.threadId === thread.id).sort((a, b) => b.version - a.version)[0];
      if (latest) Object.assign(latest, { ownerAcceptedAt: null, candidateAcceptedAt: null });
      Object.assign(thread, { step: 'terms', dealRoomActive: false, agreedAt: null });
      touch();
      refresh(world, card.id, nowIso);
      return { ok: true, step: 'terms' };
    }
    if (parts[2] === 'close' && method === 'POST') {
      if (thread.step === 'closed') throw new DemoRefusal(409, 'Already closed');
      if (thread.step === 'agreed') throw new DemoRefusal(409, 'Close the deal room before stepping back');
      const reason = text(body.reason, 200) || null;
      if (reason) contactRefusal(reason, 'conversation');
      Object.assign(thread, { step: 'closed', closedById: ME, closedReason: reason, closedAt: nowIso });
      touch();
      refresh(world, card.id, nowIso);
      return { ok: true, step: 'closed' };
    }
  }

  throw new DemoRefusal(404, 'Not found');
}
