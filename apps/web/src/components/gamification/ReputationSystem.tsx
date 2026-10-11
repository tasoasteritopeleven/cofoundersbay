'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Award,
  Calendar,
  Flame,
  Handshake,
  Lightbulb,
  MessageCircle,
  Star,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { getMyXP, type GamificationRecentEvent } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { BilingualText } from '@/components/common/BilingualText';
import { CardHead } from '@/components/common/CardAnatomy';
import { RowHead } from '@/components/dashboard/SectionCard';
import { FactLine } from '@/components/common/FactLine';
import { bilingualAria } from '@/lib/i18n/format';

interface ReputationActivity {
  id: string;
  type: 'earned' | 'spent';
  action: string;
  points: number;
  timestamp: string;
  icon: React.ElementType;
}

interface ReputationLevel {
  level: number;
  name: string;
  minPoints: number;
  maxPoints: number;
  perks: string[];
}

const reputationLevels: ReputationLevel[] = [
  {
    level: 1,
    name: 'Newcomer',
    minPoints: 0,
    maxPoints: 99,
    perks: ['Basic profile', 'Join groups', 'Send messages'],
  },
  {
    level: 2,
    name: 'Member',
    minPoints: 100,
    maxPoints: 499,
    perks: ['Create events', 'Post opportunities', 'Enhanced visibility'],
  },
  {
    level: 3,
    name: 'Contributor',
    minPoints: 500,
    maxPoints: 1499,
    perks: ['Priority support', 'Featured profile', 'Advanced analytics'],
  },
  {
    level: 4,
    name: 'Expert',
    minPoints: 1500,
    maxPoints: 4999,
    perks: ['Verified badge', 'Mentor status', 'Premium features'],
  },
  {
    level: 5,
    name: 'Leader',
    minPoints: 5000,
    maxPoints: Infinity,
    perks: ['VIP access', 'Custom branding', 'API access', 'Priority matching'],
  },
];

export { reputationLevels };

export function computeLevelFromPoints(points: number) {
  const level = reputationLevels.find(
    (l) => points >= l.minPoints && points <= l.maxPoints,
  ) ?? reputationLevels[0];
  const next = reputationLevels[level.level] ?? null;
  return { level, next };
}

function xpEventToActivity(e: GamificationRecentEvent): ReputationActivity {
  const labelMap: Record<string, { action: string; icon: React.ElementType }> = {
    CREATE_ARTIFACT:           { action: 'Created an artifact',        icon: Lightbulb },
    COMPLETE_ARTIFACT:         { action: 'Completed an artifact',      icon: Award },
    IMPROVE_ARTIFACT:          { action: 'Improved an artifact',       icon: TrendingUp },
    CREATE_BOARD:              { action: 'Created a research board',   icon: Activity },
    SYNTHESIZE_BOARD:          { action: 'Synthesized a board',        icon: Target },
    LINK_ARTIFACTS:            { action: 'Linked artifacts',           icon: Handshake },
    INVITE_COLLABORATOR:       { action: 'Invited a collaborator',     icon: Users },
    TEAM_CONTRIBUTION:         { action: 'Team contribution',          icon: Users },
    HIGH_QUALITY_CONTRIBUTION: { action: 'High-quality contribution',  icon: Star },
    RECEIVE_MENTOR_FEEDBACK:   { action: 'Received mentor feedback',   icon: MessageCircle },
    APPLY_FEEDBACK:            { action: 'Applied feedback',           icon: Zap },
    COMPLETE_REVIEW:           { action: 'Completed a review',         icon: Award },
    PROVIDE_FEEDBACK:          { action: 'Provided feedback',          icon: MessageCircle },
    COMPLETE_MILESTONE:        { action: 'Completed a milestone',      icon: Target },
    VALIDATED_PROGRESS:        { action: 'Validated progress',         icon: Star },
    STREAK_BONUS:              { action: 'Streak milestone bonus',     icon: Zap },
  };
  const mapped = labelMap[e.eventType] ?? { action: e.eventType.replace(/_/g, ' ').toLowerCase(), icon: Activity };
  return {
    id: e.id,
    type: 'earned',
    action: mapped.action,
    points: e.xpAmount,
    timestamp: e.createdAt,
    icon: mapped.icon,
  };
}

const pointsEarningGuide = [
  { action: 'Complete your profile', points: 50, icon: Star },
  { action: 'Make a connection', points: 10, icon: Users },
  { action: 'Send a message', points: 2, icon: MessageCircle },
  { action: 'Post an opportunity', points: 25, icon: Lightbulb },
  { action: 'Attend an event', points: 20, icon: Calendar },
  { action: 'Accept a partnership', points: 50, icon: Handshake },
  { action: 'Daily login streak (7 days)', points: 35, icon: Activity },
  { action: 'Refer a new member', points: 100, icon: TrendingUp },
];

interface ReputationSystemProps {
  /** Optional: override total XP (e.g. when parent already has it). If omitted, fetches from API. */
  points?: number;
}

export function ReputationSystem({ points: externalPoints }: ReputationSystemProps = {}) {
  const [activeTab, setActiveTab] = useState('overview');

  const { data: xpData, isLoading } = useQuery({
    queryKey: qk('gamification', 'my-xp'),
    queryFn: getMyXP,
    staleTime: 3 * 60_000,
    enabled: externalPoints === undefined,
  });

  const currentPoints = externalPoints ?? xpData?.totalXp ?? 0;
  const { level: currentLevel, next: nextLevel } = computeLevelFromPoints(currentPoints);

  const pointsToNextLevel = nextLevel ? nextLevel.minPoints - currentPoints : 0;
  const levelProgress = nextLevel
    ? ((currentPoints - currentLevel.minPoints) / (nextLevel.minPoints - currentLevel.minPoints)) * 100
    : 100;

  const recentActivities: ReputationActivity[] = xpData?.recentEvents
    ? xpData.recentEvents.slice(0, 8).map(xpEventToActivity)
    : [];

  const currentStreak = xpData?.streak?.currentStreak ?? 0;

  if (isLoading && externalPoints === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current level: the level's emblem as the mark, its name as the
          title, the points under it and the XP pill at the head's right;
          progress and perks on the emblem's left edge below. */}
      <Card className="border-primary/15 bg-primary/[0.03]">
        <CardContent className="space-y-4">
          <CardHead
            titleAs="h2"
            mark={(
              <div data-keep-icon data-card-mark="" className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
                <Award className="icon-md text-primary-accessible" aria-hidden="true" />
              </div>
            )}
            title={(
              <BilingualText
                en={`Level ${currentLevel.level}: ${currentLevel.name}`}
                el={`Επίπεδο ${currentLevel.level}: ${currentLevel.name}`}
                compact
                wrap
              />
            )}
            subtitle={(
              <BilingualText
                en={`${currentPoints.toLocaleString('en-GB')} reputation points`}
                el={`${currentPoints.toLocaleString('en-GB')} πόντοι φήμης`}
                compact
                wrap
              />
            )}
            meta={currentStreak > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Flame className="h-3 w-3 text-status-warning" aria-hidden="true" />
                <BilingualText en={`${currentStreak}-day streak`} el={`${currentStreak} ημέρες σε σειρά`} compact />
              </span>
            ) : undefined}
            aside={(
              <Badge variant="default" className="gap-1">
                <Zap className="icon-sm" aria-hidden="true" />
                {currentPoints.toLocaleString('en-GB')} XP
              </Badge>
            )}
          />

          {nextLevel && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
                <span className="text-muted-foreground">
                  <BilingualText en={`Progress to ${nextLevel.name}`} el={`Πρόοδος προς ${nextLevel.name}`} compact wrap />
                </span>
                <span className="font-medium tabular-nums">
                  <BilingualText
                    en={`${pointsToNextLevel.toLocaleString('en-GB')} points needed`}
                    el={`${pointsToNextLevel.toLocaleString('en-GB')} πόντοι ακόμη`}
                    compact
                  />
                </span>
              </div>
              <Progress value={levelProgress} className="h-3" />
            </div>
          )}

          {/* Perks are facts about the level: one dotted line. */}
          <FactLine label={bilingualAria('Perks at this level', 'Προνόμια αυτού του επιπέδου')} items={currentLevel.perks} />
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview"><BilingualText en="Overview" el="Επισκόπηση" compact /></TabsTrigger>
          <TabsTrigger value="activity"><BilingualText en="Activity" el="Δραστηριότητα" compact /></TabsTrigger>
          <TabsTrigger value="earn"><BilingualText en="How to Earn" el="Πώς κερδίζεται" compact /></TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Level Progression: rows parted by hairlines, each a head (the
              level number as its mark); the current one carries the filled
              mark and the pill, not a frame of its own. */}
          <Card>
            <CardHeader>
              <CardTitle><BilingualText en="Level Progression" el="Πρόοδος επιπέδων" compact /></CardTitle>
              <CardDescription><BilingualText en="Your journey through the ranks" el="Η πορεία σας στα επίπεδα" compact wrap /></CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="divide-y divide-border">
                {reputationLevels.map((level) => {
                  const isCurrentLevel = level.level === currentLevel.level;
                  const isPastLevel = currentPoints >= level.minPoints;
                  const isFutureLevel = currentPoints < level.minPoints;

                  return (
                    <li
                      key={level.level}
                      aria-current={isCurrentLevel ? 'step' : undefined}
                      className="py-3 first:pt-0 last:pb-0"
                    >
                      {/* Past and future levels are told by the mark and the
                          pill, not by fading the row: opacity over muted text
                          fell under 3:1. */}
                      <RowHead
                        mark={(
                          <div
                            data-card-mark=""
                            className={cn(
                              'flex h-10 w-10 items-center justify-center rounded-full',
                              isCurrentLevel ? 'bg-primary text-primary-foreground' : 'bg-muted',
                              isFutureLevel && 'text-muted-foreground'
                            )}
                          >
                            <span className="font-bold tabular-nums">{level.level}</span>
                          </div>
                        )}
                        title={level.name}
                        subtitle={(
                          <span className="tabular-nums">
                            {level.minPoints.toLocaleString('en-GB')} - {level.maxPoints === Infinity ? '∞' : level.maxPoints.toLocaleString('en-GB')}{' '}
                            <BilingualText en="points" el="πόντοι" compact />
                          </span>
                        )}
                        aside={isCurrentLevel ? (
                          <Badge variant="default"><BilingualText en="Current" el="Τρέχουσα" compact /></Badge>
                        ) : isPastLevel ? (
                          <Badge variant="outline"><BilingualText en="Completed" el="Ολοκληρώθηκε" compact /></Badge>
                        ) : undefined}
                      />
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle><BilingualText en="Recent Activity" el="Πρόσφατη δραστηριότητα" compact /></CardTitle>
              <CardDescription><BilingualText en="Your latest reputation changes" el="Οι πιο πρόσφατες αλλαγές φήμης" compact wrap /></CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivities.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  <BilingualText en="No XP activity yet. Start building to earn your first points." el="Δεν υπάρχει δραστηριότητα XP ακόμα. Ξεκινήστε για να κερδίσετε τους πρώτους πόντους." wrap />
                </p>
              )}
              {/* One row per change, parted by hairlines: the action, when,
                  and the points at the right - no frame per row. */}
              <ul className="divide-y divide-border">
                {recentActivities.map((activity) => {
                  const isEarned = activity.type === 'earned';

                  return (
                    <li key={activity.id} className="py-3 first:pt-0 last:pb-0">
                      <RowHead
                        title={<span className="block first-letter:uppercase">{activity.action}</span>}
                        subtitle={(
                          <span className="tabular-nums">
                            {new Date(activity.timestamp).toLocaleDateString('en-GB', { timeZone: 'UTC' })}
                            {' · '}
                            {new Date(activity.timestamp).toLocaleTimeString()}
                          </span>
                        )}
                        asideStays
                        aside={(
                          <span
                            className={cn(
                              'card-body flex items-center gap-1 font-semibold tabular-nums',
                              isEarned ? 'text-status-success ' : 'text-status-danger '
                            )}
                          >
                            {isEarned ? <ArrowUp className="icon-sm" /> : <ArrowDown className="icon-sm" />}
                            {Math.abs(activity.points)}
                          </span>
                        )}
                      />
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="earn" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle><BilingualText en="Ways to Earn Points" el="Τρόποι να κερδίσετε πόντους" compact /></CardTitle>
              <CardDescription><BilingualText en="Complete these actions to increase your reputation" el="Ολοκληρώστε αυτές τις ενέργειες για να αυξήσετε τη φήμη σας" wrap /></CardDescription>
            </CardHeader>
            <CardContent>
              {/* Rows, not framed tiles: each action and the points it is
                  worth, in two columns from `sm`. */}
              <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                {pointsEarningGuide.map((item, index) => (
                  <li key={index} className="border-b border-border py-3">
                    <RowHead
                      title={item.action}
                      asideStays
                      aside={(
                        <Badge variant="secondary" className="gap-1">
                          <Zap className="icon-sm" />
                          +{item.points}
                        </Badge>
                      )}
                    />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
