'use client';

import { StatusText } from '@/components/common/StatusText';
import { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  Filter,
  MoreVertical,
  Shield,
  Ban,
  Mail,
  CheckCircle2,
  AlertTriangle,
  UserX,
  RefreshCw,
  Download,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { usePageRail } from '@/components/layout/PageRailContext';
import { BilingualText } from '@/components/common/BilingualText';
import { downloadCsv } from '@/lib/csv';
import { CANCELLED, choiceControl, ROW_GONE, usePageControls, usePageList, type PageControl, type PageControlRunResult } from '@/lib/page-controls';
import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RelativeTime } from '@/components/common/RelativeTime';
import { formatRelativeTime, initialsOf } from '@/lib/utils';
import { listAdminUsers, updateAdminUserModeration, changeUserRole, type AdminUserItem } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { qk } from '@/lib/query-keys';
import { useDemoData } from '@/contexts/DemoDataContext';
import { bilingualInline } from '@/lib/i18n/format';

/**
 * The page's own row from the admin row.
 *
 * `/api/admin/users` and `listAdminUsers` have existed all along; this screen
 * listed a fixed array. `verified` and `tenant` have no counterpart on the
 * admin payload and are left unset rather than asserted — an unverified badge
 * on a verified account is worse than no badge.
 *
 * `moderationStatus` is the schema's word and maps straight across; "pending"
 * is a state the page knows and the model does not, so nothing maps onto it.
 */
function toPageUser(row: AdminUserItem): User {
  return {
    id: row.id,
    name: row.profile?.displayName ?? row.email,
    email: row.email,
    avatar: row.profile?.avatarUrl ?? undefined,
    role: row.role,
    status: row.moderationStatus,
    verified: false,
    createdAt: row.createdAt,
    lastActive: row.lastSeenAt ?? '',
  };
}

type User = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  status: 'active' | 'suspended' | 'pending' | 'banned';
  verified: boolean;
  createdAt: string;
  lastActive: string;
  tenant?: string;
};

/** The schema's roles (`enum Role`), in the order an admin reaches for them. */
const ASSIGNABLE_ROLES = ['founder', 'mentor', 'investor', 'org', 'admin'] as const;

/*
 * The rail's filter choices. Role now offers every role the schema has - the
 * select it replaces had no "Organisation", so org accounts could be assigned
 * from the row menu but never listed on their own.
 */
const ROLE_OPTIONS: { value: string; en: string; el: string }[] = [
  { value: 'all', en: 'All roles', el: 'Όλοι οι ρόλοι' },
  { value: 'founder', en: 'Founder', el: 'Ιδρυτής' },
  { value: 'mentor', en: 'Mentor', el: 'Μέντορας' },
  { value: 'investor', en: 'Investor', el: 'Επενδυτής' },
  { value: 'org', en: 'Organisation', el: 'Οργανισμός' },
  { value: 'admin', en: 'Admin', el: 'Διαχειριστής' },
];
const STATUS_OPTIONS: { value: string; en: string; el: string }[] = [
  { value: 'all', en: 'Any status', el: 'Οποιαδήποτε κατάσταση' },
  { value: 'active', en: 'Active', el: 'Ενεργός' },
  { value: 'pending', en: 'Pending', el: 'Σε αναμονή' },
  { value: 'suspended', en: 'Suspended', el: 'Σε αναστολή' },
  { value: 'banned', en: 'Banned', el: 'Αποκλεισμένος' },
];

type RowActions = {
  onModerate: (user: User, status: 'active' | 'suspended' | 'banned') => void;
  onRole: (user: User, role: (typeof ASSIGNABLE_ROLES)[number]) => void;
};

function UserRow({ user, onModerate, onRole }: { user: User } & RowActions) {
  const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
    active: { color: 'bg-status-success-bg text-status-success border-status-success-border', icon: <CheckCircle2 className="icon-sm" /> },
    suspended: { color: 'bg-status-warning-bg text-status-warning border-status-warning-border', icon: <AlertTriangle className="icon-sm" /> },
    pending: { color: 'bg-muted text-muted-foreground border-border', icon: null },
    banned: { color: 'bg-status-danger-bg text-status-danger border-status-danger-border', icon: <Ban className="icon-sm" /> },
  };

  const config = statusConfig[user.status];
  const initials = (user.name ? initialsOf(user.name) : '??');

  return (
    <div className="flex items-center gap-4 p-4 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
      <Avatar className="h-10 w-10">
        <AvatarImage src={user.avatar} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link href={`/p/${user.id}`} className="font-medium hover:text-primary-accessible transition-colors">
            {user.name}
          </Link>
          {user.verified && <CheckCircle2 className="icon-sm text-primary-accessible" />}
        </div>
        <p className="text-sm text-muted-foreground truncate">{user.email}</p>
        <p className="mt-0.5 text-xs text-muted-foreground md:hidden">
          <StatusText value={user.role} /> · <StatusText value={user.status} />{user.tenant ? ` · ${user.tenant}` : ''}
        </p>
      </div>
      <div className="hidden md:block text-sm text-muted-foreground w-24">
        <StatusText value={user.role} />
      </div>
      <div className="hidden lg:block text-sm text-muted-foreground w-32">
        {user.tenant || <BilingualText en="Public" el="Δημόσιο" compact />}
      </div>
      <div className="hidden md:block text-sm text-muted-foreground w-28">
        {user.lastActive
          ? <RelativeTime date={user.lastActive} format={formatRelativeTime} />
          : '—'}
      </div>
      {/* Natural width: a fixed 96px cut "Suspended · Σε αναστολή". Below md
          the meta line under the email already says the status. */}
      <Badge variant="outline" className={cn('hidden md:flex text-xs items-center gap-1 min-w-24 justify-center whitespace-nowrap', config.color)}>
        {config.icon}
        <StatusText value={user.status} />
      </Badge>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button aria-label="More options" variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="icon-sm" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/p/${user.id}`}><BilingualText en="View Profile" el="Προβολή προφίλ" compact /></Link>
          </DropdownMenuItem>
          {/* Every item below had no handler: Send Email, Change Role,
              Suspend, Reactivate and Ban closed the menu and did nothing.
              The routes were there all along (admin.controller.ts:
              PATCH users/:userId/role, PATCH users/:userId/moderation). */}
          <DropdownMenuItem asChild>
            <a href={`mailto:${user.email}`}>
              <Mail className="mr-2 icon-sm" aria-hidden="true" />
              <BilingualText en="Send Email" el="Αποστολή email" compact />
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Shield className="icon-sm" aria-hidden="true" />
            <BilingualText en="Change Role" el="Αλλαγή ρόλου" compact />
          </DropdownMenuLabel>
          {ASSIGNABLE_ROLES.map((r) => {
            const current = user.role.toLowerCase() === r;
            return (
              <DropdownMenuItem key={r} disabled={current} onSelect={() => onRole(user, r)} className="pl-8 capitalize">
                {r}
                {current && <CheckCircle2 className="ml-auto icon-sm text-primary-accessible" aria-label="Current role" />}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          {user.status === 'active' && (
            <DropdownMenuItem className="text-status-warning" onSelect={() => onModerate(user, 'suspended')}>
              <AlertTriangle className="mr-2 icon-sm" aria-hidden="true" />
              <BilingualText en="Suspend User" el="Αναστολή χρήστη" compact />
            </DropdownMenuItem>
          )}
          {(user.status === 'suspended' || user.status === 'banned') && (
            <DropdownMenuItem className="text-status-success" onSelect={() => onModerate(user, 'active')}>
              <CheckCircle2 className="mr-2 icon-sm" aria-hidden="true" />
              {user.status === 'banned' ? 'Lift Ban' : 'Reactivate User'}
            </DropdownMenuItem>
          )}
          {user.status !== 'banned' && (
            <DropdownMenuItem className="text-destructive-accessible" onSelect={() => onModerate(user, 'banned')}>
              <UserX className="mr-2 icon-sm" aria-hidden="true" />
              <BilingualText en="Ban User" el="Αποκλεισμός χρήστη" compact />
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Shown when the directory has not loaded. */
const SEED_USERS: User[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'Founder',
    status: 'active',
    verified: true,
    createdAt: 'Jan 15, 2025',
    lastActive: '2 hours ago',
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'Mentor',
    status: 'active',
    verified: true,
    createdAt: 'Feb 1, 2025',
    lastActive: '1 day ago',
    tenant: 'TechStars Athens',
  },
  {
    id: '3',
    name: 'Mike Johnson',
    email: 'mike@example.com',
    role: 'Founder',
    status: 'suspended',
    verified: false,
    createdAt: 'Mar 10, 2025',
    lastActive: '1 week ago',
  },
  {
    id: '4',
    name: 'Sarah Williams',
    email: 'sarah@example.com',
    role: 'Investor',
    status: 'active',
    verified: true,
    createdAt: 'Mar 5, 2025',
    lastActive: '3 hours ago',
  },
  {
    id: '5',
    name: 'Tom Brown',
    email: 'tom@example.com',
    role: 'Founder',
    status: 'pending',
    verified: false,
    createdAt: 'Mar 20, 2025',
    lastActive: 'Never',
  },
];

export default function AdminUsersPage() {
  // Illustrative rows are for the showcase; a real account with nothing
  // to list sees the page's empty state, not invented people and records.
  const { showDemoData } = useDemoData();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const { openRailSection } = usePageRail();

  // Mock data
  /*
   * The real directory. The seed below is what an empty instance shows, so
   * the screen still teaches its shape rather than opening blank.
   */
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: qk('admin', 'users'),
    queryFn: () => listAdminUsers({ limit: 100 }),
    staleTime: 60_000,
    retry: 0,
  });

  const live = useMemo(() => (data?.users ?? []).map(toPageUser), [data]);
  const users: User[] = live.length > 0 ? live : isLoading || !showDemoData ? [] : SEED_USERS;
  const isLive = live.length > 0;
  const queryClient = useQueryClient();
  const { success, error } = useToast();
  const confirm = useConfirm();

  // Writes go to the real directory only. The seed rows show the screen's
  // shape on an empty instance; acting on them would report a change that
  // never reached any account.
  const refuseOnSeed = (): PageControlRunResult => {
    error('Nothing to update', 'These rows are illustrative until the user directory loads.');
    return { error: 'These rows are illustrative until the user directory loads.' };
  };

  const moderate = async (user: User, next: 'active' | 'suspended' | 'banned'): Promise<PageControlRunResult> => {
    if (!isLive) return refuseOnSeed();
    if (next === 'banned') {
      const ok = await confirm({
        title: <BilingualText en={`Ban ${user.name}?`} el={`Αποκλεισμός: ${user.name};`} />,
        description: <BilingualText en="They are signed out and cannot sign back in until the ban is lifted from this menu." el="Αποσυνδέεται και δεν μπορεί να συνδεθεί ξανά μέχρι να αρθεί ο αποκλεισμός από αυτό το μενού." />,
        confirmLabel: <BilingualText en="Ban user" el="Αποκλεισμός χρήστη" compact />,
      });
      if (!ok) return CANCELLED;
    }
    try {
      await updateAdminUserModeration(user.id, next);
      success('Status updated', `${user.name} is now ${next}.`);
    } catch (err) {
      error('Could not update the status', err instanceof Error ? err.message : undefined);
      return { error: err instanceof Error && err.message ? err.message : 'The status could not be updated.' };
    } finally {
      void queryClient.invalidateQueries({ queryKey: qk('admin', 'users') });
    }
  };

  const assignRole = async (user: User, next: (typeof ASSIGNABLE_ROLES)[number]): Promise<PageControlRunResult> => {
    if (!isLive) return refuseOnSeed();
    try {
      await changeUserRole(user.id, next);
      success('Role updated', `${user.name} is now ${next}.`);
    } catch (err) {
      error('Could not change the role', err instanceof Error ? err.message : undefined);
      return { error: err instanceof Error && err.message ? err.message : 'The role could not be changed.' };
    } finally {
      void queryClient.invalidateQueries({ queryKey: qk('admin', 'users') });
    }
  };


  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = role === 'all' || u.role.toLowerCase() === role;
    const matchesStatus = status === 'all' || u.status === status;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const exportCsv = () =>
    downloadCsv(
      'users',
      ['name', 'email', 'role', 'status', 'created_at', 'last_active'],
      filteredUsers.map((u) => [u.name, u.email, u.role, u.status, u.createdAt, u.lastActive]),
    );

  const statusCounts = {
    all: users.length,
    active: users.filter((u) => u.status === 'active').length,
    suspended: users.filter((u) => u.status === 'suspended').length,
    pending: users.filter((u) => u.status === 'pending').length,
    banned: users.filter((u) => u.status === 'banned').length,
  };
  const activeFilterCount = (role !== 'all' ? 1 : 0) + (status !== 'all' ? 1 : 0);
  const clearFilters = () => { setRole('all'); setStatus('all'); };

  const totals = [
    { id: 'total', en: 'Total users', el: 'Σύνολο χρηστών', value: statusCounts.all, icon: Users, tone: 'text-primary-accessible' },
    { id: 'active', en: 'Active', el: 'Ενεργοί', value: statusCounts.active, icon: CheckCircle2, tone: 'text-status-success' },
    { id: 'pending', en: 'Pending', el: 'Σε αναμονή', value: statusCounts.pending, icon: AlertTriangle, tone: 'text-muted-foreground' },
    { id: 'suspended', en: 'Suspended', el: 'Σε αναστολή', value: statusCounts.suspended, icon: UserX, tone: 'text-status-warning' },
    { id: 'banned', en: 'Banned', el: 'Αποκλεισμένοι', value: statusCounts.banned, icon: Ban, tone: 'text-status-danger' },
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
   * The page rail, as on /admin/tenants and /admin/user-management. The
   * column is the directory and its search - what an admin comes here to do.
   * The four totals that opened the page (now five: banned accounts had no
   * count), the role and status filters and the export are about that list,
   * so they sit one gesture away. The totals' badge is suspended + banned
   * accounts; the filters' badge is how many are narrowing the list.
   */
  const rail: PageRailSection[] = [
    {
      id: 'totals',
      glyph: 'chart',
      labelEn: 'User totals',
      labelEl: 'Σύνολα χρηστών',
      badge: statusCounts.suspended + statusCounts.banned || null,
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
              <BilingualText en="Role" el="Ρόλος" compact />
            </legend>
            {ROLE_OPTIONS.map((o) => filterButton(role === o.value, () => setRole(o.value), o.en, o.el, o.value))}
          </fieldset>
          <fieldset className="space-y-1.5">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <BilingualText en="Status" el="Κατάσταση" compact />
            </legend>
            {STATUS_OPTIONS.map((o) => filterButton(status === o.value, () => setStatus(o.value), o.en, o.el, o.value))}
          </fieldset>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="tap-target flex min-h-9 w-full items-center rounded-lg px-2.5 text-left text-sm text-primary-accessible hover:bg-muted/70"
            >
              <BilingualText en="Clear role and status" el="Καθαρισμός ρόλου και κατάστασης" compact wrap />
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
            <span className="min-w-0 flex-1"><BilingualText en="Refresh users" el="Ανανέωση χρηστών" compact wrap /></span>
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={filteredUsers.length === 0}
            className="tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="icon-sm shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <BilingualText en={`Export ${filteredUsers.length} users as CSV`} el={`Εξαγωγή ${filteredUsers.length} χρηστών σε CSV`} compact wrap />
            </span>
          </button>
        </div>
      ),
    },
  ];

  /*
   * The same controls, offered to the assistant: the two filters, refresh,
   * export, and the row menu's moderation and role commands. Each runs the
   * handler the page's own control calls - banning still asks first, and
   * sample rows still refuse - so "suspend Mike Johnson" from the chat is
   * the row menu's Suspend, confirmed twice.
   */
  const userRows = users.map((u) => ({ value: u.id, labelEn: u.name, labelEl: u.name }));
  usePageList([
    {
      id: 'users',
      labelEn: 'Users',
      labelEl: 'Χρήστες',
      rows: isLoading ? undefined : filteredUsers.map((u) =>
        `${u.name} · ${u.email} · ${u.role} · ${u.status}${u.verified ? ' · verified' : ''}${u.tenant ? ` · ${u.tenant}` : ''}`,
      ),
      total: users.length,
      sample: !isLive,
    },
  ]);
  const onRows = isLive ? undefined : 'These rows are illustrative until the user directory loads.';
  const onRowsEl = isLive ? undefined : 'Οι γραμμές είναι ενδεικτικές μέχρι να φορτώσει ο κατάλογος χρηστών.';
  const moderationCommand = (id: string, en: string, el: string, next: 'active' | 'suspended' | 'banned'): PageControl => ({
    id,
    labelEn: en,
    labelEl: el,
    writes: true,
    options: userRows,
    unavailableEn: onRows,
    unavailableEl: onRowsEl,
    // The moderation endpoint sets one field, `moderationStatus`, to what it
    // is sent (admin.service updateUserModerationStatus), so the command that
    // sets the row's previous status restores it exactly. `pending` is not a
    // stored status, so a pending row has no opposite.
    undo: (value) => {
      const prior = users.find((u) => u.id === value)?.status;
      const back = prior === 'active' ? 'reinstate_user' : prior === 'suspended' ? 'suspend_user' : prior === 'banned' ? 'ban_user' : undefined;
      return back && prior !== next ? { control: back, value } : undefined;
    },
    run: (value) => {
      const user = users.find((u) => u.id === value);
      return user ? moderate(user, next) : ROW_GONE;
    },
  });
  const ROLE_EL: Record<(typeof ASSIGNABLE_ROLES)[number], string> = {
    founder: 'Ιδρυτής', mentor: 'Μέντορας', investor: 'Επενδυτής', org: 'Οργανισμός', admin: 'Διαχειριστής',
  };
  usePageControls([
    choiceControl('role_filter', 'Role filter', 'Φίλτρο ρόλου', ROLE_OPTIONS, role, setRole),
    choiceControl('status_filter', 'Status filter', 'Φίλτρο κατάστασης', STATUS_OPTIONS, status, setStatus),
    { id: 'refresh', labelEn: 'Refresh users', labelEl: 'Ανανέωση χρηστών', writes: false, run: () => void refetch() },
    {
      id: 'export_csv',
      labelEn: 'Export users as CSV',
      labelEl: 'Εξαγωγή χρηστών σε CSV',
      writes: false,
      unavailableEn: filteredUsers.length === 0 ? 'No users match the current filters.' : undefined,
      unavailableEl: filteredUsers.length === 0 ? 'Κανένας χρήστης δεν ταιριάζει στα τρέχοντα φίλτρα.' : undefined,
      run: exportCsv,
    },
    moderationCommand('suspend_user', 'Suspend user', 'Αναστολή χρήστη', 'suspended'),
    moderationCommand('ban_user', 'Ban user', 'Αποκλεισμός χρήστη', 'banned'),
    moderationCommand('reinstate_user', 'Reinstate user', 'Επαναφορά χρήστη', 'active'),
    ...ASSIGNABLE_ROLES.map((r): PageControl => ({
      id: `role_${r}`,
      labelEn: `Change role to ${ROLE_OPTIONS.find((o) => o.value === r)?.en ?? r}`,
      labelEl: `Αλλαγή ρόλου σε ${ROLE_EL[r]}`,
      writes: true,
      options: userRows,
      unavailableEn: onRows,
      unavailableEl: onRowsEl,
      // One field, `role` (admin.service changeUserRole): setting the previous
      // role back restores it, when that role is one this page can assign.
      undo: (value) => {
        const prior = users.find((u) => u.id === value)?.role;
        return prior && prior !== r && (ASSIGNABLE_ROLES as readonly string[]).includes(prior) ? { control: `role_${prior}`, value } : undefined;
      },
      run: (value) => {
        const user = users.find((u) => u.id === value);
        return user ? assignRole(user, r) : ROW_GONE;
      },
    })),
  ]);

  const roleLabel = ROLE_OPTIONS.find((o) => o.value === role);
  const statusLabel = STATUS_OPTIONS.find((o) => o.value === status);

  return (
    <AppShell rail={rail}>
      <div className="space-y-6">
        {/* Search stays in the column: it is how the list is used, not a
            setting on it. The filters live in the rail; the line below says
            which are on, because a short list with no stated reason reads as
            a short directory. */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder={bilingualInline("Search users…", "Αναζήτηση χρηστών…")}
              aria-label="Search users by name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            <BilingualText
              en={`${filteredUsers.length} of ${users.length} users${role !== 'all' ? ` · ${roleLabel?.en}` : ''}${status !== 'all' ? ` · ${statusLabel?.en}` : ''}`}
              el={`${filteredUsers.length} από ${users.length} χρήστες${role !== 'all' ? ` · ${roleLabel?.el}` : ''}${status !== 'all' ? ` · ${statusLabel?.el}` : ''}`}
              compact
              wrap
            />
          </p>
        </div>

        {/* Users Table */}
        <Card>
          <div data-column-headers className="hidden md:flex items-center gap-4 px-4 py-3 border-b text-sm font-medium text-muted-foreground">
            <div className="w-10" />
            <div className="flex-1"><BilingualText en="User" el="Χρήστης" compact /></div>
            <div className="w-24"><BilingualText en="Role" el="Ρόλος" compact /></div>
            <div className="hidden lg:block w-32"><BilingualText en="Tenant" el="Οργανισμός" compact /></div>
            <div className="w-28"><BilingualText en="Last Active" el="Τελευταία δραστηριότητα" compact /></div>
            <div className="w-24 text-center"><BilingualText en="Status" el="Κατάσταση" compact /></div>
            <div className="w-8" />
          </div>
          {filteredUsers.map((user) => (
            <UserRow key={user.id} user={user} onModerate={moderate} onRole={assignRole} />
          ))}
          {filteredUsers.length === 0 && (
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" aria-hidden="true" />
              <h3 className="font-medium"><BilingualText en="No users found" el="Δεν βρέθηκαν χρήστες" compact /></h3>
              <p className="text-sm text-muted-foreground mt-1">
                <BilingualText en="Try adjusting your filters" el="Δοκιμάστε να αλλάξετε τα φίλτρα" compact />
              </p>
              {activeFilterCount > 0 && (
                <Button variant="outline" size="sm" className="mt-4" onClick={() => openRailSection('filters')}>
                  <BilingualText en="Show filters" el="Εμφάνιση φίλτρων" compact />
                </Button>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
