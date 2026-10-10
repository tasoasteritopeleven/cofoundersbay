'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Users,
  UserPlus,
  Search,
  MoreVertical,
  Mail,
  Shield,
  ShieldCheck,
  Crown,
  Edit,
  Trash2,
  UserMinus,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useQuery } from '@tanstack/react-query';
import { useCurrentOrg } from '@/hooks/useCurrentOrg';
import { listOrganizationMembers, type OrgAdminMember } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyOrgMembers } from '@/components/common/EmptyStates';
import { CardHead } from '@/components/common/CardAnatomy';
import { FactLine } from '@/components/common/FactLine';
import { cn, initialsOf } from '@/lib/utils';
import { STATUS, type StatusTone } from '@/lib/semantic-colors';
import { UnavailableButton } from '@/components/common/UnavailableButton';
import { qk } from '@/lib/query-keys';
import { choiceControl, usePageControls, usePageList } from '@/lib/page-controls';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualInline } from '@/lib/i18n/format';
import { formatDate } from '@/lib/i18n/format';

type MemberRole = 'owner' | 'admin' | 'manager' | 'member' | 'mentor' | 'viewer';

type OrgMember = {
  id: string;
  /** Who to message: the membership id is not a user id. */
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: MemberRole;
  department?: string;
  joinedAt: string;
  lastActive: string;
  status: 'active' | 'invited' | 'inactive';
};

const ROLE_CONFIG: Record<MemberRole, { label: string; labelEl: string; icon: React.ElementType; tone: StatusTone }> = {
  owner: { label: 'Owner', labelEl: 'Ιδιοκτήτης', icon: Crown, tone: 'warning' },
  admin: { label: 'Admin', labelEl: 'Διαχειριστής', icon: ShieldCheck, tone: 'accent' },
  manager: { label: 'Manager', labelEl: 'Υπεύθυνος', icon: Shield, tone: 'info' },
  member: { label: 'Member', labelEl: 'Μέλος', icon: Users, tone: 'neutral' },
  mentor: { label: 'Mentor', labelEl: 'Μέντορας', icon: Users, tone: 'success' },
  viewer: { label: 'Viewer', labelEl: 'Θεατής', icon: Users, tone: 'neutral' },
};

const ROLE_VALUES = ['owner', 'admin', 'manager', 'member', 'mentor', 'viewer'] as const;

/** "12 Mar 2025" from the ISO timestamp the API sends. */
function joinedOn(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : formatDate(d, 'en', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * The page's own row from the organisation's membership row.
 *
 * This is the team page - "who can run programs, review applications and
 * access workspace settings" - but it listed the cohort directory
 * (`/api/org/:slug/members`): every founder in every cohort, as "Member",
 * with no email and an empty "last active". The organisation's own
 * memberships (`/api/organizations/:id/members`, the rows the admin page
 * edits) carry the role, title, department, join date and email this page
 * has columns for. The founders are listed on /org/startups.
 *
 * An organisation with nobody loaded sees the empty state, not the six
 * invented colleagues (Sarah Chen, "New Recruit") it used to.
 */
function toPageMember(row: OrgAdminMember): OrgMember {
  const role = (ROLE_VALUES as readonly string[]).includes(row.role)
    ? (row.role as MemberRole)
    : 'member';
  const profile = row.user?.profile;
  const name = profile?.displayName
    || [profile?.firstName, profile?.lastName].filter(Boolean).join(' ')
    || row.user?.email
    || 'Member';
  return {
    id: row.id,
    userId: row.userId,
    name,
    email: row.user?.email ?? '',
    avatarUrl: profile?.avatarUrl ?? undefined,
    role,
    department: [row.title, row.department].filter(Boolean).join(' · ') || undefined,
    joinedAt: joinedOn(row.joinedAt),
    lastActive: '',
    status: row.isActive ? 'active' : 'inactive',
  };
}

/** `live` rows carry user ids; `adminHref` is where memberships are managed. */
function MemberRow({ member, live, adminHref }: { member: OrgMember; live: boolean; adminHref: string | null }) {
  const roleCfg = ROLE_CONFIG[member.role];
  const RoleIcon = roleCfg.icon;

  // A row of the Connections card, without its frame: the avatar, the name
  // over the address, the role, title and join date as one caption line;
  // the menu stays at the right.
  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="More options" variant="ghost" size="icon" className="shrink-0">
          <MoreVertical className="icon-sm" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* None had a handler. Roles and removal are managed on the
            organisation's admin page, which writes membership rows; this
            directory lists cohort members by user id. */}
        {adminHref ? (
          <DropdownMenuItem asChild>
            <Link href={adminHref}><Edit className="mr-2 icon-sm" aria-hidden="true" /><BilingualText en="Edit Role" el="Επεξεργασία ρόλου" compact /></Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled><Edit className="mr-2 icon-sm" aria-hidden="true" /><BilingualText en="Edit Role" el="Επεξεργασία ρόλου" compact /></DropdownMenuItem>
        )}
        {live ? (
          <DropdownMenuItem asChild>
            <Link href={`/messages?to=${member.userId}`}><Mail className="mr-2 icon-sm" aria-hidden="true" /><BilingualText en="Send Message" el="Αποστολή μηνύματος" compact /></Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled><Mail className="mr-2 icon-sm" aria-hidden="true" /><BilingualText en="Send Message" el="Αποστολή μηνύματος" compact /></DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {adminHref ? (
          <DropdownMenuItem asChild className="text-destructive-accessible">
            <Link href={adminHref}><UserMinus className="mr-2 icon-sm" aria-hidden="true" /><BilingualText en="Remove Member" el="Αφαίρεση μέλους" compact /></Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled className="text-destructive-accessible">
            <UserMinus className="mr-2 icon-sm" aria-hidden="true" /><BilingualText en="Remove Member" el="Αφαίρεση μέλους" compact />
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <CardHead
      mark={(
        <Avatar className="h-10 w-10">
          <AvatarImage src={member.avatarUrl} alt="" />
          <AvatarFallback className="bg-primary/10 font-semibold text-primary-accessible">{initialsOf(member.name).toUpperCase()}</AvatarFallback>
        </Avatar>
      )}
      title={member.name}
      subtitle={member.email ? <span className="block truncate">{member.email}</span> : undefined}
      meta={(
        <FactLine
          items={[
            <span key="role" className="inline-flex items-center gap-1">
              <RoleIcon className={cn('icon-sm', roleCfg.tone === 'neutral' && member.role === 'viewer' ? 'text-muted-foreground' : STATUS[roleCfg.tone].icon)} aria-hidden="true" />
              <BilingualText en={roleCfg.label} el={roleCfg.labelEl} compact />
            </span>,
            member.department,
            // No endpoint records when a member was last seen; the join date
            // is what the membership row carries.
            member.joinedAt ? <BilingualText key="joined" en={`Joined ${member.joinedAt}`} el={`Μέλος από ${member.joinedAt}`} compact /> : null,
          ]}
        />
      )}
      asideStays
      aside={(
        <>
          {member.status === 'invited' && (
            <Badge variant="outline" className={cn('text-xs border', STATUS.warning.chip)}><BilingualText en="Invited" el="Προσκλήθηκε" compact /></Badge>
          )}
          {menu}
        </>
      )}
    />
  );
}

export default function OrgMembersPage() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const { slug, membership } = useCurrentOrg();
  const organizationId = membership?.organizationId ?? null;
  const { data, isLoading } = useQuery({
    queryKey: qk('org', 'admin-members', organizationId),
    queryFn: () => listOrganizationMembers(organizationId!),
    enabled: Boolean(organizationId),
    staleTime: 60_000,
    retry: 0,
  });

  const live = useMemo(() => (Array.isArray(data) ? data : []).map(toPageMember), [data]);
  const members = live;

  const filtered = members.filter(m => {
    const q = search.toLowerCase();
    const matchesSearch = !search || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || (m.department?.toLowerCase().includes(q) ?? false);
    const matchesTab = activeTab === 'all' || (activeTab === 'active' && m.status === 'active') || (activeTab === 'invited' && m.status === 'invited');
    return matchesSearch && matchesTab;
  });

  const roleCounts = members.reduce((acc, m) => {
    acc[m.role] = (acc[m.role] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const filtersActive = !!search || activeTab !== 'all';
  const clearFilters = () => { setSearch(''); setActiveTab('all'); };

  usePageList([
    {
      id: 'members',
      labelEn: 'Team members',
      labelEl: 'Μέλη ομάδας',
      rows: isLoading ? undefined : filtered.map((m) => `${m.name} · ${m.email} · ${m.role}${m.department ? ` · ${m.department}` : ''} · ${m.status}`),
      total: members.length,
      sample: live.length === 0,
    },
  ]);
  usePageControls([
    choiceControl('member_tab', 'Member filter', 'Φίλτρο μελών', [
      { value: 'all', en: 'All', el: 'Όλα' },
      { value: 'active', en: 'Active', el: 'Ενεργά' },
      { value: 'invited', en: 'Invited', el: 'Προσκεκλημένα' },
    ], activeTab, setActiveTab),
    {
      id: 'clear_filters',
      labelEn: 'Clear the member filters',
      labelEl: 'Καθαρισμός φίλτρων μελών',
      writes: false,
      unavailableEn: filtersActive ? undefined : 'No filter is set.',
      unavailableEl: filtersActive ? undefined : 'Δεν υπάρχει φίλτρο.',
      run: clearFilters,
    },
  ]);

  return (
    <AppShell showHelp
      title="Team Members"
      description="Invite and manage who can run programs, review applications, and access workspace settings."
      descriptionEl="Προσκαλέστε και ορίστε ποιοι τρέχουν προγράμματα, αξιολογούν αιτήσεις και έχουν πρόσβαση στις ρυθμίσεις."
      actions={(
        // Had no handler; invitations are sent from the organisation admin page.
        slug ? (
          <Button asChild>
            <Link href={`/org/${slug}/admin`}>
              <UserPlus className="mr-2 icon-sm" aria-hidden="true" />
              <BilingualText en="Invite Member" el="Πρόσκληση μέλους" compact />
            </Link>
          </Button>
        ) : (
          <UnavailableButton
            size="md"
            en="Invite member"
            el="Πρόσκληση μέλους"
            reasonEn="Invitations are sent on behalf of an organisation; join or create one first."
            reasonEl="Οι προσκλήσεις στέλνονται εκ μέρους οργανισμού· γίνετε μέλος ή δημιουργήστε έναν πρώτα."
          />
        )
      )}
    >
      <div className="space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 kpi-odd-span-md gap-4 md:grid-cols-4">
          {[
            { label: 'Total Members', labelEl: 'Σύνολο μελών', value: members.length },
            { label: 'Admins', labelEl: 'Διαχειριστές', value: (roleCounts['owner'] ?? 0) + (roleCounts['admin'] ?? 0) },
            { label: 'Mentors', labelEl: 'Μέντορες', value: roleCounts['mentor'] ?? 0 },
            { label: 'Pending Invites', labelEl: 'Εκκρεμείς προσκλήσεις', value: members.filter((m) => m.status === 'invited').length },
          ].map(stat => (
            <Card key={stat.label}>
              <CardContent>
                <p className="text-xs text-muted-foreground"><BilingualText en={stat.label} el={stat.labelEl} compact wrap /></p>
                <p className="page-stat text-xl font-bold">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
          <Input aria-label="Search members. Αναζήτηση μελών" placeholder={bilingualInline('Search members…', 'Αναζήτηση μελών…')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {/* Table */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {/* Counted over the members on screen - these read the sample
                list, so a real organisation's tabs said 8 / 6 / 2 whatever
                it held. */}
            <TabsTrigger value="all"><BilingualText en={`All (${members.length})`} el={`Όλα (${members.length})`} compact /></TabsTrigger>
            <TabsTrigger value="active"><BilingualText en={`Active (${members.filter(m => m.status === 'active').length})`} el={`Ενεργά (${members.filter(m => m.status === 'active').length})`} compact /></TabsTrigger>
            <TabsTrigger value="invited"><BilingualText en={`Invited (${members.filter(m => m.status === 'invited').length})`} el={`Προσκεκλημένα (${members.filter(m => m.status === 'invited').length})`} compact /></TabsTrigger>
          </TabsList>
          <TabsContent value={activeTab} className="mt-4">
            <Card>
              <CardContent>
                {filtered.length > 0 ? (
                  <div className="card-rows">
                    {filtered.map(member => (
                      <MemberRow key={member.id} member={member} live={live.length > 0} adminHref={slug ? `/org/${slug}/admin` : null} />
                    ))}
                  </div>
                ) : null}
                {filtered.length === 0 && (
                  <EmptyOrgMembers filtersActive={filtersActive} onClearFilters={clearFilters} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
