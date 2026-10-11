'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  MoreVertical,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useQuery } from '@tanstack/react-query';
import { useCurrentOrg } from '@/hooks/useCurrentOrg';
import { getOrgCohorts, getOrgMembers, type OrgMember } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyOrgStartups } from '@/components/common/EmptyStates';
import { CardHead } from '@/components/common/CardAnatomy';
import { FactLine } from '@/components/common/FactLine';
import { cn } from '@/lib/utils';
import { UnavailableMenuItem } from '@/components/common/UnavailableMenuItem';
import { STATUS, type StatusTone } from '@/lib/semantic-colors';
import { qk } from '@/lib/query-keys';
import { choiceControl, usePageControls, usePageList } from '@/lib/page-controls';
import { useDemoData } from '@/contexts/DemoDataContext';
import { BilingualText } from '@/components/common/BilingualText';
import { StatusText } from '@/components/common/StatusText';
import { bilingualInline } from '@/lib/i18n/format';

/**
 * The page's own row from the organisation's member list.
 *
 * There is no startup entity in the schema: an accelerator's cohort is made of
 * people, and `/api/org/:slug/members` is the list of them with the cohort
 * each belongs to. Four fields on the card have no source and admit it rather
 * than being filled — progress, team size, founding date and readiness are all
 * facts about a company the platform does not model yet.
 */
/** "Founder at Meltemi" names the startup; the member row carries no other field for it. */
function startupOf(headline: string | null | undefined): string | null {
  const match = headline?.match(/\bat\s+(.+)$/i);
  return match ? match[1] : null;
}

function toStartup(member: OrgMember, graduatedCohorts: ReadonlySet<string>): Startup {
  return {
    id: member.id,
    name: startupOf(member.headline) ?? member.displayName,
    logoUrl: member.avatarUrl ?? undefined,
    // The founder, and where they are: what the row actually knows.
    industry: member.displayName,
    stage: member.location ?? '\u2014',
    program: member.cohortName || '\u2014',
    cohort: member.cohortName || '\u2014',
    progress: null,
    teamSize: null,
    foundedAt: member.joinedAt,
    status: graduatedCohorts.has(member.cohortName) ? 'graduated' : 'active',
    readinessScore: null,
  };
}

type Startup = {
  id: string;
  name: string;
  logoUrl?: string;
  industry: string;
  stage: string;
  program: string;
  cohort: string;
  /** Null where the platform has no figure for a company (see toStartup). */
  progress: number | null;
  teamSize: number | null;
  foundedAt: string;
  status: 'active' | 'graduated' | 'paused' | 'dropped';
  readinessScore: number | null;
};

const STARTUP_STATUS_TONE: Record<Startup['status'], StatusTone> = {
  active: 'success',
  graduated: 'info',
  paused: 'warning',
  dropped: 'danger',
};

function StartupCard({ startup }: { startup: Startup }) {
  const statusColors = STATUS[STARTUP_STATUS_TONE[startup.status]];

  // The Programs card: the startup's rounded square, its name over sector
  // and stage, the state and the menu at the right; the facts and the
  // progress start on the mark's edge.
  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Open actions for ${startup.name}`}>
          <MoreVertical className="icon-sm" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/profiles/${startup.id}`}><BilingualText en="View Details" el="Λεπτομέρειες" compact /></Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/builder"><BilingualText en="Open Workspace" el="Άνοιγμα χώρου εργασίας" compact /></Link>
        </DropdownMenuItem>
        {/* A cohort "startup" is its member (id = user id, see
            toStartup), so details are their profile and a message
            opens a thread with them. Both links pointed at
            /org/startups/:id, which never existed. */}
        <UnavailableMenuItem
          en="Assign Mentor"
          el="Ανάθεση μέντορα"
          reasonEn="Mentor assignments are not stored yet."
          reasonEl="Οι αναθέσεις μεντόρων δεν αποθηκεύονται ακόμη."
        />
        <DropdownMenuItem asChild>
          <Link href={`/messages?to=${startup.id}`}><BilingualText en="Send Message" el="Αποστολή μηνύματος" compact /></Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <Card className="transition-all hover:border-primary/30">
      <CardContent className="space-y-3">
        <CardHead
          mark={(
            <Link href={`/profiles/${startup.id}`} aria-label={bilingualInline(`Open ${startup.name}`, `Άνοιγμα: ${startup.name}`)}>
              <Avatar className="h-10 w-10 rounded-xl">
                <AvatarImage src={startup.logoUrl} alt="" />
                <AvatarFallback className="rounded-xl bg-primary/10 font-semibold text-primary-accessible">
                  {startup.name?.[0]?.toUpperCase() ?? '?'}
                </AvatarFallback>
              </Avatar>
            </Link>
          )}
          title={(
            <Link href={`/profiles/${startup.id}`} className="transition-colors hover:text-primary-accessible">
              {startup.name}
            </Link>
          )}
          subtitle={(
            <FactLine
              className="text-sm"
              items={[
                startup.industry,
                startup.stage && startup.stage !== '\u2014' ? startup.stage : null,
              ]}
            />
          )}
          asideStays
          aside={(
            <>
              <Badge variant="outline" className={cn('text-xs border', statusColors.chip)}>
                <StatusText value={startup.status} />
              </Badge>
              {menu}
            </>
          )}
        />

        <FactLine
          items={[
            startup.program !== '\u2014' ? startup.program : null,
            startup.teamSize != null ? (
              <BilingualText key="team" en={`${startup.teamSize} members`} el={`${startup.teamSize} μέλη`} compact />
            ) : null,
            startup.cohort !== startup.program && startup.cohort !== '\u2014' ? startup.cohort : null,
            startup.readinessScore != null ? (
              <BilingualText key="readiness" en={`Readiness ${startup.readinessScore}%`} el={`Ετοιμότητα ${startup.readinessScore}%`} compact />
            ) : null,
          ]}
        />

        {startup.progress != null && (
          <div>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground"><BilingualText en="Progress" el="Πρόοδος" compact /></span>
              <span className="font-medium tabular-nums">{startup.progress}%</span>
            </div>
            <Progress value={startup.progress} className="h-1.5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Shown to an organisation whose cohorts are still empty. */
const SEED_STARTUPS: Startup[] = [
  {
    id: '1',
    name: 'NeuralFlow',
    industry: 'AI/ML',
    stage: 'Seed',
    program: 'AI Accelerator',
    cohort: 'Cohort 3',
    progress: 85,
    teamSize: 4,
    foundedAt: '2024',
    status: 'active',
    readinessScore: 78,
  },
  {
    id: '2',
    name: 'GreenGrid',
    industry: 'CleanTech',
    stage: 'Pre-seed',
    program: 'Climate Innovation',
    cohort: 'Cohort 2',
    progress: 72,
    teamSize: 3,
    foundedAt: '2024',
    status: 'active',
    readinessScore: 65,
  },
  {
    id: '3',
    name: 'PayFlow',
    industry: 'FinTech',
    stage: 'Seed',
    program: 'FinTech Bootcamp',
    cohort: 'Spring 2024',
    progress: 100,
    teamSize: 5,
    foundedAt: '2023',
    status: 'graduated',
    readinessScore: 92,
  },
  {
    id: '4',
    name: 'HealthSync',
    industry: 'HealthTech',
    stage: 'Idea',
    program: 'AI Accelerator',
    cohort: 'Cohort 3',
    progress: 45,
    teamSize: 2,
    foundedAt: '2024',
    status: 'active',
    readinessScore: 42,
  },
];

export default function OrgStartupsPage() {
  // Illustrative rows are for the showcase; a real account with nothing
  // to list sees the page's empty state, not invented people and records.
  const { showDemoData } = useDemoData();
  const [search, setSearch] = useState('');
  const [program, setProgram] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');

  /*
   * The organisation's cohort members. The seed below is what an
   * organisation with an empty cohort sees, so the screen still teaches its
   * shape rather than opening blank.
   */
  const { slug } = useCurrentOrg();
  const { data, isLoading } = useQuery({
    queryKey: qk('org', 'members', slug),
    queryFn: () => getOrgMembers(slug!, { limit: 100 }),
    enabled: Boolean(slug),
    staleTime: 60_000,
    retry: 0,
  });

  // A member of a cohort that has ended has graduated from it.
  const { data: cohortData } = useQuery({
    queryKey: qk('org', 'cohorts', slug),
    queryFn: () => getOrgCohorts(slug!),
    enabled: Boolean(slug),
    staleTime: 60_000,
    retry: 0,
  });
  const graduatedCohorts = useMemo(
    () => new Set<string>((cohortData?.cohorts ?? []).filter((c) => !c.isActive && c.endDate && Date.parse(c.endDate) < Date.now()).map((c) => c.name)),
    [cohortData],
  );
  // Cohort members include the cohort's mentors and investors (the API
  // returns every member with the user's role); a portfolio is its founders.
  const live = useMemo(
    () => (data?.members ?? []).filter((m) => m.role === 'founder').map((m) => toStartup(m, graduatedCohorts)),
    [data, graduatedCohorts],
  );
  const startups: Startup[] = live.length > 0 ? live : isLoading || !showDemoData ? [] : SEED_STARTUPS;


  const scored = startups.filter((s) => s.readinessScore != null);
  const filteredStartups = startups.filter((s) => {
    const matchesSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.industry.toLowerCase().includes(search.toLowerCase());
    const matchesProgram = program === 'all' || s.program === program;
    const matchesStatus = status === 'all' || s.status === status;
    return matchesSearch && matchesProgram && matchesStatus;
  });

  const programs = [...new Set(startups.map((s) => s.program))];

  const filtersActive = !!search || program !== 'all' || status !== 'all';
  const clearFilters = () => { setSearch(''); setProgram('all'); setStatus('all'); };

  usePageList([
    {
      id: 'startups',
      labelEn: 'Portfolio startups',
      labelEl: 'Startups οργανισμού',
      rows: isLoading ? undefined : filteredStartups.map((s) => `${s.name} · ${s.industry}, ${s.stage} · ${s.program} · ${s.status} · progress ${s.progress}%`),
      total: startups.length,
      sample: live.length === 0,
    },
  ]);
  usePageControls([
    choiceControl('program_filter', 'Program filter', 'Φίλτρο προγράμματος', [{ value: 'all', en: 'All programs', el: 'Όλα τα προγράμματα' }, ...programs.map((p) => ({ value: p, en: p, el: p }))], program, setProgram),
    choiceControl('status_filter', 'Status filter', 'Φίλτρο κατάστασης', [
      { value: 'all', en: 'All statuses', el: 'Όλες οι καταστάσεις' },
      { value: 'active', en: 'Active', el: 'Ενεργές' },
      { value: 'graduated', en: 'Graduated', el: 'Αποφοιτήσασες' },
      { value: 'paused', en: 'Paused', el: 'Σε παύση' },
      { value: 'dropped', en: 'Dropped', el: 'Αποχωρήσασες' },
    ], status, setStatus),
    { id: 'clear_filters', labelEn: 'Clear the startup filters', labelEl: 'Καθαρισμός φίλτρων startups', writes: false, unavailableEn: filtersActive ? undefined : 'No filter is set.', unavailableEl: filtersActive ? undefined : 'Δεν υπάρχει φίλτρο.', run: clearFilters },
  ]);

  return (
    <AppShell showHelp
      title="Portfolio Startups"
      description="Startups currently in your programs and graduates. Track readiness, milestones, and program assignment."
      descriptionEl="Νεοφυείς που συμμετέχουν στα προγράμματά σας και απόφοιτοι. Παρακολουθήστε ετοιμότητα, ορόσημα και ανάθεση προγράμματος."
      actions={(
        <Button asChild>
          <Link href="/org/applications">
            <BilingualText en="Review Applications" el="Έλεγχος αιτήσεων" compact />
          </Link>
        </Button>
      )}
    >
      <div className="space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 kpi-odd-span-md gap-4 md:grid-cols-4">
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground"><BilingualText en="Total Startups" el="Σύνολο startups" compact /></p>
              <p className="page-stat text-xl font-bold">{startups.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground"><BilingualText en="Active" el="Ενεργά" compact /></p>
              <p className={cn('page-stat text-xl font-bold', STATUS.success.icon)}>
                {startups.filter((s) => s.status === 'active').length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground"><BilingualText en="Graduated" el="Αποφοίτησαν" compact /></p>
              <p className={cn('page-stat text-xl font-bold', STATUS.info.icon)}>
                {startups.filter((s) => s.status === 'graduated').length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground"><BilingualText en="Avg. Readiness" el="Μέση ετοιμότητα" compact /></p>
              <p className="page-stat text-xl font-bold">
                {scored.length ? `${Math.round(scored.reduce((acc, s) => acc + (s.readinessScore ?? 0), 0) / scored.length)}%` : '\u2014'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" aria-hidden="true" />
            <Input
              aria-label={bilingualInline("Search startups", "Αναζήτηση startups")}
              placeholder={bilingualInline("Search startups…", "Αναζήτηση startups…")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={program} onValueChange={setProgram}>
            <SelectTrigger aria-label="Program" className="w-full sm:w-[200px]">
              <SelectValue placeholder={bilingualInline("Program", "Πρόγραμμα")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all"><BilingualText en="All Programs" el="Όλα τα προγράμματα" compact /></SelectItem>
              {programs.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label="Status" className="w-full sm:w-[150px]">
              <SelectValue placeholder={bilingualInline("Status", "Κατάσταση")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all"><BilingualText en="All Status" el="Όλες οι καταστάσεις" compact /></SelectItem>
              <SelectItem value="active"><BilingualText en="Active" el="Ενεργά" compact /></SelectItem>
              <SelectItem value="graduated"><BilingualText en="Graduated" el="Αποφοίτησαν" compact /></SelectItem>
              <SelectItem value="paused"><BilingualText en="Paused" el="Σε παύση" compact /></SelectItem>
              <SelectItem value="dropped"><BilingualText en="Dropped" el="Αποχώρησαν" compact /></SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results */}
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            <BilingualText
              en={`${filteredStartups.length} startup${filteredStartups.length !== 1 ? 's' : ''}`}
              el={`${filteredStartups.length} ${filteredStartups.length !== 1 ? 'startups' : 'startup'}`}
              compact
            />
          </p>
          {filteredStartups.map((startup) => (
            <StartupCard key={startup.id} startup={startup} />
          ))}
          {filteredStartups.length === 0 && (
            <EmptyOrgStartups filtersActive={filtersActive} onClearFilters={clearFilters} />
          )}
        </div>
      </div>
    </AppShell>
  );
}
