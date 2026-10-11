'use client';

import { StatusText } from '@/components/common/StatusText';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, Eye, MessageCircle, Star, Users, DollarSign, Clock, ArrowUp, ArrowDown, Minus, RefreshCw, Download,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualAria } from '@/lib/i18n/format';
import { downloadCsv } from '@/lib/csv';
import { choiceControl, usePageControls } from '@/lib/page-controls';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RailStats } from '@/components/layout/RailParts';
import { RowHead } from '@/components/dashboard/SectionCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useSession } from '@/hooks/useSession';
import { useDemoData } from '@/contexts/DemoDataContext';
import { getAnalyticsOverview } from '@/lib/api';
import { SampleDataNotice } from '@/components/common/SampleDataNotice';
import { qk } from '@/lib/query-keys';

// ── Mock analytics data ───────────────────────────────────────────────────────

const MOCK_OVERVIEW = {
  profileViews: { value: 342, change: 18, trend: 'up' as const },
  inquiries: { value: 27, change: 35, trend: 'up' as const },
  activeProjects: { value: 6, change: 0, trend: 'neutral' as const },
  avgRating: { value: 4.8, change: -2, trend: 'down' as const },
  revenue: { value: 8400, change: 22, trend: 'up' as const },
  responseRate: { value: 94, change: 6, trend: 'up' as const },
};

const MOCK_WEEKLY_VIEWS = [
  { day: 'Mon', views: 42, inquiries: 3 },
  { day: 'Tue', views: 58, inquiries: 5 },
  { day: 'Wed', views: 35, inquiries: 2 },
  { day: 'Thu', views: 71, inquiries: 7 },
  { day: 'Fri', views: 63, inquiries: 6 },
  { day: 'Sat', views: 28, inquiries: 2 },
  { day: 'Sun', views: 19, inquiries: 1 },
];

const MOCK_CONVERSIONS = [
  { stage: 'Profile Views', count: 342, pct: 100, color: 'bg-primary' },
  { stage: 'Inquiry Sent', count: 27, pct: 7.9, color: 'bg-status-accent-mark' },
  { stage: 'Response Given', count: 25, pct: 7.3, color: 'bg-status-info-mark' },
  { stage: 'Project Started', count: 18, pct: 5.3, color: 'bg-status-success-mark' },
  { stage: 'Project Completed', count: 14, pct: 4.1, color: 'bg-status-success-mark' },
];

const MOCK_TRAFFIC_SOURCES = [
  { source: 'Direct Search', visits: 148, pct: 43 },
  { source: 'Recommendations', visits: 89, pct: 26 },
  { source: 'Community Posts', visits: 62, pct: 18 },
  { source: 'Mentor Referrals', visits: 43, pct: 13 },
];

const MOCK_TOP_SERVICES = [
  { name: 'Legal Consultation', inquiries: 12, revenue: 3600, rating: 4.9 },
  { name: 'Contract Drafting', inquiries: 8, revenue: 2800, rating: 4.7 },
  { name: 'IP Registration', inquiries: 5, revenue: 2000, rating: 5.0 },
  { name: 'Fundraising Legal', inquiries: 2, revenue: 0, rating: null },
];

/* The same four windows GET /analytics/overview accepts. */
const PERIODS: { value: string; en: string; el: string }[] = [
  { value: '7d', en: 'Last 7 days', el: 'Τελευταίες 7 ημέρες' },
  { value: '30d', en: 'Last 30 days', el: 'Τελευταίες 30 ημέρες' },
  { value: '90d', en: 'Last 90 days', el: 'Τελευταίες 90 ημέρες' },
  { value: '1y', en: 'Last year', el: 'Τελευταίο έτος' },
];
const DEFAULT_PERIOD = '30d';

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'neutral' }) {
  if (trend === 'up') return <ArrowUp className="icon-sm text-status-success" />;
  if (trend === 'down') return <ArrowDown className="icon-sm text-status-danger" />;
  return <Minus className="icon-sm text-muted-foreground" />;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  unit = '',
  change,
  trend,
  format = 'number',
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  unit?: string;
  change?: number | null;
  trend: 'up' | 'down' | 'neutral';
  format?: 'number' | 'currency' | 'percent';
}) {
  const displayValue = typeof value === 'string'
    ? value
    : format === 'currency'
    ? `$${value.toLocaleString('en-GB')}`
    : format === 'percent'
    ? `${value}%`
    : value.toLocaleString('en-GB');

  return (
    <Card>
      <CardContent>
        <div className="flex items-start justify-between mb-2">
          <p className="text-xs text-muted-foreground">{label}</p>
          <div className="rounded-md bg-primary/10 p-1.5">
            <Icon className="icon-sm text-muted-foreground" />
          </div>
        </div>
        <p className="page-stat text-2xl font-bold tabular-nums">{displayValue}{unit}</p>
        <div className={cn(
          'flex items-center gap-1 mt-1 text-xs',
          trend === 'up' ? 'text-status-success' : trend === 'down' ? 'text-status-danger' : 'text-muted-foreground'
        )}>
          <TrendIcon trend={trend} />
          <span>{trend !== 'neutral' && change != null ? `${Math.abs(change)}% vs last period` : 'vs last period'}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProviderAnalyticsPage() {
  const { hasSession, mounted } = useSession();
  const { showDemoData } = useDemoData();
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const activePeriod = PERIODS.find((p) => p.value === period) ?? PERIODS[1];

  /* The analytics API serves the signed-in user's own numbers - the mock
     grid only fills in when the demo toggle is on. */
  const overviewQuery = useQuery({
    queryKey: qk('analytics', 'overview', period),
    queryFn: () => getAnalyticsOverview(period),
    enabled: hasSession && mounted && !showDemoData,
    staleTime: 60_000,
    retry: 0,
  });
  const live = overviewQuery.data ?? null;

  const overview = showDemoData ? MOCK_OVERVIEW : null;
  const conversions = showDemoData ? MOCK_CONVERSIONS : [];
  const trafficSources = showDemoData ? MOCK_TRAFFIC_SOURCES : [];
  const topServices = showDemoData ? MOCK_TOP_SERVICES : [];

  /* Daily profile views come from the same series either way: the demo week
     or the API's per-day rows, labelled by weekday. */
  const weeklyViews: { day: string; views: number; inquiries: number }[] = showDemoData
    ? MOCK_WEEKLY_VIEWS
    : (live?.profileViews ?? []).map((d) => ({
        day: new Date(d.date).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short' }),
        views: d.views,
        inquiries: 0,
      }));
  const maxViews = Math.max(1, ...weeklyViews.map(d => d.views));
  const maxInquiries = Math.max(1, ...weeklyViews.map(d => d.inquiries));

  /* Live metric cards only claim what the overview actually measures; the
     demo grid keeps its six authored tiles under the sample-data notice. */
  const liveMetrics = live
    ? [
        { icon: Eye, label: 'Profile Views', value: live.metrics?.profileViews, change: live.metrics?.profileViewsChange },
        { icon: Users, label: 'New Connections', value: live.metrics?.newConnections, change: live.metrics?.newConnectionsChange },
        { icon: MessageCircle, label: 'Messages Sent', value: live.metrics?.messagesSent, change: live.metrics?.messagesSentChange },
        { icon: Eye, label: 'Search Appearances', value: live.metrics?.searchAppearances ?? '—', change: live.metrics?.searchAppearancesChange },
        { icon: Star, label: 'Engagement Rate', value: live.metrics?.engagementRate ?? '—', change: live.metrics?.engagementRateChange },
        { icon: Clock, label: 'Avg Response', value: live.weeklySummary?.avgResponseTime ?? '—', change: null },
      ]
    : [];

  /* One set of numbers for the rail's summary and the export: the live grid
     when signed in, the authored demo tiles otherwise. */
  const metricRows: { label: string; value: string | number; change: number | null }[] = showDemoData && overview
    ? [
        { label: 'Profile Views', value: overview.profileViews.value, change: overview.profileViews.change },
        { label: 'Inquiries', value: overview.inquiries.value, change: overview.inquiries.change },
        { label: 'Active Projects', value: overview.activeProjects.value, change: overview.activeProjects.change },
        { label: 'Avg. Rating', value: overview.avgRating.value, change: overview.avgRating.change },
        { label: 'Revenue', value: overview.revenue.value, change: overview.revenue.change },
        { label: 'Response Rate', value: `${overview.responseRate.value}%`, change: overview.responseRate.change },
      ]
    : liveMetrics.map((m) => ({ label: m.label, value: m.value ?? '—', change: typeof m.change === 'number' ? m.change : null }));
  const totalViews = weeklyViews.reduce((n, d) => n + d.views, 0);

  /* The week's shape: what the API summarises when live, and the same three
     readings taken from the sample week in demo mode. */
  const busiest = weeklyViews.length ? weeklyViews.reduce((a, b) => (b.views > a.views ? b : a)) : null;
  const glance = showDemoData
    ? [
        { id: 'day', en: 'Most active day', el: 'Πιο ενεργή ημέρα', value: busiest?.day ?? '—' },
        { id: 'interactions', en: 'Interactions', el: 'Αλληλεπιδράσεις', value: String(weeklyViews.reduce((n, d) => n + d.views + d.inquiries, 0)) },
        { id: 'response', en: 'Response rate', el: 'Ποσοστό απόκρισης', value: `${MOCK_OVERVIEW.responseRate.value}%` },
      ]
    : [
        { id: 'day', en: 'Most active day', el: 'Πιο ενεργή ημέρα', value: live?.weeklySummary?.mostActiveDay ?? '—' },
        { id: 'hour', en: 'Peak hour', el: 'Ώρα αιχμής', value: live?.weeklySummary?.peakHour ?? '—' },
        { id: 'interactions', en: 'Interactions', el: 'Αλληλεπιδράσεις', value: live?.weeklySummary?.totalInteractions?.toString() ?? '—' },
        { id: 'response', en: 'Avg. response', el: 'Μέσος χρόνος απόκρισης', value: live?.weeklySummary?.avgResponseTime ?? '—' },
      ];

  const exportDaily = () =>
    downloadCsv(
      `provider-analytics-daily-${period}`,
      showDemoData ? ['Day', 'Profile views', 'Inquiries'] : ['Day', 'Profile views'],
      weeklyViews.map((d) => (showDemoData ? [d.day, d.views, d.inquiries] : [d.day, d.views])),
    );
  const exportMetrics = () =>
    downloadCsv(
      `provider-analytics-metrics-${period}`,
      ['Metric', 'Value', 'Change vs last period (%)'],
      metricRows.map((m) => [m.label, m.value, m.change]),
    );

  /*
   * The page rail. The column is the metric grid and the three charts - what
   * the page is for. The window that bounds them, the refresh, a reading of
   * the week's shape and the exports are about those numbers, so they sit one
   * gesture away; the period's badge shows only when it is not the default.
   */
  const rail: PageRailSection[] = [
    {
      id: 'period',
      glyph: 'calendar',
      labelEn: 'Period',
      labelEl: 'Περίοδος',
      badge: period !== DEFAULT_PERIOD ? 1 : null,
      content: (
        <div className="space-y-3">
          <div className="space-y-1" role="radiogroup" aria-label={bilingualAria('Period', 'Περίοδος')}>
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                role="radio"
                aria-checked={period === p.value}
                onClick={() => setPeriod(p.value)}
                className={cn(
                  'tap-target flex min-h-9 w-full items-center rounded-lg px-2.5 text-left text-sm transition-colors',
                  period === p.value ? 'bg-primary/10 font-medium text-primary-accessible' : 'hover:bg-muted/70',
                )}
              >
                <BilingualText en={p.en} el={p.el} compact wrap />
              </button>
            ))}
          </div>
          {/* Only the live numbers can be fetched again; the sample grid is fixed. */}
          <button
            type="button"
            onClick={() => void overviewQuery.refetch()}
            disabled={showDemoData || !hasSession || overviewQuery.isFetching}
            className="tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={cn('icon-sm shrink-0', overviewQuery.isFetching && 'animate-spin')} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <BilingualText en="Refresh analytics" el="Ανανέωση στατιστικών" compact wrap />
            </span>
          </button>
        </div>
      ),
    },
    {
      id: 'glance',
      glyph: 'chart',
      labelEn: 'At a glance',
      labelEl: 'Με μια ματιά',
      content: (
        // The rail's own figures, not framed tiles: the rail is a flat
        // surface like the sidebar (RailParts).
        <RailStats items={glance.map((g) => ({ key: g.id, label: g.en, labelEl: g.el, value: g.value }))} />
      ),
    },
    {
      id: 'export',
      glyph: 'book',
      labelEn: 'Export',
      labelEl: 'Εξαγωγή',
      content: (
        <div className="space-y-1">
          <button
            type="button"
            onClick={exportMetrics}
            disabled={!metricRows.length}
            className="tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="icon-sm shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <BilingualText en={`Export ${metricRows.length} metrics as CSV`} el={`Εξαγωγή ${metricRows.length} δεικτών σε CSV`} compact wrap />
            </span>
          </button>
          <button
            type="button"
            onClick={exportDaily}
            disabled={!weeklyViews.length}
            className="tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="icon-sm shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <BilingualText en={`Export ${weeklyViews.length} daily rows as CSV`} el={`Εξαγωγή ${weeklyViews.length} ημερήσιων γραμμών σε CSV`} compact wrap />
            </span>
          </button>
        </div>
      ),
    },
  ];

  // Offered to the assistant: the rail's period, refresh and both exports.
  usePageControls([
    choiceControl('period', 'Analytics period', 'Περίοδος στατιστικών', PERIODS, period, setPeriod),
    {
      id: 'refresh',
      labelEn: 'Refresh analytics',
      labelEl: 'Ανανέωση στατιστικών',
      writes: false,
      unavailableEn: showDemoData ? 'Sample figures are fixed; turn off sample data to load your own.' : undefined,
      unavailableEl: showDemoData ? 'Τα δείγματα είναι σταθερά· απενεργοποιήστε τα δείγματα για να φορτώσετε τα δικά σας.' : undefined,
      run: () => void overviewQuery.refetch(),
    },
    { id: 'export_metrics', labelEn: 'Export metrics as CSV', labelEl: 'Εξαγωγή δεικτών σε CSV', writes: false, unavailableEn: metricRows.length ? undefined : 'There are no metrics to export yet.', run: exportMetrics },
    { id: 'export_daily', labelEn: 'Export daily views as CSV', labelEl: 'Εξαγωγή ημερήσιων προβολών σε CSV', writes: false, unavailableEn: weeklyViews.length ? undefined : 'There are no daily rows to export yet.', run: exportDaily },
  ]);

  if (!mounted) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Skeleton className="h-10 w-60" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell rail={rail}>
      <div className="space-y-6">
        {showDemoData && (
          <SampleDataNotice
            surface="Provider analytics"
            detail="The metric cards, traffic sources, funnel and service rows are illustrative - live analytics cover profile views, connections, messages and engagement."
            askAiPrompt="Why does the analytics page show sample numbers?"
          />
        )}

        {/* The period lives in the rail; the column still says which one is
            on, because numbers with no stated window read as all-time. */}
        <p className="text-sm text-muted-foreground">
          <BilingualText
            en={`${activePeriod.en} · ${totalViews.toLocaleString('en-GB')} profile views`}
            el={`${activePeriod.el} · ${totalViews.toLocaleString('el-GR')} προβολές προφίλ`}
            compact
            wrap
          />
        </p>

        {/* Metric Grid */}
        {overview && (
        <div className="grid grid-cols-2 kpi-odd-span-md gap-4 md:grid-cols-3 lg:grid-cols-6">
          <MetricCard icon={Eye} label="Profile Views" value={overview.profileViews.value} change={overview.profileViews.change} trend={overview.profileViews.trend} />
          <MetricCard icon={MessageCircle} label="Inquiries" value={overview.inquiries.value} change={overview.inquiries.change} trend={overview.inquiries.trend} />
          <MetricCard icon={Users} label="Active Projects" value={overview.activeProjects.value} change={overview.activeProjects.change} trend={overview.activeProjects.trend} />
          <MetricCard icon={Star} label="Avg. Rating" value={overview.avgRating.value} change={overview.avgRating.change} trend={overview.avgRating.trend} />
          <MetricCard icon={DollarSign} label="Revenue" value={overview.revenue.value} change={overview.revenue.change} trend={overview.revenue.trend} format="currency" />
          <MetricCard icon={Clock} label="Response Rate" value={overview.responseRate.value} change={overview.responseRate.change} trend={overview.responseRate.trend} format="percent" />
        </div>
        )}
        {!showDemoData && live && (
          <div className="grid grid-cols-2 kpi-odd-span-md gap-4 md:grid-cols-3 lg:grid-cols-6">
            {liveMetrics.map((m) => (
              <MetricCard
                key={m.label}
                icon={m.icon}
                label={m.label}
                value={m.value}
                change={m.change}
                trend={typeof m.change === 'number' ? (m.change > 0 ? 'up' : m.change < 0 ? 'down' : 'neutral') : 'neutral'}
              />
            ))}
          </div>
        )}

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview"><BilingualText en="Traffic" el="Κίνηση" compact /></TabsTrigger>
            <TabsTrigger value="funnel"><BilingualText en="Conversion Funnel" el="Χοάνη μετατροπής" compact /></TabsTrigger>
            <TabsTrigger value="services"><BilingualText en="Services" el="Υπηρεσίες" compact /></TabsTrigger>
          </TabsList>

          {/* Traffic */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle><BilingualText en="Daily Views & Inquiries" el="Ημερήσιες προβολές & ερωτήματα" compact /></CardTitle>
                </CardHeader>
                <CardContent>
                  {weeklyViews.length === 0 && (
                    <p className="py-16 text-center text-sm text-muted-foreground"><BilingualText en="No profile views recorded in this period." el="Δεν καταγράφηκαν προβολές προφίλ σε αυτή την περίοδο." wrap /></p>
                  )}
                  {/* Bars are proportions of a fixed plot area. They were pixel
                      heights (views up to 140px plus inquiries) in a 176px box
                      that also held the day label, so the tallest day grew up
                      through the card title. */}
                  <div data-chart="" className="flex h-44 items-stretch gap-2">
                    {weeklyViews.map(d => (
                      <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                        <div className="flex w-full flex-1 flex-col justify-end gap-0.5">
                          <div
                            className="w-full rounded-t bg-primary/80 min-h-[2px] transition-all"
                            style={{ height: `${(d.views / maxViews) * 78}%` }}
                          />
                          <div
                            className="w-full bg-status-accent-bg min-h-[2px]"
                            style={{ height: `${(d.inquiries / maxInquiries) * 18}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{d.day}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary/80 inline-block" /><BilingualText en="Profile Views" el="Προβολές προφίλ" compact /></span>
                    {showDemoData && (
                      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-status-accent-bg inline-block" /><BilingualText en="Inquiries" el="Ερωτήματα" compact /></span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle><BilingualText en="Traffic Sources" el="Πηγές κίνησης" compact /></CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {trafficSources.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground"><BilingualText en="Traffic sources are not tracked yet." el="Οι πηγές κίνησης δεν καταγράφονται ακόμα." wrap /></p>
                  )}
                  {trafficSources.map(src => (
                    <div key={src.source}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">{src.source}</span>
                        <span className="font-medium">{src.pct}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div
                          className="h-1.5 rounded-full bg-primary"
                          style={{ width: `${src.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Funnel */}
          <TabsContent value="funnel">
            <Card>
              <CardHeader>
                <CardTitle><BilingualText en="Client Acquisition Funnel" el="Χοάνη απόκτησης πελατών" compact /></CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {conversions.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground"><BilingualText en="The acquisition funnel is not tracked yet." el="Η χοάνη απόκτησης δεν καταγράφεται ακόμα." wrap /></p>
                )}
                {conversions.map((stage, i) => (
                  <div key={stage.stage} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                        <span className="font-medium"><StatusText value={stage.stage} /></span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-xs">{stage.count.toLocaleString('en-GB')}</span>
                        <Badge variant="outline" className="text-xs tabular-nums">{stage.pct}%</Badge>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className={cn('h-2 rounded-full transition-all', stage.color)}
                        style={{ width: `${stage.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
                {conversions.length > 0 && (
                  <p className="text-xs text-muted-foreground pt-2">
                    Overall conversion rate: <span className="font-semibold text-foreground">4.1%</span> — above platform average of 2.8%
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Services */}
          <TabsContent value="services">
            <Card>
              <CardHeader>
                <CardTitle><BilingualText en="Service Performance" el="Απόδοση υπηρεσιών" compact /></CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {topServices.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground"><BilingualText en="Per-service performance is not tracked yet." el="Η απόδοση ανά υπηρεσία δεν καταγράφεται ακόμα." wrap /></p>
                  )}
                  {topServices.map(svc => (
                    <div key={svc.name} className="px-4 py-3 sm:px-6">
                      <RowHead
                        title={svc.name}
                        subtitle={<BilingualText en={`${svc.inquiries} inquiries`} el={`${svc.inquiries} ερωτήματα`} compact />}
                        asideStays
                        aside={(
                          <>
                            <span className="text-right">
                              <span className="block card-body font-semibold tabular-nums text-foreground">${svc.revenue.toLocaleString('en-GB')}</span>
                              <span className="block text-xs text-muted-foreground"><BilingualText en="Revenue" el="Έσοδα" compact /></span>
                            </span>
                            {svc.rating != null ? (
                              <span className="flex shrink-0 items-center gap-1">
                                <Star className="icon-sm text-status-warning fill-status-warning" aria-hidden="true" />
                                <span className="card-body font-medium tabular-nums text-foreground">{svc.rating}</span>
                              </span>
                            ) : (
                              <Badge variant="outline" className="text-xs shrink-0"><BilingualText en="No reviews" el="Χωρίς κριτικές" compact /></Badge>
                            )}
                          </>
                        )}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
