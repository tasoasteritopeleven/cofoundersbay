'use client';

import { useMemo, useState } from 'react';
import { Award, CalendarCheck, Rocket, Users } from 'lucide-react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BilingualText } from '@/components/common/BilingualText';
import { MetricTile } from '@/components/dashboard/MetricTile';
import { EmptyLine, SectionCard } from '@/components/dashboard/SectionCard';
import { useTenant } from '@/components/providers/TenantContext';
import { useCurrentOrg } from '@/hooks/useCurrentOrg';
import {
  getOrgCohortDetail,
  getOrgCohorts,
  getProgramParticipants,
  getTenantMembers,
  listEvents,
  listOrganizationPrograms,
} from '@/lib/api';
import { choiceControl, usePageControls, usePageList } from '@/lib/page-controls';
import { qk } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { bilingualInline } from '@/lib/i18n/format';
import { useDateFormat } from '@/lib/i18n/useDateFormat';

/*
 * Workspace analytics, counted.
 *
 * The member count and the role split were live; the rest was written in: a
 * programme table of 2024-25 accelerators, a growth series that stopped at
 * March with 156 members, and four engagement figures that were permanent
 * dashes. The role split also counted every plain "member" as a founder.
 *
 * Programmes, their participants and each cohort's sessions are read from
 * the organisation that owns the workspace (the lists /tenant/programs and
 * /org/cohorts show); growth comes from join dates; and the period selector,
 * which changed nothing, sets the window for what happens over time.
 */

const PERIODS = [
  { value: '7d', en: 'Last 7 days', el: 'Τελευταίες 7 ημέρες', days: 7 },
  { value: '30d', en: 'Last 30 days', el: 'Τελευταίες 30 ημέρες', days: 30 },
  { value: '90d', en: 'Last 90 days', el: 'Τελευταίες 90 ημέρες', days: 90 },
  { value: '1y', en: 'Last year', el: 'Τελευταίο έτος', days: 365 },
] as const;

const DAY = 86_400_000;

export default function TenantAnalyticsPage() {
  const fmtDate = useDateFormat();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['value']>('30d');
  const windowDays = PERIODS.find((p) => p.value === period)?.days ?? 30;
  const { activeTenant } = useTenant();
  const tenantId = activeTenant?.id ?? null;
  const { slug, membership } = useCurrentOrg();
  const organizationId = membership?.organizationId ?? null;

  const { data, isLoading: membersLoading } = useQuery({
    queryKey: qk('tenant', 'members', tenantId),
    queryFn: () => getTenantMembers(tenantId!, { limit: 500 }),
    enabled: Boolean(tenantId),
    staleTime: 60_000,
    retry: 0,
  });
  const { data: programData, isLoading: programsLoading } = useQuery({
    queryKey: qk('programs', 'organization', organizationId),
    queryFn: () => listOrganizationPrograms(organizationId!),
    enabled: Boolean(organizationId),
    staleTime: 60_000,
    retry: 0,
  });
  const programs = useMemo(() => programData ?? [], [programData]);
  const participantQueries = useQueries({
    queries: programs.map((program) => ({
      queryKey: qk('org', 'participants', program.id),
      queryFn: () => getProgramParticipants(program.id),
      staleTime: 60_000,
      retry: 0,
    })),
  });
  const { data: cohortsData } = useQuery({
    queryKey: qk('org', 'cohorts', slug),
    queryFn: () => getOrgCohorts(slug!, { limit: 50 }),
    enabled: Boolean(slug),
    staleTime: 60_000,
    retry: 0,
  });
  const cohorts = useMemo(() => cohortsData?.cohorts ?? [], [cohortsData]);
  const cohortQueries = useQueries({
    queries: cohorts.map((cohort) => ({
      queryKey: qk('org', slug, 'cohort', cohort.id),
      queryFn: () => getOrgCohortDetail(slug!, cohort.id),
      enabled: Boolean(slug),
      staleTime: 60_000,
      retry: 0,
    })),
  });
  const { data: eventsData } = useQuery({
    queryKey: qk('events', 'tenant'),
    queryFn: () => listEvents({ scope: 'upcoming', limit: 5 }),
    staleTime: 60_000,
    retry: 0,
  });

  const members = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const now = Date.now();
  const inWindow = (iso: string) => {
    const age = now - Date.parse(iso);
    return age >= 0 && age <= windowDays * DAY;
  };

  const joinedInWindow = members.filter((m) => inWindow(m.joinedAt)).length;
  const founders = members.filter((m) => m.role === 'founder').length;
  const sessions = cohortQueries.flatMap((q) => q.data?.sessions ?? []);
  const heldInWindow = sessions.filter((s) => s.status === 'completed' && inWindow(s.scheduledAt)).length;
  const ahead = sessions.filter((s) => s.status === 'scheduled' && Date.parse(s.scheduledAt) >= now).length;
  const participantRows = participantQueries.flatMap((q, i) => (q.data?.participants ?? []).map((row) => ({ row, program: programs[i] })));
  const waiting = participantRows.filter(({ row }) => row.status === 'applied').length;
  const programsRun = programs.filter((p) => p.status === 'active' || p.status === 'completed').length;

  const programPerformance = programs
    .filter((p) => p.status !== 'draft' && p.status !== 'archived')
    .map((p, i) => {
      const rows = participantQueries[programs.indexOf(p)]?.data?.participants ?? [];
      const graduated = rows.filter((r) => r.status === 'completed').length;
      return {
        key: `${p.id}-${i}`,
        name: p.title,
        status: p.status,
        enrolled: p.participantCount,
        capacity: p.capacity,
        applications: p.applicationCount,
        graduated,
        fill: p.capacity ? Math.min(100, Math.round((p.participantCount / p.capacity) * 100)) : 0,
      };
    });

  const distribution = useMemo(() => {
    const buckets: Array<[string, string, (role: string) => boolean]> = [
      ['Founders', 'Ιδρυτές', (r) => r === 'founder'],
      ['Mentors', 'Μέντορες', (r) => r === 'mentor'],
      ['Investors', 'Επενδυτές', (r) => r === 'investor'],
      ['Team', 'Ομάδα', (r) => r === 'owner' || r === 'admin' || r === 'member'],
    ];
    const counted = buckets.map(([en, el, match]) => ({ en, el, count: members.filter((m) => match(m.role)).length }));
    const other = members.length - counted.reduce((sum, b) => sum + b.count, 0);
    return [...counted, ...(other > 0 ? [{ en: 'Other', el: 'Άλλοι', count: other }] : [])].map((b) => ({
      ...b,
      percentage: members.length ? Math.round((b.count / members.length) * 100) : 0,
    }));
  }, [members]);

  // Members at the end of each of the last six months, from join dates.
  const growth = Array.from({ length: 6 }, (_, i) => {
    const end = new Date(now);
    end.setDate(1);
    end.setHours(0, 0, 0, 0);
    end.setMonth(end.getMonth() - (5 - i) + 1);
    const cutoff = Math.min(end.getTime(), now + 1);
    return {
      month: fmtDate(end.getTime() - 1, { month: 'short' }),
      count: members.filter((m) => Date.parse(m.joinedAt) < cutoff).length,
    };
  });
  const maxGrowth = Math.max(1, ...growth.map((g) => g.count));

  const periodLabel = PERIODS.find((p) => p.value === period);
  usePageList([
    {
      id: 'tenant_programs',
      labelEn: 'Program performance',
      labelEl: 'Απόδοση προγραμμάτων',
      rows: programsLoading ? undefined : programPerformance.map((p) => `${p.name} · ${p.status} · ${p.enrolled}/${p.capacity ?? '—'} places · ${p.graduated} graduated · ${p.applications} applications`),
    },
  ]);
  usePageControls([
    choiceControl('period', 'Analytics period', 'Περίοδος αναλυτικών', PERIODS.map((p) => ({ value: p.value, en: p.en, el: p.el })), period, (v) => setPeriod(v as typeof period)),
  ]);

  return (
    <AppShell
      title="Analytics"
      titleEl="Αναλυτικά"
      description="Member growth, engagement, and program activity. Filter by time range to compare periods."
      descriptionEl="Αύξηση μελών, συμμετοχή και δραστηριότητα προγραμμάτων. Φιλτράρετε ανά χρονικό διάστημα για να συγκρίνετε περιόδους."
      actions={(
        <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
          <SelectTrigger aria-label="Time period" className="w-[150px]">
            <SelectValue placeholder={bilingualInline("Time period", "Χρονική περίοδος")} />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.en}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          <MetricTile
            icon={Users}
            label="Members"
            labelEl="Μέλη"
            value={data ? members.length : '—'}
            caption={`${joinedInWindow} joined, ${periodLabel?.en.toLowerCase()}`}
            captionEl={`${joinedInWindow} νέα, ${periodLabel?.el.toLowerCase()}`}
            href="/tenant/members"
          />
          <MetricTile icon={Rocket} label="Founders" labelEl="Ιδρυτές" value={data ? founders : '—'} caption="Members with the founder role" captionEl="Μέλη με ρόλο ιδρυτή" href="/tenant/members" />
          <MetricTile icon={Award} label="Programs run" labelEl="Προγράμματα" value={programData ? programsRun : '—'} caption={`${programs.filter((p) => p.status === 'upcoming').length} upcoming`} captionEl={`${programs.filter((p) => p.status === 'upcoming').length} προσεχώς`} href="/tenant/programs" />
          <MetricTile
            icon={CalendarCheck}
            label="Mentor sessions"
            labelEl="Συνεδρίες μεντόρων"
            value={cohortsData ? heldInWindow : '—'}
            caption={`held, ${periodLabel?.en.toLowerCase()}`}
            captionEl={`πραγματοποιήθηκαν, ${periodLabel?.el.toLowerCase()}`}
            href="/org/cohorts"
          />
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <SectionCard title="Program performance" titleEl="Απόδοση προγραμμάτων" action={{ href: '/tenant/programs', label: 'Programs', labelEl: 'Προγράμματα' }} contentClassName="space-y-4">
            {programsLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}
            {programPerformance.map((program) => (
              <div key={program.key} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium">{program.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {program.enrolled}/{program.capacity ?? '—'} places
                  </span>
                </div>
                <Progress value={program.fill} className="h-1.5" aria-label={`${program.name}: ${program.fill}% of places filled`} />
                <p className="text-xs tabular-nums text-muted-foreground">
                  {program.applications} applications · {program.graduated} graduated
                </p>
              </div>
            ))}
            {!programsLoading && programPerformance.length === 0 && (
              <EmptyLine en="Programs appear here once one is published." el="Τα προγράμματα εμφανίζονται μόλις δημοσιευτεί ένα." />
            )}
          </SectionCard>

          <SectionCard title="Member distribution" titleEl="Κατανομή μελών" action={{ href: '/tenant/members', label: 'Members', labelEl: 'Μέλη' }} contentClassName="space-y-3">
            {membersLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-8" />)}
            {distribution.map((item) => (
              <div key={item.en} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    <BilingualText en={item.en} el={item.el} />
                  </span>
                  <span className="font-medium tabular-nums">
                    {item.count} <span className="text-xs text-muted-foreground">({item.percentage}%)</span>
                  </span>
                </div>
                <Progress value={item.percentage} className="h-1.5" aria-label={`${item.en}: ${item.percentage}% of members`} />
              </div>
            ))}
            {!membersLoading && members.length === 0 && (
              <EmptyLine en="Invite members to see how the workspace is made up." el="Προσκαλέστε μέλη για να δείτε τη σύνθεση του χώρου." />
            )}
          </SectionCard>

          <SectionCard title="Engagement" titleEl="Συμμετοχή">
            <dl className="grid grid-cols-2 gap-3">
              {[
                { en: 'Sessions held', el: 'Συνεδρίες', value: cohortsData ? heldInWindow : '—', note: periodLabel?.en.toLowerCase() },
                { en: 'Sessions ahead', el: 'Προγραμματισμένες', value: cohortsData ? ahead : '—', note: 'scheduled' },
                { en: 'Upcoming events', el: 'Επόμενες εκδηλώσεις', value: eventsData ? (eventsData.events ?? []).length : '—', note: 'next on the calendar' },
                { en: 'Applications waiting', el: 'Αιτήσεις σε αναμονή', value: programData ? waiting : '—', note: 'for a decision' },
              ].map((cell) => (
                <div key={cell.en} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">
                    <BilingualText en={cell.en} el={cell.el} stacked wrap />
                  </dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums">{cell.value}</dd>
                  {cell.note ? <dd className="text-xs text-muted-foreground first-letter:uppercase">{cell.note}</dd> : null}
                </div>
              ))}
            </dl>
          </SectionCard>

          <SectionCard title="Member growth" titleEl="Αύξηση μελών" contentClassName="space-y-2.5">
            {growth.map((month, index) => {
              const prev = index > 0 ? growth[index - 1].count : null;
              const change = prev ? Math.round(((month.count - prev) / prev) * 100) : null;
              return (
                <div key={`${month.month}-${index}`} className="grid grid-cols-[2.5rem_1fr_3rem] items-center gap-3 text-sm">
                  <span className="font-medium">{month.month}</span>
                  <span className="relative h-6 overflow-hidden rounded bg-muted/40">
                    <span className="absolute inset-y-0 left-0 flex items-center justify-end rounded bg-primary/25 pr-2 text-xs font-medium tabular-nums" style={{ width: `${Math.max(8, (month.count / maxGrowth) * 100)}%` }}>
                      {month.count}
                    </span>
                  </span>
                  <span className={cn('text-right text-xs tabular-nums', change && change > 0 ? 'text-status-success' : 'text-muted-foreground')}>
                    {change == null ? '—' : change > 0 ? `+${change}%` : `${change}%`}
                  </span>
                </div>
              );
            })}
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
