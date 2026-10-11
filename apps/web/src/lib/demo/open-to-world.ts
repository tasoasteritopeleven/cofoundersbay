import { OPEN_TO_PROBLEM_COPY, openToActive, openToExpiry, openToShownTo, readOpenTo, type OpenToSignal } from '@cofounderbay/shared';
import { DemoRefusal } from './demo-refusal';
import { demoMeVerified } from './verification-world';

/**
 * "Open to" in the preview demo, with the API's rules.
 *
 * Alex starts with no signal, so Settings shows the empty choice. The others
 * carry the visibilities the product offers: Elena and Dr. Sarah Kim show
 * theirs to everyone, Marcus and Nikos only to verified members (Alex is
 * verified in the demo, so Alex sees them), and Sofia's is matching-only and
 * never shown.
 */

const ME = 'preview-demo-user';
const STORAGE_KEY = 'cfb:demo-open-to:v1';
const DAY = 86_400_000;

type State = { mine: OpenToSignal | null; others: Record<string, OpenToSignal> };
let memory: State | null = null;

function seed(now: number): State {
  const until = (days: number) => new Date(now + days * DAY).toISOString();
  return {
    mine: null,
    others: {
      'user-elena': { kinds: ['cofounder'], visibility: 'everyone', note: null, expiresAt: until(60) },
      'user-marcus': { kinds: ['cofounder', 'advisor'], visibility: 'verified', note: 'B2B SaaS, remote from Berlin', expiresAt: until(75) },
      'user-nikos': { kinds: ['angel'], visibility: 'verified', note: 'Pre-seed, Greek founders', expiresAt: until(40) },
      'user-sarah': { kinds: ['mentor', 'advisor'], visibility: 'everyone', note: null, expiresAt: until(80) },
      'user-sofia': { kinds: ['advisor'], visibility: 'nobody', note: null, expiresAt: until(20) },
    },
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
  return memory;
}

function save() {
  try {
    if (memory && typeof window !== 'undefined') window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // storage blocked: the change lasts this page view
  }
}

export function resetDemoOpenTo() {
  memory = null;
  try {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Answers `/api/open-to/…` for the demo, or `undefined` for any other path. */
export function previewOpenToApi(pathname: string, method: string, body: Record<string, unknown>, now: number): unknown {
  if (!pathname.startsWith('/api/open-to/')) return undefined;
  const state = load(now);
  const who = decodeURIComponent(pathname.split('/')[3] ?? '');
  if (who === 'me') {
    if (method === 'GET') return { signal: state.mine, active: openToActive(state.mine, now) };
    if (method === 'PUT') {
      const read = readOpenTo(body);
      if (!read.ok) {
        throw new DemoRefusal(400, read.problems.map((p) => OPEN_TO_PROBLEM_COPY[p].en).join(' '), {
          reason: 'open_to_invalid',
          problems: read.problems,
          messageEl: read.problems.map((p) => OPEN_TO_PROBLEM_COPY[p].el).join(' '),
        });
      }
      state.mine = { ...read.value, expiresAt: openToExpiry(now) };
      save();
      return { signal: state.mine, active: true };
    }
    if (method === 'DELETE') {
      state.mine = null;
      save();
      return { signal: null, active: false };
    }
    return undefined;
  }
  if (method !== 'GET' || !who) return undefined;
  const signal = who === ME ? state.mine : state.others[who];
  return { kinds: openToShownTo(signal, { isOwner: who === ME, verified: demoMeVerified(now) }, now) };
}
