'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle,
  ChevronRight,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/hooks/useSession';
import { isPreviewDemo } from '@/lib/preview-demo';
import { cn } from '@/lib/utils';
import {
  getDashboardActivity,
  getDashboardMe,
  getDashboardStats,
  getMeProfile,
  getRecommendations,
  listConnectionRequests,
  listEvents,
  listMilestones,
  getMilestoneSummary,
  discoverMentors,
  getMyGroups,
  type SearchHit,
  type Milestone,
  type MilestoneSummary,
  type MentorProfileItem,
} from '@/lib/api';
import { queryKeys, qk } from '@/lib/query-keys';
import { BilingualText } from '@/components/common/BilingualText';
import { CfbGlyph, NavIcon, type CfbGlyphName } from '@/components/icons/CfbGlyph';
import { dashboardEn, dashboardEl } from '@/lib/i18n/strings-dashboard';
import { useDateFormat } from '@/lib/i18n/useDateFormat';

function getTimeBasedGreeting(): { en: string; el: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { en: dashboardEn('good_morning'), el: dashboardEl('good_morning') };
  if (hour < 17) return { en: dashboardEn('good_afternoon'), el: dashboardEl('good_afternoon') };
  return { en: dashboardEn('good_evening'), el: dashboardEl('good_evening') };
}

function ActionItem({
  glyph,
  label,
  labelEl,
  count,
  href,
  variant = 'default',
}: {
  glyph: CfbGlyphName;
  label: string;
  labelEl: string;
  count: number;
  href: string;
  variant?: 'default' | 'primary' | 'warning';
}) {
  const colors = {
    default: 'bg-secondary/60 text-foreground hover:bg-secondary',
    primary: 'bg-primary/10 text-primary-accessible hover:bg-primary/20 border-primary/20',
    warning: 'bg-status-warning-bg text-status-warning hover:bg-status-warning-bg border-status-warning-border',
  };

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center justify-between rounded-lg border px-3 py-2.5 transition-all',
        colors[variant]
      )}
    >
      <div className="flex items-center gap-2.5">
        <CfbGlyph name={glyph} className="icon-sm" />
        <span className="text-sm font-medium">
          <BilingualText en={label} el={labelEl} compact />
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-background/80 px-2 py-0.5 text-xs font-semibold tabular-nums">
          {count}
        </span>
        <ChevronRight className="icon-sm opacity-50" />
      </div>
    </Link>
  );
}

function MatchPreviewCard({ match }: { match: SearchHit }) {
  const score = match.matchScore ?? 0;
  const tierColor = score >= 80
    ? 'hsl(var(--status-success-mark))'
    : score >= 65
      ? 'hsl(var(--status-info-mark))'
      : score >= 45
        ? 'hsl(var(--status-warning-mark))'
        : 'hsl(var(--status-neutral-mark))';

  return (
    <Link
      href={`/matches/${match.userId}`}
      className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-all hover:border-primary/30 hover:shadow-sm"
    >
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarImage src={match.avatarUrl ?? undefined} />
        <AvatarFallback className="bg-primary/10 text-primary-accessible text-sm font-semibold">
          {match.displayName?.[0]?.toUpperCase() ?? '?'}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground group-hover:text-primary-accessible transition-colors">
          {match.displayName}
        </p>
        <p className="truncate text-xs text-muted-foreground">{match.headline ?? match.role}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-xs font-bold tabular-nums" style={{ color: tierColor }}>
          {score}%
        </span>
        <span className="text-2xs text-muted-foreground">
          <BilingualText en={dashboardEn('match_short')} el={dashboardEl('match_short')} compact />
        </span>
      </div>
    </Link>
  );
}

function MentorSuggestionCard({ mentor }: { mentor: MentorProfileItem }) {
  return (
    <Link
      href={`/mentoring?mentor=${mentor.userId}`}
      className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-all hover:border-primary/30 hover:shadow-sm"
    >
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarImage src={mentor.avatarUrl ?? undefined} />
        <AvatarFallback className="bg-status-success-bg text-status-success text-sm font-semibold">
          {mentor.displayName?.[0]?.toUpperCase() ?? 'M'}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground group-hover:text-primary-accessible transition-colors">{mentor.displayName}</p>
        <p className="truncate text-xs text-muted-foreground">{mentor.headline ?? 'Mentor'}</p>
      </div>
      {mentor.isFree ? (
        <span className="shrink-0 text-2xs font-medium text-status-success bg-status-success-bg px-1.5 py-0.5 rounded">Free</span>
      ) : mentor.hourlyRate ? (
        <span className="shrink-0 text-2xs text-muted-foreground">${mentor.hourlyRate}/h</span>
      ) : null}
    </Link>
  );
}

function CommunityRow({ group }: { group: { id: string; name: string; memberCount: number; category?: string | null; avatarUrl?: string | null } }) {
  return (
    <Link
      href={`/groups/${group.id}`}
      className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-secondary/50"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
        {group.avatarUrl ? (
          <img src={group.avatarUrl} alt="" className="h-8 w-8 rounded-lg object-cover" loading="lazy" decoding="async" referrerPolicy="no-referrer" width={32} height={32} />
        ) : (
          <CfbGlyph name="community" className="icon-sm text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground group-hover:text-primary-accessible transition-colors">{group.name}</p>
        <p className="text-xs text-muted-foreground">
          {group.memberCount} <BilingualText en={dashboardEn('members')} el={dashboardEl('members')} compact />
        </p>
      </div>
      <ChevronRight className="icon-sm shrink-0 opacity-40" />
    </Link>
  );
}

function ActivityRow({
  item,
}: {
  item: { id: string; type: string; title: string; author?: string; timeAgo: string; href: string };
}) {
  return (
    <Link
      href={item.href}
      className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-secondary/50"
    >
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
          item.type === 'connection' ? 'bg-status-info-bg text-status-info' : 'bg-primary/10 text-primary-accessible'
        )}
      >
        {item.type === 'connection' ? (
          <CfbGlyph name="people" className="icon-sm" />
        ) : (
          <CfbGlyph name="messages" className="icon-sm" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">{item.title}</p>
        {item.author && <p className="text-xs text-muted-foreground">{item.author}</p>}
      </div>
      <span className="shrink-0 text-2xs text-muted-foreground">{item.timeAgo}</span>
    </Link>
  );
}

export function DashboardHome() {
  const fmtDate = useDateFormat();
  const router = useRouter();
  const { hasSession, mounted: sessionReady } = useSession();

  useEffect(() => {
    if (isPreviewDemo()) return;
    if (sessionReady && !hasSession) {
      router.replace('/login');
    }
  }, [hasSession, router, sessionReady]);

  const queryEnabled = sessionReady && hasSession;

  const { data: profileData } = useQuery({
    queryKey: queryKeys.me.profile(),
    queryFn: getMeProfile,
    staleTime: 5 * 60_000,
    enabled: queryEnabled,
  });
  const profile = profileData?.profile;
  const displayName = profile?.displayName ?? 'there';
  const greeting = getTimeBasedGreeting();

  const { data: pendingData } = useQuery({
    queryKey: queryKeys.connections.pendingReceived(),
    queryFn: () => listConnectionRequests({ type: 'received', limit: 50 }),
    staleTime: 30_000,
    enabled: queryEnabled,
  });
  const pendingCount = pendingData?.connections?.filter((c) => c.status === 'pending').length ?? 0;

  const { data: meSummary } = useQuery({
    queryKey: qk('dashboard', 'me'),
    queryFn: getDashboardMe,
    staleTime: 60_000,
    enabled: queryEnabled,
  });

  const { data: statsData } = useQuery({
    queryKey: qk('dashboard', 'stats'),
    queryFn: getDashboardStats,
    staleTime: 60_000,
    enabled: queryEnabled,
  });

  const { data: matchesData, isLoading: matchesLoading } = useQuery({
    queryKey: qk('recommendations', { limit: 4 }),
    queryFn: () => getRecommendations({ limit: 4 }),
    staleTime: 3 * 60_000,
    enabled: queryEnabled,
  });
  const topMatches = (matchesData?.suggestions ?? []) as SearchHit[];

  const { data: eventsData } = useQuery({
    queryKey: qk('events', { scope: 'upcoming', limit: 3 }),
    queryFn: () => listEvents({ scope: 'upcoming', limit: 3 }),
    staleTime: 2 * 60_000,
    enabled: queryEnabled,
  });
  const upcomingEvents = eventsData?.events ?? [];

  const { data: activityData } = useQuery({
    queryKey: qk('dashboard', 'activity'),
    queryFn: () => getDashboardActivity({ limit: 4 }),
    staleTime: 60_000,
    enabled: queryEnabled,
  });
  const recentActivity = activityData?.items ?? [];

  const { data: milestonesData } = useQuery({
    queryKey: qk('milestones', 'in_progress', 3),
    queryFn: () => listMilestones({ status: 'in_progress' as const, limit: 3 }),
    staleTime: 60_000,
    enabled: queryEnabled,
  });
  const activeMilestonesList: Milestone[] = milestonesData?.milestones ?? [];

  const { data: milestoneSummary } = useQuery<MilestoneSummary>({
    queryKey: qk('milestones', 'summary'),
    queryFn: getMilestoneSummary,
    staleTime: 5 * 60_000,
    enabled: queryEnabled,
  });

  const { data: mentorsData } = useQuery({
    queryKey: qk('mentors', 'dashboard-suggestions'),
    queryFn: () => discoverMentors({ limit: 3, availabilityStatus: 'available' }),
    staleTime: 5 * 60_000,
    enabled: queryEnabled,
  });
  const mentorSuggestions: MentorProfileItem[] = (mentorsData?.mentors ?? []).slice(0, 3);

  const { data: myGroupsData } = useQuery({
    queryKey: qk('groups', 'my'),
    queryFn: getMyGroups,
    staleTime: 2 * 60_000,
    enabled: queryEnabled,
  });
  const myGroups = (myGroupsData?.groups ?? []).slice(0, 4);

  const unreadMessages = meSummary?.unreadMessages ?? 0;
  const activeMilestones = meSummary?.activeMilestones ?? 0;
  const totalActions = pendingCount + unreadMessages + activeMilestones;

  const profileCompletion = profile
    ? Math.round(
        ([
          !!profile.displayName,
          !!profile.headline,
          !!profile.bio,
          (profile.skills?.length ?? 0) >= 3,
          !!profile.location,
          !!profile.avatarUrl,
        ].filter(Boolean).length /
          6) *
          100
      )
    : 0;

  if (!sessionReady || !hasSession) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-20">
          <div className="text-sm text-muted-foreground">
            <BilingualText en={dashboardEn('preparing_workspace')} el={dashboardEl('preparing_workspace')} />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Context Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-semibold tracking-tight text-foreground">
              <BilingualText en={greeting.en} el={greeting.el} compact />, {displayName}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {totalActions > 0 ? (
                <>
                  <span className="font-medium text-foreground">{totalActions}</span>{' '}
                  <BilingualText
                    en={`action${totalActions > 1 ? 's' : ''} need your attention`}
                    el={totalActions === 1 ? 'ενέργεια χρειάζεται την προσοχή σας' : 'ενέργειες χρειάζονται την προσοχή σας'}
                    compact
                  />
                </>
              ) : (
                <BilingualText en={dashboardEn('all_caught_up_explore')} el={dashboardEl('all_caught_up_explore')} />
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <Link href="/matches">
                <CfbGlyph name="matches" className="icon-sm" />
                <BilingualText en={dashboardEn('view_matches')} el={dashboardEl('view_matches')} compact />
              </Link>
            </Button>
            <Button size="sm" className="gap-2" asChild>
              <Link href="/discover">
                <CfbGlyph name="discover" className="icon-sm" />
                <BilingualText en={dashboardEn('explore')} el={dashboardEl('explore')} compact />
              </Link>
            </Button>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Priority Actions + Activity */}
          <div className="space-y-6 lg:col-span-4">
            {/* Priority Actions */}
            <Card>
              <CardContent>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <CfbGlyph name="spark" className="icon-sm text-muted-foreground" />
                    <BilingualText en={dashboardEn('next_actions')} el={dashboardEl('next_actions')} compact />
                  </h2>
                  {totalActions > 0 && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary-accessible">
                      {totalActions}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {pendingCount > 0 && (
                    <ActionItem
                      glyph="people"
                      label={dashboardEn('connection_requests')}
                      labelEl={dashboardEl('connection_requests')}
                      count={pendingCount}
                      href="/connections"
                      variant="primary"
                    />
                  )}
                  {unreadMessages > 0 && (
                    <ActionItem
                      glyph="messages"
                      label={dashboardEn('unread_messages')}
                      labelEl={dashboardEl('unread_messages')}
                      count={unreadMessages}
                      href="/messages"
                      variant="default"
                    />
                  )}
                  {activeMilestones > 0 && (
                    <ActionItem
                      glyph="flag"
                      label={dashboardEn('active_milestones')}
                      labelEl={dashboardEl('active_milestones')}
                      count={activeMilestones}
                      href="/milestones"
                      variant="warning"
                    />
                  )}
                  {totalActions === 0 && (
                    <div className="flex flex-col items-center gap-2 py-6 text-center">
                      <CheckCircle className="icon-xl text-status-success" />
                      <p className="text-sm text-muted-foreground">
                        <BilingualText en={dashboardEn('all_caught_up')} el={dashboardEl('all_caught_up')} />
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardContent>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <CfbGlyph name="spark" className="icon-sm text-muted-foreground" />
                    <BilingualText en={dashboardEn('recent_activity')} el={dashboardEl('recent_activity')} compact />
                  </h2>
                  <Link href="/activity" className="text-xs text-primary-accessible hover:underline">
                    <BilingualText en={dashboardEn('view_all_activity')} el={dashboardEl('view_all_activity')} compact />
                  </Link>
                </div>
                {recentActivity.length > 0 ? (
                  <div className="space-y-1">
                    {recentActivity.map((item) => (
                      <ActivityRow key={item.id} item={item} />
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    <BilingualText en={dashboardEn('no_recent_activity')} el={dashboardEl('no_recent_activity')} />
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Center Column: Top Matches */}
          <div className="space-y-6 lg:col-span-5">
            <Card>
              <CardContent>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <CfbGlyph name="matches" className="icon-sm text-muted-foreground" />
                    <BilingualText en={dashboardEn('top_matches')} el={dashboardEl('top_matches')} compact />
                  </h2>
                  <Link href="/matches" className="flex items-center gap-1 text-xs text-primary-accessible hover:underline">
                    <BilingualText en={dashboardEn('see_all')} el={dashboardEl('see_all')} compact /> <ArrowRight className="icon-sm" />
                  </Link>
                </div>
                {matchesLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-48" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : topMatches.length > 0 ? (
                  <div className="space-y-3">
                    {topMatches.map((match) => (
                      <MatchPreviewCard key={match.id} match={match} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <CfbGlyph name="people" className="icon-xl text-muted-foreground/40" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        <BilingualText en={dashboardEn('no_matches_yet')} el={dashboardEl('no_matches_yet')} />
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <BilingualText en={dashboardEn('complete_profile_for_matches')} el={dashboardEl('complete_profile_for_matches')} />
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/profile/edit">
                        <BilingualText en={dashboardEn('complete_profile')} el={dashboardEl('complete_profile')} compact />
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Mentor Suggestions */}
            {mentorSuggestions.length > 0 && (
              <Card>
                <CardContent>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <CfbGlyph name="mentor" className="icon-sm text-status-success" />
                      <BilingualText en={dashboardEn('mentor_suggestions')} el={dashboardEl('mentor_suggestions')} compact />
                    </h2>
                    <Link href="/mentoring" className="flex items-center gap-1 text-xs text-primary-accessible hover:underline">
                      <BilingualText en={dashboardEn('browse_all')} el={dashboardEl('browse_all')} compact /> <ArrowRight className="icon-sm" />
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {mentorSuggestions.map((mentor) => (
                      <MentorSuggestionCard key={mentor.userId} mentor={mentor} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* My Communities */}
            {myGroups.length > 0 && (
              <Card>
                <CardContent>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <CfbGlyph name="community" className="icon-sm text-status-info" />
                      <BilingualText en={dashboardEn('my_communities')} el={dashboardEl('my_communities')} compact />
                    </h2>
                    <Link href="/groups" className="flex items-center gap-1 text-xs text-primary-accessible hover:underline">
                      <BilingualText en={dashboardEn('all_groups')} el={dashboardEl('all_groups')} compact /> <ArrowRight className="icon-sm" />
                    </Link>
                  </div>
                  <div className="space-y-1">
                    {myGroups.map((group) => (
                      <CommunityRow key={group.id} group={group} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Upcoming Events */}
            {upcomingEvents.length > 0 && (
              <Card>
                <CardContent>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <CfbGlyph name="calendar" className="icon-sm text-status-accent" />
                      <BilingualText en={dashboardEn('upcoming_events')} el={dashboardEl('upcoming_events')} compact />
                    </h2>
                    <Link href="/events" className="text-xs text-primary-accessible hover:underline">
                      <BilingualText en={dashboardEn('view_all_activity')} el={dashboardEl('view_all_activity')} compact />
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {upcomingEvents.slice(0, 3).map((event) => (
                      <Link
                        key={event.id}
                        href={`/events/${event.id}`}
                        className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2 transition-colors hover:bg-secondary"
                      >
                        <span className="truncate text-sm text-foreground">{event.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {fmtDate(event.startAt, { month: 'short', day: 'numeric' })}
                        </span>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Progress + Stats */}
          <div className="space-y-6 lg:col-span-3">
            {/* Profile Progress */}
            {profileCompletion < 100 && (
              <Card>
                <CardContent>
                  <h2 className="mb-3 text-sm font-semibold text-foreground">
                    <BilingualText en={dashboardEn('your_progress')} el={dashboardEl('your_progress')} compact />
                  </h2>
                  <div className="space-y-3">
                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          <BilingualText en={dashboardEn('profile_completion')} el={dashboardEl('profile_completion')} compact />
                        </span>
                        <span className="font-semibold text-foreground">{profileCompletion}%</span>
                      </div>
                      <Progress value={profileCompletion} className="h-2" />
                    </div>
                    <Button variant="outline" size="sm" className="w-full gap-2" asChild>
                      <Link href="/profile/edit">
                        Complete Profile
                        <ArrowRight className="icon-sm" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Ecosystem Stats */}
            <Card>
              <CardContent>
                <h2 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
                  <CfbGlyph name="chart" className="icon-sm text-status-success" />
                  <BilingualText en="Ecosystem pulse" el="Σφυγμός οικοσυστήματος" compact />
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-secondary/40 p-3 text-center">
                    <p className="text-lg font-bold text-foreground tabular-nums">
                      {statsData?.activeProfiles?.toLocaleString('en-GB') ?? '—'}
                    </p>
                    <p className="text-2xs text-muted-foreground uppercase tracking-wide">
                      <BilingualText en="Active members" el="Ενεργά μέλη" compact />
                    </p>
                  </div>
                  <div className="rounded-lg bg-secondary/40 p-3 text-center">
                    <p className="text-lg font-bold text-foreground tabular-nums">
                      {statsData?.matchesThisWeek ?? '—'}
                    </p>
                    <p className="text-2xs text-muted-foreground uppercase tracking-wide">
                      <BilingualText en="Matches/week" el="Ταιριάσματα/εβδ." compact />
                    </p>
                  </div>
                </div>
                {statsData?.trendPercent !== undefined && statsData.trendPercent > 0 && (
                  <p className="mt-3 text-center text-xs text-status-success">
                    ↑ {statsData.trendPercent}% growth this month
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Milestone Summary */}
            {milestoneSummary?.counts && milestoneSummary.total > 0 && (
              <Card className="border-primary/15 bg-primary/[0.03]">
                <CardContent>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <CfbGlyph name="chart" className="icon-sm text-muted-foreground" />
                      <BilingualText en="Milestone progress" el="Πρόοδος οροσήμων" compact />
                    </h2>
                    <Link href="/milestones" className="text-xs text-primary-accessible hover:underline">Details</Link>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
                      <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-secondary" />
                        <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary-accessible"
                          strokeDasharray={`${milestoneSummary.completionRate * 87.96 / 100} 87.96`} strokeLinecap="round" />
                      </svg>
                      <span className="absolute text-base font-bold text-foreground">{milestoneSummary.completionRate}%</span>
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-medium">{milestoneSummary.total}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">In Progress</span>
                        <span className="font-medium text-status-warning">{milestoneSummary.counts?.in_progress ?? 0}</span>
                      </div>
                      {milestoneSummary.overdue > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Overdue</span>
                          <span className="font-medium text-status-danger">{milestoneSummary.overdue}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="mt-3 w-full gap-1.5 text-xs" asChild>
                    <Link href="/readiness">
                      <CfbGlyph name="chart" className="icon-sm" />
                      <BilingualText en="View readiness" el="Δείτε την ετοιμότητα" compact />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Active Milestones */}
            {activeMilestonesList.length > 0 && (
              <Card>
                <CardContent>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <CfbGlyph name="flag" className="icon-sm text-status-warning" />
                      <BilingualText en={dashboardEn('active_milestones')} el={dashboardEl('active_milestones')} compact />
                    </h2>
                    <Link href="/milestones" className="text-xs text-primary-accessible hover:underline">
                      <BilingualText en={dashboardEn('view_all_milestones')} el={dashboardEl('view_all_milestones')} compact />
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {activeMilestonesList.map((m: { id: string; title: string; priority: string; dueDate?: string | null }) => (
                      <Link key={m.id} href="/milestones"
                        className="flex items-center gap-2 rounded-lg bg-secondary/40 px-3 py-2 transition-colors hover:bg-secondary"
                      >
                        <div className={cn('h-1.5 w-1.5 shrink-0 rounded-full', m.priority === 'high' ? 'bg-status-danger-mark' : m.priority === 'medium' ? 'bg-status-warning-mark' : 'bg-muted-foreground')} />
                        <span className="flex-1 truncate text-xs text-foreground">{m.title}</span>
                        {m.dueDate && (
                          <span className="shrink-0 text-2xs text-muted-foreground">
                            {fmtDate(m.dueDate, { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Links */}
            <Card>
              <CardContent>
                <h2 className="mb-3 text-sm font-semibold text-foreground">
                  <BilingualText en={dashboardEn('quick_links')} el={dashboardEl('quick_links')} compact />
                </h2>
                <div className="space-y-1">
                  {[
                    { href: '/builder', label: dashboardEn('startup_builder'), labelEl: dashboardEl('startup_builder') },
                    { href: '/mentoring', label: dashboardEn('find_a_mentor'), labelEl: dashboardEl('find_a_mentor') },
                    { href: '/opportunities', label: dashboardEn('opportunities'), labelEl: dashboardEl('opportunities') },
                    { href: '/groups', label: dashboardEn('community'), labelEl: dashboardEl('community') },
                    { href: '/learning', label: dashboardEn('learning_hub'), labelEl: dashboardEl('learning_hub') },
                    { href: '/analytics', label: dashboardEn('my_analytics'), labelEl: dashboardEl('my_analytics') },
                  ].map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
                    >
                      <NavIcon href={link.href} className="icon-sm" />
                      <BilingualText en={link.label} el={link.labelEl} compact />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
