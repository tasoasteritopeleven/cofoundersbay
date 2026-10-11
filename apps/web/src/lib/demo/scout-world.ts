import {
  SCOUT_PROBLEM_COPY,
  draftScoutNote,
  pickScoutProposals,
  readScoutBrief,
  scoreScoutCandidate,
  type ScoutBrief,
  type ScoutCandidate,
  type ScoutReason,
} from '@cofounderbay/shared';
import { DemoRefusal } from './demo-refusal';
import { recordDemoRefusal } from './transparency-world';

/**
 * The co-founder scout in the preview demo, with the API's rules.
 *
 * Alex's brief asks for a technical co-founder (TypeScript, AI) in Athens or
 * remote. The base is the demo world's people Alex is not already connected
 * to; Marcus, a TypeScript and AI engineer open to co-founding (shown to
 * verified members, which Alex is), scores highest. A run adds proposals and
 * contacts nobody; dismissed people are never proposed again.
 */

const STORAGE_KEY = 'cfb:demo-scout:v1';
const DAY = 86_400_000;

const BASE: ScoutCandidate[] = [
  { userId: 'user-marcus', displayName: 'Marcus Chen', headline: 'Technical cofounder · Full-stack', location: 'Berlin, Germany', skills: ['TypeScript', 'Next.js', 'AI'], openTo: ['cofounder', 'advisor'], openToVisible: ['cofounder', 'advisor'], verified: true },
  { userId: 'user-katerina', displayName: 'Katerina Nikolaou', headline: 'Founder at Ledgerly · ML engineer', location: 'Athens, Greece', skills: ['Python', 'AI', 'Data'], openTo: [], openToVisible: [], verified: true },
  { userId: 'user-giorgos', displayName: 'Giorgos Vlachos', headline: 'Founder at Agora B2B · Backend', location: 'Thessaloniki, Greece', skills: ['TypeScript', 'Postgres'], openTo: ['advisor'], openToVisible: [], verified: false },
  { userId: 'user-yannis', displayName: 'Yannis Petrou', headline: 'Founder at Kolo Labs', location: 'Athens, Greece', skills: ['Product', 'Hardware'], openTo: [], openToVisible: [], verified: true },
  { userId: 'user-christina', displayName: 'Christina Mavrou', headline: 'Founder at Aegis Health', location: 'Athens, Greece', skills: ['Healthcare', 'Sales'], openTo: [], openToVisible: [], verified: false },
];

type Row = { id: string; candidateId: string; score: number; reasons: ScoutReason[]; draftNote: string; status: 'proposed' | 'saved' | 'dismissed'; ageMs: number };
type State = { brief: ScoutBrief | null; lastRunAgeMs: number | null; rows: Row[]; seq: number; savedAt: number };
let memory: State | null = null;

const SEED_BRIEF: ScoutBrief = { role: 'Technical co-founder', skills: ['TypeScript', 'AI'], place: 'Athens', remoteOk: true, commitment: 'full_time', stage: 'building', note: null, active: true };

function runOnce(state: State, lang: 'en' | 'el' = 'en'): number {
  if (!state.brief) return 0;
  const seen = new Set(state.rows.map((r) => r.candidateId));
  const scored = BASE.filter((c) => !seen.has(c.userId)).map((c) => ({ c, ...scoreScoutCandidate(state.brief as ScoutBrief, c) }));
  const picked = pickScoutProposals(scored);
  for (const p of picked) {
    state.seq += 1;
    state.rows.push({ id: `scout-${state.seq}`, candidateId: p.c.userId, score: p.score, reasons: p.reasons, draftNote: draftScoutNote(state.brief, p.c, lang), status: 'proposed', ageMs: 0 });
  }
  state.lastRunAgeMs = 0;
  return picked.length;
}

function seed(now: number): State {
  const state: State = { brief: SEED_BRIEF, lastRunAgeMs: null, rows: [], seq: 0, savedAt: now };
  runOnce(state);
  for (const r of state.rows) r.ageMs = DAY;
  state.lastRunAgeMs = DAY;
  return state;
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
    memory.rows.forEach((r) => (r.ageMs += elapsed));
    if (memory.lastRunAgeMs !== null) memory.lastRunAgeMs += elapsed;
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

export function resetDemoScout() {
  memory = null;
  try {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function view(state: State, now: number) {
  const person = (id: string) => {
    const c = BASE.find((b) => b.userId === id);
    return { id, displayName: c?.displayName ?? 'Member', headline: c?.headline ?? null, avatarUrl: null, location: c?.location ?? null };
  };
  return {
    brief: state.brief,
    lastRunAt: state.lastRunAgeMs === null ? null : new Date(now - state.lastRunAgeMs).toISOString(),
    proposals: state.rows
      .filter((r) => r.status !== 'dismissed')
      .sort((a, b) => b.score - a.score)
      .map((r) => ({ id: r.id, status: r.status, score: r.score, reasons: r.reasons, draftNote: r.draftNote, createdAt: new Date(now - r.ageMs).toISOString(), person: person(r.candidateId) })),
  };
}

/** Answers `/api/scout…` for the demo, or `undefined` for any other path. */
export function previewScoutApi(pathname: string, method: string, body: Record<string, unknown>, now: number): unknown {
  if (!pathname.startsWith('/api/scout')) return undefined;
  const state = load(now);
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent).slice(2);
  if (!parts.length && method === 'GET') return view(state, now);
  if (parts[0] === 'brief' && method === 'PUT') {
    const read = readScoutBrief(body);
    if (!read.ok) {
      if (read.problems.includes('contact')) recordDemoRefusal('contact_refused', 'scout_brief');
      if (read.problems.includes('promise')) recordDemoRefusal('promise_refused', 'scout_brief');
      throw new DemoRefusal(400, read.problems.map((p) => SCOUT_PROBLEM_COPY[p].en).join(' '), {
        reason: 'scout_brief_invalid',
        problems: read.problems,
        messageEl: read.problems.map((p) => SCOUT_PROBLEM_COPY[p].el).join(' '),
      });
    }
    state.brief = read.value;
    save();
    return view(state, now);
  }
  if (parts[0] === 'run' && method === 'POST') {
    if (!state.brief) throw new DemoRefusal(400, 'Write a brief first: the role you are looking for.', { reason: 'no_brief', messageEl: 'Γράψτε πρώτα ένα σημείωμα: τον ρόλο που ψάχνετε.' });
    const added = runOnce(state, body.lang === 'el' ? 'el' : 'en');
    save();
    return { added, ...view(state, now) };
  }
  if (parts[0] === 'proposals' && parts[1] && method === 'POST') {
    const row = state.rows.find((r) => r.id === parts[1]);
    if (!row) throw new DemoRefusal(404, 'Proposal not found');
    if (parts[2] === 'save') row.status = 'saved';
    else if (parts[2] === 'dismiss') row.status = 'dismissed';
    else if (parts[2] === 'restore') row.status = 'proposed';
    else return undefined;
    save();
    return { ok: true };
  }
  return undefined;
}
