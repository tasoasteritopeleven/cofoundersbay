'use client';


import { StatusText } from '@/components/common/StatusText';
import { BilingualText } from '@/components/common/BilingualText';
import Link from 'next/link';
import {
  Building2,
  Users,
  Award,
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
import { EmptyLine, RowHead, SectionCard } from '@/components/dashboard/SectionCard';
import { FactLine } from '@/components/common/FactLine';
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
    workshop: event.eventType === 'workshop',
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
            <Link href="/tenant/branding"><Building2 className="mr-1.5 icon-sm" /> <BilingualText en="Branding" el="Ταυτότητα" compact /></Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/tenant/settings"><Settings className="mr-1.5 icon-sm" /> <BilingualText en="Settings" el="Ρυθμίσεις" compact /></Link>
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
                  <RowHead
                    className="mb-2"
                    title={program.title}
                    subtitle={(
                      <FactLine
                        className="tabular-nums"
                        items={[
                          <BilingualText key="places" en={`${program.participantCount}/${program.capacity ?? '—'} places`} el={`${program.participantCount}/${program.capacity ?? '—'} θέσεις`} compact />,
                          <BilingualText key="applications" en={`${program.applicationCount} applications`} el={`${program.applicationCount} αιτήσεις`} compact />,
                        ]}
                      />
                    )}
                    aside={<Badge size="sm" variant={program.status === 'active' ? 'success' : 'info'}>{program.status === 'active' ? <BilingualText en="Running" el="Σε εξέλιξη" compact /> : <BilingualText en="Upcoming" el="Προσεχές" compact />}</Badge>}
                  />
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
              <RowHead
                key={member.id}
                mark={(
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.avatarUrl} alt="" />
                    <AvatarFallback className="bg-primary/10 font-semibold text-primary-accessible">{initialsOf(member.name)}</AvatarFallback>
                  </Avatar>
                )}
                title={member.name}
                subtitle={<StatusText value={member.role} />}
                asideStays
                aside={<RelativeTime date={member.joinedAt} format={formatRelativeTime} />}
              />
            ))}
            {membersData && recentMembers.length === 0 && (
              <EmptyLine en="Invite someone to see them here." el="Προσκαλέστε κάποιον για να εμφανιστεί εδώ." />
            )}
          </SectionCard>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SectionCard title="Member growth" titleEl="Αύξηση μελών" contentClassName="space-y-2">
            <MemberGrowthChart data={memberGrowth} />
            <p className="text-xs text-muted-foreground"><BilingualText en="Members at the end of each of the last six months, from join dates." el="Μέλη στο τέλος καθενός από τους τελευταίους έξι μήνες, από τις ημερομηνίες ένταξης." wrap /></p>
          </SectionCard>
          <SectionCard title="Applications and places" titleEl="Αιτήσεις και θέσεις" contentClassName="space-y-2">
            <ProgramEngagementChart data={engagement} />
            <p className="text-xs text-muted-foreground">
              {/* The legend of the chart's two series, in their colours. */}
              <span className="font-medium text-primary-accessible"><BilingualText en="Applications" el="Αιτήσεις" compact /></span>
              {' · '}
              <span className="font-medium text-status-success"><BilingualText en="Places filled" el="Καλυμμένες θέσεις" compact /></span>
              {' · '}
              <BilingualText en="Per running or upcoming program" el="Ανά πρόγραμμα σε εξέλιξη ή προσεχές" compact wrap />
            </p>
          </SectionCard>
        </div>

        <SectionCard title="Upcoming events" titleEl="Επόμενες εκδηλώσεις" action={{ href: '/events/create', label: 'Add event', labelEl: 'Νέα εκδήλωση' }}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {upcomingEvents.map((event) => (
              <RowHead
                key={event.id}
                title={event.name}
                subtitle={(
                  <FactLine
                    items={[
                      event.date,
                      event.workshop ? <BilingualText key="kind" en="Session" el="Συνεδρία" compact /> : <BilingualText key="kind" en="Event" el="Εκδήλωση" compact />,
                    ]}
                  />
                )}
              />
            ))}
          </div>
          {eventsData && upcomingEvents.length === 0 && (
            <EmptyLine en="No event is on the calendar." el="Καμία εκδήλωση στο ημερολόγιο." />
          )}
        </SectionCard>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Invite Members', labelEl: 'Πρόσκληση μελών', icon: UserPlus, href: '/tenant/members', color: 'text-status-info' },
            { label: 'Manage Programs', labelEl: 'Διαχείριση προγραμμάτων', icon: Award, href: '/tenant/programs', color: 'text-status-accent' },
            { label: 'View Analytics', labelEl: 'Αναλύσεις', icon: Activity, href: '/tenant/analytics', color: 'text-status-success' },
            { label: 'Branding', labelEl: 'Ταυτότητα', icon: Building2, href: '/tenant/branding', color: 'text-status-warning' },
          ].map(({ label, labelEl, icon: Icon, href, color }) => (
            <Button key={label} variant="outline" className="h-auto py-3 flex-col gap-1.5" asChild>
              <Link href={href}>
                <Icon className={cn('icon-md', color)} />
                <span className="text-xs"><BilingualText en={label} el={labelEl} compact wrap /></span>
              </Link>
            </Button>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
