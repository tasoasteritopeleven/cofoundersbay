import io
p = 'src/app/provider/analytics/page.tsx'
s = io.open(p, encoding='utf-8').read()

old = """import { cn } from '@/lib/utils';
import { useSession } from '@/hooks/useSession';
import { useDemoData } from '@/contexts/DemoDataContext';"""
new = """import { cn } from '@/lib/utils';
import { useSession } from '@/hooks/useSession';
import { useDemoData } from '@/contexts/DemoDataContext';
import { useQuery } from '@tanstack/react-query';
import { getAnalyticsOverview } from '@/lib/api';
import { SampleDataNotice } from '@/components/common/SampleDataNotice';"""
assert s.count(old) == 1; s = s.replace(old, new)

# MetricCard accepts nullable change/trend so live metrics can render honestly
old = """}: {
  icon: React.ElementType;
  label: string;
  value: number;
  unit?: string;
  change: number;
  trend: 'up' | 'down' | 'neutral';
  format?: 'number' | 'currency' | 'percent';
}) {
  const displayValue = format === 'currency'
    ? `$${value.toLocaleString('en-GB')}`
    : format === 'percent'
    ? `${value}%`
    : value.toLocaleString('en-GB');"""
new = """}: {
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
    : value.toLocaleString('en-GB');"""
assert s.count(old) == 1; s = s.replace(old, new)

old = """          <span>{trend !== 'neutral' ? `${Math.abs(change)}%` : 'No change'} vs last period</span>"""
new = """          <span>{trend !== 'neutral' && change != null ? `${Math.abs(change)}% vs last period` : 'vs last period'}</span>"""
assert s.count(old) == 1; s = s.replace(old, new)

# data layer
old = """export default function ProviderAnalyticsPage() {
  const { hasSession, mounted } = useSession();
  const { showDemoData } = useDemoData();
  const [period, setPeriod] = useState('30d');

  const overview = showDemoData ? MOCK_OVERVIEW : null;
  const weeklyViews = showDemoData ? MOCK_WEEKLY_VIEWS : [];
  const conversions = showDemoData ? MOCK_CONVERSIONS : [];
  const trafficSources = showDemoData ? MOCK_TRAFFIC_SOURCES : [];
  const topServices = showDemoData ? MOCK_TOP_SERVICES : [];
  const maxViews = weeklyViews.length ? Math.max(...weeklyViews.map(d => d.views)) : 1;"""
new = """export default function ProviderAnalyticsPage() {
  const { hasSession, mounted } = useSession();
  const { showDemoData } = useDemoData();
  const [period, setPeriod] = useState('30d');

  /* The analytics API serves the signed-in user's own numbers - the mock
     grid only fills in when the demo toggle is on. */
  const overviewQuery = useQuery({
    queryKey: ['analytics', 'overview', period],
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
  const maxViews = weeklyViews.length ? Math.max(...weeklyViews.map(d => d.views)) : 1;

  /* Live metric cards only claim what the overview actually measures; the
     demo grid keeps its six authored tiles under the sample-data notice. */
  const liveMetrics = live
    ? [
        { icon: Eye, label: 'Profile Views', value: live.metrics.profileViews, change: live.metrics.profileViewsChange },
        { icon: Users, label: 'New Connections', value: live.metrics.newConnections, change: live.metrics.newConnectionsChange },
        { icon: MessageCircle, label: 'Messages Sent', value: live.metrics.messagesSent, change: live.metrics.messagesSentChange },
        { icon: Eye, label: 'Search Appearances', value: live.metrics.searchAppearances ?? '—', change: live.metrics.searchAppearancesChange },
        { icon: Star, label: 'Engagement Rate', value: live.metrics.engagementRate ?? '—', change: live.metrics.engagementRateChange },
        { icon: Clock, label: 'Avg Response', value: live.weeklySummary.avgResponseTime ?? '—', change: null },
      ]
    : [];"""
assert s.count(old) == 1; s = s.replace(old, new)

# notice + refresh wiring
old = """      <div className="py-6 space-y-6">
        {/* Header */}"""
new = """      <div className="py-6 space-y-6">
        {showDemoData && (
          <SampleDataNotice
            surface="Provider analytics"
            detail="The metric cards, traffic sources, funnel and service rows are illustrative - live analytics cover profile views, connections, messages and engagement."
            askAiPrompt="Why does the analytics page show sample numbers?"
          />
        )}
        {/* Header */}"""
assert s.count(old) == 1; s = s.replace(old, new)

old = """            <Button variant="outline" size="sm">
              <RefreshCw className="icon-sm" />
            </Button>"""
new = """            <Button
              variant="outline"
              size="sm"
              aria-label="Refresh analytics"
              onClick={() => overviewQuery.refetch()}
              disabled={overviewQuery.isFetching}
            >
              <RefreshCw className={cn('icon-sm', overviewQuery.isFetching && 'animate-spin')} />
            </Button>"""
assert s.count(old) == 1; s = s.replace(old, new)

# metric grid: demo cards or live cards
old = """        {/* Metric Grid */}
        {overview && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <MetricCard icon={Eye} label="Profile Views" value={overview.profileViews.value} change={overview.profileViews.change} trend={overview.profileViews.trend} />
          <MetricCard icon={MessageCircle} label="Inquiries" value={overview.inquiries.value} change={overview.inquiries.change} trend={overview.inquiries.trend} />
          <MetricCard icon={Users} label="Active Projects" value={overview.activeProjects.value} change={overview.activeProjects.change} trend={overview.activeProjects.trend} />
          <MetricCard icon={Star} label="Avg. Rating" value={overview.avgRating.value} change={overview.avgRating.change} trend={overview.avgRating.trend} />
          <MetricCard icon={DollarSign} label="Revenue" value={overview.revenue.value} change={overview.revenue.change} trend={overview.revenue.trend} format="currency" />
          <MetricCard icon={Clock} label="Response Rate" value={overview.responseRate.value} change={overview.responseRate.change} trend={overview.responseRate.trend} format="percent" />
        </div>
        )}"""
new = """        {/* Metric Grid */}
        {overview && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <MetricCard icon={Eye} label="Profile Views" value={overview.profileViews.value} change={overview.profileViews.change} trend={overview.profileViews.trend} />
          <MetricCard icon={MessageCircle} label="Inquiries" value={overview.inquiries.value} change={overview.inquiries.change} trend={overview.inquiries.trend} />
          <MetricCard icon={Users} label="Active Projects" value={overview.activeProjects.value} change={overview.activeProjects.change} trend={overview.activeProjects.trend} />
          <MetricCard icon={Star} label="Avg. Rating" value={overview.avgRating.value} change={overview.avgRating.change} trend={overview.avgRating.trend} />
          <MetricCard icon={DollarSign} label="Revenue" value={overview.revenue.value} change={overview.revenue.change} trend={overview.revenue.trend} format="currency" />
          <MetricCard icon={Clock} label="Response Rate" value={overview.responseRate.value} change={overview.responseRate.change} trend={overview.responseRate.trend} format="percent" />
        </div>
        )}
        {!showDemoData && live && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
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
        )}"""
assert s.count(old) == 1; s = s.replace(old, new)

# chart empty state when no series
old = """                <CardContent>
                  <div className="flex items-end gap-2 h-44">
                    {weeklyViews.map(d => ("""
new = """                <CardContent>
                  {weeklyViews.length === 0 && (
                    <p className="py-16 text-center text-sm text-muted-foreground">No profile views recorded in this period.</p>
                  )}
                  <div className="flex items-end gap-2 h-44">
                    {weeklyViews.map(d => ("""
assert s.count(old) == 1; s = s.replace(old, new)

# legend: inquiries series only exists in demo data
old = """                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary/80 inline-block" />Profile Views</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-status-accent-bg inline-block" />Inquiries</span>
                  </div>"""
new = """                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary/80 inline-block" />Profile Views</span>
                    {showDemoData && (
                      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-status-accent-bg inline-block" />Inquiries</span>
                    )}
                  </div>"""
assert s.count(old) == 1; s = s.replace(old, new)

# sources/funnel/services: honest empty states when not demo
old = """              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Traffic Sources</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {trafficSources.map(src => ("""
new = """              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Traffic Sources</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {trafficSources.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">Traffic sources are not tracked yet.</p>
                  )}
                  {trafficSources.map(src => ("""
assert s.count(old) == 1; s = s.replace(old, new)

old = """              <CardContent className="space-y-3">
                {conversions.map((stage, i) => ("""
new = """              <CardContent className="space-y-3">
                {conversions.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">The acquisition funnel is not tracked yet.</p>
                )}
                {conversions.map((stage, i) => ("""
assert s.count(old) == 1; s = s.replace(old, new)

old = """                <p className="text-xs text-muted-foreground pt-2">
                  Overall conversion rate: <span className="font-semibold text-foreground">4.1%</span> — above platform average of 2.8%
                </p>"""
new = """                {conversions.length > 0 && (
                  <p className="text-xs text-muted-foreground pt-2">
                    Overall conversion rate: <span className="font-semibold text-foreground">4.1%</span> — above platform average of 2.8%
                  </p>
                )}"""
assert s.count(old) == 1; s = s.replace(old, new)

old = """              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {topServices.map(svc => ("""
new = """              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {topServices.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">Per-service performance is not tracked yet.</p>
                  )}
                  {topServices.map(svc => ("""
assert s.count(old) == 1; s = s.replace(old, new)

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('provider ok')
