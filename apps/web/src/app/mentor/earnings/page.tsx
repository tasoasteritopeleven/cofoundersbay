'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DollarSign, Clock, Download, ArrowUpRight, Star, CheckCircle2, BarChart3, CreditCard,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualAria, formatShortDate } from '@/lib/i18n/format';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';
import { downloadCsv } from '@/lib/csv';
import { choiceControl, usePageControls, usePageList } from '@/lib/page-controls';
import { SampleDataNotice } from '@/components/common/SampleDataNotice';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useSession } from '@/hooks/useSession';
import { useDemoData } from '@/contexts/DemoDataContext';
import { getMeProfile } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { MENTOR_DEMO_EARNINGS } from '@/lib/demo/mentor-world';

// ── Mock data (replace with real API calls) ──────────────────────────────────

/*
 * Sample rows are dated relative to today. They were fixed to January 2025,
 * and once the period select started bounding the history (default: this
 * month) every one of them fell outside it - demo mode showed $0 earned and an
 * empty session history, which is the opposite of what a sample is for.
 */
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);
// The same rows the mentor dashboard counts its month from (demo/mentor-world).
const MOCK_TRANSACTION_ROWS = MENTOR_DEMO_EARNINGS;
function mockTransactions() {
  return MOCK_TRANSACTION_ROWS.map((r) => ({
    id: r.id,
    mentee: { name: r.name, avatarUrl: null as string | null },
    type: 'session',
    duration: r.duration,
    amount: r.amount,
    currency: 'USD',
    date: daysAgo(r.ago),
    status: r.status as 'paid' | 'pending',
    topic: r.topic,
  }));
}

const MOCK_MONTHLY_TOTALS = [
  { earned: 180, sessions: 3 },
  { earned: 300, sessions: 5 },
  { earned: 240, sessions: 4 },
  { earned: 420, sessions: 7 },
  { earned: 360, sessions: 6 },
  { earned: 570, sessions: 6 },
];
/** The last six month names, oldest first, ending with the current month. */
function mockMonthly() {
  const now = new Date();
  return MOCK_MONTHLY_TOTALS.map((m, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (MOCK_MONTHLY_TOTALS.length - 1 - i), 1);
    // "10/26" reads the same in both languages.
    return { month: d.toLocaleDateString('en-GB', { month: '2-digit', year: '2-digit' }), ...m };
  });
}

const PERIODS: { value: string; en: string; el: string; days: number }[] = [
  { value: 'this_month', en: 'This month', el: 'Αυτός ο μήνας', days: 31 },
  { value: 'last_month', en: 'Last month', el: 'Προηγούμενος μήνας', days: 62 },
  { value: 'last_3', en: 'Last 3 months', el: 'Τελευταίοι 3 μήνες', days: 92 },
  { value: 'last_6', en: 'Last 6 months', el: 'Τελευταίοι 6 μήνες', days: 183 },
  { value: 'ytd', en: 'Year to date', el: 'Από την αρχή του έτους', days: 366 },
];


function formatCurrency(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents);
}

export default function MentorEarningsPage() {
  const { hasSession, mounted } = useSession();
  const { showDemoData } = useDemoData();
  const { primary } = useLanguagePreference();
  const [period, setPeriod] = useState('this_month');

  const { data: profile } = useQuery({
    queryKey: queryKeys.me.profile(),
    queryFn: getMeProfile,
    enabled: hasSession && mounted,
  });

  const allTransactions = showDemoData ? mockTransactions() : [];
  const monthlyData = showDemoData ? mockMonthly() : [];

  /* The period select used to be set dressing - it now bounds the session
     history it sits above. */
  const activePeriod = PERIODS.find((p) => p.value === period) ?? PERIODS[0];
  const cutoff = Date.now() - activePeriod.days * DAY;
  const transactions = allTransactions.filter((t) => new Date(t.date).getTime() >= cutoff);

  const exportCsv = () => {
    if (!transactions.length) return;
    // Through the shared quoting: a mentee name with a comma used to split
    // into two columns here (only the topic was quoted).
    downloadCsv(
      `earnings-${period}`,
      ['Date', 'Mentee', 'Topic', 'Duration (min)', 'Amount', 'Currency', 'Status'],
      transactions.map((t) => [t.date, t.mentee.name, t.topic, t.duration, t.amount, t.currency, t.status]),
    );
  };

  const totalEarned = transactions.filter(t => t.status === 'paid').reduce((sum, t) => sum + t.amount, 0);
  const pendingAmount = transactions.filter(t => t.status === 'pending').reduce((sum, t) => sum + t.amount, 0);
  const totalSessions = transactions.length;
  const paidCount = transactions.filter(t => t.status === 'paid').length;
  const avgPerSession = paidCount > 0 ? totalEarned / paidCount : 0;

  usePageList([
    {
      id: 'sessions',
      labelEn: 'Paid sessions',
      labelEl: 'Πληρωμένες συνεδρίες',
      rows: transactions.map((t) => `${t.date.slice(0, 10)} · ${t.mentee.name} · ${t.topic} · ${t.duration} min · $${t.amount} · ${t.status}`),
      total: allTransactions.length,
      sample: showDemoData,
    },
  ]);
  // Offered to the assistant: the rail's period and export. Above the
  // loading return: a hook after it runs on some renders and not others
  // (React #310 on this page in the round-12 sweep).
  usePageControls([
    choiceControl('period', 'Earnings period', 'Περίοδος εσόδων', PERIODS, period, setPeriod),
    {
      id: 'export_csv',
      labelEn: 'Export sessions as CSV',
      labelEl: 'Εξαγωγή συνεδριών σε CSV',
      writes: false,
      unavailableEn: transactions.length ? undefined : 'There are no sessions in this period to export.',
      unavailableEl: transactions.length ? undefined : 'Δεν υπάρχουν συνεδρίες σε αυτή την περίοδο για εξαγωγή.',
      run: exportCsv,
    },
  ]);

  if (!mounted) {
    return (
      <AppShell showHelp>
        <div className="space-y-6">
          <Skeleton className="h-10 w-60" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        </div>
      </AppShell>
    );
  }

  const figures = [
    { id: 'earned', icon: DollarSign, en: 'Total Earned', el: 'Συνολικά έσοδα', value: formatCurrency(totalEarned), subEn: 'from paid sessions', subEl: 'από πληρωμένες συνεδρίες', tone: 'text-primary-accessible' },
    { id: 'pending', icon: Clock, en: 'Pending Payout', el: 'Εκκρεμής πληρωμή', value: formatCurrency(pendingAmount), subEn: 'awaiting release', subEl: 'αναμένει αποδέσμευση', tone: 'text-status-warning' },
    { id: 'sessions', icon: BarChart3, en: 'Sessions', el: 'Συνεδρίες', value: String(totalSessions), subEn: 'this period', subEl: 'σε αυτή την περίοδο', tone: 'text-primary-accessible' },
    { id: 'avg', icon: Star, en: 'Avg. Per Session', el: 'Μέσος όρος ανά συνεδρία', value: formatCurrency(avgPerSession), subEn: 'blended rate', subEl: 'μικτή τιμή', tone: 'text-primary-accessible' },
  ];
  const pendingCount = transactions.filter((t) => t.status === 'pending').length;

  /*
   * The page rail. The column is the session history, the monthly chart and
   * the payout settings - the three things this page is for. The four totals
   * that opened it, the period that bounds them and the export are about that
   * history, so they sit one gesture away; the badge on the totals is the
   * number of sessions still awaiting payout.
   */

  const rail: PageRailSection[] = [
    {
      id: 'figures',
      glyph: 'wallet',
      labelEn: 'Earnings totals',
      labelEl: 'Σύνολα εσόδων',
      badge: pendingCount || null,
      content: (
        <ul className="space-y-2">
          {figures.map(({ id, icon: Icon, en, el, value, subEn, subEl, tone }) => (
            <li key={id} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <Icon className={cn('icon-sm shrink-0', tone)} aria-hidden="true" />
                <span className="text-sm text-muted-foreground"><BilingualText en={en} el={el} compact wrap /></span>
              </div>
              <p className="page-stat mt-1 text-xl font-bold tabular-nums">{value}</p>
              <p className="text-xs text-muted-foreground"><BilingualText en={subEn} el={subEl} compact wrap /></p>
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: 'period',
      glyph: 'calendar',
      labelEn: 'Period',
      labelEl: 'Περίοδος',
      badge: period !== PERIODS[0].value ? 1 : null,
      content: (
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
      ),
    },
    {
      id: 'export',
      glyph: 'book',
      labelEn: 'Export',
      labelEl: 'Εξαγωγή',
      content: (
        <button
          type="button"
          onClick={exportCsv}
          disabled={!transactions.length}
          className="tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="icon-sm shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <BilingualText
              en={`Export ${transactions.length} sessions as CSV`}
              el={`Εξαγωγή ${transactions.length} συνεδριών σε CSV`}
              compact
              wrap
            />
          </span>
        </button>
      ),
    },
  ];

  return (
    <AppShell showHelp rail={rail}>
      <div className="space-y-6">
        {showDemoData && (
          <SampleDataNotice
            surface="Earnings"
            detail="Transactions and monthly totals are illustrative - there is no mentor earnings ledger yet."
            askAiPrompt="Why does the earnings page show sample transactions?"
          />
        )}

        {/* The period lives in the rail; the column still says which one is
            on, because a history with no stated range reads as all of it. */}
        <p className="text-sm text-muted-foreground">
          <BilingualText
            en={`${activePeriod.en} · ${totalSessions} sessions · ${formatCurrency(totalEarned)} earned`}
            el={`${activePeriod.el} · ${totalSessions} συνεδρίες · ${formatCurrency(totalEarned)} έσοδα`}
            compact
            wrap
          />
        </p>

        <Tabs defaultValue="transactions">
          <TabsList>
            <TabsTrigger value="transactions"><BilingualText en="Transactions" el="Συναλλαγές" compact /></TabsTrigger>
            <TabsTrigger value="chart"><BilingualText en="Monthly Overview" el="Μηνιαία επισκόπηση" compact /></TabsTrigger>
            <TabsTrigger value="payout"><BilingualText en="Payout Settings" el="Ρυθμίσεις πληρωμών" compact /></TabsTrigger>
          </TabsList>

          {/* Transactions */}
          <TabsContent value="transactions">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base"><BilingualText en="Session History" el="Ιστορικό συνεδριών" compact /></CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {transactions.map(tx => (
                    // Amount and status stack on the right; the date joins the
                    // topic line below sm. Five columns in one row drew the
                    // name, amount and duration on top of each other at 390px.
                    <div key={tx.id} className="flex items-center gap-3 px-4 sm:px-6 py-3 transition-colors hover:bg-muted/30 sm:gap-4">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={tx.mentee?.avatarUrl ?? undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary-accessible text-xs font-semibold">
                          {tx.mentee.name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{tx.mentee.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {tx.topic} · {tx.duration} min<span className="sm:hidden"> · {formatShortDate(tx.date, primary)}</span>
                        </p>
                      </div>
                      <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
                        <p className="text-sm font-semibold tabular-nums">{formatCurrency(tx.amount)}</p>
                        <Badge
                          variant={tx.status === 'paid' ? 'secondary' : 'outline'}
                          className={cn(
                            'text-xs',
                            tx.status === 'paid' ? 'text-status-success bg-status-success-bg' : 'text-status-warning bg-status-warning-bg'
                          )}
                        >
                          {tx.status === 'paid' ? (
                            <><CheckCircle2 className="icon-sm mr-1" /><BilingualText en="Paid" el="Πληρώθηκε" compact /></>
                          ) : 'Pending'}
                        </Badge>
                      </div>
                      <p className="hidden w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:block">{formatShortDate(tx.date, primary)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Chart */}
          <TabsContent value="chart">
            <Card>
              <CardHeader>
                <CardTitle className="text-base"><BilingualText en="Monthly Earnings" el="Μηνιαία έσοδα" compact /></CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-3 h-48">
                  {monthlyData.map(m => (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs font-semibold text-primary-accessible">{formatCurrency(m.earned)}</span>
                      <div
                        className="w-full rounded-t bg-primary/80 hover:bg-primary transition-colors min-h-[4px]"
                        style={{ height: `${monthlyData.length ? (m.earned / Math.max(...monthlyData.map(d => d.earned))) * 160 : 4}px` }}
                        title={`${m.sessions} sessions`}
                      />
                      <span className="text-xs text-muted-foreground">{m.month}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border my-4" />
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="page-stat text-xl font-bold">{formatCurrency(monthlyData.reduce((s, m) => s + m.earned, 0))}</p>
                    <p className="text-xs text-muted-foreground">6-month total</p>
                  </div>
                  <div>
                    <p className="page-stat text-xl font-bold">{monthlyData.reduce((s, m) => s + m.sessions, 0)}</p>
                    <p className="text-xs text-muted-foreground"><BilingualText en="Total sessions" el="Σύνολο συνεδριών" compact /></p>
                  </div>
                  <div>
                    <p className="page-stat text-xl font-bold">
                      {(() => { const tot = monthlyData.reduce((s, m) => s + m.sessions, 0); return formatCurrency(tot ? monthlyData.reduce((s, m) => s + m.earned, 0) / tot : 0); })()}
                    </p>
                    <p className="text-xs text-muted-foreground"><BilingualText en="Avg per session" el="Μέσος όρος ανά συνεδρία" compact /></p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payout */}
          <TabsContent value="payout">
            <Card>
              <CardHeader><CardTitle className="text-base"><BilingualText en="Payout Settings" el="Ρυθμίσεις πληρωμών" compact /></CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/30">
                  <CreditCard className="icon-xl text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium"><BilingualText en="No payout method connected" el="Δεν έχει συνδεθεί τρόπος πληρωμής" compact /></p>
                    <p className="text-xs text-muted-foreground"><BilingualText en="Connect Stripe or bank account to receive payouts" el="Συνδέστε Stripe ή τραπεζικό λογαριασμό για να πληρώνεστε" wrap /></p>
                  </div>
                  <Button size="sm" disabled title="Payout providers are not connected yet">
                    <ArrowUpRight className="mr-2 icon-sm" />
                    <BilingualText en="Connect" el="Σύνδεση" compact />
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {['Stripe Connect', 'Bank Transfer (SEPA)', 'PayPal', 'Wise'].map(method => (
                    <div key={method} className="flex items-center justify-between p-3 rounded-lg border">
                      <span className="text-sm font-medium">{method}</span>
                      <Button variant="outline" size="sm" disabled title="Payout providers are not connected yet"><BilingualText en="Connect" el="Σύνδεση" compact /></Button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Payouts are processed within 2–5 business days after session completion.
                  Platform fee: 10% per transaction.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
