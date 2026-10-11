'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  TrendingUp,
  Calendar,
  DollarSign,
  Target,
  ArrowUpRight,
  MapPin,
  Zap,
  LineChart,
  PieChart,
  Filter,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useQuery } from '@tanstack/react-query';
import { getInvestorSummary, listInvestorDeals, PIPELINE_STAGES, type InvestorDeal, type PipelineStage } from '@/lib/api';
import { BilingualText } from '@/components/common/BilingualText';
import { MetricTile } from '@/components/dashboard/MetricTile';
import { EmptyLine, RowHead, SectionCard } from '@/components/dashboard/SectionCard';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useChartTheme } from '@/lib/chart-theme';
import { cn } from '@/lib/utils';
import { qk } from '@/lib/query-keys';
import { choiceControl, usePageControls } from '@/lib/page-controls';
import { usePublishPageSnapshot } from '@/contexts/PageSnapshotContext';
import { formatCompactMoney } from '@/lib/i18n/format';

/** Compact money, in the board's currency rather than a hard-coded dollar. */
function money(cents: number | null | undefined, currency = 'EUR'): string {
  if (cents == null) return '—';
  return formatCompactMoney(cents / 100, currency);
}

/*
 * The six tiles were counted from the board a round ago; everything under
 * them was still written into this file - 45 deals "discovered", a funnel
 * down to 2, six months of bars from October to March, sectors and cities
 * that summed to 45, and three portfolio companies (FoodTech Pro, CloudSecure,
 * EduLearn) with dollar returns. Beside a board of seven deals in euros, the
 * page contradicted itself above and below the fold. Every chart below now
 * reads the same deal list /investor/pipeline reads.
 */

const STAGE_LABEL: Record<PipelineStage, { en: string; el: string }> = {
  discovered: { en: 'Discovered', el: 'Εντοπισμένες' },
  reviewing: { en: 'Reviewing', el: 'Σε αξιολόγηση' },
  meeting: { en: 'Meeting', el: 'Συνάντηση' },
  due_diligence: { en: 'Due diligence', el: 'Δέουσα επιμέλεια' },
  negotiating: { en: 'Negotiating', el: 'Διαπραγμάτευση' },
  invested: { en: 'Invested', el: 'Επένδυση' },
  passed: { en: 'Passed', el: 'Απορρίφθηκαν' },
};

/** The forward path; `passed` leaves it and is counted on its own. */
const FUNNEL_STAGES = PIPELINE_STAGES.filter((s) => s !== 'passed');

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function tally(values: (string | null | undefined)[], fallback: string) {
  const counts = new Map<string, number>();
  for (const v of values) {
    const key = v?.trim() || fallback;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = values.length || 1;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count, pct: Math.round((count / total) * 100) }));
}

/** Deals added to the board, and investments made, per calendar month. */
function monthly(deals: InvestorDeal[], months: number, now = new Date()) {
  const rows: { key: string; label: string; added: number; invested: number }[] = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    rows.push({ key: `${d.getUTCFullYear()}-${d.getUTCMonth()}`, label: MONTHS_EN[d.getUTCMonth()], added: 0, invested: 0 });
  }
  const at = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : rows.find((r) => r.key === `${d.getUTCFullYear()}-${d.getUTCMonth()}`) ?? null;
  };
  for (const deal of deals) {
    const added = at(deal.createdAt);
    if (added) added.added += 1;
    const invested = at(deal.investedAt);
    if (invested) invested.invested += 1;
  }
  return rows;
}

function MonthlyBars({ rows }: { rows: ReturnType<typeof monthly> }) {
  const max = Math.max(1, ...rows.map((r) => r.added));
  const W = 420;
  const H = 120;
  const slot = (W - 20) / rows.length;
  const bar = Math.min(26, slot * 0.55);
  return (
    <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full" role="img" aria-label="Deals added and investments made per month">
      {rows.map((r, i) => {
        const x = 10 + i * slot + (slot - bar) / 2;
        const addedH = (r.added / max) * H;
        const investedH = (r.invested / max) * H;
        return (
          <g key={r.key}>
            <rect x={x} y={H - addedH} width={bar} height={addedH} rx={3} fill="hsl(var(--primary))" opacity={0.25} />
            <rect x={x} y={H - investedH} width={bar} height={investedH} rx={3} fill="hsl(var(--primary))" opacity={0.9} />
            {r.added > 0 && (
              <text x={x + bar / 2} y={H - addedH - 4} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.7}>{r.added}</text>
            )}
            <text x={x + bar / 2} y={H + 16} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.55}>{r.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Donut({ slices, total, colors }: { slices: { name: string; count: number }[]; total: number; colors: readonly string[] }) {
  const R = 50;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <svg viewBox="0 0 140 130" className="mx-auto w-full max-w-[180px]" role="img" aria-label={`${total} deals by industry`}>
      {slices.map((s, i) => {
        const share = total ? s.count / total : 0;
        const dash = share * C;
        const rotate = offset * 360 - 90;
        offset += share;
        return (
          <circle
            key={s.name}
            cx={70}
            cy={65}
            r={R}
            fill="none"
            stroke={colors[i % colors.length]}
            strokeWidth={18}
            strokeDasharray={`${dash} ${C - dash}`}
            transform={`rotate(${rotate} 70 65)`}
          />
        );
      })}
      <text x={70} y={63} textAnchor="middle" fontSize={16} fontWeight={700} fill="currentColor">{total}</text>
      <text x={70} y={78} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.55}>deals</text>
    </svg>
  );
}

export default function InvestorAnalyticsPage() {
  const [period, setPeriod] = useState<'3m' | '6m' | '1y'>('6m');
  const [tab, setTab] = useState('flow');
  const theme = useChartTheme();

  const { data: summary } = useQuery({
    queryKey: qk('investor', 'summary'),
    queryFn: getInvestorSummary,
    staleTime: 60_000,
    retry: 0,
  });
  // The pipeline's own read, under its key: one list behind both pages.
  const { data: dealsPage, isLoading: dealsLoading } = useQuery({
    queryKey: qk('investor', 'deals'),
    queryFn: () => listInvestorDeals({ limit: 100 }),
    staleTime: 60_000,
    retry: 0,
  });
  const deals = useMemo(() => dealsPage?.deals ?? [], [dealsPage]);
  const currency = deals.find((d) => d.currency)?.currency ?? 'EUR';

  /*
   * Time to close needs the interval between a deal entering the board and
   * reaching `invested`; deals that carry both dates measure it.
   */
  const reviewed = summary ? summary.totalDeals - (summary.stageCounts?.discovered ?? 0) : null;
  const conversion = summary && reviewed && reviewed > 0 ? Math.round((summary.investments / reviewed) * 1000) / 10 : null;
  const closed = deals.filter((d) => d.investedAt && d.createdAt);
  const daysToClose = closed.length
    ? Math.round(closed.reduce((sum, d) => sum + (Date.parse(d.investedAt!) - Date.parse(d.createdAt)) / 86_400_000, 0) / closed.length)
    : null;

  const kpis = [
    { label: 'Deals reviewed', labelEl: 'Αξιολογημένες', value: reviewed == null ? '—' : String(reviewed), icon: Target, caption: summary ? `${summary.totalDeals} on the board` : undefined, captionEl: summary ? `${summary.totalDeals} στον πίνακα` : undefined },
    { label: 'Invested', labelEl: 'Επενδύσεις', value: summary ? String(summary.investments) : '—', icon: DollarSign },
    { label: 'Conversion rate', labelEl: 'Ποσοστό μετατροπής', value: conversion == null ? '—' : `${conversion}%`, icon: TrendingUp, caption: 'Invested ÷ reviewed', captionEl: 'Επενδύσεις ÷ αξιολογημένες' },
    { label: 'Avg time to close', labelEl: 'Μέσος χρόνος κλεισίματος', value: daysToClose == null ? '—' : `${daysToClose} d`, icon: Calendar, caption: closed.length ? `Over ${closed.length} investments` : 'No investment closed yet', captionEl: closed.length ? `Σε ${closed.length} επενδύσεις` : 'Καμία επένδυση ακόμα' },
    { label: 'Total deployed', labelEl: 'Επενδυμένο κεφάλαιο', value: money(summary?.deployedCents, currency), icon: BarChart3 },
    { label: 'Portfolio value', labelEl: 'Αξία χαρτοφυλακίου', value: money(summary?.currentValueCents, currency), icon: LineChart, caption: summary?.returnPct != null ? `${summary.returnPct > 0 ? '+' : ''}${summary.returnPct}% on deployed` : undefined, captionEl: summary?.returnPct != null ? `${summary.returnPct > 0 ? '+' : ''}${summary.returnPct}% επί του επενδυμένου` : undefined },
  ];

  // Deals that reached each stage of the forward path (a deal in due
  // diligence has been reviewed and met), plus the ones passed on.
  const stageIndex = (s: PipelineStage) => FUNNEL_STAGES.indexOf(s as (typeof FUNNEL_STAGES)[number]);
  const active = deals.filter((d) => d.pipelineStage !== 'passed');
  const funnel = FUNNEL_STAGES.map((stage, i) => ({
    stage,
    reached: active.filter((d) => stageIndex(d.pipelineStage) >= i).length,
    now: active.filter((d) => d.pipelineStage === stage).length,
  }));
  const passed = deals.filter((d) => d.pipelineStage === 'passed').length;
  const top = Math.max(1, funnel[0]?.reached ?? 0);

  const months = period === '3m' ? 3 : period === '6m' ? 6 : 12;
  const rows = useMemo(() => monthly(deals, months), [deals, months]);
  const sectors = useMemo(() => tally(deals.map((d) => d.industry), 'Unspecified'), [deals]);
  const cities = useMemo(() => tally(deals.map((d) => d.location?.split(',')[0]), 'Unspecified'), [deals]);
  const holdings = deals.filter((d) => d.investedCents != null && d.investedCents > 0);
  const investedTotal = holdings.reduce((sum, d) => sum + (d.investedCents ?? 0), 0);
  const valueTotal = holdings.reduce((sum, d) => sum + (d.currentValueCents ?? d.investedCents ?? 0), 0);
  const moic = investedTotal ? valueTotal / investedTotal : null;

  usePageControls([
    choiceControl('period', 'Analytics window', 'Περίοδος στατιστικών', [
      { value: '3m', en: '3 months', el: '3 μήνες' },
      { value: '6m', en: '6 months', el: '6 μήνες' },
      { value: '1y', en: '1 year', el: '1 έτος' },
    ], period, (v) => setPeriod(v as typeof period)),
    choiceControl('tab', 'Analytics view', 'Προβολή στατιστικών', [
      { value: 'flow', en: 'Deal flow', el: 'Ροή συμφωνιών' },
      { value: 'sectors', en: 'Sectors', el: 'Κλάδοι' },
      { value: 'geo', en: 'Geography', el: 'Γεωγραφία' },
      { value: 'returns', en: 'Portfolio returns', el: 'Αποδόσεις χαρτοφυλακίου' },
    ], tab, setTab),
  ]);
  usePublishPageSnapshot('/investor/analytics', summary ? {
    state: 'ready',
    figures: Object.fromEntries(kpis.map((k) => [k.label, k.value])),
  } : null);

  const empty = !dealsLoading && deals.length === 0;

  return (
    <AppShell showHelp
      actions={
        <div role="group" aria-label="Analytics window" className="inline-flex items-center gap-0.5 rounded-xl border border-border bg-muted/40 p-0.5">
          {([
            ['3m', '3 months', '3 μήνες'],
            ['6m', '6 months', '6 μήνες'],
            ['1y', '1 year', '1 έτος'],
          ] as const).map(([p, en, el]) => (
            <button
              key={p}
              type="button"
              aria-pressed={period === p}
              onClick={() => setPeriod(p)}
              className={cn(
                'min-h-8 rounded-lg px-3 text-xs font-medium transition-colors focus-ring',
                period === p ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <BilingualText en={en} el={el} compact />
            </button>
          ))}
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {kpis.map((k) => (
            <MetricTile key={k.label} icon={k.icon} label={k.label} labelEl={k.labelEl} value={k.value} caption={k.caption} captionEl={k.captionEl} />
          ))}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="flow"><BilingualText en="Deal flow" el="Ροή συμφωνιών" compact /></TabsTrigger>
            <TabsTrigger value="sectors"><BilingualText en="Sectors" el="Κλάδοι" compact /></TabsTrigger>
            <TabsTrigger value="geo"><BilingualText en="Geography" el="Γεωγραφία" compact /></TabsTrigger>
            <TabsTrigger value="returns"><BilingualText en="Portfolio returns" el="Αποδόσεις" compact /></TabsTrigger>
          </TabsList>

          <TabsContent value="flow" className="mt-6">
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
              <SectionCard title="Deals added per month" titleEl="Νέες συμφωνίες ανά μήνα" icon={BarChart3}>
                {empty ? (
                  <EmptyLine en="Add a startup to your board and it is counted here." el="Προσθέστε μια startup στον πίνακα για να μετρηθεί εδώ." />
                ) : (
                  <>
                    <MonthlyBars rows={rows} />
                    <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary/25" aria-hidden="true" /> <BilingualText en="Added to the board" el="Προστέθηκαν στον πίνακα" compact /></span>
                      <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" aria-hidden="true" /> <BilingualText en="Invested" el="Επένδυση" compact /></span>
                    </p>
                  </>
                )}
              </SectionCard>

              <SectionCard
                title="Pipeline funnel"
                titleEl="Χοάνη συμφωνιών"
                icon={Filter}
                action={{ href: '/investor/pipeline', label: 'Pipeline', labelEl: 'Pipeline' }}
              >
                {empty && <EmptyLine en="No deals on the board yet." el="Δεν υπάρχουν συμφωνίες στον πίνακα ακόμα." />}
                {!empty && (
                  <ul className="space-y-3">
                    {funnel.map(({ stage, reached, now }) => {
                      const pct = Math.round((reached / top) * 100);
                      return (
                        <li key={stage}>
                          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                            <span><BilingualText en={STAGE_LABEL[stage].en} el={STAGE_LABEL[stage].el} compact /></span>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                              <span className="font-semibold text-foreground">{reached}</span> reached · {now} here now
                            </span>
                          </div>
                          <Progress value={pct} className="h-2" aria-label={`${STAGE_LABEL[stage].en}: ${reached} deals reached this stage`} />
                        </li>
                      );
                    })}
                    {passed > 0 && (
                      <li className="pt-1 text-xs text-muted-foreground">
                        <BilingualText en={`${passed} passed on`} el={`${passed} απορρίφθηκαν`} compact />
                      </li>
                    )}
                  </ul>
                )}
              </SectionCard>
            </div>
          </TabsContent>

          <TabsContent value="sectors" className="mt-6">
            <SectionCard title="Deals by industry" titleEl="Συμφωνίες ανά κλάδο" icon={PieChart}>
              {empty && <EmptyLine en="No deals on the board yet." el="Δεν υπάρχουν συμφωνίες στον πίνακα ακόμα." />}
              {!empty && (
                <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-[180px_minmax(0,1fr)]">
                  <Donut slices={sectors} total={deals.length} colors={theme.series} />
                  <ul className="space-y-3">
                    {sectors.map((s, i) => (
                      <li key={s.name}>
                        <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: theme.series[i % theme.series.length] }} aria-hidden="true" />
                            <span className="truncate">{s.name}</span>
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{s.count} · {s.pct}%</span>
                        </div>
                        <Progress value={s.pct} className="h-1.5" aria-label={`${s.name}: ${s.pct}% of deals`} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="geo" className="mt-6">
            <SectionCard title="Where the deals are" titleEl="Πού βρίσκονται οι συμφωνίες" icon={MapPin}>
              {empty && <EmptyLine en="No deals on the board yet." el="Δεν υπάρχουν συμφωνίες στον πίνακα ακόμα." />}
              {!empty && (
                <ul className="space-y-3">
                  {cities.map((c) => (
                    <li key={c.name}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                        <span>{c.name}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">{c.count} · {c.pct}%</span>
                      </div>
                      <Progress value={c.pct} className="h-1.5" aria-label={`${c.name}: ${c.pct}% of deals`} />
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="returns" className="mt-6">
            <SectionCard title="Portfolio returns" titleEl="Αποδόσεις χαρτοφυλακίου" icon={Zap} action={{ href: '/investor/portfolio', label: 'Portfolio', labelEl: 'Χαρτοφυλάκιο' }}>
              {holdings.length === 0 && <EmptyLine en="Returns appear once a deal is marked invested." el="Οι αποδόσεις εμφανίζονται όταν μια συμφωνία σημειωθεί ως επένδυση." />}
              {holdings.length > 0 && (
                // Rows of the section, not tiles: a hairline between them,
                // the multiple at the right of each name.
                <ul className="divide-y divide-border">
                  {holdings.map((d) => {
                    const value = d.currentValueCents ?? d.investedCents ?? 0;
                    const multiple = d.investedCents ? value / d.investedCents : 1;
                    return (
                      <li key={d.id} className="py-3 first:pt-0 last:pb-0">
                        <RowHead
                          title={<span className="block truncate">{d.name}</span>}
                          subtitle={<BilingualText en={`Invested ${money(d.investedCents, d.currency)}`} el={`Επένδυση ${money(d.investedCents, d.currency)}`} compact />}
                          asideStays
                          aside={(
                            <div className="text-right">
                              <p className={cn('card-body font-semibold tabular-nums', multiple >= 1 ? 'text-status-success' : 'text-status-danger')}>{multiple.toFixed(2)}×</p>
                              <p className="text-xs text-muted-foreground"><BilingualText en={`${money(value, d.currency)} now`} el={`${money(value, d.currency)} σήμερα`} compact /></p>
                            </div>
                          )}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
              {holdings.length > 0 && (
                <dl className="grid grid-cols-3 gap-3 border-t border-border pt-3 card-body">
                  <div>
                    <dt className="text-xs text-muted-foreground"><BilingualText en="Invested" el="Επένδυση" compact /></dt>
                    <dd className="font-semibold tabular-nums">{money(investedTotal, currency)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground"><BilingualText en="Current value" el="Τρέχουσα αξία" compact /></dt>
                    <dd className="font-semibold tabular-nums">{money(valueTotal, currency)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground"><BilingualText en="Unrealised MOIC" el="Μη πραγματοποιημένο MOIC" compact /></dt>
                    <dd className={cn('font-semibold tabular-nums', (moic ?? 1) >= 1 ? 'text-status-success' : 'text-status-danger')}>{moic ? `${moic.toFixed(2)}×` : '—'}</dd>
                  </div>
                </dl>
              )}
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link href="/investor/portfolio">
                  <BilingualText en="Full portfolio" el="Πλήρες χαρτοφυλάκιο" compact />
                  <ArrowUpRight className="ml-1 icon-sm" aria-hidden="true" />
                </Link>
              </Button>
            </SectionCard>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
