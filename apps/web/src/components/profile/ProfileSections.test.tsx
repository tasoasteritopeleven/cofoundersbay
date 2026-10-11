import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { SearchHit } from '@/lib/api';
import { ProfileActivity, ProfileExperience, rankSimilar } from './ProfileSections';

/**
 * The profile sections borrowed from a professional profile, adapted: Activity
 * is updates and need cards, Experience is only what the person entered or
 * imported, and "Similar profiles" ranks by what two people share.
 */

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('cfb_demo_data', '1');
  document.cookie = 'cfb_session=preview-demo; path=/';
});

const wrap = (ui: React.ReactNode) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

const hit = (userId: string, extra: Partial<SearchHit> = {}): SearchHit => ({
  id: userId, userId, displayName: userId, headline: null, bio: null, location: null, role: 'founder', skillNames: [], ...extra,
});

describe('similar profiles', () => {
  const person = { userId: 'me', role: 'founder', skills: ['Sales', 'SaaS'], industries: ['Fintech'], location: 'Athens, Greece' };

  it('ranks by shared skills and industry, never lists the person or the reader, and drops strangers', () => {
    const ranked = rankSimilar(
      [
        hit('me', { skillNames: ['Sales'] }),
        hit('reader', { skillNames: ['Sales'] }),
        hit('two-skills', { skillNames: ['sales', 'saas'] }),
        hit('industry', { industries: ['fintech'], role: 'mentor' }),
        hit('stranger', { role: 'investor', location: 'Oslo' }),
      ],
      person,
      'reader',
    );
    expect(ranked.map((r) => r.hit.userId)).toEqual(['two-skills', 'industry']);
    expect(ranked[0].shared).toEqual(['sales', 'saas']);
  });
});

describe('experience', () => {
  it('leaves an empty section off someone else’s profile', () => {
    const { container } = wrap(<ProfileExperience payload={{}} own={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('tells the owner how to fill it, and links to the editor section', () => {
    wrap(<ProfileExperience payload={{}} own />);
    expect(screen.getByText(/Add the roles you have held/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Edit/ }).getAttribute('href')).toBe('/profile/edit#experience');
  });

  it('lists roles newest first with their years, and schools apart', () => {
    wrap(
      <ProfileExperience
        own={false}
        payload={{
          experience: [
            { title: 'Engineer', company: 'Orion Grid', start: '2019', end: '2023' },
            { title: 'Co-founder', company: 'Taverna OS', start: '2023', end: '' },
          ],
          education: [{ school: 'Spree Institute', degree: 'BSc', start: '2013', end: '2017' }],
        }}
      />,
    );
    const roles = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(roles[0]).toMatch(/Co-founder.*Taverna OS.*2023 – now/);
    expect(roles[1]).toMatch(/Engineer.*Orion Grid.*2019 – 2023/);
    expect(screen.getByRole('heading', { name: /Education/ })).toBeTruthy();
  });
});

describe('activity', () => {
  it('shows a followed founder’s updates and need cards', async () => {
    wrap(<ProfileActivity userId="user-elena" own={false} />);
    await waitFor(() => expect(screen.getByText('Harbor: four clinics live')).toBeTruthy());
    expect(screen.getByRole('link', { name: /Commercial co-founder for Harbor/ }).getAttribute('href')).toBe('/commitments/need-harbor');
  });
});
