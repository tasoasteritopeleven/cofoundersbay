import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommitmentOutcomes } from './CommitmentOutcomes';

vi.mock('@/lib/commitments-api', () => ({
  listCommitmentCards: vi.fn(async () => []),
  listCommitmentThreads: vi.fn(async () => []),
}));

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(cleanup);

describe('CommitmentOutcomes', () => {
  it('leads the founder with no cards to write the first one', async () => {
    renderWithQuery(<CommitmentOutcomes />);
    await screen.findByText(/No need cards yet/);
    const link = screen.getByRole('link', { name: /Write your first card/ });
    expect(link.getAttribute('href')).toBe('/commitments/new');
  });
});
