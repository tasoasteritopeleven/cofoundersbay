import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { createSavedSearch } from '@/lib/api';
import { resolvePreviewApi } from '@/lib/preview-api';
import { resetDemoCommitments } from '@/lib/demo/commitments-world';
import { resetDemoSavedSearches } from '@/lib/demo/saved-searches-world';
import { NO_CHIPS, type CardChips } from '@/lib/need-card-wall';
import { ToastProvider } from '@/components/ui/toast';
import { NeedCardsSection } from './NeedCardsSection';
import { NeedCardAlertDialog } from './NeedCardAlertDialog';

/**
 * The need-card wall in Opportunities, against the demo board: four chips
 * over the cards, each offering only choices that show a card, an empty
 * state that names the chips, and an alert that keeps them.
 */

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  createSavedSearch: vi.fn(async () => ({ search: { id: 'ss-x' } })),
}));

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('cfb_demo_data', '1');
  document.cookie = 'cfb_session=preview-demo; path=/';
  resetDemoCommitments();
  resetDemoSavedSearches();
  vi.mocked(createSavedSearch).mockClear();
});

const wrap = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );

function Wall({ initial = NO_CHIPS, onChange }: { initial?: CardChips; onChange?: (c: CardChips) => void }) {
  const [chips, setChips] = useState(initial);
  return (
    <NeedCardsSection
      type="all"
      remoteOnly={false}
      search=""
      chips={chips}
      onChipsChange={(c) => {
        setChips(c);
        onChange?.(c);
      }}
    />
  );
}

const wallTitles = () =>
  within(screen.getByRole('list', { name: /Need cards/ }))
    .getAllByRole('heading')
    .map((h) => h.textContent);

describe('the need-card wall', () => {
  it('narrows by a chip, names the choice on the chip, and clears', async () => {
    wrap(<Wall />);
    await waitFor(() => expect(wallTitles().length).toBeGreaterThan(1));
    const everyCard = wallTitles();

    const category = screen.getByRole('button', { name: /^Category/ });
    expect(category.getAttribute('aria-expanded')).toBe('false');
    // A closed panel is hidden by class as well: a display utility would
    // outrank the bare attribute, and all four panels once showed at once.
    for (const key of ['category', 'place', 'stage', 'commitment']) {
      const panel = document.getElementById(`need-chip-${key}`)!;
      expect(panel.hidden).toBe(true);
      expect(panel.classList.contains('hidden')).toBe(true);
      expect(panel.classList.contains('flex')).toBe(false);
    }
    fireEvent.click(category);
    expect(category.getAttribute('aria-expanded')).toBe('true');
    const panel = screen.getByRole('group', { name: /^Category/ });
    // Each choice says how many cards it would show.
    const healthTech = within(panel).getByRole('button', { name: /HealthTech/ });
    expect(healthTech.textContent).toMatch(/1$/);
    fireEvent.click(healthTech);

    expect(wallTitles()).toEqual(['Head of growth for Aegis Health']);
    expect(screen.getByRole('button', { name: /^Category: HealthTech/ })).toBeTruthy();
    expect(screen.getByText(new RegExp(`1 of ${everyCard.length} cards`))).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Clear card filters/ }));
    expect(wallTitles()).toEqual(everyCard);
  });

  it('never offers a choice that would empty the wall', async () => {
    wrap(<Wall initial={{ ...NO_CHIPS, place: 'Thessaloniki' }} />);
    await waitFor(() => expect(wallTitles()).toEqual(['Head of growth for Aegis Health']));
    fireEvent.click(screen.getByRole('button', { name: /^Stage/ }));
    const stages = within(screen.getByRole('group', { name: /^Stage/ }))
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-pressed'));
    // "Any" plus the one stage a Thessaloniki card is at.
    expect(stages).toEqual(['true', 'false']);
  });

  it('says which chips emptied it, and offers every card back', async () => {
    const onChange = vi.fn();
    wrap(<Wall initial={{ ...NO_CHIPS, place: 'Thessaloniki', stage: 'idea' }} onChange={onChange} />);
    await screen.findByText(/No card fits Place: Thessaloniki · Stage: Idea/);
    fireEvent.click(screen.getByRole('button', { name: /^Show all \d+ cards/ }));
    expect(onChange).toHaveBeenCalledWith(NO_CHIPS);
  });
});

describe('the alert keeps the chips', () => {
  it('saves them as the filters the API alert reads, and names them', async () => {
    wrap(
      <NeedCardAlertDialog
        open
        onOpenChange={() => {}}
        kinds={['cofounder', 'equity_role', 'investor_intro']}
        remoteOnly={false}
        search=""
        chips={{ ...NO_CHIPS, category: 'HealthTech', commitment: 'part_time' }}
      />,
    );
    expect((screen.getByLabelText(/Name/) as HTMLInputElement).value).toBe('Need cards · Category: HealthTech · Commitment: Part time');
    fireEvent.click(screen.getByRole('button', { name: /Save alert/ }));
    await waitFor(() =>
      expect(createSavedSearch).toHaveBeenCalledWith(
        expect.objectContaining({ filters: { kinds: ['cofounder', 'equity_role', 'investor_intro'], categories: ['HealthTech'], commitments: ['part_time'] } }),
      ),
    );
  });

  it('is counted the same way in the demo as by the API', () => {
    const { search } = resolvePreviewApi('/api/saved-searches', {
      method: 'POST',
      body: JSON.stringify({ scope: 'need_cards', name: 'Cards', filters: { kinds: ['cofounder', 'equity_role', 'investor_intro'], places: ['Θεσσαλονίκη'], stage: ['validating', 'moon'] }, alertsEnabled: true, alertFrequency: 'weekly' }),
    }) as { search: { filters: Record<string, unknown>; resultCount: number } };
    expect(search.filters).toMatchObject({ places: ['Θεσσαλονίκη'], stage: ['validating'] });
    expect(search.resultCount).toBe(1);
  });
});
