import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AdminAnalyticsDashboard } from './AdminAnalyticsDashboard';
import { adminGetXPDistribution, adminGetBadgeUnlockRates } from '@/lib/api';

vi.mock('@/lib/api', () => ({ adminGetXPDistribution: vi.fn(), adminGetBadgeUnlockRates: vi.fn() }));
vi.mock('@/lib/chart-theme', () => ({ useChartTheme: () => ({ series: ['#333'] }) }));
vi.mock('@/components/common/BilingualText', () => ({ BilingualText: ({ en }: { en: string }) => <>{en}</> }));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: () => null, Bar: () => null, XAxis: () => null, YAxis: () => null,
  Tooltip: () => null, PieChart: () => null, Pie: () => null, Cell: () => null, Legend: () => null,
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('admin analytics feedback', () => {
  it('announces loading, exposes an error and retries the same reads', async () => {
    vi.mocked(adminGetXPDistribution).mockRejectedValueOnce(new Error('Offline')).mockResolvedValue([]);
    vi.mocked(adminGetBadgeUnlockRates).mockResolvedValue([]);
    render(<AdminAnalyticsDashboard />);
    expect(screen.getByRole('status').textContent).toContain('Loading analytics');
    expect((await screen.findByRole('alert')).textContent).toContain('Offline');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('button', { name: 'Refresh' });
    expect(adminGetXPDistribution).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(adminGetXPDistribution).toHaveBeenCalledTimes(3));
  });
});