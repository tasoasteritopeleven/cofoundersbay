import { describe, expect, it } from 'vitest';
import { defaultDiscoverFilters, readDiscoverUrl, writeDiscoverUrl } from './discover-url';

describe('Discover URLs', () => {
  it('round-trips manual or assistant filter state without adding another history entry', () => {
    const filters = { ...defaultDiscoverFilters, q: 'συνιδρυτής', location: 'Athens, Greece', availability: ['part-time'], skills: ['Engineering'], sortBy: 'recent' as const };
    const params = writeDiscoverUrl(new URLSearchParams('ref=home'), filters, 'mentor', 'matches');
    expect(readDiscoverUrl(params)).toEqual({ filters, roleChip: 'mentor', tab: 'matches' });
    expect(params.get('ref')).toBe('home');
    expect(writeDiscoverUrl(params, defaultDiscoverFilters, 'all', 'search').toString()).toBe('ref=home');
  });

  it('accepts saved-search URLs and ignores unrecognised chip, tab and sort choices', () => {
    const state = readDiscoverUrl(new URLSearchParams('roles=founder,mentor,founder&locations=Athens,Patras&tab=other&role=other&sort=other'));
    expect(state.filters).toMatchObject({ role: ['founder', 'mentor'], location: 'Athens', sortBy: 'relevance' });
    expect(state).toMatchObject({ roleChip: 'all', tab: 'search' });
  });
});
