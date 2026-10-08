'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import {
  BarChart3,
  Building,
  CalendarClock,
  FolderKanban,
  GraduationCap,
  LayoutGrid,
  MessageCircle,
  Plus,
  Rocket,
  Settings,
  UserPlus,
  Users,
} from 'lucide-react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { BilingualText } from '@/components/common/BilingualText';
import { RelativeTime } from '@/components/common/RelativeTime';
import { MetricTile } from '@/components/dashboard/MetricTile';
import { EmptyLine, QuickLinks, SectionCard } from '@/components/dashboard/SectionCard';
import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting';
import { useSession } from '@/hooks/useSession';
import { useCurrentOrg } from '@/hooks/useCurrentOrg';
import {
  getMeProfile,
  getOrgMentorPool,
  getProgramParticipants,
  listOrganizationPrograms,
  type ProgramItem,
} from '@/lib/api';
import { dashboardEl, dashboardEn } from '@/lib/i18n/strings-dashboard';
import { qk, queryKeys } from '@/lib/query-keys';
import { cn, formatRelativeTime, initialsOf } from '@/lib/utils';
import { WhatsNewPanel } from '@/components/dashboard/WhatsNewPanel';
import { useDateFormat } from '@/lib/i18n/useDateFormat';

/*
 * The organisation's home.
 *
 * Every figure here was a constant behind the sample-data switch: 3 programs,
 * 42 startups "+15% vs last cohort", 28 mentors, 12 applications, a 67%
 * average progress and an 85% graduation rate, with programs called "AI
 * Accelerator 2025" and startups (NeuralFlow, GreenGrid, PayFlow) that no
 * other page had heard of. Outside the showcase every one of them read 0.
 *
 * It now reads the same endpoints /org/programs, /org/applications,
 * /org/startups and /org/mentors list from - the organisation's programs,
 * their participants, its members and its mentor pool - so a figure here is
 * the length of a list one click away. "Coming up" is taken from the
 * programs' own dates rather than a milestone list nobody maintains.
 */

const DAY = 86_400_000;
const ENROLLED = new Set(['accepted', 'active', 'completed']);

const STATUS_BADGE: Record<string, { en: string; el: string; variant: 'success' | 'info' | 'secondary' | 'warning' }> = {
  active: { en: 'Running', el: 'Σε εξέλιξη', variant: 'success' },
  upcoming: { en: 'Upcoming', el: 'Προσεχές', variant: 'info' },
  completed: { en: 'Completed', el: 'Ολοκληρώθηκε', variant: 'secondary' },
  draft: { en: 'Draft', el: 'Πρόχειρο', variant: 'warning' },
  archived: { en: 'Archived', el: 'Αρχειοθετημένο', variant: 'secondary' },
};

/** "Founder at Taverna OS" names the startup; a participant row carries no other field for it. */
function startupOf(headline: string | null | undefined): string | null {
  const match = headline?.match(/\bat\s+(.+)$/i);
  return match ? match[1] : null;
}

function daysFromNow(iso: string | null, now: number): number | null {
  if (!iso) return null;
  return Math.round((Date.parse(iso) - now) / DAY);
}


export default function IncubatorDashboard() {
  const fmtDate = useDateFormat();
  const shortDate = (iso: string | null) => (iso ? fmtDate(iso, { day: 'numeric', month: 'short' }) : '—');
  const { hasSession, mounted } = useSession();
  const { membership, name: orgName, isLoading: orgLoading, isNone } = useCurrentOrg();
  const organizationId = membership?.organizationId ?? null;

  const { data: profile } = useQuery({
    queryKey: queryKeys.me.profile(),
    queryFn: getMeProfile,
    enabled: hasSession && mounted,
  });
  const displayName = profile?.profile?.displayName || 'Admin';

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

  const { data: mentorData } = useQuery({
    queryKey: qk('org', 'mentor-pool', organizationId),
    queryFn: () => getOrgMentorPool(organizationId!),
    enabled: Boolean(organizationId),
    staleTime: 60_000,
    retry: 0,
  });

  const now = Date.now();
  const rows = participantQueries.flatMap((q, i) =>
    (q.data?.participants ?? []).map((row) => ({ row, program: programs[i] as ProgramItem })),
  );
  const waiting = rows
    .filter(({ row }) => row.status === 'applied')
    .sort((a, b) => Date.parse(b.row.appliedAt) - Date.parse(a.row.appliedAt));
  const decided = rows.filter(({ row }) => row.status !== 'applied');
  const accepted = decided.filter(({ row }) => ENROLLED.has(row.status));
  const inPrograms = rows.filter(({ row, program }) => (row.status === 'active' || row.status === 'accepted') && program.status === 'active');
  const alumni = rows.filter(({ row }) => row.status === 'completed');

  const running = programs.filter((p) => p.status === 'active');
  const upcoming = programs.filter((p) => p.status === 'upcoming');
  const completed = programs.filter((p) => p.status === 'completed');
  const seats = running.reduce((s, p) => s + (p.capacity ?? 0), 0);
  const filled = running.reduce((s, p) => s + p.participantCount, 0);

  const mentors = mentorData?.mentors ?? [];
  const menteeSlots = mentors.reduce((s, m) => s + (m.maxMentees ?? 0), 0);
  const menteesTaken = mentors.reduce((s, m) => s + m.currentMentees, 0);

  const nextClose = programs
    .map((p) => ({ p, d: daysFromNow(p.applicationDeadline, now) }))
    .filter((x): x is { p: ProgramItem; d: number } => x.d != null && x.d >= 0)
    .sort((a, b) => a.d - b.d)[0];

  // Dates the programs themselves carry: applications closing, starts, and
  // the end of a running program (its demo day).
  const comingUp = programs
    .flatMap((p) => [
      { id: `${p.id}-close`, en: 'Applications close', el: 'Κλείνουν οι αιτήσεις', program: p, iso: p.applicationDeadline },
      { id: `${p.id}-start`, en: 'Program starts', el: 'Ξεκινά το πρόγραμμα', program: p, iso: p.startDate },
      { id: `${p.id}-end`, en: p.programType === 'accelerator' ? 'Demo day' : 'Program ends', el: p.programType === 'accelerator' ? 'Demo day' : 'Λήξη προγράμματος', program: p, iso: p.endDate },
    ])
    .map((x) => ({ ...x, days: daysFromNow(x.iso, now) }))
    .filter((x): x is typeof x & { days: number } => x.days != null && x.days >= 0)
    .sort((a, b) => a.days - b.days)
    .slice(0, 4);

  const loading = orgLoading || programsLoading;
  const acceptance = decided.length ? Math.round((accepted.length / decided.length) * 100) : null;
  const fill = seats ? Math.round((filled / seats) * 100) : null;

  if (!mounted) {
    return (
      <AppShell showHelp>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell showHelp
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1.5">
            <Building className="icon-sm" aria-hidden="true" />
            {orgName ?? 'Incubator admin'}
          </Badge>
          <Button size="sm" asChild>
            <Link href="/tenant/programs">
              <Plus className="mr-1.5 icon-sm" aria-hidden="true" />
              New program
            </Link>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <DashboardGreeting name={displayName} lead={{ en: dashboardEn('incubator_lead'), el: dashboardEl('incubator_lead') }} />
        <WhatsNewPanel audience="org" />

        {isNone && (
          <SectionCard title="No organisation yet" titleEl="Δεν υπάρχει οργανισμός ακόμα">
            <EmptyLine
              en="Programs, applications and cohorts appear here once your account belongs to an organisation."
              el="Προγράμματα, αιτήσεις και cohorts εμφανίζονται εδώ όταν ο λογαριασμός σας ανήκει σε οργανισμό."
            />
          </SectionCard>
        )}

        {/* Four figures, each the length of a list one click away. */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          <MetricTile
            icon={LayoutGrid}
            label="Running programs"
            labelEl="Ενεργά προγράμματα"
            value={loading ? '—' : running.length}
            caption={`${upcoming.length} upcoming · ${completed.length} completed`}
            captionEl={`${upcoming.length} προσεχώς · ${completed.length} ολοκληρωμένα`}
            href="/org/programs"
          />
          <MetricTile
            icon={Rocket}
            label="Startups in programs"
            labelEl="Startups σε προγράμματα"
            value={loading ? '—' : inPrograms.length}
            caption={`${alumni.length} alumni`}
            captionEl={`${alumni.length} απόφοιτοι`}
            href="/org/startups"
          />
          <MetricTile
            icon={GraduationCap}
            label="Mentors"
            labelEl="Μέντορες"
            value={mentorData ? mentors.length : '—'}
            caption={menteeSlots ? `${menteesTaken} of ${menteeSlots} mentee places taken` : 'Your mentor pool'}
            captionEl={menteeSlots ? `${menteesTaken} από ${menteeSlots} θέσεις καθοδηγούμενων` : 'Η ομάδα μεντόρων σας'}
            href="/org/mentors"
          />
          <MetricTile
            icon={UserPlus}
            label="Applications waiting"
            labelEl="Αιτήσεις σε αναμονή"
            value={loading ? '—' : waiting.length}
            caption={nextClose ? `${nextClose.p.title.split(' · ')[0]} closes in ${nextClose.d} days` : 'No round is open'}
            captionEl={nextClose ? `Κλείνει σε ${nextClose.d} ημέρες` : 'Κανένας γύρος ανοιχτός'}
            href="/org/applications"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Decisions first: each application waits on this organisation. */}
            <SectionCard
              title="Applications waiting"
              titleEl="Αιτήσεις σε αναμονή"
              icon={UserPlus}
              action={{ href: '/org/applications', label: 'All applications', labelEl: 'Όλες οι αιτήσεις' }}
              contentClassName="card-rows"
            >
              {loading && [0, 1].map((i) => <Skeleton key={i} className="h-16" />)}
              {waiting.slice(0, 5).map(({ row, program }) => {
                const name = row.user.profile?.displayName ?? 'Applicant';
                const startup = startupOf(row.user.profile?.headline);
                return (
                  <div key={row.id} className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="bg-muted text-foreground">{initialsOf(name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 basis-40">
                      <p className="truncate text-sm font-medium">
                        {startup ?? name}
                        {startup ? <span className="font-normal text-muted-foreground"> · {name}</span> : null}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {program.title} · <RelativeTime date={row.appliedAt} format={formatRelativeTime} />
                        {row.score != null ? ` · score ${row.score}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button size="sm" variant="outline" asChild>
                        <Link href="/org/applications">Review</Link>
                      </Button>
                      <Button size="icon" variant="ghost" aria-label={`Message ${name} to schedule a call`} asChild>
                        <Link href={`/messages?to=${row.userId}`}>
                          <MessageCircle className="icon-sm" aria-hidden="true" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
              {!loading && waiting.length === 0 && (
                <EmptyLine en="No application is waiting for a decision." el="Καμία αίτηση δεν περιμένει απόφαση." />
              )}
            </SectionCard>

            <SectionCard title="Programs" titleEl="Προγράμματα" icon={FolderKanban} action={{ href: '/org/programs', label: 'Manage', labelEl: 'Διαχείριση' }} contentClassName="card-rows">
              {loading && [0, 1].map((i) => <Skeleton key={i} className="h-20" />)}
              {programs.map((program) => {
                const badge = STATUS_BADGE[program.status] ?? STATUS_BADGE.draft;
                const pct = program.capacity ? Math.min(100, Math.round((program.participantCount / program.capacity) * 100)) : null;
                return (
                  <Link
                    key={program.id}
                    href={`/programs/${program.id}`}
                    className="axis-row block rounded-md transition-colors hover:bg-accent focus-ring"
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-medium">{program.title}</span>
                      <Badge size="sm" variant={badge.variant}><BilingualText en={badge.en} el={badge.el} compact /></Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <BilingualText en={`${shortDate(program.startDate)} – ${shortDate(program.endDate)} · ${program.applicationCount} applications`} el={`${shortDate(program.startDate)} – ${shortDate(program.endDate)} · ${program.applicationCount} αιτήσεις`} compact wrap />
                    </p>
                    {pct != null && (
                      <div className="mt-2 flex items-center gap-3">
                        <Progress value={pct} className="h-1.5 flex-1" aria-label={`${program.title}: ${program.participantCount} of ${program.capacity} places filled`} />
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {program.participantCount}/{program.capacity}
                        </span>
                      </div>
                    )}
                  </Link>
                );
              })}
              {!loading && programs.length === 0 && (
                <EmptyLine en="Create a program to start taking applications." el="Δημιουργήστε ένα πρόγραμμα για να δέχεστε αιτήσεις." />
              )}
            </SectionCard>

            <SectionCard title="Startups in programs" titleEl="Startups σε προγράμματα" icon={Rocket} action={{ href: '/org/startups', label: 'All startups', labelEl: 'Όλες οι startups' }} contentClassName="card-rows">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {inPrograms.map(({ row, program }) => {
                  const name = row.user.profile?.displayName ?? 'Founder';
                  const startup = startupOf(row.user.profile?.headline) ?? name;
                  return (
                    <div key={row.id} className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 shrink-0 rounded-lg">
                        <AvatarFallback className="rounded-lg bg-primary/10 font-semibold text-primary-accessible">{startup[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{startup}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {name} · {program.title.split(' · ')[0]}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {!loading && inPrograms.length === 0 && (
                <EmptyLine en="Accepted applicants appear here once their program starts." el="Οι αποδεκτοί εμφανίζονται εδώ όταν ξεκινά το πρόγραμμά τους." />
              )}
            </SectionCard>
          </div>

          <div className="space-y-6">
            <QuickLinks
              label="Organisation pages"
              links={[
                { href: '/tenant/programs', icon: Plus, label: 'Create program', labelEl: 'Νέο πρόγραμμα' },
                { href: '/org/applications', icon: UserPlus, label: 'Review applications', labelEl: 'Αξιολόγηση αιτήσεων' },
                { href: '/org/cohorts', icon: Users, label: 'Cohorts', labelEl: 'Cohorts' },
                { href: '/org/mentors', icon: GraduationCap, label: 'Manage mentors', labelEl: 'Μέντορες' },
                { href: '/org/analytics', icon: BarChart3, label: 'Cohort reports', labelEl: 'Αναφορές' },
                { href: '/org/settings', icon: Settings, label: 'Organisation settings', labelEl: 'Ρυθμίσεις οργανισμού' },
              ]}
            />

            <SectionCard title="Coming up" titleEl="Επόμενα" icon={CalendarClock} contentClassName="space-y-3">
              {comingUp.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">
                      <BilingualText en={item.en} el={item.el} />
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{item.program.title}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-medium tabular-nums">{shortDate(item.iso)}</p>
                    <p className={cn('text-xs tabular-nums', item.days <= 7 ? 'text-status-warning' : 'text-muted-foreground')}>
                      {item.days === 0
                        ? <BilingualText en="today" el="σήμερα" compact />
                        : <BilingualText en={`in ${item.days}d`} el={`σε ${item.days} ημ.`} compact />}
                    </p>
                  </div>
                </div>
              ))}
              {!loading && comingUp.length === 0 && (
                <EmptyLine en="No program date is ahead." el="Καμία ημερομηνία προγράμματος μπροστά." />
              )}
            </SectionCard>

            <SectionCard title="Program health" titleEl="Υγεία προγραμμάτων" contentClassName="space-y-4">
              {[
                { en: 'Places filled', el: 'Πληρότητα θέσεων', value: fill, detail: seats ? `${filled} of ${seats} in running programs` : null },
                { en: 'Acceptance rate', el: 'Ποσοστό αποδοχής', value: acceptance, detail: decided.length ? `${accepted.length} of ${decided.length} decided applications` : null },
              ].map((row) => (
                <div key={row.en} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">
                      <BilingualText en={row.en} el={row.el} />
                    </span>
                    <span className="font-semibold tabular-nums">{row.value == null ? '—' : `${row.value}%`}</span>
                  </div>
                  <Progress value={row.value ?? 0} className="h-1.5" aria-label={row.en} />
                  {row.detail ? <p className="text-xs text-muted-foreground">{row.detail}</p> : null}
                </div>
              ))}
              <p className="flex items-center gap-1.5 border-t border-border pt-3 text-sm">
                <GraduationCap className="icon-sm text-muted-foreground" aria-hidden="true" />
                <span className="tabular-nums">{alumni.length}</span>
                <BilingualText en="startups graduated" el="startups αποφοίτησαν" />
              </p>
            </SectionCard>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
