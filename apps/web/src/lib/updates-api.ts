import { apiRequest } from '@/lib/api';

/** A person as the updates API names them. */
export interface UpdatePerson {
  id: string;
  displayName: string;
  headline: string | null;
  avatarUrl: string | null;
}

export interface FounderUpdate {
  id: string;
  author: UpdatePerson;
  mine: boolean;
  title: string;
  body: string;
  metrics: Array<{ label: string; value: string }>;
  asks: string[];
  visibility: 'followers' | 'public';
  /** Only the author is told it. */
  publicToken: string | null;
  milestoneId: string | null;
  createdAt: string;
}

/** The public page's shape: the author's name and headline, no ids. */
export interface PublicFounderUpdate {
  author: { displayName: string; headline: string | null; avatarUrl: string | null };
  title: string;
  body: string;
  metrics: Array<{ label: string; value: string }>;
  asks: string[];
  visibility: 'public';
  createdAt: string;
}

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);

function toPerson(raw: unknown): UpdatePerson {
  const p = rec(raw);
  return { id: str(p.id), displayName: str(p.displayName, 'Member'), headline: typeof p.headline === 'string' ? p.headline : null, avatarUrl: typeof p.avatarUrl === 'string' ? p.avatarUrl : null };
}

function toMetrics(raw: unknown): Array<{ label: string; value: string }> {
  return (Array.isArray(raw) ? raw : []).map((m) => ({ label: str(rec(m).label), value: str(rec(m).value) })).filter((m) => m.label && m.value);
}

export function toFounderUpdate(raw: unknown): FounderUpdate {
  const u = rec(raw);
  return {
    id: str(u.id),
    author: toPerson(u.author),
    mine: u.mine === true,
    title: str(u.title),
    body: str(u.body),
    metrics: toMetrics(u.metrics),
    asks: (Array.isArray(u.asks) ? u.asks : []).filter((a): a is string => typeof a === 'string'),
    visibility: u.visibility === 'public' ? 'public' : 'followers',
    publicToken: typeof u.publicToken === 'string' ? u.publicToken : null,
    milestoneId: typeof u.milestoneId === 'string' ? u.milestoneId : null,
    createdAt: str(u.createdAt),
  };
}

const list = (raw: unknown): FounderUpdate[] => (Array.isArray(rec(raw).updates) ? (rec(raw).updates as unknown[]).map(toFounderUpdate) : []);

export async function getMyUpdates(): Promise<FounderUpdate[]> {
  return list(await apiRequest('/api/updates/mine'));
}

/**
 * One person's updates as the reader may read them (profile Activity), and
 * whether the reader follows them: `null` on one's own profile.
 */
export async function getUpdatesBy(userId: string): Promise<{ updates: FounderUpdate[]; following: boolean | null }> {
  const raw = await apiRequest(`/api/updates/by/${encodeURIComponent(userId)}`);
  const following = rec(raw).following;
  return { updates: list(raw), following: typeof following === 'boolean' ? following : null };
}

export async function getUpdatesFeed(): Promise<FounderUpdate[]> {
  return list(await apiRequest('/api/updates/feed'));
}

export async function createUpdate(input: {
  title: string;
  body: string;
  metrics: Array<{ label: string; value: string }>;
  asks: string[];
  visibility: 'followers' | 'public';
  milestoneId?: string | null;
}): Promise<{ update: FounderUpdate; notified: number }> {
  const res = rec(await apiRequest('/api/updates', { method: 'POST', body: JSON.stringify(input) }));
  return { update: toFounderUpdate(res.update), notified: typeof res.notified === 'number' ? res.notified : 0 };
}

export async function setUpdateVisibility(id: string, visibility: 'followers' | 'public'): Promise<FounderUpdate> {
  return toFounderUpdate(rec(await apiRequest(`/api/updates/${encodeURIComponent(id)}/visibility`, { method: 'PATCH', body: JSON.stringify({ visibility }) })).update);
}

export async function deleteUpdate(id: string): Promise<{ ok: boolean }> {
  return apiRequest(`/api/updates/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function getPublicUpdate(token: string): Promise<PublicFounderUpdate | null> {
  const u = rec(rec(await apiRequest(`/api/updates/public/${encodeURIComponent(token)}`, undefined, { retryOn401: false })).update);
  if (!u.title) return null;
  const a = rec(u.author);
  return {
    author: { displayName: str(a.displayName, 'Member'), headline: typeof a.headline === 'string' ? a.headline : null, avatarUrl: typeof a.avatarUrl === 'string' ? a.avatarUrl : null },
    title: str(u.title),
    body: str(u.body),
    metrics: toMetrics(u.metrics),
    asks: (Array.isArray(u.asks) ? u.asks : []).filter((x): x is string => typeof x === 'string'),
    visibility: 'public',
    createdAt: str(u.createdAt),
  };
}

export interface FollowStatus {
  following: boolean;
  followers: number;
}

const toFollow = (raw: unknown): FollowStatus => ({ following: rec(raw).following === true, followers: typeof rec(raw).followers === 'number' ? (rec(raw).followers as number) : 0 });

export async function getFollowStatus(userId: string): Promise<FollowStatus> {
  return toFollow(await apiRequest(`/api/follows/${encodeURIComponent(userId)}`));
}

export async function followPerson(userId: string): Promise<FollowStatus> {
  return toFollow(await apiRequest(`/api/follows/${encodeURIComponent(userId)}`, { method: 'POST' }));
}

export async function unfollowPerson(userId: string): Promise<FollowStatus> {
  return toFollow(await apiRequest(`/api/follows/${encodeURIComponent(userId)}`, { method: 'DELETE' }));
}

export async function getFollowing(): Promise<UpdatePerson[]> {
  const people = rec(await apiRequest('/api/follows')).people;
  return Array.isArray(people) ? people.map(toPerson) : [];
}

export function publicUpdateUrl(token: string, origin = typeof window !== 'undefined' ? window.location.origin : ''): string {
  return `${origin}/u/${encodeURIComponent(token)}`;
}
