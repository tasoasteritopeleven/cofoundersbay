import { FOUNDER_UPDATE_PROBLEM_COPY, readFounderUpdate } from '@cofounderbay/shared';
import { DemoRefusal } from './demo-refusal';
import { recordDemoRefusal } from './transparency-world';

/**
 * Following and founder updates in the preview demo.
 *
 * Alex Demo follows Elena (Harbor) and Sofia (Meltemi) and is followed by
 * three people; each of the two has written to their followers, and Alex has
 * one public update of their own so the shared page (/u/[token]) has
 * something to show. The rules are the API's: `readFounderUpdate` refuses the
 * same drafts with the same bilingual reason, only the author is told a
 * public token, and switching back to followers retires it.
 *
 * State lives in sessionStorage; seeds carry ages, never fixed dates.
 */

const ME = 'preview-demo-user';
const STORAGE_KEY = 'cfb:demo-updates:v1';
const DAY = 86_400_000;

type Person = { id: string; displayName: string; headline: string | null; avatarUrl: null };

const PEOPLE: Record<string, Person> = {
  [ME]: { id: ME, displayName: 'Alex Demo', headline: 'Founder · Athens founder networks', avatarUrl: null },
  'user-elena': { id: 'user-elena', displayName: 'Elena Papadopoulos', headline: 'Founder & CEO at Harbor', avatarUrl: null },
  'user-sofia': { id: 'user-sofia', displayName: 'Sofia Alexiou', headline: 'Founder at Meltemi', avatarUrl: null },
  'user-marcus': { id: 'user-marcus', displayName: 'Marcus Chen', headline: 'Technical cofounder · Full-stack', avatarUrl: null },
  'user-sarah': { id: 'user-sarah', displayName: 'Dr. Sarah Kim', headline: 'Startup mentor · Former product lead · 3x founder', avatarUrl: null },
  'user-nikos': { id: 'user-nikos', displayName: 'Nikos Andreou', headline: 'Angel investor · Seed', avatarUrl: null },
  // The demo's organisation is an account too; following it is a follow like any other.
  'org-aegean': { id: 'org-aegean', displayName: 'Aegean Venture Lab', headline: 'A pre-seed and seed accelerator for founders in Greece and Cyprus', avatarUrl: null },
};

interface DemoUpdate {
  id: string;
  authorId: string;
  title: string;
  body: string;
  metrics: Array<{ label: string; value: string }>;
  asks: string[];
  visibility: 'followers' | 'public';
  publicToken: string | null;
  milestoneId: string | null;
  ageMs: number;
}

interface DemoUpdatesState {
  /** follower → people they follow */
  follows: Array<{ followerId: string; followingId: string }>;
  updates: DemoUpdate[];
  /** createdAt is stored as an age so a reload a day later still reads "3 days ago". */
  savedAt: number;
  seq: number;
}

let memory: DemoUpdatesState | null = null;

function seed(now: number): DemoUpdatesState {
  return {
    follows: [
      { followerId: ME, followingId: 'user-elena' },
      { followerId: ME, followingId: 'user-sofia' },
      { followerId: 'user-marcus', followingId: ME },
      { followerId: 'user-sarah', followingId: ME },
      { followerId: 'user-nikos', followingId: ME },
    ],
    updates: [
      {
        id: 'upd-elena-1',
        authorId: 'user-elena',
        title: 'Harbor: four clinics live',
        body: 'Two more clinics went live this month and the second cohort finished onboarding in nine days instead of twenty.',
        metrics: [{ label: 'Clinics live', value: '4' }, { label: 'Onboarding', value: '9 days' }],
        asks: ['An introduction to a dental chain operations lead'],
        visibility: 'followers',
        publicToken: null,
        milestoneId: null,
        ageMs: 2 * DAY,
      },
      {
        id: 'upd-sofia-1',
        authorId: 'user-sofia',
        title: 'Meltemi: pilot with two ferry operators',
        body: 'The booking pilot runs on two island routes. We are learning more from the cancellations than from the bookings.',
        metrics: [{ label: 'Routes', value: '2' }],
        asks: [],
        visibility: 'followers',
        publicToken: null,
        milestoneId: null,
        ageMs: 6 * DAY,
      },
      {
        id: 'upd-elena-0',
        authorId: 'user-elena',
        title: 'Harbor: first paid pilot',
        body: 'The first clinic signed a paid pilot after a six-week trial.',
        metrics: [{ label: 'Clinics live', value: '2' }],
        asks: [],
        visibility: 'followers',
        publicToken: null,
        milestoneId: null,
        ageMs: 33 * DAY,
      },
      {
        id: 'upd-me-1',
        authorId: ME,
        title: 'September: twelve founder interviews',
        body: 'We ran twelve interviews with founders in Athens and Thessaloniki. Most of them lose a co-founder search to vague terms, not to a lack of candidates.',
        metrics: [{ label: 'Interviews', value: '12' }, { label: 'Waitlist', value: '140' }],
        asks: ['A conversation with someone who ran a founder programme'],
        visibility: 'public',
        publicToken: 'demo-alex-sept',
        milestoneId: null,
        ageMs: 4 * DAY,
      },
    ],
    savedAt: now,
    seq: 1,
  };
}

function load(now: number): DemoUpdatesState {
  if (memory) return memory;
  try {
    const raw = typeof window !== 'undefined' ? window.sessionStorage.getItem(STORAGE_KEY) : null;
    memory = raw ? (JSON.parse(raw) as DemoUpdatesState) : seed(now);
  } catch {
    memory = seed(now);
  }
  // Ages move on with the clock between visits.
  const elapsed = Math.max(0, now - memory.savedAt);
  if (elapsed) {
    for (const u of memory.updates) u.ageMs += elapsed;
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

export function resetDemoUpdates() {
  memory = null;
  try {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

const person = (id: string): Person => PEOPLE[id] ?? { id, displayName: 'Member', headline: null, avatarUrl: null };

function shape(u: DemoUpdate, now: number) {
  const mine = u.authorId === ME;
  return {
    id: u.id,
    author: person(u.authorId),
    mine,
    title: u.title,
    body: u.body,
    metrics: u.metrics,
    asks: u.asks,
    visibility: u.visibility,
    publicToken: mine ? u.publicToken : null,
    milestoneId: u.milestoneId,
    createdAt: new Date(now - u.ageMs).toISOString(),
  };
}

const newest = (a: DemoUpdate, b: DemoUpdate) => a.ageMs - b.ageMs;

function followStatus(state: DemoUpdatesState, targetId: string) {
  return {
    following: state.follows.some((f) => f.followerId === ME && f.followingId === targetId),
    followers: state.follows.filter((f) => f.followingId === targetId).length,
  };
}

/** Answers `/api/follows…` and `/api/updates…` for the demo, or `undefined` for any other path. */
export function previewUpdatesApi(pathname: string, method: string, body: Record<string, unknown>, now: number): unknown {
  if (!pathname.startsWith('/api/follows') && !pathname.startsWith('/api/updates')) return undefined;
  const state = load(now);
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent); // ['api', 'follows' | 'updates', ...]

  if (parts[1] === 'follows') {
    if (parts.length === 2 && method === 'GET') {
      return { people: state.follows.filter((f) => f.followerId === ME).map((f) => person(f.followingId)) };
    }
    const target = parts[2];
    if (!target) return undefined;
    if (method === 'GET') return followStatus(state, target);
    if (method === 'POST') {
      if (target === ME) throw new DemoRefusal(400, 'You cannot follow yourself', { messageEl: 'Δεν μπορείτε να ακολουθήσετε τον εαυτό σας.' });
      if (!followStatus(state, target).following) state.follows.push({ followerId: ME, followingId: target });
      save();
      return followStatus(state, target);
    }
    if (method === 'DELETE') {
      state.follows = state.follows.filter((f) => !(f.followerId === ME && f.followingId === target));
      save();
      return followStatus(state, target);
    }
    return undefined;
  }

  // /api/updates…
  if (parts[2] === 'public' && parts[3] && method === 'GET') {
    const row = state.updates.find((u) => u.publicToken === parts[3] && u.visibility === 'public');
    if (!row) throw new DemoRefusal(404, 'This update is not public', { messageEl: 'Αυτή η ενημέρωση δεν είναι δημόσια.' });
    const { id: _id, author, mine: _mine, publicToken: _t, milestoneId: _m, ...rest } = shape(row, now);
    return { update: { ...rest, author: { displayName: author.displayName, headline: author.headline, avatarUrl: author.avatarUrl } } };
  }
  if (parts.length === 3 && parts[2] === 'mine' && method === 'GET') {
    return { updates: state.updates.filter((u) => u.authorId === ME).sort(newest).map((u) => shape(u, now)) };
  }
  if (parts.length === 4 && parts[2] === 'by' && method === 'GET') {
    // The API's rule: the author reads all, a follower all, anyone else the public ones.
    const author = parts[3];
    const own = author === ME;
    const following = own ? null : state.follows.some((f) => f.followerId === ME && f.followingId === author);
    const rows = state.updates.filter((u) => u.authorId === author && (own || following || u.visibility === 'public'));
    return { updates: rows.sort(newest).map((u) => shape(u, now)), following };
  }
  if (parts.length === 3 && parts[2] === 'feed' && method === 'GET') {
    const ids = new Set(state.follows.filter((f) => f.followerId === ME).map((f) => f.followingId));
    return { updates: state.updates.filter((u) => ids.has(u.authorId)).sort(newest).map((u) => shape(u, now)) };
  }
  if (parts.length === 2 && method === 'POST') {
    const read = readFounderUpdate(body);
    if (!read.ok) {
      if (read.problems.includes('promise')) recordDemoRefusal('promise_refused', 'founder_update');
      throw new DemoRefusal(400, read.problems.map((p) => FOUNDER_UPDATE_PROBLEM_COPY[p].en).join(' '), {
        reason: 'update_invalid',
        problems: read.problems,
        messageEl: read.problems.map((p) => FOUNDER_UPDATE_PROBLEM_COPY[p].el).join(' '),
      });
    }
    const v = read.value;
    state.seq += 1;
    const row: DemoUpdate = {
      id: `upd-me-${state.seq}-${Math.floor(now % 100000)}`,
      authorId: ME,
      ...v,
      publicToken: v.visibility === 'public' ? `demo-${state.seq}-${Math.floor(now % 100000).toString(36)}` : null,
      ageMs: 0,
    };
    state.updates.unshift(row);
    save();
    return { update: shape(row, now), notified: state.follows.filter((f) => f.followingId === ME).length };
  }
  const id = parts[2];
  const row = id ? state.updates.find((u) => u.id === id) : undefined;
  if (!id) return undefined;
  if (!row) throw new DemoRefusal(404, 'Update not found', { messageEl: 'Η ενημέρωση δεν βρέθηκε.' });
  if (parts.length === 3 && method === 'GET') return { update: shape(row, now) };
  if (row.authorId !== ME) throw new DemoRefusal(403, 'Only the author can change this update', { messageEl: 'Μόνο ο συντάκτης μπορεί να την αλλάξει.' });
  if (parts[3] === 'visibility' && method === 'PATCH') {
    const next = body.visibility === 'public' ? 'public' : 'followers';
    row.visibility = next;
    row.publicToken = next === 'public' ? (row.publicToken ?? `demo-${row.id}-${Math.floor(now % 100000).toString(36)}`) : null;
    save();
    return { update: shape(row, now) };
  }
  if (parts.length === 3 && method === 'DELETE') {
    state.updates = state.updates.filter((u) => u.id !== id);
    save();
    return { ok: true };
  }
  return undefined;
}
