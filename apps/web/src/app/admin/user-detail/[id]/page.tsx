'use client';

import { StatusText } from '@/components/common/StatusText';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Flag,
  Mail,
  PauseCircle,
  ScrollText,
  Shield,
  UserX,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { HelpCallout } from '@/components/common/HelpCallout';
import { BilingualText } from '@/components/common/BilingualText';
import { RelativeTime } from '@/components/common/RelativeTime';
import { MetricTile } from '@/components/dashboard/MetricTile';
import { EmptyLine, SectionCard } from '@/components/dashboard/SectionCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import {
  changeUserRole,
  listAdminAuditLogs,
  listAdminReports,
  listAdminUsers,
  updateAdminUserModeration,
  type AdminUserItem,
} from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { CANCELLED, settle, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { formatRelativeTime, initialsOf } from '@/lib/utils';

// The API's Role enum; ChangeUserRoleDto accepts nothing else.
const ROLES = [
  { value: 'founder', en: 'Founder', el: 'Ιδρυτής' },
  { value: 'mentor', en: 'Mentor', el: 'Μέντορας' },
  { value: 'investor', en: 'Investor', el: 'Επενδυτής' },
  { value: 'org', en: 'Organisation', el: 'Οργανισμός' },
  { value: 'admin', en: 'Admin', el: 'Διαχειριστής' },
  { value: 'super_admin', en: 'Super admin', el: 'Υπερδιαχειριστής' },
] as const;

const STATUS: Record<AdminUserItem['moderationStatus'], { en: string; el: string; variant: 'success' | 'warning' | 'destructive' }> = {
  active: { en: 'Active', el: 'Ενεργός', variant: 'success' },
  suspended: { en: 'Suspended', el: 'Σε αναστολή', variant: 'warning' },
  banned: { en: 'Banned', el: 'Αποκλεισμένος', variant: 'destructive' },
};

const REPORT_STATUS: Record<string, 'warning' | 'success' | 'secondary' | 'info'> = {
  pending: 'warning',
  reviewed: 'info',
  resolved: 'success',
  dismissed: 'secondary',
};

/*
 * Every id opened "John Doe", john@example.com, 42 connections, and three
 * buttons that toasted "Demo only" - in production as well. The page now
 * reads the person from the admin user list (there is no single-user admin
 * route; the list is the one /admin/user-management caches), the reports
 * filed about and by them, and the audit entries about their account. The
 * three actions write through the same endpoints the console uses.
 */
export default function AdminUserDetailPage() {
  const params = useParams();
  const id = String(params?.id ?? '');
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { success, error: showError } = useToast();

  const { data: usersData, isLoading: usersLoading, isError: usersError } = useQuery({
    queryKey: qk('admin', 'users'),
    queryFn: () => listAdminUsers({ limit: 200 }),
    staleTime: 60_000,
    retry: 0,
  });
  const { data: reportsData } = useQuery({
    queryKey: qk('admin', 'reports'),
    queryFn: () => listAdminReports({ limit: 100 }),
    staleTime: 30_000,
    retry: 0,
  });
  const { data: auditData } = useQuery({
    queryKey: qk('admin', 'audit-logs', 'user-detail', id),
    queryFn: () => listAdminAuditLogs({ entityType: 'user', limit: 100 }),
    staleTime: 30_000,
    retry: 0,
  });

  const user = usersData?.users?.find((u) => u.id === id) ?? null;
  const reports = reportsData?.reports ?? [];
  const against = reports.filter((r) => r.reported?.id === id);
  const filed = reports.filter((r) => r.reporter?.id === id);
  const openAgainst = against.filter((r) => r.status === 'pending' || r.status === 'reviewed');
  const history = (auditData?.logs ?? []).filter((l) => l.entityId === id);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: qk('admin', 'users') });
    void queryClient.invalidateQueries({ queryKey: qk('admin', 'audit-logs') });
  };

  const moderation = useMutation({
    mutationFn: (status: AdminUserItem['moderationStatus']) => updateAdminUserModeration(id, status),
    onSuccess: (_, status) => {
      refresh();
      success(status === 'active' ? 'Account reactivated' : status === 'suspended' ? 'Account suspended' : 'Account banned');
    },
    onError: (err) => showError('Could not change the account status', err instanceof Error ? err.message : undefined),
  });
  const role = useMutation({
    mutationFn: (next: string) => changeUserRole(id, next),
    onSuccess: () => {
      refresh();
      success('Role changed');
    },
    onError: (err) => showError('Could not change the role', err instanceof Error ? err.message : undefined),
  });

  const name = user?.profile?.displayName ?? user?.email ?? 'User';
  const status = user ? STATUS[user.moderationStatus] ?? STATUS.active : null;

  const setStatus = async (next: AdminUserItem['moderationStatus']): Promise<PageControlRunResult> => {
    if (next !== 'active') {
      const ok = await confirm({
        title: next === 'banned'
          ? <BilingualText en={`Ban ${name}?`} el={`Αποκλεισμός: ${name};`} />
          : <BilingualText en={`Suspend ${name}?`} el={`Αναστολή: ${name};`} />,
        description:
          next === 'banned'
            ? <BilingualText en="They lose access to the platform until an admin reactivates the account." el="Χάνει την πρόσβαση στην πλατφόρμα μέχρι να επανενεργοποιήσει τον λογαριασμό ένας διαχειριστής." />
            : <BilingualText en="They cannot sign in while suspended. Reactivate the account to restore access." el="Δεν μπορεί να συνδεθεί όσο είναι σε αναστολή. Η επανενεργοποίηση επαναφέρει την πρόσβαση." />,
        confirmLabel: next === 'banned'
          ? <BilingualText en="Ban account" el="Αποκλεισμός λογαριασμού" compact />
          : <BilingualText en="Suspend account" el="Αναστολή λογαριασμού" compact />,
      });
      if (!ok) return CANCELLED;
    }
    return settle(() => moderation.mutateAsync(next));
  };

  const dash = '—';

  /*
   * Status and role, offered to the assistant. Each writes one field
   * (admin.service `updateUserModeration`, `changeUserRole`), so setting the
   * previous value back is the undo - the same one /admin/users names. The
   * audit entry each write adds stays.
   */
  const unloaded = !user ? 'The account has not loaded.' : undefined;
  const unloadedEl = !user ? 'Ο λογαριασμός δεν έχει φορτωθεί.' : undefined;
  usePageControls([
    {
      id: 'set_account_status',
      labelEn: 'Set the account status',
      labelEl: 'Ορισμός κατάστασης λογαριασμού',
      writes: true,
      options: (Object.keys(STATUS) as AdminUserItem['moderationStatus'][])
        .filter((k) => k !== user?.moderationStatus)
        .map((k) => ({ value: k, labelEn: STATUS[k].en, labelEl: STATUS[k].el })),
      current: user?.moderationStatus,
      unavailableEn: unloaded,
      unavailableEl: unloadedEl,
      undo: () => (user ? { control: 'set_account_status', value: user.moderationStatus } : undefined),
      run: (value) => (value ? setStatus(value as AdminUserItem['moderationStatus']) : undefined),
    },
    {
      id: 'change_role',
      labelEn: 'Change the role',
      labelEl: 'Αλλαγή ρόλου',
      writes: true,
      options: ROLES.filter((r) => r.value !== user?.role).map((r) => ({ value: r.value, labelEn: r.en, labelEl: r.el })),
      current: user?.role,
      unavailableEn: unloaded,
      unavailableEl: unloadedEl,
      undo: () => (user ? { control: 'change_role', value: user.role } : undefined),
      run: async (value) => { if (user && value && value !== user.role) await role.mutateAsync(value); },
    },
  ]);
  usePageList([
    {
      id: 'reports_against',
      labelEn: 'Reports against this account',
      labelEl: 'Αναφορές κατά του λογαριασμού',
      rows: reportsData ? against.map((r) => `${r.reason ?? 'report'} · ${r.status}`) : undefined,
      total: against.length,
      sample: false,
    },
    {
      id: 'admin_history',
      labelEn: 'Admin actions on this account',
      labelEl: 'Διαχειριστικές ενέργειες στον λογαριασμό',
      rows: auditData ? history.map((l) => `${l.action} · ${l.createdAt}`) : undefined,
      total: history.length,
      sample: false,
    },
  ]);

  return (
    <AppShell
      title={user ? name : 'User detail'}
      titleEl={user ? name : 'Στοιχεία χρήστη'}
      description="Account status, reports and the admin actions taken on this account."
      descriptionEl="Κατάσταση λογαριασμού, αναφορές και οι διαχειριστικές ενέργειες σε αυτόν."
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/user-management">
            <ArrowLeft className="icon-sm mr-1.5" aria-hidden="true" />
            <BilingualText en="Back to user list" el="Πίσω στη λίστα χρηστών" compact />
          </Link>
        </Button>
      }
    >
      <HelpCallout id="admin-user-detail" title="Admin user detail" titleEl="Στοιχεία χρήστη">
        <p>
          Changes here affect platform access only; they do not delete the person&apos;s public profile or
          history. Use <strong>Suspend</strong> for a temporary lockout and <strong>Ban</strong> for a lasting one;
          both are undone with <strong>Reactivate</strong>.
        </p>
        <p lang="el" className="mt-2 text-muted-foreground">
          Οι αλλαγές εδώ επηρεάζουν μόνο την πρόσβαση· δεν διαγράφουν το δημόσιο προφίλ ή το ιστορικό του ατόμου.
          Η <strong>αναστολή</strong> είναι προσωρινή, ο <strong>αποκλεισμός</strong> διαρκής· και τα δύο
          αναιρούνται με <strong>επανενεργοποίηση</strong>.
        </p>
      </HelpCallout>

      {usersLoading && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      )}

      {!usersLoading && !user && (
        <Card>
          <CardContent className="flex flex-col items-start gap-3">
            <UserX className="icon-xl text-muted-foreground/60" aria-hidden="true" />
            <p className="font-medium">
              <BilingualText
                en={usersError ? 'The user list could not be loaded' : 'No user with this id'}
                el={usersError ? 'Η λίστα χρηστών δεν φορτώθηκε' : 'Δεν υπάρχει χρήστης με αυτό το id'}
              />
            </p>
            <p className="font-mono text-xs text-muted-foreground">{id}</p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/user-management">
                <BilingualText en="Open the user list" el="Άνοιγμα λίστας χρηστών" compact />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {user && status && (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Card>
            <CardContent className="flex flex-col items-start gap-3">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user.profile?.avatarUrl ?? undefined} alt={name} />
                <AvatarFallback className="text-lg">{initialsOf(name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">{name}</h2>
                <p className="break-all text-sm text-muted-foreground" translate="no">{user.email}</p>
              </div>
              <Badge variant={status.variant}>
                <BilingualText en={status.en} el={status.el} compact />
              </Badge>

              <div className="mt-2 w-full space-y-1.5 text-left">
                <label htmlFor="user-role" className="text-sm font-medium text-muted-foreground">
                  <BilingualText en="Role" el="Ρόλος" compact />
                </label>
                <Select value={user.role} onValueChange={(v) => { if (v !== user.role) role.mutate(v); }} disabled={role.isPending}>
                  <SelectTrigger id="user-role" aria-label="Role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.en}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-2 flex w-full flex-col gap-2">
                <Button size="sm" variant="outline" className="w-full" asChild>
                  <a href={`mailto:${user.email}`}>
                    <Mail className="icon-sm mr-2" aria-hidden="true" />
                    <BilingualText en="Email" el="Email" compact />
                  </a>
                </Button>
                {user.moderationStatus === 'active' ? (
                  <>
                    <Button size="sm" variant="outline" className="w-full" disabled={moderation.isPending} onClick={() => void setStatus('suspended')}>
                      <PauseCircle className="icon-sm mr-2" aria-hidden="true" />
                      <BilingualText en="Suspend account" el="Αναστολή" compact wrap />
                    </Button>
                    <Button size="sm" variant="outline" className="w-full text-destructive-accessible" disabled={moderation.isPending} onClick={() => void setStatus('banned')}>
                      <Ban className="icon-sm mr-2" aria-hidden="true" />
                      <BilingualText en="Ban account" el="Αποκλεισμός" compact wrap />
                    </Button>
                  </>
                ) : (
                  <Button size="sm" className="w-full" disabled={moderation.isPending} onClick={() => void setStatus('active')}>
                    <CheckCircle2 className="icon-sm mr-2" aria-hidden="true" />
                    <BilingualText en="Reactivate account" el="Επανενεργοποίηση" compact wrap />
                  </Button>
                )}
              </div>

              <dl className="mt-2 grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-t border-border pt-3 text-left text-xs">
                <dt className="min-w-0 text-muted-foreground"><BilingualText en="Joined" el="Εγγραφή" stacked wrap /></dt>
                <dd className="whitespace-nowrap text-right"><RelativeTime date={user.createdAt} format={formatRelativeTime} /></dd>
                <dt className="min-w-0 text-muted-foreground"><BilingualText en="Last seen" el="Τελευταία παρουσία" stacked wrap /></dt>
                <dd className="whitespace-nowrap text-right">{user.lastSeenAt ? <RelativeTime date={user.lastSeenAt} format={formatRelativeTime} /> : dash}</dd>
                <dt className="text-muted-foreground">ID</dt>
                <dd className="max-w-[9rem] truncate text-right font-mono" title={user.id}>{user.id}</dd>
              </dl>
            </CardContent>
          </Card>

          <div className="min-w-0 space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
              <MetricTile icon={Flag} label="Open reports about them" labelEl="Ανοιχτές αναφορές γι' αυτόν" value={reportsData ? openAgainst.length : dash} caption={reportsData ? `${against.length} in total` : undefined} captionEl={reportsData ? `${against.length} συνολικά` : undefined} href="/admin/reports" />
              <MetricTile icon={Flag} label="Reports they filed" labelEl="Αναφορές που υπέβαλε" value={reportsData ? filed.length : dash} />
              <MetricTile icon={ScrollText} label="Admin actions" labelEl="Διαχειριστικές ενέργειες" value={auditData ? history.length : dash} href="/admin/audit-log" />
            </div>

            <SectionCard title="Reports about this account" titleEl="Αναφορές για αυτόν τον λογαριασμό" icon={Flag} action={{ href: '/admin/reports', label: 'All reports', labelEl: 'Όλες οι αναφορές' }}>
              {against.map((r) => (
                <div key={r.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={REPORT_STATUS[r.status] ?? 'secondary'} size="sm" className="capitalize"><StatusText value={r.status} /></Badge>
                    <span className="text-xs capitalize text-muted-foreground"><StatusText value={r.type} /></span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      <RelativeTime date={r.createdAt} format={formatRelativeTime} />
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm">{r.reason}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Reported by {r.reporter?.name ?? r.reporter?.email ?? 'someone'}</p>
                </div>
              ))}
              {reportsData && against.length === 0 && (
                <EmptyLine en="Nobody has reported this account." el="Κανείς δεν έχει αναφέρει αυτόν τον λογαριασμό." />
              )}
            </SectionCard>

            <SectionCard title="Admin history" titleEl="Ιστορικό διαχείρισης" icon={Shield} action={{ href: '/admin/audit-log', label: 'Audit log', labelEl: 'Αρχείο ελέγχου' }}>
              {history.map((l) => (
                <div key={l.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 border-b border-border py-2 text-sm last:border-b-0">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{l.action}</code>
                  <span className="min-w-0 flex-1 text-muted-foreground">
                    {l.actorEmail}
                    {typeof l.meta?.reason === 'string' ? ` · ${l.meta.reason}` : ''}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    <RelativeTime date={l.createdAt} format={formatRelativeTime} />
                  </span>
                </div>
              ))}
              {auditData && history.length === 0 && (
                <EmptyLine en="No admin action has been taken on this account." el="Δεν έχει γίνει διαχειριστική ενέργεια σε αυτόν τον λογαριασμό." />
              )}
            </SectionCard>
          </div>
        </div>
      )}
    </AppShell>
  );
}
