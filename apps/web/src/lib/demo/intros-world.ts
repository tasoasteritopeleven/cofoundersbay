import {
  INTRO_LIMITS,
  INTRO_PROBLEM_COPY,
  OPEN_INTRO_STATUSES,
  introPaths,
  introStatusForRequester,
  introTransition,
  knowsDirectly,
  readForwardNote,
  readIntroRequest,
  type IntroAction,
  type IntroGraph,
  type IntroProblem,
  type IntroRole,
  type IntroStatus,
  ROLE_VERIFICATION_COPY,
} from '@cofounderbay/shared';
import { DemoRefusal } from './demo-refusal';
import { previewCommitmentsApi } from './commitments-world';
import { demoRoleCleared } from './verification-world';
import { recordDemoRefusal } from './transparency-world';

/**
 * Warm introductions in the preview demo, with the API's rules.
 *
 * The graph is the demo world's: Alex is connected to Elena and Marcus, is
 * mentored by Dr. Sarah Kim, and shared the Athens spring cohort with Sofia
 * and Yannis. Elena and Dr. Kim both know Nikos (the angel), so asking for an
 * introduction to Nikos offers two paths. Need cards come from the
 * commitments demo, and accepting one is answering that card there, so the
 * ladder picks it up on /commitments exactly as it would on the server.
 *
 * Four seeds show each side: Alex first asked Elena for Nikos and it was
 * not forwarded (no reason is given), then asked Dr. Kim, which is waiting;
 * Dimitris asks Alex to introduce him to Dr. Kim; and Elena forwarded
 * Christina's request to Alex.
 */

const ME = 'preview-demo-user';
const STORAGE_KEY = 'cfb:demo-intros:v1';
const DAY = 86_400_000;

const PEOPLE: Record<string, { displayName: string; headline: string | null }> = {
  [ME]: { displayName: 'Alex Demo', headline: 'Founder · Athens founder networks' },
  'user-elena': { displayName: 'Elena Papadopoulos', headline: 'Founder & CEO at Harbor' },
  'user-marcus': { displayName: 'Marcus Chen', headline: 'Technical cofounder · Full-stack' },
  'user-sarah': { displayName: 'Dr. Sarah Kim', headline: 'Startup mentor · Former product lead · 3x founder' },
  'user-nikos': { displayName: 'Nikos Andreou', headline: 'Angel investor · Seed' },
  'user-sofia': { displayName: 'Sofia Alexiou', headline: 'Founder at Meltemi' },
  'user-yannis': { displayName: 'Yannis Petrou', headline: 'Founder at Kolo Labs' },
  'user-dimitris': { displayName: 'Dimitris Kostas', headline: 'Founder at Orion Grid' },
  'user-christina': { displayName: 'Christina Mavrou', headline: 'Founder at Aegis Health' },
};

export const DEMO_INTRO_GRAPH: IntroGraph = {
  connections: [
    [ME, 'user-elena'],
    [ME, 'user-marcus'],
    ['user-elena', 'user-nikos'],
    ['user-elena', 'user-christina'],
    ['user-marcus', 'user-dimitris'],
    ['user-sarah', 'user-nikos'],
    [ME, 'user-dimitris'],
  ],
  mentorships: [{ mentorId: 'user-sarah', menteeId: ME }],
  cohorts: [
    { cohortId: 'athens-spring', userId: ME },
    { cohortId: 'athens-spring', userId: 'user-sofia' },
    { cohortId: 'athens-spring', userId: 'user-yannis' },
  ],
};

interface Row {
  id: string;
  requesterId: string;
  intermediaryId: string;
  targetId: string;
  cardId: string;
  cardTitle: string;
  note: string;
  forwardNote: string | null;
  status: IntroStatus;
  toRequester: string[];
  toTarget: string[];
  threadId: string | null;
  ageMs: number;
  decidedAgeMs: number | null;
}

type State = { rows: Row[]; savedAt: number; seq: number };
let memory: State | null = null;

function seed(now: number): State {
  const base = { forwardNote: null, threadId: null, decidedAgeMs: null } as const;
  return {
    savedAt: now,
    seq: 0,
    rows: [
      {
        ...base,
        id: 'intro-alex-nikos',
        requesterId: ME,
        intermediaryId: 'user-sarah',
        targetId: 'user-nikos',
        cardId: 'need-athens-intros',
        cardTitle: 'Community co-founder for an Athens founder-intro programme',
        note: 'Nikos backs Greek pre-seed founders; I would value twenty minutes on whether the programme fits his pipeline.',
        status: 'pending',
        toRequester: ['mentor'],
        toTarget: ['connection'],
        ageMs: 2 * DAY,
      },
      {
        ...base,
        id: 'intro-alex-nikos-elena',
        requesterId: ME,
        intermediaryId: 'user-elena',
        targetId: 'user-nikos',
        cardId: 'need-athens-intros',
        cardTitle: 'Community co-founder for an Athens founder-intro programme',
        note: 'Nikos backs Greek pre-seed founders; a short call about whether the programme fits his pipeline.',
        status: 'declined',
        toRequester: ['connection'],
        toTarget: ['connection'],
        ageMs: 9 * DAY,
        decidedAgeMs: 7 * DAY,
      },
      {
        ...base,
        id: 'intro-dimitris-sarah',
        requesterId: 'user-dimitris',
        intermediaryId: ME,
        targetId: 'user-sarah',
        cardId: 'need-orion-angel',
        cardTitle: 'Angel with grid-operator experience for Orion Grid',
        note: 'Dr. Kim mentors energy founders and knows angels who ran grid operations. Orion Grid is raising its pre-seed.',
        status: 'pending',
        toRequester: ['connection'],
        toTarget: ['mentor'],
        ageMs: 1 * DAY,
      },
      {
        ...base,
        id: 'intro-christina-alex',
        requesterId: 'user-christina',
        intermediaryId: 'user-elena',
        targetId: ME,
        cardId: 'need-aegis-growth',
        cardTitle: 'Head of growth for Aegis Health',
        note: 'Alex built a founder community from zero; Aegis needs someone who can do the same with clinics.',
        forwardNote: 'Christina is careful and kind. Worth half an hour.',
        status: 'forwarded',
        toRequester: ['connection'],
        toTarget: ['connection'],
        ageMs: 3 * DAY,
        decidedAgeMs: 2 * DAY,
      },
    ],
  };
}

function load(now: number): State {
  if (memory) return memory;
  try {
    const raw = typeof window !== 'undefined' ? window.sessionStorage.getItem(STORAGE_KEY) : null;
    memory = raw ? (JSON.parse(raw) as State) : seed(now);
  } catch {
    memory = seed(now);
  }
  const elapsed = Math.max(0, now - memory.savedAt);
  if (elapsed) {
    for (const r of memory.rows) {
      r.ageMs += elapsed;
      if (r.decidedAgeMs !== null) r.decidedAgeMs += elapsed;
    }
    memory.savedAt = now;
  }
  return memory;
}

function save() {
  try {
    if (memory && typeof window !== 'undefined') window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // storage blocked: the change lasts this page view
  }
}

export function resetDemoIntros() {
  memory = null;
  try {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

const person = (id: string) => ({ id, displayName: PEOPLE[id]?.displayName ?? 'Member', headline: PEOPLE[id]?.headline ?? null, avatarUrl: null });

function roleOf(row: Row): IntroRole | null {
  if (row.requesterId === ME) return 'requester';
  if (row.intermediaryId === ME) return 'intermediary';
  if (row.targetId === ME && !['pending', 'declined', 'withdrawn'].includes(row.status)) return 'target';
  return null;
}

function shape(row: Row, now: number) {
  const role = roleOf(row) ?? 'requester';
  return {
    id: row.id,
    role,
    status: role === 'requester' ? introStatusForRequester(row.status) : row.status,
    requester: person(row.requesterId),
    intermediary: person(row.intermediaryId),
    target: person(row.targetId),
    card: { id: row.cardId, title: row.cardTitle },
    note: row.note,
    forwardNote: row.forwardNote,
    toRequester: row.toRequester,
    toTarget: row.toTarget,
    threadId: role === 'intermediary' ? null : row.threadId,
    createdAt: new Date(now - row.ageMs).toISOString(),
    decidedAt: row.decidedAgeMs === null ? null : new Date(now - row.decidedAgeMs).toISOString(),
  };
}

type DemoCard = { id: string; title: string; kind: string; isMine: boolean; outcome: string };
function myCards(now: number): DemoCard[] {
  const res = previewCommitmentsApi('/api/commitments/cards', '/api/commitments/cards?mine=1', 'GET', {}, now) as { cards?: DemoCard[] } | undefined;
  return (res?.cards ?? []).filter((c) => c.isMine && (c.outcome === 'open' || c.outcome === 'in_discussion'));
}

function refuse(problems: IntroProblem[]): never {
  if (problems.includes('contact')) recordDemoRefusal('contact_refused', 'intro');
  if (problems.includes('promise')) recordDemoRefusal('promise_refused', 'intro');
  throw new DemoRefusal(400, problems.map((p) => INTRO_PROBLEM_COPY[p].en).join(' '), {
    reason: 'intro_invalid',
    problems,
    messageEl: problems.map((p) => INTRO_PROBLEM_COPY[p].el).join(' '),
  });
}

/** Answers `/api/intros…` for the demo, or `undefined` for any other path. */
export function previewIntrosApi(pathname: string, path: string, method: string, body: Record<string, unknown>, now: number): unknown {
  if (!pathname.startsWith('/api/intros')) return undefined;
  const state = load(now);
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent).slice(2); // after api/intros

  if (!parts.length && method === 'GET') {
    const mine = state.rows.filter((r) => roleOf(r)).sort((a, b) => a.ageMs - b.ageMs).map((r) => shape(r, now));
    return { sent: mine.filter((i) => i.role === 'requester'), toForward: mine.filter((i) => i.role === 'intermediary'), received: mine.filter((i) => i.role === 'target') };
  }

  if (parts[0] === 'paths' && method === 'GET') {
    const targetId = new URL(path, 'http://demo.local').searchParams.get('targetId') ?? '';
    if (!targetId || targetId === ME) throw new DemoRefusal(400, 'Choose someone other than yourself');
    return {
      direct: knowsDirectly(DEMO_INTRO_GRAPH, ME, targetId),
      paths: introPaths(DEMO_INTRO_GRAPH, ME, targetId).map((p) => ({ intermediary: person(p.intermediaryId), toRequester: p.toRequester, toTarget: p.toTarget })),
      cards: myCards(now).map(({ id, title, kind }) => ({ id, title, kind })),
    };
  }

  if (!parts.length && method === 'POST') {
    const read = readIntroRequest(body, ME);
    if (!read.ok) refuse(read.problems);
    const { intermediaryId, targetId, cardId, note } = read.value;
    const card = myCards(now).find((c) => c.id === cardId);
    if (!card) throw new DemoRefusal(404, 'Need card not found');
    const route = introPaths(DEMO_INTRO_GRAPH, ME, targetId).find((p) => p.intermediaryId === intermediaryId);
    if (!route) {
      throw new DemoRefusal(400, 'That person does not know both of you on CoFounderBay, so they cannot introduce you.', {
        reason: 'no_path',
        messageEl: 'Αυτό το πρόσωπο δεν γνωρίζει και τους δύο στο CoFounderBay, οπότε δεν μπορεί να σας συστήσει.',
      });
    }
    const open = state.rows.filter((r) => r.requesterId === ME && OPEN_INTRO_STATUSES.includes(r.status));
    if (open.some((r) => r.targetId === targetId && r.cardId === cardId)) throw new DemoRefusal(409, 'You already asked for this introduction');
    if (open.length >= INTRO_LIMITS.openPerRequester) {
      throw new DemoRefusal(400, `You have ${INTRO_LIMITS.openPerRequester} introductions waiting. Wait for an answer or withdraw one first.`, {
        reason: 'too_many_open',
        messageEl: `Έχετε ${INTRO_LIMITS.openPerRequester} συστάσεις σε αναμονή. Περιμένετε μια απάντηση ή αποσύρετε μία πρώτα.`,
      });
    }
    state.seq += 1;
    const row: Row = {
      id: `intro-new-${state.seq}-${Math.floor(now % 100000)}`,
      requesterId: ME,
      intermediaryId,
      targetId,
      cardId,
      cardTitle: card.title,
      note,
      forwardNote: null,
      status: 'pending',
      toRequester: route.toRequester,
      toTarget: route.toTarget,
      threadId: null,
      ageMs: 0,
      decidedAgeMs: null,
    };
    state.rows.unshift(row);
    save();
    return { intro: shape(row, now) };
  }

  const row = state.rows.find((r) => r.id === parts[0]);
  const role = row ? roleOf(row) : null;
  if (!row || !role) throw new DemoRefusal(404, 'Introduction not found');
  const step = (action: IntroAction, extra: Partial<Row> = {}) => {
    const next = introTransition(row.status, role, action);
    if (!next) throw new DemoRefusal(403, 'That step is not yours to take now');
    Object.assign(row, { status: next, decidedAgeMs: 0 }, extra);
    save();
    return { intro: shape(row, now) };
  };

  if (parts.length === 1 && method === 'DELETE') return step('withdraw');
  if (parts[1] === 'forward' && method === 'POST') {
    const note = readForwardNote(body);
    if (!note.ok) refuse(note.problems);
    return step('forward', { forwardNote: note.value });
  }
  if (parts[1] === 'decline' && method === 'POST') return step('decline');
  if (parts[1] === 'not-now' && method === 'POST') return step('not_now');
  if (parts[1] === 'accept' && method === 'POST') {
    if (!introTransition(row.status, role, 'accept')) throw new DemoRefusal(403, 'That step is not yours to take now');
    if (!demoRoleCleared(now)) {
      throw new DemoRefusal(400, ROLE_VERIFICATION_COPY.en, { reason: 'role_verification_required', messageEl: ROLE_VERIFICATION_COPY.el });
    }
    const answer = previewCommitmentsApi(
      `/api/commitments/cards/${encodeURIComponent(row.cardId)}/interest`,
      `/api/commitments/cards/${encodeURIComponent(row.cardId)}/interest`,
      'POST',
      { note: `Introduced by ${person(row.intermediaryId).displayName}.` },
      now,
    ) as { thread: { id: string } };
    const res = step('accept', { threadId: answer.thread.id });
    return { ...res, cardId: row.cardId, threadId: answer.thread.id };
  }
  if (parts[1] === 'requester-methods' && method === 'GET') return { methods: ['work_email'] };
  return undefined;
}
