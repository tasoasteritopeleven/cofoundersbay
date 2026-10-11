import type { OpenToKind, OpenToSignal, OpenToVisibility } from '@cofounderbay/shared';
import { isOpenToKind } from '@cofounderbay/shared';
import { apiRequest } from '@/lib/api';

/** The reader's own "Open to" signal, and what they may see of someone else's. */

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const kindsOf = (raw: unknown): OpenToKind[] => (Array.isArray(raw) ? raw.filter(isOpenToKind) : []);

function toSignal(raw: unknown): OpenToSignal | null {
  const s = rec(raw);
  if (!Array.isArray(s.kinds)) return null;
  const visibility = (['nobody', 'verified', 'everyone'] as const).includes(s.visibility as OpenToVisibility) ? (s.visibility as OpenToVisibility) : 'nobody';
  return { kinds: kindsOf(s.kinds), visibility, note: typeof s.note === 'string' ? s.note : null, expiresAt: typeof s.expiresAt === 'string' ? s.expiresAt : '' };
}

export interface MyOpenTo {
  signal: OpenToSignal | null;
  active: boolean;
}

const toMine = (raw: unknown): MyOpenTo => ({ signal: toSignal(rec(raw).signal), active: rec(raw).active === true });

export async function getMyOpenTo(): Promise<MyOpenTo> {
  return toMine(await apiRequest('/api/open-to/me'));
}

export async function setOpenTo(input: { kinds: OpenToKind[]; visibility: OpenToVisibility; note?: string | null }): Promise<MyOpenTo> {
  return toMine(await apiRequest('/api/open-to/me', { method: 'PUT', body: JSON.stringify(input) }));
}

export async function clearOpenTo(): Promise<MyOpenTo> {
  return toMine(await apiRequest('/api/open-to/me', { method: 'DELETE' }));
}

/** Empty unless the person's visibility lets this reader see it. */
export async function getOpenToFor(userId: string): Promise<OpenToKind[]> {
  return kindsOf(rec(await apiRequest(`/api/open-to/${encodeURIComponent(userId)}`)).kinds);
}
