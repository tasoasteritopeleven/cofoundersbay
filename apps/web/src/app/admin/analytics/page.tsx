'use client';

import dynamic from 'next/dynamic';
import { BarChart3, Download, RefreshCw, Rocket, TrendingUp, Users } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { downloadCsv } from '@/lib/csv';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { getAdminStats, listTenants } from '@/lib/api';
import { HelpCallout } from '@/components/common/HelpCallout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState } from 'react';
import { qk } from '@/lib/query-keys';
import { choiceControl, usePageControls } from '@/lib/page-controls';
import { BilingualText } from '@/components/common/BilingualText';

const UserRoleChart = dynamic(
  () => import('../dashboard/Charts').then((m) => ({ default: m.UserRoleChart })),
  { ssr: false, loading: () => <div className="h-[280px] animate-pulse rounded-lg bg-muted/40" /> },
);

/*
 * The range offered 90 days and a year and changed nothing: every tile read
 * the same fields whatever was picked. `/admin/stats` counts new and active
 * users over three windows, so those are the three ranges, and the two tiles
 * that depend on a window read the one selected.
 */
const RANGES = [
  { value: 'today', en: 'Today', el: 'Σήμερα' },
  { value: 'week', en: 'Last 7 days', el: 'Τελευταίες 7 ημέρες' },
  { value: 'month', en: 'Last 30 days', el: 'Τελευταίες 30 ημέρες' },
] as const;
type Range = (typeof RANGES)[number]['value'];

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState<Range>('month');

  /*
   * Six figures written into the source, over an `admin/stats` endpoint that
   * counts every one of them. `usersByRole` is what the role tiles read, so
   * the headline and the breakdown below it are the same arithmetic instead
   * of two lists that happen to add up.
   *
   * Tenants read a dash: the platform stats count users, connections and
   * content, not workspaces, and a tenant count is not derivable from them.
   */
  const { data, refetch, isFetching } = useQuery({
    queryKey: qk('admin', 'stats'),
    queryFn: getAdminStats,
    staleTime: 60_000,
    retry: 0,
  });

  // The same list /admin/tenants reads, so the two pages count one set.
  const { data: tenants } = useQuery({
    queryKey: qk('admin', 'tenants'),
    queryFn: () => listTenants({ limit: 100 }),
    staleTime: 60_000,
    retry: 0,
  });

  const stats = data?.stats;
  const byRole = stats?.usersByRole ?? {};
  const active = range === 'today' ? stats?.activeUsersToday : range === 'week' ? stats?.activeUsersThisWeek : stats?.activeUsersThisMonth;
  const fresh = range === 'today' ? stats?.newUsersToday : range === 'week' ? stats?.newUsersThisWeek : stats?.newUsersThisMonth;
  const METRICS = {
    totalUsers: stats?.totalUsers ?? null,
    activeUsers: active ?? null,
    newUsers: fresh ?? null,
    totalStartups: byRole.founder ?? null,
    totalMentors: byRole.mentor ?? null,
    totalInvestors: byRole.investor ?? null,
    totalTenants: Array.isArray(tenants) ? tenants.length : null,
  };
  const dash = '\u2014';

  const exportMetrics = () =>
    downloadCsv('platform-analytics', ['metric', 'value'], [
      ...Object.entries(METRICS).map(([k, v]) => [k, v ?? '']),
      ...Object.entries(byRole).map(([role, n]) => [`users_${role}`, n as number]),
    ]);
  // The range, refresh and export, offered to the assistant. Analytics
  // publish no list: the figures are the page snapshot.
  usePageControls([
    choiceControl('time_range', 'Time range', 'Χρονικό διάστημα', RANGES.map((r) => ({ value: r.value, en: r.en, el: r.el })), range, (v) => setRange(v as Range)),
    { id: 'refresh', labelEn: 'Refresh the figures', labelEl: 'Ανανέωση στοιχείων', writes: false, run: () => { void refetch(); } },
    {
      id: 'export_csv',
      labelEn: 'Export the figures (CSV)',
      labelEl: 'Εξαγωγή στοιχείων (CSV)',
      writes: false,
      unavailableEn: !stats ? 'The figures have not loaded.' : undefined,
      unavailableEl: !stats ? 'Τα στοιχεία δεν έχουν φορτωθεί.' : undefined,
      run: exportMetrics,
    },
  ]);

  return (
    <AppShell
      title="Global analytics"
      description="Platform growth, engagement, and role distribution — export for board or investor updates."
      descriptionEl="Ανάπτυξη της πλατφόρμας, δραστηριότητα και κατανομή ρόλων — με εξαγωγή για ενημερώσεις διοικητικού συμβουλίου ή επενδυτών."
      showHelp
      actions={
        <div className="flex flex-wrap gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as Range)}>
            <SelectTrigger aria-label="Time range. Χρονικό διάστημα" className="w-[150px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}><BilingualText en={r.en} el={r.el} compact /></SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Both had no handler. */}
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={cn('icon-sm mr-1.5', isFetching && 'animate-spin')} aria-hidden="true" /> <BilingualText en="Refresh" el="Ανανέωση" compact />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportMetrics}
          >
            <Download className="icon-sm mr-1.5" aria-hidden="true" /> <BilingualText en="Export" el="Εξαγωγή" compact />
          </Button>
        </div>
      }
    >
      <HelpCallout id="admin-analytics" title="Reading these metrics">
        <p>
          <strong>Active</strong> and <strong>new users</strong> are counted over the selected range; the other figures are platform totals. Role charts show signup mix — use this to
          balance supply (mentors/investors) vs demand (founders). Tenant count reflects white-label communities.
        </p>
      </HelpCallout>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
        {[
          { label: 'Total users', value: METRICS.totalUsers ?? dash, icon: Users },
          { label: 'Active users', value: METRICS.activeUsers ?? dash, icon: TrendingUp },
          { label: 'New users', value: METRICS.newUsers ?? dash, icon: Users },
          { label: 'Startups', value: METRICS.totalStartups ?? dash, icon: Rocket },
          { label: 'Mentors', value: METRICS.totalMentors ?? dash, icon: BarChart3 },
          { label: 'Investors', value: METRICS.totalInvestors ?? dash, icon: TrendingUp },
          { label: 'Tenants', value: METRICS.totalTenants ?? dash, icon: Users },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className="icon-sm" />
                <span className="text-sm">{label}</span>
              </div>
              <p className="page-stat mt-1 text-xl font-bold tabular-nums">{value.toLocaleString('en-GB')}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Users by role</CardTitle>
        </CardHeader>
        <CardContent>
          <UserRoleChart
            data={[
              // The same `usersByRole` the tiles above read, so the chart and
              // the headline cannot disagree about how many mentors there are.
              { name: 'Founders', value: byRole.founder ?? 0 },
              { name: 'Mentors', value: byRole.mentor ?? 0 },
              { name: 'Investors', value: byRole.investor ?? 0 },
              {
                name: 'Other',
                value: Math.max(
                  0,
                  (stats?.totalUsers ?? 0)
                    - (byRole.founder ?? 0)
                    - (byRole.mentor ?? 0)
                    - (byRole.investor ?? 0),
                ),
              },
            ]}
          />
        </CardContent>
      </Card>
    </AppShell>
  );
}
