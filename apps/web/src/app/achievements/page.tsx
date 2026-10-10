'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAnalyticsAchievements, getMyXP, getMyBadges, type AnalyticsAchievement, type GamificationXPSummary, type GamificationBadge } from '@/lib/api';
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
import { achievementsEn, achievementsEl } from '@/lib/i18n/strings-achievements';
import { choiceControl, usePageControls, usePageList } from '@/lib/page-controls';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { qk } from '@/lib/query-keys';
import { FirstRunTour, type TourStep } from '@/components/common/FirstRunTour';
import { useDateFormat } from '@/lib/i18n/useDateFormat';

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

const CATEGORY_ICONS = {
  networking: Users,
  engagement: Heart,
  profile: Star,
  activity: Zap,
  special: Crown,
};

const ICON_MAP: Record<string, typeof Award> = {
  trophy: Trophy, star: Star, zap: Zap, users: Users, eye: Eye,
  heart: Heart, calendar: Calendar, flame: Flame, crown: Crown,
  target: Target, medal: Medal, award: Award,
};

function apiToAchievement(a: AnalyticsAchievement, index: number): Achievement {
  const tiers: Achievement['tier'][] = ['bronze', 'silver', 'gold', 'platinum'];
  const categories: Achievement['category'][] = ['networking', 'engagement', 'profile', 'activity', 'special'];
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    category: categories[index % categories.length],
    tier: tiers[index % tiers.length],
    icon: ICON_MAP[a.icon.toLowerCase()] ?? Award,
    points: (index + 1) * 100,
    progress: a.unlocked ? 1 : 0,
    total: 1,
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


function AchievementCard({ achievement }: { achievement: Achievement }) {
  const Icon = achievement.icon;
  const CategoryIcon = CATEGORY_ICONS[achievement.category];
  const progressPercentage = (achievement.progress / achievement.total) * 100;

  return (
    <Card
      className={cn(
        'transition-all shadow-sm border-border',
        achievement.unlocked && 'hover:border-primary/30'
      )}
    >
      <CardContent>
        <div className="flex items-start gap-4">
          {/* The badge is the achievement, not decoration beside it. */}
          <div
            data-keep-icon
            className={cn(
              'relative p-3 rounded-xl shrink-0',
              TIER_BG[achievement.tier],
              achievement.unlocked ? 'ring-2 ring-primary/20' : ''
            )}
          >
            <Icon className={cn('icon-xl', TIER_COLORS[achievement.tier])} aria-hidden="true" />
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

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <h3 className="card-title">{achievement.title}</h3>
                <p className="card-body mt-0.5 text-muted-foreground">
                  {achievement.description}
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {achievement.points} pts
              </Badge>
            </div>

            {achievement.unlocked === null && <p className="mb-3 text-xs text-muted-foreground"><BilingualText en="Eligibility not yet verified" el="Η επιλεξιμότητα δεν έχει ακόμη επαληθευτεί" compact /></p>}
            {achievement.unlocked === false && (
              <div className="space-y-1.5 mb-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span><BilingualText en={achievementsEn('progress')} el={achievementsEl('progress')} compact /></span>
                  <span>
                    {achievement.progress} / {achievement.total}
                  </span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>
            )}

            {/* flex-wrap: four items (two badges, the rarity note and the unlock
                date) needed 375px on a 334px card and had nowhere to go, so this
                row was what made /achievements the one page that scrolled
                horizontally on a phone — the fixed bottom nav then stretched with
                the grown layout viewport, which made it look like the nav's fault. */}
            {/* Category, tier, rarity and the unlock date: facts, one line,
                the tier keeping its colour. */}
            <FactLine
              items={[
                <span key="cat" className="capitalize">{achievement.category}</span>,
                <span key="tier" className={cn('capitalize', TIER_COLORS[achievement.tier])}>{achievement.tier}</span>,
                <span key="rarity">{achievement.rarity}% <BilingualText en={achievementsEn('have_this')} el={achievementsEl('have_this')} compact /></span>,
                achievement.unlocked && achievement.unlockedAt
                  ? <BilingualText key="unlocked" en={`Unlocked ${new Date(achievement.unlockedAt).toLocaleDateString('en-GB', { timeZone: 'UTC' })}`} el={`Ξεκλειδώθηκε ${new Date(achievement.unlockedAt).toLocaleDateString('el-GR', { timeZone: 'UTC' })}`} compact />
                  : null,
              ]}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UserStatsCard({ stats }: { stats: UserStats }) {
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
                <span className="font-medium">
                  {stats.totalPoints} / {stats.nextLevelPoints} pts
                </span>
              </div>
              <Progress value={levelProgress} className="h-2" />
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="default" className="gap-1">
                <Crown className="icon-sm" aria-hidden="true" />
                {stats.rank}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Top {100 - stats.percentile}%
              </span>
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
              <p className="page-stat text-xl font-bold">#{stats.percentile}</p>
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
    const list = isError || !rawAchievements ? DEMO_ACHIEVEMENTS : rawAchievements;
    return (list ?? []).map((a, i) =>
      'tier' in a && 'points' in a && 'rarity' in a
        ? (a as unknown as Achievement)
        : apiToAchievement(a as AnalyticsAchievement, i),
    );
  }, [rawAchievements, isError]);

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

  const filteredAchievements = achievements?.filter((achievement) => {
    if (activeTab === 'unlocked' && !achievement.unlocked) return false;
    if (activeTab === 'locked' && achievement.unlocked) return false;
    if (categoryFilter !== 'all' && achievement.category !== categoryFilter) return false;
    return true;
  });

  const categories = [
    { value: 'all', labelEn: 'All', labelEl: 'Όλες', icon: undefined as (typeof Users | undefined) },
    { value: 'networking', labelEn: 'Networking', labelEl: 'Δικτύωση', icon: Users },
    { value: 'engagement', labelEn: 'Engagement', labelEl: 'Αφοσίωση', icon: Heart },
    { value: 'profile', labelEn: 'Profile', labelEl: 'Προφίλ', icon: Star },
    { value: 'activity', labelEn: 'Activity', labelEl: 'Δραστηριότητα', icon: Zap },
    { value: 'special', labelEn: 'Special', labelEl: 'Ειδικά', icon: Crown },
  ];

  const LEADERBOARD = [
    { rank: 1, name: 'Nikos Papadakis', points: 4200, level: 21, badge: 'Legend', avatar: '' },
    { rank: 2, name: 'Elena Papadopoulos', points: 3850, level: 19, badge: 'Expert', avatar: '' },
    { rank: 3, name: 'Marcus Chen', points: 3100, level: 15, badge: 'Rising Star', avatar: '' },
    { rank: 4, name: 'Andreea Ionescu', points: 2800, level: 14, badge: 'Rising Star', avatar: '' },
    { rank: 5, name: 'You', points: stats.totalPoints, level: stats.level, badge: stats.rank, avatar: '', isMe: true },
  ].sort((a, b) => b.points - a.points).map((u, i) => ({ ...u, rank: i + 1 }));

  const RANK_COLORS: Record<number, string> = { 1: 'text-status-warning', 2: 'text-muted-foreground', 3: 'text-status-warning' };

  const RECENT_UNLOCKS = achievements.filter((a) => a.unlocked && a.unlockedAt).sort((a, b) => (b.unlockedAt?.getTime() ?? 0) - (a.unlockedAt?.getTime() ?? 0)).slice(0, 5);

  const listViews = activeTab === 'all' || activeTab === 'unlocked' || activeTab === 'locked';

  usePageList([
    {
      id: 'achievements',
      labelEn: 'Achievements',
      labelEl: 'Επιτεύγματα',
      rows: isLoading ? undefined : (filteredAchievements ?? []).map((a) =>
        `${a.title} · ${a.unlocked ? 'unlocked' : 'in progress'} · ${a.category} · ${a.points} pts`,
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

  const rail: PageRailSection[] = [
    {
      id: 'progress',
      glyph: 'award',
      labelEn: 'Your progress',
      labelEl: 'Η πρόοδός σας',
      content: stats ? <UserStatsCard stats={stats} /> : null,
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
      askAi="What achievements should I work toward next, and which unlocked badges are most useful to show investors?"
    >
      <FirstRunTour tourId="achievements" steps={ACHIEVEMENTS_TOUR} ready={!isLoading} />
      <div className="space-y-6 pb-10">
        {isLoading ? (
          <AchievementsSkeleton />
        ) : (
          <>
              <div data-tour="achievements-stats">
                <UserStatsCard stats={stats} />
              </div>
              {activeTab === 'all' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2" data-tour="achievements-list">
                {filteredAchievements && filteredAchievements.length > 0 ? (
                  filteredAchievements.map((achievement) => (
                    <AchievementCard key={achievement.id} achievement={achievement} />
                  ))
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Award className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
                      <h3 className="text-lg font-semibold mb-2"><BilingualText en={achievementsEn('no_achievements_found')} el={achievementsEl('no_achievements_found')} /></h3>
                      <p className="text-sm text-muted-foreground"><BilingualText en={achievementsEn('try_adjusting_filters')} el={achievementsEl('try_adjusting_filters')} /></p>
                    </CardContent>
                  </Card>
                )}
              </div>
              )}

              {activeTab === 'unlocked' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                {filteredAchievements && filteredAchievements.length > 0 ? (
                  filteredAchievements.map((achievement) => (
                    <AchievementCard key={achievement.id} achievement={achievement} />
                  ))
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <CheckCircle2 className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
                      <h3 className="text-lg font-semibold mb-2"><BilingualText en={achievementsEn('no_unlocked_achievements')} el={achievementsEl('no_unlocked_achievements')} /></h3>
                      <p className="text-sm text-muted-foreground"><BilingualText en={achievementsEn('start_engaging')} el={achievementsEl('start_engaging')} /></p>
                    </CardContent>
                  </Card>
                )}
              </div>
              )}

              {activeTab === 'locked' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                {filteredAchievements && filteredAchievements.length > 0 ? (
                  filteredAchievements.map((achievement) => (
                    <AchievementCard key={achievement.id} achievement={achievement} />
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
                  {/* Leaderboard table */}
                  <div className="sm:col-span-2">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Trophy className="icon-sm text-status-warning" /> <BilingualText en={achievementsEn('community_leaderboard')} el={achievementsEl('community_leaderboard')} compact />
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1">
                        {LEADERBOARD.map((user) => (
                          <div
                            key={user.rank}
                            className={cn(
                              'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
                              (user as any).isMe ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted/50',
                            )}
                          >
                            <span className={cn('w-6 text-center text-sm font-bold shrink-0', RANK_COLORS[user.rank] ?? 'text-muted-foreground')}>
                              {user.rank <= 3 ? ['🥇','🥈','🥉'][user.rank - 1] : `#${user.rank}`}
                            </span>
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                              {user.name[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn('text-sm font-medium truncate', (user as any).isMe && 'text-primary-accessible')}>
                                {user.name}{(user as any).isMe && ' (You)'}
                              </p>
                              <p className="text-xs text-muted-foreground">Level {user.level} · {user.badge}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold tabular-nums">{user.points.toLocaleString('en-GB')}</p>
                              <p className="text-xs text-muted-foreground">pts</p>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Recent unlocks */}
                  <div>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Zap className="icon-sm text-status-warning" /> <BilingualText en={achievementsEn('recently_unlocked')} el={achievementsEl('recently_unlocked')} compact />
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {RECENT_UNLOCKS.length > 0 ? RECENT_UNLOCKS.map((a) => {
                          const Icon = a.icon;
                          return (
                            <div key={a.id} className="flex items-center gap-2.5">
                              <div data-keep-icon className={cn('rounded-lg p-1.5 shrink-0', TIER_BG[a.tier])}>
                                <Icon className={cn('icon-sm', TIER_COLORS[a.tier])} aria-hidden="true" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{a.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {a.unlockedAt ? fmtDate(a.unlockedAt, { day: 'numeric', month: 'short' }) : null}
                                </p>
                              </div>
                              <Badge variant="secondary" size="sm" className="px-1.5 shrink-0">{a.points}pts</Badge>
                            </div>
                          );
                        }) : (
                          <p className="text-xs text-muted-foreground text-center py-4"><BilingualText en={achievementsEn('no_unlocks_yet')} el={achievementsEl('no_unlocks_yet')} /></p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Tier breakdown */}
                    <Card className="mt-4">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm"><BilingualText en={achievementsEn('tier_breakdown')} el={achievementsEl('tier_breakdown')} compact /></CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {(['platinum','gold','silver','bronze'] as const).map((tier) => {
                          const count = achievements.filter((a) => a.tier === tier && a.unlocked).length;
                          const total = achievements.filter((a) => a.tier === tier).length;
                          return (
                            <div key={tier} className="flex items-center gap-2">
                              <Medal className={cn('icon-sm shrink-0', TIER_COLORS[tier])} aria-hidden="true" />
                              <span className="text-xs capitalize text-muted-foreground w-16">{tier}</span>
                              <Progress value={total ? (count / total) * 100 : 0} className="flex-1 h-1.5" />
                              <span className="text-xs text-muted-foreground w-8 text-right">{count}/{total}</span>
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
