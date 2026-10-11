'use client';

import { useMemo, useState } from 'react';
import {
  Users,
  Search,
  Plus,
  MoreVertical,
  Mail,
  Shield,
  UserX,
  CheckCircle2,
  Clock,
  TrendingUp,
  Activity,
  Send,
  Copy,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useTenant } from '@/components/providers/TenantContext';
import { getTenantMembers, updateTenantMember, removeTenantMember, type TenantMemberItem } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyTenantMembers } from '@/components/common/EmptyStates';
import { CardHead } from '@/components/common/CardAnatomy';
import { FactLine } from '@/components/common/FactLine';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, initialsOf } from '@/lib/utils';
import { qk } from '@/lib/query-keys';
import { CANCELLED, choiceControl, ROW_GONE, rowOptions, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualInline } from '@/lib/i18n/format';
import { StatusText } from '@/components/common/StatusText';
import { statusEl } from '@/components/common/StatusText';
import { formatDate } from '@/lib/i18n/format';

/**
 * The page's own row from the tenant membership row.
 *
 * `/api/tenants/:id/members` and its client have existed all along, and
 * `TenantContext` already resolves which tenant this is — the page just never
 * asked either of them.
 *
 * Four fields have no source and stay absent rather than being filled:
 * presence, an engagement score, milestones completed and sessions attended
 * are all activity the membership row does not record. The header tiles read
 * dashes for them, which is what this page used to do with `Math.round(total
 * * 0.08)` before that was removed.
 */
function toPageMember(row: TenantMemberItem): Member {
  return {
    id: row.id,
    userId: row.userId,
    name: row.user.profile?.displayName ?? row.user.email,
    email: row.user.email,
    avatarUrl: row.user.profile?.avatarUrl ?? undefined,
    role: row.role,
    status: row.isActive ? 'active' : 'suspended',
    // The API sends an ISO timestamp, which the card printed as it came.
    joinedAt: formatDate(row.joinedAt, 'en', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    lastActive: '',
  };
}

type Member = {
  /** The member's user id on live rows - the membership routes key on it. */
  userId?: string;
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: string;
  status: 'active' | 'pending' | 'suspended';
  joinedAt: string;
  lastActive: string;
  engagementScore?: number; // 0-100
  isOnline?: boolean;
  milestonesCompleted?: number;
  sessionsAttended?: number;
};

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-status-success-bg text-status-success border-status-success-border',
  pending:   'bg-status-warning-bg text-status-warning border-status-warning-border',
  suspended: 'bg-status-danger-bg text-status-danger border-status-danger-border',
};

function EngagementBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-status-success-mark' : score >= 40 ? 'bg-status-warning-mark' : 'bg-status-danger-mark';
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-2xs text-muted-foreground">
        <span><BilingualText en="Engagement" el="Συμμετοχή" compact /></span>
        <span className="tabular-nums">{score}%</span>
      </div>
      <div className="h-1 rounded-full bg-secondary overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

const TENANT_ROLES = ['member', 'mentor', 'admin'] as const;

type MemberActions = {
  /** Absent on sample rows. */
  onRole?: (m: Member, role: string) => Promise<PageControlRunResult>;
  onRemove?: (m: Member) => Promise<PageControlRunResult>;
};

function MemberCard({ member, onRole, onRemove }: { member: Member } & MemberActions) {
  // The Connections card: the avatar, the name over the address, the state
  // and the menu at the right; the role, the dates and the engagement start
  // on the avatar's edge.
  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="More options" variant="ghost" size="icon" className="shrink-0">
          <MoreVertical className="icon-sm" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* All three had no handler. PATCH and DELETE
            /tenants/:id/members/:userId exist. */}
        {member.userId ? (
          <DropdownMenuItem asChild>
            <Link href={`/messages?to=${member.userId}`}><Mail className="mr-2 icon-sm" aria-hidden="true" /><BilingualText en="Send Message" el="Αποστολή μηνύματος" compact /></Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled><Mail className="mr-2 icon-sm" aria-hidden="true" /><BilingualText en="Send Message" el="Αποστολή μηνύματος" compact /></DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <p className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground">
          <Shield className="icon-sm" aria-hidden="true" /><BilingualText en="Change Role" el="Αλλαγή ρόλου" compact />
        </p>
        {TENANT_ROLES.map((r) => (
          <DropdownMenuItem
            key={r}
            className="pl-8 capitalize"
            disabled={!onRole || member.role === r}
            onSelect={() => onRole?.(member, r)}
          >
            <StatusText value={r} />
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive-accessible" disabled={!onRemove} onSelect={() => onRemove?.(member)}>
          <UserX className="mr-2 icon-sm" aria-hidden="true" /><BilingualText en="Remove Member" el="Αφαίρεση μέλους" compact />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <Card className="transition-all hover:border-primary/30">
      <CardContent className="space-y-3">
        <CardHead
          mark={(
            <div className="relative">
              <Avatar className="h-10 w-10">
                <AvatarImage src={member.avatarUrl} alt="" />
                <AvatarFallback className="bg-primary/10 font-semibold text-primary-accessible">{initialsOf(member.name)}</AvatarFallback>
              </Avatar>
              {member.isOnline && (
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-status-success-mark" aria-hidden="true" />
              )}
            </div>
          )}
          title={member.name}
          subtitle={<span className="block truncate">{member.email}</span>}
          asideStays
          aside={(
            <>
              <Badge variant="outline" className={cn('text-xs', STATUS_COLORS[member.status])}>
                <StatusText value={member.status} />
              </Badge>
              {menu}
            </>
          )}
        />
        <FactLine
          items={[
            <StatusText key="role" value={member.role} />,
            <BilingualText key="joined" en={`Joined ${member.joinedAt}`} el={`Μέλος από ${member.joinedAt}`} compact />,
            member.lastActive ? <BilingualText key="active" en={`Active ${member.lastActive}`} el={`Ενεργό ${member.lastActive}`} compact /> : null,
            member.milestonesCompleted != null ? (
              <span key="milestones" className="text-status-success">
                <BilingualText en={`${member.milestonesCompleted} milestones`} el={`${member.milestonesCompleted} ορόσημα`} compact />
              </span>
            ) : null,
          ]}
        />
        {member.engagementScore != null && <EngagementBar score={member.engagementScore} />}
      </CardContent>
    </Card>
  );
}

function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [emails, setEmails] = useState('');
  const [role, setRole] = useState('founder');
  const [copied, setCopied] = useState(false);
  const inviteLink = 'https://app.cofounderbay.com/invite/tenant-abc-xyz';
  const handleCopy = () => { navigator.clipboard.writeText(inviteLink); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="icon-md text-muted-foreground" /> <BilingualText en="Invite Members" el="Πρόσκληση μελών" compact />
          </DialogTitle>
          <DialogDescription className="sr-only"><BilingualText en="Invite people to the workspace and assign each a role." el="Προσκαλέστε άτομα στον χώρο εργασίας και ορίστε ρόλο σε καθέναν." /></DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <label htmlFor="tm-f1" className="text-sm font-medium"><BilingualText en="Email addresses" el="Διευθύνσεις email" compact /></label>
            <Textarea id="tm-f1"
              placeholder="john@startup.com, jane@venture.com (one per line or comma-separated)"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="tm-role"><BilingualText en="Assign role" el="Ανάθεση ρόλου" compact /></label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="tm-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="founder"><BilingualText en="Founder" el="Ιδρυτής" compact /></SelectItem>
                <SelectItem value="mentor"><BilingualText en="Mentor" el="Μέντορας" compact /></SelectItem>
                <SelectItem value="investor"><BilingualText en="Investor" el="Επενδυτής" compact /></SelectItem>
                <SelectItem value="admin"><BilingualText en="Admin" el="Διαχειριστής" compact /></SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground"><BilingualText en="Or share invite link" el="Ή μοιραστείτε σύνδεσμο πρόσκλησης" compact /></p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-2xs truncate text-muted-foreground bg-background rounded px-2 py-1 border">{inviteLink}</code>
              <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={handleCopy}>
                {copied ? <CheckCircle2 className="icon-sm text-status-success" /> : <Copy className="icon-sm" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}><BilingualText en="Cancel" el="Ακύρωση" compact /></Button>
          <Button className="gap-1.5" disabled={!emails.trim()}>
            <Send className="icon-sm" /> <BilingualText en="Send Invites" el="Αποστολή προσκλήσεων" compact />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


export default function TenantMembersPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showInvite, setShowInvite] = useState(false);

  /*
   * The tenant's real members. The seed below is what a tenant with none
   * loaded sees, so the screen still teaches its shape.
   */
  const { activeTenant } = useTenant();
  const tenantId = activeTenant?.id ?? null;
  const { data, isLoading } = useQuery({
    queryKey: qk('tenant', 'members', tenantId),
    queryFn: () => getTenantMembers(tenantId!, { limit: 100 }),
    enabled: Boolean(tenantId),
    staleTime: 60_000,
    retry: 0,
  });

  const live = useMemo(
    () => (Array.isArray(data) ? data : []).map(toPageMember),
    [data],
  );
  // A workspace with nobody on its roster sees the empty state, not seven
  // invented people (John Doe, Jane Smith) it used to.
  const members: Member[] = live;
  const queryClient = useQueryClient();
  const { success: toastOk, error: toastFail } = useToast();
  const confirm = useConfirm();
  const refreshMembers = () => void queryClient.invalidateQueries({ queryKey: qk('tenant', 'members', tenantId) });
  const memberActions: MemberActions = live.length > 0 && tenantId ? {
    onRole: async (m, role) => {
      if (!m.userId) return { error: 'This member has no account to update.' };
      try {
        await updateTenantMember(tenantId, m.userId, { role });
        toastOk('Role changed', bilingualInline(`${m.name} is now ${role}.`, `${m.name}: ${statusEl(role) ?? role}.`));
      } catch (e) {
        toastFail('Could not change the role', e instanceof Error ? e.message : undefined);
        return { error: e instanceof Error && e.message ? e.message : 'The role did not change.' };
      } finally { refreshMembers(); }
    },
    onRemove: async (m) => {
      if (!m.userId) return { error: 'This member has no account to remove.' };
      const ok = await confirm({
        title: <BilingualText en={`Remove ${m.name}?`} el={`Αφαίρεση: ${m.name};`} />,
        description: <BilingualText en="They lose access to this workspace. Their account itself is not deleted." el="Χάνει την πρόσβαση σε αυτόν τον χώρο εργασίας. Ο λογαριασμός του/της δεν διαγράφεται." />,
        confirmLabel: <BilingualText en="Remove member" el="Αφαίρεση μέλους" compact />,
      });
      if (!ok) return CANCELLED;
      try {
        await removeTenantMember(tenantId, m.userId);
        toastOk('Member removed', m.name);
      } catch (e) {
        toastFail('Could not remove the member', e instanceof Error ? e.message : undefined);
        return { error: e instanceof Error && e.message ? e.message : 'The member was not removed.' };
      } finally { refreshMembers(); }
    },
  } : {};


  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || m.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const roles = [...new Set(members.map((m) => m.role))];
  /*
   * Both stay null when nothing records them, which is the case for a real
   * tenant today: the membership row carries no presence and no engagement.
   * Zero and "not recorded" are different statements, and the tiles say which.
   * Averaged over the rows that carry a score, never over all of them.
   */
  const withPresence = members.filter((m) => m.isOnline !== undefined);
  const onlineCount = withPresence.length > 0
    ? withPresence.filter((m) => m.isOnline).length
    : null;

  const scored = members.filter((m) => m.engagementScore != null);
  const avgEngagement = scored.length > 0
    ? Math.round(scored.reduce((sum, m) => sum + (m.engagementScore ?? 0), 0) / scored.length)
    : null;

  const activeTab = roleFilter === 'all' ? 'all' : roleFilter;

  // Offered to the assistant: role and status filters, Invite, and the card
  // menu's role change and removal - the same actions, which refuse the
  // sample rows exactly as the disabled menu items do.
  const liveOnlyEn = memberActions.onRole ? undefined : 'These members are samples until the workspace roster loads.';
  const liveOnlyEl = memberActions.onRole ? undefined : 'Τα μέλη είναι δείγματα μέχρι να φορτώσει το μητρώο του χώρου.';
  const memberById = (id?: string) => members.find((m) => m.id === id);
  usePageList([
    {
      id: 'members',
      labelEn: 'Members',
      labelEl: 'Μέλη',
      rows: isLoading ? undefined : filteredMembers.map((m) => `${m.name} · ${m.email} · ${m.role} · ${m.status}`),
      total: members.length,
      sample: live.length === 0,
    },
  ]);
  usePageControls([
    choiceControl('role_filter', 'Role filter', 'Φίλτρο ρόλου', [{ value: 'all', en: 'All roles', el: 'Όλοι οι ρόλοι' }, ...roles.map((r) => ({ value: r, en: r, el: r }))], roleFilter, setRoleFilter),
    choiceControl('status_filter', 'Status filter', 'Φίλτρο κατάστασης', [
      { value: 'all', en: 'All statuses', el: 'Όλες οι καταστάσεις' },
      { value: 'active', en: 'Active', el: 'Ενεργά' },
      { value: 'pending', en: 'Pending', el: 'Σε αναμονή' },
      { value: 'suspended', en: 'Suspended', el: 'Σε αναστολή' },
    ], statusFilter, setStatusFilter),
    { id: 'invite_members', labelEn: 'Open the invite form', labelEl: 'Άνοιγμα φόρμας πρόσκλησης', writes: false, run: () => setShowInvite(true) },
    ...TENANT_ROLES.map((role) => ({
      id: `make_${role}`,
      labelEn: `Change member role to ${role}`,
      labelEl: `Αλλαγή ρόλου μέλους σε ${role}`,
      writes: true,
      options: rowOptions(filteredMembers.filter((m) => m.role !== role), (m) => m.id, (m) => m.name),
      unavailableEn: liveOnlyEn,
      unavailableEl: liveOnlyEl,
      // tenant.service updateMember writes the fields it is sent - here only
      // `role` - so the command for the previous role restores it.
      undo: (v?: string) => {
        const prior = memberById(v)?.role;
        return prior && prior !== role && (TENANT_ROLES as readonly string[]).includes(prior) ? { control: `make_${prior}`, value: v } : undefined;
      },
      run: (v?: string) => { const m = memberById(v); return !m ? ROW_GONE : memberActions.onRole ? memberActions.onRole(m, role) : { error: liveOnlyEn ?? 'These members are samples.' }; },
    })),
    {
      id: 'remove_member',
      labelEn: 'Remove member',
      labelEl: 'Αφαίρεση μέλους',
      writes: true,
      options: rowOptions(filteredMembers, (m) => m.id, (m) => m.name),
      unavailableEn: liveOnlyEn,
      unavailableEl: liveOnlyEl,
      run: (v) => { const m = memberById(v); return !m ? ROW_GONE : memberActions.onRemove ? memberActions.onRemove(m) : { error: liveOnlyEn ?? 'These members are samples.' }; },
    },
  ]);

  return (
    <AppShell
      title="Members"
      titleEl="Μέλη"
      description="Manage and track your organization's member engagement"
      descriptionEl="Διαχειριστείτε και παρακολουθήστε τη συμμετοχή των μελών του οργανισμού σας"
      actions={
        <Button onClick={() => setShowInvite(true)} className="gap-1.5">
          <Plus className="icon-sm" /> <BilingualText en="Invite Member" el="Πρόσκληση μέλους" compact />
        </Button>
      }
    >
      <div className="space-y-6">

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Members', labelEl: 'Σύνολο μελών', value: members.length, icon: Users, color: 'text-primary-accessible' },
            { label: 'Online Now', labelEl: 'Συνδεδεμένοι τώρα', value: onlineCount ?? '—', icon: Activity, color: 'text-status-success' },
            { label: 'Avg Engagement', labelEl: 'Μέση συμμετοχή', value: avgEngagement == null ? '—' : `${avgEngagement}%`, icon: TrendingUp, color: 'text-status-info' },
            { label: 'Pending Approval', labelEl: 'Σε αναμονή έγκρισης', value: members.filter((m) => m.status === 'pending').length, icon: Clock, color: 'text-status-warning' },
          ].map(({ label, labelEl, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="flex items-center gap-3">
                <div className="rounded-lg p-2 bg-secondary">
                  <Icon className={cn('icon-sm', color)} />
                </div>
                <div>
                  <p className="page-stat font-bold tabular-nums">{value}</p>
                  <p className="text-xs text-muted-foreground"><BilingualText en={label} el={labelEl} compact wrap /></p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
            <Input aria-label={bilingualInline("Search members by name or email", "Αναζήτηση μελών με όνομα ή email")} placeholder={bilingualInline("Search by name or email…", "Αναζήτηση με όνομα ή email…")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label="Status. Κατάσταση" className="w-full sm:w-[150px]">
              <SelectValue placeholder={bilingualInline("Status", "Κατάσταση")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all"><BilingualText en="All Status" el="Όλες οι καταστάσεις" compact /></SelectItem>
              <SelectItem value="active"><BilingualText en="Active" el="Ενεργό" compact /></SelectItem>
              <SelectItem value="pending"><BilingualText en="Pending" el="Σε αναμονή" compact /></SelectItem>
              <SelectItem value="suspended"><BilingualText en="Suspended" el="Σε αναστολή" compact /></SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Role Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setRoleFilter(v)}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="all"><BilingualText en={`All (${members.length})`} el={`Όλα (${members.length})`} compact /></TabsTrigger>
            {roles.map((role) => (
              <TabsTrigger key={role} value={role}>
                <BilingualText
                  en={`${role.charAt(0).toUpperCase()}${role.slice(1)} (${members.filter((m) => m.role === role).length})`}
                  el={`${statusEl(role) ?? role} (${members.filter((m) => m.role === role).length})`}
                  compact
                />
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                <BilingualText
                  en={`${filteredMembers.length} member${filteredMembers.length !== 1 ? 's' : ''} found`}
                  el={`${filteredMembers.length} ${filteredMembers.length !== 1 ? 'μέλη' : 'μέλος'}`}
                  compact
                />
              </p>
              {filteredMembers.map((member) => (
                <MemberCard key={member.id} member={member} {...memberActions} />
              ))}
              {filteredMembers.length === 0 && (
                <EmptyTenantMembers
                  filtersActive={!!search || roleFilter !== 'all' || statusFilter !== 'all'}
                  onClearFilters={() => { setSearch(''); setRoleFilter('all'); setStatusFilter('all'); }}
                />
              )}
            </div>
          </TabsContent>
        </Tabs>

      </div>

      <InviteModal open={showInvite} onClose={() => setShowInvite(false)} />
    </AppShell>
  );
}
