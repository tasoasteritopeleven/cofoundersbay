'use client';

import { StatusText } from '@/components/common/StatusText';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listPrograms, deleteProgram, type ProgramItem } from '@/lib/api';
import { SampleDataNotice } from '@/components/common/SampleDataNotice';
import { UnavailableMenuItem } from '@/components/common/UnavailableMenuItem';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import Link from 'next/link';
import {
  Award,
  Search,
  Filter,
  Plus,
  MoreVertical,
  Users,
  Calendar,
  Building2,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  Download,
  CheckCircle2,
  CalendarClock,
  FileText,
  Archive,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { usePageRail } from '@/components/layout/PageRailContext';
import { BilingualText } from '@/components/common/BilingualText';
import { downloadCsv } from '@/lib/csv';
import { CANCELLED, choiceControl, ROW_GONE, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { STATUS, type StatusTone } from '@/lib/semantic-colors';
import { qk } from '@/lib/query-keys';
import { useDemoData } from '@/contexts/DemoDataContext';
import { bilingualInline } from '@/lib/i18n/format';
import { formatDate } from '@/lib/i18n/format';

type Program = {
  /** Set on live rows; the owning organisation's own programs page. */
  orgSlug?: string;
  description?: string;
  id: string;
  name: string;
  organization: string;
  type: string;
  status: 'draft' | 'upcoming' | 'active' | 'completed' | 'archived';
  startups: number;
  mentors: number;
  startDate: string;
  endDate: string;
  progress: number;
};

const PROGRAM_STATUS_TONE: Record<Program['status'], StatusTone> = {
  draft: 'neutral',
  upcoming: 'accent',
  active: 'success',
  completed: 'info',
  archived: 'warning',
};

/** Month and year, in the page's existing "Jan 2025" style. */
function monthYear(iso: string | null): string {
  if (!iso) return '\u2014';
  // Numeric month/year reads the same in both languages ("10/2026").
  return formatDate(iso, 'en', { month: '2-digit', year: 'numeric' });
}

/** Share of the programme's calendar that has elapsed, for the progress bar. */
function elapsed(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (!(b > a)) return 0;
  return Math.round(Math.min(1, Math.max(0, (Date.now() - a) / (b - a))) * 100);
}

function toProgram(p: ProgramItem): Program {
  // ProgramStatus has five values; `upcoming` used to fall through to "draft",
  // so a programme open for applications read as unpublished.
  const known: Program['status'][] = ['draft', 'upcoming', 'active', 'completed', 'archived'];
  return {
    id: p.id,
    name: p.title,
    organization: p.organization?.name ?? '\u2014',
    orgSlug: p.organization?.slug,
    description: p.description ?? undefined,
    type: p.programType,
    status: known.includes(p.status as Program['status']) ? (p.status as Program['status']) : 'draft',
    startups: p.participantCount ?? 0,
    mentors: 0,
    startDate: monthYear(p.startDate),
    endDate: monthYear(p.endDate),
    progress: elapsed(p.startDate, p.endDate),
  };
}

function ProgramCard({
  program,
  onView,
  onArchive,
}: {
  program: Program;
  onView: (p: Program) => void;
  onArchive: (p: Program) => void;
}) {
  const statusColors = STATUS[PROGRAM_STATUS_TONE[program.status]];

  return (
    <Card className="transition-all hover:border-primary/30">
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{program.name}</span>
              <Badge variant="outline" className={cn('text-xs border', statusColors.chip)}>
                <StatusText value={program.status} />
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <Building2 className="icon-sm" aria-hidden="true" />
              {program.organization}
            </div>
            <div className="flex flex-wrap gap-3 mt-3 text-sm text-muted-foreground">
              <Badge variant="secondary" className="text-xs"><StatusText value={program.type} /></Badge>
              <span className="flex items-center gap-1">
                <Users className="icon-sm" aria-hidden="true" />
                {program.startups} startups
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="icon-sm" aria-hidden="true" />
                {program.startDate} - {program.endDate}
              </span>
            </div>
            {program.status === 'active' && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground"><BilingualText en="Progress" el="Πρόοδος" compact /></span>
                  <span className="font-medium">{program.progress}%</span>
                </div>
                <Progress value={program.progress} className="h-2" />
              </div>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label="More options" variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="icon-sm" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* The three items here had no handler. */}
              <DropdownMenuItem onSelect={() => onView(program)}>
                <Eye className="mr-2 icon-sm" aria-hidden="true" />
                <BilingualText en="View Details" el="Λεπτομέρειες" compact />
              </DropdownMenuItem>
              {program.orgSlug ? (
                <DropdownMenuItem asChild>
                  <Link href={`/org/${program.orgSlug}/admin`}>
                    <Edit className="mr-2 icon-sm" aria-hidden="true" />
                    Edit in {program.organization}
                  </Link>
                </DropdownMenuItem>
              ) : (
                <UnavailableMenuItem
                  icon={<Edit className="mr-2 mt-0.5 icon-sm" aria-hidden="true" />}
                  en="Edit Program"
                  el="Επεξεργασία προγράμματος"
                  reasonEn="A sample row - live programs are edited by their organisation."
                  reasonEl="Δείγμα - τα πραγματικά προγράμματα τα επεξεργάζεται ο οργανισμός τους."
                />
              )}
              {program.status !== 'archived' && (
                <DropdownMenuItem className="text-destructive-accessible" onSelect={() => onArchive(program)}>
                  <Trash2 className="mr-2 icon-sm" aria-hidden="true" />
                  <BilingualText en="Archive" el="Αρχειοθέτηση" compact />
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

const STATUS_OPTIONS: { value: string; en: string; el: string }[] = [
  { value: 'all', en: 'Any status', el: 'Οποιαδήποτε κατάσταση' },
  { value: 'upcoming', en: 'Upcoming', el: 'Προσεχή' },
  { value: 'active', en: 'Active', el: 'Ενεργά' },
  { value: 'completed', en: 'Completed', el: 'Ολοκληρωμένα' },
  { value: 'draft', en: 'Draft', el: 'Πρόχειρα' },
  { value: 'archived', en: 'Archived', el: 'Αρχειοθετημένα' },
];

export default function AdminProgramsPage() {
  const { showDemoData } = useDemoData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const { openRailSection } = usePageRail();

  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const confirm = useConfirm();
  const [viewing, setViewing] = useState<Program | null>(null);

  // Programs are public reads; the list was a fixed array dated 2025 while
  // GET /programs served every organisation's programmes.
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: qk('programs', 'admin'),
    queryFn: () => listPrograms({ limit: 100 }),
    staleTime: 60_000,
    retry: 0,
  });
  const live = useMemo(() => (Array.isArray(data?.programs) ? data.programs : []).map(toProgram), [data]);
  const showingSample = !isLoading && live.length === 0;

  const archive = async (p: Program): Promise<PageControlRunResult> => {
    if (!p.orgSlug) {
      toastError('Nothing to archive', 'This is a sample row until the programs API returns programmes.');
      return { error: 'This is a sample row until the programs API returns programmes.' };
    }
    const ok = await confirm({
      title: <BilingualText en={`Archive ${p.name}?`} el={`Αρχειοθέτηση: ${p.name};`} />,
      description: <BilingualText en="The programme stops taking applications and leaves active lists. Archived programmes stay readable." el="Το πρόγραμμα σταματά να δέχεται αιτήσεις και φεύγει από τις ενεργές λίστες. Τα αρχειοθετημένα προγράμματα παραμένουν αναγνώσιμα." />,
      confirmLabel: <BilingualText en="Archive" el="Αρχειοθέτηση" compact />,
    });
    if (!ok) return CANCELLED;
    try {
      await deleteProgram(p.id);
      success('Programme archived', p.name);
    } catch (err) {
      // The service allows this only to members of the owning organisation
      // (ProgramService.delete -> checkMemberAccess), so say which rule it was.
      toastError(
        'Could not archive the programme',
        err instanceof Error && /403|forbidden|member/i.test(err.message)
          ? `Only members of ${p.organization} can archive it.`
          : err instanceof Error ? err.message : undefined,
      );
      return { error: err instanceof Error && err.message ? err.message : 'The programme could not be archived.' };
    } finally {
      void queryClient.invalidateQueries({ queryKey: qk('programs') });
    }
  };

  const sample: Program[] = [
    { id: '1', name: 'Spring Accelerator 2025', organization: 'TechHub', type: 'Accelerator', status: 'active', startups: 12, mentors: 8, startDate: 'Jan 2025', endDate: 'Apr 2025', progress: 65 },
    { id: '2', name: 'AI Innovation Lab', organization: 'AI Ventures', type: 'Innovation Lab', status: 'active', startups: 8, mentors: 5, startDate: 'Feb 2025', endDate: 'Aug 2025', progress: 30 },
    { id: '3', name: 'Pre-seed Bootcamp', organization: 'StartupU', type: 'Bootcamp', status: 'active', startups: 8, mentors: 4, startDate: 'Mar 2025', endDate: 'Mar 2025', progress: 90 },
    { id: '4', name: 'Fall Accelerator 2024', organization: 'TechHub', type: 'Accelerator', status: 'completed', startups: 10, mentors: 8, startDate: 'Sep 2024', endDate: 'Dec 2024', progress: 100 },
    { id: '5', name: 'FinTech Incubator', organization: 'FinLab', type: 'Incubator', status: 'active', startups: 6, mentors: 4, startDate: 'Jan 2025', endDate: 'Jul 2025', progress: 45 },
  ];
  // Sample rows are the showcase's; an empty platform sees the empty state.
  const programs: Program[] = live.length > 0 ? live : isLoading || !showDemoData ? [] : sample;

  const filteredPrograms = programs.filter((p) => {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.organization.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesType = typeFilter === 'all' || p.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  // Types are whatever the programmes call themselves; the filter offers the
  // ones present rather than a list that could name a type nobody uses.
  const types = Array.from(new Set(programs.map((p) => p.type).filter(Boolean))).sort();
  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (typeFilter !== 'all' ? 1 : 0);
  const count = (status: Program['status']) => programs.filter((p) => p.status === status).length;

  const exportCsv = () =>
    downloadCsv(
      'programs',
      ['name', 'organization', 'type', 'status', 'startups', 'mentors', 'start', 'end', 'calendar_elapsed_pct'],
      filteredPrograms.map((p) => [p.name, p.organization, p.type, p.status, p.startups, p.mentors, p.startDate, p.endDate, p.progress]),
    );

  const totals = [
    { id: 'total', en: 'Total programs', el: 'Σύνολο προγραμμάτων', value: programs.length, icon: Award, tone: 'text-primary-accessible' },
    { id: 'active', en: 'Active', el: 'Ενεργά', value: count('active'), icon: CheckCircle2, tone: STATUS.success.text },
    { id: 'upcoming', en: 'Upcoming', el: 'Προσεχή', value: count('upcoming'), icon: CalendarClock, tone: STATUS.accent.text },
    { id: 'draft', en: 'Draft', el: 'Πρόχειρα', value: count('draft'), icon: FileText, tone: 'text-muted-foreground' },
    { id: 'archived', en: 'Archived', el: 'Αρχειοθετημένα', value: count('archived'), icon: Archive, tone: 'text-muted-foreground' },
    { id: 'startups', en: 'Total startups', el: 'Σύνολο startups', value: programs.reduce((acc, p) => acc + p.startups, 0), icon: Users, tone: 'text-primary-accessible' },
    { id: 'orgs', en: 'Organizations', el: 'Οργανισμοί', value: new Set(programs.map((p) => p.organization)).size, icon: Building2, tone: 'text-primary-accessible' },
  ];

  const filterButton = (on: boolean, onClick: () => void, en: string, el: string, key: string) => (
    <button
      key={key}
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'tap-target flex min-h-9 w-full items-center rounded-lg px-2.5 text-left text-sm transition-colors',
        on ? 'bg-primary/10 font-medium text-primary-accessible' : 'hover:bg-muted/70',
      )}
    >
      <BilingualText en={en} el={el} compact wrap />
    </button>
  );

  /*
   * The page rail. The column is the programme list and its search. The four
   * totals (now six: draft and archived had no count), the status filter, a
   * type filter the rows always carried, and refresh/export sit one gesture
   * away. The filters' badge is how many are narrowing the list.
   */
  const rail: PageRailSection[] = [
    {
      id: 'totals',
      glyph: 'chart',
      labelEn: 'Program totals',
      labelEl: 'Σύνολα προγραμμάτων',
      content: (
        <ul className="space-y-2">
          {totals.map(({ id, en, el, value, icon: Icon, tone }) => (
            <li key={id} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <Icon className={cn('icon-md shrink-0', tone)} aria-hidden="true" />
              <span className="min-w-0 flex-1 text-sm text-muted-foreground">
                <BilingualText en={en} el={el} compact wrap />
              </span>
              <span className="page-stat font-bold tabular-nums">{isLoading ? '—' : value}</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: 'filters',
      glyph: 'target',
      labelEn: 'Narrow the list',
      labelEl: 'Φιλτράρισμα λίστας',
      badge: activeFilterCount || null,
      content: (
        <div className="space-y-4">
          <fieldset className="space-y-1.5">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <BilingualText en="Status" el="Κατάσταση" compact />
            </legend>
            {STATUS_OPTIONS.map((o) => filterButton(statusFilter === o.value, () => setStatusFilter(o.value), o.en, o.el, o.value))}
          </fieldset>
          {types.length > 1 && (
            <fieldset className="space-y-1.5">
              <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <BilingualText en="Type" el="Τύπος" compact />
              </legend>
              {filterButton(typeFilter === 'all', () => setTypeFilter('all'), 'Any type', 'Οποιοσδήποτε τύπος', 'all')}
              {types.map((t) => filterButton(typeFilter === t, () => setTypeFilter(t), t, t, t))}
            </fieldset>
          )}
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => { setStatusFilter('all'); setTypeFilter('all'); }}
              className="tap-target flex min-h-9 w-full items-center rounded-lg px-2.5 text-left text-sm text-primary-accessible hover:bg-muted/70"
            >
              <BilingualText en="Clear status and type" el="Καθαρισμός κατάστασης και τύπου" compact wrap />
            </button>
          )}
        </div>
      ),
    },
    {
      id: 'tools',
      glyph: 'sliders',
      labelEn: 'List tools',
      labelEl: 'Εργαλεία λίστας',
      content: (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={cn('icon-sm shrink-0', isFetching && 'animate-spin')} aria-hidden="true" />
            <span className="min-w-0 flex-1"><BilingualText en="Refresh programs" el="Ανανέωση προγραμμάτων" compact wrap /></span>
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={filteredPrograms.length === 0}
            className="tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="icon-sm shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <BilingualText en={`Export ${filteredPrograms.length} programs as CSV`} el={`Εξαγωγή ${filteredPrograms.length} προγραμμάτων σε CSV`} compact wrap />
            </span>
          </button>
        </div>
      ),
    },
  ];

  // Offered to the assistant: the same filters, refresh, export, opening a
  // programme, and the card's Archive (which still asks first, and still
  // refuses sample rows).
  const programRows = programs.map((p) => ({ value: p.id, labelEn: p.name, labelEl: p.name }));
  usePageList([
    {
      id: 'programs',
      labelEn: 'Programs',
      labelEl: 'Προγράμματα',
      rows: isLoading ? undefined : filteredPrograms.map((p) =>
        `${p.name} · ${p.organization} · ${p.type} · ${p.status} · ${p.startups} startups, ${p.mentors} mentors`,
      ),
      total: programs.length,
      sample: showingSample,
    },
  ]);
  usePageControls([
    choiceControl('status_filter', 'Status filter', 'Φίλτρο κατάστασης', STATUS_OPTIONS, statusFilter, setStatusFilter),
    choiceControl('type_filter', 'Type filter', 'Φίλτρο τύπου', [{ value: 'all', en: 'Any type', el: 'Οποιοσδήποτε τύπος' }, ...types.map((t) => ({ value: t, en: t, el: t }))], typeFilter, setTypeFilter),
    { id: 'refresh', labelEn: 'Refresh programs', labelEl: 'Ανανέωση προγραμμάτων', writes: false, run: () => void refetch() },
    {
      id: 'export_csv',
      labelEn: 'Export programs as CSV',
      labelEl: 'Εξαγωγή προγραμμάτων σε CSV',
      writes: false,
      unavailableEn: filteredPrograms.length === 0 ? 'No programme matches the current filters.' : undefined,
      unavailableEl: filteredPrograms.length === 0 ? 'Κανένα πρόγραμμα δεν ταιριάζει στα τρέχοντα φίλτρα.' : undefined,
      run: exportCsv,
    },
    { id: 'open_program', labelEn: 'Open program details', labelEl: 'Άνοιγμα λεπτομερειών προγράμματος', writes: false, options: programRows, run: (value) => setViewing(programs.find((p) => p.id === value) ?? null) },
    {
      id: 'archive_program',
      labelEn: 'Archive program',
      labelEl: 'Αρχειοθέτηση προγράμματος',
      writes: true,
      options: programs.filter((p) => p.status !== 'archived').map((p) => ({ value: p.id, labelEn: p.name, labelEl: p.name })),
      unavailableEn: showingSample ? 'These are sample programmes until the programs API returns some.' : undefined,
      unavailableEl: showingSample ? 'Είναι δείγματα μέχρι το API προγραμμάτων να επιστρέψει προγράμματα.' : undefined,
      run: (value) => {
        const program = programs.find((p) => p.id === value);
        return program ? archive(program) : ROW_GONE;
      },
    },
  ]);

  const statusLabel = STATUS_OPTIONS.find((o) => o.value === statusFilter);

  return (
    <AppShell rail={rail}>
      <div className="space-y-6">
        {showingSample && (
          <SampleDataNotice
            surface="Programs"
            detail="The programs API returned no programmes, so these rows show the layout. Live programmes appear here as organisations create them."
            askAiPrompt="Why does the admin programs page show sample programmes?"
          />
        )}
        {/* Search stays with the list; status and type are in the rail, and
            the line below says which are narrowing it. */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder={bilingualInline("Search programs…", "Αναζήτηση προγραμμάτων…")}
              aria-label="Search programs by name or organization"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            <BilingualText
              en={`${filteredPrograms.length} of ${programs.length} programs${statusFilter !== 'all' ? ` · ${statusLabel?.en}` : ''}${typeFilter !== 'all' ? ` · ${typeFilter}` : ''}`}
              el={`${filteredPrograms.length} από ${programs.length} προγράμματα${statusFilter !== 'all' ? ` · ${statusLabel?.el}` : ''}${typeFilter !== 'all' ? ` · ${typeFilter}` : ''}`}
              compact
              wrap
            />
          </p>
        </div>

        {/* Programs List */}
        <div className="space-y-3">
          {filteredPrograms.map((program) => (
            <ProgramCard key={program.id} program={program} onView={setViewing} onArchive={archive} />
          ))}
          {filteredPrograms.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Award className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" aria-hidden="true" />
                <h3 className="font-medium"><BilingualText en="No programs found" el="Δεν βρέθηκαν προγράμματα" compact /></h3>
                <p className="text-sm text-muted-foreground mt-1">
                  <BilingualText en="Try adjusting your filters" el="Δοκιμάστε να αλλάξετε τα φίλτρα" compact />
                </p>
                {activeFilterCount > 0 && (
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => openRailSection('filters')}>
                    <BilingualText en="Show filters" el="Εμφάνιση φίλτρων" compact />
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={viewing !== null} onOpenChange={(open) => { if (!open) setViewing(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewing?.name}</DialogTitle>
            <DialogDescription>{viewing?.organization} · {viewing?.type}</DialogDescription>
          </DialogHeader>
          {viewing && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <dt className="text-muted-foreground"><BilingualText en="Status" el="Κατάσταση" compact /></dt>
              <dd className="capitalize"><StatusText value={viewing.status} /></dd>
              <dt className="text-muted-foreground"><BilingualText en="Dates" el="Ημερομηνίες" compact /></dt>
              <dd>{viewing.startDate} – {viewing.endDate}</dd>
              <dt className="text-muted-foreground"><BilingualText en="Startups" el="Startups" compact /></dt>
              <dd>{viewing.startups}</dd>
              <dt className="text-muted-foreground"><BilingualText en="Calendar elapsed" el="Χρόνος που πέρασε" compact /></dt>
              <dd>{viewing.progress}%</dd>
              {viewing.description && (
                <>
                  <dt className="col-span-2 text-muted-foreground"><BilingualText en="Description" el="Περιγραφή" compact /></dt>
                  <dd className="col-span-2 whitespace-pre-line">{viewing.description}</dd>
                </>
              )}
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
