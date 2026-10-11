'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMyBadges, type GamificationBadgeSummary } from '@/lib/api';
import { 
  Award, 
  Star, 
  Trophy, 
  Target, 
  Zap, 
  Heart, 
  MessageCircle, 
  Users, 
  Briefcase,
  Sparkles,
  Crown,
  Shield,
  Flame,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { qk } from '@/lib/query-keys';
import { BilingualText } from '@/components/common/BilingualText';
import { CardFoot, CardHead } from '@/components/common/CardAnatomy';

interface BadgeItem {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  category: 'engagement' | 'achievement' | 'social' | 'professional';
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  earned: boolean;
  earnedAt?: string;
  progress?: number;
  requirement?: number;
}

const badgeIcons = {
  engagement: MessageCircle,
  achievement: Trophy,
  social: Users,
  professional: Briefcase,
};

const tierColors = {
  bronze: 'text-status-warning ',
  silver: 'text-muted-foreground ',
  gold: 'text-status-warning ',
  platinum: 'text-status-info ',
};

/** The tier in words, capitalised in both languages (it was printed "Gold Tier"). */
const TIER_LABEL: Record<BadgeItem['tier'], { en: string; el: string }> = {
  bronze: { en: 'Bronze', el: 'Χάλκινη' },
  silver: { en: 'Silver', el: 'Ασημένια' },
  gold: { en: 'Gold', el: 'Χρυσή' },
  platinum: { en: 'Platinum', el: 'Πλατινένια' },
};

const tierBgColors = {
  bronze: 'bg-status-warning-bg ',
  silver: 'bg-muted ',
  gold: 'bg-status-warning-bg ',
  platinum: 'bg-status-info-bg ',
};

function rarityToTier(rarity: string): BadgeItem['tier'] {
  if (rarity === 'legendary') return 'platinum';
  if (rarity === 'epic') return 'gold';
  if (rarity === 'rare') return 'silver';
  return 'bronze';
}

function categoryToDisplay(cat: string): BadgeItem['category'] {
  if (cat === 'progress' || cat === 'execution') return 'achievement';
  if (cat === 'consistency' || cat === 'learning') return 'engagement';
  if (cat === 'collaboration') return 'social';
  if (cat === 'quality') return 'professional';
  return 'achievement';
}

function iconNameToComponent(iconName: string | null): React.ElementType {
  const map: Record<string, React.ElementType> = {
    Trophy, Award, Star, Flame, Shield, Sparkles, Crown, Zap, Target, TrendingUp,
    Users, Briefcase, MessageCircle, Heart,
  };
  return (iconName != null ? map[iconName] : undefined) ?? Trophy;
}

function apiBadgeToBadgeItem(b: GamificationBadgeSummary): BadgeItem {
  return {
    id: b.id,
    name: b.name,
    description: b.description,
    icon: iconNameToComponent(b.iconName),
    category: categoryToDisplay(b.category),
    tier: rarityToTier(b.rarity),
    earned: true,
    earnedAt: b.awardedAt,
  };
}

const demoUserBadges: BadgeItem[] = [
  {
    id: '1',
    name: 'Early Adopter',
    description: 'Joined during the beta phase',
    icon: Star,
    category: 'achievement',
    tier: 'gold',
    earned: true,
    earnedAt: '2024-01-15',
  },
  {
    id: '2',
    name: 'Conversation Starter',
    description: 'Started 50 conversations',
    icon: MessageCircle,
    category: 'engagement',
    tier: 'silver',
    earned: true,
    earnedAt: '2024-02-10',
  },
  {
    id: '3',
    name: 'Networker',
    description: 'Connected with 100 members',
    icon: Users,
    category: 'social',
    tier: 'gold',
    earned: true,
    earnedAt: '2024-02-20',
    progress: 100,
    requirement: 100,
  },
  {
    id: '4',
    name: 'Rising Star',
    description: 'Received 500 profile views',
    icon: TrendingUp,
    category: 'professional',
    tier: 'silver',
    earned: false,
    progress: 342,
    requirement: 500,
  },
  {
    id: '5',
    name: 'Community Champion',
    description: 'Helped 25 members with introductions',
    icon: Heart,
    category: 'social',
    tier: 'platinum',
    earned: false,
    progress: 18,
    requirement: 25,
  },
  {
    id: '6',
    name: 'Deal Maker',
    description: 'Closed 10 partnerships',
    icon: Briefcase,
    category: 'professional',
    tier: 'platinum',
    earned: false,
    progress: 3,
    requirement: 10,
  },
  {
    id: '7',
    name: 'On Fire',
    description: '30-day activity streak',
    icon: Flame,
    category: 'engagement',
    tier: 'gold',
    earned: false,
    progress: 12,
    requirement: 30,
  },
  {
    id: '8',
    name: 'Mentor',
    description: 'Mentored 5 founders',
    icon: Shield,
    category: 'professional',
    tier: 'gold',
    earned: true,
    earnedAt: '2024-03-01',
  },
];

interface UserBadgesProps {
  /** If true, fetches from API; otherwise uses demo data */
  live?: boolean;
}

export function UserBadges({ live = true }: UserBadgesProps = {}) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const { data: apiBadges, isLoading } = useQuery({
    queryKey: qk('gamification', 'my-badges'),
    queryFn: getMyBadges,
    staleTime: 5 * 60_000,
    enabled: live,
  });

  const resolvedBadges: BadgeItem[] = live
    ? (apiBadges?.map(apiBadgeToBadgeItem) ?? [])
    : demoUserBadges;

  const filteredBadges = selectedCategory === 'all'
    ? resolvedBadges
    : resolvedBadges.filter(b => b.category === selectedCategory);

  if (live && isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 w-full" />)}
        </div>
      </div>
    );
  }

  const earnedCount = resolvedBadges.filter(b => b.earned).length;
  const totalCount = resolvedBadges.length;
  const completionPercentage = (earnedCount / totalCount) * 100;

  return (
    <div className="space-y-6">
      {/* Stats Overview: a section card; the count is a figure in the body,
          no louder than the card's title. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="icon-md text-muted-foreground" />
            <BilingualText en="Achievements & Badges" el="Επιτεύγματα & διακρίσεις" compact />
          </CardTitle>
          <CardDescription>
            <BilingualText en="Unlock badges by engaging with the community" el="Κερδίστε διακρίσεις συμμετέχοντας στην κοινότητα" wrap />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
              <span className="text-muted-foreground">
                <span className="card-body font-semibold tabular-nums text-foreground">{earnedCount}/{totalCount}</span>{' '}
                <BilingualText en="Badges Earned" el="Διακρίσεις" compact />
              </span>
              <span className="text-muted-foreground">
                <BilingualText en="Overall Progress" el="Συνολική πρόοδος" compact />{' '}
                <span className="font-medium tabular-nums text-foreground">{completionPercentage.toFixed(0)}%</span>
              </span>
            </div>
            <Progress value={completionPercentage} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Badges Grid */}
      <Tabs defaultValue="all" onValueChange={setSelectedCategory}>
        <TabsList className="w-full lg:grid lg:grid-cols-5">
          <TabsTrigger value="all"><BilingualText en="All" el="Όλα" compact /></TabsTrigger>
          <TabsTrigger value="engagement">
            <MessageCircle className="icon-sm mr-1" />
            <BilingualText en="Engage" el="Συμμετοχή" compact />
          </TabsTrigger>
          <TabsTrigger value="achievement">
            <Trophy className="icon-sm mr-1" />
            <BilingualText en="Achieve" el="Επίτευξη" compact />
          </TabsTrigger>
          <TabsTrigger value="social">
            <Users className="icon-sm mr-1" />
            <BilingualText en="Social" el="Κοινωνικά" compact />
          </TabsTrigger>
          <TabsTrigger value="professional">
            <Briefcase className="icon-sm mr-1" />
            <BilingualText en="Pro" el="Pro" compact />
          </TabsTrigger>
        </TabsList>

        <TabsContent value={selectedCategory} className="mt-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredBadges.map((badge) => {
              const Icon = badge.icon;
              const hasProgress = typeof badge.progress === 'number' && typeof badge.requirement === 'number';
              const progressPercentage = hasProgress 
                ? (badge.progress! / badge.requirement!) * 100 
                : 0;
              const tierLabel = TIER_LABEL[badge.tier];

              // A badge reads like every card: its emblem as the mark, the
              // name and its tier beside it, "Earned" at the head's right,
              // and the sentence, the progress and the date on the emblem's
              // left edge below.
              return (
                <Card 
                  key={badge.id} 
                  className={cn(
                    'transition-all hover:border-primary/30',
                    badge.earned && 'border-primary/50',
                    !badge.earned && 'opacity-75'
                  )}
                >
                  <CardContent className="space-y-3">
                    <CardHead
                      mark={(
                        <div
                          data-keep-icon
                          data-card-mark=""
                          className={cn('flex h-10 w-10 items-center justify-center rounded-full', tierBgColors[badge.tier])}
                        >
                          <Icon className={cn('icon-md', tierColors[badge.tier])} aria-hidden="true" />
                        </div>
                      )}
                      title={badge.name}
                      subtitle={<BilingualText en={`${tierLabel.en} tier`} el={`Βαθμίδα: ${tierLabel.el}`} compact />}
                      aside={badge.earned ? (
                        <Badge variant="default" className="gap-1">
                          <Award className="icon-sm" />
                          <BilingualText en="Earned" el="Κερδήθηκε" compact />
                        </Badge>
                      ) : undefined}
                    />

                    {badge.description ? (
                      <p className="card-body text-muted-foreground first-letter:uppercase">{badge.description}</p>
                    ) : null}

                    {!badge.earned && hasProgress ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground"><BilingualText en="Progress" el="Πρόοδος" compact /></span>
                          <span className="font-medium tabular-nums">
                            {badge.progress}/{badge.requirement}
                          </span>
                        </div>
                        <Progress value={progressPercentage} className="h-2" />
                      </div>
                    ) : null}

                    <CardFoot
                      meta={badge.earned ? (
                        <BilingualText
                          en={`Earned on ${new Date(badge.earnedAt!).toLocaleDateString('en-GB', { timeZone: 'UTC' })}`}
                          el={`Κερδήθηκε στις ${new Date(badge.earnedAt!).toLocaleDateString('el-GR', { timeZone: 'UTC' })}`}
                          compact
                          wrap
                        />
                      ) : hasProgress ? undefined : (
                        <BilingualText en="Not yet earned" el="Δεν έχει κερδηθεί" compact />
                      )}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
