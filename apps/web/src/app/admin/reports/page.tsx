'use client';

import { StatusText } from '@/components/common/StatusText';
import { useState } from 'react';
import Link from 'next/link';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Flag,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  MoreVertical,
  MessageSquare,
  User,
  FileText,
  RefreshCw,
  Download,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { usePageRail } from '@/components/layout/PageRailContext';
import { BilingualText } from '@/components/common/BilingualText';
import { downloadCsv } from '@/lib/csv';
import { choiceControl, usePageControls, usePageList, type PageControl } from '@/lib/page-controls';
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast';
import { RelativeTime } from '@/components/common/RelativeTime';
import { formatRelativeTime } from '@/lib/utils';
import { listAdminReports, resolveAdminReport, type AdminReportItem } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { qk } from '@/lib/query-keys';
import { useDemoData } from '@/contexts/DemoDataContext';
import { bilingualInline } from '@/lib/i18n/format';

/**
 * The page's own row from the moderation queue row.
 *
 * `/api/admin/reports` and `resolveAdminReport` have existed all along; this
 * screen listed a fixed array and its two menu items had no handler.
 *
 * `priority` has no field on the model. Rather than invent one, it is derived
 * from the report type: harassment is the category a moderator should see
 * first, and that is a rule stated here rather than a number pretending to be
 * measured.
 */
const REPORT_TYPE_MAP: Record<string, Report['type']> = {
  spam: 'spam',
  harassment: 'user',
  fake: 'user',
  inappropriate: 'content',
  other: 'content',
};

const REPORT_PRIORITY: Record<string, Report['priority']> = {
  harassment: 'high',
  fake: 'high',
  inappropriate: 'medium',
  spam: 'medium',
  other: 'low',
};

function toPageReport(row: AdminReportItem): Report {
  return {
    id: row.id,
    type: REPORT_TYPE_MAP[row.type] ?? 'content',
    reason: row.reason,
    reporterName: row.reporter?.name ?? row.reporter?.email ?? '\u2014',
    targetName: row.reported?.name ?? row.reported?.email ?? '\u2014',
    targetType: row.reported?.role ?? 'user',
    status: row.status === 'reviewed' ? 'reviewing' : row.status,
    priority: REPORT_PRIORITY[row.type] ?? 'low',
    createdAt: row.createdAt,
    targetId: row.reported?.id,
    reporterId: row.reporter?.id,
    reporterEmail: row.reporter?.email,
    context: row.context,
  };
}

type Report = {
  id: string;
  type: 'user' | 'message' | 'content' | 'spam';
  reason: string;
  description?: string;
  reporterName: string;
  reporterAvatar?: string;
  targetName: string;
  targetType: string;
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  /** Live rows only: the reported and reporting accounts. */
  targetId?: string;
  reporterId?: string;
  reporterEmail?: string;
  context?: unknown;
};

type ResolveFn = (report: Report, resolution: 'resolved' | 'dismissed') => void;

function ReportCard({
  report,
  onResolve,
  onView,
}: {
  onView: (report: Report) => void;
  report: Report;
  /** Absent for the illustrative rows, which have nothing to write to. */
  onResolve?: ResolveFn;
}) {
  const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
    pending: { color: 'bg-muted text-muted-foreground border-border', icon: <Clock className="icon-sm" /> },
    reviewing: { color: 'bg-status-warning-bg text-status-warning border-status-warning-border', icon: <AlertTriangle className="icon-sm" /> },
    resolved: { color: 'bg-status-success-bg text-status-success border-status-success-border', icon: <CheckCircle2 className="icon-sm" /> },
    dismissed: { color: 'bg-muted text-muted-foreground border-border', icon: <XCircle className="icon-sm" /> },
  };

  const priorityColors: Record<string, string> = {
    low: 'bg-muted text-muted-foreground',
    medium: 'bg-status-warning-bg text-status-warning',
    high: 'bg-status-danger-bg text-status-danger',
  };

  const typeIcons: Record<string, React.ReactNode> = {
    user: <User className="icon-sm" aria-hidden="true" />,
    message: <MessageSquare className="icon-sm" aria-hidden="true" />,
    content: <FileText className="icon-sm" aria-hidden="true" />,
    spam: <AlertTriangle className="icon-sm" aria-hidden="true" />,
  };

  const config = statusConfig[report.status];

  return (
    <Card className="transition-all hover:border-primary/30">
      <CardContent>
        <div className="flex gap-4">
          <div className="p-2 rounded-lg bg-secondary h-fit">
            {typeIcons[report.type]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{report.reason}</span>
                  <Badge variant="outline" className={cn('text-xs', priorityColors[report.priority])}>
                    <StatusText value={report.priority} />
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Reported: <span className="font-medium">{report.targetName}</span> ({report.targetType})
                </p>
                {report.description && (
                  <p className="card-copy text-sm text-muted-foreground mt-2 line-clamp-2">
                    {report.description}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="outline" className={cn('text-xs flex items-center gap-1', config.color)}>
                  {config.icon}
                  <StatusText value={report.status} />
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button aria-label="More options" variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="icon-sm" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {/* These three had no handler. */}
                    <DropdownMenuItem onSelect={() => onView(report)}><BilingualText en="View Details" el="Λεπτομέρειες" compact /></DropdownMenuItem>
                    {report.targetId ? (
                      <DropdownMenuItem asChild>
                        <Link href={`/admin/user-detail/${report.targetId}`}><BilingualText en="View Target" el="Προβολή στόχου" compact /></Link>
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem disabled><BilingualText en="View Target" el="Προβολή στόχου" compact /></DropdownMenuItem>
                    )}
                    {report.reporterEmail ? (
                      <DropdownMenuItem asChild>
                        <a href={`mailto:${report.reporterEmail}?subject=${encodeURIComponent(`Your report: ${report.reason}`)}`}><BilingualText en="Contact Reporter" el="Επικοινωνία με τον αναφέροντα" compact /></a>
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem disabled><BilingualText en="Contact Reporter" el="Επικοινωνία με τον αναφέροντα" compact /></DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="text-status-success"
                      disabled={!onResolve || report.status === 'resolved'}
                      onClick={() => onResolve?.(report, 'resolved')}
                    >
                      <BilingualText en="Mark Resolved" el="Σήμανση ως επιλυμένο" compact />
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-muted-foreground"
                      disabled={!onResolve || report.status === 'dismissed'}
                      onClick={() => onResolve?.(report, 'dismissed')}
                    >
                      <BilingualText en="Dismiss" el="Απόρριψη" compact />
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Avatar className="icon-sm">
                  <AvatarImage src={report.reporterAvatar} />
                  <AvatarFallback className="text-2xs">{report.reporterName[0]}</AvatarFallback>
                </Avatar>
                {report.reporterName}
              </span>
              <span><RelativeTime date={report.createdAt} format={formatRelativeTime} /></span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Shown when the moderation queue is empty. */
const SEED_REPORTS: Report[] = [
  {
    id: '1',
    type: 'user',
    reason: 'Harassment',
    description: 'User sent multiple unwanted messages after being asked to stop.',
    reporterName: 'John Doe',
    targetName: 'Mike Johnson',
    targetType: 'User',
    status: 'pending',
    priority: 'high',
    createdAt: '2025-03-21T10:00:00.000Z',
  },
  {
    id: '2',
    type: 'spam',
    reason: 'Spam Content',
    description: 'Posting promotional links in community discussions.',
    reporterName: 'Jane Smith',
    targetName: 'Tom Brown',
    targetType: 'User',
    status: 'reviewing',
    priority: 'medium',
    createdAt: '2025-03-20T10:00:00.000Z',
  },
  {
    id: '3',
    type: 'content',
    reason: 'Inappropriate Content',
    description: 'Profile contains misleading information about credentials.',
    reporterName: 'Sarah Williams',
    targetName: 'Alex Chen',
    targetType: 'Profile',
    status: 'pending',
    priority: 'medium',
    createdAt: '2025-03-19T10:00:00.000Z',
  },
  {
    id: '4',
    type: 'message',
    reason: 'Offensive Language',
    reporterName: 'David Kim',
    targetName: 'Conversation #1234',
    targetType: 'Message',
    status: 'resolved',
    priority: 'low',
    createdAt: '2025-03-18T10:00:00.000Z',
  },
];

/* The rail's filter choices: the four page types, and the derived priority. */
const TYPE_OPTIONS: { value: string; en: string; el: string }[] = [
  { value: 'all', en: 'All types', el: 'Όλοι οι τύποι' },
  { value: 'user', en: 'User', el: 'Χρήστης' },
  { value: 'message', en: 'Message', el: 'Μήνυμα' },
  { value: 'content', en: 'Content', el: 'Περιεχόμενο' },
  { value: 'spam', en: 'Spam', el: 'Spam' },
];
const PRIORITY_OPTIONS: { value: string; en: string; el: string }[] = [
  { value: 'all', en: 'Any priority', el: 'Οποιαδήποτε προτεραιότητα' },
  { value: 'high', en: 'High', el: 'Υψηλή' },
  { value: 'medium', en: 'Medium', el: 'Μεσαία' },
  { value: 'low', en: 'Low', el: 'Χαμηλή' },
];

export default function AdminReportsPage() {
  // Illustrative rows are for the showcase; a real account with nothing
  // to list sees the page's empty state, not invented people and records.
  const { showDemoData } = useDemoData();
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState<Report | null>(null);
  const [type, setType] = useState<string>('all');
  const [priority, setPriority] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('pending');
  const { openRailSection } = usePageRail();

  // Mock data
  /*
   * The real moderation queue. The illustrative rows below are what an
   * empty queue shows; they carry no resolve handler, because there is
   * nothing behind them to resolve.
   */
  const qc = useQueryClient();
  const { success, error: showError } = useToast();
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: qk('admin', 'reports'),
    queryFn: () => listAdminReports({ limit: 100 }),
    staleTime: 30_000,
    retry: 0,
  });

  const live = useMemo(() => (data?.reports ?? []).map(toPageReport), [data]);
  const isLive = live.length > 0;
  const reports: Report[] = isLive ? live : showDemoData ? SEED_REPORTS : [];

  const resolve = useMutation({
    mutationFn: ({ id, resolution }: { id: string; resolution: 'resolved' | 'dismissed' }) =>
      resolveAdminReport(id, resolution),
    onSuccess: (_r, variables) => {
      void qc.invalidateQueries({ queryKey: qk('admin', 'reports') });
      success(variables.resolution === 'resolved' ? 'Report resolved' : 'Report dismissed');
    },
    onError: (err) =>
      showError('Could not update the report', err instanceof Error ? err.message : undefined),
  });

  const onResolve: ResolveFn = (report, resolution) =>
    resolve.mutate({ id: report.id, resolution });


  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      !search ||
      r.reason.toLowerCase().includes(search.toLowerCase()) ||
      r.targetName.toLowerCase().includes(search.toLowerCase());
    const matchesType = type === 'all' || r.type === type;
    const matchesPriority = priority === 'all' || r.priority === priority;
    const matchesTab = activeTab === 'all' || r.status === activeTab;
    return matchesSearch && matchesType && matchesPriority && matchesTab;
  });

  const statusCounts = {
    all: reports.length,
    pending: reports.filter((r) => r.status === 'pending').length,
    reviewing: reports.filter((r) => r.status === 'reviewing').length,
    resolved: reports.filter((r) => r.status === 'resolved').length,
    dismissed: reports.filter((r) => r.status === 'dismissed').length,
  };
  const openHigh = reports.filter((r) => r.priority === 'high' && (r.status === 'pending' || r.status === 'reviewing')).length;
  const activeFilterCount = (type !== 'all' ? 1 : 0) + (priority !== 'all' ? 1 : 0);

  const exportCsv = () =>
    downloadCsv(
      'reports',
      ['reason', 'type', 'priority', 'status', 'reporter', 'target', 'target_type', 'filed_at'],
      filteredReports.map((r) => [r.reason, r.type, r.priority, r.status, r.reporterName, r.targetName, r.targetType, r.createdAt]),
    );

  const totals = [
    { id: 'total', en: 'Total reports', el: 'Σύνολο αναφορών', value: statusCounts.all, icon: Flag, tone: 'text-primary-accessible' },
    { id: 'pending', en: 'Pending', el: 'Σε αναμονή', value: statusCounts.pending, icon: Clock, tone: 'text-status-warning' },
    { id: 'reviewing', en: 'In review', el: 'Υπό εξέταση', value: statusCounts.reviewing, icon: AlertTriangle, tone: 'text-status-info' },
    { id: 'resolved', en: 'Resolved', el: 'Επιλυμένες', value: statusCounts.resolved, icon: CheckCircle2, tone: 'text-status-success' },
    { id: 'dismissed', en: 'Dismissed', el: 'Απορριφθείσες', value: statusCounts.dismissed, icon: XCircle, tone: 'text-muted-foreground' },
    { id: 'high', en: 'Open, high priority', el: 'Ανοιχτές, υψηλής προτεραιότητας', value: openHigh, icon: AlertTriangle, tone: 'text-status-danger' },
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
   * The page rail. The column is the queue - its status tabs, its search and
   * the report cards a moderator acts on. The four totals that opened the
   * page (the tabs already carry the same counts) are in the rail with the
   * two missing ones, dismissed and open high-priority; the type filter
   * joins a priority filter the rows always had but the page could not
   * narrow by. The totals' badge is open high-priority reports.
   */
  const rail: PageRailSection[] = [
    {
      id: 'totals',
      glyph: 'chart',
      labelEn: 'Report totals',
      labelEl: 'Σύνολα αναφορών',
      badge: openHigh || null,
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
      labelEn: 'Narrow the queue',
      labelEl: 'Φιλτράρισμα ουράς',
      badge: activeFilterCount || null,
      content: (
        <div className="space-y-4">
          <fieldset className="space-y-1.5">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <BilingualText en="Type" el="Τύπος" compact />
            </legend>
            {TYPE_OPTIONS.map((o) => filterButton(type === o.value, () => setType(o.value), o.en, o.el, o.value))}
          </fieldset>
          <fieldset className="space-y-1.5">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <BilingualText en="Priority" el="Προτεραιότητα" compact />
            </legend>
            {PRIORITY_OPTIONS.map((o) => filterButton(priority === o.value, () => setPriority(o.value), o.en, o.el, o.value))}
          </fieldset>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => { setType('all'); setPriority('all'); }}
              className="tap-target flex min-h-9 w-full items-center rounded-lg px-2.5 text-left text-sm text-primary-accessible hover:bg-muted/70"
            >
              <BilingualText en="Clear type and priority" el="Καθαρισμός τύπου και προτεραιότητας" compact wrap />
            </button>
          )}
        </div>
      ),
    },
    {
      id: 'tools',
      glyph: 'sliders',
      labelEn: 'Queue tools',
      labelEl: 'Εργαλεία ουράς',
      content: (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={cn('icon-sm shrink-0', isFetching && 'animate-spin')} aria-hidden="true" />
            <span className="min-w-0 flex-1"><BilingualText en="Refresh reports" el="Ανανέωση αναφορών" compact wrap /></span>
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={filteredReports.length === 0}
            className="tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="icon-sm shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <BilingualText en={`Export ${filteredReports.length} reports as CSV`} el={`Εξαγωγή ${filteredReports.length} αναφορών σε CSV`} compact wrap />
            </span>
          </button>
        </div>
      ),
    },
  ];

  /*
   * Offered to the assistant: the queue tab, both filters, refresh, export,
   * opening a report, and the card's Resolve / Dismiss - the same handler,
   * live reports only (sample rows carry no resolve, here or on the card).
   */
  const TAB_OPTIONS = [
    { value: 'pending', en: 'Pending', el: 'Σε αναμονή' },
    { value: 'reviewing', en: 'In review', el: 'Υπό εξέταση' },
    { value: 'resolved', en: 'Resolved', el: 'Επιλυμένες' },
    { value: 'dismissed', en: 'Dismissed', el: 'Απορριφθείσες' },
    { value: 'all', en: 'All reports', el: 'Όλες οι αναφορές' },
  ];
  const openReports = reports.filter((r) => r.status === 'pending' || r.status === 'reviewing');
  usePageList([
    {
      id: 'reports',
      labelEn: 'Reports',
      labelEl: 'Αναφορές',
      rows: isLoading ? undefined : filteredReports.map((r) =>
        `${r.reason} — ${r.targetName} (${r.targetType}) · ${r.status} · ${r.priority} priority · by ${r.reporterName}`,
      ),
      total: reports.length,
      sample: !isLive,
    },
  ]);
  const reportRows = (list: Report[]) => list.map((r) => ({ value: r.id, labelEn: `${r.reason} — ${r.targetName}`, labelEl: `${r.reason} — ${r.targetName}` }));
  const resolution = (id: string, en: string, el: string, next: 'resolved' | 'dismissed'): PageControl => ({
    id,
    labelEn: en,
    labelEl: el,
    writes: true,
    options: reportRows(openReports),
    unavailableEn: !isLive ? 'These reports are illustrative; there is nothing behind them to resolve.' : openReports.length === 0 ? 'No report is open.' : undefined,
    unavailableEl: !isLive ? 'Οι αναφορές είναι ενδεικτικές· δεν υπάρχει κάτι πίσω τους για επίλυση.' : openReports.length === 0 ? 'Καμία ανοιχτή αναφορά.' : undefined,
    run: (value) => {
      const report = reports.find((r) => r.id === value);
      if (report) onResolve(report, next);
    },
  });
  usePageControls([
    choiceControl('queue_tab', 'Queue tab', 'Καρτέλα ουράς', TAB_OPTIONS, activeTab, setActiveTab),
    choiceControl('type_filter', 'Report type filter', 'Φίλτρο τύπου αναφοράς', TYPE_OPTIONS, type, setType),
    choiceControl('priority_filter', 'Priority filter', 'Φίλτρο προτεραιότητας', PRIORITY_OPTIONS, priority, setPriority),
    { id: 'refresh', labelEn: 'Refresh reports', labelEl: 'Ανανέωση αναφορών', writes: false, run: () => void refetch() },
    {
      id: 'export_csv',
      labelEn: 'Export reports as CSV',
      labelEl: 'Εξαγωγή αναφορών σε CSV',
      writes: false,
      unavailableEn: filteredReports.length === 0 ? 'No report matches the current filters.' : undefined,
      unavailableEl: filteredReports.length === 0 ? 'Καμία αναφορά δεν ταιριάζει στα τρέχοντα φίλτρα.' : undefined,
      run: exportCsv,
    },
    {
      id: 'open_report',
      labelEn: 'Open report details',
      labelEl: 'Άνοιγμα λεπτομερειών αναφοράς',
      writes: false,
      options: reportRows(reports),
      run: (value) => setViewing(reports.find((r) => r.id === value) ?? null),
    },
    resolution('resolve_report', 'Resolve report', 'Επίλυση αναφοράς', 'resolved'),
    resolution('dismiss_report', 'Dismiss report', 'Απόρριψη αναφοράς', 'dismissed'),
  ]);

  const typeLabel = TYPE_OPTIONS.find((o) => o.value === type);
  const priorityLabel = PRIORITY_OPTIONS.find((o) => o.value === priority);

  return (
    <AppShell rail={rail}>
      <div className="space-y-6">
        {/* Tabs. Dismissed reports were reachable only under All. */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="pending">Pending ({statusCounts.pending})</TabsTrigger>
            <TabsTrigger value="reviewing">In Review ({statusCounts.reviewing})</TabsTrigger>
            <TabsTrigger value="resolved">Resolved ({statusCounts.resolved})</TabsTrigger>
            <TabsTrigger value="dismissed">Dismissed ({statusCounts.dismissed})</TabsTrigger>
            <TabsTrigger value="all">All ({statusCounts.all})</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search stays with the queue; type and priority are in the rail,
            and the line below says which are narrowing it. */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder={bilingualInline("Search reports…", "Αναζήτηση αναφορών…")}
              aria-label="Search reports by reason or target"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {activeFilterCount > 0 && (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              <BilingualText
                en={`${filteredReports.length} shown${type !== 'all' ? ` · ${typeLabel?.en}` : ''}${priority !== 'all' ? ` · ${priorityLabel?.en} priority` : ''}`}
                el={`${filteredReports.length} εμφανίζονται${type !== 'all' ? ` · ${typeLabel?.el}` : ''}${priority !== 'all' ? ` · ${priorityLabel?.el} προτεραιότητα` : ''}`}
                compact
                wrap
              />
            </p>
          )}
        </div>

        {/* Reports List */}
        <div className="space-y-3">
          {filteredReports.map((report) => (
            <ReportCard key={report.id} report={report} onResolve={isLive ? onResolve : undefined} onView={setViewing} />
          ))}
          {filteredReports.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Flag className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" aria-hidden="true" />
                <h3 className="font-medium"><BilingualText en="No reports found" el="Δεν βρέθηκαν αναφορές" compact /></h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeFilterCount > 0 ? 'Nothing in this tab matches the current filters.' : 'All caught up!'}
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
      <Dialog open={viewing !== null} onOpenChange={(o) => { if (!o) setViewing(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewing?.reason}</DialogTitle>
            <DialogDescription>
              {viewing ? `${viewing.reporterName} reported ${viewing.targetName}` : ''}
            </DialogDescription>
          </DialogHeader>
          {viewing && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground"><BilingualText en="Type" el="Τύπος" compact /></dt>
              <dd className="capitalize"><StatusText value={viewing.type} /></dd>
              <dt className="text-muted-foreground"><BilingualText en="Status" el="Κατάσταση" compact /></dt>
              <dd className="capitalize"><StatusText value={viewing.status} /></dd>
              <dt className="text-muted-foreground"><BilingualText en="Priority" el="Προτεραιότητα" compact /></dt>
              <dd className="capitalize"><StatusText value={viewing.priority} /></dd>
              <dt className="text-muted-foreground"><BilingualText en="Filed" el="Υποβλήθηκε" compact /></dt>
              <dd>{new Date(viewing.createdAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC</dd>
              {viewing.description && (
                <>
                  <dt className="col-span-2 text-muted-foreground"><BilingualText en="Description" el="Περιγραφή" compact /></dt>
                  <dd className="col-span-2 whitespace-pre-line">{viewing.description}</dd>
                </>
              )}
              {viewing.context != null && (
                <>
                  <dt className="col-span-2 text-muted-foreground"><BilingualText en="Context" el="Πλαίσιο" compact /></dt>
                  <dd className="col-span-2">
                    <pre tabIndex={0} className="max-h-48 overflow-auto rounded-lg bg-muted/40 p-2 text-xs">{JSON.stringify(viewing.context, null, 2)}</pre>
                  </dd>
                </>
              )}
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
