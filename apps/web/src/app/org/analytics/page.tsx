'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CalendarCheck, Download, GraduationCap, RefreshCw, Rocket, UserPlus } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BilingualText } from '@/components/common/BilingualText';
import { MetricTile } from '@/components/dashboard/MetricTile';
import { EmptyLine, SectionCard } from '@/components/dashboard/SectionCard';
import { useCurrentOrg } from '@/hooks/useCurrentOrg';
import {
  getOrgCohortDetail,
  getOrgCohorts,
  getOrgMembers,
  getOrgMentorPool,
  getProgramParticipants,
  listOrganizationPrograms,
} from '@/lib/api';
import { downloadCsv } from '@/lib/csv';
import { choiceControl, usePageControls, usePageList } from '@/lib/page-controls';
import { qk } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { bilingualInline } from '@/lib/i18n/format';
import { useDateFormat } from '@/lib/i18n/useDateFormat';

const ChartFallback = () => <Skeleton className="h-[180px] w-full rounded-lg" />;
const PieFallback = () => <Skeleton className="h-[140px] w-[140px] rounded-full" />;
const ApplicationsTrendChart = dynamic(
  () => import('./OrgAnalyticsCharts').then((m) => ({ default: m.ApplicationsTrendChart })),
  { ssr: false, loading: ChartFallback },
);
const MentorSessionsChart = dynamic(
  () => import('./OrgAnalyticsCharts').then((m) => ({ default: m.MentorSessionsChart })),
  { ssr: false, loading: ChartFallback },
);
const IndustryPieChart = dynamic(
  () => import('./OrgAnalyticsCharts').then((m) => ({ default: m.IndustryPieChart })),
  { ssr: false, loading: PieFallback },
);

/*
 * Organisation analytics, counted.
 *
 * Four tiles were live and everything under them was a fixed illustration
 * behind a "sample data" note: an application trend peaking in March, 24
 * sessions a month, a 4.8 rating, 78% utilisation, an 8/15/12/5 stage split,
 * an AI/ML-led industry pie and a 120 -> 15 funnel through "Shortlisted" and
 * "Interviewed" steps the schema does not have. The period selector changed
 * nothing.
 *
 * Every panel now comes from the reads /org/programs, /org/applications,
 * /org/members, /org/mentors and /org/cohorts already make - programs, their
 * participants, the members, the mentor pool and each cohort's sessions - and
 * the period sets the window for the counts that happen over time. Stage and
 * industry are not recorded for a participant, so those two panels became
 * what is: members by role and founders by city.
 */

const PERIODS = [
  { value: '7d', en: 'Last 7 days', el: 'Τελευταίες 7 ημέρες', days: 7 },
  { value: '30d', en: 'Last 30 days', el: 'Τελευταίες 30 ημέρες', days: 30 },
  { value: '90d', en: 'Last 90 days', el: 'Τελευταίες 90 ημέρες', days: 90 },
  { value: '1y', en: 'Last year', el: 'Τελευταίο έτος', days: 365 },
  { value: 'all', en: 'All time', el: 'Όλη η περίοδος', days: Number.POSITIVE_INFINITY },
] as const;

const ENROLLED = new Set(['accepted', 'active', 'completed']);
const DAY = 86_400_000;

const SERIES_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--status-info-mark))',
  'hsl(var(--status-success-mark))',
  'hsl(var(--status-warning-mark))',
] as const;

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

export default function OrgAnalyticsPage() {
  const fmtDate = useDateFormat();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['value']>('30d');
  const windowDays = PERIODS.find((p) => p.value === period)?.days ?? 30;
  const { slug, membership } = useCurrentOrg();
  const organizationId = membership?.organizationId ?? null;
  const queryClient = useQueryClient();

  const { data: programsData, isLoading: programsLoading } = useQuery({
    queryKey: qk('programs', 'organization', organizationId),
    queryFn: () => listOrganizationPrograms(organizationId!),
    enabled: Boolean(organizationId),
    staleTime: 60_000,
    retry: 0,
  });
  const programs = useMemo(() => programsData ?? [], [programsData]);
  const participantQueries = useQueries({
    queries: programs.map((program) => ({
      queryKey: qk('org', 'participants', program.id),
      queryFn: () => getProgramParticipants(program.id),
      staleTime: 60_000,
      retry: 0,
    })),
  });
  const { data: membersData } = useQuery({
    queryKey: qk('org', 'members', slug),
    queryFn: () => getOrgMembers(slug!, { limit: 100 }),
    enabled: Boolean(slug),
    staleTime: 60_000,
    retry: 0,
  });
  const { data: mentorsData } = useQuery({
    queryKey: qk('org', 'mentor-pool', organizationId),
    queryFn: () => getOrgMentorPool(organizationId!),
    enabled: Boolean(organizationId),
    staleTime: 60_000,
    retry: 0,
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

  const now = Date.now();
  const inWindow = (iso: string | null | undefined) => {
    if (!iso) return false;
    const age = now - Date.parse(iso);
    return age >= 0 && age <= windowDays * DAY;
  };

  const participants = participantQueries.flatMap((q, i) =>
    (q.data?.participants ?? []).map((row) => ({ row, program: programs[i] })),
  );
  const sessions = cohortQueries.flatMap((q) => q.data?.sessions ?? []);
  const members = membersData?.members ?? [];
  const mentors = mentorsData?.mentors ?? [];

  // ── Figures ─────────────────────────────────────────────────────────────
  const inPrograms = participants.filter(({ row, program }) => (row.status === 'active' || row.status === 'accepted') && program?.status === 'active');
  const graduated = participants.filter(({ row }) => row.status === 'completed');
  const decided = participants.filter(({ row }) => row.status !== 'applied');
  const accepted = decided.filter(({ row }) => ENROLLED.has(row.status));
  const acceptance = decided.length ? Math.round((accepted.length / decided.length) * 100) : null;
  const appsInWindow = participants.filter(({ row }) => inWindow(row.appliedAt));
  const held = sessions.filter((s) => s.status === 'completed');
  const heldInWindow = held.filter((s) => inWindow(s.scheduledAt));
  const upcomingSessions = sessions.filter((s) => s.status === 'scheduled' && Date.parse(s.scheduledAt) >= now);
  const rated = held.filter((s) => s.rating != null);
  const avgRating = rated.length ? Math.round((rated.reduce((sum, s) => sum + (s.rating ?? 0), 0) / rated.length) * 10) / 10 : null;
  const slots = mentors.reduce((sum, m) => sum + (m.maxMentees ?? 0), 0);
  const taken = mentors.reduce((sum, m) => sum + m.currentMentees, 0);
  const activeMentors = mentors.filter((m) => m.currentMentees > 0).length;

  // ── Six months, oldest first ────────────────────────────────────────────
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now);
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    return d;
  });
  const trend = months.map((d) => ({
    month: fmtDate(d, { month: 'short' }),
    applications: participants.filter(({ row }) => monthKey(new Date(row.appliedAt)) === monthKey(d)).length,
    accepted: participants.filter(({ row }) => row.acceptedAt && monthKey(new Date(row.acceptedAt)) === monthKey(d)).length,
  }));
  const sessionsByMonth = months.map((d) => ({
    month: fmtDate(d, { month: 'short' }),
    sessions: sessions.filter((s) => monthKey(new Date(s.scheduledAt)) === monthKey(d)).length,
  }));
  const recentMonths = sessionsByMonth.slice(-3);
  const perMonth = Math.round(recentMonths.reduce((sum, m) => sum + m.sessions, 0) / recentMonths.length);

  // ── Who is in the organisation ──────────────────────────────────────────
  const byRole = (['founder', 'mentor', 'investor'] as const)
    .map((role, i) => ({ name: role[0].toUpperCase() + role.slice(1) + 's', value: members.filter((m) => m.role === role).length, color: SERIES_COLORS[i] }))
    .filter((r) => r.value > 0);
  const cities = Object.entries(
    members
      .filter((m) => m.role === 'founder')
      .reduce<Record<string, number>>((acc, m) => {
        const city = m.location?.split(',')[0]?.trim() || 'Unknown';
        acc[city] = (acc[city] ?? 0) + 1;
        return acc;
      }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const maxCity = Math.max(1, ...cities.map(([, n]) => n));

  const programMetrics = programs.map((program) => ({
    id: program.id,
    name: program.title,
    status: program.status,
    startups: program.participantCount,
    capacity: program.capacity,
    applications: program.applicationCount,
    fill: program.capacity ? Math.min(100, Math.round((program.participantCount / program.capacity) * 100)) : null,
  }));

  const funnel = [
    { label: 'Applications', labelEl: 'Αιτήσεις', value: participants.length, bar: 'bg-status-neutral-mark' },
    { label: 'Decided', labelEl: 'Με απόφαση', value: decided.length, bar: 'bg-status-warning-mark' },
    { label: 'Accepted', labelEl: 'Εγκρίθηκαν', value: accepted.length, bar: 'bg-status-info-mark' },
    { label: 'Graduated', labelEl: 'Αποφοίτησαν', value: graduated.length, bar: 'bg-status-success-mark' },
  ];

  const periodLabel = PERIODS.find((p) => p.value === period)?.en.toLowerCase() ?? '';
  const loading = programsLoading;
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: qk('org') });
    void queryClient.invalidateQueries({ queryKey: qk('programs') });
  };
  const exportCsv = () =>
    downloadCsv('org-analytics', ['section', 'name', 'value'], [
      ['summary', 'startups_in_programs', inPrograms.length],
      ['summary', 'graduated', graduated.length],
      ['summary', `applications_${period}`, appsInWindow.length],
      ['summary', `sessions_held_${period}`, heldInWindow.length],
      ['summary', 'acceptance_rate', acceptance ?? ''],
      ['mentors', 'active_mentors', activeMentors],
      ['mentors', 'mentee_places_taken', `${taken}/${slots}`],
      ['mentors', 'avg_session_rating', avgRating ?? ''],
      ...programMetrics.map((p) => ['program', p.name, `${p.startups}/${p.capacity ?? '-'} places, ${p.applications} applications`]),
      ...trend.map((t) => ['applications_by_month', t.month, `${t.applications} applied, ${t.accepted} accepted`]),
      ...sessionsByMonth.map((s) => ['sessions_by_month', s.month, s.sessions]),
      ...funnel.map((f) => ['funnel', f.label, f.value]),
    ]);

  usePageList([
    {
      id: 'org_programs',
      labelEn: 'Program performance',
      labelEl: 'Απόδοση προγραμμάτων',
      rows: loading ? undefined : programMetrics.map((p) => `${p.name} · ${p.status} · ${p.startups}/${p.capacity ?? '—'} places · ${p.applications} applications`),
    },
  ]);
  usePageControls([
    choiceControl('period', 'Analytics period', 'Περίοδος αναλυτικών', PERIODS.map((p) => ({ value: p.value, en: p.en, el: p.el })), period, (v) => setPeriod(v as typeof period)),
    { id: 'refresh', labelEn: 'Refresh the analytics', labelEl: 'Ανανέωση αναλυτικών', writes: false, run: refresh },
    { id: 'export', labelEn: 'Export the analytics as CSV', labelEl: 'Εξαγωγή αναλυτικών σε CSV', writes: false, run: exportCsv },
  ]);

  return (
    <AppShell showHelp
      title="Org Analytics"
      description="Cohort health, program impact, application funnel, and member growth in one dashboard."
      descriptionEl="Κατάσταση κοορτών, αντίκτυπος προγραμμάτων, ροή αιτήσεων και αύξηση μελών σε έναν πίνακα."
      actions={(
        <>
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
          <Button variant="outline" size="icon" title="Refresh" aria-label="Refresh" onClick={refresh}>
            <RefreshCw className="icon-sm" aria-hidden="true" />
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv}>
            <Download className="icon-sm" aria-hidden="true" /> Export
          </Button>
        </>
      )}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          <MetricTile
            icon={Rocket}
            label="Startups in programs"
            labelEl="Startups σε προγράμματα"
            value={loading ? '—' : inPrograms.length}
            caption={`${graduated.length} graduated`}
            captionEl={`${graduated.length} αποφοίτησαν`}
            href="/org/startups"
          />
          <MetricTile
            icon={UserPlus}
            label="Applications"
            labelEl="Αιτήσεις"
            value={loading ? '—' : appsInWindow.length}
            caption={periodLabel}
            captionEl={PERIODS.find((p) => p.value === period)?.el}
            href="/org/applications"
          />
          <MetricTile
            icon={CalendarCheck}
            label="Mentor sessions held"
            labelEl="Συνεδρίες μεντόρων"
            value={cohortsData ? heldInWindow.length : '—'}
            caption={`${upcomingSessions.length} scheduled ahead`}
            captionEl={`${upcomingSessions.length} προγραμματισμένες`}
            href="/org/cohorts"
          />
          <MetricTile
            icon={GraduationCap}
            label="Acceptance rate"
            labelEl="Ποσοστό αποδοχής"
            value={acceptance == null ? '—' : `${acceptance}%`}
            caption={decided.length ? `${accepted.length} of ${decided.length} decided` : 'No decisions yet'}
            captionEl={decided.length ? `${accepted.length} από ${decided.length} με απόφαση` : 'Καμία απόφαση ακόμα'}
            href="/org/applications"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <SectionCard title="Applications by month" titleEl="Αιτήσεις ανά μήνα" contentClassName="space-y-2">
            <ApplicationsTrendChart data={trend} />
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Applications</span> received and <span className="font-medium text-status-success">accepted</span> in each of the last six months.
            </p>
          </SectionCard>
          <SectionCard title="Mentor sessions by month" titleEl="Συνεδρίες ανά μήνα" contentClassName="space-y-2">
            <MentorSessionsChart data={sessionsByMonth} />
            <p className="text-xs text-muted-foreground">Held and scheduled sessions across every cohort.</p>
          </SectionCard>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <SectionCard title="Program performance" titleEl="Απόδοση προγραμμάτων" action={{ href: '/org/programs', label: 'Programs', labelEl: 'Προγράμματα' }} contentClassName="space-y-4">
            {loading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}
            {!loading && programMetrics.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No programmes yet. Each programme you run appears here with how full it is.{' '}
                <Link href="/org/programs" className="font-medium text-primary-accessible hover:underline">Create a programme</Link>
              </p>
            )}
            {programMetrics.map((program) => (
              <div key={program.id} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{program.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {program.startups}/{program.capacity ?? '—'} places · {program.applications} applied
                  </span>
                </div>
                <Progress value={program.fill ?? 0} className="h-1.5" aria-label={`${program.name}: ${program.fill ?? 0}% of places filled`} />
              </div>
            ))}
          </SectionCard>

          <SectionCard title="Mentor activity" titleEl="Δραστηριότητα μεντόρων" action={{ href: '/org/mentors', label: 'Mentors', labelEl: 'Μέντορες' }}>
            <dl className="grid grid-cols-2 gap-3">
              {[
                { en: 'Active mentors', el: 'Ενεργοί μέντορες', value: mentorsData ? `${activeMentors} of ${mentors.length}` : '—' },
                { en: 'Sessions a month', el: 'Συνεδρίες τον μήνα', value: cohortsData ? perMonth : '—', note: 'last three months' },
                { en: 'Average rating', el: 'Μέση βαθμολογία', value: avgRating == null ? '—' : avgRating.toFixed(1), note: rated.length ? `${rated.length} rated sessions` : undefined },
                { en: 'Places taken', el: 'Κατειλημμένες θέσεις', value: slots ? `${Math.round((taken / slots) * 100)}%` : '—', note: slots ? `${taken} of ${slots} mentee places` : undefined },
              ].map((cell) => (
                <div key={cell.en} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">
                    <BilingualText en={cell.en} el={cell.el} stacked wrap />
                  </dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums">{cell.value}</dd>
                  {cell.note ? <dd className="text-xs text-muted-foreground">{cell.note}</dd> : null}
                </div>
              ))}
            </dl>
          </SectionCard>

          <SectionCard title="Members by role" titleEl="Μέλη ανά ρόλο" action={{ href: '/org/members', label: 'Members', labelEl: 'Μέλη' }}>
            {byRole.length ? (
              <div className="flex items-center gap-4">
                <div inert>
                  <IndustryPieChart data={byRole} />
                </div>
                <ul className="flex-1 space-y-2">
                  {byRole.map((item) => (
                    <li key={item.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: item.color }} aria-hidden="true" />
                        <span className="text-muted-foreground">{item.name}</span>
                      </span>
                      <span className="font-medium tabular-nums">{item.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <EmptyLine en="Members appear once a cohort has started." el="Τα μέλη εμφανίζονται όταν ξεκινήσει ένα cohort." />
            )}
          </SectionCard>

          <SectionCard title="Founders by city" titleEl="Ιδρυτές ανά πόλη" contentClassName="space-y-3">
            {cities.map(([city, count]) => (
              <div key={city} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{city}</span>
                  <span className="font-medium tabular-nums">{count}</span>
                </div>
                <Progress value={(count / maxCity) * 100} className="h-1.5" aria-label={`${city}: ${count} founders`} />
              </div>
            ))}
            {cities.length === 0 && <EmptyLine en="No founder has joined a cohort yet." el="Κανένας ιδρυτής σε cohort ακόμα." />}
          </SectionCard>
        </div>

        <SectionCard title="Application funnel" titleEl="Χοάνη αιτήσεων" action={{ href: '/org/applications', label: 'Applications', labelEl: 'Αιτήσεις' }}>
          {/* Each bar is its step's share of the applications that entered;
              the right column is how many of the previous step went on. The
              steps are the statuses a participant row can have. */}
          <ol className="space-y-2.5">
            {funnel.map((step, index) => {
              const top = funnel[0]?.value || 1;
              const prev = index > 0 ? funnel[index - 1]?.value : undefined;
              return (
                <li key={step.label} className="grid grid-cols-[6.5rem_1fr_2.5rem_2.75rem] items-center gap-3 text-sm sm:grid-cols-[8rem_1fr_3rem_3rem]">
                  <span className="min-w-0 text-muted-foreground">
                    <BilingualText en={step.label} el={step.labelEl} stacked wrap />
                  </span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-muted/50" aria-hidden="true">
                    <span className={cn('block h-full rounded-full', step.bar)} style={{ width: `${Math.max(3, Math.round((step.value / top) * 100))}%` }} />
                  </span>
                  <span className="text-right font-semibold tabular-nums">{step.value}</span>
                  <span className="text-right text-xs tabular-nums text-muted-foreground">
                    {prev ? `${Math.round((step.value / prev) * 100)}%` : '—'}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="flex flex-wrap gap-2 pt-2">
            {programs.filter((p) => p.status === 'upcoming').map((p) => (
              <Badge key={p.id} variant="info" size="sm">
                <BilingualText en={`${p.title}: taking applications`} el={`${p.title}: δέχεται αιτήσεις`} compact />
              </Badge>
            ))}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
