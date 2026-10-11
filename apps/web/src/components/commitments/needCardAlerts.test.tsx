import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createSavedSearch } from '@/lib/api';
import { resolvePreviewApi } from '@/lib/preview-api';
import { resetDemoSavedSearches } from '@/lib/demo/saved-searches-world';
import { resetDemoCommitments } from '@/lib/demo/commitments-world';
import { ToastProvider } from '@/components/ui/toast';
import { NeedCardAlertDialog } from './NeedCardAlertDialog';

/**
 * Alerts on new need cards (LinkedIn comparison §6.7): the Opportunities
 * filters become a saved search over other members' need cards, which the
 * alert pass and the weekly digest then report on.
 */

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  createSavedSearch: vi.fn(async () => ({ search: { id: 'ss-x' } })),
}));

afterEach(cleanup);
beforeEach(() => {
  resetDemoSavedSearches();
  resetDemoCommitments();
  vi.mocked(createSavedSearch).mockClear();
});

const wrap = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );

describe('the alert dialog', () => {
  it('saves the visible filters as a need-card search with alerts on, weekly by default', async () => {
    const onOpenChange = vi.fn();
    wrap(<NeedCardAlertDialog open onOpenChange={onOpenChange} kinds={['cofounder']} remoteOnly search="fintech" />);
    expect((screen.getByLabelText(/Name/) as HTMLInputElement).value).toBe('Co-founder cards · fintech · remote');
    fireEvent.click(screen.getByRole('button', { name: /Save alert/ }));
    await waitFor(() => expect(createSavedSearch).toHaveBeenCalledTimes(1));
    expect(createSavedSearch).toHaveBeenCalledWith({
      scope: 'need_cards',
      name: 'Co-founder cards · fintech · remote',
      query: 'fintech',
      filters: { kinds: ['cofounder'], remote: ['true'] },
      alertsEnabled: true,
      alertFrequency: 'weekly',
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('lets the pace be chosen', async () => {
    wrap(<NeedCardAlertDialog open onOpenChange={() => {}} kinds={['cofounder', 'equity_role', 'investor_intro']} remoteOnly={false} search="" />);
    fireEvent.click(screen.getByRole('button', { name: /Within the hour/ }));
    fireEvent.click(screen.getByRole('button', { name: /Save alert/ }));
    await waitFor(() => expect(createSavedSearch).toHaveBeenCalledWith(expect.objectContaining({ name: 'Need cards', alertFrequency: 'instant', filters: { kinds: ['cofounder', 'equity_role', 'investor_intro'] } })));
  });
});

describe('need-card searches in the demo', () => {
  it('keeps only the board’s filters and counts other people’s open cards', () => {
    const { search } = resolvePreviewApi('/api/saved-searches', {
      method: 'POST',
      body: JSON.stringify({ scope: 'need_cards', name: 'Cards', filters: { kinds: ['cofounder', 'bogus'], roles: ['founder'] }, alertsEnabled: true, alertFrequency: 'weekly' }),
    }) as { search: { id: string; scope: string; filters: Record<string, unknown>; resultCount: number } };
    expect(search.scope).toBe('need_cards');
    expect(search.filters).toEqual({ kinds: ['cofounder'], remote: undefined });
    const run = resolvePreviewApi(`/api/saved-searches/${search.id}/run`, { method: 'POST' }) as { results: Array<{ kind: string }>; count: number };
    expect(run.count).toBe(search.resultCount);
    expect(run.results.every((c) => c.kind === 'cofounder')).toBe(true);
  });

  it('lists the seeded co-founder card search beside the people searches', () => {
    const { searches } = resolvePreviewApi('/api/saved-searches') as { searches: Array<{ id: string; scope?: string }> };
    expect(searches.find((s) => s.id === 'ss-cofounder-cards')?.scope).toBe('need_cards');
  });
});
