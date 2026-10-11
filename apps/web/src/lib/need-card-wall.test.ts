import { describe, expect, it } from 'vitest';
import type { CommitmentCard } from '@/lib/commitments-api';
import {
  NO_CHIPS,
  applyChips,
  boardCards,
  chipOptions,
  chipSummary,
  chipsFromParams,
  chipsToSavedFilters,
  cityOf,
  savedFiltersToParams,
} from './need-card-wall';

/**
 * The need-card wall's rules (StreetUpper-style chips, adapted): the board
 * shows what any member may see, each chip offers only choices that would
 * show a card, and the alert and a saved search read the same chips back.
 */

const card = (id: string, extra: Partial<CommitmentCard> = {}): CommitmentCard =>
  ({
    id,
    kind: 'cofounder',
    title: id,
    exists: '',
    goal: '',
    missing: '',
    offer: { role: 'Co-founder', equity: null, hoursPerWeek: 40, scope: '' },
    category: 'B2B SaaS',
    place: 'Athens, Greece',
    isRemote: false,
    stage: 'building',
    commitment: 'full_time',
    outcome: 'open',
    settledAt: null,
    isMine: false,
    ...extra,
  }) as CommitmentCard;

const NOW = Date.parse('2026-10-08T12:00:00Z');
const all = { kinds: ['cofounder', 'equity_role', 'investor_intro'] as const, remoteOnly: false, search: '', now: NOW };

describe('the board', () => {
  it('shows other people’s cards that take interest, and agreed ones for thirty days', () => {
    const shown = boardCards(
      [
        card('open'),
        card('mine', { isMine: true }),
        card('closed', { outcome: 'closed' }),
        card('agreed-recent', { outcome: 'agreed', settledAt: '2026-10-01T00:00:00Z' }),
        card('agreed-old', { outcome: 'agreed', settledAt: '2026-07-01T00:00:00Z' }),
      ],
      all,
    ).map((c) => c.id);
    expect(shown).toEqual(['open', 'agreed-recent']);
  });

  it('keeps the page’s type, remote and word filters', () => {
    const cards = [card('a', { kind: 'investor_intro', isRemote: true }), card('b', { title: 'Fintech CTO' })];
    expect(boardCards(cards, { ...all, kinds: ['investor_intro'] }).map((c) => c.id)).toEqual(['a']);
    expect(boardCards(cards, { ...all, remoteOnly: true }).map((c) => c.id)).toEqual(['a']);
    expect(boardCards(cards, { ...all, search: 'fintech' }).map((c) => c.id)).toEqual(['b']);
  });
});

describe('chips', () => {
  const board = [
    card('harbor'),
    card('aegis', { category: 'HealthTech', place: 'Thessaloniki, Greece', stage: 'validating', commitment: 'part_time' }),
    card('orion', { category: 'CleanTech', place: null, isRemote: true, stage: 'building', commitment: 'advisory' }),
    card('kolo', { category: 'b2b saas', stage: 'idea', commitment: 'part_time' }),
  ];

  it('narrow by every chip at once, a category in any case and a place in either language', () => {
    expect(applyChips(board, { ...NO_CHIPS, category: 'B2B SaaS' }).map((c) => c.id)).toEqual(['harbor', 'kolo']);
    expect(applyChips(board, { ...NO_CHIPS, place: 'Αθήνα' }).map((c) => c.id)).toEqual(['harbor', 'kolo']);
    expect(applyChips(board, { ...NO_CHIPS, category: 'B2B SaaS', commitment: 'part_time' }).map((c) => c.id)).toEqual(['kolo']);
  });

  it('offer only choices that show a card, counted with the other chips applied', () => {
    const options = chipOptions(board, { ...NO_CHIPS, commitment: 'part_time' });
    expect(options.category.map((o) => [o.en, o.count])).toEqual([['B2B SaaS', 1], ['HealthTech', 1]]);
    expect(options.place.map((o) => [o.value, o.count])).toEqual([['Athens', 1], ['Thessaloniki', 1]]);
    expect(options.stage.map((o) => o.value)).toEqual(['idea', 'validating']);
    // A chip's own choices ignore that chip, so another commitment can be picked.
    expect(options.commitment.map((o) => [o.value, o.count])).toEqual([['full_time', 1], ['part_time', 2], ['advisory', 1]]);
  });

  it('keeps a chosen value listed at zero so it can be seen and changed, with its Greek', () => {
    const options = chipOptions(board, { ...NO_CHIPS, category: 'CleanTech', stage: 'idea' });
    expect(options.stage.find((o) => o.value === 'idea')).toMatchObject({ count: 0, el: 'Ιδέα' });
    expect(options.category.find((o) => o.value === 'CleanTech')?.count).toBe(0);
  });

  it('are summarised in both languages for the empty state and the alert', () => {
    expect(chipSummary(NO_CHIPS)).toBeNull();
    expect(chipSummary({ ...NO_CHIPS, category: 'B2B SaaS', commitment: 'part_time' })).toEqual({
      en: 'Category: B2B SaaS · Commitment: Part time',
      el: 'Κατηγορία: B2B SaaS · Δέσμευση: Μερική απασχόληση',
    });
  });
});

describe('links and saved searches', () => {
  it('read chips from a link, dropping values the board does not use', () => {
    expect(chipsFromParams(new URLSearchParams('category=B2B%20SaaS&place=Athens&stage=moon&commitment=part_time'))).toEqual({
      category: 'B2B SaaS',
      place: 'Athens',
      stage: '',
      commitment: 'part_time',
    });
  });

  it('round-trip through the saved-search filters the API alert reads', () => {
    const chips = { category: 'HealthTech', place: 'Thessaloniki', stage: 'validating', commitment: 'part_time' };
    const filters = chipsToSavedFilters(chips);
    expect(filters).toEqual({ categories: ['HealthTech'], places: ['Thessaloniki'], stage: ['validating'], commitments: ['part_time'] });
    const params = new URLSearchParams();
    savedFiltersToParams(filters, params);
    expect(chipsFromParams(params)).toEqual(chips);
    expect(chipsToSavedFilters(NO_CHIPS)).toEqual({});
  });

  it('take the city from a place', () => {
    expect(cityOf('Athens, Greece')).toBe('Athens');
    expect(cityOf(null)).toBe('');
  });
});
