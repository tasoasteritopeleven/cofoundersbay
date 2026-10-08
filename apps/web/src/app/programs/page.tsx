'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Award,
  Calendar,
  MapPin,
  Users,
  Clock,
  ChevronRight,
  Building2,
  Rocket,
  GraduationCap,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Globe,
  Bookmark,
  BookmarkCheck,
  ArrowRight,
  Zap,
  Star,
  Filter,
  X,
  Handshake,
  Briefcase,
  FileText,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { RailAction, RailOptions, RailStats } from '@/components/layout/RailParts';
import { usePageRail } from '@/components/layout/PageRailContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { BilingualText } from '@/components/common/BilingualText';
import { PROGRAMS_STRINGS, programsEn, programsEl } from '@/lib/i18n/strings-programs';
import type { BilingualPair } from '@/lib/i18n/types';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';
import { bilingualAria } from '@/lib/i18n/format';
import { cn } from '@/lib/utils';
import { STATUS, type StatusTone } from '@/lib/semantic-colors';
import { qk } from '@/lib/query-keys';
import { choiceControl, rowOptions, usePageControls, usePageList } from '@/lib/page-controls';
import {
  listPrograms,
  acceptsApplications,
  getMyPrograms,
  applyToProgram,
  type ProgramItem,
} from '@/lib/api';

import { pressableProps } from '@/lib/pressable';
import { useDateFormat } from '@/lib/i18n/useDateFormat';
// ── Helpers ──────────────────────────────────────────────────────────────────
const PROGRAM_STATUS_TONE: Record<string, StatusTone> = {
  open: 'success',
  upcoming: 'info',
  active: 'warning',
  closed: 'neutral',
  draft: 'neutral',
};

function deadlineUrgencyClass(days: number): string {
  if (days <= 3) return cn('font-medium', STATUS.danger.icon);
  if (days <= 7) return cn('font-medium', STATUS.warning.icon);
  return 'text-muted-foreground';
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  accelerator: Rocket,
  incubator:   Building2,
  bootcamp:    GraduationCap,
  competition: Award,
  cohort:      Users,
};

function typeLabel(t: string) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Status and programme type arrive from the API as slugs (`open`,
 * `accelerator`). These map them onto the catalogue so a badge reads in the
 * reader's language, and fall back to the capitalised slug when the API sends
 * a value this build does not know — an unrecognised status should still be
 * shown as it came, not swallowed into a blank badge.
 */
function badgeStatus(status: string): BilingualPair {
  return PROGRAMS_STRINGS[`badge_${status}`] ?? { en: typeLabel(status), el: typeLabel(status) };
}

function badgeType(programType: string): BilingualPair {
  return PROGRAMS_STRINGS[`type_${programType}`] ?? { en: typeLabel(programType), el: typeLabel(programType) };
}

const PROGRAM_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

function daysUntil(d: string | null): number | null {
  if (!d) return null;
  const diff = new Date(d).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

// ── Apply Modal ───────────────────────────────────────────────────────────────
function ApplyModal({
  program,
  open,
  onClose,
  onApply,
  isApplying,
}: {
  program: ProgramItem | null;
  open: boolean;
  onClose: () => void;
  onApply: (note: string) => void;
  isApplying: boolean;
}) {
  const fmtDate = useDateFormat();
  const [note, setNote] = useState('');
  // A placeholder is one attribute and cannot hold both languages the way a
  // label can, so it follows the reader's primary language.
  const { primary } = useLanguagePreference();
  const t = (key: Parameters<typeof programsEn>[0]) => (primary === 'el' ? programsEl(key) : programsEn(key));
  if (!program) return null;
  const TypeIcon = TYPE_ICONS[program.programType] ?? Award;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TypeIcon className="icon-md text-muted-foreground" />
            <BilingualText
              en={`${programsEn('apply_to')} ${program.title}`}
              el={`${programsEl('apply_to')} ${program.title}`}
              compact
              wrap
            />
          </DialogTitle>
          <DialogDescription>
            <BilingualText
              en={`${program.organization?.name ?? ''} — ${programsEn('apply_intro')}`.trim()}
              el={`${program.organization?.name ?? ''} — ${programsEl('apply_intro')}`.trim()}
              wrap
            />
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-secondary/40 p-3 space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">
                <BilingualText en={programsEn('program_type')} el={programsEl('program_type')} compact />
              </span>
              <span className="font-medium capitalize">
                <BilingualText en={badgeType(program.programType).en} el={badgeType(program.programType).el} compact />
              </span>
            </div>
            {program.applicationDeadline && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">
                  <BilingualText en={programsEn('application_deadline')} el={programsEl('application_deadline')} compact />
                </span>
                <span className="font-medium">{program.applicationDeadline ? fmtDate(program.applicationDeadline, PROGRAM_DATE) : null}</span>
              </div>
            )}
            {program.capacity && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">
                  <BilingualText en={programsEn('capacity')} el={programsEl('capacity')} compact />
                </span>
                <span className="font-medium">
                  <BilingualText
                    en={`${program.participantCount}/${program.capacity} ${programsEn('spots_taken')}`}
                    el={`${program.participantCount}/${program.capacity} ${programsEl('spots_taken')}`}
                    compact
                  />
                </span>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="prog-f1" className="text-sm font-medium">
              <BilingualText en={programsEn('fit_label')} el={programsEl('fit_label')} compact />{' '}
              <span className="text-muted-foreground">
                <BilingualText en={programsEn('optional')} el={programsEl('optional')} compact />
              </span>
            </label>
            <Textarea id="prog-f1"
              placeholder={t('fit_placeholder')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isApplying}>
            <BilingualText en={programsEn('cancel')} el={programsEl('cancel')} compact />
          </Button>
          <Button onClick={() => onApply(note)} disabled={isApplying}>
            {isApplying ? <Loader2 className="icon-sm animate-spin mr-2" /> : <Zap className="icon-sm mr-2" />}
            <BilingualText en={programsEn('submit_application')} el={programsEl('submit_application')} compact />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Program Card ──────────────────────────────────────────────────────────────
function ProgramCard({
  program,
  isEnrolled,
  onApply,
}: {
  program: ProgramItem;
  isEnrolled: boolean;
  onApply: (p: ProgramItem) => void;
}) {
  const fmtDate = useDateFormat();
  const TypeIcon = TYPE_ICONS[program.programType] ?? Award;
  const deadline = daysUntil(program.applicationDeadline);
  const spotsLeft = program.capacity ? program.capacity - program.participantCount : null;
  const isFull = spotsLeft !== null && spotsLeft <= 0;

  return (
    <Card className={cn('transition-all hover:border-primary/30 group', isEnrolled && 'border-primary/40 bg-primary/2')}>
      <CardContent>
        <div className="flex gap-4">
          <Avatar className="h-11 w-11 rounded-lg flex-shrink-0 border border-border">
            <AvatarImage src={program.organization?.logoUrl ?? undefined} />
            {/* Stands in for the organisation's logo: an avatar, not decoration. */}
            <AvatarFallback data-keep-icon className="rounded-xl bg-primary/10 text-primary-accessible">
              <TypeIcon className="icon-lg" aria-hidden="true" />
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 justify-between flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold truncate">{program.title}</h3>
                  {isEnrolled && (
                    <Badge variant="outline" className="text-xs bg-primary/10 text-primary-accessible border-primary/30 gap-1">
                      <CheckCircle2 className="icon-sm" aria-hidden="true" />
                      <BilingualText en={programsEn('applied')} el={programsEl('applied')} compact />
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Building2 className="icon-sm flex-shrink-0" />
                  <span className="truncate">{program.organization?.name}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                <Badge variant="outline" className={cn('text-xs capitalize border', STATUS[PROGRAM_STATUS_TONE[program.status] ?? 'neutral'].chip)}>
                  <BilingualText en={badgeStatus(program.status).en} el={badgeStatus(program.status).el} compact />
                </Badge>
                <Badge variant="outline" className="text-xs capitalize text-muted-foreground">
                  <BilingualText en={badgeType(program.programType).en} el={badgeType(program.programType).el} compact />
                </Badge>
              </div>
            </div>

            {program.description && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{program.description}</p>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-muted-foreground">
              {program.applicationDeadline && acceptsApplications(program) && deadline !== null && (
                <span className={cn('flex items-center gap-1', deadline !== null && deadline <= 7 && deadlineUrgencyClass(deadline))}>
                  <Clock className="icon-sm" />
                  {deadline > 0 ? `${deadline}d to apply` : 'Deadline today'}
                </span>
              )}
              {program.startDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="icon-sm" />
                  <BilingualText en={`Starts ${fmtDate(program.startDate, PROGRAM_DATE)}`} el={`Ξεκινά ${fmtDate(program.startDate, PROGRAM_DATE)}`} compact />
                </span>
              )}
              <span className="flex items-center gap-1">
                {program.isRemote ? <Globe className="icon-sm" /> : <MapPin className="icon-sm" />}
                {program.isRemote ? 'Remote' : (program.location ?? 'On-site')}
              </span>
              {spotsLeft !== null && (
                <span className={cn(
                  'flex items-center gap-1',
                  isFull ? cn('font-medium', STATUS.danger.icon) : spotsLeft <= 3 ? cn('font-medium', STATUS.warning.icon) : 'text-muted-foreground',
                )}>
                  <Users className="icon-sm" />
                  {isFull ? 'Full' : `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left`}
                </span>
              )}
            </div>

            {program.industries?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {program.industries.slice(0, 5).map((ind) => (
                  <span key={ind} className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{ind}</span>
                ))}
              </div>
            )}

            {(program.benefits as string[] | undefined)?.length ? (
              <div className="flex flex-wrap gap-1 mt-2">
                {(program.benefits as string[]).slice(0, 3).map((b, i) => (
                  <span key={i} className={cn('text-xs flex items-center gap-1', STATUS.success.text)}>
                    <Star className="icon-sm" />{b}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="flex items-center gap-2 mt-4">
              {acceptsApplications(program) && !isEnrolled && !isFull && (
                <Button size="sm" onClick={(e) => { e.preventDefault(); onApply(program); }}>
                  <Zap className="icon-sm mr-1.5" aria-hidden="true" />
                  <BilingualText en={programsEn('apply_now')} el={programsEl('apply_now')} compact />
                </Button>
              )}
              {isEnrolled && (
                // A state, not an action: it looked like a button and did
                // nothing. Disabled, so it reads as "Applied, unavailable".
                <Button size="sm" variant="outline" className="text-primary-accessible border-primary/40" disabled>
                  <CheckCircle2 className="icon-sm mr-1.5" aria-hidden="true" />
                  <BilingualText en={programsEn('applied')} el={programsEl('applied')} compact />
                </Button>
              )}
              <Button size="sm" variant="ghost" asChild>
                <Link href={`/programs/${program.id}`}>
                  View Details <ArrowRight className="icon-sm ml-1" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProgramSkeleton() {
  return (
    <Card><CardContent>
      <div className="flex gap-4">
        <Skeleton className="h-14 w-14 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      </div>
    </CardContent></Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ProgramsPage() {
  const { success, error: toastError } = useToast();
  const qc = useQueryClient();
  const router = useRouter();
  const { openRailSection } = usePageRail();
  // Placeholders, `title` attributes and tab labels are single-attribute or
  // single-line surfaces, so they follow the reader's primary language; every
  // full label on the page renders both.
  const { primary } = useLanguagePreference();
  const t = (key: Parameters<typeof programsEn>[0]) => (primary === 'el' ? programsEl(key) : programsEn(key));
  const [search, setSearch] = useState('');
  const [programType, setProgramType] = useState('all');
  const [status, setStatus] = useState('all');
  const [applyTarget, setApplyTarget] = useState<ProgramItem | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    // The public list is every upcoming and running program; the endpoint
    // takes no status, so "open now" and "closed" are decided below from
    // the same rule the API applies to an application.
    queryKey: qk('programs', 'public', programType),
    queryFn: () => listPrograms({
      programType: programType !== 'all' ? programType : undefined,
      limit: 50,
    }),
    staleTime: 2 * 60 * 1000,
  });

  const { data: myData } = useQuery({
    queryKey: qk('programs', 'mine'),
    queryFn: getMyPrograms,
    staleTime: 2 * 60 * 1000,
  });

  const enrolledIds = useMemo(
    () => new Set((myData?.programs ?? []).map((p) => p.id)),
    [myData],
  );

  const applyMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      applyToProgram(id, note ? { coverNote: note } : undefined),
    onSuccess: () => {
      success('Application submitted!');
      setApplyTarget(null);
      qc.invalidateQueries({ queryKey: qk('programs') });
    },
    onError: () => toastError('Failed to submit application'),
  });

  const allPrograms = data?.programs ?? [];
  const filtered = useMemo(() => {
    const byStatus = allPrograms.filter((p) =>
      status === 'all' ? true
        : status === 'open' ? acceptsApplications(p)
          : status === 'closed' ? !acceptsApplications(p)
            : p.status === status,
    );
    if (!search) return byStatus;
    const q = search.toLowerCase();
    return byStatus.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        p.organization?.name?.toLowerCase().includes(q) ||
        p.industries.some((i) => i.toLowerCase().includes(q)),
    );
  }, [allPrograms, search, status]);

  const openPrograms  = filtered.filter((p) => acceptsApplications(p));
  const myPrograms    = (myData?.programs ?? []);
  const hasFilters    = programType !== 'all' || status !== 'all' || !!search;

  const featuredPrograms = openPrograms.filter((p) => {
    const d = daysUntil(p.applicationDeadline);
    return d !== null && d >= 0 && d <= 14; // closing within 14 days = "featured/urgent"
  });

  // Offered to the assistant: type and status, the list tab, Refresh, and
  // Apply, which opens the same form (the application is sent from there).
  const [tab, setTab] = useState('all');
  const typeKeys = ['all', 'accelerator', 'incubator', 'bootcamp', 'competition', 'cohort'] as const;
  const statusKeys = ['all', 'open', 'upcoming', 'active', 'closed'] as const;
  usePageList([
    {
      id: 'programs',
      labelEn: 'Programs',
      labelEl: 'Προγράμματα',
      rows: isLoading ? undefined : (tab === 'mine' ? myPrograms : tab === 'open' ? openPrograms : filtered).map((p) =>
        `${p.title}${p.organization?.name ? ` · ${p.organization.name}` : ''} · ${p.programType} · ${p.status}${p.applicationDeadline ? ` · apply by ${p.applicationDeadline.slice(0, 10)}` : ''}${enrolledIds.has(p.id) ? ' · applied' : ''}`,
      ),
      total: data?.total,
    },
  ]);
  usePageControls([
    choiceControl('program_type', 'Program type', 'Τύπος προγράμματος', typeKeys.map((k) => ({ value: k, en: programsEn(`type_${k}`), el: programsEl(`type_${k}`) })), programType, setProgramType),
    choiceControl('program_status', 'Program status', 'Κατάσταση προγράμματος', statusKeys.map((k) => ({ value: k, en: programsEn(`status_${k}`), el: programsEl(`status_${k}`) })), status, setStatus),
    choiceControl('program_tab', 'Program list', 'Λίστα προγραμμάτων', (['all', 'open', 'mine'] as const).map((k) => ({ value: k, en: programsEn(`tab_${k}`), el: programsEl(`tab_${k}`) })), tab, setTab),
    { id: 'refresh', labelEn: 'Refresh programs', labelEl: 'Ανανέωση προγραμμάτων', writes: false, run: () => void refetch() },
    { id: 'apply_to_program', labelEn: 'Open the application for', labelEl: 'Άνοιγμα αίτησης για', writes: false, options: rowOptions(openPrograms.filter((p) => !enrolledIds.has(p.id)), (p) => p.id, (p) => p.title), run: (v) => { const p = allPrograms.find((x) => x.id === v); if (p) setApplyTarget(p); } },
  ]);

  /*
   * The column leads with the search and the programmes. The four counts and
   * the type and status selects sat above them; they live in the rail now.
   * Refresh stays in the header: it is this page's recalculation.
   */
  const listingFilters = (programType !== 'all' ? 1 : 0) + (status !== 'all' ? 1 : 0);
  const rail: PageRailSection[] = [
    {
      id: 'summary',
      glyph: 'award',
      labelEn: 'At a glance',
      labelEl: 'Με μια ματιά',
      content: (
        <RailStats
          items={[
            { key: 'total', label: programsEn('stat_total'), labelEl: programsEl('stat_total'), value: isLoading ? '—' : (data?.total ?? 0), icon: Award, tone: 'bg-status-accent-bg text-status-accent' },
            { key: 'open', label: programsEn('stat_open'), labelEl: programsEl('stat_open'), value: isLoading ? '—' : openPrograms.length, icon: Zap, tone: 'bg-status-success-bg text-status-success' },
            { key: 'applied', label: programsEn('stat_applied'), labelEl: programsEl('stat_applied'), value: myPrograms.length, icon: CheckCircle2, tone: 'bg-status-info-bg text-status-info' },
            { key: 'remote', label: programsEn('stat_remote'), labelEl: programsEl('stat_remote'), value: isLoading ? '—' : filtered.filter((p) => p.isRemote).length, icon: Globe, tone: 'bg-status-warning-bg text-status-warning' },
          ]}
        />
      ),
    },
    {
      id: 'filters',
      glyph: 'sliders',
      labelEn: 'Filters',
      labelEl: 'Φίλτρα',
      badge: listingFilters || null,
      content: (
        <div className="space-y-4">
          <RailOptions
            title="Program type"
            titleEl="Τύπος προγράμματος"
            options={typeKeys.map((k) => ({ value: k, en: programsEn(`type_${k}`), el: programsEl(`type_${k}`) }))}
            value={programType}
            onChange={setProgramType}
          />
          <RailOptions
            title="Status"
            titleEl="Κατάσταση"
            options={statusKeys.map((k) => ({ value: k, en: programsEn(`status_${k}`), el: programsEl(`status_${k}`) }))}
            value={status}
            onChange={setStatus}
          />
          {listingFilters > 0 && (
            <RailAction icon={X} en="Clear filters" el="Καθαρισμός φίλτρων" onClick={() => { setProgramType('all'); setStatus('all'); }} />
          )}
        </div>
      ),
    },
    {
      id: 'related',
      glyph: 'flag',
      labelEn: 'Linked pages',
      labelEl: 'Συνδεδεμένες σελίδες',
      content: (
        <div className="space-y-1">
          <RailAction icon={Handshake} en="Open opportunities" el="Άνοιγμα ευκαιριών" onClick={() => router.push('/opportunities')} />
          <RailAction icon={Briefcase} en="Open jobs" el="Άνοιγμα θέσεων" onClick={() => router.push('/jobs')} />
          <RailAction icon={FileText} en="Open applications" el="Άνοιγμα αιτήσεων" onClick={() => router.push('/builder/applications')} />
        </div>
      ),
    },
  ];

  return (
    <AppShell
      showHelp
      rail={rail}
      actions={
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
          {isRefetching ? <Loader2 className="icon-sm animate-spin mr-1.5" /> : <RefreshCw className="icon-sm mr-1.5" />}
          <BilingualText en={programsEn('refresh')} el={programsEl('refresh')} compact />
        </Button>
      }
    >
      <div className="space-y-6">

        {/* Search — type and status live in the rail. */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
          <Input
            aria-label={bilingualAria('Search programs', 'Αναζήτηση προγραμμάτων')}
            placeholder={t('search_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label={bilingualAria('Clear search', 'Καθαρισμός αναζήτησης')}
              className="absolute right-2 top-1/2 inline-flex tap-target -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              {/* Decorative: the button is named by its aria-label. */}
              <X className="icon-sm" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Featured programs quick-chips */}
        {featuredPrograms.length > 0 && !hasFilters && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Zap className="icon-sm text-muted-foreground" aria-hidden="true" />
              <BilingualText en={programsEn('featured')} el={programsEl('featured')} compact />
            </p>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {featuredPrograms.slice(0, 4).map((p) => {
                const d = daysUntil(p.applicationDeadline);
                return (
                  <div key={p.id} className="shrink-0 rounded-xl border border-border bg-card p-3 w-56 hover:border-primary/30 transition-colors cursor-pointer" onClick={() => setApplyTarget(p)} {...pressableProps()}>
                    <p className="text-xs font-semibold text-foreground line-clamp-1">{p.title}</p>
                    <p className="text-2xs text-muted-foreground mt-0.5 truncate">{p.organization?.name}</p>
                    <div className="mt-2 flex items-center justify-between">
                      {d !== null && d >= 0 ? (
                        <span className={cn('text-2xs font-medium', d <= 3 ? cn(STATUS.danger.icon) : cn(STATUS.warning.icon))}>
                          {d === 0
                            ? <BilingualText en="Today!" el="Σήμερα!" compact />
                            : <BilingualText en={`${d}d left`} el={`${d} ημ. ακόμη`} compact />}
                        </span>
                      ) : <span />}
                      <Badge variant="outline" className={cn('text-2xs px-1.5 capitalize border', STATUS[PROGRAM_STATUS_TONE[p.status] ?? 'neutral'].chip)}><BilingualText en={badgeStatus(p.status).en} el={badgeStatus(p.status).el} compact /></Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tabs: All / Open / My Applications */}
        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="all">
                {t('tab_all')} {filtered.length > 0 && `(${filtered.length})`}
              </TabsTrigger>
              <TabsTrigger value="open">
                {t('tab_open')} {openPrograms.length > 0 && `(${openPrograms.length})`}
              </TabsTrigger>
              <TabsTrigger value="mine">
                {t('tab_mine')} {myPrograms.length > 0 && `(${myPrograms.length})`}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* All Programs */}
          <TabsContent value="all" className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <ProgramSkeleton key={i} />)}
              </div>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Award className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <p className="font-medium text-lg"><BilingualText en={programsEn('none_found')} el={programsEl('none_found')} compact /></p>
                  <p className="text-sm text-muted-foreground mt-1"><BilingualText en={programsEn('none_found_hint')} el={programsEl('none_found_hint')} wrap /></p>
                  {listingFilters > 0 ? (
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => openRailSection('filters')}>
                      <BilingualText en="Show filters" el="Εμφάνιση φίλτρων" compact />
                    </Button>
                  ) : search ? (
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => setSearch('')}>
                      <BilingualText en="Clear search" el="Καθαρισμός αναζήτησης" compact />
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{filtered.length} program{filtered.length !== 1 ? 's' : ''} found</p>
                {filtered.map((p) => (
                  <ProgramCard key={p.id} program={p} isEnrolled={enrolledIds.has(p.id)} onApply={setApplyTarget} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Open Programs */}
          <TabsContent value="open" className="mt-4">
            {openPrograms.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Zap className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="font-medium"><BilingualText en={programsEn('none_open')} el={programsEl('none_open')} compact /></p>
                  <p className="text-sm text-muted-foreground mt-1"><BilingualText en={programsEn('none_open_hint')} el={programsEl('none_open_hint')} wrap /></p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {openPrograms.map((p) => (
                  <ProgramCard key={p.id} program={p} isEnrolled={enrolledIds.has(p.id)} onApply={setApplyTarget} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* My Applications */}
          <TabsContent value="mine" className="mt-4">
            {myPrograms.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <BookmarkCheck className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="font-medium"><BilingualText en={programsEn('none_applied')} el={programsEl('none_applied')} compact /></p>
                  <p className="text-sm text-muted-foreground mt-1"><BilingualText en={programsEn('none_applied_hint')} el={programsEl('none_applied_hint')} wrap /></p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {myPrograms.map((p) => (
                  <ProgramCard key={p.id} program={p} isEnrolled={true} onApply={setApplyTarget} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <ApplyModal
        program={applyTarget}
        open={!!applyTarget}
        onClose={() => setApplyTarget(null)}
        onApply={(note) => applyTarget && applyMutation.mutate({ id: applyTarget.id, note })}
        isApplying={applyMutation.isPending}
      />
    </AppShell>
  );
}

