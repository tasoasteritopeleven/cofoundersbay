import { UnauthorizedException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LINKEDIN_SCOPES, LINKEDIN_USERINFO_URL, LinkedInStrategy, linkedInProfileFromUserinfo } from './strategies/linkedin.strategy';
import { OAuthService } from './oauth.service';

/**
 * LinkedIn grants `r_liteprofile`/`r_emailaddress` only to apps created before
 * 1 August 2023. These tests pin the OpenID Connect flow that replaced them.
 */
describe('LinkedIn sign-in over OpenID Connect', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks for the OIDC scopes, never the retired ones', () => {
    expect([...LINKEDIN_SCOPES]).toEqual(['openid', 'profile', 'email']);
    const strategy = new LinkedInStrategy({ get: () => undefined } as never);
    const scope = (strategy as unknown as { options: { scope: string[] } }).options.scope;
    expect(scope).toEqual(['openid', 'profile', 'email']);
    expect(scope).not.toContain('r_liteprofile');
  });

  it('maps the userinfo claims, including LinkedIn’s own email_verified', () => {
    expect(
      linkedInProfileFromUserinfo({
        sub: 'abc123',
        name: 'Elena Papadopoulou',
        given_name: 'Elena',
        family_name: 'Papadopoulou',
        picture: 'https://media.licdn.com/x.jpg',
        email: 'Elena@Example.com',
        email_verified: true,
      }),
    ).toEqual({
      id: 'abc123',
      email: 'elena@example.com',
      emailVerified: true,
      displayName: 'Elena Papadopoulou',
      firstName: 'Elena',
      lastName: 'Papadopoulou',
      picture: 'https://media.licdn.com/x.jpg',
    });
    expect(linkedInProfileFromUserinfo({ sub: 'x', email: 'a@b.co' }).emailVerified).toBe(false);
    expect(() => linkedInProfileFromUserinfo({})).toThrow(/no subject/);
  });

  it('reads the member from /v2/userinfo with a bearer token', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ sub: 's1', email: 'a@b.co', email_verified: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const strategy = new LinkedInStrategy({ get: () => undefined } as never);
    const profile = await new Promise((resolve, reject) => strategy.userProfile('tok', (err, p) => (err ? reject(err) : resolve(p))));
    expect(fetchMock).toHaveBeenCalledWith(LINKEDIN_USERINFO_URL, { headers: { Authorization: 'Bearer tok' } });
    expect(profile).toMatchObject({ id: 's1', email: 'a@b.co', emailVerified: true });
  });

  it('passes a failed userinfo call back as an error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 401 })));
    const strategy = new LinkedInStrategy({ get: () => undefined } as never);
    await expect(new Promise((resolve, reject) => strategy.userProfile('bad', (err, p) => (err ? reject(err) : resolve(p))))).rejects.toThrow(/401/);
  });
});

describe('OAuthService.handleLinkedInLogin', () => {
  function serviceWith(existing: { id: string; email: string } | null) {
    const prisma = {
      user: {
        findUnique: vi.fn(async ({ where }: { where: { linkedinId?: string; email?: string } }) => (where.email && existing ? { ...existing, role: 'founder', hasCompletedOnboarding: true } : null)),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: object }) => ({ id: where.id, email: existing?.email, role: 'founder', hasCompletedOnboarding: true, ...data })),
        create: vi.fn(async ({ data }: { data: { email: string; emailVerified: boolean } }) => ({ id: 'new-user', email: data.email, emailVerified: data.emailVerified, role: 'founder', hasCompletedOnboarding: false })),
      },
    };
    const service = new OAuthService(prisma as never, {} as never, {} as never);
    vi.spyOn(service as unknown as { generateTokens: () => Promise<unknown> }, 'generateTokens').mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    return { service, prisma };
  }
  const base = { id: 'li-1', displayName: 'Elena', firstName: 'Elena', lastName: '', email: 'elena@example.com' };

  it('never links an existing account through an address LinkedIn has not verified', async () => {
    const { service, prisma } = serviceWith({ id: 'u1', email: 'elena@example.com' });
    await expect(service.handleLinkedInLogin({ ...base, emailVerified: false })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('links an existing account when LinkedIn verified the address', async () => {
    const { service, prisma } = serviceWith({ id: 'u1', email: 'elena@example.com' });
    const result = await service.handleLinkedInLogin({ ...base, emailVerified: true });
    expect(result.user.id).toBe('u1');
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { linkedinId: 'li-1' } });
  });

  it('marks a new account’s email verified only when LinkedIn said so', async () => {
    const { service, prisma } = serviceWith(null);
    await service.handleLinkedInLogin({ ...base, emailVerified: false });
    expect(prisma.user.create.mock.calls[0][0].data.emailVerified).toBe(false);
  });
});
