'use client';

import { useMemo, useState } from 'react';
import {
  FileText,
  Search,
  Filter,
  Calendar,
  Star,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast';
import { useCurrentOrg } from '@/hooks/useCurrentOrg';
import {
  listOrganizationPrograms,
  getProgramParticipants,
  updateProgramParticipant,
  type ProgramParticipantItem,
} from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyOrgApplications } from '@/components/common/EmptyStates';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { STATUS, type StatusTone } from '@/lib/semantic-colors';
import { qk } from '@/lib/query-keys';
import { choiceControl, ROW_GONE, rowOptions, settle, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualInline } from '@/lib/i18n/format';
import { StatusText } from '@/components/common/StatusText';
import { formatDate } from '@/lib/i18n/format';

/**
 * An application is a program participant whose status says so.
 *
 * `/api/programs/:id/participants` and its PATCH sibling have existed all
 * along. The endpoint also returned a bare array while the client declared
 * `{ participants }`, so even a page that had called it would have read
 * undefined — fixed on the API side in the same change as this.
 *
 * `applied` and `accepted` are the schema's words; the page's vocabulary is
 * wider than the schema's, so `under_review` and `shortlisted` have no
 * counterpart yet and nothing is mapped onto them.
 */
const PARTICIPANT_TO_APPLICATION: Record<string, Application['status']> = {
  applied: 'pending',
  accepted: 'accepted',
  active: 'accepted',
  completed: 'accepted',
  rejected: 'rejected',
  dropped: 'rejected',
};

/** "Founder at Taverna OS" names the startup; a participant row carries no other field for it. */
function startupOf(headline: string | null | undefined): string | null {
  const match = headline?.match(/\bat\s+(.+)$/i);
  return match ? match[1] : null;
}

/** "23 Sep 2026" from the ISO timestamp the API sends. */
function submittedOn(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : formatDate(d, 'en', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function toApplication(
  row: ProgramParticipantItem,
  programTitle: string,
  programId: string,
): Application & { programId: string } {
  const founder = row.user.profile?.displayName ?? '\u2014';
  return {
    id: row.id,
    programId,
    // The startup was the founder's name twice over ("Sofia Alexiou, by Sofia
    // Alexiou"); the headline is where a participant row names it.
    startupName: startupOf(row.user.profile?.headline) ?? row.user.profile?.displayName ?? 'Unnamed applicant',
    founderName: founder,
    founderAvatar: row.user.profile?.avatarUrl ?? undefined,
    program: programTitle,
    // A participant row has no industry or stage; `role` is "participant",
    // which was printed where the stage belongs.
    industry: '',
    stage: '',
    location: row.user.profile?.location ?? undefined,
    submittedAt: submittedOn(row.appliedAt),
    submittedIso: row.appliedAt,
    status: PARTICIPANT_TO_APPLICATION[row.status] ?? 'pending',
    score: row.score ?? undefined,
  };
}

type Application = {
  id: string;
  startupName: string;
  logoUrl?: string;
  founderName: string;
  founderAvatar?: string;
  program: string;
  industry: string;
  stage: string;
  location?: string;
  submittedAt: string;
  submittedIso?: string;
  /** The schema's three: applied (pending), accepted, rejected. */
  status: 'pending' | 'accepted' | 'rejected';
  score?: number;
  reviewedBy?: string;
};

type ApplicationStatus = Application['status'];

const APPLICATION_STATUS: Record<ApplicationStatus, { tone: StatusTone; icon: React.ElementType }> = {
  pending: { tone: 'neutral', icon: Clock },
  accepted: { tone: 'success', icon: CheckCircle2 },
  rejected: { tone: 'danger', icon: XCircle },
};

type DecideFn = (application: Application, status: 'accepted' | 'rejected') => Promise<PageControlRunResult>;

function ApplicationCard({
  onReview,
  application,
  onDecide,
}: {
  application: Application;
  /** Absent for the illustrative rows, which have nothing to write to. */
  onDecide?: DecideFn;
  /** Opens the review dialog; the row title and the menu item both use it. */
  onReview: (application: Application) => void;
}) {
  const config = APPLICATION_STATUS[application.status];
  const statusColors = STATUS[config.tone];
  const StatusIcon = config.icon;
  const initials = application.startupName?.[0]?.toUpperCase() ?? '?';

  return (
    <Card className="transition-all hover:border-primary/30">
      <CardContent>
        <div className="flex gap-4">
          <Avatar className="icon-md rounded-lg">
            <AvatarImage src={application.logoUrl} />
            <AvatarFallback className="rounded-lg bg-primary/10 text-primary-accessible font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                {/* Linked to /org/applications/:id, a route that never existed. */}
                <button
                  type="button"
                  onClick={() => onReview(application)}
                  className="text-left font-medium hover:text-primary-accessible transition-colors"
                >
                  {application.startupName}
                </button>
                <p className="text-sm text-muted-foreground">
                  {[application.founderName, application.industry, application.location].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn('text-xs flex items-center gap-1 border', statusColors.chip)}>
                  <StatusIcon className="icon-sm" />
                  <StatusText value={application.status} />
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button aria-label="More options" variant="ghost" size="icon">
                      <MoreVertical className="icon-sm" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onReview(application)}><BilingualText en="Review Application" el="Έλεγχος αίτησης" compact /></DropdownMenuItem>
                    {/*
                      * "Mark as Shortlisted" and "Schedule Interview" are gone
                      * rather than left inert: the participant status enum has
                      * no shortlisted state and there is no interview to
                      * schedule against. Accept and Reject write the two
                      * statuses that do exist.
                      */}
                    <DropdownMenuItem
                      className={STATUS.success.text}
                      disabled={!onDecide || application.status === 'accepted'}
                      onClick={() => onDecide?.(application, 'accepted')}
                    >
                      <BilingualText en="Accept" el="Αποδοχή" compact />
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive-accessible"
                      disabled={!onDecide || application.status === 'rejected'}
                      onClick={() => onDecide?.(application, 'rejected')}
                    >
                      <BilingualText en="Reject" el="Απόρριψη" compact />
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
              <span>{application.program}</span>
              {application.stage ? <span><StatusText value={application.stage} /></span> : null}
              <span className="flex items-center gap-1">
                <Calendar className="icon-sm" aria-hidden="true" />
                {application.submittedAt}
              </span>
              {application.score !== undefined && (
                <span className="flex items-center gap-1">
                  <Star className={cn('icon-sm', STATUS.warning.icon)} />
                  <BilingualText en={`Score: ${application.score}/100`} el={`Βαθμολογία: ${application.score}/100`} compact />
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


export default function OrgApplicationsPage() {
  const [search, setSearch] = useState('');
  const [program, setProgram] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('all');

  /*
   * Applications are participants at `applied`, across the organisation's
   * programs. One request per program because the endpoint is scoped to a
   * program — `useQueries` keeps them parallel and independently cached.
   * The illustrative rows below are what an organisation with no
   * applications sees; they carry no decision handler, because there is
   * nothing behind them to write to.
   */
  const { slug, membership } = useCurrentOrg();
  const organizationId = membership?.organizationId ?? null;
  const qc = useQueryClient();
  const { success, error: showError } = useToast();

  const { data: programsData } = useQuery({
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

  const live = useMemo(
    () =>
      participantQueries.flatMap((query, index) => {
        const program = programs[index];
        if (!program) return [];
        return (query.data?.participants ?? []).map((row) =>
          toApplication(row, program.title, program.id),
        );
      }),
    [participantQueries, programs],
  );

  const decide = useMutation({
    mutationFn: ({
      programId,
      participantId,
      status,
    }: {
      programId: string;
      participantId: string;
      status: 'accepted' | 'rejected';
    }) => updateProgramParticipant(programId, participantId, { status }),
    onSuccess: (_result, variables) => {
      void qc.invalidateQueries({ queryKey: qk('org', 'participants', variables.programId) });
      success(variables.status === 'accepted' ? 'Application accepted' : 'Application rejected');
    },
    onError: (err) =>
      showError('Could not record the decision', err instanceof Error ? err.message : undefined),
  });

  const [reviewing, setReviewing] = useState<Application | null>(null);

  // Settles with the server: the decision is reported only once stored.
  const onDecide: DecideFn = (application, status) => {
    const programId = (application as Application & { programId?: string }).programId;
    if (!programId) return Promise.resolve({ error: 'This application is not linked to a programme.' });
    return settle(() => decide.mutateAsync({ programId, participantId: application.id, status }));
  };

  /*
   * An organisation with no applications used to see five invented ones
   * (DataVault, "AI Accelerator 2025") - outside the showcase too. It now
   * sees the empty state; the showcase has real rows behind it.
   */
  const isLive = live.length > 0;
  const applications: Application[] = useMemo(
    () =>
      [...live].sort((a, b) =>
        a.status === 'pending' && b.status !== 'pending' ? -1
          : b.status === 'pending' && a.status !== 'pending' ? 1
            : (b.submittedIso ?? '').localeCompare(a.submittedIso ?? ''),
      ),
    [live],
  );
  void slug;


  const filteredApplications = applications.filter((a) => {
    const matchesSearch =
      !search ||
      a.startupName.toLowerCase().includes(search.toLowerCase()) ||
      a.founderName.toLowerCase().includes(search.toLowerCase());
    const matchesProgram = program === 'all' || a.program === program;
    const matchesTab = activeTab === 'all' || a.status === activeTab;
    return matchesSearch && matchesProgram && matchesTab;
  });

  /** Program names present in the rows on screen, for the filter. */
  const programNames = [...new Set(applications.map((a) => a.program))];

  const statusCounts = {
    all: applications.length,
    pending: applications.filter((a) => a.status === 'pending').length,
    accepted: applications.filter((a) => a.status === 'accepted').length,
    rejected: applications.filter((a) => a.status === 'rejected').length,
  };

  const filtersActive = !!search || program !== 'all' || activeTab !== 'all';
  const clearFilters = () => { setSearch(''); setProgram('all'); setActiveTab('all'); };

  // Offered to the assistant: status and program filters, opening a review,
  // and accept / reject - the decision the review dialog records, refused on
  // the illustrative rows, which have nothing behind them.
  const undecided = filteredApplications.filter((a) => a.status !== 'accepted' && a.status !== 'rejected');
  const byStartup = (list: Application[]) => rowOptions(list, (a) => a.id, (a) => a.startupName);
  const sampleEn = isLive ? undefined : 'These applications are illustrative; there is nothing behind them to decide.';
  const sampleEl = isLive ? undefined : 'Οι αιτήσεις είναι ενδεικτικές· δεν υπάρχει κάτι πίσω τους για απόφαση.';
  usePageList([
    {
      id: 'applications',
      labelEn: 'Applications',
      labelEl: 'Αιτήσεις',
      rows: filteredApplications.map((a) => `${a.startupName} · ${a.founderName} · ${a.program} · ${a.industry}, ${a.stage} · ${a.status.replace('_', ' ')}${a.score != null ? ` · score ${a.score}` : ''}`),
      total: applications.length,
      sample: !isLive,
    },
  ]);
  usePageControls([
    choiceControl('status_tab', 'Application status', 'Κατάσταση αίτησης', [
      { value: 'all', en: 'All', el: 'Όλες' },
      { value: 'pending', en: 'Pending', el: 'Σε αναμονή' },
      { value: 'accepted', en: 'Accepted', el: 'Εγκεκριμένες' },
      { value: 'rejected', en: 'Rejected', el: 'Απορριφθείσες' },
    ], activeTab, setActiveTab),
    choiceControl('program_filter', 'Program filter', 'Φίλτρο προγράμματος', [{ value: 'all', en: 'All programs', el: 'Όλα τα προγράμματα' }, ...programNames.map((p) => ({ value: p, en: p, el: p }))], program, setProgram),
    { id: 'clear_filters', labelEn: 'Clear the application filters', labelEl: 'Καθαρισμός φίλτρων αιτήσεων', writes: false, unavailableEn: filtersActive ? undefined : 'No filter is set.', unavailableEl: filtersActive ? undefined : 'Δεν υπάρχει φίλτρο.', run: clearFilters },
    { id: 'review_application', labelEn: 'Review application', labelEl: 'Αξιολόγηση αίτησης', writes: false, options: byStartup(filteredApplications), run: (v) => { const a = applications.find((x) => x.id === v); if (a) setReviewing(a); } },
    { id: 'accept_application', labelEn: 'Accept application', labelEl: 'Αποδοχή αίτησης', writes: true, options: byStartup(undecided), unavailableEn: sampleEn, unavailableEl: sampleEl, run: (v) => { const a = applications.find((x) => x.id === v); return a ? onDecide(a, 'accepted') : ROW_GONE; } },
    { id: 'reject_application', labelEn: 'Reject application', labelEl: 'Απόρριψη αίτησης', writes: true, options: byStartup(undecided), unavailableEn: sampleEn, unavailableEl: sampleEl, run: (v) => { const a = applications.find((x) => x.id === v); return a ? onDecide(a, 'rejected') : ROW_GONE; } },
  ]);

  return (
    <AppShell showHelp
      title="Applications"
      description="Review and score startup applications across all your open programs."
    >
      <div className="space-y-6">

        {/* Stats: the three states an application can be in, and the whole. */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {[
            { label: 'Total', labelEl: 'Σύνολο', value: statusCounts.all, tone: '' },
            { label: 'Pending', labelEl: 'Σε αναμονή', value: statusCounts.pending, tone: STATUS.warning.icon },
            { label: 'Accepted', labelEl: 'Εγκεκριμένες', value: statusCounts.accepted, tone: STATUS.success.icon },
            { label: 'Rejected', labelEl: 'Απορριφθείσες', value: statusCounts.rejected, tone: STATUS.danger.icon },
          ].map((kpi) => (
            <Card key={kpi.label}>
              <CardContent>
                <p className="text-sm text-muted-foreground"><BilingualText en={kpi.label} el={kpi.labelEl} compact wrap /></p>
                <p className={cn('page-stat text-xl font-semibold tabular-nums sm:text-2xl', kpi.tone)}>{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs: In review and Shortlisted had no status behind them and read 0 forever. */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all"><BilingualText en={`All (${statusCounts.all})`} el={`Όλες (${statusCounts.all})`} compact /></TabsTrigger>
            <TabsTrigger value="pending"><BilingualText en={`Pending (${statusCounts.pending})`} el={`Σε αναμονή (${statusCounts.pending})`} compact /></TabsTrigger>
            <TabsTrigger value="accepted"><BilingualText en={`Accepted (${statusCounts.accepted})`} el={`Εγκεκριμένες (${statusCounts.accepted})`} compact /></TabsTrigger>
            <TabsTrigger value="rejected"><BilingualText en={`Rejected (${statusCounts.rejected})`} el={`Απορριφθείσες (${statusCounts.rejected})`} compact /></TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" aria-hidden="true" />
            <Input
              aria-label={bilingualInline('Search applications', 'Αναζήτηση αιτήσεων')}
              placeholder={bilingualInline('Search applications…', 'Αναζήτηση αιτήσεων…')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={program} onValueChange={setProgram}>
            <SelectTrigger aria-label="Program. Πρόγραμμα" className="w-full sm:w-[200px]">
              <SelectValue placeholder={bilingualInline('Program', 'Πρόγραμμα')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all"><BilingualText en="All Programs" el="Όλα τα προγράμματα" compact /></SelectItem>
              {programNames.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Applications List */}
        <div className="space-y-3">
          {filteredApplications.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              onDecide={isLive ? onDecide : undefined}
              onReview={setReviewing}
            />
          ))}
          {filteredApplications.length === 0 && (
            <EmptyOrgApplications filtersActive={filtersActive} onClearFilters={clearFilters} />
          )}
        </div>
      </div>
      <Dialog open={reviewing !== null} onOpenChange={(o) => { if (!o) setReviewing(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{reviewing?.startupName}</DialogTitle>
            <DialogDescription>
              {reviewing ? `by ${reviewing.founderName} · ${reviewing.program}` : ''}
            </DialogDescription>
          </DialogHeader>
          {reviewing && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground"><BilingualText en="Status" el="Κατάσταση" compact /></dt>
              <dd><StatusText value={reviewing.status} /></dd>
              {reviewing.industry ? (
                <>
                  <dt className="text-muted-foreground"><BilingualText en="Industry" el="Κλάδος" compact /></dt>
                  <dd>{reviewing.industry}</dd>
                </>
              ) : null}
              {reviewing.location ? (
                <>
                  <dt className="text-muted-foreground"><BilingualText en="Location" el="Τοποθεσία" compact /></dt>
                  <dd>{reviewing.location}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground"><BilingualText en="Submitted" el="Υποβλήθηκε" compact /></dt>
              <dd>{reviewing.submittedAt}</dd>
              {reviewing.score != null && (
                <>
                  <dt className="text-muted-foreground"><BilingualText en="Score" el="Βαθμός" compact /></dt>
                  <dd>{reviewing.score}</dd>
                </>
              )}
            </dl>
          )}
          <DialogFooter className="gap-2">
            {reviewing && isLive ? (
              <>
                <Button
                  variant="outline"
                  disabled={reviewing.status === 'rejected'}
                  onClick={() => { void onDecide(reviewing, 'rejected'); setReviewing(null); }}
                >
                  <BilingualText en="Reject" el="Απόρριψη" compact />
                </Button>
                <Button
                  disabled={reviewing.status === 'accepted'}
                  onClick={() => { void onDecide(reviewing, 'accepted'); setReviewing(null); }}
                >
                  <BilingualText en="Accept" el="Αποδοχή" compact />
                </Button>
              </>
            ) : (
              <p className="text-xs text-muted-foreground"><BilingualText en="Sample application - decisions write only to live applications." el="Δείγμα αίτησης — οι αποφάσεις γράφονται μόνο σε πραγματικές αιτήσεις." wrap /></p>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
