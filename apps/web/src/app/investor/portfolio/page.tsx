'use client';

import { StatusText } from '@/components/common/StatusText';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Briefcase, TrendingUp, TrendingDown, DollarSign,
  MoreVertical, ExternalLink, Users, PieChart, Download,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { AppShell } from '@/components/layout/AppShell';
import { RelativeTime } from '@/components/common/RelativeTime';
import { companyStageLabel, formatRelativeTime } from '@/lib/utils';
import {
  listInvestorDeals,
  getInvestorSummary,
  type InvestorDeal,
} from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/common/EmptyState';
import { useDemoData } from '@/contexts/DemoDataContext';
import { cn } from '@/lib/utils';
import { downloadCsv } from '@/lib/csv';
import { UnavailableMenuItem } from '@/components/common/UnavailableMenuItem';
import { qk } from '@/lib/query-keys';
import { choiceControl, rowOptions, usePageControls, usePageList } from '@/lib/page-controls';
import { BilingualText } from '@/components/common/BilingualText';
import { formatCompactMoney } from '@/lib/i18n/format';
import { formatDate } from '@/lib/i18n/format';

const ChartFallback = () => <Skeleton className="h-[200px] w-full rounded-lg" />;
const PortfolioValueChart = dynamic(
  () => import('./InvestorPortfolioCharts').then((m) => ({ default: m.PortfolioValueChart })),
  { ssr: false, loading: ChartFallback },
);
const SectorMixChart = dynamic(
  () => import('./InvestorPortfolioCharts').then((m) => ({ default: m.SectorMixChart })),
  { ssr: false, loading: ChartFallback },
);

// Thousands of euros. Starts at the €350K invested and ends at the €555K the
// "Current value" tile shows, so the chart and the tiles tell one story (it
// ended at 535, in dollars, beside tiles in euros).
const PORTFOLIO_VALUE_HISTORY = [
  { month: 'Oct', value: 350 },
  { month: 'Nov', value: 368 },
  { month: 'Dec', value: 395 },
  { month: 'Jan', value: 432 },
  { month: 'Feb', value: 498 },
  { month: 'Mar', value: 555 },
];

const SECTOR_DISTRIBUTION = [
  { name: 'FoodTech', value: 50, color: 'hsl(var(--chart-3))' },
  { name: 'Cybersecurity', value: 100, color: 'hsl(var(--chart-5))' },
  { name: 'Enterprise', value: 75, color: 'hsl(var(--chart-2))' },
  { name: 'Logistics', value: 50, color: 'hsl(var(--chart-6))' },
];

type Investment = {
  id: string;
  name: string;
  logoUrl?: string;
  industry: string;
  investedAt: string;
  amount: string;
  currentValue: string;
  returnPct: number;
  stage: string;
  status: 'active' | 'exited' | 'written_off';
  teamSize: number;
  /** ISO instant. Rendered through `RelativeTime`, so a phrase like
   *  "1 week ago" written here would reach `new Date()` as an invalid date. */
  lastUpdate: string;
};

/** Compact money in the deal's own currency, not a hard-coded dollar. */
function money(cents: number | null | undefined, currency = 'EUR'): string {
  if (cents == null) return '\u2014';
  return formatCompactMoney(cents / 100, currency);
}

/**
 * The portfolio row from the deal row.
 *
 * A portfolio entry is not a separate thing from a pipeline deal — it is a
 * deal that reached `invested`. Reading it off the same row is what stops the
 * board and this page disagreeing about who has been backed.
 */
function toInvestment(deal: InvestorDeal): Investment {
  const invested = deal.investedCents ?? 0;
  const current = deal.currentValueCents ?? invested;
  return {
    id: deal.id,
    name: deal.name,
    logoUrl: deal.logoUrl ?? undefined,
    industry: deal.industry ?? '\u2014',
    investedAt: deal.investedAt
      ? formatDate(deal.investedAt, 'en', { month: '2-digit', year: 'numeric' })
      : '\u2014',
    amount: money(deal.investedCents, deal.currency),
    currentValue: money(deal.currentValueCents, deal.currency),
    returnPct: invested > 0 ? Math.round(((current - invested) / invested) * 100) : 0,
    stage: companyStageLabel(deal.companyStage) || '\u2014',
    status: deal.status,
    teamSize: deal.teamSize ?? 0,
    lastUpdate: deal.lastActivityAt,
  };
}

const SECTOR_COLOURS = [
  'hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--chart-6))',
];

/**
 * Invested capital over time, then what it is worth now - in thousands of
 * euros. Every point is a fact on the deal rows: each investment date adds its
 * amount, and the last point is the sum of current values. No history is
 * invented between them.
 */
function portfolioValueSeries(deals: InvestorDeal[]): { month: string; value: number }[] {
  const dated = deals
    .filter((d) => d.investedAt && d.investedCents != null)
    .sort((a, b) => (a.investedAt ?? '').localeCompare(b.investedAt ?? ''));
  let running = 0;
  const points = dated.map((d) => {
    running += d.investedCents ?? 0;
    return {
      // "10/26" reads the same in both languages.
      month: formatDate(d.investedAt as string, 'en', { month: '2-digit', year: '2-digit' }),
      value: Math.round(running / 100_000),
    };
  });
  const now = deals.reduce((sum, d) => sum + (d.currentValueCents ?? d.investedCents ?? 0), 0);
  if (points.length) points.push({ month: 'Now', value: Math.round(now / 100_000) });
  return points;
}

/** Invested capital by the industry each deal records, in thousands of euros. */
function portfolioSectorMix(deals: InvestorDeal[]): { name: string; value: number; color: string }[] {
  const byIndustry = new Map<string, number>();
  for (const d of deals) {
    const key = d.industry ?? 'Other';
    byIndustry.set(key, (byIndustry.get(key) ?? 0) + (d.investedCents ?? 0));
  }
  return [...byIndustry.entries()].map(([name, cents], i) => ({
    name,
    value: Math.round(cents / 100_000),
    color: SECTOR_COLOURS[i % SECTOR_COLOURS.length],
  }));
}

const MOCK_INVESTMENTS: Investment[] = [
  { id: '1', name: 'FoodTech Pro', industry: 'FoodTech', investedAt: 'Feb 2025', amount: '$50K', currentValue: '$75K', returnPct: 50, stage: 'Seed', status: 'active', teamSize: 5, lastUpdate: '2026-08-28T09:00:00.000Z' },
  { id: '2', name: 'CloudSecure', industry: 'Cybersecurity', investedAt: 'Jan 2025', amount: '$100K', currentValue: '$120K', returnPct: 20, stage: 'Series A', status: 'active', teamSize: 12, lastUpdate: '2026-09-01T09:00:00.000Z' },
  { id: '3', name: 'DataVault', industry: 'Enterprise', investedAt: 'Dec 2024', amount: '$75K', currentValue: '$90K', returnPct: 20, stage: 'Seed', status: 'active', teamSize: 8, lastUpdate: '2026-08-21T09:00:00.000Z' },
  { id: '4', name: 'QuickShip', industry: 'Logistics', investedAt: 'Oct 2024', amount: '$50K', currentValue: '$250K', returnPct: 400, stage: 'Series B', status: 'exited', teamSize: 25, lastUpdate: '2026-03-18T09:00:00.000Z' },
];

/** One investment as a one-row CSV - what "Export Report" hands over. */
function exportInvestment(inv: Investment) {
  const cell = (v: string | number) => {
    const t = String(v);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const header = ['name', 'industry', 'stage', 'status', 'invested_at', 'amount', 'current_value', 'return_pct', 'team_size', 'last_update'];
  const row = [inv.name, inv.industry, inv.stage, inv.status, inv.investedAt, inv.amount, inv.currentValue, inv.returnPct, inv.teamSize, inv.lastUpdate].map(cell);
  const url = URL.createObjectURL(new Blob([`${header.join(',')}\n${row.join(',')}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${inv.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-report.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function InvestmentCard({ investment }: { investment: Investment }) {
  const statusColors: Record<string, string> = {
    active: 'bg-status-success-bg text-status-success border-status-success-border',
    exited: 'bg-status-info-bg text-status-info border-status-info-border',
    written_off: 'bg-muted text-muted-foreground border-border',
  };

  const isPositive = investment.returnPct >= 0;

  return (
    <Card className="transition-all hover:border-primary/30">
      <CardContent>
        <div className="flex gap-4">
          <Avatar className="h-12 w-12 rounded-lg">
            <AvatarImage src={investment.logoUrl} />
            <AvatarFallback className="rounded-lg bg-primary/10 text-primary-accessible font-semibold">
              {investment.name[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Link href={`/startups/${investment.id}`} className="font-semibold hover:text-primary-accessible transition-colors">
                    {investment.name}
                  </Link>
                  <Badge variant="outline" className={cn('text-xs', statusColors[investment.status])}>
                    <StatusText value={investment.status} />
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{investment.industry} · {investment.stage}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Open actions for ${investment.name}`}>
                    <MoreVertical className="icon-sm" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/startups/${investment.id}`}><BilingualText en="View Startup" el="Προβολή startup" compact /></Link>
                  </DropdownMenuItem>
                  {/* These three had no handler. Updates are events on the
                      deal, added from its page; the report is this row. */}
                  <UnavailableMenuItem
                    en="View Documents"
                    el="Έγγραφα"
                    reasonEn="Portfolio documents have no storage yet."
                    reasonEl="Τα έγγραφα χαρτοφυλακίου δεν έχουν ακόμη αποθήκευση."
                  />
                  <DropdownMenuItem asChild>
                    <Link href={`/startups/${investment.id}`}><BilingualText en="Add Update" el="Προσθήκη ενημέρωσης" compact /></Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => exportInvestment(investment)}><BilingualText en="Export Report" el="Εξαγωγή αναφοράς" compact /></DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div>
                <p className="text-xs text-muted-foreground"><BilingualText en="Invested" el="Επενδύθηκαν" compact /></p>
                <p className="text-sm font-medium">{investment.amount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground"><BilingualText en="Current Value" el="Τρέχουσα αξία" compact /></p>
                <p className="text-sm font-medium">{investment.currentValue}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground"><BilingualText en="Return" el="Απόδοση" compact /></p>
                <p className={cn('text-sm font-medium flex items-center gap-1', isPositive ? 'text-status-success' : 'text-status-danger')}>
                  {isPositive ? <TrendingUp className="icon-sm" /> : <TrendingDown className="icon-sm" />}
                  {isPositive ? '+' : ''}{investment.returnPct}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground"><BilingualText en="Invested" el="Επενδύθηκαν" compact /></p>
                <p className="text-sm font-medium">{investment.investedAt}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="icon-sm" />
                {investment.teamSize} team members
              </span>
              <span>Last update: <RelativeTime date={investment.lastUpdate} format={formatRelativeTime} /></span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function InvestorPortfolioPage() {
  const { showDemoData } = useDemoData();
  /*
   * The portfolio is the `invested` slice of the investor's own board. The
   * demo fixtures stay as what an empty portfolio shows while the "demo data"
   * switch is on; a real investment always wins.
   */
  const { data: investedPage, isLoading } = useQuery({
    queryKey: qk('investor', 'deals', 'invested'),
    queryFn: () => listInvestorDeals({ pipelineStage: 'invested', limit: 100 }),
    staleTime: 60_000,
    retry: 0,
  });
  const { data: summary } = useQuery({
    queryKey: qk('investor', 'summary'),
    queryFn: getInvestorSummary,
    staleTime: 60_000,
    retry: 0,
  });

  const liveInvestments = (investedPage?.deals ?? []).map(toInvestment);
  const investments = liveInvestments.length > 0
    ? liveInvestments
    : showDemoData ? MOCK_INVESTMENTS : [];
  const isLive = liveInvestments.length > 0;
  // Both charts come from the rows on this page. The fixed series and sector
  // mix described four mock companies (FoodTech Pro, CloudSecure...) under a
  // portfolio of Aegis Health and Orion Grid, in dollars beside euro tiles.
  const liveDeals = investedPage?.deals ?? [];
  const valueHistory = isLive
    ? portfolioValueSeries(liveDeals)
    : showDemoData ? PORTFOLIO_VALUE_HISTORY : [];
  const sectorData = isLive
    ? portfolioSectorMix(liveDeals)
    : showDemoData ? SECTOR_DISTRIBUTION : [];

  const totalInvested = 275000;
  const totalValue = 535000;
  const totalReturn = ((totalValue - totalInvested) / totalInvested) * 100;

  const [chartTab, setChartTab] = useState('performance');
  const exportPortfolio = () =>
    downloadCsv(
      'portfolio',
      ['name', 'industry', 'stage', 'status', 'invested_at', 'amount', 'current_value', 'return_pct', 'team_size'],
      investments.map((i) => [i.name, i.industry, i.stage, i.status, i.investedAt, i.amount, i.currentValue, i.returnPct, i.teamSize]),
    );
  // Offered to the assistant, above the empty-portfolio return: the chart
  // tab, the header's export and each row's Export Report.
  usePageList([
    {
      id: 'investments',
      labelEn: 'Portfolio companies',
      labelEl: 'Εταιρείες χαρτοφυλακίου',
      rows: isLoading ? undefined : investments.map((i) =>
        `${i.name} · ${i.industry}, ${i.stage} · ${i.status.replace('_', ' ')} · invested ${i.amount}, now ${i.currentValue} (${i.returnPct >= 0 ? '+' : ''}${i.returnPct}%)`,
      ),
      sample: !isLive,
    },
  ]);
  usePageControls([
    choiceControl('chart', 'Portfolio chart', 'Γράφημα χαρτοφυλακίου', [
      { value: 'performance', en: 'Value over time', el: 'Αξία στον χρόνο' },
      { value: 'sectors', en: 'Sector mix', el: 'Κατανομή κλάδων' },
    ], chartTab, setChartTab),
    {
      id: 'export_portfolio',
      labelEn: 'Export the portfolio as CSV',
      labelEl: 'Εξαγωγή χαρτοφυλακίου σε CSV',
      writes: false,
      unavailableEn: investments.length ? undefined : 'There is nothing to export yet.',
      unavailableEl: investments.length ? undefined : 'Δεν υπάρχει ακόμη κάτι για εξαγωγή.',
      run: exportPortfolio,
    },
    {
      id: 'export_investment',
      labelEn: 'Export an investment report',
      labelEl: 'Εξαγωγή αναφοράς επένδυσης',
      writes: false,
      options: rowOptions(investments, (i) => i.id, (i) => i.name),
      run: (v) => { const inv = investments.find((i) => i.id === v); if (inv) exportInvestment(inv); },
    },
  ]);

  if (!isLoading && !showDemoData && investments.length === 0) {
    return (
      <AppShell showHelp title="Portfolio" titleEl="Χαρτοφυλάκιο" description="Track your investments and returns" descriptionEl="Παρακολουθήστε τις επενδύσεις και τις αποδόσεις σας">
        <EmptyState
          illustration="default"
          title="No portfolio companies yet"
          description="Start investing through your deal pipeline to build your portfolio."
          askAiPrompt="My investor portfolio is empty. What should I review in the pipeline before marking a company as invested?"
          action={<Button asChild><Link href="/investor/pipeline"><TrendingUp className="mr-2 icon-sm" /><BilingualText en="View Pipeline" el="Προβολή pipeline" compact /></Link></Button>}
        />
      </AppShell>
    );
  }

  return (
    <AppShell showHelp
      title="Portfolio"
      titleEl="Χαρτοφυλάκιο"
      description="Track your investments and returns"
      descriptionEl="Παρακολουθήστε τις επενδύσεις και τις αποδόσεις σας"
      actions={
        // Had no handler. The whole portfolio, one row per investment.
        <Button
          variant="outline"
          size="sm"
          disabled={investments.length === 0}
          onClick={exportPortfolio}
        >
          <Download className="mr-2 icon-sm" aria-hidden="true" /><BilingualText en="Export Report" el="Εξαγωγή αναφοράς" compact />
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          {[
            /*
             * "$275K" and "$535K" were string constants sitting beside a real
             * company count. Summed by the API over the same rows the table
             * below lists, so the four tiles are one statement.
             */
            { label: 'Total Invested', value: isLive ? money(summary?.deployedCents, 'EUR') : '$275K', icon: DollarSign, color: 'text-foreground' },
            { label: 'Current Value', value: isLive ? money(summary?.currentValueCents, 'EUR') : '$535K', icon: TrendingUp, color: 'text-primary-accessible' },
            { label: 'Total Return', value: isLive
                ? (summary?.returnPct == null ? '\u2014' : `${summary.returnPct > 0 ? '+' : ''}${summary.returnPct}%`)
                : `+${totalReturn.toFixed(0)}%`, icon: PieChart, color: 'text-status-success' },
            { label: 'Companies', value: investments.length, icon: Briefcase, color: 'text-status-info' },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="flex items-center gap-3">
                <div className="rounded-lg p-2 bg-secondary"><Icon className={cn('icon-sm', color)} /></div>
                <div>
                  <p className="page-stat text-xl font-bold tabular-nums">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <Tabs value={chartTab} onValueChange={setChartTab}>
          <TabsList>
            <TabsTrigger value="performance"><BilingualText en="Value Over Time" el="Αξία στον χρόνο" compact /></TabsTrigger>
            <TabsTrigger value="sectors"><BilingualText en="Sector Mix" el="Κατανομή κλάδων" compact /></TabsTrigger>
          </TabsList>
          <TabsContent value="performance">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm"><BilingualText en="Portfolio value (€K)" el="Αξία portfolio (χιλ. €)" compact /></CardTitle>
              </CardHeader>
              <CardContent>
                <PortfolioValueChart data={valueHistory} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="sectors">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm"><BilingualText en="Invested by sector (€K)" el="Επενδύσεις ανά κλάδο (χιλ. €)" compact /></CardTitle>
              </CardHeader>
              <CardContent>
                <SectorMixChart data={sectorData} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Portfolio List */}
        <div className="space-y-3">
          {investments.map((investment) => (
            <InvestmentCard key={investment.id} investment={investment} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
