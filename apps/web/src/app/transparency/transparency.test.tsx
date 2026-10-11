import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getTransparencyReport, toTransparencyReport } from '@/lib/api';
import { resolvePreviewApi } from '@/lib/preview-api';
import { resetDemoCommitments } from '@/lib/demo/commitments-world';
import { resetDemoTransparency } from '@/lib/demo/transparency-world';
import TransparencyPage from './page';

/**
 * The transparency report (LinkedIn comparison §6.14): counts only, from
 * refusals the rules made and reports people filed. The demo counts the
 * refusals its own session made, and says its figures are a sample.
 */

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  getTransparencyReport: vi.fn(),
}));

afterEach(cleanup);
beforeEach(() => {
  resetDemoTransparency();
  resetDemoCommitments();
});

describe('the reader', () => {
  it('turns a partial payload into zeros, never invented figures', () => {
    const r = toTransparencyReport({ refusals: { contact_refused: { total: 3, bySurface: { conversation: 3, bogus: 'x' } } }, reports: { received: -2 } });
    expect(r.refusals.contact_refused).toEqual({ total: 3, bySurface: { conversation: 3 } });
    expect(r.refusals.promise_refused).toEqual({ total: 0, bySurface: {} });
    expect(r.reports).toEqual({ received: 0, resolved: 0, dismissed: 0, open: 0 });
    expect(r.sample).toBeUndefined();
  });
});

describe('the demo report', () => {
  it('counts what this session’s rules refused, by surface', () => {
    const board = resolvePreviewApi('/api/commitments/cards') as { cards: Array<{ id: string; isMine: boolean; outcome: string; kind: string }> };
    const card = board.cards.find((c) => c.id === 'need-aegis-growth')!;
    expect(card).toMatchObject({ isMine: false, outcome: 'open' });
    expect(() => resolvePreviewApi(`/api/commitments/cards/${card.id}/interest`, { method: 'POST', body: JSON.stringify({ note: 'Call me on 6912345678' }) })).toThrow();
    const report = toTransparencyReport(resolvePreviewApi('/api/public/transparency'));
    expect(report.sample).toBe(true);
    expect(report.inProgress).toBe(true);
    expect(report.refusals.contact_refused).toEqual({ total: 1, bySurface: { interest: 1 } });
  });

  it('refuses a malformed period', () => {
    expect(() => resolvePreviewApi('/api/public/transparency?period=soon')).toThrow();
  });
});

describe('the page', () => {
  it('shows the counts and the surfaces, and says when a period is still running', async () => {
    vi.mocked(getTransparencyReport).mockResolvedValue(
      toTransparencyReport({
        period: { key: '2026-H2', from: '2026-07-01T00:00:00.000Z', to: '2027-01-01T00:00:00.000Z' },
        inProgress: true,
        refusals: { contact_refused: { total: 15, bySurface: { conversation: 12, interest: 3 } }, promise_refused: { total: 0, bySurface: {} } },
        reports: { received: 9, resolved: 4, dismissed: 2, open: 3 },
        blocks: 5,
        generatedAt: '2026-10-07T09:00:00.000Z',
      }),
    );
    render(<QueryClientProvider client={new QueryClient()}><TransparencyPage /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByText('15')).toBeTruthy());
    expect(screen.getByText('12')).toBeTruthy();
    expect(document.body.textContent).toContain('this period is still running');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Transparency report');
  });
});
