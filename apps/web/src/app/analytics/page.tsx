'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePublishPageSnapshot } from '@/contexts/PageSnapshotContext';
import { useQuery } from '@tanstack/react-query';
import {
  getAnalyticsAchievements,
  getAnalyticsOverview,
} from '@/lib/api';
import { ArrowUp, ArrowDown, ArrowRight, RefreshCw } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { usePageRail } from '@/components/layout/PageRailContext';
import { choiceControl, usePageControls } from '@/lib/page-controls';
import { BilingualText } from '@/components/common/BilingualText';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { isPreviewDemo } from '@/lib/preview-demo';
import { STATUS, TREND } from '@/lib/semantic-colors';
import { CfbGlyph } from '@/components/icons/CfbGlyph';
import { analyticsEn, analyticsEl } from '@/lib/i18n/strings-analytics';
import { formatShortDate } from '@/lib/i18n/format';
import { metricsToDisplay, type AnalyticsMetric } from './metrics';
import { BadgesWidget } from '@/components/gamification/BadgesWidget';
import { qk } from '@/lib/query-keys';

const ProfileViewsChart = dynamic(
  () => import('./AnalyticsCharts').then((m) => ({ default: m.ProfileViewsChart })),
  { ssr: false, loading: () => <Skeleton className="h-[300px] w-full rounded-xl" /> }
);
const EngagementBreakdown = dynamic(
  () => import('./AnalyticsCharts').then((m) => ({ default: m.EngagementBreakdown })),
  { ssr: false, loading: () => <Skeleton className="h-[440px] w-full rounded-xl" /> }
);

interface TopContent {
  id: string;
  type: 'post' | 'comment' | 'profile';
  title: string;
  views: number;
  engagement: number;
  date: string;
}

const WEEKDAY_EL: Record<string, string> = {
  Monday: 'Δευτέρα',
  Tuesday: 'Τρίτη',
  Wednesday: 'Τετάρτη',
  Thursday: 'Πέμπτη',
  Friday: 'Παρασκευή',
  Saturday: 'Σάββατο',
  Sunday: 'Κυριακή',
};

/** "3h 20m" → "3ω 20λ": the API sends English duration units. */
function durationEl(value: string): string {
  return value.replace(/(\d+)\s*h\b/g, '$1ω').replace(/(\d+)\s*m(in)?\b/g, '$1λ');
}

type AnalyticsTab = 'overview' | 'engagement' | 'growth';

function metricHref(label: string): string | null {
  if (label === 'Profile Views') return '/profile';
  if (label === 'New Connections') return '/connections';
  if (label === 'Messages Sent') return '/messages';
  if (label === 'Search Appearances') return '/discover';
  return null;
}

function analyticsHref(period: Period, tab: AnalyticsTab): string {
  const params = new URLSearchParams();
  if (period !== '7d') params.set('period', period);
  if (tab !== 'overview') params.set('tab', tab);
  const query = params.toString();
  return query ? `/analytics?${query}` : '/analytics';
}

function isTab(value: string | null): value is AnalyticsTab {
  return value === 'overview' || value === 'engagement' || value === 'growth';
}

function metricValue(metric: AnalyticsMetric) {
  if (metric.value === null) return '—';
  return metric.label === 'Engagement Rate' || metric.label === 'Activity Score'
    ? `${metric.value}%` : metric.value.toLocaleString('en-GB');
}

function MetricCard({
  metric,
  sparkValues,
  onOpenTab,
}: {
  metric: AnalyticsMetric;
  sparkValues?: number[];
  onOpenTab?: (tab: AnalyticsTab) => void;
}) {
  const ChangeIcon =
    metric.changeType === 'increase'
      ? ArrowUp
      : metric.changeType === 'decrease'
      ? ArrowDown
      : ArrowRight;
  const href = metricHref(metric.label);
  const tab: AnalyticsTab | null =
    metric.label === 'Engagement Rate' ? 'engagement'
    : metric.label === 'Activity Score' || metric.label === 'Profile Views' ? 'growth'
    : null;

  // `h-full` down the chain, so every card fills its grid row; the Profile
  // Views card is taller than the rest by its sparkline.
  const body = (
    <Card className="h-full min-w-0 border-border transition-colors hover:border-border">
      {/* Stretched by the sparkline card's row, a plain tile centres its
          figure instead of leaving a dead band at the bottom. */}
      <CardContent className="flex h-full flex-col justify-center">
        <div className="mb-3 flex items-start justify-between gap-3">
          <CfbGlyph name={metric.glyph} className="icon-sm text-muted-foreground/70" />
          <span
            className={cn(
              'page-stat-label flex items-center gap-1 tabular-nums',
              metric.changeType === 'increase'
                ? TREND.up
                : metric.changeType === 'decrease'
                ? TREND.down
                : 'text-muted-foreground',
            )}
          >
            <ChangeIcon className="size-[1.08em] shrink-0" />
            {metric.change === null ? '—' : `${Math.abs(metric.change)}%`}
          </span>
        </div>
        <h3 className="page-stat mb-1 font-semibold tabular-nums tracking-tight">{metricValue(metric)}</h3>
        <p className="page-stat-label leading-snug text-muted-foreground">
          <BilingualText en={metric.label} el={metric.labelEl} compact wrap />
        </p>
        {sparkValues && sparkValues.length > 1 && (
          <div className="mt-3">
            <Sparkline values={sparkValues} />
            <p className="page-stat-label mt-1 text-muted-foreground">
              <BilingualText en={analyticsEn('spark_caption')} el={analyticsEl('spark_caption')} wrap />
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full min-w-0 rounded-2xl focus-ring">
        {body}
      </Link>
    );
  }
  if (tab && onOpenTab) {
    return (
      <button type="button" className="block h-full min-w-0 rounded-2xl text-left focus-ring" onClick={() => onOpenTab(tab)}>
        {body}
      </button>
    );
  }
  return body;
}

function Sparkline({ values, color = 'hsl(var(--primary))' }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const w = 80; const h = 28;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} className="opacity-60">
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

function ProfileFunnel({ metrics }: { metrics: AnalyticsMetric[] }) {
  const views = metrics.find((m) => m.label === 'Profile Views')?.value ?? null;
  const connections = metrics.find((m) => m.label === 'New Connections')?.value ?? null;
  // Only stages the API actually counts. Requests and conversations have never
  // been a field — drawing them at 0% with a dash was a hollow funnel, not a
  // measurement. Those destinations stay as the next action, not as fake bars.
  const stages = [
    { key: 'views', labelEn: analyticsEn('stage_views'), labelEl: analyticsEl('stage_views'), value: views, bar: 'bg-primary/70', href: '/profile' as const },
    { key: 'accepted', labelEn: analyticsEn('stage_accepted'), labelEl: analyticsEl('stage_accepted'), value: connections, bar: 'bg-status-success-mark', href: '/connections' as const },
  ];
  const untracked = [
    { key: 'requests', href: '/discover' as const, en: analyticsEn('funnel_untracked_requests'), el: analyticsEl('funnel_untracked_requests') },
    { key: 'conversations', href: '/messages' as const, en: analyticsEn('funnel_untracked_conversations'), el: analyticsEl('funnel_untracked_conversations') },
  ];
  const maximum = Math.max(1, ...stages.map((stage) => stage.value ?? 0));
  const conversion =
    typeof views === 'number' && views > 0 && typeof connections === 'number'
      ? Math.round((connections / views) * 1000) / 10
      : null;
  return (
    <Card className="min-w-0">
      <CardHeader className="p-3 sm:p-6">
        <CardTitle className="flex items-center gap-2 font-semibold">
          <CfbGlyph name="people" className="icon-sm shrink-0 text-muted-foreground" />
          <BilingualText en={analyticsEn('profile_funnel')} el={analyticsEl('profile_funnel')} wrap />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3.5 pt-0 sm:pt-0">
        <p className="page-stat-label text-muted-foreground">
          <BilingualText en={analyticsEn('funnel_note')} el={analyticsEl('funnel_note')} />
        </p>
        {stages.map((s) => (
          <Link key={s.key} href={s.href} className="block space-y-1.5 rounded-lg focus-ring">
            <div className="flex items-center justify-between gap-3">
              <span className="page-stat-label min-w-0 text-muted-foreground"><BilingualText en={s.labelEn} el={s.labelEl} wrap /></span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">{s.value === null ? '—' : s.value.toLocaleString('en-GB')}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary/40">
              <div className={cn('h-full rounded-full transition-all duration-700', s.bar)} style={{ width: `${(s.value ?? 0) / maximum * 100}%` }} />
            </div>
          </Link>
        ))}
        {conversion !== null && (
          <p className="page-stat-label pt-1 font-semibold tabular-nums text-foreground">
            {conversion}%{' '}
            <span className="font-normal text-muted-foreground">
              <BilingualText en={analyticsEn('view_to_connect')} el={analyticsEl('view_to_connect')} wrap />
            </span>
          </p>
        )}
        {/* Each row is a link: py-1 gives it a 24px target and room from the next one. */}
        <div className="space-y-1 border-t border-border pt-2">
          {untracked.map((row) => (
            <Link key={row.key} href={row.href} className="block min-h-8 rounded-lg py-1 focus-ring hover:text-foreground">
              <p className="text-sm leading-snug text-muted-foreground">
                <BilingualText en={row.en} el={row.el} wrap />
              </p>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function NetworkVelocity({ metrics }: { metrics: AnalyticsMetric[] }) {
  const items = metrics.slice(0, 3).map((m) => ({
    label: m.label,
    labelEl: m.labelEl,
    change: m.change,
    changeType: m.changeType,
    glyph: m.glyph,
  }));
  return (
    <Card className="flex min-w-0 flex-col border-primary/15 bg-primary/[0.03]">
      <CardContent className="flex flex-1 flex-col">
        {/* The period badge sits under the title: bilingual "vs prev period"
            is metadata about the rows, not a peer of the heading. */}
        <div className="mb-4 min-w-0">
          <h3 className="page-section flex min-w-0 items-center gap-2 font-semibold">
            <CfbGlyph name="spark" className="icon-sm shrink-0 text-muted-foreground" />
            <BilingualText en={analyticsEn('network_velocity')} el={analyticsEl('network_velocity')} compact wrap />
          </h3>
          <Badge variant="secondary" className="mt-1.5 max-w-full">
            <span className="page-stat-label truncate">
              <BilingualText en={analyticsEn('vs_prev')} el={analyticsEl('vs_prev')} compact />
            </span>
          </Badge>
        </div>
        {/* Stacked only: this card now lives in the period rail, where three
            columns would be ~90px and wrap every Greek label. */}
        <div className="flex flex-1 flex-col divide-y divide-primary/10">
          {items.map((item) => {
            const href = metricHref(item.label);
            const inner = (
              <>
              <CfbGlyph name={item.glyph} className="icon-sm shrink-0 text-muted-foreground" />
              <p className="page-stat-label min-w-0 flex-1 leading-snug text-muted-foreground">
                <BilingualText en={item.label} el={item.labelEl} compact wrap />
              </p>
              <p className={cn('page-stat-label shrink-0 font-semibold tabular-nums',
                item.changeType === 'increase' ? TREND.up
                : item.changeType === 'decrease' ? TREND.down
                : TREND.flat
              )}>
                {item.change === null ? '—' : `${item.changeType === 'increase' ? '+' : item.changeType === 'decrease' ? '-' : ''}${Math.abs(item.change)}%`}
              </p>
              </>
            );
            const rowClass = 'flex min-w-0 items-center gap-3 py-2.5 first:pt-0 last:pb-0';
            return href ? (
              <Link key={item.label} href={href} className={cn(rowClass, 'rounded-lg focus-ring')}>
                {inner}
              </Link>
            ) : (
              <div key={item.label} className={rowClass}>
                {inner}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function TopContentList({ content }: { content: TopContent[] }) {
  return (
    <Card className="min-w-0">
      <CardHeader className="p-3 sm:p-6">
        <CardTitle className="flex items-center gap-2 font-semibold">
          <CfbGlyph name="chart" className="icon-sm shrink-0 text-muted-foreground" />
          <BilingualText en={analyticsEn('top_content')} el={analyticsEl('top_content')} compact />
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 sm:pt-0">
        <div className="space-y-3.5">
          {content.map((item, index) => (
            <Link
              key={item.id}
              href={item.type === 'profile' ? '/profile' : '/feed'}
              className="flex items-start gap-3 rounded-2xl p-3.5 transition-colors hover:bg-secondary/40"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center text-sm font-semibold tabular-nums text-muted-foreground">
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="mb-1 line-clamp-2 text-sm font-semibold">{item.title}</h4>
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CfbGlyph name="profile" className="icon-sm shrink-0" />
                    {item.views.toLocaleString('en-GB')} <BilingualText en={analyticsEn('views')} el={analyticsEl('views')} compact />
                  </span>
                  <span className="flex items-center gap-1">
                    <CfbGlyph name="spark" className="icon-sm shrink-0" />
                    {item.engagement} <BilingualText en={analyticsEn('engagements')} el={analyticsEl('engagements')} compact />
                  </span>
                  <span>
                    <BilingualText en={formatShortDate(item.date, 'en')} el={formatShortDate(item.date, 'el')} compact />
                  </span>
                </div>
              </div>
              <Badge variant="secondary" className="h-auto max-w-[7rem] whitespace-normal">
                <BilingualText
                  en={item.type}
                  el={item.type === 'post' ? 'ανάρτηση' : item.type === 'comment' ? 'σχόλιο' : 'προφίλ'}
                  wrap
                />
              </Badge>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AchievementsCard({ achievements: rawAchievements }: { achievements?: { id: string; title: string; description: string; icon: string; unlocked: boolean }[] }) {
  const achievements = (rawAchievements ?? []).slice(0, 4).map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    unlocked: a.unlocked,
  }));

  if (!achievements.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-semibold">
          <CfbGlyph name="award" className="icon-sm text-muted-foreground" />
          <BilingualText en={analyticsEn('achievements')} el={analyticsEl('achievements')} wrap />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3">
          {achievements.map((achievement) => (
            <Link
              key={achievement.id}
              href="/achievements"
              className={cn(
                'flex items-start gap-3 rounded-2xl border p-3',
                achievement.unlocked
                  ? 'border-primary/30 bg-primary/[0.04]'
                  : 'border-border opacity-60',
              )}
            >
              <CfbGlyph
                name="award"
                className={cn('icon-sm mt-0.5 shrink-0', achievement.unlocked ? STATUS.warning.icon : 'text-muted-foreground')}
              />
              <div className="min-w-0 flex-1">
              {achievement.unlocked && (
                <Badge variant="default" className="mb-1.5">
                  <BilingualText en={analyticsEn('unlocked')} el={analyticsEl('unlocked')} compact />
                </Badge>
              )}
              <h4 className="mb-1 text-sm font-semibold leading-snug">{achievement.title}</h4>
              <p className="page-stat-label text-muted-foreground">{achievement.description}</p>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/achievements">
              <BilingualText en={analyticsEn('open_achievements')} el={analyticsEl('open_achievements')} wrap />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="min-w-0">
            <CardContent>
              <Skeleton className="mb-3 h-8 w-8" />
              <Skeleton className="mb-2 h-6 w-16" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          <BilingualText en={analyticsEn('load_failed')} el={analyticsEl('load_failed')} />
        </p>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <BilingualText en={analyticsEn('try_again')} el={analyticsEl('try_again')} compact />
        </Button>
      </CardContent>
    </Card>
  );
}

/** The windows this page can show. `7d` is the one it opens on. */
const PERIODS = ['7d', '14d', '30d', '90d'] as const;
type Period = (typeof PERIODS)[number];
const PERIOD_LABEL: Record<Period, { en: string; el: string }> = {
  '7d': { en: '7 days', el: '7 ημέρες' },
  '14d': { en: '14 days', el: '14 ημέρες' },
  '30d': { en: '30 days', el: '30 ημέρες' },
  '90d': { en: '90 days', el: '90 ημέρες' },
};

function isPeriod(value: string | null): value is Period {
  return value !== null && (PERIODS as readonly string[]).includes(value);
}

export default function AnalyticsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openRailSection } = usePageRail();
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');
  const [period, setPeriodState] = useState<Period>('7d');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  /**
   * The window is readable from the address, so it can be linked, shared and
   * set by something other than a click — which is what lets the assistant
   * change it without a second, hidden way of driving this page.
   *
   * It is read after mount rather than during render on purpose: the server
   * renders the default window, and reading the address during the first
   * render would leave the server's markup and the client's disagreeing about
   * which button is pressed.
   */
  useEffect(() => {
    const fromUrl = searchParams?.get('period') ?? null;
    const fromTab = searchParams?.get('tab') ?? null;
    if (isPeriod(fromUrl)) setPeriodState(fromUrl);
    if (isTab(fromTab)) setActiveTab(fromTab);
  }, [searchParams]);

  const setPeriod = useCallback(
    (next: Period) => {
      setPeriodState(next);
      // `replace`, not `push`: stepping through four windows should not leave
      // four entries for Back to walk out of. The default window drops the
      // parameter rather than spelling it, so `/analytics` stays the canonical
      // address for the page as it opens.
      router.replace(analyticsHref(next, activeTab), { scroll: false });
    },
    [router, activeTab],
  );

  const setTab = useCallback(
    (next: AnalyticsTab) => {
      setActiveTab(next);
      router.replace(analyticsHref(period, next), { scroll: false });
    },
    [router, period],
  );

  const { data: overview, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: qk('analytics', 'overview', period),
    queryFn: () => getAnalyticsOverview(period, 5),
    staleTime: 60_000,
    retry: 1,
    enabled: mounted,
  });

  const { data: achievements } = useQuery({
    queryKey: qk('achievements', 'analytics'),
    queryFn: getAnalyticsAchievements,
    staleTime: 60_000,
    retry: 0,
    enabled: mounted,
  });

  const waiting = !mounted || isLoading;
  const metrics = metricsToDisplay(overview?.metrics);

  /**
   * What this screen is showing, for the assistant.
   *
   * The window is part of it: "engagement is down" means nothing without
   * knowing whether the reader is looking at seven days or ninety.
   */
  usePublishPageSnapshot('/analytics', {
    title: 'Analytics',
    state: waiting ? 'loading' : isError ? 'error' : isPreviewDemo() ? 'demo' : 'ready',
    summary: `Account activity over the last ${period.replace('d', '')} days.`,
    figures: {
      Window: period,
      ...Object.fromEntries(
        metrics
          .filter((m) => m.value !== null && m.value !== undefined)
          .map((m) => [m.label, String(m.value)]),
      ),
    },
    actions: ['analytics_set_period', 'navigate'],
  });
  const profileViews = overview?.profileViews;
  const engagement = overview?.engagement;
  const topContent = overview?.topContent;
  const weeklySummary = overview?.weeklySummary;

  const viewsMetric = metrics.find((m) => m.label === 'Profile Views');
  const connMetric = metrics.find((m) => m.label === 'New Connections');
  const msgMetric = metrics.find((m) => m.label === 'Messages Sent');
  const engMetric = metrics.find((m) => m.label === 'Engagement Rate');
  const periodLabel = period === '7d' ? '7 days' : period === '14d' ? '14 days' : period === '30d' ? '30 days' : '90 days';
  const declining = metrics.filter((m) => m.changeType === 'decrease' && m.change !== null);
  const askPrompt = waiting
    ? 'Summarize my profile analytics and tell me the next action on Discover, Messages, or my profile.'
    : `Analytics last ${periodLabel}: ${viewsMetric?.value ?? 0} profile views (${viewsMetric?.change ?? 0}%), ${connMetric?.value ?? 0} new connections, ${msgMetric?.value ?? 0} messages sent, ${engMetric?.value ?? 0}% engagement. What should I do next on Discover, Messages, or my profile to grow this?`;

  /*
   * What frames the numbers, rather than being them.
   *
   * The period selector reframes every figure on the page, which is exactly
   * what a rail is for - and it was sitting above them, pushing the first
   * chart down. Achievements answer a different question on the same screen.
   * The four links are links out. Same controls, same handlers.
   */
  // Offered to the assistant: the rail's window and refresh and the tabs,
  // through the same URL-writing setters (so Back still works).
  usePageControls([
    choiceControl('period', 'Analytics window', 'Περίοδος στατιστικών', PERIODS.map((p) => ({ value: p, en: `${p.replace('d', '')} days`, el: `${p.replace('d', '')} ημέρες` })), period, (v) => setPeriod(v as Period)),
    choiceControl('tab', 'Analytics tab', 'Καρτέλα στατιστικών', (['overview', 'engagement', 'growth'] as const).map((t) => ({ value: t, en: analyticsEn(`tab_${t}`), el: analyticsEl(`tab_${t}`) })), activeTab, (v) => setTab(v as AnalyticsTab)),
    { id: 'refresh', labelEn: 'Refresh analytics', labelEl: 'Ανανέωση στατιστικών', writes: false, run: () => void refetch() },
  ]);

  const rail: PageRailSection[] = [
    {
      id: 'period',
      glyph: 'chart',
      labelEn: 'Period',
      labelEl: 'Περίοδος',
      // The reader should see which window they are looking at without
      // opening anything; the list below is meaningless without it.
      badge: period,
      badgeEl: `${period.replace('d', '')} ημ.`,
      content: (
        <div className="space-y-3">
          <p className="page-stat-label leading-relaxed text-muted-foreground">
            <BilingualText
              en="Every figure on this page is measured over this window."
              el="Κάθε μέγεθος σε αυτή τη σελίδα μετριέται σε αυτό το διάστημα."
              wrap
            />
          </p>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap gap-2.5">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={period === p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    'min-h-10 rounded-full px-3.5 py-1.5 text-xs font-medium border transition-colors focus-ring',
                    period === p
                      ? 'border-primary bg-primary/20 text-primary-accessible'
                      : 'border-border text-muted-foreground hover:border-primary/40',
                  )}
                >
                  <BilingualText en={PERIOD_LABEL[p].en} el={PERIOD_LABEL[p].el} wrap />
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2.5">
              {/* AppShell's Ask AI carries this page's analytics prompt; this was a
                  promptless duplicate beside it. `h-10` is gone too — it overrode
                  the button ladder with a height that belongs to no step of it. */}
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()} loading={isFetching}>
                <RefreshCw className="icon-sm" /><BilingualText en="Refresh" el="Ανανέωση" compact />
              </Button>
            </div>
          </div>
          {!waiting && !isError && <NetworkVelocity metrics={metrics} />}
        </div>
      ),
    },
    {
      id: 'achievements',
      glyph: 'award',
      labelEn: 'Achievements',
      labelEl: 'Επιτεύγματα',
      content: (
        <div className="space-y-3">
          <AchievementsCard
            achievements={Array.isArray(achievements)
              ? achievements.map((item) => ({
                  id: item.id,
                  title: item.title,
                  description: item.description,
                  icon: item.icon,
                  unlocked: Boolean(item.unlocked),
                }))
              : undefined}
          />
          {(!Array.isArray(achievements) || achievements.length === 0) && <BadgesWidget />}
        </div>
      ),
    },
    {
      id: 'next',
      glyph: 'flag',
      labelEn: 'Where to go next',
      labelEl: 'Πού να πάτε μετά',
      content: (
        <div className="space-y-3">
          {/* Four equal destinations, so none is filled; each hint says what that one is for. */}
          <div className="grid grid-cols-1 min-w-0 gap-2">
            {([
              { href: '/profile', glyph: 'profile' as const, title: 'open_profile', hint: 'build_profile' },
              { href: '/discover', glyph: 'discover' as const, title: 'open_discover', hint: 'grow_network' },
              { href: '/messages', glyph: 'messages' as const, title: 'open_messages', hint: 'reply_faster' },
              { href: '/connections', glyph: 'people' as const, title: 'open_connections', hint: 'follow_up' },
            ] as const).map((step) => (
              <Button key={step.href} asChild variant="outline" className="h-auto min-h-14 justify-start gap-3 whitespace-normal px-3 py-3 text-left">
                <Link href={step.href}>
                  <CfbGlyph name={step.glyph} className="icon-sm shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold leading-snug"><BilingualText en={analyticsEn(step.title)} el={analyticsEl(step.title)} wrap /></span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted-foreground"><BilingualText en={analyticsEn(step.hint)} el={analyticsEl(step.hint)} wrap /></span>
                  </span>
                  <ArrowRight className="icon-sm shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </Button>
            ))}
              <Button asChild variant="outline" className="h-auto min-h-14 justify-start gap-3 whitespace-normal px-3 py-3 text-left">
                <Link href="/calendar">
                  <CfbGlyph name="calendar" className="icon-sm shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold leading-snug"><BilingualText en={analyticsEn('plan_peak_hour')} el={analyticsEl('plan_peak_hour')} wrap /></span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted-foreground"><BilingualText en="Block time around your peak hour." el="Κλείστε χρόνο γύρω από την ώρα αιχμής." wrap /></span>
                  </span>
                  <ArrowRight className="icon-sm shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </Button>
          </div>
        </div>
      ),
    },
  ];
  return (
    <AppShell
      rail={rail}
      showHelp
      askAi={askPrompt}
      contentClassName="overflow-x-clip"
    >
      <div className="min-w-0 space-y-6 overflow-x-clip">

      <Tabs value={activeTab} onValueChange={(v) => { if (isTab(v)) setTab(v); }}>
        {/* Three equal columns capped at `max-w-md` is right on a phone, where
            the strip should span the screen. On desktop that cap is 367px once
            the 82% root is applied, which left ~76px per label and clipped
            "Επισκόπηση" while its two neighbours fit. From `lg` the strip is
            sized by its own labels instead. */}
        <TabsList className="grid h-auto w-full max-w-md grid-cols-3 lg:inline-grid lg:w-auto lg:max-w-none lg:grid-cols-[repeat(3,auto)]">
          <TabsTrigger value="overview" className="min-h-10 gap-1.5 px-2 leading-tight sm:px-3">
            <CfbGlyph name="chart" className="icon-sm shrink-0" />
            <BilingualText en={analyticsEn('tab_overview')} el={analyticsEl('tab_overview')} wrap />
          </TabsTrigger>
          <TabsTrigger value="engagement" className="min-h-10 gap-1.5 px-2 leading-tight sm:px-3">
            <CfbGlyph name="spark" className="icon-sm shrink-0" />
            <BilingualText en={analyticsEn('tab_engagement')} el={analyticsEl('tab_engagement')} wrap />
          </TabsTrigger>
          <TabsTrigger value="growth" className="min-h-10 gap-1.5 px-2 leading-tight sm:px-3">
            <CfbGlyph name="target" className="icon-sm shrink-0" />
            <BilingualText en={analyticsEn('tab_growth')} el={analyticsEl('tab_growth')} wrap />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5 space-y-6">
          {isError ? (
            <ErrorState onRetry={() => void refetch()} />
          ) : waiting ? (
            <AnalyticsSkeleton />
          ) : (
            <>
              {/* The window is chosen in the rail; the column says which one every figure below is for. */}
              <p className="page-stat-label flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-muted-foreground">
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 font-medium text-foreground">
                  <CfbGlyph name="calendar" className="icon-sm shrink-0 text-muted-foreground" aria-hidden="true" />
                  <BilingualText en={PERIOD_LABEL[period].en} el={PERIOD_LABEL[period].el} compact />
                </span>
                <span className="min-w-0"><BilingualText en={isPreviewDemo() ? 'Demo showcase — sample metrics, not account activity.' : 'Recorded account activity. A dash means unavailable, not zero; trends require a comparable previous period.'} el={isPreviewDemo() ? 'Επίδειξη — ενδεικτικές μετρήσεις, όχι δραστηριότητα λογαριασμού.' : 'Καταγεγραμμένη δραστηριότητα λογαριασμού. Η παύλα σημαίνει μη διαθέσιμο, όχι μηδέν· οι τάσεις απαιτούν συγκρίσιμη προηγούμενη περίοδο.'} /></span>
              </p>

              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
                {metrics.map((metric) => {
                  const sparkValues = metric.label === 'Profile Views'
                    ? (profileViews ?? []).map((point) => point.views)
                    : [];
                  return (
                    <MetricCard
                      key={metric.label}
                      metric={metric}
                      sparkValues={sparkValues}
                      onOpenTab={setTab}
                    />
                  );
                })}
              </div>

              {declining.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-status-warning-border/50 bg-status-warning-bg/40 p-4">
                  <div className="min-w-0 space-y-1">
                    <p className="card-title">
                      <BilingualText en={analyticsEn('declining_prefix')} el={analyticsEl('declining_prefix')} wrap />
                    </p>
                    <p className="card-body text-muted-foreground">
                      {declining.map((m, i) => (
                        <span key={m.label}>
                          {i > 0 ? ' · ' : ''}
                          <BilingualText
                            en={`${m.label} ${Math.abs(m.change ?? 0)}%`}
                            el={`${m.labelEl} ${Math.abs(m.change ?? 0)}%`}
                            wrap
                          />
                        </span>
                      ))}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => openRailSection('next')}>
                      <BilingualText en={analyticsEn('open_discover')} el={analyticsEl('open_discover')} compact wrap />
                    </Button>
                  </div>
                </div>
              )}

              {metrics.length > 0 && <ProfileFunnel metrics={metrics} />}

              {weeklySummary && [weeklySummary.mostActiveDay, weeklySummary.peakHour, weeklySummary.avgResponseTime, weeklySummary.totalInteractions].some((value) => value !== null && value !== undefined && value !== '') && (
                <Card className="min-w-0">
                  <CardHeader className="p-3 sm:p-6">
                    <CardTitle className="flex items-center gap-2 font-semibold">
                      <CfbGlyph name="calendar" className="icon-sm shrink-0 text-muted-foreground" />
                      <BilingualText en={analyticsEn('weekly_summary')} el={analyticsEl('weekly_summary')} compact />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 sm:pt-0">
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                      <div className="min-w-0 space-y-1.5">
                        <p className="page-stat-label leading-snug text-muted-foreground"><BilingualText en={analyticsEn('most_active_day')} el={analyticsEl('most_active_day')} compact wrap /></p>
                        <p className="page-stat font-semibold">
                          {weeklySummary.mostActiveDay
                            ? <BilingualText en={weeklySummary.mostActiveDay} el={WEEKDAY_EL[weeklySummary.mostActiveDay] ?? weeklySummary.mostActiveDay} compact />
                            : '—'}
                        </p>
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <p className="page-stat-label leading-snug text-muted-foreground"><BilingualText en={analyticsEn('peak_hour')} el={analyticsEl('peak_hour')} compact wrap /></p>
                        <p className="page-stat font-semibold">{weeklySummary.peakHour || '—'}</p>
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <p className="page-stat-label leading-snug text-muted-foreground"><BilingualText en={analyticsEn('avg_response')} el={analyticsEl('avg_response')} compact wrap /></p>
                        <p className="page-stat font-semibold">
                          {weeklySummary.avgResponseTime
                            ? (durationEl(weeklySummary.avgResponseTime) !== weeklySummary.avgResponseTime
                              ? <BilingualText en={weeklySummary.avgResponseTime} el={durationEl(weeklySummary.avgResponseTime)} compact />
                              : weeklySummary.avgResponseTime)
                            : '—'}
                        </p>
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <p className="page-stat-label leading-snug text-muted-foreground"><BilingualText en={analyticsEn('total_interactions')} el={analyticsEl('total_interactions')} compact wrap /></p>
                        <p className="page-stat font-semibold">{weeklySummary.totalInteractions ?? '—'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="engagement" className="mt-5 space-y-6">
          {isError ? (
            <ErrorState onRetry={() => void refetch()} />
          ) : waiting ? (
            <AnalyticsSkeleton />
          ) : (
            <div className="grid grid-cols-1 min-w-0 gap-5 lg:grid-cols-2">
              <EngagementBreakdown engagement={engagement} />
              {topContent && topContent.length > 0 ? (
                <TopContentList content={topContent} />
              ) : (
                <Card className="min-w-0">
                  <CardContent className="py-12 text-center text-sm text-muted-foreground">
                    <p><BilingualText en={analyticsEn('no_engagement')} el={analyticsEl('no_engagement')} /></p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="growth" className="mt-5 space-y-6">
          {isError ? (
            <ErrorState onRetry={() => void refetch()} />
          ) : waiting ? (
            <AnalyticsSkeleton />
          ) : (
            <>
              {profileViews && profileViews.length > 0 ? (
                <ProfileViewsChart data={profileViews} />
              ) : (
                <Card>
                  <CardContent className="py-16 text-center text-sm text-muted-foreground">
                    <p><BilingualText en={analyticsEn('no_views')} el={analyticsEl('no_views')} /></p>
                  </CardContent>
                </Card>
              )}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
                {metrics.map((metric) => {
                  const sparkValues = metric.label === 'Profile Views'
                    ? (profileViews ?? []).map((point) => point.views)
                    : [];
                  return (
                    <MetricCard
                      key={metric.label}
                      metric={metric}
                      sparkValues={sparkValues}
                      onOpenTab={setTab}
                    />
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
      </div>
    </AppShell>
  );
}
