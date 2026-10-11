import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EngagementBreakdown, ProfileViewsChart } from './AnalyticsCharts';

const state = vi.hoisted(() => ({ showDemoData: false }));
vi.mock('@/contexts/DemoDataContext', () => ({ useDemoData: () => state }));
vi.mock('@/components/common/BilingualText', () => ({ BilingualText: ({ en }: { en: string }) => <>{en}</> }));
vi.mock('recharts', () => {
  const Empty = () => null;
  const Container = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const Chart = ({ data }: { data?: unknown }) => <output data-testid="chart">{JSON.stringify(data)}</output>;
  return { AreaChart: Chart, BarChart: Chart, Area: Empty, Bar: Empty, XAxis: Empty, YAxis: Empty, CartesianGrid: Empty, Tooltip: Empty, ResponsiveContainer: Container, PieChart: Container, Pie: Chart, Cell: Empty, Legend: Empty };
});
afterEach(() => { cleanup(); state.showDemoData = false; });

describe('analytics charts truthfulness', () => {
  it('shows unavailable rather than demo charts when live data is missing', () => {
    render(<><ProfileViewsChart data={[]} /><EngagementBreakdown /></>);
    expect(screen.queryAllByTestId('chart')).toHaveLength(0);
    expect(screen.getAllByText(/unavailable/i).length).toBeGreaterThan(0);
  });

  it('renders measured zeros and explicitly lists unavailable engagement categories', () => {
    render(<EngagementBreakdown engagement={{ connections: 0, messages: 0, likes: null, comments: null, shares: null } as never} />);
    expect(screen.getByText('Connections: 0')).toBeTruthy();
    expect(screen.getByText('Likes: Unavailable')).toBeTruthy();
    const data = JSON.parse(screen.getAllByTestId('chart')[0].textContent!);
    expect(data).toEqual([{ name: 'Connections', value: 0 }, { name: 'Messages', value: 0 }]);
    expect(screen.queryByText(/sample data/i)).toBeNull();
  });

  it('does not backfill a partial live response even when demo mode is on', () => {
    state.showDemoData = true;
    render(<EngagementBreakdown engagement={{ connections: 2, messages: 0, likes: null, comments: null, shares: null } as never} />);
    expect(screen.getByText('Likes: Unavailable')).toBeTruthy();
    expect(screen.queryByText(/sample data/i)).toBeNull();
  });

  it('retains explicitly labeled frontend samples behind the demo guard', () => {
    state.showDemoData = true;
    render(<><ProfileViewsChart data={[]} /><EngagementBreakdown /></>);
    expect(screen.getAllByTestId('chart').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/sample data/i)).toHaveLength(2);
  });

  it('plots persisted dates and zeros without deriving imaginary connections', () => {
    render(<ProfileViewsChart data={[{ date: '2026-06-08', views: 0, uniqueVisitors: 0 }]} />);
    const data = JSON.parse(screen.getByTestId('chart').textContent!);
    expect(data[0]).toMatchObject({ date: '2026-06-08', views: 0, unique: 0 });
    expect(data[0]).not.toHaveProperty('connections');
  });
});
