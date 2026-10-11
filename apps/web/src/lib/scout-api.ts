import type { ScoutBrief, ScoutReason } from '@cofounderbay/shared';
import { apiRequest } from '@/lib/api';

/** The co-founder scout: the reader's brief and the people it proposes. It never sends anything. */

export interface ScoutProposal {
  id: string;
  status: 'proposed' | 'saved' | 'dismissed';
  score: number;
  reasons: ScoutReason[];
  draftNote: string;
  createdAt: string;
  person: { id: string; displayName: string; headline: string | null; avatarUrl: string | null; location: string | null };
}

export interface ScoutState {
  brief: ScoutBrief | null;
  lastRunAt: string | null;
  proposals: ScoutProposal[];
}

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const nul = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

function toProposal(raw: unknown): ScoutProposal {
  const p = rec(raw);
  const person = rec(p.person);
  const status = p.status === 'saved' || p.status === 'dismissed' ? p.status : 'proposed';
  return {
    id: str(p.id),
    status,
    score: typeof p.score === 'number' ? p.score : 0,
    reasons: (Array.isArray(p.reasons) ? p.reasons : []).map((r) => ({ en: str(rec(r).en), el: str(rec(r).el) || str(rec(r).en) })).filter((r) => r.en),
    draftNote: str(p.draftNote),
    createdAt: str(p.createdAt),
    person: { id: str(person.id), displayName: str(person.displayName) || 'Member', headline: nul(person.headline), avatarUrl: nul(person.avatarUrl), location: nul(person.location) },
  };
}

function toBrief(raw: unknown): ScoutBrief | null {
  const b = rec(raw);
  if (!str(b.role)) return null;
  return {
    role: str(b.role),
    skills: (Array.isArray(b.skills) ? b.skills : []).filter((s): s is string => typeof s === 'string'),
    place: nul(b.place),
    remoteOk: b.remoteOk !== false,
    commitment: (nul(b.commitment) as ScoutBrief['commitment']) ?? null,
    stage: (nul(b.stage) as ScoutBrief['stage']) ?? null,
    note: nul(b.note),
    active: b.active !== false,
  };
}

const toState = (raw: unknown): ScoutState => {
  const r = rec(raw);
  return { brief: toBrief(r.brief), lastRunAt: nul(r.lastRunAt), proposals: (Array.isArray(r.proposals) ? r.proposals : []).map(toProposal).filter((p) => p.id) };
};

export async function getScout(): Promise<ScoutState> {
  return toState(await apiRequest('/api/scout'));
}

export async function setScoutBrief(brief: Partial<ScoutBrief>): Promise<ScoutState> {
  return toState(await apiRequest('/api/scout/brief', { method: 'PUT', body: JSON.stringify(brief) }));
}

export async function runScout(lang: 'en' | 'el' = 'en'): Promise<ScoutState & { added: number }> {
  const raw = await apiRequest('/api/scout/run', { method: 'POST', body: JSON.stringify({ lang }) });
  return { ...toState(raw), added: typeof rec(raw).added === 'number' ? (rec(raw).added as number) : 0 };
}

const post = (id: string, verb: 'save' | 'dismiss' | 'restore') => apiRequest(`/api/scout/proposals/${encodeURIComponent(id)}/${verb}`, { method: 'POST' });
export const saveScoutProposal = (id: string) => post(id, 'save');
export const dismissScoutProposal = (id: string) => post(id, 'dismiss');
export const restoreScoutProposal = (id: string) => post(id, 'restore');
