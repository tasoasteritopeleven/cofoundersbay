'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  Search,
  Plus,
  MoreVertical,
  Users,
  Calendar,
  Edit,
  Trash2,
  Eye,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { SampleDataNotice } from '@/components/common/SampleDataNotice';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { EmptyTenantPrograms } from '@/components/common/EmptyStates';
import { useCurrentOrg } from '@/hooks/useCurrentOrg';
import {
  createProgram,
  listOrganizationPrograms,
  updateProgram,
  type ProgramItem,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import type { PageRailSection } from '@/components/layout/PageRail';
import { choiceControl, rowOptions, usePageControls, usePageList } from '@/lib/page-controls';
import { BilingualText } from '@/components/common/BilingualText';
import { qk } from '@/lib/query-keys';
import { useDemoData } from '@/contexts/DemoDataContext';
import { bilingualInline } from '@/lib/i18n/format';
import { StatusText } from '@/components/common/StatusText';
import { formatDate } from '@/lib/i18n/format';

const PROGRAM_STATUS_FILTERS: { value: 'all' | 'current' | Program['status']; en: string; el: string }[] = [
  { value: 'current', en: 'Not archived', el: 'Μη αρχειοθετημένα' },
  { value: 'all', en: 'All programs', el: 'Όλα τα προγράμματα' },
  { value: 'active', en: 'Active', el: 'Ενεργά' },
  { value: 'upcoming', en: 'Upcoming', el: 'Επερχόμενα' },
  { value: 'draft', en: 'Draft', el: 'Πρόχειρα' },
  { value: 'completed', en: 'Completed', el: 'Ολοκληρωμένα' },
  { value: 'archived', en: 'Archived', el: 'Αρχειοθετημένα' },
];

type Program = {
  id: string;
  name: string;
  description: string;
  type: string;
  status: 'draft' | 'upcoming' | 'active' | 'completed' | 'archived';
  startups: number;
  mentors?: number;
  startDate: string;
  endDate: string;
  progress: number;
};

const PROGRAM_TYPES = [
  'accelerator',
  'incubator',
  'course',
  'competition',
  'grant',
  'challenge',
  'bootcamp',
  'fellowship',
] as const;

/** Program has no progress column; for a live row the honest figure is how
 *  far the schedule has run. Mock rows keep their authored numbers. */
function scheduleProgress(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (!(e > s)) return 0;
  const now = Date.now();
  return Math.min(100, Math.max(0, Math.round(((now - s) / (e - s)) * 100)));
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  // Numeric month/year reads the same in both languages ("10/2026").
  return formatDate(iso, 'en', { month: '2-digit', year: 'numeric' });
}

function toViewProgram(p: ProgramItem & { name?: string; _count?: { participants?: number } }): Program {
  return {
    id: p.id,
    name: p.name ?? p.title ?? 'Untitled program',
    description: p.description ?? '',
    type: p.programType,
    status: (p.status as Program['status']) ?? 'draft',
    startups: p._count?.participants ?? p.participantCount ?? 0,
    startDate: fmtDate(p.startDate),
    endDate: fmtDate(p.endDate),
    progress: scheduleProgress(p.startDate, p.endDate),
  };
}

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'program';

function ProgramCard({
  program,
  live,
  onEdit,
  onArchive,
}: {
  program: Program;
  live: boolean;
  onEdit: (p: Program) => void;
  onArchive: (p: Program) => void;
}) {
  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground border-border',
    upcoming: 'bg-status-accent-bg text-status-accent border-status-accent-border',
    active: 'bg-status-success-bg text-status-success border-status-success-border',
    completed: 'bg-status-info-bg text-status-info border-status-info-border',
    archived: 'bg-status-warning-bg text-status-warning border-status-warning-border',
  };

  return (
    <Card className="transition-all hover:border-primary/30">
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link href={`/programs/${program.id}`} className="font-semibold hover:text-primary-accessible transition-colors">
                {program.name}
              </Link>
              <Badge variant="outline" className={cn('text-xs capitalize', statusColors[program.status])}>
                <StatusText value={program.status} />
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {program.description}
            </p>
            <div className="flex flex-wrap gap-3 mt-3 text-sm text-muted-foreground">
              <Badge variant="secondary" className="text-xs capitalize"><StatusText value={program.type} /></Badge>
              <span className="flex items-center gap-1">
                <Users className="icon-sm" aria-hidden="true" />
                <BilingualText en={`${program.startups} participants`} el={`${program.startups} συμμετέχοντες`} compact />
              </span>
              {typeof program.mentors === 'number' && (
                <span className="flex items-center gap-1">
                  <Award className="icon-sm" aria-hidden="true" />
                  <BilingualText en={`${program.mentors} mentors`} el={`${program.mentors} μέντορες`} compact />
                </span>
              )}
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
              <Button aria-label="More options" variant="ghost" size="icon">
                <MoreVertical className="icon-sm" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/programs/${program.id}`}>
                  <Eye className="mr-2 icon-sm" aria-hidden="true" />
                  <BilingualText en="View Details" el="Λεπτομέρειες" compact />
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!live}
                title={live ? undefined : 'Illustrative row — there is nothing to edit'}
                onClick={() => onEdit(program)}
              >
                <Edit className="mr-2 icon-sm" aria-hidden="true" />
                <BilingualText en="Edit Program" el="Επεξεργασία προγράμματος" compact />
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!live}
                title={live ? undefined : 'Illustrative row — there is nothing to archive'}
                className="text-destructive-accessible"
                onClick={() => onArchive(program)}
              >
                <Trash2 className="mr-2 icon-sm" />
                <BilingualText en="Archive" el="Αρχειοθέτηση" compact />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

type ProgramForm = {
  id?: string;
  name: string;
  description: string;
  programType: string;
  startDate: string;
  endDate: string;
};

const EMPTY_FORM: ProgramForm = {
  name: '',
  description: '',
  programType: 'accelerator',
  startDate: '',
  endDate: '',
};

export default function TenantProgramsPage() {
  // Illustrative rows are for the showcase; a real account with nothing
  // to list sees the page's empty state, not invented people and records.
  const { showDemoData } = useDemoData();
  const [search, setSearch] = useState('');
  // Archiving writes status 'archived', and until now nothing ever hid an
  // archived program: it stayed in the list next to the live ones. The
  // default view is everything that is not archived; "Archived" and "All" are
  // one click away in the rail.
  const [statusFilter, setStatusFilter] = useState<(typeof PROGRAM_STATUS_FILTERS)[number]['value']>('current');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ProgramForm>(EMPTY_FORM);
  const qc = useQueryClient();
  const { success, error: showError } = useToast();
  const { organizationId } = useCurrentOrgMembership();

  const programsQuery = useQuery({
    queryKey: qk('programs', 'organization', organizationId),
    queryFn: () => listOrganizationPrograms(organizationId!),
    enabled: Boolean(organizationId),
    staleTime: 30_000,
    retry: 0,
  });

  const isLive = Boolean(organizationId) && Array.isArray(programsQuery.data);
  const livePrograms = isLive
    ? (programsQuery.data as ProgramItem[]).map(toViewProgram)
    : [];

  // Illustrative until the organisation resolves — flagged as sample below.
  const programs = isLive ? livePrograms : showDemoData ? SAMPLE_PROGRAMS : [];

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        programType: form.programType,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      };
      if (form.id) {
        return updateProgram(form.id, body);
      }
      return createProgram(organizationId!, { ...body, slug: slugify(form.name) });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk('programs') });
      success(form.id ? 'Program updated' : 'Program created');
      setFormOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (err) =>
      showError('Could not save the program', err instanceof Error ? err.message : undefined),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => updateProgram(id, { status: 'archived' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk('programs') });
      success('Program archived');
    },
    onError: (err) =>
      showError('Could not archive the program', err instanceof Error ? err.message : undefined),
  });

  const openEdit = (p: Program) => {
    setForm({
      id: p.id,
      name: p.name,
      description: p.description,
      programType: p.type,
      startDate: '',
      endDate: '',
    });
    setFormOpen(true);
  };

  const filteredPrograms = programs.filter(
    (p) =>
      (statusFilter === 'all' ||
        (statusFilter === 'current' ? p.status !== 'archived' : p.status === statusFilter)) &&
      (!search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase()))
  );
  const statusFilterOn = statusFilter !== 'current';
  const archivedCount = programs.filter((p) => p.status === 'archived').length;

  const totals = [
    { id: 'total', en: 'Total Programs', el: 'Σύνολο προγραμμάτων', value: programs.length, tone: '' },
    { id: 'active', en: 'Active', el: 'Ενεργά', value: programs.filter((p) => p.status === 'active').length, tone: 'text-status-success' },
    { id: 'participants', en: 'Total Participants', el: 'Σύνολο συμμετεχόντων', value: programs.reduce((acc, p) => acc + p.startups, 0), tone: '' },
    { id: 'mentors', en: 'Total Mentors', el: 'Σύνολο μεντόρων', value: programs.reduce((acc, p) => acc + (p.mentors ?? 0), 0), tone: '' },
  ];

  /*
   * The page rail: the four totals that sat between the search and the list,
   * and the status filter the archive action always needed. The column is the
   * search and the programs.
   */
  // Offered to the assistant: the rail's status filter and the Create
  // Program form, which stays unavailable without an organisation exactly as
  // the header button is.
  usePageControls([
    choiceControl('status_filter', 'Program status filter', 'Φίλτρο κατάστασης προγράμματος', PROGRAM_STATUS_FILTERS, statusFilter, (v) => setStatusFilter(v as typeof statusFilter)),
    {
      id: 'create_program',
      labelEn: 'Open the create program form',
      labelEl: 'Άνοιγμα φόρμας νέου προγράμματος',
      writes: false,
      unavailableEn: organizationId ? undefined : 'Join an organisation to create programs.',
      unavailableEl: organizationId ? undefined : 'Γίνετε μέλος οργανισμού για να δημιουργήσετε προγράμματα.',
      run: () => { setForm(EMPTY_FORM); setFormOpen(true); },
    },
    // The card menu's Edit and Archive, over the programmes on screen, with
    // the same reason the menu gives for a sample row.
    {
      id: 'edit_program',
      labelEn: 'Edit program',
      labelEl: 'Επεξεργασία προγράμματος',
      writes: false,
      options: rowOptions(filteredPrograms, (p) => p.id, (p) => p.name),
      unavailableEn: isLive ? undefined : 'Illustrative row — there is nothing to edit',
      unavailableEl: isLive ? undefined : 'Ενδεικτική γραμμή — δεν υπάρχει κάτι για επεξεργασία',
      run: (v) => { const p = programs.find((row) => row.id === v); if (p) openEdit(p); },
    },
    {
      id: 'archive_program',
      labelEn: 'Archive program',
      labelEl: 'Αρχειοθέτηση προγράμματος',
      writes: true,
      options: rowOptions(filteredPrograms.filter((p) => p.status !== 'archived'), (p) => p.id, (p) => p.name),
      unavailableEn: isLive ? undefined : 'Illustrative row — there is nothing to archive',
      unavailableEl: isLive ? undefined : 'Ενδεικτική γραμμή — δεν υπάρχει κάτι για αρχειοθέτηση',
      run: async (v) => { if (v) await archiveMutation.mutateAsync(v); },
    },
  ]);
  usePageList([
    {
      id: 'programs',
      labelEn: 'Programs',
      labelEl: 'Προγράμματα',
      rows: filteredPrograms.map((p) => `${p.name} · ${p.type} · ${p.status} · ${p.startups} startups${p.mentors ? `, ${p.mentors} mentors` : ''} · ${p.progress}%`),
      total: programs.length,
      sample: !isLive,
    },
  ]);

  const rail: PageRailSection[] = [
    {
      id: 'totals',
      glyph: 'chart',
      labelEn: 'Program totals',
      labelEl: 'Σύνολα προγραμμάτων',
      content: (
        <ul className="space-y-2">
          {totals.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <span className="text-sm text-muted-foreground"><BilingualText en={t.en} el={t.el} compact wrap /></span>
              <span className={cn('page-stat font-bold tabular-nums', t.tone)}>{t.value}</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: 'status',
      glyph: 'target',
      labelEn: 'Program status',
      labelEl: 'Κατάσταση προγράμματος',
      badge: statusFilterOn ? 1 : null,
      content: (
        <div className="space-y-1" role="radiogroup" aria-label="Program status">
          {PROGRAM_STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="radio"
              aria-checked={statusFilter === f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'tap-target flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-2.5 text-left text-sm transition-colors',
                statusFilter === f.value ? 'bg-primary/10 font-medium text-primary-accessible' : 'hover:bg-muted/70',
              )}
            >
              <BilingualText en={f.en} el={f.el} compact wrap />
              {f.value === 'archived' && archivedCount > 0 && (
                <span className="text-xs tabular-nums text-muted-foreground">{archivedCount}</span>
              )}
            </button>
          ))}
        </div>
      ),
    },
  ];
  const activeStatusLabel = PROGRAM_STATUS_FILTERS.find((f) => f.value === statusFilter);

  return (
    <AppShell
      title="Programs"
      titleEl="Προγράμματα"
      description="Workspaces with programs unlock applications, cohorts, and structured mentoring."
      descriptionEl="Οι χώροι εργασίας με προγράμματα ενεργοποιούν αιτήσεις, κύκλους και δομημένη καθοδήγηση."
      rail={rail}
      actions={(
        <Button
          disabled={!organizationId}
          title={organizationId ? undefined : 'Join an organisation to create programs'}
          onClick={() => {
            setForm(EMPTY_FORM);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 icon-sm" />
          <BilingualText en="Create Program" el="Δημιουργία προγράμματος" compact />
        </Button>
      )}
    >
      <div className="space-y-6">

        {!isLive && (
          <SampleDataNotice
            surface="Programs"
            detail="These programs are illustrative until your organisation's program list loads."
            askAiPrompt="Why does the programs page show sample programs?"
          />
        )}

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
          <Input
            aria-label={bilingualInline("Search programs", "Αναζήτηση προγραμμάτων")}
            placeholder={bilingualInline("Search programs…", "Αναζήτηση προγραμμάτων…")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {statusFilterOn && activeStatusLabel && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <BilingualText
              en={`Showing: ${activeStatusLabel.en} (${filteredPrograms.length})`}
              el={`Εμφανίζονται: ${activeStatusLabel.el} (${filteredPrograms.length})`}
              compact
            />
            <Button variant="ghost" size="sm" onClick={() => setStatusFilter('current')}>
              <BilingualText en="Show current programs" el="Τρέχοντα προγράμματα" compact />
            </Button>
          </div>
        )}

        {/* Programs List */}
        <div className="space-y-3">
          {filteredPrograms.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              live={isLive}
              onEdit={openEdit}
              onArchive={(p) => archiveMutation.mutate(p.id)}
            />
          ))}
          {filteredPrograms.length === 0 && (
            <EmptyTenantPrograms
              filtersActive={!!search || statusFilterOn}
              onClearFilters={() => { setSearch(''); setStatusFilter('current'); }}
            />
          )}
        </div>
      </div>

      {/* Create / edit program */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit program' : 'Create program'}</DialogTitle>
            <DialogDescription className="sr-only"><BilingualText en="Create or edit the program's name, description and type." el="Δημιουργία ή επεξεργασία ονόματος, περιγραφής και τύπου προγράμματος." /></DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="program-name"><BilingualText en="Name" el="Όνομα" compact /></Label>
              <Input
                id="program-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Spring Accelerator 2026"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="program-desc"><BilingualText en="Description" el="Περιγραφή" compact /></Label>
              <Input
                id="program-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="programType"><BilingualText en="Type" el="Τύπος" compact /></Label>
              <Select
                value={form.programType}
                onValueChange={(v) => setForm((f) => ({ ...f, programType: v }))}
              >
                <SelectTrigger id="programType" aria-label="Type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROGRAM_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="program-start"><BilingualText en="Start date" el="Ημερομηνία έναρξης" compact /></Label>
                <Input
                  id="program-start"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="program-end"><BilingualText en="End date" el="Ημερομηνία λήξης" compact /></Label>
                <Input
                  id="program-end"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              <BilingualText en="Cancel" el="Ακύρωση" compact />
            </Button>
            <Button
              disabled={!form.name.trim() || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? 'Saving…' : form.id ? 'Save changes' : 'Create program'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

// Kept as the illustrative set for demo mode and for organisations whose
// program list has not answered yet - it is flagged by SampleDataNotice.
const SAMPLE_PROGRAMS: Program[] = [
  {
    id: '1',
    name: 'Spring Accelerator 2025',
    description: 'A 12-week intensive accelerator program for early-stage startups in the tech sector.',
    type: 'accelerator',
    status: 'active',
    startups: 12,
    mentors: 8,
    startDate: 'Jan 2025',
    endDate: 'Apr 2025',
    progress: 65,
  },
  {
    id: '2',
    name: 'AI Innovation Lab',
    description: 'Specialized program for AI/ML startups with access to compute resources and expert mentorship.',
    type: 'course',
    status: 'active',
    startups: 8,
    mentors: 5,
    startDate: 'Feb 2025',
    endDate: 'Aug 2025',
    progress: 30,
  },
  {
    id: '3',
    name: 'Pre-seed Bootcamp',
    description: 'Intensive 4-week bootcamp for founders preparing for their first fundraise.',
    type: 'bootcamp',
    status: 'active',
    startups: 8,
    mentors: 4,
    startDate: 'Mar 2025',
    endDate: 'Mar 2025',
    progress: 90,
  },
  {
    id: '4',
    name: 'Fall Accelerator 2024',
    description: 'Previous cohort of our flagship accelerator program.',
    type: 'accelerator',
    status: 'completed',
    startups: 10,
    mentors: 8,
    startDate: 'Sep 2024',
    endDate: 'Dec 2024',
    progress: 100,
  },
  {
    id: '5',
    name: 'Summer Accelerator 2025',
    description: 'Upcoming accelerator cohort for summer 2025.',
    type: 'accelerator',
    status: 'draft',
    startups: 0,
    mentors: 0,
    startDate: 'Jun 2025',
    endDate: 'Sep 2025',
    progress: 0,
  },
];

/** The tenant page manages the caller's own organisation; reuse the shared
 *  membership hook so the org id resolves the same way as everywhere else. */
function useCurrentOrgMembership() {
  const { membership } = useCurrentOrg();
  return { organizationId: membership?.organizationId ?? null };
}
