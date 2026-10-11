import io
p = 'src/app/org/[slug]/admin/page.tsx'
s = io.open(p, encoding='utf-8').read()

# --- imports ---
old = """import { AppShell } from '@/components/layout/AppShell';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';"""
new = """import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { BilingualText } from '@/components/common/BilingualText';
import { SampleDataNotice } from '@/components/common/SampleDataNotice';
import { useToast } from '@/components/ui/toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  addOrganizationMember,
  getOrganizationBySlug,
  listOrganizationMembers,
  removeOrganizationMember,
  updateOrganizationMember,
  type OrgAdminMember,
} from '@/lib/api';
import { cn } from '@/lib/utils';"""
assert s.count(old) == 1; s = s.replace(old, new)

# --- widen the view member role (the model has six roles) + add userId ---
old = """type OrgMember = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'pending' | 'suspended';
  joinedAt: Date;
  lastActive?: Date;
};"""
new = """type OrgMember = {
  id: string;
  /** The membership's user - needed by the invite/remove endpoints. */
  userId?: string;
  name: string;
  email: string;
  avatar?: string;
  /** owner, admin, program_manager, mentor, reviewer or member. */
  role: string;
  /** The model stores `isActive`; 'pending' exists for invitations only. */
  status: 'active' | 'pending' | 'suspended';
  joinedAt: Date;
  lastActive?: Date;
};

function toViewMember(m: OrgAdminMember): OrgMember {
  const profile = m.user?.profile;
  const name =
    profile?.displayName ||
    [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') ||
    m.user?.email ||
    'Member';
  return {
    id: m.id,
    userId: m.userId,
    name,
    email: m.user?.email ?? '',
    avatar: profile?.avatarUrl ?? undefined,
    role: m.role,
    status: m.isActive ? 'active' : 'suspended',
    joinedAt: new Date(m.joinedAt),
  };
}"""
assert s.count(old) == 1; s = s.replace(old, new)

# --- the component ---
start = s.index('export default function OrgAdminPage()')
component = '''export default function OrgAdminPage() {
  const params = useParams();
  const router = useRouter();
  const { success, error: showError } = useToast();
  const qc = useQueryClient();
  const slug = params?.slug as string;

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteUserId, setInviteUserId] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);

  const orgQuery = useQuery({
    queryKey: ['org-admin', slug],
    queryFn: () => getOrganizationBySlug(slug),
    retry: 0,
    staleTime: 60_000,
  });
  const orgId = orgQuery.data?.id;
  const membersQuery = useQuery({
    queryKey: ['org-admin-members', orgId],
    enabled: !!orgId,
    queryFn: () => listOrganizationMembers(orgId as string),
    retry: 0,
    staleTime: 30_000,
  });

  /** True once the real organisation and member list have answered; the
   *  mock rows below are illustrative and the write paths refuse them. */
  const isLive = !!orgQuery.data && !!membersQuery.data;
  const org = orgQuery.data
    ? { name: orgQuery.data.name, logo: orgQuery.data.logo ?? orgQuery.data.logoUrl ?? undefined }
    : MOCK_ORG;
  const members = isLive ? (membersQuery.data ?? []).map(toViewMember) : MOCK_MEMBERS;
  const stats = {
    totalMembers: members.length,
    activeMembers: members.filter((m) => m.status === 'active').length,
    suspended: members.filter((m) => m.status === 'suspended').length,
    totalProjects: orgQuery.data?._count?.programs ?? 0,
  };

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['org-admin-members', orgId] });
    void qc.invalidateQueries({ queryKey: ['org-admin', slug] });
  };

  const filteredMembers = members.filter((m) => {
    if (searchQuery && !m.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !m.email.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (roleFilter !== 'all' && m.role !== roleFilter) return false;
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    return true;
  });

  const notLive = () => {
    showError('Nothing to update', 'These rows are illustrative until the organisation loads.');
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    if (!isLive || !orgId) return notLive();
    try {
      await updateOrganizationMember(orgId, memberId, { role: newRole });
      success('Role updated', `Member role changed to ${newRole}`);
    } catch (err) {
      showError('Could not update the role', err instanceof Error ? err.message : undefined);
    } finally {
      refresh();
    }
  };

  const handleSetActive = async (memberId: string, active: boolean) => {
    if (!isLive || !orgId) return notLive();
    try {
      await updateOrganizationMember(orgId, memberId, { isActive: active });
      success(active ? 'Member reactivated' : 'Member suspended', active ? 'The member is active again' : 'The member has been suspended');
    } catch (err) {
      showError('Could not update the member', err instanceof Error ? err.message : undefined);
    } finally {
      refresh();
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!isLive || !orgId) return notLive();
    try {
      await removeOrganizationMember(orgId, memberId);
      success('Member removed', 'The member has been removed from the organization');
    } catch (err) {
      showError('Could not remove the member', err instanceof Error ? err.message : undefined);
    } finally {
      refresh();
    }
  };

  const handleInvite = async () => {
    const userId = inviteUserId.trim();
    if (!userId) return;
    if (!isLive || !orgId) return notLive();
    setInviting(true);
    try {
      await addOrganizationMember(orgId, { userId, role: inviteRole });
      success('Member added', 'The member now belongs to the organization');
      setInviteOpen(false);
      setInviteUserId('');
      setInviteRole('member');
    } catch (err) {
      showError('Could not add the member', err instanceof Error ? err.message : undefined);
    } finally {
      setInviting(false);
      refresh();
    }
  };

  /** The filtered member list, as a CSV - the header button had no handler. */
  const exportCsv = () => {
    if (!filteredMembers.length) return;
    const header = 'Name,Email,Role,Status,Joined\\n';
    const body = filteredMembers
      .map((m) => [m.name, m.email, m.role, m.status, m.joinedAt.toISOString().slice(0, 10)].join(','))
      .join('\\n');
    const blob = new Blob([header + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}-members-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeFilters =
    (roleFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0) + (searchQuery.trim() ? 1 : 0);

  /*
   * The page rail: totals, member filters, and the tools row that used to
   * sit inside the members tab. The column keeps the tabs and the table.
   */
  const rail: PageRailSection[] = [
    {
      id: 'totals',
      glyph: 'chart',
      labelEn: 'Organisation totals',
      labelEl: 'Σύνολα οργανισμού',
      badge: stats.suspended || null,
      content: (
        <div className="space-y-2">
          <StatCard title="Total Members" value={stats.totalMembers} icon={Users} />
          <StatCard title="Active Members" value={stats.activeMembers} icon={CheckCircle2} />
          <StatCard title="Suspended" value={stats.suspended} icon={XCircle} />
          <StatCard title="Programs" value={stats.totalProjects} icon={Building2} />
        </div>
      ),
    },
    {
      id: 'filters',
      glyph: 'target',
      labelEn: 'Member filters',
      labelEl: 'Φίλτρα μελών',
      badge: activeFilters || null,
      content: (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role</p>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="program_manager">Program manager</SelectItem>
                <SelectItem value="mentor">Mentor</SelectItem>
                <SelectItem value="reviewer">Reviewer</SelectItem>
                <SelectItem value="member">Member</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ),
    },
    {
      id: 'tools',
      glyph: 'sliders',
      labelEn: 'Member tools',
      labelEl: 'Εργαλεία μελών',
      content: (
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted/70"
          >
            <UserPlus className="icon-sm shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1"><BilingualText en="Invite member" el="Πρόσκληση μέλους" compact wrap /></span>
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!filteredMembers.length}
            className="tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted/70 disabled:opacity-50"
          >
            <Download className="icon-sm shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1"><BilingualText en="Export members (CSV)" el="Εξαγωγή μελών (CSV)" compact wrap /></span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <AppShell rail={rail}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button aria-label="Go back" variant="ghost" size="icon" onClick={() => router.push(`/org/${slug}`)}>
            <ArrowLeft className="icon-md" aria-hidden="true" />
          </Button>
          <div className="flex items-center gap-4 flex-1">
            <Avatar className="h-12 w-12">
              <AvatarImage src={org.logo} />
              <AvatarFallback className="bg-primary/10 text-primary-accessible text-lg">
                {org.name[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{org.name}</h1>
              <p className="text-muted-foreground">Organization Admin Dashboard</p>
            </div>
          </div>
          <Button variant="outline" asChild>
            <Link href={`/org/${slug}/settings`}>
              <Settings className="icon-sm mr-2" aria-hidden="true" />
              Settings
            </Link>
          </Button>
        </div>

        {!isLive && (
          <SampleDataNotice
            surface="Organization admin"
            detail="This organisation and its members are illustrative until the directory responds; member actions are disabled on them."
            askAiPrompt="Why does the organisation admin page show sample members?"
          />
        )}

        {/* Tabs */}
        <Tabs defaultValue="members" className="space-y-4">
          <TabsList>
            <TabsTrigger value="members" className="gap-2">
              <Users className="icon-sm" aria-hidden="true" />
              Members
            </TabsTrigger>
            <TabsTrigger value="invites" className="gap-2">
              <Mail className="icon-sm" aria-hidden="true" />
              Invites
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="icon-sm" aria-hidden="true" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="permissions" className="gap-2">
              <Shield className="icon-sm" aria-hidden="true" />
              Permissions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-4">
            {/* Search stays with the table; the role/status filters and the
                invite/export tools moved to the page rail. */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                aria-label="Search members"
              />
            </div>

            {/* Members Table */}
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={member.avatar} />
                            <AvatarFallback className="bg-primary/10 text-primary-accessible text-sm">
                              {member.name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">{member.name}</p>
                            <p className="text-sm text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('capitalize border', roleChip(member.role))}>
                          {member.role === 'owner' && <Crown className="icon-sm mr-1" />}
                          {member.role.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('capitalize border', memberStatusChip(member.status))}>
                          {member.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.joinedAt.toLocaleDateString('en-GB', { timeZone: 'UTC' })}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-label="More options" variant="ghost" size="icon">
                              <MoreVertical className="icon-sm" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => void handleRoleChange(member.id, 'admin')}>
                              <Shield className="icon-sm mr-2" aria-hidden="true" />
                              Make Admin
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void handleRoleChange(member.id, 'member')}>
                              <Users className="icon-sm mr-2" aria-hidden="true" />
                              Make Member
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {member.status === 'active' ? (
                              <DropdownMenuItem onClick={() => void handleSetActive(member.id, false)}>
                                <XCircle className="icon-sm mr-2" aria-hidden="true" />
                                Suspend
                              </DropdownMenuItem>
                            ) : member.status === 'suspended' ? (
                              <DropdownMenuItem onClick={() => void handleSetActive(member.id, true)}>
                                <CheckCircle2 className="icon-sm mr-2" aria-hidden="true" />
                                Reactivate
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem
                              onClick={() => void handleRemoveMember(member.id)}
                              className="text-destructive-accessible"
                            >
                              <UserMinus className="icon-sm mr-2" aria-hidden="true" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredMembers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        No members match the current filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="invites">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pending Invitations</CardTitle>
                <CardDescription>Manage pending member invitations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" aria-hidden="true" />
                  <p>No pending invitations</p>
                  <Button className="mt-4" onClick={() => setInviteOpen(true)}>
                    <UserPlus className="icon-sm mr-2" aria-hidden="true" />
                    Invite Members
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Member Growth</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px] flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <BarChart3 className="h-12 w-12 opacity-50" aria-hidden="true" />
                    <p className="text-sm">No growth data recorded yet.</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Activity Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px] flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <TrendingUp className="h-12 w-12 opacity-50" aria-hidden="true" />
                    <p className="text-sm">No activity data recorded yet.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="permissions">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Role Permissions</CardTitle>
                <CardDescription>What each role can do</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {['owner', 'admin', 'member'].map((role) => (
                  <div key={role} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn('capitalize border', roleChip(role))}>
                        {role === 'owner' && <Crown className="icon-sm mr-1" />}
                        {role}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 text-sm">
                      {[
                        'Invite members',
                        'Remove members',
                        'Manage roles',
                        'Edit organization',
                        'View analytics',
                        'Manage projects',
                      ].map((perm, i) => (
                        <div key={perm} className="flex items-center gap-2">
                          {(role === 'owner' || (role === 'admin' && i < 5) || (role === 'member' && i > 3)) ? (
                            <CheckCircle2 className={cn('icon-sm', STATUS.success.icon)} />
                          ) : (
                            <XCircle className="icon-sm text-muted-foreground" aria-hidden="true" />
                          )}
                          <span className="text-muted-foreground">{perm}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Invite member: the endpoint adds by user id - there is no
          invite-by-email flow for organisations yet. */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">User ID</p>
              <Input
                value={inviteUserId}
                onChange={(e) => setInviteUserId(e.target.value)}
                placeholder="The member's user ID"
                className="mt-2"
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role</p>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="program_manager">Program manager</SelectItem>
                  <SelectItem value="mentor">Mentor</SelectItem>
                  <SelectItem value="reviewer">Reviewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" disabled={!inviteUserId.trim() || inviting} onClick={() => void handleInvite()}>
              {inviting ? 'Adding…' : 'Add member'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
'''
s = s[:start] + component
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
