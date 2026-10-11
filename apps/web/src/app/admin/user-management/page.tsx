'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  MoreHorizontal,
  Shield,
  Ban,
  Mail,
  CheckCircle2,
  AlertTriangle,
  UserX,
  Download,
  RefreshCw,
  Eye,
  Clock,
  User,
  GraduationCap,
  Rocket,
  Award,
  TrendingUp,
  Building2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { BilingualText } from '@/components/common/BilingualText';
import { SampleDataNotice } from '@/components/common/SampleDataNotice';
import { RelativeTime } from '@/components/common/RelativeTime';
import { formatRelativeTime } from '@/lib/utils';
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listAdminUsers,
  updateAdminUserModeration,
  changeUserRole,
  type AdminUserItem,
} from '@/lib/api';
import { HelpCallout } from '@/components/common/HelpCallout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { qk } from '@/lib/query-keys';
import { useDemoData } from '@/contexts/DemoDataContext';
import { choiceControl, ROW_GONE, rowOptions, usePageControls, usePageList, type PageControl, type PageControlRunResult } from '@/lib/page-controls';
import { bilingualInline } from '@/lib/i18n/format';
import { StatusText } from '@/components/common/StatusText';

type UserStatus = 'active' | 'suspended' | 'pending' | 'banned';
// The API's Role enum (schema.prisma). The page used to offer moderator,
// co-founder and user, which ChangeUserRoleDto rejects, and filed every
// investor and organisation account under "user".
type UserRole = 'founder' | 'mentor' | 'investor' | 'org' | 'admin' | 'super_admin';

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
  status: UserStatus;
  verified: boolean;
  createdAt: string;
  lastActive: string;
  location?: string;
  tenant?: string;
};

/**
 * The page's own row from the admin row.
 *
 * Every action on this screen wrote to local state and reported success:
 * "Status updated", "Role updated", "Bulk update" — and nothing left the
 * browser. They write through the admin endpoints now, and the list refreshes
 * from the server rather than from what the page assumed happened.
 *
 * `verified`, `location` and `tenant` have no counterpart on the admin payload
 * and stay unset rather than asserted.
 */
function toManagedUser(row: AdminUserItem): ManagedUser {
  const role = (['founder', 'mentor', 'investor', 'org', 'admin', 'super_admin'] as const)
    .includes(row.role as UserRole)
    ? (row.role as UserRole)
    : 'founder';
  return {
    id: row.id,
    name: row.profile?.displayName ?? row.email,
    email: row.email,
    avatar: row.profile?.avatarUrl ?? undefined,
    role,
    status: row.moderationStatus,
    verified: false,
    createdAt: row.createdAt,
    lastActive: row.lastSeenAt ?? '',
  };
}

/** Shown when the directory has not loaded. */
const MOCK_USERS: ManagedUser[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'founder',
    status: 'active',
    verified: true,
    createdAt: '2024-01-15',
    lastActive: '2026-09-04T08:00:00.000Z',
    location: 'Athens, GR',
    tenant: 'Public',
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'mentor',
    status: 'active',
    verified: true,
    createdAt: '2024-02-01',
    lastActive: '2026-09-03T10:00:00.000Z',
    location: 'London, UK',
    tenant: 'TechStars Athens',
  },
  {
    id: '3',
    name: 'Mike Johnson',
    email: 'mike@example.com',
    role: 'founder',
    status: 'suspended',
    verified: false,
    createdAt: '2024-03-10',
    lastActive: '2026-08-28T10:00:00.000Z',
    location: 'Berlin, DE',
  },
  {
    id: '4',
    name: 'Sarah Williams',
    email: 'sarah@example.com',
    role: 'admin',
    status: 'active',
    verified: true,
    createdAt: '2024-03-05',
    lastActive: '2026-09-04T07:00:00.000Z',
    location: 'New York, US',
  },
  {
    id: '5',
    name: 'David Kim',
    email: 'david.kim@example.com',
    role: 'investor',
    status: 'pending',
    verified: false,
    createdAt: '2024-04-02',
    lastActive: '',
    location: 'Boston, MA',
  },
];

const STATUS_STYLES: Record<UserStatus, string> = {
  active: 'bg-status-success-bg text-status-success border-status-success-border',
  suspended: 'bg-status-warning-bg text-status-warning border-status-warning-border',
  pending: 'bg-status-warning-bg text-status-warning border-status-warning-border',
  banned: 'bg-status-danger-bg text-status-danger border-status-danger-border',
};

const ROLE_ICONS: Record<UserRole, React.ReactNode> = {
  admin: <Shield className="icon-sm" />,
  super_admin: <Award className="icon-sm" />,
  mentor: <GraduationCap className="icon-sm" />,
  founder: <Rocket className="icon-sm" />,
  investor: <TrendingUp className="icon-sm" />,
  org: <Building2 className="icon-sm" />,
};

const ROLE_OPTIONS: { value: UserRole; en: string; el: string }[] = [
  { value: 'founder', en: 'Founder', el: 'Ιδρυτής' },
  { value: 'mentor', en: 'Mentor', el: 'Μέντορας' },
  { value: 'investor', en: 'Investor', el: 'Επενδυτής' },
  { value: 'org', en: 'Organisation', el: 'Οργανισμός' },
  { value: 'admin', en: 'Admin', el: 'Διαχειριστής' },
  { value: 'super_admin', en: 'Super admin', el: 'Υπερδιαχειριστής' },
];
const roleLabel = (role: UserRole) => ROLE_OPTIONS.find((r) => r.value === role)?.en ?? role;

export default function AdminUserManagementPage() {
  const { success, error } = useToast();
  const qc = useQueryClient();
  const { data: adminUsers } = useQuery({
    queryKey: qk('admin', 'users'),
    queryFn: () => listAdminUsers({ limit: 200 }),
    staleTime: 60_000,
    retry: 0,
  });

  // The sample rows stood in for a failed read in production too; they are
  // the showcase's now.
  const { showDemoData } = useDemoData();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  /** True once real rows are in hand: the write paths refuse to act on the
   *  illustrative ones, which have no server row behind them. */
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const rows = adminUsers?.users ?? [];
    if (rows.length === 0) {
      if (showDemoData) setUsers(MOCK_USERS);
      return;
    }
    setUsers(rows.map(toManagedUser));
    setIsLive(true);
  }, [adminUsers, showDemoData]);

  const refresh = () => qc.invalidateQueries({ queryKey: qk('admin', 'users') });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'email' | 'createdAt' | 'lastActive'>('name');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailUser, setDetailUser] = useState<ManagedUser | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filtered = useMemo(() => {
    const list = users.filter((u) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.location?.toLowerCase().includes(q) ?? false);
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });

    list.sort((a, b) => {
      const av = a[sortBy] ?? '';
      const bv = b[sortBy] ?? '';
      return String(av).localeCompare(String(bv));
    });

    return list;
  }, [users, search, roleFilter, statusFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const stats = {
    total: users.length,
    active: users.filter((u) => u.status === 'active').length,
    pending: users.filter((u) => u.status === 'pending').length,
    suspended: users.filter((u) => u.status === 'suspended').length,
  };

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? paginated.map((u) => u.id) : []);
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id),
    );
  };

  /** `pending` is a state this page knows and the model does not. */
  const moderationOf = (status: UserStatus): 'active' | 'suspended' | 'banned' | null =>
    status === 'active' || status === 'suspended' || status === 'banned' ? status : null;

  const updateStatus = async (id: string, status: UserStatus): Promise<PageControlRunResult> => {
    const moderation = moderationOf(status);
    if (!moderation) {
      error('Not a stored status', 'The platform records active, suspended or banned.');
      return { error: 'The platform records active, suspended or banned.' };
    }
    if (!isLive) {
      error('Nothing to update', 'These rows are illustrative until the directory loads.');
      return { error: 'These rows are illustrative until the directory loads.' };
    }
    // Optimistic, then reconciled with the server on refresh.
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status } : u)));
    try {
      await updateAdminUserModeration(id, moderation);
      success('Status updated', `User is now ${status}.`);
    } catch (err) {
      error('Could not update the status', err instanceof Error ? err.message : undefined);
      return { error: err instanceof Error && err.message ? err.message : 'The status could not be updated.' };
    } finally {
      void refresh();
    }
  };

  const updateRole = async (id: string, role: UserRole): Promise<PageControlRunResult> => {
    if (!isLive) {
      error('Nothing to update', 'These rows are illustrative until the directory loads.');
      return { error: 'These rows are illustrative until the directory loads.' };
    }
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
    try {
      await changeUserRole(id, role);
      success('Role updated', `User role changed to ${role}.`);
    } catch (err) {
      error('Could not update the role', err instanceof Error ? err.message : undefined);
      return { error: err instanceof Error && err.message ? err.message : 'The role could not be updated.' };
    } finally {
      void refresh();
    }
  };

  /** The filtered list, as a CSV - the header button never had a handler. */
  const exportCsv = () => {
    if (!filtered.length) return;
    const header = 'Name,Email,Role,Status,Created,Last Active\n';
    const body = filtered
      .map((u) => [u.name, u.email, u.role, u.status, u.createdAt, u.lastActive].join(','))
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const bulkAction = async (action: 'activate' | 'suspend' | 'ban') => {
    if (selectedIds.length === 0) {
      error('No selection', 'Select at least one user first.');
      return;
    }
    if (!isLive) {
      error('Nothing to update', 'These rows are illustrative until the directory loads.');
      return;
    }
    const status: UserStatus =
      action === 'activate' ? 'active' : action === 'ban' ? 'banned' : 'suspended';
    const results = await Promise.allSettled(
      selectedIds.map((id) => updateAdminUserModeration(id, status)),
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      error('Bulk update partly failed', `${failed} of ${selectedIds.length} could not be changed.`);
    } else {
      success('Bulk update', `${selectedIds.length} user(s) set to ${status}.`);
    }
    setSelectedIds([]);
    void refresh();
  };

  const activeFilters =
    (roleFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0) + (search.trim() ? 1 : 0);

  /*
   * The page rail: the old left column (filters, sort, bulk actions), the
   * totals and the header utilities, as four families. The column keeps the
   * work - search and the table. The bulk badge counts the selection, so a
   * row ticked on the page is visible on the collapsed strip.
   */
  const rail: PageRailSection[] = [
    {
      id: 'totals',
      glyph: 'chart',
      labelEn: 'User totals',
      labelEl: 'Σύνολα χρηστών',
      badge: stats.pending || null,
      content: (
        <div className="space-y-2">
          {[
            { label: 'Total users', labelEl: 'Σύνολο χρηστών', value: stats.total, icon: Users },
            { label: 'Active', labelEl: 'Ενεργοί', value: stats.active, icon: CheckCircle2, className: 'text-status-success' },
            { label: 'Pending', labelEl: 'Σε αναμονή', value: stats.pending, icon: Clock, className: 'text-status-warning' },
            { label: 'Suspended', labelEl: 'Σε αναστολή', value: stats.suspended, icon: Ban, className: 'text-status-danger' },
          ].map(({ label, labelEl, value, icon: Icon, className }) => (
            <Card key={label}>
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground"><BilingualText en={label} el={labelEl} compact wrap /></p>
                  <p className={cn('page-stat text-2xl font-bold', className)}>{value}</p>
                </div>
                <Icon className={cn('icon-lg text-muted-foreground', className)} />
              </CardContent>
            </Card>
          ))}
        </div>
      ),
    },
    {
      id: 'filters',
      glyph: 'target',
      labelEn: 'Filters',
      labelEl: 'Φίλτρα',
      badge: activeFilters || null,
      content: (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"><BilingualText en="Role" el="Ρόλος" compact /></p>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger aria-label="Role" className="mt-2">
                <SelectValue placeholder={bilingualInline("All roles", "Όλοι οι ρόλοι")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all"><BilingualText en="All roles" el="Όλοι οι ρόλοι" compact /></SelectItem>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"><BilingualText en="Status" el="Κατάσταση" compact /></p>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger aria-label="Status" className="mt-2">
                <SelectValue placeholder={bilingualInline("All statuses", "Όλες οι καταστάσεις")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all"><BilingualText en="All statuses" el="Όλες οι καταστάσεις" compact /></SelectItem>
                <SelectItem value="active"><BilingualText en="Active" el="Ενεργός" compact /></SelectItem>
                <SelectItem value="pending"><BilingualText en="Pending" el="Σε αναμονή" compact /></SelectItem>
                <SelectItem value="suspended"><BilingualText en="Suspended" el="Σε αναστολή" compact /></SelectItem>
                <SelectItem value="banned"><BilingualText en="Banned" el="Αποκλεισμένος" compact /></SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"><BilingualText en="Sort by" el="Ταξινόμηση" compact /></p>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger aria-label="Sort by" className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name"><BilingualText en="Name" el="Όνομα" compact /></SelectItem>
                <SelectItem value="email"><BilingualText en="Email" el="Email" compact /></SelectItem>
                <SelectItem value="createdAt"><BilingualText en="Created date" el="Ημερομηνία δημιουργίας" compact /></SelectItem>
                <SelectItem value="lastActive"><BilingualText en="Last active" el="Τελευταία δραστηριότητα" compact /></SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ),
    },
    {
      id: 'bulk',
      glyph: 'shield',
      labelEn: 'Bulk actions',
      labelEl: 'Μαζικές ενέργειες',
      badge: selectedIds.length || null,
      content: (
        <div className="space-y-2">
          <p className="px-1 text-xs text-muted-foreground">
            <BilingualText en="Apply to the rows ticked in the table." el="Εφαρμογή στις επιλεγμένες γραμμές του πίνακα." compact wrap />
          </p>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => void bulkAction('activate')}>
            <CheckCircle2 className="icon-sm mr-2" /> <BilingualText en="Activate selected" el="Ενεργοποίηση επιλεγμένων" compact />
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => void bulkAction('suspend')}>
            <Ban className="icon-sm mr-2" /> <BilingualText en="Suspend selected" el="Αναστολή επιλεγμένων" compact />
          </Button>
          {/*
            * "Delete selected" removed rows from a local array and said so
            * in a toast. There is no delete-user endpoint, and there should
            * not be one behind a bulk button — banning is the reversible
            * action the platform actually records.
            */}
          <Button variant="destructive" size="sm" className="w-full justify-start" onClick={() => void bulkAction('ban')}>
            <Ban className="icon-sm mr-2" /> <BilingualText en="Ban selected" el="Αποκλεισμός επιλεγμένων" compact />
          </Button>
        </div>
      ),
    },
    {
      id: 'tools',
      glyph: 'sliders',
      labelEn: 'Data tools',
      labelEl: 'Εργαλεία δεδομένων',
      content: (
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => setUsers(MOCK_USERS)}
            className="tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted/70"
          >
            <RefreshCw className="icon-sm shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1"><BilingualText en="Reset demo data" el="Επαναφορά δείγματος" compact wrap /></span>
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!filtered.length}
            className="tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted/70 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="icon-sm shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1"><BilingualText en="Export filtered list (CSV)" el="Εξαγωγή φιλτραρισμένης λίστας (CSV)" compact wrap /></span>
          </button>
        </div>
      ),
    },
  ];


  // Offered to the assistant: the three selects, the page, export, and every
  // item of the row menu - the same handlers, which still refuse the
  // illustrative rows. Rows are the whole filtered list, not one page of it.
  const SAMPLE_EN = isLive ? undefined : 'These rows are illustrative until the directory loads.';
  const SAMPLE_EL = isLive ? undefined : 'Οι γραμμές είναι ενδεικτικές μέχρι να φορτώσει ο κατάλογος.';
  const byName = (list: ManagedUser[]) => rowOptions(list, (u) => u.id, (u) => u.name);
  const rowCommand = (
    id: string,
    en: string,
    el: string,
    list: ManagedUser[],
    run: (u: ManagedUser) => PageControlRunResult | Promise<PageControlRunResult>,
    undo?: (u: ManagedUser) => string | undefined,
  ): PageControl => ({
    id,
    labelEn: en,
    labelEl: el,
    writes: true,
    options: byName(list),
    unavailableEn: SAMPLE_EN,
    unavailableEl: SAMPLE_EL,
    ...(undo ? { undo: (v?: string) => { const u = users.find((row) => row.id === v); const back = u ? undo(u) : undefined; return back ? { control: back, value: v } : undefined; } } : {}),
    run: (v) => { const u = users.find((row) => row.id === v); return u ? run(u) : ROW_GONE; },
  });
  // The moderation and role endpoints each set one field to what they are
  // sent (admin.service), so the command that sets the previous value back
  // restores the row. `pending` is not stored, and roles this page cannot set
  // have no command, so neither has an opposite.
  const backToStatus = (u: ManagedUser) =>
    u.status === 'active' ? 'set_active' : u.status === 'suspended' ? 'suspend_user' : u.status === 'banned' ? 'ban_user' : undefined;
  usePageList([
    {
      id: 'users',
      labelEn: 'Users',
      labelEl: 'Χρήστες',
      rows: filtered.map((u) => `${u.name} · ${u.email} · ${u.role} · ${u.status}${u.location ? ` · ${u.location}` : ''}`),
      total: users.length,
      sample: !isLive,
    },
  ]);
  usePageControls([
    choiceControl('role_filter', 'Role filter', 'Φίλτρο ρόλου', [
      { value: 'all', en: 'All roles', el: 'Όλοι οι ρόλοι' },
      ...ROLE_OPTIONS,
    ], roleFilter, (v) => { setRoleFilter(v); setPage(1); }),
    choiceControl('status_filter', 'Status filter', 'Φίλτρο κατάστασης', [
      { value: 'all', en: 'All statuses', el: 'Όλες οι καταστάσεις' },
      { value: 'active', en: 'Active', el: 'Ενεργός' },
      { value: 'pending', en: 'Pending', el: 'Σε αναμονή' },
      { value: 'suspended', en: 'Suspended', el: 'Σε αναστολή' },
      { value: 'banned', en: 'Banned', el: 'Αποκλεισμένος' },
    ], statusFilter, (v) => { setStatusFilter(v); setPage(1); }),
    choiceControl('sort', 'Sort users', 'Ταξινόμηση χρηστών', [
      { value: 'name', en: 'Name', el: 'Όνομα' },
      { value: 'email', en: 'Email', el: 'Email' },
      { value: 'createdAt', en: 'Created date', el: 'Ημερομηνία δημιουργίας' },
      { value: 'lastActive', en: 'Last active', el: 'Τελευταία δραστηριότητα' },
    ], sortBy, (v) => setSortBy(v as typeof sortBy)),
    {
      id: 'page',
      labelEn: 'Go to page',
      labelEl: 'Μετάβαση σε σελίδα',
      writes: false,
      options: Array.from({ length: totalPages }, (_, i) => ({ value: String(i + 1), labelEn: `Page ${i + 1}`, labelEl: `Σελίδα ${i + 1}` })),
      current: String(page),
      run: (v) => { if (v) setPage(Number(v)); },
    },
    {
      id: 'export_csv',
      labelEn: 'Export users as CSV',
      labelEl: 'Εξαγωγή χρηστών σε CSV',
      writes: false,
      unavailableEn: filtered.length ? undefined : 'There is nothing to export.',
      unavailableEl: filtered.length ? undefined : 'Δεν υπάρχει κάτι για εξαγωγή.',
      run: exportCsv,
    },
    { id: 'quick_view', labelEn: 'Quick view a user', labelEl: 'Γρήγορη προβολή χρήστη', writes: false, options: byName(filtered), run: (v) => { const u = users.find((row) => row.id === v); if (u) setDetailUser(u); } },
    rowCommand('set_active', 'Set user active', 'Ενεργοποίηση χρήστη', filtered.filter((u) => u.status !== 'active'), (u) => updateStatus(u.id, 'active'), backToStatus),
    rowCommand('suspend_user', 'Suspend user', 'Αναστολή χρήστη', filtered.filter((u) => u.status !== 'suspended'), (u) => updateStatus(u.id, 'suspended'), backToStatus),
    rowCommand('ban_user', 'Ban user', 'Αποκλεισμός χρήστη', filtered.filter((u) => u.status !== 'banned'), (u) => updateStatus(u.id, 'banned'), backToStatus),
    rowCommand('make_admin', 'Make user an admin', 'Ορισμός χρήστη ως διαχειριστή', filtered.filter((u) => u.role !== 'admin'), (u) => updateRole(u.id, 'admin')),
  ]);
  return (
    <AppShell
      title="User Management"
      titleEl="Διαχείριση χρηστών"
      description="Search, filter, verify, and moderate platform accounts. Bulk actions apply to selected rows."
      descriptionEl="Αναζητήστε, φιλτράρετε, επαληθεύστε και εποπτεύστε λογαριασμούς. Οι μαζικές ενέργειες εφαρμόζονται στις επιλεγμένες γραμμές."
      showHelp
      rail={rail}
    >
      <HelpCallout id="admin-user-management" title="How this page works" titleEl="Πώς λειτουργεί η σελίδα">
        <p>
          Use the <strong>filters in the page tools</strong> on the right to narrow by role or status. Select rows with
          checkboxes for <strong>bulk activate, suspend, or delete</strong>. Open a user with the eye
          icon or row menu; each user&apos;s name opens their full admin detail page.
        </p>
        <p lang="el" className="mt-2 text-muted-foreground">
          Χρησιμοποιήστε τα <strong>φίλτρα στα εργαλεία της σελίδας</strong> δεξιά για ρόλο ή κατάσταση. Επιλέξτε γραμμές
          για <strong>μαζική ενεργοποίηση, αναστολή ή διαγραφή</strong>. Ανοίξτε έναν χρήστη από το εικονίδιο ή το μενού
          της γραμμής· το όνομα κάθε χρήστη ανοίγει την πλήρη σελίδα διαχείρισής του.
        </p>
      </HelpCallout>

      <div className="space-y-4">
          {!isLive && (
            <SampleDataNotice
              surface="User management"
              detail="These accounts are illustrative until the directory responds; moderation actions are disabled on them."
              askAiPrompt="Why does admin user management show sample accounts?"
            />
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 icon-sm -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={bilingualInline("Search by name, email, or location…", "Αναζήτηση με όνομα, email ή τοποθεσία…")}
              className="pl-9"
              aria-label="Search users"
            />
          </div>

          <Card>
            <div className="flex items-center gap-3 border-b px-4 py-3 text-sm text-muted-foreground">
              <Checkbox
                checked={paginated.length > 0 && selectedIds.length === paginated.length}
                onCheckedChange={(v) => toggleAll(Boolean(v))}
                aria-label="Select all on page. Επιλογή όλων στη σελίδα"
              />
              <BilingualText
                en={`${selectedIds.length} selected · ${filtered.length} matching`}
                el={`${selectedIds.length} επιλεγμένοι · ${filtered.length} αποτελέσματα`}
                compact
              />
            </div>

            {paginated.map((user) => {
              const initials =
                user.name
                  .split(' ')
                  .map((n: string) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase() || '??';

              return (
                <div
                  key={user.id}
                  className="flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-muted/40"
                >
                  <Checkbox
                    checked={selectedIds.includes(user.id)}
                    onCheckedChange={(v) => toggleOne(user.id, Boolean(v))}
                    aria-label={`Select ${user.name}`}
                  />
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  {/* A basis, not just flex-1: without one the name shrank to a
                      letter a line on a phone while the badges held the row.
                      Now the badges and actions wrap under it instead. */}
                  <div className="min-w-0 flex-1 basis-40">
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/user-detail/${user.id}`} className="font-medium hover:text-primary-accessible">
                        {user.name}
                      </Link>
                      {user.verified && <CheckCircle2 className="icon-sm text-primary-accessible" aria-label="Verified. Επαληθευμένος" />}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge variant="outline" className="gap-1 capitalize">
                    {ROLE_ICONS[user.role]}
                    <BilingualText en={roleLabel(user.role)} el={ROLE_OPTIONS.find((r) => r.value === user.role)?.el} compact />
                  </Badge>
                  <Badge variant="outline" className={cn('capitalize', STATUS_STYLES[user.status])}>
                    <StatusText value={user.status} />
                  </Badge>
                  <span className="hidden text-sm text-muted-foreground md:inline">
                    {user.lastActive
                      ? <RelativeTime date={user.lastActive} format={formatRelativeTime} />
                      : '—'}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 gap-1 sm:w-auto sm:px-2" onClick={() => setDetailUser(user)} aria-label={`Quick view ${user.name}`}>
                      <Eye className="icon-sm" />
                      <span className="hidden sm:inline text-xs"><BilingualText en="Quick view" el="Γρήγορη προβολή" compact /></span>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${user.name}`}>
                          <MoreHorizontal className="icon-sm" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/user-detail/${user.id}`}><BilingualText en="Open full profile" el="Άνοιγμα πλήρους προφίλ" compact /></Link>
                        </DropdownMenuItem>
                        {/*
                          * Verification has no field on the model and no
                          * endpoint. The item stays, disabled with its reason,
                          * rather than flipping a boolean nobody stores.
                          */}
                        <DropdownMenuItem disabled title="Verification is not recorded yet">
                          {user.verified ? 'Remove verification' : 'Mark verified'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void updateStatus(user.id, 'active')}>
                          <CheckCircle2 className="mr-2 icon-sm" /> <BilingualText en="Set active" el="Ενεργοποίηση" compact />
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void updateStatus(user.id, 'suspended')}>
                          <Ban className="mr-2 icon-sm" /> <BilingualText en="Suspend" el="Αναστολή" compact />
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void updateRole(user.id, 'admin')}>
                          <Shield className="mr-2 icon-sm" /> <BilingualText en="Make admin" el="Ορισμός ως διαχειριστή" compact />
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive-accessible"
                          onClick={() => void updateStatus(user.id, 'banned')}
                        >
                          <UserX className="mr-2 icon-sm" /> <BilingualText en="Ban user" el="Αποκλεισμός χρήστη" compact />
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}

            {paginated.length === 0 && (
              <CardContent className="py-12 text-center">
                <Users className="mx-auto icon-xl text-muted-foreground/40" />
                <p className="mt-3 font-medium"><BilingualText en="No users match your filters" el="Κανένας χρήστης δεν ταιριάζει με τα φίλτρα" compact /></p>
                <p className="text-sm text-muted-foreground"><BilingualText en="Clear search or change role/status filters." el="Καθαρίστε την αναζήτηση ή αλλάξτε τα φίλτρα ρόλου/κατάστασης." wrap /></p>
              </CardContent>
            )}
          </Card>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              <BilingualText en={`Page ${page} of ${totalPages}`} el={`Σελίδα ${page} από ${totalPages}`} compact />
            </span>
            <div className="flex gap-2">
              <Button aria-label="Previous page. Προηγούμενη σελίδα" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="icon-sm" />
              </Button>
              <Button aria-label="Next page. Επόμενη σελίδα" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="icon-sm" />
              </Button>
            </div>
          </div>
        </div>

      <Dialog open={!!detailUser} onOpenChange={(open) => !open && setDetailUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{detailUser?.name}</DialogTitle>
            <DialogDescription className="sr-only"><BilingualText en="Account details and admin actions for this member." el="Στοιχεία λογαριασμού και ενέργειες διαχείρισης για αυτό το μέλος." /></DialogDescription>
          </DialogHeader>
          {detailUser && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">{detailUser.email}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="capitalize"><StatusText value={detailUser.role} /></Badge>
                <Badge variant="outline" className={cn('capitalize', STATUS_STYLES[detailUser.status])}>
                  <StatusText value={detailUser.status} />
                </Badge>
                {detailUser.verified && <Badge><BilingualText en="Verified" el="Επαληθευμένος" compact /></Badge>}
              </div>
              <dl className="grid grid-cols-2 gap-2">
                <dt className="text-muted-foreground"><BilingualText en="Created" el="Δημιουργήθηκε" compact /></dt>
                <dd>{detailUser.createdAt}</dd>
                <dt className="text-muted-foreground"><BilingualText en="Last active" el="Τελευταία δραστηριότητα" compact /></dt>
                <dd>{detailUser.lastActive}</dd>
                <dt className="text-muted-foreground"><BilingualText en="Location" el="Τοποθεσία" compact /></dt>
                <dd>{detailUser.location ?? '—'}</dd>
                <dt className="text-muted-foreground"><BilingualText en="Tenant" el="Οργανισμός" compact /></dt>
                <dd>{detailUser.tenant ?? 'Public'}</dd>
              </dl>
              <div className="flex gap-2 pt-2">
                <Button asChild size="sm">
                  <Link href={`/admin/user-detail/${detailUser.id}`}><BilingualText en="Full admin view" el="Πλήρης προβολή διαχείρισης" compact /></Link>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setDetailUser(null)}>
                  <BilingualText en="Close" el="Κλείσιμο" compact />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
