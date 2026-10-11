import { describe, expect, it } from 'vitest';
import { railSectionFor } from './copilot-planner';
import { runCopilotTurn } from './copilot-engine';

/**
 * The assistant and the page rail.
 *
 * A railed page keeps its filters, totals, period and exports in the panel on
 * the right. The page context now lists that panel's sections; these check
 * that a reader asking for one is offered it, in either language, and that an
 * ordinary search that happens to say "filter" is not turned into a panel.
 */

const USERS_RAIL = [
  { id: 'totals', label: 'User totals', badge: 3 },
  { id: 'filters', label: 'Narrow the list', badge: 1 },
  { id: 'tools', label: 'List tools' },
];

describe('matching a request to a rail section', () => {
  it('finds the section a reader asks for by its family', () => {
    expect(railSectionFor('show me the filters', USERS_RAIL)?.id).toBe('filters');
    expect(railSectionFor('where are the totals?', USERS_RAIL)?.id).toBe('totals');
    expect(railSectionFor('open the period', [{ id: 'period', label: 'Period' }])?.id).toBe('period');
    // A status picker is how some pages filter.
    expect(
      railSectionFor('show me the filters', [
        { id: 'totals', label: 'Program totals' },
        { id: 'status', label: 'Program status' },
      ])?.id,
    ).toBe('status');
  });

  it('understands Greek', () => {
    expect(railSectionFor('Δείξε μου τα φίλτρα', USERS_RAIL)?.id).toBe('filters');
    expect(railSectionFor('πού είναι τα σύνολα;', USERS_RAIL)?.id).toBe('totals');
  });

  it('treats export as its own verb, and finds it inside a tools section', () => {
    expect(railSectionFor('export this list as csv', USERS_RAIL)?.id).toBe('tools');
    expect(railSectionFor('export', [{ id: 'export', label: 'Export' }])?.id).toBe('export');
  });

  it('leaves a search that mentions filtering alone', () => {
    // No verb of looking: this is a people search, not a request for a panel.
    expect(railSectionFor('filter founders in Athens', USERS_RAIL)).toBeUndefined();
  });

  it('offers nothing a page does not have', () => {
    expect(railSectionFor('show me the filters', [{ id: 'export', label: 'Export' }])).toBeUndefined();
    expect(railSectionFor('show me the filters', [])).toBeUndefined();
  });
});

describe('an assistant turn on a railed page', () => {
  const context = { route: '/admin/users', locale: 'en', rail: { sections: USERS_RAIL } };

  it('proposes opening the section, and changes nothing until confirmed', async () => {
    const turn = await runCopilotTurn('Show me the filters', context, { tools: [] });
    const card = turn.actions.find((a) => a.tool === 'open_rail_section');

    expect(card?.payload).toEqual({ section: 'filters', label: 'Narrow the list' });
    expect(card?.status).toBe('pending');
    expect(turn.message).toContain('Narrow the list');
  });

  it('proposes it in Greek to a Greek reader', async () => {
    const turn = await runCopilotTurn(
      'Δείξε μου τα φίλτρα',
      { ...context, locale: 'el', rail: { sections: [{ id: 'filters', label: 'Φιλτράρισμα λίστας' }] } },
      { tools: [] },
    );
    const card = turn.actions.find((a) => a.tool === 'open_rail_section');

    expect(card?.title).toBe('Άνοιγμα: Φιλτράρισμα λίστας');
    expect(card?.confirmLabel).toBe('Άνοιγμα');
  });

  it('names the panel’s sections, with their badges, when asked about the page', async () => {
    const turn = await runCopilotTurn('what am I looking at?', context, { tools: [] });
    expect(turn.message).toContain('Its tools panel has: User totals (3), Narrow the list (1), List tools.');
  });

  it('says nothing about a panel the page does not have', async () => {
    const turn = await runCopilotTurn('Show me the filters', { route: '/feed', locale: 'en' }, { tools: [] });
    expect(turn.actions.some((a) => a.tool === 'open_rail_section')).toBe(false);
  });
});
