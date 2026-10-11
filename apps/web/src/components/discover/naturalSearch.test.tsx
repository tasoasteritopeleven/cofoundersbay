import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readNaturalSearch } from '@cofounderbay/shared';
import { resolvePreviewApi } from '@/lib/preview-api';
import { SearchFilters, type SearchFiltersValues } from './SearchFilters';

/**
 * Plain-language search on /discover (LinkedIn comparison §6.8).
 *
 * The field reads the words it knows into the sheet's filters; the strip
 * says what it read and offers the words back as typed. The demo directory
 * applies those filters the way the API does, so a reading that the API
 * would answer with one person answers with that person in the demo too.
 */

afterEach(cleanup);

const EMPTY: SearchFiltersValues = { q: '', role: [], skills: [], industries: [], stage: [], location: '', remote: null, availability: [], fundingStage: [], languages: [], sortBy: 'relevance' };

type Hit = { userId: string; displayName: string };
const search = (params: Record<string, string>) =>
  (resolvePreviewApi(`/api/search/profiles?${new URLSearchParams(params)}`) as { hits: Hit[] }).hits.map((h) => h.displayName);

describe('the demo directory applies what was read', () => {
  it('finds the Limassol fintech investor from a Greek request', () => {
    const read = readNaturalSearch('επενδυτής fintech Λεμεσός');
    expect(read.roles).toEqual(['investor']);
    expect(read.location).toBe('Limassol');
    const names = search({ roles: read.roles.join(','), industries: read.industries.join(','), location: read.location ?? '' });
    expect(names).toEqual(['Nikos Andreou']);
  });

  it('treats a co-founder candidate as a founder account, as the API does', () => {
    const names = search({ roles: 'founder', q: 'technical' });
    expect(names).toContain('Marcus Chen');
  });

  it('matches a place in either language and honours commitment', () => {
    expect(search({ location: 'Αθήνα', commitment: 'full-time' })).toContain('Elena Papadopoulos');
    expect(search({ location: 'Αθήνα', commitment: 'part-time' })).not.toContain('Elena Papadopoulos');
  });
});

describe('the read-as-filters strip', () => {
  it('names each filter read and gives the words back in one click', () => {
    const onSearchAsTyped = vi.fn();
    const interpreted = readNaturalSearch('συνιδρυτής fintech Θεσσαλονίκη part-time').understood;
    render(
      <SearchFilters filters={EMPTY} onFiltersChange={() => {}} onSearch={() => {}} interpreted={interpreted} onSearchAsTyped={onSearchAsTyped} />,
    );
    const strip = screen.getByRole('status');
    for (const label of ['Founder', 'Fintech', 'Thessaloniki', 'Part-time']) expect(strip.textContent).toContain(label);
    fireEvent.click(screen.getByRole('button', { name: /Search the words as typed/ }));
    expect(onSearchAsTyped).toHaveBeenCalledTimes(1);
  });

  it('is absent when nothing was read', () => {
    render(<SearchFilters filters={EMPTY} onFiltersChange={() => {}} onSearch={() => {}} interpreted={[]} />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('sends Enter in the field to the page, which decides how to read it', () => {
    const onSearch = vi.fn();
    render(<SearchFilters filters={{ ...EMPTY, q: 'investor Limassol' }} onFiltersChange={() => {}} onSearch={onSearch} />);
    fireEvent.keyDown(screen.getByRole('textbox', { name: /Search profiles/ }), { key: 'Enter' });
    expect(onSearch).toHaveBeenCalledTimes(1);
  });
});
