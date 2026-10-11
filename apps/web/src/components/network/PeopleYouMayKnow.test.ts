import { describe, expect, it } from 'vitest';
import type { SearchHit } from '@/lib/api';
import { rankSuggested, wantedRoles } from './PeopleYouMayKnow';

const hit = (userId: string, role: string, extra: Partial<SearchHit> = {}): SearchHit =>
  ({ id: userId, userId, displayName: userId, headline: null, role, skillNames: [], industries: [], location: null, ...extra }) as unknown as SearchHit;

const me = { userId: 'me', role: 'founder', skills: ['Product'], industries: ['SaaS'], location: 'Athens, Greece', lookingFor: ['cofounder', 'mentor'] };

describe('people you may know', () => {
  it('reads "looking for" into the roles it asks for', () => {
    expect([...wantedRoles(['cofounder'])].sort()).toEqual(['cofounder', 'founder']);
    expect([...wantedRoles(['investor'])].sort()).toEqual(['angel_investor', 'investor']);
    expect(wantedRoles('cofounder').size).toBe(0);
    expect(wantedRoles([42, null]).size).toBe(0);
  });

  it('puts a wanted role first, then what is shared, and drops people with neither', () => {
    const ranked = rankSuggested(
      [
        hit('same-city', 'service_provider', { location: 'Athens, Greece' } as Partial<SearchHit>),
        hit('mentor', 'mentor'),
        hit('stranger', 'investor', { location: 'Oslo, Norway' } as Partial<SearchHit>),
        hit('shared-skill', 'investor', { skillNames: ['product'] } as Partial<SearchHit>),
      ],
      me,
      'me',
      6,
    );
    expect(ranked.map((r) => r.hit.userId)).toEqual(['mentor', 'shared-skill', 'same-city']);
    expect(ranked[0].wanted).toBe(true);
    expect(ranked[1].shared).toEqual(['product']);
  });

  it('never suggests the reader', () => {
    expect(rankSuggested([hit('me', 'founder')], me, 'me', 6)).toEqual([]);
  });
});
