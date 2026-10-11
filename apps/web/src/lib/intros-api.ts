import type { IntroRelation, IntroStatus } from '@cofounderbay/shared';
import { apiRequest } from '@/lib/api';

/** Warm introductions: the founder's requests, the ones to forward, and the ones received. */

export interface IntroPerson {
  id: string;
  displayName: string;
  headline: string | null;
  avatarUrl: string | null;
}

export interface Intro {
  id: string;
  role: 'requester' | 'intermediary' | 'target';
  status: IntroStatus | 'not_forwarded';
  requester: IntroPerson;
  intermediary: IntroPerson;
  target: IntroPerson;
  card: { id: string; title: string };
  note: string;
  forwardNote: string | null;
  toRequester: IntroRelation[];
  toTarget: IntroRelation[];
  threadId: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface IntroPath {
  intermediary: IntroPerson;
  toRequester: IntroRelation[];
  toTarget: IntroRelation[];
}

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const RELATIONS: IntroRelation[] = ['connection', 'mentor', 'cohort'];
const relations = (raw: unknown): IntroRelation[] => (Array.isArray(raw) ? raw.filter((r): r is IntroRelation => RELATIONS.includes(r as IntroRelation)) : []);
const STATUSES = ['pending', 'forwarded', 'declined', 'accepted', 'not_now', 'withdrawn', 'not_forwarded'];

function toPerson(raw: unknown): IntroPerson {
  const p = rec(raw);
  return { id: str(p.id), displayName: str(p.displayName, 'Member'), headline: typeof p.headline === 'string' ? p.headline : null, avatarUrl: typeof p.avatarUrl === 'string' ? p.avatarUrl : null };
}

export function toIntro(raw: unknown): Intro {
  const i = rec(raw);
  const role = i.role === 'intermediary' || i.role === 'target' ? i.role : 'requester';
  return {
    id: str(i.id),
    role,
    status: (STATUSES.includes(str(i.status)) ? i.status : 'pending') as Intro['status'],
    requester: toPerson(i.requester),
    intermediary: toPerson(i.intermediary),
    target: toPerson(i.target),
    card: { id: str(rec(i.card).id), title: str(rec(i.card).title) },
    note: str(i.note),
    forwardNote: typeof i.forwardNote === 'string' ? i.forwardNote : null,
    toRequester: relations(i.toRequester),
    toTarget: relations(i.toTarget),
    threadId: typeof i.threadId === 'string' ? i.threadId : null,
    createdAt: str(i.createdAt),
    decidedAt: typeof i.decidedAt === 'string' ? i.decidedAt : null,
  };
}

export interface IntroLists {
  sent: Intro[];
  toForward: Intro[];
  received: Intro[];
}

const listOf = (raw: unknown): Intro[] => (Array.isArray(raw) ? raw.map(toIntro) : []);

export async function listIntros(): Promise<IntroLists> {
  const r = rec(await apiRequest('/api/intros'));
  return { sent: listOf(r.sent), toForward: listOf(r.toForward), received: listOf(r.received) };
}

export async function getIntroPaths(targetId: string): Promise<{ direct: boolean; paths: IntroPath[]; cards: Array<{ id: string; title: string; kind: string }> }> {
  const r = rec(await apiRequest(`/api/intros/paths?targetId=${encodeURIComponent(targetId)}`));
  return {
    direct: r.direct === true,
    paths: (Array.isArray(r.paths) ? r.paths : []).map((p) => ({ intermediary: toPerson(rec(p).intermediary), toRequester: relations(rec(p).toRequester), toTarget: relations(rec(p).toTarget) })),
    cards: (Array.isArray(r.cards) ? r.cards : []).map((c) => ({ id: str(rec(c).id), title: str(rec(c).title), kind: str(rec(c).kind) })).filter((c) => c.id),
  };
}

const one = (raw: unknown) => toIntro(rec(raw).intro);

export async function requestIntro(input: { intermediaryId: string; targetId: string; cardId: string; note: string }): Promise<Intro> {
  return one(await apiRequest('/api/intros', { method: 'POST', body: JSON.stringify(input) }));
}

export async function withdrawIntro(id: string): Promise<Intro> {
  return one(await apiRequest(`/api/intros/${encodeURIComponent(id)}`, { method: 'DELETE' }));
}

export async function forwardIntro(id: string, note?: string): Promise<Intro> {
  return one(await apiRequest(`/api/intros/${encodeURIComponent(id)}/forward`, { method: 'POST', body: JSON.stringify({ note: note ?? '' }) }));
}

export async function declineIntro(id: string): Promise<Intro> {
  return one(await apiRequest(`/api/intros/${encodeURIComponent(id)}/decline`, { method: 'POST' }));
}

export async function acceptIntro(id: string): Promise<{ intro: Intro; cardId: string; threadId: string }> {
  const r = rec(await apiRequest(`/api/intros/${encodeURIComponent(id)}/accept`, { method: 'POST' }));
  return { intro: toIntro(r.intro), cardId: str(r.cardId), threadId: str(r.threadId) };
}

export async function notNowIntro(id: string): Promise<Intro> {
  return one(await apiRequest(`/api/intros/${encodeURIComponent(id)}/not-now`, { method: 'POST' }));
}
