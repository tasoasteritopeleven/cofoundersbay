'use client';

import { StatusText } from '@/components/common/StatusText';
import { useState } from 'react';
import Link from 'next/link';
import {
  FolderKanban,
  Search,
  Filter,
  MoreVertical,
  Clock,
  CheckCircle,
  AlertCircle,
  MessageSquare,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { UnavailableMenuItem } from '@/components/common/UnavailableMenuItem';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { RelativeTime } from '@/components/common/RelativeTime';
import { formatRelativeTime } from '@/lib/utils';
import { listServiceInquiries, updateServiceInquiry, type ServiceInquiryItem } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { qk } from '@/lib/query-keys';
import { CANCELLED, choiceControl, ROW_GONE, rowOptions, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { useDemoData } from '@/contexts/DemoDataContext';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualInline } from '@/lib/i18n/format';
import { CardFoot, CardHead } from '@/components/common/CardAnatomy';
import { FactLine } from '@/components/common/FactLine';

/**
 * A project is an inquiry that was accepted — the same row /provider/inquiries
 * lists before the provider agrees to the work, which is why the two screens
 * cannot disagree about a piece of work.
 *
 * `progress` and `dueDate` have no field on the model: an inquiry records what
 * was agreed and when it was resolved, not a schedule. Progress reads 0 and
 * the due date reads a dash rather than a plausible-looking week from now.
 */
function toProject(row: ServiceInquiryItem): Project {
  return {
    id: row.id,
    clientName: row.client?.displayName ?? 'A client',
    clientId: row.client?.id,
    clientAvatar: row.client?.avatarUrl ?? undefined,
    service: row.offer.title,
    status: row.status === 'completed' ? 'completed' : 'active',
    progress: row.status === 'completed' ? 100 : 0,
    startDate: row.createdAt,
    dueDate: '',
    lastUpdate: row.resolvedAt ?? row.createdAt,
    amount:
      row.agreedPrice != null
        ? new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: row.currency,
            maximumFractionDigits: 0,
          }).format(row.agreedPrice)
        : '\u2014',
  };
}

type Project = {
  id: string;
  clientName: string;
  clientAvatar?: string;
  clientCompany?: string;
  service: string;
  status: 'active' | 'completed' | 'on_hold';
  progress: number;
  startDate: string;
  dueDate: string;
  lastUpdate: string;
  amount: string;
  /** The client's user id on live rows. */
  clientId?: string;
};

type ProjectActions = {
  onView: (p: Project) => void;
  /** Absent on sample rows. */
  onComplete?: (p: Project) => void;
};

function ProjectCard({ project, onView, onComplete }: { project: Project } & ProjectActions) {
  const statusConfig: Record<string, { color: string; icon: React.ElementType }> = {
    active: { color: 'bg-status-success-bg text-status-success border-status-success-border', icon: Clock },
    completed: { color: 'bg-status-info-bg text-status-info border-status-info-border', icon: CheckCircle },
    on_hold: { color: 'bg-status-warning-bg text-status-warning border-status-warning-border', icon: AlertCircle },
  };

  const config = statusConfig[project.status];
  const StatusIcon = config.icon;

  // The Connections card: the client's avatar and name with the state beside
  // it and the company under it, the menu at the right; the service, the
  // progress, the facts and the actions start on the avatar's edge.
  return (
    <Card className="transition-all hover:border-primary/20">
      <CardContent className="space-y-3">
        <CardHead
          mark={(
            <Avatar className="h-10 w-10">
              <AvatarImage src={project.clientAvatar} alt="" />
              <AvatarFallback className="bg-primary/10 font-semibold text-primary-accessible">{project.clientName[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
          )}
          title={(
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="min-w-0 break-words">{project.clientName}</span>
              <Badge variant="outline" className={cn('text-xs', config.color)}>
                <StatusIcon className="mr-1 icon-sm" aria-hidden="true" />
                <StatusText value={project.status} />
              </Badge>
            </span>
          )}
          subtitle={project.clientCompany || undefined}
          asideStays
          aside={(
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Open project actions for ${project.clientName}`}>
                  <MoreVertical className="icon-sm" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* All four had no handler. A project is an accepted service
                    inquiry: it can be completed (status 'completed'), and
                    its client messaged; it has no progress field to set. */}
                <DropdownMenuItem onSelect={() => onView(project)}><BilingualText en="View Details" el="Λεπτομέρειες" compact /></DropdownMenuItem>
                <UnavailableMenuItem
                  en="Update Progress"
                  el="Ενημέρωση προόδου"
                  reasonEn="Projects do not track progress yet."
                  reasonEl="Τα έργα δεν καταγράφουν ακόμη πρόοδο."
                />
                {project.clientId ? (
                  <DropdownMenuItem asChild>
                    <Link href={`/messages?to=${project.clientId}`}><BilingualText en="Message Client" el="Μήνυμα στον πελάτη" compact /></Link>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem disabled><BilingualText en="Message Client" el="Μήνυμα στον πελάτη" compact /></DropdownMenuItem>
                )}
                <DropdownMenuItem
                  disabled={!onComplete || project.status === 'completed'}
                  onSelect={() => onComplete?.(project)}
                >
                  <BilingualText en="Mark Complete" el="Σήμανση ως ολοκληρωμένο" compact />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        />

        {project.service ? <p className="text-xs font-medium text-muted-foreground first-letter:uppercase">{project.service}</p> : null}

        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground"><BilingualText en="Progress" el="Πρόοδος" compact /></span>
            <span className="font-medium tabular-nums">{project.progress}%</span>
          </div>
          <Progress value={project.progress} className="h-2" />
        </div>

        <FactLine
          items={[
            <BilingualText key="due" en={`Due: ${project.dueDate || '—'}`} el={`Προθεσμία: ${project.dueDate || '—'}`} compact />,
            <span key="updated"><BilingualText en="Updated:" el="Ενημέρωση:" compact /> <RelativeTime date={project.lastUpdate} format={formatRelativeTime} /></span>,
            project.amount ? <span key="amount" className="font-medium tabular-nums text-foreground">{project.amount}</span> : null,
          ]}
        />

        <CardFoot>
          {/* Neither had a handler. */}
          {project.clientId ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/messages?to=${project.clientId}`}>
                <MessageSquare className="mr-1 icon-sm" aria-hidden="true" />
                <BilingualText en="Message" el="Μήνυμα" compact />
              </Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled title={bilingualInline('This client has no account to message', 'Ο πελάτης δεν έχει λογαριασμό για μήνυμα')}>
              <MessageSquare className="mr-1 icon-sm" aria-hidden="true" />
              <BilingualText en="Message" el="Μήνυμα" compact />
            </Button>
          )}
          <Button size="sm" disabled title="Projects do not track progress yet"><BilingualText en="Update" el="Ενημέρωση" compact /></Button>
        </CardFoot>
      </CardContent>
    </Card>
  );
}

/** Shown to a provider with no agreed work yet. */
const SEED_PROJECTS: Project[] = [
  {
    id: '1',
    clientName: 'TechStart Inc',
    clientCompany: 'TechStart Inc',
    service: 'Startup Legal Package',
    status: 'active',
    progress: 75,
    startDate: '2026-03-10T09:00:00.000Z',
    dueDate: 'Mar 25',
    lastUpdate: '2026-09-04T08:00:00.000Z',
    amount: '$2,500',
  },
  {
    id: '2',
    clientName: 'GreenTech Co',
    clientCompany: 'GreenTech Co',
    service: 'Financial Model Creation',
    status: 'active',
    progress: 40,
    startDate: '2026-03-15T09:00:00.000Z',
    dueDate: 'Mar 30',
    lastUpdate: '2026-09-03T10:00:00.000Z',
    amount: '$1,200',
  },
  {
    id: '3',
    clientName: 'DataFlow',
    clientCompany: 'DataFlow',
    service: 'Contract Review',
    status: 'on_hold',
    progress: 60,
    startDate: '2026-03-05T09:00:00.000Z',
    dueDate: 'Apr 5',
    lastUpdate: '2026-09-01T10:00:00.000Z',
    amount: '$450',
  },
  {
    id: '4',
    clientName: 'HealthPulse',
    clientCompany: 'HealthPulse',
    service: 'Startup Legal Package',
    status: 'completed',
    progress: 100,
    startDate: '2026-02-20T09:00:00.000Z',
    dueDate: 'Mar 10',
    lastUpdate: '2026-03-10T09:00:00.000Z',
    amount: '$2,500',
  },
  {
    id: '5',
    clientName: 'EduLearn',
    clientCompany: 'EduLearn',
    service: 'Financial Model Creation',
    status: 'completed',
    progress: 100,
    startDate: '2026-02-15T09:00:00.000Z',
    dueDate: 'Feb 28',
    lastUpdate: '2026-02-28T09:00:00.000Z',
    amount: '$1,200',
  },
];

export default function ProviderProjectsPage() {
  // Illustrative rows are for the showcase; a real account with nothing
  // to list sees the page's empty state, not invented people and records.
  const { showDemoData } = useDemoData();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('active');

  const { data, isLoading } = useQuery({
    queryKey: qk('provider', 'projects'),
    queryFn: () => listServiceInquiries({ side: 'provider', kind: 'projects', limit: 100 }),
    staleTime: 60_000,
    retry: 0,
  });

  const live = useMemo(() => (data?.inquiries ?? []).map(toProject), [data]);
  const projects: Project[] = live.length > 0 ? live : isLoading || !showDemoData ? [] : SEED_PROJECTS;
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const confirm = useConfirm();
  const [viewing, setViewing] = useState<Project | null>(null);
  const complete = async (p: Project): Promise<PageControlRunResult> => {
    const ok = await confirm({
      title: <BilingualText en={`Mark the project for ${p.clientName} complete?`} el={`Ολοκλήρωση του έργου για ${p.clientName};`} />,
      description: <BilingualText en="The client can then leave a review." el="Ο πελάτης μπορεί έπειτα να αφήσει αξιολόγηση." />,
      confirmLabel: <BilingualText en="Mark complete" el="Σήμανση ως ολοκληρωμένο" compact />,
    });
    if (!ok) return CANCELLED;
    try {
      await updateServiceInquiry(p.id, { status: 'completed' });
      success('Project completed', p.clientName);
    } catch (e) {
      toastError('Could not complete the project', e instanceof Error ? e.message : undefined);
      return { error: e instanceof Error && e.message ? e.message : 'The project is still open.' };
    } finally {
      void queryClient.invalidateQueries({ queryKey: qk('provider', 'projects') });
    }
  };


  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      !search ||
      p.clientName.toLowerCase().includes(search.toLowerCase()) ||
      p.service.toLowerCase().includes(search.toLowerCase());
    const matchesTab = p.status === activeTab || (activeTab === 'all');
    return matchesSearch && matchesTab;
  });

  const counts = {
    active: projects.filter((p) => p.status === 'active').length,
    on_hold: projects.filter((p) => p.status === 'on_hold').length,
    completed: projects.filter((p) => p.status === 'completed').length,
  };

  // Offered to the assistant: the tab, View Details, and Mark Complete
  // (which still asks, and is refused on the sample projects).
  const byClient = (list: Project[]) => rowOptions(list, (p) => p.id, (p) => p.clientName);
  usePageList([
    {
      id: 'projects',
      labelEn: 'Client projects',
      labelEl: 'Έργα πελατών',
      rows: isLoading ? undefined : filteredProjects.map((p) => `${p.clientName}${p.clientCompany ? ` (${p.clientCompany})` : ''} · ${p.service} · ${p.status.replace('_', ' ')} · ${p.progress}% · due ${p.dueDate} · ${p.amount}`),
      total: projects.length,
      sample: live.length === 0,
    },
  ]);
  usePageControls([
    choiceControl('project_tab', 'Project filter', 'Φίλτρο έργων', [
      { value: 'active', en: 'Active', el: 'Ενεργά' },
      { value: 'on_hold', en: 'On hold', el: 'Σε αναμονή' },
      { value: 'completed', en: 'Completed', el: 'Ολοκληρωμένα' },
    ], activeTab, setActiveTab),
    { id: 'view_project', labelEn: 'View project details', labelEl: 'Προβολή λεπτομερειών έργου', writes: false, options: byClient(filteredProjects), run: (v) => { const p = projects.find((x) => x.id === v); if (p) setViewing(p); } },
    {
      id: 'complete_project',
      labelEn: 'Mark project complete',
      labelEl: 'Ολοκλήρωση έργου',
      writes: true,
      options: byClient(filteredProjects.filter((p) => p.status !== 'completed')),
      unavailableEn: live.length > 0 ? undefined : 'These projects are samples; there is nothing behind them to complete.',
      unavailableEl: live.length > 0 ? undefined : 'Τα έργα είναι δείγματα· δεν υπάρχει κάτι πίσω τους για ολοκλήρωση.',
      run: (v) => { const p = projects.find((x) => x.id === v); return p ? complete(p) : ROW_GONE; },
    },
  ]);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
          <Input
            aria-label={bilingualInline("Search projects", "Αναζήτηση έργων")}
            placeholder={bilingualInline("Search projects…", "Αναζήτηση έργων…")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="active">
              <BilingualText en="Active" el="Ενεργά" compact /> <Badge variant="secondary" className="ml-1">{counts.active}</Badge>
            </TabsTrigger>
            <TabsTrigger value="on_hold">
              <BilingualText en="On Hold" el="Σε αναμονή" compact /> <Badge variant="secondary" className="ml-1">{counts.on_hold}</Badge>
            </TabsTrigger>
            <TabsTrigger value="completed">
              <BilingualText en="Completed" el="Ολοκληρωμένες" compact /> <Badge variant="secondary" className="ml-1">{counts.completed}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4 space-y-3">
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} onView={setViewing} onComplete={live.length > 0 ? (pr) => void complete(pr) : undefined} />
            ))}
            {filteredProjects.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" aria-hidden="true" />
                  <h3 className="card-title text-foreground"><BilingualText en="No projects found" el="Δεν βρέθηκαν έργα" compact /></h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    No {activeTab.replace('_', ' ')} projects
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
      <Dialog open={viewing !== null} onOpenChange={(o) => { if (!o) setViewing(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{viewing?.service}</DialogTitle>
            <DialogDescription>{viewing?.clientName}{viewing?.clientCompany ? ` · ${viewing.clientCompany}` : ''}</DialogDescription>
          </DialogHeader>
          {viewing && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground"><BilingualText en="Status" el="Κατάσταση" compact /></dt>
              <dd><StatusText value={viewing.status} /></dd>
              <dt className="text-muted-foreground"><BilingualText en="Agreed price" el="Συμφωνημένη τιμή" compact /></dt>
              <dd>{viewing.amount || '\u2014'}</dd>
              <dt className="text-muted-foreground"><BilingualText en="Started" el="Έναρξη" compact /></dt>
              <dd><RelativeTime date={viewing.startDate} format={formatRelativeTime} /></dd>
              <dt className="text-muted-foreground"><BilingualText en="Last update" el="Τελευταία ενημέρωση" compact /></dt>
              <dd><RelativeTime date={viewing.lastUpdate} format={formatRelativeTime} /></dd>
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
