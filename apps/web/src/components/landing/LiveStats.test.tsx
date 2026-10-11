import { readFileSync } from 'node:fs';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPublicStats } from '@/lib/api';
import { LiveStatsGrid, LiveStatsStrip } from './LiveStats';

const apiMocks = vi.hoisted(() => ({ realGet: null as null | (() => Promise<unknown>) }));
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  apiMocks.realGet = actual.getPublicStats;
  return { ...actual, getPublicStats: vi.fn(actual.getPublicStats) };
});

/**
 * The landing page shows measured counts or nothing numeric at all — the
 * fabricated PLATFORM_STATS ("12,400+ members", "95% match accuracy") are
 * gone. In demo mode the numbers come from the demo world itself.
 */

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(cleanup);

describe('live landing stats', () => {
  it('renders no numbers until the counts arrive', async () => {
    vi.mocked(getPublicStats).mockResolvedValue(null);
    const { container } = renderWithQuery(
      <div>
        <LiveStatsStrip />
        <LiveStatsGrid />
      </div>,
    );
    // Both mounts render literally nothing — no skeleton with fake digits.
    await vi.waitFor(() => expect(getPublicStats).toHaveBeenCalled());
    expect(container.textContent ?? '').not.toMatch(/\d/);
    expect(container.firstElementChild?.children).toHaveLength(0);
  });

  it('renders the demo world’s own counts in demo mode', async () => {
    // The real getPublicStats: demo flag routes it to the preview handler,
    // which counts the demo world's people, connections and events.
    localStorage.setItem('cfb_demo_data', '1');
    vi.mocked(getPublicStats).mockImplementation(() => apiMocks.realGet!() as ReturnType<typeof getPublicStats>);
    renderWithQuery(<LiveStatsGrid />);
    await screen.findByText('Registered Members');
    for (const label of ['Accepted Connections', 'Mentors Available', 'Events Listed', 'Organizations']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    // The demo world knows 25 members and 4 mentors; the tiles show those,
    // not the old fabricated numbers.
    expect(screen.getByText('25')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText(/Live counts, measured today/)).toBeTruthy();
    expect(document.body.textContent ?? '').not.toContain('95%');
  });

  it('the landing page carries no fabricated figures', () => {
    const source = readFileSync('src/app/LandingHome.tsx', 'utf8');
    expect(source).not.toContain('95%');
    expect(source).not.toMatch(/'12,400|'3,200|'820\+|'240\+|'60\+/);
  });
});
