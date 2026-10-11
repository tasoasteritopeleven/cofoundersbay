import { createHmac, timingSafeEqual } from 'crypto';

/**
 * A short-lived, HMAC-signed OAuth `state` that names who started the round
 * trip, so a callback that arrives without a session cookie still knows the
 * person, and a forged or replayed-late state is refused.
 */
export function signState(secret: string, userId: string, ttlMs = 10 * 60_000, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, e: now + ttlMs })).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function readState(secret: string, state: string, now = Date.now()): string | null {
  const [payload, sig] = state.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { u, e } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { u?: string; e?: number };
    return typeof u === 'string' && typeof e === 'number' && e > now ? u : null;
  } catch {
    return null;
  }
}
