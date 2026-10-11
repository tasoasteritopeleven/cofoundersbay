import {
  CONTACT_KIND_ORDER,
  describeContactKinds,
  isCommitmentKind,
  type CommitmentKind,
  type CommitmentOutcome,
  type CommitmentStep,
  type ContactKind,
  type NeedCardInput,
  type TermsFields,
  VERIFICATION_METHODS,
  type VerificationMethod,
} from '@cofounderbay/shared';
import { apiRequest } from '@/lib/api';

/**
 * The web client for need cards and the commitment ladder.
 *
 * Every payload is normalised here, at the boundary, so a page never has to
 * guard a missing array or an unknown enum value: a card always has an
 * `offer`, `evidence` is always an array, a thread always has `messages` and
 * `terms`. In the preview demo, `apiRequest` answers from the demo world
 * (`lib/demo/commitments-world.ts`), which applies the same shared rules.
 */

export type CardEvidence = { id: string; count?: number; value?: boolean };

/** The offer as it stood before a new version of the card. */
export type CardVersionEntry = {
  version: number;
  at: string | null;
  changed: string[];
  offer: { role: string; equity: string | null; hoursPerWeek: number | null; scope: string; commitment: string };
};

export type CommitmentPerson = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  headline: string | null;
  role: string | null;
  /** How the author is verified, for the badge; methods only, read live. */
  verifiedMethods?: VerificationMethod[];
};

export type CommitmentCard = {
  id: string;
  kind: CommitmentKind;
  title: string;
  exists: string;
  goal: string;
  missing: string;
  offer: { role: string; equity: string | null; hoursPerWeek: number; scope: string };
  category: string;
  place: string | null;
  isRemote: boolean;
  stage: string;
  commitment: string;
  projectRef: string | null;
  evidence: CardEvidence[];
  version: number;
  history: CardVersionEntry[];
  outcome: CommitmentOutcome;
  closedReason: string | null;
  settledAt: string | null;
  expiresAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  owner: CommitmentPerson;
  isMine: boolean;
  shareToken: string | null;
  shared: boolean;
  interestCount: number | null;
  myThreadId: string | null;
  myThreadStep: CommitmentStep | null;
};

export type PublicCommitmentCard = Pick<
  CommitmentCard,
  'id' | 'kind' | 'title' | 'exists' | 'goal' | 'missing' | 'offer' | 'category' | 'place' | 'isRemote' | 'stage' | 'commitment' | 'evidence' | 'version' | 'outcome' | 'settledAt'
> & { owner: Pick<CommitmentPerson, 'displayName' | 'headline' | 'avatarUrl' | 'verifiedMethods'> };

export type CommitmentThreadSummary = {
  id: string;
  cardId: string;
  cardTitle: string;
  cardKind: CommitmentKind;
  cardOutcome: CommitmentOutcome;
  cardVersion: number;
  answeredVersion: number;
  role: 'owner' | 'candidate';
  counterpart: CommitmentPerson;
  step: CommitmentStep;
  myConfirmed: boolean;
  latestTermsVersion: number;
  myAcceptedLatest: boolean;
  dealRoomActive: boolean;
  revisions: number;
  closedReason: string | null;
  agreedAt: string | null;
  closedAt: string | null;
  updatedAt: string | null;
};

export type CommitmentMessage = { id: string; authorId: string; mine: boolean; body: string; createdAt: string | null };

export type CommitmentTermsVersion = TermsFields & {
  version: number;
  proposedByMe: boolean;
  note: string | null;
  changed: string[];
  acceptedByMe: boolean;
  acceptedByThem: boolean;
  isLatest: boolean;
  createdAt: string | null;
};

export type CommitmentThread = {
  id: string;
  cardId: string;
  card: CommitmentCard;
  role: 'owner' | 'candidate';
  counterpart: CommitmentPerson;
  /** Terms need the reader verified; the other side's methods show as a badge. */
  verification: { meVerified: boolean; counterpartMethods: VerificationMethod[] };
  step: CommitmentStep;
  note: string | null;
  answeredVersion: number;
  myConfirmed: boolean;
  bothConfirmed: boolean;
  conversationReadOnly: boolean;
  revisions: number;
  dealRoomActive: boolean;
  agreedAt: string | null;
  closedReason: string | null;
  closedAt: string | null;
  messages: CommitmentMessage[];
  terms: CommitmentTermsVersion[];
};

const OUTCOMES: readonly CommitmentOutcome[] = ['open', 'in_discussion', 'agreed', 'closed'];
const STEPS: readonly CommitmentStep[] = ['interest', 'conversation', 'terms', 'agreed', 'closed'];

const str = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const strOrNull = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);
const num = (value: unknown, fallback = 0): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const numOrNull = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const rec = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {});
const outcomeOf = (value: unknown): CommitmentOutcome => (OUTCOMES.includes(value as CommitmentOutcome) ? (value as CommitmentOutcome) : 'open');
const stepOf = (value: unknown): CommitmentStep => (STEPS.includes(value as CommitmentStep) ? (value as CommitmentStep) : 'interest');

export function toCommitmentPerson(raw: unknown): CommitmentPerson {
  const p = rec(raw);
  return {
    id: str(p.id),
    displayName: str(p.displayName, 'Member') || 'Member',
    avatarUrl: strOrNull(p.avatarUrl),
    headline: strOrNull(p.headline),
    role: strOrNull(p.role),
    verifiedMethods: verifiedMethodsOf(p.verifiedMethods),
  };
}

/** Known methods only, so an unknown value from a newer API is not shown as a badge. */
export function verifiedMethodsOf(raw: unknown): VerificationMethod[] {
  return Array.isArray(raw) ? raw.filter((m): m is VerificationMethod => (VERIFICATION_METHODS as readonly string[]).includes(m as string)) : [];
}

export function toCommitmentCard(raw: unknown): CommitmentCard {
  const c = rec(raw);
  const offer = rec(c.offer);
  return {
    id: str(c.id),
    kind: isCommitmentKind(c.kind) ? c.kind : 'cofounder',
    title: str(c.title),
    exists: str(c.exists),
    goal: str(c.goal),
    missing: str(c.missing),
    offer: {
      role: str(offer.role),
      equity: strOrNull(offer.equity),
      hoursPerWeek: num(offer.hoursPerWeek),
      scope: str(offer.scope),
    },
    category: str(c.category),
    place: strOrNull(c.place),
    isRemote: c.isRemote === true,
    stage: str(c.stage),
    commitment: str(c.commitment),
    projectRef: strOrNull(c.projectRef),
    evidence: (Array.isArray(c.evidence) ? c.evidence : [])
      .map((e) => rec(e))
      .filter((e) => typeof e.id === 'string')
      .map((e) => ({ id: e.id as string, ...(typeof e.count === 'number' ? { count: e.count } : {}), ...(typeof e.value === 'boolean' ? { value: e.value } : {}) })),
    version: num(c.version, 1),
    history: (Array.isArray(c.history) ? c.history : []).map((h) => {
      const r = rec(h);
      const o = rec(r.offer);
      return {
        version: num(r.version, 1),
        at: strOrNull(r.at),
        changed: Array.isArray(r.changed) ? r.changed.filter((x): x is string => typeof x === 'string') : [],
        offer: { role: str(o.role), equity: strOrNull(o.equity), hoursPerWeek: numOrNull(o.hoursPerWeek), scope: str(o.scope), commitment: str(o.commitment) },
      };
    }),
    outcome: outcomeOf(c.outcome),
    closedReason: strOrNull(c.closedReason),
    settledAt: strOrNull(c.settledAt),
    expiresAt: strOrNull(c.expiresAt),
    createdAt: strOrNull(c.createdAt),
    updatedAt: strOrNull(c.updatedAt),
    owner: toCommitmentPerson(c.owner),
    isMine: c.isMine === true,
    shareToken: strOrNull(c.shareToken),
    shared: c.shared === true,
    interestCount: numOrNull(c.interestCount),
    myThreadId: strOrNull(c.myThreadId),
    myThreadStep: c.myThreadStep ? stepOf(c.myThreadStep) : null,
  };
}

export function toPublicCommitmentCard(raw: unknown): PublicCommitmentCard {
  const card = toCommitmentCard(raw);
  const owner = rec(rec(raw).owner);
  return {
    id: card.id,
    kind: card.kind,
    title: card.title,
    exists: card.exists,
    goal: card.goal,
    missing: card.missing,
    offer: card.offer,
    category: card.category,
    place: card.place,
    isRemote: card.isRemote,
    stage: card.stage,
    commitment: card.commitment,
    evidence: card.evidence,
    version: card.version,
    outcome: card.outcome,
    settledAt: card.settledAt,
    owner: { displayName: str(owner.displayName, 'Member') || 'Member', headline: strOrNull(owner.headline), avatarUrl: strOrNull(owner.avatarUrl), verifiedMethods: verifiedMethodsOf(owner.verifiedMethods) },
  };
}

export function toThreadSummary(raw: unknown): CommitmentThreadSummary {
  const t = rec(raw);
  return {
    id: str(t.id),
    cardId: str(t.cardId),
    cardTitle: str(t.cardTitle),
    cardKind: isCommitmentKind(t.cardKind) ? t.cardKind : 'cofounder',
    cardOutcome: outcomeOf(t.cardOutcome),
    cardVersion: num(t.cardVersion, 1),
    answeredVersion: num(t.answeredVersion, 1),
    role: t.role === 'owner' ? 'owner' : 'candidate',
    counterpart: toCommitmentPerson(t.counterpart),
    step: stepOf(t.step),
    myConfirmed: t.myConfirmed === true,
    latestTermsVersion: num(t.latestTermsVersion),
    myAcceptedLatest: t.myAcceptedLatest === true,
    dealRoomActive: t.dealRoomActive === true,
    revisions: num(t.revisions),
    closedReason: strOrNull(t.closedReason),
    agreedAt: strOrNull(t.agreedAt),
    closedAt: strOrNull(t.closedAt),
    updatedAt: strOrNull(t.updatedAt),
  };
}

function toTermsVersion(raw: unknown): CommitmentTermsVersion {
  const t = rec(raw);
  return {
    version: num(t.version, 1),
    proposedByMe: t.proposedByMe === true,
    role: str(t.role),
    equityPct: numOrNull(t.equityPct),
    vestingMonths: numOrNull(t.vestingMonths),
    cliffMonths: numOrNull(t.cliffMonths),
    hoursPerWeek: numOrNull(t.hoursPerWeek),
    scope: str(t.scope),
    note: strOrNull(t.note),
    changed: Array.isArray(t.changed) ? t.changed.filter((c): c is string => typeof c === 'string') : [],
    acceptedByMe: t.acceptedByMe === true,
    acceptedByThem: t.acceptedByThem === true,
    isLatest: t.isLatest === true,
    createdAt: strOrNull(t.createdAt),
  };
}

export function toCommitmentThread(raw: unknown): CommitmentThread {
  const t = rec(raw);
  return {
    id: str(t.id),
    cardId: str(t.cardId),
    card: toCommitmentCard(t.card),
    role: t.role === 'owner' ? 'owner' : 'candidate',
    counterpart: toCommitmentPerson(t.counterpart),
    // A server that does not send it does not gate on it either.
    verification: {
      meVerified: rec(t.verification).meVerified !== false,
      counterpartMethods: (Array.isArray(rec(t.verification).counterpartMethods) ? (rec(t.verification).counterpartMethods as unknown[]) : []).filter(
        (m): m is VerificationMethod => (VERIFICATION_METHODS as readonly unknown[]).includes(m),
      ),
    },
    step: stepOf(t.step),
    note: strOrNull(t.note),
    answeredVersion: num(t.answeredVersion, 1),
    myConfirmed: t.myConfirmed === true,
    bothConfirmed: t.bothConfirmed === true,
    conversationReadOnly: t.conversationReadOnly !== false,
    revisions: num(t.revisions),
    dealRoomActive: t.dealRoomActive === true,
    agreedAt: strOrNull(t.agreedAt),
    closedReason: strOrNull(t.closedReason),
    closedAt: strOrNull(t.closedAt),
    messages: (Array.isArray(t.messages) ? t.messages : []).map((m) => {
      const r = rec(m);
      return { id: str(r.id), authorId: str(r.authorId), mine: r.mine === true, body: str(r.body), createdAt: strOrNull(r.createdAt) };
    }),
    terms: (Array.isArray(t.terms) ? t.terms : []).map(toTermsVersion),
  };
}

// ── Requests ────────────────────────────────────────────────────────────────

export type CardFilters = {
  mine?: boolean;
  /** One member's cards (their profile's Activity). */
  owner?: string;
  kind?: string;
  stage?: string;
  category?: string;
  commitment?: string;
  place?: string;
  outcome?: string;
  projectRefs?: string[];
  q?: string;
  limit?: number;
};

export async function listCommitmentCards(filters: CardFilters = {}): Promise<CommitmentCard[]> {
  const sp = new URLSearchParams();
  if (filters.mine) sp.set('mine', '1');
  else if (filters.owner) sp.set('owner', filters.owner);
  for (const key of ['kind', 'stage', 'category', 'commitment', 'place', 'outcome', 'q'] as const) {
    const value = filters[key];
    if (value) sp.set(key, value);
  }
  if (filters.projectRefs?.length) sp.set('projectRefs', filters.projectRefs.join(','));
  if (filters.limit) sp.set('limit', String(filters.limit));
  const res = await apiRequest<{ cards?: unknown[] }>(`/api/commitments/cards${sp.toString() ? `?${sp}` : ''}`);
  return (Array.isArray(res?.cards) ? res.cards : []).map(toCommitmentCard);
}

export async function getCommitmentCard(id: string): Promise<CommitmentCard> {
  if (!id) throw new Error('Missing card');
  const res = await apiRequest<{ card?: unknown }>(`/api/commitments/cards/${encodeURIComponent(id)}`);
  return toCommitmentCard(res?.card);
}

const post = (body?: unknown): RequestInit => ({ method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export async function createCommitmentCard(input: NeedCardInput): Promise<CommitmentCard> {
  const res = await apiRequest<{ card?: unknown }>('/api/commitments/cards', post(input));
  return toCommitmentCard(res?.card);
}

export async function updateCommitmentCard(id: string, patch: Partial<NeedCardInput>): Promise<{ card: CommitmentCard; newVersion: boolean }> {
  const res = await apiRequest<{ card?: unknown; newVersion?: boolean }>(`/api/commitments/cards/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return { card: toCommitmentCard(res?.card), newVersion: res?.newVersion === true };
}

export async function closeCommitmentCard(id: string, reason: 'filled' | 'withdrawn'): Promise<{ previousOutcome: CommitmentOutcome }> {
  const res = await apiRequest<{ previousOutcome?: unknown }>(`/api/commitments/cards/${encodeURIComponent(id)}/close`, post({ reason }));
  return { previousOutcome: outcomeOf(res?.previousOutcome) };
}

export async function reopenCommitmentCard(id: string): Promise<CommitmentCard> {
  const res = await apiRequest<{ card?: unknown }>(`/api/commitments/cards/${encodeURIComponent(id)}/reopen`, post());
  return toCommitmentCard(res?.card);
}

export async function shareCommitmentCard(id: string): Promise<{ token: string; created: boolean }> {
  const res = await apiRequest<{ token?: unknown; created?: unknown }>(`/api/commitments/cards/${encodeURIComponent(id)}/share`, post());
  return { token: str(res?.token), created: res?.created === true };
}

export async function revokeCommitmentShare(id: string): Promise<void> {
  await apiRequest(`/api/commitments/cards/${encodeURIComponent(id)}/share`, { method: 'DELETE' });
}

export async function getPublicCommitmentCard(token: string): Promise<PublicCommitmentCard> {
  const res = await apiRequest<{ card?: unknown }>(`/api/commitments/public/${encodeURIComponent(token)}`, undefined, { retryOn401: false });
  return toPublicCommitmentCard(res?.card);
}

export async function expressCommitmentInterest(cardId: string, note?: string): Promise<{ threadId: string }> {
  const res = await apiRequest<{ thread?: { id?: unknown } }>(`/api/commitments/cards/${encodeURIComponent(cardId)}/interest`, post({ note: note ?? '' }));
  return { threadId: str(res?.thread?.id) };
}

export async function withdrawCommitmentInterest(threadId: string): Promise<void> {
  await apiRequest(`/api/commitments/threads/${encodeURIComponent(threadId)}/interest`, { method: 'DELETE' });
}

export async function acceptCommitmentInterest(threadId: string): Promise<CommitmentThread> {
  const res = await apiRequest<{ thread?: unknown }>(`/api/commitments/threads/${encodeURIComponent(threadId)}/accept`, post());
  return toCommitmentThread(res?.thread);
}

export async function listCommitmentThreads(as: 'owner' | 'candidate' | 'all' = 'all'): Promise<CommitmentThreadSummary[]> {
  const res = await apiRequest<{ threads?: unknown[] }>(`/api/commitments/threads?as=${as}`);
  return (Array.isArray(res?.threads) ? res.threads : []).map(toThreadSummary);
}

export async function getCommitmentThread(id: string): Promise<CommitmentThread> {
  if (!id) throw new Error('Missing conversation');
  const res = await apiRequest<{ thread?: unknown }>(`/api/commitments/threads/${encodeURIComponent(id)}`);
  return toCommitmentThread(res?.thread);
}

export async function sendCommitmentMessage(threadId: string, body: string): Promise<CommitmentMessage> {
  const res = await apiRequest<{ message?: unknown }>(`/api/commitments/threads/${encodeURIComponent(threadId)}/messages`, post({ body }));
  const m = rec(res?.message);
  return { id: str(m.id), authorId: str(m.authorId), mine: true, body: str(m.body, body), createdAt: strOrNull(m.createdAt) };
}

export async function confirmCommitment(threadId: string): Promise<{ bothConfirmed: boolean }> {
  const res = await apiRequest<{ bothConfirmed?: unknown }>(`/api/commitments/threads/${encodeURIComponent(threadId)}/confirm`, post());
  return { bothConfirmed: res?.bothConfirmed === true };
}

export async function retractCommitmentConfirmation(threadId: string): Promise<void> {
  await apiRequest(`/api/commitments/threads/${encodeURIComponent(threadId)}/confirm`, { method: 'DELETE' });
}

export async function proposeCommitmentTerms(
  threadId: string,
  terms: TermsFields & { note?: string | null },
): Promise<{ version: number; substantive: boolean }> {
  const res = await apiRequest<{ version?: unknown; substantive?: unknown }>(`/api/commitments/threads/${encodeURIComponent(threadId)}/terms`, post(terms));
  return { version: num(res?.version, 1), substantive: res?.substantive !== false };
}

export async function acceptCommitmentTerms(threadId: string, version: number): Promise<{ agreed: boolean }> {
  const res = await apiRequest<{ agreed?: unknown }>(`/api/commitments/threads/${encodeURIComponent(threadId)}/terms/${version}/accept`, post());
  return { agreed: res?.agreed === true };
}

export async function closeCommitmentDealRoom(threadId: string): Promise<void> {
  await apiRequest(`/api/commitments/threads/${encodeURIComponent(threadId)}/deal-room/close`, post());
}

export async function closeCommitmentThread(threadId: string, reason?: string): Promise<void> {
  await apiRequest(`/api/commitments/threads/${encodeURIComponent(threadId)}/close`, post({ reason: reason ?? '' }));
}

// ── Refusals ────────────────────────────────────────────────────────────────

/**
 * Why the server refused, in both languages, when it said why.
 *
 * The API puts the reason, the kinds of contact detail it found and the
 * Greek message in `details`; the preview demo throws the same shape. Any
 * other error falls back to its own message.
 */
export function commitmentRefusal(error: unknown): { en: string; el: string; kinds: ContactKind[]; reason: string | null } {
  const e = rec(error);
  const details = rec(e.details);
  const kinds = (Array.isArray(details.kinds) ? details.kinds : []).filter((k): k is ContactKind =>
    (CONTACT_KIND_ORDER as readonly string[]).includes(k as string),
  );
  const en = str(e.message, 'Something went wrong.') || 'Something went wrong.';
  const el = str(details.messageEl) || (kinds.length ? `Αφαιρέστε ${describeContactKinds(kinds).el} και δοκιμάστε ξανά.` : 'Κάτι πήγε στραβά.');
  return { en, el, kinds, reason: strOrNull(details.reason) };
}

/** How many of the reader's answers wait on authors, against the budget (shared INTEREST_BUDGET). */
export async function getInterestBudget(): Promise<{ budget: number; waiting: number; left: number }> {
  const r = (await apiRequest<{ budget?: unknown; waiting?: unknown; left?: unknown }>('/api/commitments/interest-budget')) ?? {};
  const n = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  return { budget: n(r.budget, 5), waiting: n(r.waiting, 0), left: n(r.left, 5) };
}
