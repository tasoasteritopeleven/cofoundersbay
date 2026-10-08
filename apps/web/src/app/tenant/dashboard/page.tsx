'use client';


import { StatusText } from '@/components/common/StatusText';
import { BilingualText } from '@/components/common/BilingualText';
import Link from 'next/link';
import {
  Building2,
  Users,
  Award,
  Calendar,
  Rocket,
  GraduationCap,
  Activity,
  Settings,
  UserPlus,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/components/providers/TenantContext';
import { RelativeTime } from '@/components/common/RelativeTime';
import { formatRelativeTime, initialsOf } from '@/lib/utils';
import { getTenantMembers, listEvents, listOrganizationPrograms } from '@/lib/api';
import { useCurrentOrg } from '@/hooks/useCurrentOrg';
import { MetricTile } from '@/components/dashboard/MetricTile';
import { EmptyLine, SectionCard } from '@/components/dashboard/SectionCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { qk } from '@/lib/query-keys';
import { useDateFormat } from '@/lib/i18n/useDateFormat';

const ChartFallback = () => <Skeleton className="h-[160px] w-full rounded-lg" />;
const MemberGrowthChart = dynamic(
  () => import('./TenantDashboardCharts').then((m) => ({ default: m.MemberGrowthChart })),
  { ssr: false, loading: ChartFallback },
);
const ProgramEngagementChart = dynamic(
  () => import('./TenantDashboardCharts').then((m) => ({ default: m.ProgramEngagementChart })),
  { ssr: false, loading: ChartFallback },
);

export default function TenantDashboardPage() {
  const fmtDate = useDateFormat();
  /*
   * The workspace's home, from its own reads.
   *
   * Members and events were read already; the programme list, both charts
   * and three of the four figures were constants ("Spring Accelerator 2025",
   * a workspace growing to 156 members). Programmes come from the
   * organisation that owns the workspace - the same list /tenant/programs and
   * /org/programs show - and a tenant membership's role says who is a founder
   * and who is a mentor, so all four figures are counted.
   */
  const { activeTenant } = useTenant();
  const tenantId = activeTenant?.id ?? null;

  const { data: membersData } = useQuery({
    queryKey: qk('tenant', 'members', tenantId),
    queryFn: () => getTenantMembers(tenantId!, { limit: 100 }),
    enabled: Boolean(tenantId),
    staleTime: 60_000,
    retry: 0,
  });
  const { data: eventsData } = useQuery({
    queryKey: qk('events', 'tenant'),
    queryFn: () => listEvents({ scope: 'upcoming', limit: 5 }),
    staleTime: 60_000,
    retry: 0,
  });

  const members = useMemo(() => (Array.isArray(membersData) ? membersData : []), [membersData]);
  const { membership } = useCurrentOrg();
  const organizationId = membership?.organizationId ?? null;
  const { data: programData, isLoading: programsLoading } = useQuery({
    queryKey: qk('programs', 'organization', organizationId),
    queryFn: () => listOrganizationPrograms(organizationId!),
    enabled: Boolean(organizationId),
    staleTime: 60_000,
    retry: 0,
  });
  const programs = useMemo(() => programData ?? [], [programData]);
  const runningOrNext = programs.filter((p) => p.status === 'active' || p.status === 'upcoming');

  const stats = {
    totalMembers: members.length,
    activePrograms: programData ? programs.filter((p) => p.status === 'active').length : null,
    startups: membersData ? members.filter((m) => m.role === 'founder').length : null,
    mentors: members.filter((m) => m.role === 'mentor').length,
  };

  // Members at the end of each of the last six months, from join dates.
  const now = Date.now();
  const memberGrowth = Array.from({ length: 6 }, (_, i) => {
    const end = new Date(now);
    end.setDate(1);
    end.setMonth(end.getMonth() - (5 - i) + 1);
    end.setHours(0, 0, 0, 0);
    const label = fmtDate(end.getTime() - 1, { month: 'short' });
    return { month: label, members: members.filter((m) => Date.parse(m.joinedAt) < Math.min(end.getTime(), now + 1)).length };
  });
  const engagement = runningOrNext.map((p) => ({
    name: p.title.split(' · ')[0].replace(/ (Accelerator|Bootcamp|Track)$/, '').slice(0, 14),
    applications: p.applicationCount,
    enrolled: p.participantCount,
  }));

  const recentMembers = members
    .slice()
    .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))
    .slice(0, 3)
    .map((m) => ({
      id: m.id,
      name: m.user.profile?.displayName ?? m.user.email,
      role: m.role,
      joinedAt: m.joinedAt,
      avatarUrl: m.user.profile?.avatarUrl ?? '',
    }));

  const upcomingEvents = (eventsData?.events ?? []).slice(0, 3).map((event) => ({
    id: event.id,
    name: event.title,
    // UTC on both sides of hydration, as every other date here is.
    date: fmtDate(event.startAt, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    type: event.eventType === 'workshop' ? 'Session' : 'Event',
  }));

  return (
    <AppShell
      title="Tenant Dashboard"
      titleEl="Πίνακας οργανισμού"
      description="Manage your organization on CoFounderBay"
      descriptionEl="Διαχειριστείτε τον οργανισμό σας στο CoFounderBay"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/tenant/branding"><Building2 className="mr-1.5 icon-sm" /> Branding</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/tenant/settings"><Settings className="mr-1.5 icon-sm" /> Settings</Link>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">

        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          <MetricTile icon={Users} label="Members" labelEl="Μέλη" value={membersData ? stats.totalMembers : '\u2014'} caption="Everyone with a seat" captionEl="Όσοι έχουν θέση" href="/tenant/members" />
          <MetricTile icon={Award} label="Running programs" labelEl="Ενεργά προγράμματα" value={stats.activePrograms ?? '\u2014'} caption={`${programs.filter((p) => p.status === 'upcoming').length} upcoming`} captionEl={`${programs.filter((p) => p.status === 'upcoming').length} προσεχώς`} href="/tenant/programs" />
          <MetricTile icon={Rocket} label="Founders" labelEl="Ιδρυτές" value={stats.startups ?? '\u2014'} caption="Members with the founder role" captionEl="Μέλη με ρόλο ιδρυτή" href="/tenant/members" />
          <MetricTile icon={GraduationCap} label="Mentors" labelEl="Μέντορες" value={membersData ? stats.mentors : '\u2014'} caption="Members with the mentor role" captionEl="Μέλη με ρόλο μέντορα" href="/tenant/members" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Running and upcoming programs, with how full each is. */}
          <SectionCard className="lg:col-span-2" title="Programs" titleEl="Προγράμματα" action={{ href: '/tenant/programs', label: 'Manage', labelEl: 'Διαχείριση' }} contentClassName="card-rows">
            {programsLoading && [0, 1].map((i) => <Skeleton key={i} className="h-16" />)}
            {runningOrNext.map((program) => {
              const fill = program.capacity ? Math.min(100, Math.round((program.participantCount / program.capacity) * 100)) : 0;
              return (
                <Link key={program.id} href={`/programs/${program.id}`} className="axis-row block rounded-md transition-colors hover:bg-accent focus-ring">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{program.title}</span>
                      <Badge size="sm" variant={program.status === 'active' ? 'success' : 'info'}>{program.status === 'active' ? <BilingualText en="Running" el="Σε εξέλιξη" compact /> : <BilingualText en="Upcoming" el="Προσεχές" compact />}</Badge>
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {program.participantCount}/{program.capacity ?? '—'} places · {program.applicationCount} applications
                    </span>
                  </div>
                  <Progress value={fill} className="h-1.5" aria-label={`${program.title}: ${fill}% of places filled`} />
                </Link>
              );
            })}
            {!programsLoading && runningOrNext.length === 0 && (
              <EmptyLine en="No program is running or taking applications." el="Κανένα πρόγραμμα σε εξέλιξη ή με ανοιχτές αιτήσεις." />
            )}
          </SectionCard>

          <SectionCard title="Recent members" titleEl="Πρόσφατα μέλη" action={{ href: '/tenant/members', label: 'All members', labelEl: 'Όλα τα μέλη' }} contentClassName="space-y-3">
            {recentMembers.map((member) => (
              <div key={member.id} className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={member.avatarUrl} />
                  <AvatarFallback>{initialsOf(member.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{member.name}</p>
                  <p className="text-xs capitalize text-muted-foreground"><StatusText value={member.role} /></p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  <RelativeTime date={member.joinedAt} format={formatRelativeTime} />
                </span>
              </div>
            ))}
            {membersData && recentMembers.length === 0 && (
              <EmptyLine en="Invite someone to see them here." el="Προσκαλέστε κάποιον για να εμφανιστεί εδώ." />
            )}
          </SectionCard>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SectionCard title="Member growth" titleEl="Αύξηση μελών" contentClassName="space-y-2">
            <MemberGrowthChart data={memberGrowth} />
            <p className="text-xs text-muted-foreground">Members at the end of each of the last six months, from join dates.</p>
          </SectionCard>
          <SectionCard title="Applications and places" titleEl="Αιτήσεις και θέσεις" contentClassName="space-y-2">
            <ProgramEngagementChart data={engagement} />
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Applications</span> and <span className="font-medium text-status-success">places filled</span> in each running or upcoming program.
            </p>
          </SectionCard>
        </div>

        <SectionCard title="Upcoming events" titleEl="Επόμενες εκδηλώσεις" action={{ href: '/events/create', label: 'Add event', labelEl: 'Νέα εκδήλωση' }}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {upcomingEvents.map((event) => (
              <div key={event.id} className="min-w-0">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="icon-sm" aria-hidden="true" />
                  {event.date} · {event.type}
                </p>
                <p className="mt-1 text-sm font-medium">{event.name}</p>
              </div>
            ))}
          </div>
          {eventsData && upcomingEvents.length === 0 && (
            <EmptyLine en="No event is on the calendar." el="Καμία εκδήλωση στο ημερολόγιο." />
          )}
        </SectionCard>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Invite Members', icon: UserPlus, href: '/tenant/members', color: 'text-status-info' },
            { label: 'Manage Programs', icon: Award, href: '/tenant/programs', color: 'text-status-accent' },
            { label: 'View Analytics', icon: Activity, href: '/tenant/analytics', color: 'text-status-success' },
            { label: 'Branding', icon: Building2, href: '/tenant/branding', color: 'text-status-warning' },
          ].map(({ label, icon: Icon, href, color }) => (
            <Button key={label} variant="outline" className="h-auto py-3 flex-col gap-1.5" asChild>
              <Link href={href}>
                <Icon className={cn('icon-md', color)} />
                <span className="text-xs">{label}</span>
              </Link>
            </Button>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
