import { DemoRefusal } from './demo-refusal';
import { maskEmail, meetsLadderPolicy, meetsRolePolicy, workEmailDomain, type VerificationMethod, type VerificationSignal } from '@cofounderbay/shared';

/**
 * Verification in the preview demo.
 *
 * The demo founder starts verified by work email, so the ladder walks through
 * terms as before; removing it in Settings shows the gate, and verifying
 * again takes the code the demo prints (`DEMO_CODE`), since no mail leaves the
 * browser. Other people's methods are fixed, for the badge beside their name.
 */

export const DEMO_CODE = '246810';
const STORAGE_KEY = 'cfb:demo-verification:v1';
const DAY = 86_400_000;

interface DemoVerificationState {
  signals: VerificationSignal[];
  pending: string | null;
}

/** Who in the demo world has proved what. */
const PEOPLE_METHODS: Record<string, VerificationMethod[]> = {
  'user-elena': ['work_email', 'linkedin_identity'],
  'user-sofia': ['work_email'],
  'user-christina': ['linkedin_workplace'],
  'user-dimitris': ['work_email', 'linkedin_identity'],
  'user-yannis': ['work_email'],
};

let memory: DemoVerificationState | null = null;

function seed(now: number): DemoVerificationState {
  return {
    signals: [{ method: 'work_email', detail: 'harbor-founders.example', verifiedAt: new Date(now - 40 * DAY).toISOString(), expiresAt: new Date(now + 325 * DAY).toISOString() }],
    pending: null,
  };
}

function load(now: number): DemoVerificationState {
  if (memory) return memory;
  try {
    const raw = typeof window !== 'undefined' ? window.sessionStorage.getItem(STORAGE_KEY) : null;
    memory = raw ? (JSON.parse(raw) as DemoVerificationState) : seed(now);
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

export function resetDemoVerification() {
  memory = null;
  try {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function demoMeVerified(now = Date.now()): boolean {
  return meetsLadderPolicy(load(now).signals, now);
}

/**
 * The demo reader's account role as the API's enum has it, from the role the
 * demo was opened as (`cfb_primary_role`): investor and organisation roles
 * take the stricter workplace rule, everyone else the ordinary one.
 */
export function demoBaseRole(): 'founder' | 'mentor' | 'investor' | 'org' {
  const cookie = typeof document !== 'undefined' ? document.cookie : '';
  const role = /(?:^|;\s*)cfb_primary_role=([a-z_]+)/.exec(cookie)?.[1] ?? '';
  if (role === 'angel_investor' || role === 'investor' || role === 'vc_partner') return 'investor';
  if (role === 'incubator_admin' || role === 'org_admin' || role === 'accelerator_admin') return 'org';
  if (role === 'mentor') return 'mentor';
  return 'founder';
}

/** `meetsRolePolicy` for the demo reader, with the demo's own signals. */
export function demoRoleCleared(now = Date.now()): boolean {
  return meetsRolePolicy(demoBaseRole(), load(now).signals, now);
}

export function demoPersonMethods(userId: string, now = Date.now()): VerificationMethod[] {
  // The demo founder's own badge follows Settings: remove the signal there and it goes.
  if (userId === 'preview-demo-user' || userId === 'preview') {
    return load(now).signals.filter((s) => !s.expiresAt || Date.parse(s.expiresAt) > now).map((s) => s.method);
  }
  return PEOPLE_METHODS[userId] ?? [];
}

function me(now: number) {
  const state = load(now);
  return { signals: state.signals, verified: meetsLadderPolicy(state.signals, now), linkedinAvailable: false, pendingWorkEmail: state.pending };
}


/** Answers `/api/verification/…` for the demo, or `undefined` for any other path. */
export function previewVerificationApi(pathname: string, method: string, body: Record<string, unknown>, now: number): unknown {
  if (!pathname.startsWith('/api/verification')) return undefined;
  const state = load(now);
  if (pathname === '/api/verification/me' && method === 'GET') return me(now);
  if (pathname.startsWith('/api/verification/of/') && method === 'GET') {
    return { methods: demoPersonMethods(decodeURIComponent(pathname.slice('/api/verification/of/'.length)), now) };
  }
  if (pathname === '/api/verification/work-email/start' && method === 'POST') {
    const email = typeof body.email === 'string' ? body.email : '';
    const check = workEmailDomain(email);
    if (!check.ok) {
      throw new DemoRefusal(400, check.reason === 'free_mail' ? 'Use an address at your company’s own domain; personal mail providers cannot prove a workplace.' : 'That is not an email address.', {
        reason: check.reason,
        messageEl: check.reason === 'free_mail' ? 'Χρησιμοποιήστε διεύθυνση στο domain της εταιρείας σας· οι προσωπικοί πάροχοι δεν αποδεικνύουν χώρο εργασίας.' : 'Αυτή δεν είναι διεύθυνση email.',
      });
    }
    state.pending = email.trim().toLowerCase();
    save();
    return { ok: true, sentTo: maskEmail(state.pending), expiresInMinutes: 15, demoCode: DEMO_CODE };
  }
  if (pathname === '/api/verification/work-email/confirm' && method === 'POST') {
    if (!state.pending) throw new DemoRefusal(400, 'The code expired; ask for a new one');
    if (String(body.code ?? '') !== DEMO_CODE) throw new DemoRefusal(400, 'That code is not right', { messageEl: 'Ο κωδικός δεν είναι σωστός.' });
    const domain = state.pending.split('@')[1];
    state.signals = [...state.signals.filter((s) => s.method !== 'work_email'), { method: 'work_email', detail: domain, verifiedAt: new Date(now).toISOString(), expiresAt: new Date(now + 365 * DAY).toISOString() }];
    state.pending = null;
    save();
    return me(now);
  }
  if (method === 'DELETE') {
    const target = decodeURIComponent(pathname.split('/').pop() ?? '');
    state.signals = state.signals.filter((s) => s.method !== target || s.method === 'admin');
    save();
    return me(now);
  }
  if (pathname === '/api/verification/linkedin/start') {
    throw new DemoRefusal(503, 'Verified on LinkedIn is not set up in the demo');
  }
  return undefined;
}

