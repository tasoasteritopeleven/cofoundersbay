import { VERIFICATION_METHODS, type VerificationMethod, type VerificationSignal } from '@cofounderbay/shared';
import { apiRequest } from '@/lib/api';

/** The signed-in person's verification, from `GET /api/verification/me`. */
export interface MyVerification {
  signals: VerificationSignal[];
  verified: boolean;
  linkedinAvailable: boolean;
  pendingWorkEmail: string | null;
}

/** Partial payloads become a shaped object: no signals, not verified, LinkedIn off. */
export function toMyVerification(raw: unknown): MyVerification {
  const r = (raw ?? {}) as Partial<MyVerification>;
  return {
    signals: Array.isArray(r.signals) ? r.signals.filter((s): s is VerificationSignal => !!s && typeof s.method === 'string') : [],
    verified: r.verified === true,
    linkedinAvailable: r.linkedinAvailable === true,
    pendingWorkEmail: typeof r.pendingWorkEmail === 'string' ? r.pendingWorkEmail : null,
  };
}

/** How someone else is verified: methods only, unknown values dropped. */
export async function getVerifiedMethods(userId: string): Promise<VerificationMethod[]> {
  const raw = await apiRequest<unknown>(`/api/verification/of/${encodeURIComponent(userId)}`, undefined, { retryOn401: false });
  const methods = (raw as { methods?: unknown } | null)?.methods;
  return Array.isArray(methods) ? methods.filter((m): m is VerificationMethod => (VERIFICATION_METHODS as readonly string[]).includes(m as string)) : [];
}

export async function getMyVerification(): Promise<MyVerification> {
  return toMyVerification(await apiRequest('/api/verification/me'));
}

/** `demoCode` comes only from the preview demo, which sends no mail. */
export async function startWorkEmailVerification(email: string): Promise<{ ok: boolean; sentTo: string; expiresInMinutes: number; demoCode?: string }> {
  return apiRequest('/api/verification/work-email/start', { method: 'POST', body: JSON.stringify({ email }) });
}

export async function confirmWorkEmailVerification(code: string): Promise<MyVerification> {
  return toMyVerification(await apiRequest('/api/verification/work-email/confirm', { method: 'POST', body: JSON.stringify({ code }) }));
}

export async function removeVerification(method: VerificationMethod): Promise<MyVerification> {
  return toMyVerification(await apiRequest(`/api/verification/${encodeURIComponent(method)}`, { method: 'DELETE' }));
}

/** The LinkedIn consent page for Verified on LinkedIn; the caller navigates there. */
export async function startLinkedInVerification(): Promise<{ url: string }> {
  return apiRequest('/api/verification/linkedin/start');
}
