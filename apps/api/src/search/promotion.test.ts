import { describe, expect, it, vi } from 'vitest';
import { planPromotes, splitPromoted } from '@cofounderbay/shared';
import { SearchService } from './search.service';

describe('the promoted slot', () => {
  it('belongs to plans that sell it, and an explicit false wins', () => {
    expect(planPromotes({ name: 'pro', features: {} })).toBe(true);
    expect(planPromotes({ name: 'free', features: {} })).toBe(false);
    expect(planPromotes({ name: 'custom', features: { priorityDiscovery: true } })).toBe(true);
    expect(planPromotes({ name: 'team', features: { priorityDiscovery: false } })).toBe(false);
  });

  it('takes at most two people already in the results, and leaves the organic order alone', () => {
    const hits = ['a', 'b', 'c', 'd', 'e'].map((userId) => ({ userId }));
    const { promoted, organic } = splitPromoted(hits, ['d', 'b', 'e', 'zz']);
    expect(promoted.map((h) => h.userId)).toEqual(['b', 'd']);
    expect(organic.map((h) => h.userId)).toEqual(['a', 'c', 'e']);
  });

  it('marks only paying members in the page, and promotes nobody when the lookup fails', async () => {
    const findMany = vi.fn(async () => [
      { userId: 'u2', plan: { name: 'pro', features: {} } },
      { userId: 'u3', plan: { name: 'free', features: {} } },
    ]);
    const service = new SearchService({ subscription: { findMany } } as never, { isEnabled: () => false } as never);
    expect(await service.promotedAmong([{ userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }])).toEqual(['u2']);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: { in: ['u1', 'u2', 'u3'] }, status: { in: ['active', 'trialing'] } } }));
    const broken = new SearchService({ subscription: { findMany: vi.fn(async () => { throw new Error('down'); }) } } as never, {} as never);
    expect(await broken.promotedAmong([{ userId: 'u1' }])).toEqual([]);
  });
});
