import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { signState } from '../common/signed-state';
import { ProfileImportService, SNAPSHOT_URL } from './profile-import.service';

const env = { LINKEDIN_DMA_ENABLED: 'true', LINKEDIN_CLIENT_ID: 'cid', LINKEDIN_CLIENT_SECRET: 'sec', JWT_SECRET: 's', FRONTEND_URL: 'https://app.example' };

function setup(config: Record<string, string> = env) {
  const drafts = new Map<string, any>();
  const prisma = {
    profileImportDraft: {
      upsert: vi.fn(async ({ where, create }: any) => void drafts.set(where.userId, create)),
      findUnique: vi.fn(async ({ where }: any) => drafts.get(where.userId) ?? null),
      delete: vi.fn(async ({ where }: any) => void drafts.delete(where.userId)),
    },
  };
  return { service: new ProfileImportService(prisma as never, { get: (k: string) => config[k] } as never), drafts };
}

describe('ProfileImportService (DMA portability)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is off until enabled, and asks only for the portability scope', () => {
    expect(() => setup({}).service.authorizeUrl('u1')).toThrow(ServiceUnavailableException);
    const url = new URL(setup().service.authorizeUrl('u1'));
    expect(url.searchParams.get('scope')).toBe('r_dma_portability_3rd_party');
  });

  it('reads the four domains, follows paging, keeps only allowlisted columns, and hands them over once', async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (!url.startsWith(SNAPSHOT_URL)) return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
      const domain = new URL(url).searchParams.get('domain');
      if (domain === 'PROFILE') return new Response(JSON.stringify({ elements: [{ snapshotDomain: 'PROFILE', snapshotData: [{ 'First Name': 'Elena', 'Birth Date': '1990-01-01', Address: 'Odos 1', Headline: 'Founder' }] }] }), { status: 200 });
      if (domain === 'SKILLS' && !url.includes('start=')) {
        return new Response(JSON.stringify({ elements: [{ snapshotData: [{ Name: 'Sales' }] }], paging: { links: [{ rel: 'next', href: '/rest/memberSnapshotData?q=criteria&domain=SKILLS&start=1' }] } }), { status: 200 });
      }
      if (domain === 'SKILLS') return new Response(JSON.stringify({ elements: [{ snapshotData: [{ Name: 'Product' }] }] }), { status: 200 });
      return new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { service } = setup();
    expect(await service.callback('code', signState('s', 'u1'))).toBe('https://app.example/profile/edit?import=linkedin');
    const first = await service.takeDraft('u1');
    expect(first.records).toEqual({ profile: [{ 'First Name': 'Elena', Headline: 'Founder' }], positions: [], education: [], skills: [{ Name: 'Sales' }, { Name: 'Product' }] });
    expect(JSON.stringify(first)).not.toMatch(/1990|Odos/);
    expect((await service.takeDraft('u1')).records).toBeNull();
    const snapshotCall = fetchMock.mock.calls.find(([u]) => String(u).startsWith(SNAPSHOT_URL));
    expect(snapshotCall?.[1]).toMatchObject({ headers: { Authorization: 'Bearer tok', 'LinkedIn-Version': '202312' } });
  });

  it('refuses a forged state, and an expired draft reads as none', async () => {
    const { service, drafts } = setup();
    vi.stubGlobal('fetch', vi.fn());
    expect(await service.callback('code', 'forged.x')).toBe('https://app.example/profile/edit?import=failed');
    drafts.set('u2', { userId: 'u2', records: {}, expiresAt: new Date(Date.now() - 1000) });
    expect(await service.takeDraft('u2')).toEqual({ records: null });
  });
});
