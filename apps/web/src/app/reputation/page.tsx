'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Shield, TrendingUp, Award, Users, MessageCircle, Target, Zap, Eye,
  Sparkles, Trophy, Flame, Hammer, FlaskConical, Flag, CalendarCheck, Layers,
  RefreshCw,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge as BadgePill } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BilingualText } from '@/components/common/BilingualText';
import { EmptyState } from '@/components/common/EmptyState';
import { SampleDataNotice } from '@/components/common/SampleDataNotice';
import { RelativeTime } from '@/components/common/RelativeTime';
import { LocalTime } from '@/components/common/LocalTime';
import { useMyXP, useMyBadges, useMyStreak, useMarkBadgesSeen, type Badge, type XPEvent } from '@/hooks/useGamification';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';
import { bilingualAria } from '@/lib/i18n/format';
import {
  REPUTATION_STRINGS, reputationEn, reputationEl, LEVEL_LABEL_EL, EVENT_GROUP,
} from '@/lib/i18n/strings-reputation';
import { isPreviewDemo } from '@/lib/preview-demo';
import { cn } from '@/lib/utils';
import { choiceControl, usePageControls, usePageList } from '@/lib/page-controls';

/*
 * Every number on this page comes from `GET /api/gamification/users/me/{xp,
 * badges,streak}` — the same three calls the founder dashboard's XP widget
 * makes, through the same hooks and query keys, so the two surfaces cannot
 * disagree about the same person. In demo mode `apiRequest` answers them from
 * the preview layer, which is why the showcase account reads "Builder · 920 XP"
 * here as it does on the dashboard.
 *
 * What is deliberately not here any more: a "reputation score out of 100" built
 * from categories like "Profile Completeness 85" and "Community Engagement".
 * No service computes those; the page used to hardcode them, identically for
 * every user, under a ring that made them look measured. The one progress the
 * server does report is progress within the current XP level, so that is what
 * the ring shows now, labelled as such.
 */

type Key = keyof typeof REPUTATION_STRINGS;

const GROUP_ICON: Record<string, typeof Hammer> = {
  building: Hammer,
  research: FlaskConical,
  collaboration: Users,
  feedback: MessageCircle,
  milestones: Flag,
  consistency: CalendarCheck,
  other: Layers,
};

const GROUP_ORDER = ['building', 'milestones', 'feedback', 'collaboration', 'research', 'consistency', 'other'];

const RARITY_TONE: Record<string, string> = {
  common: 'text-muted-foreground bg-muted',
  uncommon: 'text-status-success bg-status-success-bg',
  rare: 'text-status-info bg-status-info-bg',
  epic: 'text-status-accent bg-status-accent-bg',
  legendary: 'text-status-warning bg-status-warning-bg',
};

function eventLabel(type: string) {
  const key = `ev_${type}` as Key;
  return REPUTATION_STRINGS[key] ?? { en: type.replace(/_/g, ' ').toLowerCase(), el: type.replace(/_/g, ' ').toLowerCase() };
}

function LevelRing({ progress, level, size = 140 }: { progress: number; level: number; size?: number }) {
  const r = size / 2 - 12;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, progress));
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={bilingualAria(`Level ${level} of 10, ${pct}% of the way to the next level`, `Επίπεδο ${level} από 10, ${pct}% της διαδρομής προς το επόμενο`)}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--ring-gold-track))" strokeWidth={8} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="hsl(var(--ring-gold))" strokeWidth={8} strokeLinecap="round"
          className="transition-[stroke-dasharray] duration-700"
          strokeDasharray={`${(pct / 100) * circ} ${circ}`}
        />
      </svg>
      {/* Same rule as the readiness ring: a gap on the column, not a margin
          the first line's leading swallows. */}
      {/* Figures only inside the ring — the words are in the aria-label and in
          the copy beside it. A bilingual "84% of level · 84% του επιπέδου" was
          wider than the ring's 112px interior. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5" aria-hidden>
        <span className="text-3xl font-semibold leading-none tabular-nums">
          {level}
          <span className="text-sm font-medium text-muted-foreground"> / 10</span>
        </span>
        <span className="text-xs font-semibold leading-none tabular-nums text-primary-accessible">{pct}%</span>
      </div>
    </div>
  );
}

function GroupRow({ group, xp, total, count }: { group: string; xp: number; total: number; count: number }) {
  const Icon = GROUP_ICON[group] ?? Layers;
  const label = REPUTATION_STRINGS[`grp_${group}` as Key] ?? REPUTATION_STRINGS.grp_other;
  const share = total > 0 ? Math.round((xp / total) * 100) : 0;
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="icon-sm" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-medium"><BilingualText en={label.en} el={label.el} compact /></span>
          <span className="shrink-0 text-sm font-semibold tabular-nums">+{xp} <span className="text-xs font-normal text-muted-foreground">XP · {count}×</span></span>
        </div>
        <Progress value={share} className="mt-1.5 h-1.5" aria-label={bilingualAria(`${label.en}: ${share}% of recent XP`, `${label.el}: ${share}% των πρόσφατων πόντων`)} />
      </div>
    </li>
  );
}

function BadgeCard({ badge, primary }: { badge: Badge; primary: 'en' | 'el' }) {
  const rarity = (badge.rarity || 'common').toLowerCase();
  const rarityLabel = REPUTATION_STRINGS[`rarity_${rarity}` as Key] ?? { en: badge.rarity, el: badge.rarity };
  const isNew = !badge.seenAt;
  return (
    <Card className={cn('relative overflow-hidden transition-colors hover:border-primary/30', isNew && 'ring-1 ring-primary/40')}>
      <CardContent className="flex gap-3">
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', RARITY_TONE[rarity] ?? RARITY_TONE.common)}>
          <Trophy className="icon-md" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold">{badge.name}</p>
            {isNew && (
              <BadgePill variant="default" className="shrink-0 text-2xs">
                <BilingualText en={reputationEn('new_badge')} el={reputationEl('new_badge')} compact />
              </BadgePill>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{badge.description}</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 text-2xs text-muted-foreground">
            <span className={cn('rounded-full px-1.5 py-0.5 font-medium', RARITY_TONE[rarity] ?? RARITY_TONE.common)}>
              {primary === 'el' ? rarityLabel.el : rarityLabel.en}
            </span>
            <span>{primary === 'el' ? reputationEl('earned_on') : reputationEn('earned_on')} <LocalTime value={badge.awardedAt} /></span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function HistoryItem({ event }: { event: XPEvent }) {
  const label = eventLabel(event.eventType);
  const group = EVENT_GROUP[event.eventType] ?? 'other';
  const Icon = GROUP_ICON[group] ?? Layers;
  return (
    <li className="flex items-center gap-3 border-b border-border py-3 last:border-0">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-status-success-bg text-status-success">
        <Icon className="icon-sm" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium"><BilingualText en={label.en} el={label.el} compact /></p>
        <p className="text-xs text-muted-foreground"><RelativeTime date={event.createdAt} /></p>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-status-success">+{event.xpAmount}</span>
    </li>
  );
}

export default function ReputationPage() {
  const { primary } = useLanguagePreference();
  const t = (key: Key) => (primary === 'el' ? reputationEl(key) : reputationEn(key));
  const [activeTab, setActiveTab] = useState<'overview' | 'badges' | 'history'>('overview');
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDemo = mounted && isPreviewDemo();

  const xp = useMyXP();
  const badges = useMyBadges();
  const streak = useMyStreak();
  const markSeen = useMarkBadgesSeen();

  const events = xp.data?.recentEvents ?? [];
  const groups = useMemo(() => {
    const acc = new Map<string, { xp: number; count: number }>();
    for (const e of events) {
      const g = EVENT_GROUP[e.eventType] ?? 'other';
      const cur = acc.get(g) ?? { xp: 0, count: 0 };
      acc.set(g, { xp: cur.xp + (e.xpAmount || 0), count: cur.count + 1 });
    }
    return GROUP_ORDER.filter((g) => acc.has(g)).map((g) => ({ group: g, ...acc.get(g)! }));
  }, [events]);
  const recentTotal = groups.reduce((s, g) => s + g.xp, 0);

  const badgeList = badges.data ?? [];
  const unseen = badgeList.filter((b) => !b.seenAt).length;
  const streakData = streak.data ?? xp.data?.streak;
  const loading = xp.isLoading || badges.isLoading || streak.isLoading;
  const failed = xp.isError;

  const levelEl = xp.data ? LEVEL_LABEL_EL[xp.data.level] ?? xp.data.levelLabel : '';

  // The tab, marking badges seen, and what the page lists, for the assistant.
  // Marking seen stamps `seenAt` and has no way back, so it has no undo.
  usePageControls([
    choiceControl('reputation_tab', 'Reputation tab', 'Καρτέλα φήμης', [
      { value: 'overview', en: 'Overview', el: 'Επισκόπηση' },
      { value: 'badges', en: 'Badges', el: 'Διακρίσεις' },
      { value: 'history', en: 'History', el: 'Ιστορικό' },
    ], activeTab, (v) => setActiveTab(v as typeof activeTab)),
    {
      id: 'mark_badges_seen',
      labelEn: 'Mark new badges as seen',
      labelEl: 'Σήμανση νέων εμβλημάτων ως αναγνωσμένων',
      writes: true,
      unavailableEn: unseen === 0 ? 'No badge is new.' : undefined,
      unavailableEl: unseen === 0 ? 'Καμία διάκριση δεν είναι νέα.' : undefined,
      run: async () => { await markSeen.mutateAsync(); },
    },
  ]);
  usePageList([
    {
      id: 'badges',
      labelEn: 'Badges',
      labelEl: 'Διακρίσεις',
      rows: badges.isLoading ? undefined : badgeList.map((b) => `${b.name}${b.seenAt ? '' : ' · new'}`),
      total: badgeList.length,
    },
    {
      id: 'xp_history',
      labelEn: 'Recent XP',
      labelEl: 'Πρόσφατοι πόντοι εμπειρίας',
      rows: xp.isLoading ? undefined : events.map((ev) => `${ev.eventType.toLowerCase().replace(/_/g, ' ')} · +${ev.xpAmount} XP`),
      total: events.length,
    },
  ]);

  return (
    <AppShell
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" className="sm:hidden" aria-label={bilingualAria(reputationEn('my_profile'), reputationEl('my_profile'))} asChild>
            <Link href="/profile"><Shield className="icon-sm" aria-hidden /></Link>
          </Button>
          <Button variant="outline" size="sm" className="hidden gap-2 sm:flex" asChild>
            <Link href="/profile">
              <Shield className="icon-sm" aria-hidden />
              <BilingualText en={reputationEn('my_profile')} el={reputationEl('my_profile')} compact />
            </Link>
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                {/* Used to be a button with no handler. The public profile is
                    a real route; this takes the reader there. */}
                <Button variant="outline" size="sm" className="gap-2" asChild>
                  <Link href="/profile?view=public">
                    <Eye className="icon-sm" aria-hidden />
                    <BilingualText en={reputationEn('public_view')} el={reputationEl('public_view')} compact />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>{t('public_view_hint')}</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      }
    >
      <div className="space-y-6 pb-10">
        {isDemo && (
          <SampleDataNotice
            surface={t('sample_surface')}
            detail={t('sample_detail')}
            askAiPrompt={t('sample_ask')}
          />
        )}

        {failed ? (
          <Card>
            <CardContent>
              <EmptyState
                title={<BilingualText en={reputationEn('error_title')} el={reputationEl('error_title')} />}
                description={<BilingualText en={reputationEn('error_desc')} el={reputationEl('error_desc')} />}
                action={
                  <Button variant="outline" size="sm" onClick={() => { void xp.refetch(); void badges.refetch(); void streak.refetch(); }}>
                    <RefreshCw className="icon-sm" aria-hidden />
                    <BilingualText en={reputationEn('retry')} el={reputationEl('retry')} compact />
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Level card */}
            <Card className="border-border bg-primary/[0.03]">
              <CardContent>
                {loading || !xp.data ? (
                  <div className="flex flex-col items-center gap-6 md:flex-row" aria-busy="true">
                    <div className="h-[140px] w-[140px] shrink-0 animate-pulse rounded-full bg-muted/40" />
                    <div className="w-full min-w-0 flex-1 space-y-3">
                      <div className="h-6 w-48 max-w-full animate-pulse rounded bg-muted/40" />
                      <div className="h-4 w-72 max-w-full animate-pulse rounded bg-muted/40" />
                      <div className="h-8 w-56 max-w-full animate-pulse rounded bg-muted/40" />
                    </div>
                    <span className="sr-only">{t('loading')}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-6 md:flex-row md:gap-8">
                    <LevelRing progress={Math.round(xp.data.levelProgress)} level={xp.data.level} />
                    <div className="flex-1 text-center md:text-left">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <BilingualText en={`${reputationEn('level')} ${xp.data.level}`} el={`${reputationEl('level')} ${xp.data.level}`} compact />
                      </p>
                      <h2 className="mt-0.5 text-xl font-semibold tracking-tight md:text-2xl">
                        <BilingualText en={xp.data.levelLabel} el={levelEl} />
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                        <span className="font-semibold text-foreground">{xp.data.totalXp.toLocaleString()}</span> {t('xp_long')}
                        {xp.data.xpToNextLevel > 0 ? (
                          <> · <span className="font-semibold text-foreground">{xp.data.xpToNextLevel.toLocaleString()}</span> {t('to_next_level')}</>
                        ) : (
                          <> · {t('top_level')}</>
                        )}
                      </p>
                      <div className="mt-4 flex flex-wrap justify-center gap-3 md:justify-start">
                        <div className="flex items-center gap-2">
                          <Trophy className="icon-sm text-status-warning" aria-hidden />
                          <span className="text-sm font-medium tabular-nums">
                            {badgeList.length} {t(badgeList.length === 1 ? 'badge_earned_one' : 'badges_earned')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Flame className={cn('icon-sm', (streakData?.currentStreak ?? 0) > 0 ? 'text-status-warning' : 'text-muted-foreground')} aria-hidden />
                          <span className="text-sm font-medium tabular-nums">
                            {streakData?.currentStreak ?? 0} {t((streakData?.currentStreak ?? 0) === 1 ? 'streak_day_one' : 'streak_days')}
                          </span>
                        </div>
                        {recentTotal > 0 && (
                          <div className="flex items-center gap-2">
                            <TrendingUp className="icon-sm text-status-success" aria-hidden />
                            <span className="text-sm font-medium tabular-nums">+{recentTotal} XP</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
              <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-none border-b bg-transparent p-0">
                {(
                  [
                    ['overview', Shield, t('tab_overview')],
                    ['badges', Award, `${t('tab_badges')}${badgeList.length ? ` (${badgeList.length})` : ''}`],
                    ['history', TrendingUp, t('tab_history')],
                  ] as const
                ).map(([value, Icon, label]) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="gap-2 rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent"
                  >
                    <Icon className="icon-sm" aria-hidden />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overview" className="mt-6">
                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
                  <Card className="lg:col-span-3">
                    <CardHeader>
                      <CardTitle className="text-base"><BilingualText en={reputationEn('how_xp_title')} el={reputationEl('how_xp_title')} /></CardTitle>
                      <CardDescription><BilingualText en={reputationEn('how_xp_desc')} el={reputationEl('how_xp_desc')} compact wrap /></CardDescription>
                    </CardHeader>
                    <CardContent>
                      {groups.length === 0 ? (
                        <EmptyState
                          size="sm"
                          illustration="rocket"
                          title={<BilingualText en={reputationEn('no_xp_yet_title')} el={reputationEl('no_xp_yet_title')} />}
                          description={<BilingualText en={reputationEn('no_xp_yet_desc')} el={reputationEl('no_xp_yet_desc')} compact wrap />}
                          action={<Button size="sm" asChild><Link href="/builder"><Hammer className="icon-sm" aria-hidden /><BilingualText en="Open Builder" el="Άνοιγμα Builder" compact /></Link></Button>}
                        />
                      ) : (
                        <ul className="divide-y divide-border/40">
                          {groups.map((g) => <GroupRow key={g.group} {...g} total={recentTotal} />)}
                        </ul>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Flame className="icon-sm text-status-warning" aria-hidden />
                        <BilingualText en={reputationEn('streak_title')} el={reputationEl('streak_title')} />
                      </CardTitle>
                      <CardDescription><BilingualText en={reputationEn('streak_desc')} el={reputationEl('streak_desc')} compact wrap /></CardDescription>
                    </CardHeader>
                    <CardContent>
                      {!streakData || (streakData.currentStreak === 0 && streakData.longestStreak === 0) ? (
                        <p className="text-sm text-muted-foreground"><BilingualText en={reputationEn('streak_none')} el={reputationEl('streak_none')} compact /></p>
                      ) : (
                        <dl className="grid grid-cols-2 gap-4">
                          <div className="min-w-0">
                            <dt className="text-xs text-muted-foreground">{t('current')}</dt>
                            <dd className="page-stat mt-1 text-2xl font-semibold tabular-nums">
                              {streakData.currentStreak} <span className="text-sm font-normal text-muted-foreground">{t(streakData.currentStreak === 1 ? 'day_one' : 'days')}</span>
                            </dd>
                          </div>
                          <div className="min-w-0">
                            <dt className="text-xs text-muted-foreground">{t('longest')}</dt>
                            <dd className="page-stat mt-1 text-2xl font-semibold tabular-nums">
                              {streakData.longestStreak} <span className="text-sm font-normal text-muted-foreground">{t(streakData.longestStreak === 1 ? 'day_one' : 'days')}</span>
                            </dd>
                          </div>
                          {streakData.lastActiveDate && (
                            <div className="col-span-2 text-xs text-muted-foreground">
                              <dt className="inline">{t('last_active')}: </dt>
                              <dd className="inline"><RelativeTime date={streakData.lastActiveDate} /></dd>
                            </div>
                          )}
                        </dl>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="badges" className="mt-6">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold"><BilingualText en={reputationEn('badges_title')} el={reputationEl('badges_title')} /></h3>
                    <p className="mt-0.5 text-sm text-muted-foreground"><BilingualText en={reputationEn('badges_desc')} el={reputationEl('badges_desc')} compact /></p>
                  </div>
                  {unseen > 0 && (
                    <Button variant="outline" size="sm" onClick={() => markSeen.mutate()} disabled={markSeen.isPending}>
                      <BilingualText en={reputationEn('mark_seen')} el={reputationEl('mark_seen')} compact />
                    </Button>
                  )}
                </div>
                {badgeList.length === 0 ? (
                  <Card><CardContent>
                    <EmptyState
                      size="sm"
                      title={<BilingualText en={reputationEn('no_badges_title')} el={reputationEl('no_badges_title')} />}
                      description={<BilingualText en={reputationEn('no_badges_desc')} el={reputationEl('no_badges_desc')} compact wrap />}
                    />
                  </CardContent></Card>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {badgeList.map((b) => <BadgeCard key={b.id} badge={b} primary={primary === 'el' ? 'el' : 'en'} />)}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base"><BilingualText en={reputationEn('history_title')} el={reputationEl('history_title')} /></CardTitle>
                    <CardDescription><BilingualText en={reputationEn('history_desc')} el={reputationEl('history_desc')} compact wrap /></CardDescription>
                  </CardHeader>
                  <CardContent>
                    {events.length === 0 ? (
                      <p className="text-sm text-muted-foreground"><BilingualText en={reputationEn('no_history')} el={reputationEl('no_history')} compact /></p>
                    ) : (
                      <ul>{events.map((e) => <HistoryItem key={e.id} event={e} />)}</ul>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* Tips — kept, and now they describe the real ladder rather than "get likes". */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="icon-sm text-muted-foreground" aria-hidden />
              <BilingualText en={reputationEn('tips_title')} el={reputationEl('tips_title')} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Columns 24px apart: each tip's hover surface reaches 12px past its text. */}
            <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  { icon: Hammer, tone: 'text-status-info bg-status-info-bg', title: 'tip_build_title', desc: 'tip_build_desc', href: '/builder' },
                  { icon: Target, tone: 'text-status-success bg-status-success-bg', title: 'tip_milestone_title', desc: 'tip_milestone_desc', href: '/milestones' },
                  { icon: Zap, tone: 'text-status-accent bg-status-accent-bg', title: 'tip_feedback_title', desc: 'tip_feedback_desc', href: '/expert-reviews' },
                ] as const
              ).map((tip) => {
                const TipIcon = tip.icon;
                return (
                  <Link key={tip.title} href={tip.href} className="axis-row flex gap-3 rounded-md py-2.5 transition-colors hover:bg-accent">
                    <span className={cn('h-fit rounded-lg p-2', tip.tone)}><TipIcon className="icon-sm" aria-hidden /></span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium"><BilingualText en={reputationEn(tip.title)} el={reputationEl(tip.title)} /></span>
                      <span className="mt-0.5 block text-xs text-muted-foreground"><BilingualText en={reputationEn(tip.desc)} el={reputationEl(tip.desc)} /></span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
