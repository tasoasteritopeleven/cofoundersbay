'use client';

import { StatusText } from '@/components/common/StatusText';
import { Fragment, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RelativeTime } from '@/components/common/RelativeTime';
import {
  Users,
  Flag,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Ban,
  BarChart3,
  Search,
  FlaskConical,
  Zap,
  Brain,
  MoreHorizontal,
  Clock,
  RefreshCw,
  GraduationCap,
  Plus,
  Trash2,
  Calendar,
  UserCheck,
  Mail,
  Send,
  ChevronRight,
  Download,
  Star,
  StarOff,
  Layers,
  Briefcase,
  Handshake,
  MessageSquare,
} from 'lucide-react';
import {
  listAdminReports,
  listAdminUsers,
  updateAdminReport,
  updateAdminUserModeration,
  getAdminStats,
  banUser,
  unbanUser,
  changeUserRole,
  listAdminAuditLogs,
  listAdminCohorts,
  createAdminCohort,
  deleteAdminCohort,
  listAdminEmailTemplates,
  getAdminEmailTemplatePreview,
  testSendAdminEmail,
  featureContent,
  removeContent,
  listEvents,
  listJobs,
  type AdminReportItem,
  type AdminUserItem,
  type AdminPlatformStats,
  type AdminAuditLogItem,
  type AdminCohortItem,
  type AdminEmailTemplate,
} from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RailStats } from '@/components/layout/RailParts';
import type { PageRailSection } from '@/components/layout/PageRail';
import { BilingualText } from '@/components/common/BilingualText';

import { AdminAnalyticsDashboard } from '@/components/admin/AdminAnalyticsDashboard';
import { ScoreInspector } from '@/components/admin/ScoreInspector';
import { AbuseMonitorPanel } from '@/components/admin/AbuseMonitorPanel';
import { ExperimentationPanel } from '@/components/admin/ExperimentationPanel';
import { BehaviorAdminPanel } from '@/components/behavioral/BehaviorAdminPanel';
import { useToast } from '@/components/ui/toast';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { qk } from '@/lib/query-keys';
import { CANCELLED, choiceControl, ROW_GONE, rowOptions, settle, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { useConfirm, deleteConfirmCopy } from '@/components/ui/confirm-dialog';
import { bilingualInline } from '@/lib/i18n/format';

const reportTypeConfig: Record<AdminReportItem['type'], { label: string; color: string }> = {
  spam: { label: 'Spam', color: 'bg-status-warning-bg text-status-warning border-status-warning-border ' },
  harassment: { label: 'Harassment', color: 'bg-status-danger-bg text-status-danger border-status-danger-border ' },
  fake: { label: 'Fake Profile', color: 'bg-status-accent-bg text-status-accent border-status-accent-border ' },
  inappropriate: { label: 'Inappropriate', color: 'bg-status-warning-bg text-status-warning border-status-warning-border ' },
  other: { label: 'Other', color: 'bg-muted text-foreground border-border ' },
};

const reportStatusConfig: Record<AdminReportItem['status'], { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', color: 'text-status-warning ', icon: Clock },
  reviewed: { label: 'Under Review', color: 'text-status-info ', icon: Eye },
  resolved: { label: 'Resolved', color: 'text-status-success ', icon: CheckCircle },
  dismissed: { label: 'Dismissed', color: 'text-muted-foreground', icon: XCircle },
};


function EmailTemplatesTab() {
  const { success, error: showError } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: qk('admin', 'email-templates'),
    queryFn: listAdminEmailTemplates,
  });

  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: qk('admin', 'email-preview', selectedId),
    queryFn: () => getAdminEmailTemplatePreview(selectedId!),
    enabled: !!selectedId,
  });

  const templates: AdminEmailTemplate[] = listData?.templates ?? [];

  async function handleTestSend() {
    if (!selectedId || !testEmail) return;
    setSending(true);
    try {
      const result = await testSendAdminEmail(selectedId, testEmail);
      if (result.sent) success('Email sent', `Test email sent to ${testEmail}`);
      else showError('Not sent', result.reason ?? 'Email not configured');
    } catch {
      showError('Failed', 'Could not send test email');
    } finally {
      setSending(false);
    }
  }

  return (
    <TabsContent value="email" className="mt-6 space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Template list */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-semibold"><BilingualText en="Templates" el="Πρότυπα" compact /></CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {listLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 border-b border-border px-4 sm:px-6 py-3">
                  <Skeleton className="icon-sm rounded" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))
            ) : (
              templates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => setSelectedId(tpl.id)}
                  className={`flex w-full items-center justify-between gap-3 border-b border-border px-4 sm:px-6 py-3 text-left transition-colors hover:bg-secondary/50 ${
                    selectedId === tpl.id ? 'bg-secondary' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{tpl.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{tpl.description}</p>
                  </div>
                  <ChevronRight className="icon-sm shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* Preview panel */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-sm font-semibold">
                {selectedId ? `Preview: ${templates.find(t => t.id === selectedId)?.name ?? selectedId}` : 'Select a template'}
              </CardTitle>
              {selectedId && (
                <div className="flex items-center gap-2">
                  <Input
                    type="email"
                    placeholder="test@example.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="h-8 w-48 text-xs"
                  />
                  <Button
                    size="sm"
                    className="gap-1.5 h-8 text-xs"
                    onClick={handleTestSend}
                    disabled={!testEmail || sending}
                  >
                    <Send className="icon-sm" aria-hidden="true" />
                    {sending ? 'Sending…' : 'Test Send'}
                  </Button>
                </div>
              )}
            </div>
            {selectedId && preview && (
              <p className="text-xs text-muted-foreground mt-1">
                Subject: <span className="font-medium text-foreground">{preview.subject}</span>
              </p>
            )}
          </CardHeader>
          <CardContent>
            {!selectedId && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Mail className="icon-lg text-muted-foreground mb-3" aria-hidden="true" />
                <p className="text-sm text-muted-foreground"><BilingualText en="Select a template to preview it" el="Επιλέξτε πρότυπο για προεπισκόπηση" compact /></p>
              </div>
            )}
            {selectedId && previewLoading && (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-32 w-full mt-4" />
              </div>
            )}
            {selectedId && preview && !previewLoading && (
              <div className="rounded-lg border border-border overflow-hidden">
                <iframe
                  srcDoc={preview.html}
                  title="Email preview"
                  className="w-full min-h-[400px] bg-white"
                  sandbox="allow-same-origin"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  );
}

function ReportCard({
  report,
  onResolve,
  onDismiss,
  onBanUser,
  isActing,
}: {
  report: AdminReportItem;
  onResolve: () => void;
  onDismiss: () => void;
  onBanUser: () => void;
  isActing: boolean;
}) {
  const typeConf = reportTypeConfig[report.type];
  const statusConf = reportStatusConfig[report.status];
  const StatusIcon = statusConf.icon;

  return (
    <Card className="group">
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link href={`/profiles/${report.reported.id}`}>
              <Avatar className="icon-md">
                <AvatarFallback className="bg-destructive/20 text-destructive-accessible">
                  {report.reported.name?.[0]?.toUpperCase() ?? '?'}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/profiles/${report.reported.id}`} className="person-name inline-flex tap-target-y items-center font-semibold text-foreground transition-colors hover:text-primary-accessible">
                  {report.reported?.name || report.reported.email}
                </Link>
                <Badge variant="outline" className="text-xs"><StatusText value={report.reported.role} /></Badge>
                <Badge variant="outline" className={cn('text-xs', typeConf.color)}>
                  {typeConf.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Reported by {report.reporter?.name || report.reporter.email} · <RelativeTime date={report.createdAt} />
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn('flex items-center gap-1 text-xs', statusConf.color)}>
              <StatusIcon className="icon-sm" />
              {statusConf.label}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button aria-label="More options" variant="ghost" size="icon" className="h-8 w-8" disabled={isActing}>
                  <MoreHorizontal className="icon-sm" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/profiles/${report.reported.id}`}>
                    <Eye className="icon-sm mr-2" aria-hidden="true" />
                    <BilingualText en="View profile" el="Προβολή προφίλ" compact />
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onResolve} className="text-status-success">
                  <CheckCircle className="icon-sm mr-2" aria-hidden="true" />
                  <BilingualText en="Resolve" el="Επίλυση" compact />
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDismiss}>
                  <XCircle className="icon-sm mr-2" aria-hidden="true" />
                  <BilingualText en="Dismiss" el="Απόρριψη" compact />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onBanUser} className="text-destructive-accessible">
                  <Ban className="icon-sm mr-2" />
                  <BilingualText en="Ban user" el="Αποκλεισμός χρήστη" compact />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mt-3">
          <p className="text-sm text-foreground">{report.reason}</p>
        </div>

        {report.status === 'pending' && (
          <div className="mt-4 flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={onDismiss} disabled={isActing}>
              <BilingualText en="Dismiss" el="Απόρριψη" compact />
            </Button>
            <Button size="sm" onClick={onResolve} disabled={isActing}>
              <BilingualText en="Resolve" el="Επίλυση" compact />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UserRow({
  user,
  onSuspend,
  onBan,
  onActivate,
  isActing,
}: {
  user: AdminUserItem;
  onSuspend: () => void;
  onBan: () => void;
  onActivate: () => void;
  isActing: boolean;
}) {
  const displayName = user.profile?.displayName ?? user.email;

  return (
    <div className="flex items-center gap-4 border-b border-border p-4 transition-colors hover:bg-secondary/30">
      <Link href={`/profiles/${user.id}`}>
        <Avatar className="icon-md shrink-0">
          <AvatarImage src={user.profile?.avatarUrl ?? undefined} />
          <AvatarFallback className="bg-primary/20 text-primary-accessible">
            {displayName[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/profiles/${user.id}`} className="font-medium text-foreground hover:text-primary-accessible transition-colors">
            {displayName}
          </Link>
          <Badge
            variant="outline"
            className={cn(
              'text-xs',
              user.moderationStatus === 'active' ? 'text-status-success border-status-success-border' :
              user.moderationStatus === 'suspended' ? 'text-status-warning border-status-warning-border' :
              'text-status-danger border-status-danger-border',
            )}
          >
            {user.moderationStatus}
          </Badge>
        </div>
        <p className="truncate text-sm text-muted-foreground">{user.email}</p>
      </div>
      <div className="hidden text-right sm:block">
        <p className="text-sm capitalize text-foreground"><StatusText value={user.role} /></p>
        {user.lastSeenAt && (
          <p className="text-xs text-muted-foreground"><RelativeTime date={user.lastSeenAt} /></p>
        )}
      </div>
      <div className="hidden text-right md:block">
        <p className="text-sm text-foreground">{user.reportsCount} reports</p>
        <p className="text-xs text-muted-foreground">
          <BilingualText en="Joined" el="Εγγράφηκε" compact /> <RelativeTime date={user.createdAt} />
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button aria-label="More options" variant="ghost" size="icon" disabled={isActing}>
            <MoreHorizontal className="icon-sm" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/profiles/${user.id}`}>
              <Eye className="mr-2 icon-sm" aria-hidden="true" />
              <BilingualText en="View profile" el="Προβολή προφίλ" compact />
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {user.moderationStatus === 'active' && (
            <DropdownMenuItem onClick={onSuspend} className="text-status-warning ">
              <AlertTriangle className="mr-2 icon-sm" />
              <BilingualText en="Suspend" el="Αναστολή" compact />
            </DropdownMenuItem>
          )}
          {user.moderationStatus === 'suspended' && (
            <DropdownMenuItem onClick={onActivate} className="text-status-success ">
              <CheckCircle className="mr-2 icon-sm" />
              <BilingualText en="Reactivate" el="Επανενεργοποίηση" compact />
            </DropdownMenuItem>
          )}
          {user.moderationStatus !== 'banned' && (
            <DropdownMenuItem onClick={onBan} className="text-destructive-accessible">
              <Ban className="mr-2 icon-sm" />
              <BilingualText en="Ban permanently" el="Οριστικός αποκλεισμός" compact />
            </DropdownMenuItem>
          )}
          {user.moderationStatus === 'banned' && (
            <DropdownMenuItem onClick={onActivate} className="text-status-success ">
              <CheckCircle className="mr-2 icon-sm" />
              <BilingualText en="Unban" el="Άρση αποκλεισμού" compact />
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** The console's sections, grouped by the job each serves. */
const ADMIN_TAB_GROUPS: ReadonlyArray<{
  en: string;
  el: string;
  tabs: ReadonlyArray<{ value: string; en: string; el: string; icon: typeof Flag }>;
}> = [
  {
    en: 'Moderation',
    el: 'Έλεγχος',
    tabs: [
      { value: 'reports', en: 'Reports', el: 'Αναφορές', icon: Flag },
      { value: 'abuse', en: 'Abuse monitor', el: 'Καταχρήσεις', icon: AlertTriangle },
      { value: 'audit', en: 'Audit log', el: 'Αρχείο ελέγχου', icon: Shield },
    ],
  },
  {
    en: 'People',
    el: 'Άνθρωποι',
    tabs: [
      { value: 'users', en: 'Users', el: 'Χρήστες', icon: Users },
      { value: 'cohorts', en: 'Cohorts', el: 'Κύκλοι', icon: GraduationCap },
    ],
  },
  {
    en: 'Content',
    el: 'Περιεχόμενο',
    tabs: [
      { value: 'content', en: 'Events & jobs', el: 'Εκδηλώσεις & αγγελίες', icon: Layers },
      { value: 'email', en: 'Email templates', el: 'Πρότυπα email', icon: Mail },
    ],
  },
  {
    en: 'Insights',
    el: 'Αναλύσεις',
    tabs: [
      { value: 'analytics', en: 'Analytics', el: 'Αναλυτικά', icon: BarChart3 },
      { value: 'score-inspector', en: 'Score inspector', el: 'Έλεγχος βαθμολογίας', icon: BarChart3 },
      { value: 'behavior', en: 'Behaviour AI', el: 'Συμπεριφορά (AI)', icon: Brain },
      { value: 'experiments', en: 'Experiments', el: 'Πειράματα', icon: FlaskConical },
      { value: 'gamification', en: 'Gamification', el: 'Παιχνιδοποίηση', icon: Zap },
    ],
  },
];

const WIDE_QUERY = '(min-width: 1024px)';
/** True from lg up, where the console's sections become a column. */
function useWide(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(WIDE_QUERY);
      list.addEventListener?.('change', onChange);
      return () => list.removeEventListener?.('change', onChange);
    },
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
}

export default function AdminPage() {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState('reports');
  const wide = useWide();
  const [userSearch, setUserSearch] = useState('');
  const [cohortSearch, setCohortSearch] = useState('');
  const [showNewCohort, setShowNewCohort] = useState(false);
  const [newCohort, setNewCohort] = useState({ name: '', slug: '', description: '', startDate: '', endDate: '', capacity: '' });

  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: qk('admin', 'stats'),
    queryFn: () => getAdminStats(),
    staleTime: 30_000,
  });

  const { data: reportsData, isLoading: reportsLoading, refetch: refetchReports } = useQuery({
    queryKey: qk('admin', 'reports', 'home'),
    queryFn: () => listAdminReports({ limit: 100 }),
  });

  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: qk('admin', 'users', 'home', userSearch),
    queryFn: () => listAdminUsers({ q: userSearch || undefined, limit: 100 }),
  });

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: qk('admin', 'audit-logs', 'home'),
    queryFn: () => listAdminAuditLogs({ limit: 50 }),
    enabled: activeTab === 'audit',
  });

  const { data: cohortsData, isLoading: cohortsLoading, refetch: refetchCohorts } = useQuery({
    queryKey: qk('admin', 'cohorts', cohortSearch),
    queryFn: () => listAdminCohorts({ q: cohortSearch || undefined, limit: 50 }),
    enabled: activeTab === 'cohorts',
  });

  const createCohortMutation = useMutation({
    mutationFn: (data: Parameters<typeof createAdminCohort>[0]) => createAdminCohort(data),
    onSuccess: () => {
      void refetchCohorts();
      setShowNewCohort(false);
      setNewCohort({ name: '', slug: '', description: '', startDate: '', endDate: '', capacity: '' });
      success('Cohort created', 'New program created successfully.');
    },
    onError: (err) => showError('Failed', err instanceof Error ? err.message : 'Could not create cohort'),
  });

  const deleteCohortMutation = useMutation({
    mutationFn: (cohortId: string) => deleteAdminCohort(cohortId),
    onSuccess: () => { void refetchCohorts(); success('Deleted', 'Cohort removed.'); },
    onError: (err) => showError('Failed', err instanceof Error ? err.message : 'Could not delete cohort'),
  });

  const { data: eventsData, isLoading: eventsLoading, isError: eventsError, refetch: refetchEvents } = useQuery({
    queryKey: qk('events', 'admin'),
    queryFn: () => listEvents({ limit: 50 }),
    enabled: activeTab === 'content',
    retry: 1,
  });

  const { data: jobsData, isLoading: jobsLoading, isError: jobsError, refetch: refetchJobs } = useQuery({
    queryKey: qk('jobs', 'admin'),
    queryFn: () => listJobs({ limit: 50 }),
    enabled: activeTab === 'content',
    retry: 1,
  });

  const featureMutation = useMutation({
    mutationFn: ({ type, id, featured }: { type: 'event' | 'group' | 'job'; id: string; featured: boolean }) =>
      featureContent(type, id, featured),
    onSuccess: (_, { featured }) => {
      queryClient.invalidateQueries({ queryKey: qk('events') });
      queryClient.invalidateQueries({ queryKey: qk('jobs') });
      success(featured ? 'Featured' : 'Unfeatured', 'Content visibility updated.');
    },
    onError: (err) => showError('Failed', err instanceof Error ? err.message : 'Please try again'),
  });

  const removeContentMutation = useMutation({
    mutationFn: ({ type, id }: { type: 'event' | 'group' | 'job'; id: string }) =>
      removeContent(type, id, 'Removed by admin'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('events') });
      queryClient.invalidateQueries({ queryKey: qk('jobs') });
      success('Removed', 'Content removed from the platform.');
    },
    onError: (err) => showError('Failed', err instanceof Error ? err.message : 'Please try again'),
  });

  const exportAuditLogCSV = () => {
    const logs = auditData?.logs ?? [];
    if (!logs.length) return;
    const header = 'Actor,Action,Entity Type,Entity ID,Timestamp\n';
    const rows = logs.map((l) =>
      [l.actorEmail, l.action, l.entityType, l.entityId ?? '', new Date(l.createdAt).toISOString()].join(','),
    );
    const csv = header + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = statsData?.stats;

  const reportMutation = useMutation({
    mutationFn: ({ id, status, banUserId }: {
      id: string;
      status: AdminReportItem['status'];
      banUserId?: string;
    }) =>
      updateAdminReport(id, {
        status,
        moderationStatus: banUserId ? 'banned' : undefined,
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: qk('admin', 'reports') });
      queryClient.invalidateQueries({ queryKey: qk('admin', 'users') });
      if (vars.banUserId) success('User banned', 'Report resolved and user banned.');
      else if (vars.status === 'resolved') success('Report resolved', 'Action recorded.');
      else success('Report dismissed', 'No action taken.');
    },
    onError: (err) => showError('Failed', err instanceof Error ? err.message : 'Please try again'),
  });

  const userMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: 'active' | 'suspended' | 'banned' }) =>
      updateAdminUserModeration(userId, status),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: qk('admin', 'users') });
      const labels: Record<string, string> = {
        active: 'reactivated',
        suspended: 'suspended',
        banned: 'banned',
      };
      success(`User ${labels[vars.status]}`, `The user account has been ${labels[vars.status]}.`);
    },
    onError: (err) => showError('Failed', err instanceof Error ? err.message : 'Please try again'),
  });

  const reports = reportsData?.reports ?? [];
  const users = usersData?.users ?? [];
  const pendingReports = reports.filter((r) => r.status === 'pending').length;
  const isActing = reportMutation.isPending || userMutation.isPending;

  const filteredUsers = userSearch
    ? users.filter(
        (u) =>
          u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
          (u.profile?.displayName ?? '').toLowerCase().includes(userSearch.toLowerCase()),
      )
    : users;

  // A cohort delete used to run on the first click of a hover-only icon. It
  // asks now, from the button and from the assistant alike.
  const deleteCohort = async (cohort: { id: string; name: string }): Promise<PageControlRunResult> => {
    if (!(await confirm(deleteConfirmCopy({ en: 'cohort', el: 'κύκλου' }, cohort.name)))) return CANCELLED;
    return settle(() => deleteCohortMutation.mutateAsync(cohort.id));
  };

  // Offered to the assistant: the tab, Refresh, the audit export, and each
  // row's actions on reports, users, cohorts, events and jobs - the same
  // mutations the row buttons run.
  const cohorts = cohortsData?.cohorts ?? [];
  const events = eventsData?.events ?? [];
  const jobs = jobsData?.jobs ?? [];
  const openReportRows = reports.filter((r) => r.status === 'pending' || r.status === 'reviewed');
  const reportLabel = (r: AdminReportItem) => `${r.type} — ${r.reported.name}`;
  const userName = (u: (typeof users)[number]) => u.profile?.displayName || u.email;
  usePageList([
    { id: 'reports', labelEn: 'Reports', labelEl: 'Αναφορές', rows: reportsLoading ? undefined : reports.map((r) => `${reportLabel(r)} · ${r.status} · by ${r.reporter.name}: ${r.reason}`) },
    { id: 'users', labelEn: 'Users', labelEl: 'Χρήστες', rows: usersLoading ? undefined : filteredUsers.map((u) => `${userName(u)} · ${u.email} · ${u.role} · ${u.moderationStatus}${u.reportsCount ? ` · ${u.reportsCount} reports` : ''}`) },
    { id: 'cohorts', labelEn: 'Cohorts', labelEl: 'Κύκλοι', rows: activeTab === 'cohorts' && !cohortsLoading ? cohorts.map((c) => `${c.name} · ${c.isActive ? 'active' : 'inactive'}${c.capacity ? ` · capacity ${c.capacity}` : ''}`) : undefined },
    { id: 'events', labelEn: 'Events', labelEl: 'Εκδηλώσεις', rows: activeTab === 'content' && !eventsLoading ? events.map((e) => `${e.title} · ${e.startAt.slice(0, 10)}${e.isFeatured ? ' · featured' : ''}`) : undefined },
    { id: 'jobs', labelEn: 'Jobs', labelEl: 'Αγγελίες', rows: activeTab === 'content' && !jobsLoading ? jobs.map((j) => `${j.title} · ${j.creator.displayName}${j.isFeatured ? ' · featured' : ''}`) : undefined },
  ]);
  usePageControls([
    choiceControl('admin_tab', 'Admin section', 'Ενότητα διαχείρισης', [
      { value: 'reports', en: 'Reports', el: 'Αναφορές' },
      { value: 'users', en: 'Users', el: 'Χρήστες' },
      { value: 'content', en: 'Content', el: 'Περιεχόμενο' },
      { value: 'cohorts', en: 'Cohorts', el: 'Κύκλοι' },
      { value: 'analytics', en: 'Analytics', el: 'Στατιστικά' },
      { value: 'audit', en: 'Audit log', el: 'Αρχείο ελέγχου' },
      { value: 'email', en: 'Email templates', el: 'Πρότυπα email' },
      { value: 'gamification', en: 'Gamification', el: 'Gamification' },
      { value: 'score-inspector', en: 'Score inspector', el: 'Επιθεώρηση βαθμολογίας' },
      { value: 'abuse', en: 'Abuse monitor', el: 'Παρακολούθηση κατάχρησης' },
      { value: 'experiments', en: 'Experiments', el: 'Πειράματα' },
      { value: 'behavior', en: 'Behavior AI', el: 'Behavior AI' },
    ], activeTab, setActiveTab),
    { id: 'refresh', labelEn: 'Refresh all admin data', labelEl: 'Ανανέωση όλων των δεδομένων', writes: false, run: () => { void refetchReports(); void refetchUsers(); void refetchStats(); } },
    {
      id: 'export_audit_log',
      labelEn: 'Export the audit log as CSV',
      labelEl: 'Εξαγωγή αρχείου ελέγχου σε CSV',
      writes: false,
      unavailableEn: auditData?.logs?.length ? undefined : 'Open the audit log first; nothing is loaded to export.',
      unavailableEl: auditData?.logs?.length ? undefined : 'Ανοίξτε πρώτα το αρχείο ελέγχου· δεν έχει φορτωθεί τίποτα.',
      run: exportAuditLogCSV,
    },
    { id: 'resolve_report', labelEn: 'Resolve report', labelEl: 'Επίλυση αναφοράς', writes: true, options: rowOptions(openReportRows, (r) => r.id, reportLabel), run: async (v) => { if (v) await reportMutation.mutateAsync({ id: v, status: 'resolved' }); } },
    { id: 'dismiss_report', labelEn: 'Dismiss report', labelEl: 'Απόρριψη αναφοράς', writes: true, options: rowOptions(openReportRows, (r) => r.id, reportLabel), run: async (v) => { if (v) await reportMutation.mutateAsync({ id: v, status: 'dismissed' }); } },
    {
      id: 'ban_reported_user',
      labelEn: 'Resolve report and ban the reported user',
      labelEl: 'Επίλυση αναφοράς και αποκλεισμός χρήστη',
      writes: true,
      options: rowOptions(openReportRows, (r) => r.id, reportLabel),
      run: async (v) => { const r = reports.find((x) => x.id === v); if (r) await reportMutation.mutateAsync({ id: r.id, status: 'resolved', banUserId: r.reported.id }); },
    },
    // One field each way (admin.service updateUserModerationStatus): the
    // previous status is restored by the command that sets it.
    { id: 'suspend_user', labelEn: 'Suspend user', labelEl: 'Αναστολή χρήστη', writes: true, options: rowOptions(filteredUsers.filter((u) => u.moderationStatus === 'active'), (u) => u.id, userName), undo: (v) => ({ control: 'reactivate_user', value: v }), run: async (v) => { if (v) await userMutation.mutateAsync({ userId: v, status: 'suspended' }); } },
    { id: 'reactivate_user', labelEn: 'Reactivate user', labelEl: 'Επανενεργοποίηση χρήστη', writes: true, options: rowOptions(filteredUsers.filter((u) => u.moderationStatus !== 'active'), (u) => u.id, userName), undo: (v) => { const prior = users.find((u) => u.id === v)?.moderationStatus; return prior === 'suspended' ? { control: 'suspend_user', value: v } : prior === 'banned' ? { control: 'ban_user', value: v } : undefined; }, run: async (v) => { if (v) await userMutation.mutateAsync({ userId: v, status: 'active' }); } },
    { id: 'ban_user', labelEn: 'Ban user', labelEl: 'Αποκλεισμός χρήστη', writes: true, options: rowOptions(filteredUsers.filter((u) => u.moderationStatus !== 'banned'), (u) => u.id, userName), undo: (v) => { const prior = users.find((u) => u.id === v)?.moderationStatus; return prior === 'active' ? { control: 'reactivate_user', value: v } : prior === 'suspended' ? { control: 'suspend_user', value: v } : undefined; }, run: async (v) => { if (v) await userMutation.mutateAsync({ userId: v, status: 'banned' }); } },
    { id: 'delete_cohort', labelEn: 'Delete cohort', labelEl: 'Διαγραφή κύκλου', writes: true, options: rowOptions(cohorts, (c) => c.id, (c) => c.name), unavailableEn: activeTab === 'cohorts' ? undefined : 'Open the Cohorts tab first.', unavailableEl: activeTab === 'cohorts' ? undefined : 'Ανοίξτε πρώτα την καρτέλα Κύκλοι.', run: (v) => { const c = cohorts.find((x) => x.id === v); return c ? deleteCohort(c) : ROW_GONE; } },
    { id: 'feature_event', labelEn: 'Feature or unfeature event', labelEl: 'Προβολή ή απόσυρση εκδήλωσης', writes: true, options: rowOptions(events, (e) => e.id, (e) => e.title), unavailableEn: activeTab === 'content' ? undefined : 'Open the Events & jobs tab first.', unavailableEl: activeTab === 'content' ? undefined : 'Ανοίξτε πρώτα την καρτέλα Εκδηλώσεις & αγγελίες.', run: async (v) => { const e = events.find((x) => x.id === v); if (e) await featureMutation.mutateAsync({ type: 'event', id: e.id, featured: !e.isFeatured }); } },
    { id: 'feature_job', labelEn: 'Feature or unfeature job', labelEl: 'Προβολή ή απόσυρση αγγελίας', writes: true, options: rowOptions(jobs, (j) => j.id, (j) => j.title), unavailableEn: activeTab === 'content' ? undefined : 'Open the Events & jobs tab first.', unavailableEl: activeTab === 'content' ? undefined : 'Ανοίξτε πρώτα την καρτέλα Εκδηλώσεις & αγγελίες.', run: async (v) => { const j = jobs.find((x) => x.id === v); if (j) await featureMutation.mutateAsync({ type: 'job', id: j.id, featured: !j.isFeatured }); } },
    { id: 'remove_event', labelEn: 'Remove event', labelEl: 'Αφαίρεση εκδήλωσης', writes: true, options: rowOptions(events, (e) => e.id, (e) => e.title), unavailableEn: activeTab === 'content' ? undefined : 'Open the Events & jobs tab first.', unavailableEl: activeTab === 'content' ? undefined : 'Ανοίξτε πρώτα την καρτέλα Εκδηλώσεις & αγγελίες.', run: async (v) => { if (v) await removeContentMutation.mutateAsync({ type: 'event', id: v }); } },
    { id: 'remove_job', labelEn: 'Remove job', labelEl: 'Αφαίρεση αγγελίας', writes: true, options: rowOptions(jobs, (j) => j.id, (j) => j.title), unavailableEn: activeTab === 'content' ? undefined : 'Open the Events & jobs tab first.', unavailableEl: activeTab === 'content' ? undefined : 'Ανοίξτε πρώτα την καρτέλα Εκδηλώσεις & αγγελίες.', run: async (v) => { if (v) await removeContentMutation.mutateAsync({ type: 'job', id: v }); } },
  ]);

  /*
   * The six platform totals used to sit above the tabs, so the first thing an
   * admin saw was a row of figures rather than the queue they came to work.
   * Same six cards, same values, same trends, one gesture to the right - and
   * the badge on the collapsed strip is the open-reports count, so the one
   * figure that asks for action is visible without opening anything.
   */
  const openReports = stats?.pendingReports ?? pendingReports;
  const rail: PageRailSection[] = [
    {
      id: 'summary',
      glyph: 'chart',
      labelEn: 'Platform totals',
      labelEl: 'Σύνολα πλατφόρμας',
      badge: openReports > 0 ? openReports : null,
      content: (
        <div className="space-y-2">
          {/* Shared rail figures: bilingual labels, one icon per kind of
              figure, and the week's new sign-ups as a note under the total.
              The old "↓ 2% open" under pending reports printed a count as a
              percentage; the count is the value itself. */}
          <RailStats
            items={[
              {
                key: 'users',
                label: 'Total users',
                labelEl: 'Σύνολο χρηστών',
                value: statsLoading ? '…' : (stats?.totalUsers ?? 0).toLocaleString('en-GB'),
                icon: Users,
                note: stats?.newUsersThisWeek ? `+${stats.newUsersThisWeek} this week` : undefined,
                noteEl: stats?.newUsersThisWeek ? `+${stats.newUsersThisWeek} αυτή την εβδομάδα` : undefined,
              },
              { key: 'active', label: 'Active today', labelEl: 'Ενεργοί σήμερα', value: statsLoading ? '…' : (stats?.activeUsersToday ?? 0).toLocaleString('en-GB'), icon: Zap },
              {
                key: 'reports',
                label: 'Pending reports',
                labelEl: 'Αναφορές σε αναμονή',
                value: statsLoading ? '…' : openReports.toString(),
                icon: Flag,
                tone: openReports > 0 ? 'bg-status-warning-bg text-status-warning' : undefined,
                note: openReports > 0 ? 'awaiting review' : undefined,
                noteEl: openReports > 0 ? 'περιμένουν έλεγχο' : undefined,
              },
              { key: 'connections', label: 'Connections', labelEl: 'Συνδέσεις', value: statsLoading ? '…' : (stats?.totalConnections ?? 0).toLocaleString('en-GB'), icon: Handshake },
              { key: 'messages', label: 'Messages', labelEl: 'Μηνύματα', value: statsLoading ? '…' : (stats?.totalMessages ?? 0).toLocaleString('en-GB'), icon: MessageSquare },
              { key: 'events', label: 'Events', labelEl: 'Εκδηλώσεις', value: statsLoading ? '…' : (stats?.totalEvents ?? 0).toLocaleString('en-GB'), icon: Calendar },
            ]}
          />
          <Link
            href="/admin/dashboard"
            className="flex min-h-10 items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-primary-accessible hover:bg-muted/70 focus-ring"
          >
            <BilingualText en="Platform overview and API health" el="Επισκόπηση πλατφόρμας και υγεία API" compact wrap />
          </Link>
        </div>
      ),
    },
    {
      // The page's utilities, moved out of the header and the audit tab's
      // card header: one Refresh for every query the page runs, and the
      // audit-log export. Moved, not copied - the header and the card no
      // longer carry either button.
      id: 'tools',
      glyph: 'sliders',
      labelEn: 'Data tools',
      labelEl: 'Εργαλεία δεδομένων',
      content: (
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => { void refetchReports(); void refetchUsers(); void refetchStats(); }}
            className="tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted/70"
          >
            <RefreshCw className="icon-sm shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1"><BilingualText en="Refresh all data" el="Ανανέωση όλων των δεδομένων" compact wrap /></span>
          </button>
          <button
            type="button"
            onClick={exportAuditLogCSV}
            disabled={!auditData?.logs?.length}
            className="tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted/70 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="icon-sm shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1"><BilingualText en="Export audit log (CSV)" el="Εξαγωγή αρχείου ελέγχου (CSV)" compact wrap /></span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <AppShell
      title="Admin console"
      titleEl="Κονσόλα διαχείρισης"
      description="Reports, people, content and the platform's tools."
      descriptionEl="Αναφορές, άνθρωποι, περιεχόμενο και τα εργαλεία της πλατφόρμας."
      showHelp
      rail={rail}
    >
      {/*
        Twelve sections in one horizontal strip hid a third of them past its
        edge at every desktop width ("Abus" was the last visible). On a
        desktop they are a column, grouped by the job each one serves, so all
        twelve are visible and the four groups say where to look; below lg
        the same list is the scrolling strip it was, in the same order.
      */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        orientation={wide ? 'vertical' : 'horizontal'}
        className="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-6"
      >
        <TabsList className="lg:sticky lg:top-24 lg:flex lg:w-full lg:flex-col lg:items-stretch lg:gap-0.5 lg:overflow-visible lg:p-1.5">
          {ADMIN_TAB_GROUPS.map((group) => (
            <Fragment key={group.en}>
              <span aria-hidden="true" className="hidden px-3 pb-1 pt-3 text-2xs font-medium text-muted-foreground first:pt-1.5 lg:block">
                <BilingualText en={group.en} el={group.el} compact />
              </span>
              {group.tabs.map(({ value, en, el, icon: Icon }) => (
                <TabsTrigger key={value} value={value} className="gap-2 lg:justify-start lg:whitespace-normal lg:text-left">
                  <Icon className="icon-sm shrink-0" aria-hidden="true" />
                  <span className="min-w-0 lg:flex-1">
                    <BilingualText en={en} el={el} stacked wrap />
                  </span>
                  {value === 'reports' && pendingReports > 0 && (
                    <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                      {pendingReports}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </Fragment>
          ))}
        </TabsList>

        <div className="min-w-0 lg:[&>[role=tabpanel]]:mt-0">

        {/* Reports Tab */}
        <TabsContent value="reports" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Moderation Queue
              {pendingReports > 0 && (
                <span className="ml-2 text-sm text-muted-foreground">({pendingReports} pending)</span>
              )}
            </h2>
          </div>

          {reportsLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-5">
                  <div className="flex gap-3">
                    <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-64" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : reports.filter((r) => r.status === 'pending').length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Shield className="mx-auto mb-4 h-12 w-12 text-status-success" aria-hidden="true" />
                <h3 className="text-lg font-semibold text-foreground"><BilingualText en="All clear!" el="Όλα καθαρά!" compact /></h3>
                <p className="text-sm text-muted-foreground"><BilingualText en="No pending reports to review" el="Δεν υπάρχουν αναφορές για έλεγχο" compact /></p>
              </CardContent>
            </Card>
          ) : (
            reports
              .filter((r) => r.status === 'pending')
              .map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  isActing={isActing}
                  onResolve={() =>
                    reportMutation.mutate({ id: report.id, status: 'resolved' })
                  }
                  onDismiss={() =>
                    reportMutation.mutate({ id: report.id, status: 'dismissed' })
                  }
                  onBanUser={() =>
                    reportMutation.mutate({
                      id: report.id,
                      status: 'resolved',
                      banUserId: report.reported.id,
                    })
                  }
                />
              ))
          )}
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-base"><BilingualText en="User Management" el="Διαχείριση χρηστών" compact /></CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
                  <Input
                    placeholder={bilingualInline("Search users…", "Αναζήτηση χρηστών…")}
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {usersLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 border-b border-border p-4">
                    <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                ))
              ) : filteredUsers.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground"><BilingualText en="No users found" el="Δεν βρέθηκαν χρήστες" compact /></div>
              ) : (
                filteredUsers.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    isActing={isActing}
                    onSuspend={() => userMutation.mutate({ userId: user.id, status: 'suspended' })}
                    onBan={() => userMutation.mutate({ userId: user.id, status: 'banned' })}
                    onActivate={() => userMutation.mutate({ userId: user.id, status: 'active' })}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Content Management Tab */}
        <TabsContent value="content" className="mt-6 space-y-6">
          {/* Events */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Calendar className="icon-sm text-muted-foreground" />
                <BilingualText en="Events" el="Εκδηλώσεις" compact />
              </h2>
              <Button variant="ghost" size="sm" onClick={() => void refetchEvents()}>
                <RefreshCw className="icon-sm mr-1.5" /> <BilingualText en="Refresh" el="Ανανέωση" compact />
              </Button>
            </div>
            {eventsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 border-b border-border p-4">
                  <Skeleton className="h-8 w-8 rounded-md shrink-0" />
                  <div className="flex-1 space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-64" /></div>
                </div>
              ))
            ) : eventsError ? (
              <Card><CardContent className="py-8 text-center text-sm text-destructive-accessible"><BilingualText en="Failed to load events." el="Δεν ήταν δυνατή η φόρτωση των εκδηλώσεων." compact wrap /> <button className="underline" onClick={() => void refetchEvents()}><BilingualText en="Retry" el="Δοκιμάστε ξανά" compact /></button></CardContent></Card>
            ) : (eventsData?.events ?? []).length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground"><BilingualText en="No events found" el="Δεν βρέθηκαν εκδηλώσεις" compact /></CardContent></Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  {(eventsData?.events ?? []).map((ev) => (
                    <div key={ev.id} className="flex items-center justify-between gap-4 border-b border-border p-4 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{ev.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{ev.mode} · {ev.attendeesCount} attendees</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="ghost" size="sm"
                          className={ev.isFeatured ? 'text-status-warning' : 'text-muted-foreground'}
                          onClick={() => featureMutation.mutate({ type: 'event', id: ev.id, featured: !ev.isFeatured })}
                          disabled={featureMutation.isPending}
                        >
                          {ev.isFeatured ? <StarOff className="icon-sm mr-1" /> : <Star className="icon-sm mr-1" />}
                          {ev.isFeatured ? 'Unfeature' : 'Feature'}
                        </Button>
                        <Button
                          variant="ghost" size="sm" className="text-destructive-accessible"
                          onClick={() => removeContentMutation.mutate({ type: 'event', id: ev.id })}
                          disabled={removeContentMutation.isPending}
                        >
                          <Trash2 className="icon-sm mr-1" /> <BilingualText en="Remove" el="Αφαίρεση" compact />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Jobs */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Briefcase className="icon-sm text-muted-foreground" />
                <BilingualText en="Job Postings" el="Αγγελίες θέσεων" compact />
              </h2>
              <Button variant="ghost" size="sm" onClick={() => void refetchJobs()}>
                <RefreshCw className="icon-sm mr-1.5" /> <BilingualText en="Refresh" el="Ανανέωση" compact />
              </Button>
            </div>
            {jobsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 border-b border-border p-4">
                  <Skeleton className="h-8 w-8 rounded-md shrink-0" />
                  <div className="flex-1 space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-64" /></div>
                </div>
              ))
            ) : jobsError ? (
              <Card><CardContent className="py-8 text-center text-sm text-destructive-accessible"><BilingualText en="Failed to load jobs." el="Δεν ήταν δυνατή η φόρτωση των θέσεων." compact wrap /> <button className="underline" onClick={() => void refetchJobs()}><BilingualText en="Retry" el="Δοκιμάστε ξανά" compact /></button></CardContent></Card>
            ) : (jobsData?.jobs ?? []).length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground"><BilingualText en="No job postings found" el="Δεν βρέθηκαν αγγελίες" compact /></CardContent></Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  {(jobsData?.jobs ?? []).map((job) => (
                    <div key={job.id} className="flex items-center justify-between gap-4 border-b border-border p-4 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{job.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{job.type ?? 'Full-time'} · {job.location ?? 'Remote'}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="ghost" size="sm"
                          className={job.isFeatured ? 'text-status-warning' : 'text-muted-foreground'}
                          onClick={() => featureMutation.mutate({ type: 'job', id: job.id, featured: !job.isFeatured })}
                          disabled={featureMutation.isPending}
                        >
                          {job.isFeatured ? <StarOff className="icon-sm mr-1" /> : <Star className="icon-sm mr-1" />}
                          {job.isFeatured ? 'Unfeature' : 'Feature'}
                        </Button>
                        <Button
                          variant="ghost" size="sm" className="text-destructive-accessible"
                          onClick={() => removeContentMutation.mutate({ type: 'job', id: job.id })}
                          disabled={removeContentMutation.isPending}
                        >
                          <Trash2 className="icon-sm mr-1" /> <BilingualText en="Remove" el="Αφαίρεση" compact />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Cohorts Tab */}
        <TabsContent value="cohorts" className="mt-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
              <Input
                placeholder={bilingualInline("Search cohorts…", "Αναζήτηση κοορτών…")}
                value={cohortSearch}
                onChange={(e) => setCohortSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button size="sm" className="gap-2" onClick={() => setShowNewCohort(!showNewCohort)}>
              <Plus className="icon-sm" />
              <BilingualText en="New Cohort" el="Νέος κύκλος" compact />
            </Button>
          </div>

          {showNewCohort && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base"><BilingualText en="Create New Cohort / Program" el="Δημιουργία νέου κύκλου / προγράμματος" compact /></CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label htmlFor="cohort-f1" className="text-xs font-medium text-muted-foreground">Name *</label>
                    <Input id="cohort-f1" placeholder="e.g. Spring 2025 Accelerator" value={newCohort.name}
                      onChange={(e) => setNewCohort(p => ({ ...p, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }))} />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="cohort-f2" className="text-xs font-medium text-muted-foreground">Slug *</label>
                    <Input id="cohort-f2" placeholder="spring-2025" value={newCohort.slug} onChange={(e) => setNewCohort(p => ({ ...p, slug: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="cohort-f3" className="text-xs font-medium text-muted-foreground"><BilingualText en="Start Date" el="Ημερομηνία έναρξης" compact /></label>
                    <Input id="cohort-f3" type="date" value={newCohort.startDate} onChange={(e) => setNewCohort(p => ({ ...p, startDate: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="cohort-f4" className="text-xs font-medium text-muted-foreground"><BilingualText en="End Date" el="Ημερομηνία λήξης" compact /></label>
                    <Input id="cohort-f4" type="date" value={newCohort.endDate} onChange={(e) => setNewCohort(p => ({ ...p, endDate: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="cohort-f5" className="text-xs font-medium text-muted-foreground"><BilingualText en="Capacity" el="Χωρητικότητα" compact /></label>
                    <Input id="cohort-f5" type="number" placeholder="50" value={newCohort.capacity} onChange={(e) => setNewCohort(p => ({ ...p, capacity: e.target.value }))} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label htmlFor="cohort-f6" className="text-xs font-medium text-muted-foreground"><BilingualText en="Description" el="Περιγραφή" compact /></label>
                    <Input id="cohort-f6" placeholder={bilingualInline("Short description…", "Σύντομη περιγραφή…")} value={newCohort.description} onChange={(e) => setNewCohort(p => ({ ...p, description: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" disabled={!newCohort.name || !newCohort.slug || createCohortMutation.isPending}
                    onClick={() => createCohortMutation.mutate({
                      name: newCohort.name,
                      slug: newCohort.slug,
                      description: newCohort.description || undefined,
                      startDate: newCohort.startDate || undefined,
                      endDate: newCohort.endDate || undefined,
                      capacity: newCohort.capacity ? parseInt(newCohort.capacity) : undefined,
                    })}>
                    {createCohortMutation.isPending ? 'Creating…' : 'Create'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowNewCohort(false)}><BilingualText en="Cancel" el="Ακύρωση" compact /></Button>
                </div>
              </CardContent>
            </Card>
          )}

          {cohortsLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}><CardContent className="pt-5"><div className="space-y-2"><Skeleton className="h-5 w-48" /><Skeleton className="h-4 w-64" /></div></CardContent></Card>
            ))
          ) : (cohortsData?.cohorts ?? []).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <GraduationCap className="mx-auto mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
                <h3 className="font-semibold text-foreground"><BilingualText en="No cohorts yet" el="Δεν υπάρχουν ακόμη κύκλοι" compact /></h3>
                <p className="text-sm text-muted-foreground"><BilingualText en="Create your first cohort or program above" el="Δημιουργήστε τον πρώτο σας κύκλο ή πρόγραμμα παραπάνω" wrap /></p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {(cohortsData?.cohorts ?? []).map((cohort) => (
                <Card key={cohort.id} className="group">
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{cohort.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">/{cohort.slug}</p>
                        {cohort.description && (
                          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{cohort.description}</p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <UserCheck className="icon-sm" />
                            {cohort._count.members} members
                          </Badge>
                          {cohort.startDate && (
                            <Badge variant="outline" className="gap-1 text-xs">
                              <Calendar className="icon-sm" />
                              {new Date(cohort.startDate).toLocaleDateString('en-GB', { timeZone: 'UTC' })}
                            </Badge>
                          )}
                          {cohort.capacity && (
                            <Badge variant="outline" className="text-xs">Cap: {cohort.capacity}</Badge>
                          )}
                        </div>
                      </div>
                      <Button aria-label="Delete"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-destructive-accessible opacity-0 group-hover:opacity-100 focus-within:opacity-100"
                        onClick={() => void deleteCohort(cohort)}
                        disabled={deleteCohortMutation.isPending}
                      >
                        <Trash2 className="icon-sm" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground"><BilingualText en="Users by Role" el="Χρήστες ανά ρόλο" compact /></CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats?.usersByRole && Object.entries(stats.usersByRole).map(([role, count]) => (
                  <div key={role} className="flex items-center justify-between">
                    <span className="text-sm capitalize text-foreground">{role}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground"><BilingualText en="New Users" el="Νέοι χρήστες" compact /></CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground"><BilingualText en="Today" el="Σήμερα" compact /></span>
                  <Badge variant="secondary">{stats?.newUsersToday ?? 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground"><BilingualText en="This Week" el="Αυτή την εβδομάδα" compact /></span>
                  <Badge variant="secondary">{stats?.newUsersThisWeek ?? 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground"><BilingualText en="This Month" el="Αυτόν τον μήνα" compact /></span>
                  <Badge variant="secondary">{stats?.newUsersThisMonth ?? 0}</Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground"><BilingualText en="Active Users" el="Ενεργοί χρήστες" compact /></CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">DAU</span>
                  <Badge variant="secondary">{stats?.activeUsersToday ?? 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">WAU</span>
                  <Badge variant="secondary">{stats?.activeUsersThisWeek ?? 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">MAU</span>
                  <Badge variant="secondary">{stats?.activeUsersThisMonth ?? 0}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Email Templates Tab */}
        <EmailTemplatesTab />

        {/* Audit Log Tab */}
        <TabsContent value="audit" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base"><BilingualText en="Admin Audit Log" el="Αρχείο ενεργειών διαχείρισης" compact /></CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {auditLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 border-b border-border p-4">
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-64" />
                    </div>
                  </div>
                ))
              ) : (auditData?.logs ?? []).length === 0 ? (
                <div className="py-12 text-center">
                  <Shield className="mx-auto mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground"><BilingualText en="No audit logs yet" el="Δεν υπάρχουν εγγραφές ακόμα" compact /></p>
                </div>
              ) : (
                (auditData?.logs ?? []).map((log) => (
                  <div key={log.id} className="flex items-start gap-4 border-b border-border p-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Shield className="icon-sm text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{log.actorEmail}</span>
                        <Badge variant="outline" className="text-xs">{log.action}</Badge>
                        <Badge variant="secondary" className="text-xs">{log.entityType}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {log.entityId && <span>ID: {log.entityId.slice(0, 8)}… · </span>}
                        <RelativeTime date={log.createdAt} />
                      </p>
                      {log.meta && Object.keys(log.meta).length > 0 && (
                        <pre className="mt-2 rounded bg-secondary/40 p-2 text-xs text-muted-foreground overflow-x-auto">
                          {JSON.stringify(log.meta, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gamification Analytics Tab */}
        <TabsContent value="gamification" className="mt-6">
          <AdminAnalyticsDashboard />
        </TabsContent>

        {/* Score Inspector Tab */}
        <TabsContent value="score-inspector" className="mt-6">
          <ScoreInspector />
        </TabsContent>

        {/* Abuse Monitor Tab */}
        <TabsContent value="abuse" className="mt-6">
          <AbuseMonitorPanel />
        </TabsContent>

        {/* Experimentation & Config Tab */}
        <TabsContent value="experiments" className="mt-6">
          <ExperimentationPanel />
        </TabsContent>

        {/* Behavioral AI Optimizer Tab */}
        <TabsContent value="behavior" className="mt-6">
          <BehaviorAdminPanel />
        </TabsContent>
        </div>
      </Tabs>
    </AppShell>
  );
}
