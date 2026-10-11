import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { listCommitmentCards, type CommitmentCard } from '@/lib/commitments-api';
import { BOARD_LIMIT, NO_CHIPS, type CardChips } from '@/lib/need-card-wall';
import { useNeedCardWall } from './useNeedCardWall';

vi.mock('@/lib/commitments-api', () => ({ listCommitmentCards: vi.fn() }));

/**
 * The board holds the newest BOARD_LIMIT cards. While it holds them all the
 * chips filter it in the browser; once it is full a chosen chip also goes to
 * the server, so a card older than the board can still be found.
 */

afterEach(cleanup);
beforeEach(() => vi.mocked(listCommitmentCards).mockReset());

const card = (id: string, extra: Partial<CommitmentCard> = {}) =>
  ({ id, kind: 'cofounder', title: id, exists: '', goal: '', missing: '', offer: { role: '', equity: null, hoursPerWeek: 0, scope: '' }, category: 'SaaS', place: 'Athens, Greece', isRemote: false, stage: 'building', commitment: 'full_time', outcome: 'open', settledAt: null, isMine: false, ...extra }) as CommitmentCard;

function Probe({ chips }: { chips: CardChips }) {
  const wall = useNeedCardWall({ type: 'all', remoteOnly: false, search: '', chips });
  return <p>{wall.ready && !wall.isLoading ? `${wall.cards.map((c) => c.id).join(',') || 'none'}|${wall.full ? 'full' : 'all'}` : 'loading'}</p>;
}

const wrap = (chips: CardChips) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Probe chips={chips} /></QueryClientProvider>);

describe('need-card wall data', () => {
  it('filters in the browser while the board holds every card', async () => {
    vi.mocked(listCommitmentCards).mockResolvedValue([card('a'), card('b', { category: 'Health' })]);
    wrap({ ...NO_CHIPS, category: 'Health' });
    await screen.findByText('b|all');
    expect(listCommitmentCards).toHaveBeenCalledTimes(1);
  });

  it('asks the server with the chips once the board is full', async () => {
    const board = Array.from({ length: BOARD_LIMIT }, (_, i) => card(`n${i}`));
    vi.mocked(listCommitmentCards).mockImplementation(async (filters) =>
      filters?.category === 'Health' ? [card('old-health', { category: 'Health' })] : board,
    );
    wrap({ ...NO_CHIPS, category: 'Health' });
    await screen.findByText('old-health|full');
    await waitFor(() => expect(listCommitmentCards).toHaveBeenCalledWith({ limit: BOARD_LIMIT, category: 'Health' }));
  });
});
