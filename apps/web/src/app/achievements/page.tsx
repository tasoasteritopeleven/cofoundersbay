'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAnalyticsAchievements, getLeaderboard, getMyXP, getMyBadges, type AnalyticsAchievement, type GamificationXPSummary, type GamificationBadge } from '@/lib/api';
import { ReputationSystem } from '@/components/gamification/ReputationSystem';
import { UserBadges } from '@/components/gamification/UserBadges';
import {
  Award,
  Trophy,
  Star,
  Zap,
  Target,
  TrendingUp,
  Users,
  MessageCircle,
  Eye,
  Heart,
  Calendar,
  Flame,
  Crown,
  Medal,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { RailOptions } from '@/components/layout/RailParts';
import { BilingualText } from '@/components/common/BilingualText';
import { FactLine } from '@/components/common/FactLine';
import { CardHead } from '@/components/common/CardAnatomy';
import { RowHead } from '@/components/dashboard/SectionCard';
import { achievementsEn, achievementsEl } from '@/lib/i18n/strings-achievements';
import { choiceControl, usePageControls, usePageList } from '@/lib/page-controls';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { orderAchievements } from '@/lib/achievement-order';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { bilingualAria } from '@/lib/i18n/format';
import { cn, initialsOf } from '@/lib/utils';
import { qk } from '@/lib/query-keys';
import { FirstRunTour, type TourStep } from '@/components/common/FirstRunTour';
import { useDateFormat } from '@/lib/i18n/useDateFormat';
import { useDemoData } from '@/contexts/DemoDataContext';
import { LEVEL_LABEL_EL } from '@/lib/i18n/strings-reputation';
import { ASK } from '@/lib/page-questions';
import { elWord } from '@/lib/rows-el';

const ACHIEVEMENTS_TOUR: TourStep[] = [
  {
    target: 'achievements-stats',
    titleEn: 'Level and XP from one source',
    titleEl: 'Επίπεδο και XP από μία πηγή',
    bodyEn: 'When the gamification API is up, XP and level come from there. If it is not, this card sums points on unlocked badges so you never see two different scores.',
    bodyEl: 'Όταν το API gamification είναι διαθέσιμο, XP και επίπεδο έρχονται από εκεί. Αν όχι, αυτή η κάρτα αθροίζει πόντους ξεκλειδωμένων σημάτων ώστε να μην βλέπετε δύο βαθμολογίες.',
  },
  {
    target: 'achievements-list',
    titleEn: 'Badges are the same list, sliced',
    titleEl: 'Τα εμβλήματα είναι η ίδια λίστα, φιλτραρισμένη',
    bodyEn: 'All / Unlocked / Locked are filters of this list. The rail filters by category. Locked cards show progress toward that badge only.',
    bodyEl: 'Όλα / Ξεκλειδωμένα / Κλειδωμένα είναι φίλτρα αυτής της λίστας. Η ράγα φιλτράρει ανά κατηγορία. Οι κλειδωμένες κάρτες δείχνουν πρόοδο μόνο προς εκείνο το σήμα.',
  },
];

interface Achievement {
  id: string;
  title: string;
  description: string;
  category: 'networking' | 'engagement' | 'profile' | 'activity' | 'special';
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  icon: typeof Award;
  points: number;
  progress: number;
  total: number;
  unlocked: boolean | null;
  unlockedAt?: Date;
  rarity: number;
}

interface UserStats {
  totalPoints: number;
  level: number;
  nextLevelPoints: number;
  currentLevelPoints: number;
  achievementsUnlocked: number;
  totalAchievements: number;
  rank: string;
  percentile: number;
}

const TIER_COLORS = {
  bronze: 'text-status-warning',
  silver: 'text-muted-foreground',
  gold: 'text-status-warning',
  platinum: 'text-primary-accessible',
};

const TIER_BG = {
  bronze: 'bg-status-warning-bg',
  silver: 'bg-muted',
  gold: 'bg-status-warning-bg',
  platinum: 'bg-status-info-bg',
};

const ICON_MAP: Record<string, typeof Award> = {
  trophy: Trophy, star: Star, zap: Zap, users: Users, eye: Eye,
  heart: Heart, calendar: Calendar, flame: Flame, crown: Crown,
  target: Target, medal: Medal, award: Award,
};

function apiToAchievement(a: AnalyticsAchievement, index: number): Achievement {
  const tiers: Achievement['tier'][] = ['bronze', 'silver', 'gold', 'platinum'];
  const categories: Achievement['category'][] = ['networking', 'engagement', 'profile', 'activity', 'special'];
  const current = a.progress?.current;
  const target = a.progress?.target;
  const measured = typeof current === 'number' && Number.isFinite(current) && current >= 0 &&
    typeof target === 'number' && Number.isFinite(target) && target > 0;
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    category: categories[index % categories.length],
    tier: tiers[index % tiers.length],
    icon: ICON_MAP[a.icon.toLowerCase()] ?? Award,
    points: (index + 1) * 100,
    progress: measured ? Math.min(current, target) : a.unlocked ? 1 : 0,
    total: measured ? target : 1,
    unlocked: a.unlocked,
    unlockedAt: a.unlockedAt ? new Date(a.unlockedAt) : undefined,
    rarity: Math.max(2, 50 - index * 4),
  };
}

const DEMO_ACHIEVEMENTS: Achievement[] = [
  {
    id: '1',
    title: 'Early Adopter',
    description: 'Joined CoFounderBay in the first month',
    category: 'special',
    tier: 'gold',
    icon: Trophy,
    points: 500,
    progress: 1,
    total: 1,
    unlocked: true,
    unlockedAt: new Date('2024-01-15'),
    rarity: 5,
  },
  {
    id: '2',
    title: 'Networker',
    description: 'Connect with 50 members',
    category: 'networking',
    tier: 'silver',
    icon: Users,
    points: 200,
    progress: 34,
    total: 50,
    unlocked: false,
    rarity: 25,
  },
  {
    id: '3',
    title: 'Super Networker',
    description: 'Connect with 100 members',
    category: 'networking',
    tier: 'gold',
    icon: Users,
    points: 500,
    progress: 34,
    total: 100,
    unlocked: false,
    rarity: 10,
  },
  {
    id: '4',
    title: 'Influencer',
    description: 'Reach 1,000 profile views',
    category: 'profile',
    tier: 'gold',
    icon: Eye,
    points: 400,
    progress: 1247,
    total: 1000,
    unlocked: true,
    unlockedAt: new Date('2024-02-20'),
    rarity: 15,
  },
  {
    id: '5',
    title: 'Conversation Starter',
    description: 'Send 100 messages',
    category: 'engagement',
    tier: 'bronze',
    icon: MessageCircle,
    points: 100,
    progress: 156,
    total: 100,
    unlocked: true,
    unlockedAt: new Date('2024-02-10'),
    rarity: 40,
  },
  {
    id: '6',
    title: 'Active Contributor',
    description: 'Post 50 updates',
    category: 'activity',
    tier: 'silver',
    icon: Zap,
    points: 250,
    progress: 23,
    total: 50,
    unlocked: false,
    rarity: 30,
  },
  {
    id: '7',
    title: 'Engagement Master',
    description: 'Receive 500 reactions on your posts',
    category: 'engagement',
    tier: 'platinum',
    icon: Heart,
    points: 1000,
    progress: 289,
    total: 500,
    unlocked: false,
    rarity: 5,
  },
  {
    id: '8',
    title: 'Consistent',
    description: 'Log in for 30 consecutive days',
    category: 'activity',
    tier: 'silver',
    icon: Calendar,
    points: 300,
    progress: 12,
    total: 30,
    unlocked: false,
    rarity: 20,
  },
  {
    id: '9',
    title: 'On Fire',
    description: 'Log in for 100 consecutive days',
    category: 'activity',
    tier: 'platinum',
    icon: Flame,
    points: 1500,
    progress: 12,
    total: 100,
    unlocked: false,
    rarity: 2,
  },
  {
    id: '10',
    title: 'Profile Perfectionist',
    description: 'Complete your profile 100%',
    category: 'profile',
    tier: 'bronze',
    icon: Star,
    points: 150,
    progress: 85,
    total: 100,
    unlocked: false,
    rarity: 35,
  },
];


/** "gold" → "Gold": the tier and category keys are lower-case words. */
const cap = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

function AchievementCard({ achievement, meterSlot = 0 }: { achievement: Achievement; meterSlot?: number }) {
  const Icon = achievement.icon;
  const progressPercentage = (achievement.progress / achievement.total) * 100;

  // The card every other card is: the badge as the mark, the title and the
  // line under it (category · tier), the points at the head's right, then the
  // sentence, the progress and the facts on the badge's left edge. The badge
  // used to stand in a column of its own, so every line below the title
  // started 72px in from the card's axis.
  return (
    <Card
      className={cn(
        'transition-all hover:border-primary/20',
        achievement.unlocked && 'hover:border-primary/30'
      )}
    >
      <CardContent className="space-y-3">
        <CardHead
          mark={(
            /* The badge is the achievement, not decoration beside it. */
            <div
              data-keep-icon
              data-card-mark=""
              className={cn(
                'relative flex h-10 w-10 items-center justify-center rounded-xl',
                TIER_BG[achievement.tier],
                achievement.unlocked ? 'ring-2 ring-primary/20' : ''
              )}
            >
              <Icon className={cn('icon-md', TIER_COLORS[achievement.tier])} aria-hidden="true" />
              {achievement.unlocked && (
                <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-status-success-mark flex items-center justify-center">
                  <CheckCircle2 className="icon-sm text-white" aria-hidden="true" />
                </div>
              )}
              {achievement.unlocked === false && achievement.progress === 0 && (
                <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-secondary flex items-center justify-center">
                  <Lock className="icon-sm text-muted-foreground" aria-hidden="true" />
                </div>
              )}
            </div>
          )}
          title={achievement.title}
          subtitle={(
            <FactLine
              className="text-sm"
              items={[
                <BilingualText key="cat" en={cap(achievementsEn(`cat_${achievement.category}`))} el={cap(achievementsEl(`cat_${achievement.category}`))} compact />,
                <span key="tier" className={TIER_COLORS[achievement.tier]}>
                  <BilingualText en={cap(achievementsEn(`tier_${achievement.tier}`))} el={cap(achievementsEl(`tier_${achievement.tier}`))} compact />
                </span>,
              ]}
            />
          )}
          aside={(
            <Badge variant="secondary" className="shrink-0">
              <BilingualText en={`${achievement.points} pts`} el={`${achievement.points} πόντοι`} compact />
            </Badge>
          )}
        />

        {achievement.description ? (
          <p className="card-body text-muted-foreground first-letter:uppercase">{achievement.description}</p>
        ) : null}

        {achievement.unlocked === null && <p className="text-xs text-muted-foreground"><BilingualText en="Eligibility not yet verified" el="Η επιλεξιμότητα δεν έχει ακόμη επαληθευτεί" compact /></p>}
        {achievement.unlocked === false && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span><BilingualText en={achievementsEn('progress')} el={achievementsEl('progress')} compact /></span>
              <span className="tabular-nums">
                {achievement.progress} / {achievement.total}
              </span>
            </div>
            <Progress value={progressPercentage} data-meter-slot={meterSlot % 3} className="h-2" />
          </div>
        )}

        {/* Rarity and the unlock date: facts, one wrapping line (a row of
            four items once made /achievements scroll sideways on a phone). */}
        <FactLine
          items={[
            <span key="rarity">{achievement.rarity}% <BilingualText en={achievementsEn('have_this')} el={achievementsEl('have_this')} compact /></span>,
            achievement.unlocked && achievement.unlockedAt
              ? <BilingualText key="unlocked" en={`Unlocked ${new Date(achievement.unlockedAt).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })}`} el={`Ξεκλειδώθηκε ${new Date(achievement.unlockedAt).toLocaleDateString('el-GR', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })}`} compact />
              : null,
          ]}
        />
      </CardContent>
    </Card>
  );
}

function UserStatsCard({ stats, rank }: { stats: UserStats; rank: number | null }) {
  const levelProgress =
    ((stats.totalPoints - stats.currentLevelPoints) /
      (stats.nextLevelPoints - stats.currentLevelPoints)) *
    100;

  return (
    <Card className="bg-primary/[0.03] shadow-sm border-border animate-fade-in">
      <CardContent>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground"><BilingualText en={achievementsEn('current_level')} el={achievementsEl('current_level')} compact /></p>
              <h2 className="text-xl font-semibold"><BilingualText en={`Level ${stats.level}`} el={`Επίπεδο ${stats.level}`} compact /></h2>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  <BilingualText
                    en={`${achievementsEn('progress_to_level')} ${stats.level + 1}`}
                    el={`${achievementsEl('progress_to_level')} ${stats.level + 1}`}
                    compact
                  />
                </span>
                <span className="font-medium tabular-nums">
                  <BilingualText
                    en={`${stats.totalPoints} / ${stats.nextLevelPoints} pts`}
                    el={`${stats.totalPoints} / ${stats.nextLevelPoints} πόντοι`}
                    compact
                  />
                </span>
              </div>
              <Progress value={levelProgress} data-meter-slot={0} className="h-2" />
            </div>

            {/* The level's name, in both languages. "Top 70%" beside it was
                100 minus the share of badges unlocked, not a place among
                members, so it went (docs §90). */}
            <div className="flex items-center gap-2">
              <Badge variant="default" className="gap-1">
                <Crown className="icon-sm" aria-hidden="true" />
                <BilingualText en={stats.rank} el={LEVEL_LABEL_EL[stats.level] ?? stats.rank} compact />
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground"><BilingualText en={achievementsEn('total_points')} el={achievementsEl('total_points')} compact /></p>
              <p className="page-stat text-xl font-bold">{stats.totalPoints.toLocaleString('en-GB')}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground"><BilingualText en={achievementsEn('achievements')} el={achievementsEl('achievements')} compact /></p>
              <p className="page-stat text-xl font-bold">
                {stats.achievementsUnlocked}/{stats.totalAchievements}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground"><BilingualText en={achievementsEn('completion')} el={achievementsEl('completion')} compact /></p>
              <p className="page-stat text-xl font-bold">
                {Math.round((stats.achievementsUnlocked / stats.totalAchievements) * 100)}%
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground"><BilingualText en={achievementsEn('rank')} el={achievementsEl('rank')} compact /></p>
              {/* The reader's place on the XP leaderboard. It printed the share
                  of badges unlocked with a "#" ("#30" beside "30%"). */}
              <p className="page-stat text-xl font-bold">{rank != null ? `#${rank}` : '—'}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AchievementsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-40 w-full" />
      <div className="grid grid-cols-1 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent>
              <div className="flex items-start gap-4">
                <Skeleton className="h-14 w-14 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-2 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function computePointsFromSignals(signals?: { connectionCount: number; boardCount: number; docCount: number; totalNodes: number }) {
  if (!signals) return 0;
  return Math.min(4999,
    signals.connectionCount * 10 +
    signals.boardCount * 25 +
    signals.docCount * 30 +
    signals.totalNodes * 2,
  );
}

function computeEarnedBadgeIds(signals?: { connectionCount: number; boardCount: number; docCount: number; totalNodes: number }): string[] {
  if (!signals) return [];
  const earned: string[] = [];
  if (signals.connectionCount >= 1) earned.push('2');   // Conversation Starter (proxy)
  if (signals.connectionCount >= 10) earned.push('3');  // Networker
  if (signals.boardCount >= 1) earned.push('1');        // Early Adopter (profile started)
  if (signals.docCount >= 1) earned.push('8');          // Mentor (proxy — has built artifacts)
  return earned;
}

export default function AchievementsPage() {
  const fmtDate = useDateFormat();
  const [activeTab, setActiveTab] = useState<'all' | 'unlocked' | 'locked' | 'leaderboard' | 'reputation' | 'badges'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const { data: rawAchievements, isLoading, isError, refetch } = useQuery({
    queryKey: qk('achievements'),
    queryFn: () => getAnalyticsAchievements(),
    staleTime: 120_000,
    retry: 1,
  });

  const { showDemoData } = useDemoData();
  const { data: board, isLoading: boardLoading, isError: boardError, isFetching: boardFetching, refetch: refetchBoard } = useQuery({
    queryKey: qk('gamification', 'leaderboard'),
    queryFn: () => getLeaderboard(10),
    staleTime: 60_000,
    // Read for the summary's rank too, not only for the Leaderboard view.
  });

  const { data: xpData } = useQuery<GamificationXPSummary>({
    queryKey: qk('gamification', 'xp-me'),
    queryFn: getMyXP,
    staleTime: 60_000,
  });

  const { data: badgesData } = useQuery<GamificationBadge[]>({
    queryKey: qk('gamification', 'badges-me'),
    queryFn: getMyBadges,
    staleTime: 60_000,
  });

  const reputationPoints = xpData?.totalXp ?? 0;
  const earnedBadgeIds = badgesData?.map((b) => b.id) ?? [];
  const badgeProgressMap: Record<string, number> = {};

  const achievements = useMemo(() => {
    // The sample list is the demo's; a member whose list failed to load sees
    // an empty list and the error, not someone else's unlocked achievements.
    const list = rawAchievements ?? (showDemoData ? DEMO_ACHIEVEMENTS : []);
    return (list ?? []).map((a, i) =>
      'tier' in a && 'points' in a && 'rarity' in a
        ? (a as unknown as Achievement)
        : apiToAchievement(a as AnalyticsAchievement, i),
    );
  }, [rawAchievements, showDemoData]);

  const stats: UserStats = useMemo(() => {
    const unlocked = achievements.filter((a) => a.unlocked).length;
    const total = achievements.length || 1;
    // Prefer real XP data from gamification API; fall back to local achievement point sum
    const totalPoints = xpData?.totalXp
      ?? achievements.filter((a) => a.unlocked).reduce((s, a) => s + a.points, 0);
    const level = xpData?.level ?? Math.max(1, Math.floor(totalPoints / 200));
    const levelLabel = xpData?.levelLabel ?? (level >= 10 ? 'Legend' : level >= 7 ? 'Expert' : level >= 4 ? 'Rising Star' : 'Newcomer');
    return {
      totalPoints,
      level,
      nextLevelPoints: xpData ? totalPoints + xpData.xpToNextLevel : (level + 1) * 200,
      currentLevelPoints: xpData ? totalPoints - (xpData.levelProgress / 100) * xpData.xpToNextLevel : level * 200,
      achievementsUnlocked: unlocked,
      totalAchievements: total,
      rank: levelLabel,
      percentile: Math.min(99, Math.round((unlocked / total) * 100)),
    };
  }, [achievements, xpData]);

  // Earned first, then the closest to done (docs §90.5, §111).
  const filteredAchievements = orderAchievements(achievements.filter((achievement) => {
    if (activeTab === 'unlocked' && !achievement.unlocked) return false;
    if (activeTab === 'locked' && achievement.unlocked) return false;
    if (categoryFilter !== 'all' && achievement.category !== categoryFilter) return false;
    return true;
  }));
  // The badge nearest to unlocking, first (docs §115): what the reader is
  // about to earn and what is missing. It leaves the list under it, so it is
  // never shown twice. Unlocked badges and the leaderboard are untouched.
  const nextBadge = activeTab === 'all' || activeTab === 'locked'
    ? filteredAchievements.find((a) => !a.unlocked && a.total > 0 && a.progress > 0 && a.progress < a.total) ?? null
    : null;
  const listed = nextBadge ? filteredAchievements.filter((a) => a.id !== nextBadge.id) : filteredAchievements;

  const categories = [
    { value: 'all', labelEn: 'All', labelEl: 'Όλες', icon: undefined as (typeof Users | undefined) },
    { value: 'networking', labelEn: 'Networking', labelEl: 'Δικτύωση', icon: Users },
    { value: 'engagement', labelEn: 'Engagement', labelEl: 'Αφοσίωση', icon: Heart },
    { value: 'profile', labelEn: 'Profile', labelEl: 'Προφίλ', icon: Star },
    { value: 'activity', labelEn: 'Activity', labelEl: 'Δραστηριότητα', icon: Zap },
    { value: 'special', labelEn: 'Special', labelEl: 'Ειδικά', icon: Crown },
  ];

  // The members with the most XP, from the API (the demo answers with its
  // cast). It used to be four invented names, at levels 14 to 21 on a ladder
  // that ends at 10, shown to every member.
  const leaderboard = board?.entries ?? [];

  const RANK_COLORS: Record<number, string> = { 1: 'text-status-warning', 2: 'text-muted-foreground', 3: 'text-status-warning' };

  const RECENT_UNLOCKS = achievements.filter((a) => a.unlocked && a.unlockedAt).sort((a, b) => (b.unlockedAt?.getTime() ?? 0) - (a.unlockedAt?.getTime() ?? 0)).slice(0, 5);

  const listViews = activeTab === 'all' || activeTab === 'unlocked' || activeTab === 'locked';
  // A list that was not read is not an empty one: it drew Level 1, 0 points
  // and "No achievements found. Try adjusting your filters" (docs §90).
  const listFailed = isError && !rawAchievements && !showDemoData;

  usePageList([
    {
      id: 'achievements',
      labelEn: 'Achievements',
      labelEl: 'Επιτεύγματα',
      sample: !rawAchievements && showDemoData,
      rows: isLoading || listFailed ? undefined : filteredAchievements.map((a) =>
        `${a.title} · ${a.unlocked === null ? 'eligibility not verified' : a.unlocked ? 'unlocked' : `${a.progress}/${a.total}`} · ${a.category} · ${a.points} pts`,
      ),
      rowsEl: isLoading || listFailed ? undefined : filteredAchievements.map((a) =>
        `${a.title} · ${a.unlocked === null ? 'μη επαληθευμένη επιλεξιμότητα' : a.unlocked ? 'ξεκλειδώθηκε' : `${a.progress}/${a.total}`} · ${elWord(a.category)} · ${a.points} πόντοι`,
      ),
    },
  ]);
  usePageControls([
    choiceControl(
      'achievement_view',
      'Achievements view',
      'Προβολή επιτευγμάτων',
      [
        { value: 'all', en: achievementsEn('tab_all'), el: achievementsEl('tab_all') },
        { value: 'unlocked', en: achievementsEn('tab_unlocked'), el: achievementsEl('tab_unlocked') },
        { value: 'locked', en: achievementsEn('tab_in_progress'), el: achievementsEl('tab_in_progress') },
        { value: 'leaderboard', en: achievementsEn('tab_leaderboard'), el: achievementsEl('tab_leaderboard') },
        { value: 'reputation', en: achievementsEn('tab_reputation'), el: achievementsEl('tab_reputation') },
        { value: 'badges', en: achievementsEn('tab_badges'), el: achievementsEl('tab_badges') },
      ],
      activeTab,
      (v) => setActiveTab(v as typeof activeTab),
    ),
    choiceControl(
      'achievement_category',
      'Achievement category',
      'Κατηγορία επιτεύγματος',
      categories.map((c) => ({ value: c.value, en: c.labelEn, el: c.labelEl })),
      categoryFilter,
      setCategoryFilter,
    ),
  ]);

  /*
   * The rail drew the same summary card the column opens with, so an open rail
   * showed level, points and rank twice. It now lists what the card cannot:
   * the three badges nearest to unlocking (docs §90).
   */
  const closest = achievements
    .filter((a) => !a.unlocked && a.total > 0 && a.progress > 0)
    .sort((a, b) => b.progress / b.total - a.progress / a.total)
    .slice(0, 3);
  const rail: PageRailSection[] = [
    {
      id: 'progress',
      glyph: 'award',
      labelEn: 'Closest to unlocking',
      labelEl: 'Πιο κοντά στο ξεκλείδωμα',
      content: listFailed ? (
        <p className="text-xs text-muted-foreground">
          <BilingualText en="Your badges could not be read just now." el="Τα εμβλήματά σας δεν διαβάστηκαν αυτή τη στιγμή." stacked wrap />
        </p>
      ) : closest.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          <BilingualText
            en="No badge is under way yet. A connection, a message or a post starts one."
            el="Κανένα έμβλημα δεν είναι ακόμη σε εξέλιξη. Μια σύνδεση, ένα μήνυμα ή μια ανάρτηση ξεκινά ένα."
            stacked
            wrap
          />
        </p>
      ) : (
        <ul className="space-y-3">
          {closest.map((a) => (
            <li key={a.id} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="min-w-0 truncate font-medium text-foreground">{a.title}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{a.progress}/{a.total}</span>
              </div>
              <Progress
                value={(a.progress / a.total) * 100}
                className="h-1.5"
                aria-label={bilingualAria(`${a.title}: ${a.progress} of ${a.total}`, `${a.title}: ${a.progress} από ${a.total}`)}
              />
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: 'browse',
      glyph: 'sliders',
      labelEn: 'Browse',
      labelEl: 'Περιήγηση',
      badge: (activeTab !== 'all' ? 1 : 0) + (categoryFilter !== 'all' ? 1 : 0) || null,
      content: (
        <div className="space-y-4">
          <RailOptions
            title="View"
            titleEl="Προβολή"
            options={[
              { value: 'all', en: achievementsEn('tab_all'), el: achievementsEl('tab_all'), icon: Award, count: achievements.length },
              { value: 'unlocked', en: achievementsEn('tab_unlocked'), el: achievementsEl('tab_unlocked'), icon: CheckCircle2, count: achievements.filter((a) => a.unlocked).length },
              { value: 'locked', en: achievementsEn('tab_in_progress'), el: achievementsEl('tab_in_progress'), icon: Lock, count: achievements.filter((a) => !a.unlocked).length },
              { value: 'leaderboard', en: achievementsEn('tab_leaderboard'), el: achievementsEl('tab_leaderboard'), icon: Trophy },
              { value: 'reputation', en: achievementsEn('tab_reputation'), el: achievementsEl('tab_reputation'), icon: TrendingUp },
              { value: 'badges', en: achievementsEn('tab_badges'), el: achievementsEl('tab_badges'), icon: Award },
            ]}
            value={activeTab}
            onChange={(v) => setActiveTab(v)}
          />
          {listViews && (
            <RailOptions
              title="Category"
              titleEl="Κατηγορία"
              options={categories.map((c) => ({
                value: c.value,
                en: c.labelEn,
                el: c.labelEl,
                icon: c.icon,
              }))}
              value={categoryFilter}
              onChange={setCategoryFilter}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <AppShell
      title={achievementsEn('page_title')}
      titleEl={achievementsEl('page_title')}
      description={achievementsEn('page_description')}
      descriptionEl={achievementsEl('page_description')}
      rail={rail}
      showHelp
      askAi={ASK.achievements}
    >
      <FirstRunTour tourId="achievements" steps={ACHIEVEMENTS_TOUR} ready={!isLoading} />
      <div className="space-y-6 pb-10">
        {isLoading ? (
          <AchievementsSkeleton />
        ) : listFailed ? (
          <Card>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p role="alert">
                <BilingualText en="Your achievements could not be read just now." el="Τα επιτεύγματά σας δεν διαβάστηκαν αυτή τη στιγμή." wrap />
              </p>
              <Button size="sm" variant="outline" onClick={() => void refetch()}>
                <BilingualText en="Try again" el="Δοκιμάστε ξανά" compact />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
              {nextBadge ? (
                <section className="space-y-2" data-next-badge="">
                  <h2 className="text-xs font-medium text-muted-foreground">
                    <BilingualText en={achievementsEn('next_badge')} el={achievementsEl('next_badge')} compact />
                  </h2>
                  <AchievementCard achievement={nextBadge} />
                </section>
              ) : null}
              <div data-tour="achievements-stats">
                <UserStatsCard stats={stats} rank={board?.me.rank ?? null} />
              </div>
              {activeTab === 'all' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2" data-tour="achievements-list">
                {(listed.length > 0 || nextBadge) ? (
                  listed.map((achievement, index) => (
                    <AchievementCard key={achievement.id} achievement={achievement} meterSlot={index % 3} />
                  ))
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Award className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
                      <h3 className="card-title mb-2"><BilingualText en={achievementsEn('no_achievements_found')} el={achievementsEl('no_achievements_found')} /></h3>
                      <p className="text-sm text-muted-foreground"><BilingualText en={achievementsEn('try_adjusting_filters')} el={achievementsEl('try_adjusting_filters')} /></p>
                    </CardContent>
                  </Card>
                )}
              </div>
              )}

              {activeTab === 'unlocked' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                {filteredAchievements && filteredAchievements.length > 0 ? (
                  filteredAchievements.map((achievement, index) => (
                    <AchievementCard key={achievement.id} achievement={achievement} meterSlot={index % 3} />
                  ))
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <CheckCircle2 className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
                      <h3 className="card-title mb-2"><BilingualText en={achievementsEn('no_unlocked_achievements')} el={achievementsEl('no_unlocked_achievements')} /></h3>
                      <p className="text-sm text-muted-foreground"><BilingualText en={achievementsEn('start_engaging')} el={achievementsEl('start_engaging')} /></p>
                    </CardContent>
                  </Card>
                )}
              </div>
              )}

              {activeTab === 'locked' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                {(listed.length > 0 || nextBadge) ? (
                  listed.map((achievement, index) => (
                    <AchievementCard key={achievement.id} achievement={achievement} meterSlot={index % 3} />
                  ))
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Lock className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
                      <p className="text-sm text-muted-foreground"><BilingualText en={achievementsEn('all_badges_unlocked')} el={achievementsEl('all_badges_unlocked')} /></p>
                    </CardContent>
                  </Card>
                )}
              </div>
              )}

              {activeTab === 'leaderboard' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 animate-in fade-in slide-in-from-bottom-2">
                  {/* Leaderboard: one row per person, set as every person in
                      a card is (the round mark, the name, the line under it),
                      parted by hairlines rather than framed one by one. */}
                  <div className="sm:col-span-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Trophy className="icon-sm text-status-warning" /> <BilingualText en={achievementsEn('community_leaderboard')} el={achievementsEl('community_leaderboard')} compact />
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {boardLoading ? (
                          <div className="space-y-3" aria-busy="true">
                            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                          </div>
                        ) : boardError ? (
                          <div className="space-y-3">
                            <p role="alert" className="card-body text-muted-foreground">
                              <BilingualText en="The leaderboard could not be read just now." el="Ο πίνακας κατάταξης δεν διαβάστηκε αυτή τη στιγμή." wrap />
                            </p>
                            <Button size="sm" variant="outline" disabled={boardFetching} onClick={() => void refetchBoard()}>
                              <BilingualText en="Try again" el="Δοκιμάστε ξανά" compact />
                            </Button>
                          </div>
                        ) : leaderboard.length === 0 ? (
                          <p className="card-body text-muted-foreground">
                            <BilingualText
                              en="No one has XP yet. A match, a message or a finished milestone puts you on the board."
                              el="Κανείς δεν έχει ακόμη XP. Μια αντιστοίχιση, ένα μήνυμα ή ένα ολοκληρωμένο ορόσημο σας βάζει στον πίνακα."
                            />
                          </p>
                        ) : (
                        <ol className="divide-y divide-border">
                          {leaderboard.map((user) => {
                            const isMe = user.isMe;
                            return (
                              <li
                                key={user.userId}
                                aria-current={isMe ? 'true' : undefined}
                                className="py-3 first:pt-0 last:pb-0"
                              >
                                <RowHead
                                  mark={(
                                    <Avatar className={cn('h-10 w-10', isMe && 'ring-2 ring-primary/20')}>
                                      <AvatarImage src={user.avatarUrl ?? undefined} alt="" />
                                      <AvatarFallback className="bg-muted font-semibold text-muted-foreground">{initialsOf(user.displayName)}</AvatarFallback>
                                    </Avatar>
                                  )}
                                  title={isMe
                                    ? <span className="text-primary-accessible"><BilingualText en={`${user.displayName} (You)`} el={`${user.displayName} (Εσείς)`} compact /></span>
                                    : user.displayName}
                                  subtitle={(
                                    <FactLine
                                      items={[
                                        <span key="rank" className={cn('tabular-nums', RANK_COLORS[user.rank])}>
                                          {user.rank <= 3 ? `${['🥇', '🥈', '🥉'][user.rank - 1]} ` : ''}#{user.rank}
                                        </span>,
                                        <BilingualText key="level" en={`Level ${user.level} · ${user.levelLabel}`} el={`Επίπεδο ${user.level} · ${LEVEL_LABEL_EL[user.level] ?? user.levelLabel}`} compact />,
                                      ]}
                                    />
                                  )}
                                  asideStays
                                  aside={(
                                    <span className="card-body font-semibold tabular-nums text-foreground">
                                      {user.totalXp.toLocaleString('el-GR')}{' '}
                                      <span className="text-xs font-normal text-muted-foreground">XP</span>
                                    </span>
                                  )}
                                />
                              </li>
                            );
                          })}
                        </ol>
                        )}
                        {board && !board.entries.some((e) => e.isMe) && (
                          <p className="mt-3 border-t border-border pt-3 card-body text-muted-foreground">
                            {board.me.xpToEnter != null ? (
                              <BilingualText
                                en={`You have ${board.me.totalXp.toLocaleString('en-GB')} XP: ${board.me.xpToEnter.toLocaleString('en-GB')} more puts you on the board.`}
                                el={`Έχετε ${board.me.totalXp.toLocaleString('el-GR')} XP: ακόμη ${board.me.xpToEnter.toLocaleString('el-GR')} σας βάζουν στον πίνακα.`}
                              />
                            ) : (
                              <BilingualText
                                en={`You have ${board.me.totalXp.toLocaleString('en-GB')} XP.`}
                                el={`Έχετε ${board.me.totalXp.toLocaleString('el-GR')} XP.`}
                              />
                            )}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Recent unlocks */}
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Zap className="icon-sm text-status-warning" /> <BilingualText en={achievementsEn('recently_unlocked')} el={achievementsEl('recently_unlocked')} compact />
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {RECENT_UNLOCKS.length > 0 ? (
                          <ul className="divide-y divide-border">
                            {RECENT_UNLOCKS.map((a) => {
                              const Icon = a.icon;
                              return (
                                <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                                  <RowHead
                                    mark={(
                                      <div data-keep-icon data-card-mark="" className={cn('flex h-10 w-10 items-center justify-center rounded-xl', TIER_BG[a.tier])}>
                                        <Icon className={cn('icon-md', TIER_COLORS[a.tier])} aria-hidden="true" />
                                      </div>
                                    )}
                                    title={a.title}
                                    subtitle={a.unlockedAt ? fmtDate(a.unlockedAt, { day: 'numeric', month: 'short' }) : undefined}
                                    aside={(
                                      <Badge variant="secondary" size="sm" className="px-1.5">
                                        <BilingualText en={`${a.points} pts`} el={`${a.points} πόντοι`} compact />
                                      </Badge>
                                    )}
                                  />
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="text-xs text-muted-foreground text-center py-4"><BilingualText en={achievementsEn('no_unlocks_yet')} el={achievementsEl('no_unlocks_yet')} /></p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Tier breakdown */}
                    <Card>
                      <CardHeader>
                        <CardTitle><BilingualText en={achievementsEn('tier_breakdown')} el={achievementsEl('tier_breakdown')} compact /></CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {(['platinum','gold','silver','bronze'] as const).map((tier, index) => {
                          const count = achievements.filter((a) => a.tier === tier && a.unlocked).length;
                          const total = achievements.filter((a) => a.tier === tier).length;
                          return (
                            <div key={tier} className="flex items-center gap-2">
                              <Medal className={cn('icon-sm shrink-0', TIER_COLORS[tier])} aria-hidden="true" />
                              <span className="w-20 text-xs text-muted-foreground">
                                <BilingualText en={cap(achievementsEn(`tier_${tier}`))} el={cap(achievementsEl(`tier_${tier}`))} compact />
                              </span>
                              <Progress value={total ? (count / total) * 100 : 0} data-meter-slot={index % 3} className="flex-1 h-1.5" />
                              <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">{count}/{total}</span>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {activeTab === 'reputation' && (
                <div className="animate-in fade-in slide-in-from-bottom-2">
                  <ReputationSystem points={reputationPoints > 0 ? reputationPoints : undefined} />
                </div>
              )}

              {activeTab === 'badges' && (
                <div className="animate-in fade-in slide-in-from-bottom-2">
                  <UserBadges />
                </div>
              )}
          </>
        )}
      </div>
    </AppShell>
  );
}
