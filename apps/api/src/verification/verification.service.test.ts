import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { maskEmail, meetsLadderPolicy, meetsRolePolicy, methodsFromLinkedInReport, workEmailDomain } from '@cofounderbay/shared';
import { LINKEDIN_VERIFICATION_REPORT, VerificationService } from './verification.service';

describe('shared verification rules', () => {
  it('accepts company domains and refuses personal mail providers, Greek ones included', () => {
    expect(workEmailDomain('Maria@Harbor.example')).toEqual({ ok: true, domain: 'harbor.example' });
    expect(workEmailDomain('maria@gmail.com')).toEqual({ ok: false, reason: 'free_mail' });
    expect(workEmailDomain('maria@otenet.gr')).toEqual({ ok: false, reason: 'free_mail' });
    expect(workEmailDomain('not an email')).toEqual({ ok: false, reason: 'invalid' });
    expect(maskEmail('maria@harbor.example')).toBe('m···@harbor.example');
  });

  it('meets the ladder policy with any active signal, not an expired one', () => {
    const now = Date.parse('2026-10-07T12:00:00Z');
    expect(meetsLadderPolicy([], now)).toBe(false);
    expect(meetsLadderPolicy([{ method: 'work_email', expiresAt: '2027-01-01T00:00:00Z' }], now)).toBe(true);
    expect(meetsLadderPolicy([{ method: 'work_email', expiresAt: '2026-01-01T00:00:00Z' }], now)).toBe(false);
    expect(meetsLadderPolicy([{ method: 'admin' }], now)).toBe(true);
  });

  it('asks investor and organisation roles for a workplace signal, and nobody else', () => {
    const now = Date.parse('2026-10-07T12:00:00Z');
    expect(meetsRolePolicy('founder', [], now)).toBe(true);
    expect(meetsRolePolicy('mentor', [], now)).toBe(true);
    expect(meetsRolePolicy('investor', [], now)).toBe(false);
    // Identity proves a person, not the fund they claim.
    expect(meetsRolePolicy('investor', [{ method: 'linkedin_identity' }], now)).toBe(false);
    expect(meetsRolePolicy('investor', [{ method: 'linkedin_workplace' }], now)).toBe(true);
    expect(meetsRolePolicy('org', [{ method: 'work_email', expiresAt: '2027-01-01T00:00:00Z' }], now)).toBe(true);
    expect(meetsRolePolicy('org', [{ method: 'work_email', expiresAt: '2026-01-01T00:00:00Z' }], now)).toBe(false);
    expect(meetsRolePolicy('investor', [{ method: 'admin' }], now)).toBe(true);
  });

  it('reads LinkedIn’s verificationReport categories', () => {
    expect(methodsFromLinkedInReport({ verifications: ['IDENTITY', 'WORKPLACE'] })).toEqual(['linkedin_identity', 'linkedin_workplace']);
    expect(methodsFromLinkedInReport({ verifications: [] })).toEqual([]);
    expect(methodsFromLinkedInReport({})).toEqual([]);
  });
});

function setup(env: Record<string, string> = {}) {
  const verifications: Record<string, any>[] = [];
  const challenges = new Map<string, Record<string, any>>();
  const roles: Array<{ userId: string; verifiedAt: Date }> = [];
  const prisma = {
    userVerification: {
      findMany: vi.fn(async ({ where }: { where: { userId: string } }) => verifications.filter((v) => v.userId === where.userId)),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const existing = verifications.find((v) => v.userId === where.userId_method.userId && v.method === where.userId_method.method);
        if (existing) return Object.assign(existing, update);
        const row = { id: `v-${verifications.length + 1}`, detail: null, expiresAt: null, ...create };
        verifications.push(row);
        return row;
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        const methods: string[] = where.method?.in ?? [where.method];
        for (let i = verifications.length - 1; i >= 0; i--) {
          if (verifications[i].userId === where.userId && methods.includes(verifications[i].method)) verifications.splice(i, 1);
        }
      }),
    },
    userRoleFacet: { findMany: vi.fn(async ({ where }: any) => roles.filter((r) => r.userId === where.userId)) },
    workEmailChallenge: {
      findUnique: vi.fn(async ({ where }: any) => challenges.get(where.userId) ?? null),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const row = { ...(challenges.get(where.userId) ?? create), ...(challenges.has(where.userId) ? update : {}) };
        challenges.set(where.userId, row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = challenges.get(where.userId)!;
        if (data.attempts?.increment) row.attempts = (row.attempts ?? 0) + data.attempts.increment;
        return row;
      }),
      delete: vi.fn(async ({ where }: any) => challenges.delete(where.userId)),
    },
  };
  const sent: Array<{ to: string; text?: string }> = [];
  const mailer = { sendEmail: vi.fn(async (p: { to: string; text?: string }) => void sent.push(p)) };
  const config = { get: (k: string) => env[k] };
  const service = new VerificationService(prisma as never, mailer as never, config as never);
  return { service, verifications, challenges, roles, sent };
}

const codeFrom = (text = '') => text.match(/\b(\d{6})\b/)?.[1] ?? '';

describe('VerificationService — work email', () => {
  it('refuses a personal mail address with a Greek reason', async () => {
    const { service } = setup();
    const err = await service.startWorkEmail('u1', { email: 'me@gmail.com' }).catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.getResponse().error.details).toMatchObject({ reason: 'free_mail', messageEl: expect.stringContaining('domain') });
  });

  it('mails a code, stores only its hash, and verifies the domain for a year', async () => {
    const { service, challenges, sent } = setup();
    expect(await service.startWorkEmail('u1', { email: 'Maria@Harbor.example' })).toEqual({ ok: true, sentTo: 'm···@harbor.example', expiresInMinutes: 15 });
    const code = codeFrom(sent[0].text);
    expect(code).toMatch(/^\d{6}$/);
    expect(JSON.stringify([...challenges.values()])).not.toContain(code);
    const me = await service.confirmWorkEmail('u1', { code });
    expect(me.verified).toBe(true);
    expect(me.signals).toEqual([expect.objectContaining({ method: 'work_email', detail: 'harbor.example' })]);
    const expires = new Date(me.signals[0].expiresAt as string).getTime();
    expect(expires - Date.now()).toBeGreaterThan(360 * 86_400_000);
    expect(challenges.has('u1')).toBe(false);
  });

  it('counts wrong codes, stops after five, and refuses an expired code', async () => {
    const { service, sent, challenges } = setup();
    await service.startWorkEmail('u1', { email: 'maria@harbor.example' });
    const code = codeFrom(sent[0].text);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await expect(service.confirmWorkEmail('u1', { code: wrong })).rejects.toThrow(/not right/);
    await expect(service.confirmWorkEmail('u1', { code })).rejects.toThrow(/Too many attempts/);
    await service.startWorkEmail('u1', { email: 'maria@harbor.example' });
    challenges.get('u1')!.expiresAt = new Date(Date.now() - 1000);
    await expect(service.confirmWorkEmail('u1', { code: codeFrom(sent[1].text) })).rejects.toThrow(/expired/);
  });

  it('counts a role the platform team verified, and lets a person remove only their own signals', async () => {
    const { service, roles } = setup();
    roles.push({ userId: 'u1', verifiedAt: new Date('2026-05-01') });
    expect((await service.me('u1')).signals).toEqual([expect.objectContaining({ method: 'admin' })]);
    expect(await service.isVerified('u1')).toBe(true);
    await expect(service.remove('u1', 'admin')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('VerificationService — Verified on LinkedIn', () => {
  afterEach(() => vi.unstubAllGlobals());
  const env = { LINKEDIN_VERIFY_ENABLED: 'true', LINKEDIN_CLIENT_ID: 'cid', LINKEDIN_CLIENT_SECRET: 'sec', JWT_SECRET: 'test-secret', FRONTEND_URL: 'https://app.example' };

  it('is off until configured', () => {
    const { service } = setup();
    expect(service.linkedInAvailable()).toBe(false);
    expect(() => service.linkedInAuthorizeUrl('u1')).toThrow(ServiceUnavailableException);
  });

  it('signs a short-lived state that a tamper or an expiry breaks', () => {
    const { service } = setup(env);
    const state = service.signState('u1', 1_000);
    expect(service.readState(state, 2_000)).toBe('u1');
    expect(service.readState(state, 1_000 + 11 * 60_000)).toBeNull();
    expect(service.readState(state.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')), 2_000)).toBeNull();
    const url = new URL(service.linkedInAuthorizeUrl('u1'));
    expect(url.searchParams.get('scope')).toBe('r_verify');
  });

  it('stores the categories LinkedIn reports, replacing earlier ones, and comes back to settings', async () => {
    const { service, verifications } = setup(env);
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) =>
      url === LINKEDIN_VERIFICATION_REPORT
        ? new Response(JSON.stringify({ verifications: ['IDENTITY'], id: 'x' }), { status: 200 })
        : new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await service.recordLinkedIn('u1', ['linkedin_workplace']);
    const back = await service.linkedInCallback('code-1', service.signState('u1'));
    expect(back).toBe('https://app.example/settings?verification=linkedin#verification');
    expect(verifications.map((v) => v.method)).toEqual(['linkedin_identity']);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ headers: { Authorization: 'Bearer tok' } });
  });

  it('refuses a forged state without calling LinkedIn', async () => {
    const { service } = setup(env);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await service.linkedInCallback('code', 'forged.state')).toBe('https://app.example/settings?verification=failed#verification');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
