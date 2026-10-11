import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { isHiddenFromSearch, isMembersOnlyProfile, profileVisibilitySchema } from '@cofounderbay/shared';
import { SearchService } from './search.service';
import { ProfileService } from '../profile/profile.service';

/**
 * Two of Settings' visibility switches hold everywhere they apply:
 * "Appear in search: off" (search, directory, recommendations, scout) and
 * "Public profile: off" (the profile read without signing in).
 */

describe('visibility rules', () => {
  it('reads only the values it knows, defaulting to visible', () => {
    expect(isHiddenFromSearch({ search: 'hidden' })).toBe(true);
    expect(isHiddenFromSearch({ search: 'visible' })).toBe(false);
    expect(isHiddenFromSearch(null)).toBe(false);
    expect(isHiddenFromSearch('hidden')).toBe(false);
    expect(isMembersOnlyProfile({ profile: 'members' })).toBe(true);
    expect(isMembersOnlyProfile({})).toBe(false);
    expect(profileVisibilitySchema.safeParse({ search: 'hidden', profile: 'members', location: 'private' }).success).toBe(true);
    expect(profileVisibilitySchema.safeParse({ search: 'secret' }).success).toBe(false);
  });
});

describe('search drops members hidden from search, on either path', () => {
  const prisma = {
    profile: {
      findMany: vi.fn(async () => [
        { userId: 'u-visible', visibilityRules: null },
        { userId: 'u-hidden', visibilityRules: { search: 'hidden' } },
      ]),
    },
    subscription: { findMany: vi.fn(async () => []) },
  };
  const meili = {
    isEnabled: () => true,
    searchProfiles: vi.fn(async () => ({ hits: [{ userId: 'u-visible' }, { userId: 'u-hidden' }], total: 7 })),
  };

  it('removes the hidden member and lowers the total by one', async () => {
    const service = new SearchService(prisma as never, meili as never);
    const result = await service.searchProfiles({ q: 'founder' });
    expect((result.hits as Array<{ userId: string }>).map((h) => h.userId)).toEqual(['u-visible']);
    expect(result.total).toBe(6);
  });
});

describe('the profile read without signing in', () => {
  function service(rules: unknown) {
    const prisma = {
      profile: {
        findUnique: vi.fn(async () => ({
          id: 'p1', userId: 'u1', displayName: 'Ada', headline: null, bio: null, location: 'Athens', timezone: null,
          languages: null, avatarUrl: null, rolePayload: null, visibilityRules: rules, skills: [],
          createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-02'),
        })),
      },
      user: { findUnique: vi.fn(async () => ({ role: 'founder', email: 'ada@example.com' })) },
    };
    const cache = { get: vi.fn(async () => null), set: vi.fn(async () => undefined), del: vi.fn() };
    return new ProfileService(prisma as never, {} as never, cache as never);
  }

  it('is not found for an anonymous reader when the profile is for members only', async () => {
    await expect(service({ profile: 'members' }).getPublicProfile('u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('is readable by a signed-in member, and by anyone when public', async () => {
    await expect(service({ profile: 'members' }).getPublicProfile('u1', 'viewer')).resolves.toMatchObject({ displayName: 'Ada' });
    await expect(service(null).getPublicProfile('u1')).resolves.toMatchObject({ displayName: 'Ada' });
  });
});
