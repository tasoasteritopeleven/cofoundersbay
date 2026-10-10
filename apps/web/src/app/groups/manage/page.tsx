'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyGroups, deleteGroup } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { SampleDataNotice } from '@/components/common/SampleDataNotice';
import { UnavailableMenuItem } from '@/components/common/UnavailableMenuItem';
import Link from 'next/link';
import {
  Users,
  Plus,
  Search,
  Settings,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  UserPlus,
  Lock,
  Globe,
  Shield,
  TrendingUp,
  MessageSquare,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ListEmptyState, NoFilterResults } from '@/components/common/EmptyStates';
import { cn } from '@/lib/utils';
import { STATUS } from '@/lib/semantic-colors';
import { qk } from '@/lib/query-keys';
import { CANCELLED, ROW_GONE, rowOptions, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { useDemoData } from '@/contexts/DemoDataContext';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualAria, bilingualInline } from '@/lib/i18n/format';
import { StatusText } from '@/components/common/StatusText';
import { useDateFormat } from '@/lib/i18n/useDateFormat';
import { CardFoot, CardHead } from '@/components/common/CardAnatomy';
import { FactLine } from '@/components/common/FactLine';

type ManagedGroup = {
  id: string;
  name: string;
  description: string;
  category: string;
  privacy: 'public' | 'private' | 'secret';
  memberCount: number;
  postCount: number;
  role: 'owner' | 'admin' | 'moderator';
  isActive: boolean;
  lastActivity: string;
  pendingRequests?: number;
};

const PRIVACY_CONFIG = {
  public: { label: 'Public', labelEl: 'Δημόσια', icon: Globe, iconClass: STATUS.success.icon },
  private: { label: 'Private', labelEl: 'Ιδιωτική', icon: Lock, iconClass: STATUS.warning.icon },
  secret: { label: 'Secret', labelEl: 'Μυστική', icon: Shield, iconClass: STATUS.danger.icon },
};

const MOCK_GROUPS: ManagedGroup[] = [
  { id: '1', name: 'AI Founders Network', description: 'Community for founders building AI-powered startups', category: 'AI/ML', privacy: 'public', memberCount: 1247, postCount: 342, role: 'owner', isActive: true, lastActivity: '2 hours ago', pendingRequests: 5 },
  { id: '2', name: 'SaaS Growth Hackers', description: 'Strategies for scaling SaaS businesses', category: 'SaaS', privacy: 'private', memberCount: 456, postCount: 189, role: 'admin', isActive: true, lastActivity: '1 day ago', pendingRequests: 12 },
  { id: '3', name: 'Early Stage Investors', description: 'Angels and pre-seed investors connecting with founders', category: 'Investing', privacy: 'private', memberCount: 87, postCount: 45, role: 'moderator', isActive: true, lastActivity: '3 hours ago' },
  { id: '4', name: 'CleanTech Builders', description: 'Founders working on climate and sustainability', category: 'CleanTech', privacy: 'public', memberCount: 234, postCount: 78, role: 'admin', isActive: false, lastActivity: '1 week ago' },
];

type GroupActions = {
  onInvite: (g: ManagedGroup) => void;
  onDelete: (g: ManagedGroup) => PageControlRunResult | Promise<PageControlRunResult>;
};

function GroupCard({ group, onInvite, onDelete }: { group: ManagedGroup } & GroupActions) {
  const privacyCfg = PRIVACY_CONFIG[group.privacy];

  // The Opportunities card: the community's mark and name with its kind,
  // privacy and the reader's role under it, the menu at the right, then the
  // sentence and a foot with the figures and the way in, on the mark's edge.
  return (
    <Card className={cn('transition-all hover:border-primary/20', !group.isActive && 'surface-inactive')}>
      <CardContent className="space-y-3">
        <CardHead
          mark={(
            <Avatar className="h-10 w-10 rounded-xl">
              <AvatarFallback className="rounded-xl bg-primary/10 font-semibold text-primary-accessible">
                {group.name?.[0] ?? '?'}
              </AvatarFallback>
            </Avatar>
          )}
          title={(
            <Link href={`/groups/${group.id}`} className="transition-colors hover:text-primary-accessible">
              {group.name}
            </Link>
          )}
          subtitle={(
            <FactLine
              className="text-sm"
              items={[
                <StatusText key="category" value={group.category} />,
                <BilingualText key="privacy" en={privacyCfg.label} el={privacyCfg.labelEl} compact />,
                <StatusText key="role" value={group.role} />,
              ]}
            />
          )}
          asideStays
          aside={(
            <>
              {!group.isActive && <Badge variant="outline" className="text-xs text-muted-foreground"><BilingualText en="Archived" el="Αρχειοθετημένη" compact /></Badge>}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${group.name}`}>
                    <MoreVertical className="icon-sm" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {/* All four had no handler. Editing and settings happen on
                      the group itself; inviting shares its link; deleting is
                      the owner's, and the server enforces that. */}
                  <DropdownMenuItem asChild>
                    <Link href={`/groups/${group.id}`}><Edit className="mr-2 icon-sm" aria-hidden="true" /><BilingualText en="Edit Group" el="Επεξεργασία κοινότητας" compact /></Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onInvite(group)}><UserPlus className="mr-2 icon-sm" aria-hidden="true" /><BilingualText en="Invite Members" el="Πρόσκληση μελών" compact /></DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/groups/${group.id}?section=members`}><Settings className="mr-2 icon-sm" aria-hidden="true" /><BilingualText en="Group Settings" el="Ρυθμίσεις κοινότητας" compact /></Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {group.role === 'owner' ? (
                    <DropdownMenuItem className="text-destructive-accessible" onSelect={() => void onDelete(group)}>
                      <Trash2 className="mr-2 icon-sm" aria-hidden="true" /><BilingualText en="Delete group" el="Διαγραφή κοινότητας" compact />
                    </DropdownMenuItem>
                  ) : (
                    <UnavailableMenuItem
                      className="text-destructive-accessible"
                      icon={<Trash2 className="mr-2 mt-0.5 icon-sm" aria-hidden="true" />}
                      en="Delete group"
                      el="Διαγραφή κοινότητας"
                      reasonEn="Only the owner can delete a group."
                      reasonEl="Μόνο ο ιδιοκτήτης μπορεί να διαγράψει μια κοινότητα."
                    />
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        />

        {group.description ? (
          <p className="card-body line-clamp-2 text-muted-foreground first-letter:uppercase">{group.description}</p>
        ) : null}

        <CardFoot
          meta={(
            <FactLine
              items={[
                <BilingualText key="members" en={`${(group.memberCount ?? 0).toLocaleString('en-GB')} members`} el={`${(group.memberCount ?? 0).toLocaleString('el-GR')} μέλη`} compact />,
                <BilingualText key="posts" en={`${group.postCount ?? 0} posts`} el={`${group.postCount ?? 0} αναρτήσεις`} compact />,
                <BilingualText key="active" en={`Active ${group.lastActivity}`} el={`Δραστηριότητα ${group.lastActivity}`} compact />,
                group.pendingRequests && group.pendingRequests > 0 ? (
                  <span key="pending" className="font-medium text-destructive-accessible">
                    <BilingualText en={`${group.pendingRequests} pending`} el={`${group.pendingRequests} σε αναμονή`} compact />
                  </span>
                ) : null,
              ]}
            />
          )}
        >
          <Button variant="outline" size="sm" asChild>
            <Link href={`/groups/${group.id}`}>
              <Eye className="mr-1.5 icon-sm" aria-hidden="true" /><BilingualText en="View" el="Προβολή" compact />
            </Link>
          </Button>
        </CardFoot>
      </CardContent>
    </Card>
  );
}

export default function ManageGroupsPage() {
  const fmtDate = useDateFormat();
  // Illustrative rows are for the showcase; a real account with nothing
  // to list sees the page's empty state, not invented people and records.
  const { showDemoData } = useDemoData();
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const confirm = useConfirm();

  // The groups the viewer runs, from GET /groups/my; this list was a fixed
  // array. Plain membership is not management, so members are left out.
  const { data, isLoading } = useQuery({
    queryKey: qk('groups', 'my'),
    queryFn: getMyGroups,
    staleTime: 60_000,
    retry: 0,
  });
  const live: ManagedGroup[] = useMemo(
    () =>
      (data?.groups ?? [])
        .filter((g) => g.memberRole === 'owner' || g.memberRole === 'admin' || g.memberRole === 'moderator')
        .map((g) => ({
          id: g.id,
          name: g.name,
          description: g.description ?? '',
          category: g.category ?? '\u2014',
          privacy: g.privacy,
          memberCount: g.memberCount,
          postCount: g.postCount,
          role: g.memberRole as ManagedGroup['role'],
          isActive: true,
          lastActivity: fmtDate(g.updatedAt, { day: 'numeric', month: 'short' }),
        })),
    [data, fmtDate],
  );
  const showingSample = !isLoading && live.length === 0;
  const groups: ManagedGroup[] = live.length > 0 ? live : isLoading || !showDemoData ? [] : MOCK_GROUPS;

  const actions: GroupActions = {
    onInvite: async (g) => {
      try {
        await navigator.clipboard.writeText(`${window.location.origin}/groups/${g.id}`);
        success('Invite link copied', `Anyone with the link can find ${g.name}${g.privacy === 'public' ? ' and join' : ' and request to join'}.`);
      } catch {
        toastError('Could not copy', 'The browser refused clipboard access.');
      }
    },
    onDelete: async (g) => {
      if (showingSample) {
        toastError('Nothing to delete', 'These are sample communities until you run one.');
        return { error: 'These are sample communities until you run one.' };
      }
      const ok = await confirm({
        title: <BilingualText en={`Delete ${g.name}?`} el={`Διαγραφή: ${g.name};`} />,
        description: <BilingualText en="The group, its posts and its member list are removed. This cannot be undone." el="Η κοινότητα, οι αναρτήσεις και τα μέλη της αφαιρούνται. Δεν αναιρείται." />,
        confirmLabel: <BilingualText en="Delete group" el="Διαγραφή κοινότητας" compact />,
      });
      if (!ok) return CANCELLED;
      try {
        await deleteGroup(g.id);
        success('Group deleted', g.name);
      } catch (e) {
        toastError('Could not delete the group', e instanceof Error ? e.message : undefined);
        return { error: e instanceof Error && e.message ? e.message : 'The group could not be deleted.' };
      } finally {
        void queryClient.invalidateQueries({ queryKey: qk('groups') });
      }
    },
  };

  const filtered = groups.filter(g =>
    !search || g.name.toLowerCase().includes(search.toLowerCase()) || g.category.toLowerCase().includes(search.toLowerCase())
  );

  const totalMembers = groups.reduce((s, g) => s + g.memberCount, 0);
  const pendingTotal = groups.reduce((s, g) => s + (g.pendingRequests ?? 0), 0);

  // Offered to the assistant: the card menu's invite link and delete (which
  // asks, and refuses the sample communities).
  usePageList([
    {
      id: 'managed_groups',
      labelEn: 'Groups you manage',
      labelEl: 'Κοινότητες που διαχειρίζεστε',
      rows: isLoading ? undefined : filtered.map((g) => `${g.name} · ${g.category} · ${g.privacy} · ${g.memberCount} members${g.pendingRequests ? ` · ${g.pendingRequests} pending` : ''} · you are ${g.role}`),
      total: groups.length,
      sample: showingSample,
    },
  ]);
  usePageControls([
    { id: 'copy_invite_link', labelEn: 'Copy a group invite link', labelEl: 'Αντιγραφή συνδέσμου πρόσκλησης κοινότητας', writes: false, options: rowOptions(filtered, (g) => g.id, (g) => g.name), run: (v) => { const g = groups.find((x) => x.id === v); if (g) void actions.onInvite(g); } },
    { id: 'delete_group', labelEn: 'Delete group', labelEl: 'Διαγραφή κοινότητας', writes: true, options: rowOptions(filtered.filter((g) => g.role === 'owner'), (g) => g.id, (g) => g.name), unavailableEn: showingSample ? 'These are sample communities until you run one.' : undefined, unavailableEl: showingSample ? 'Είναι δείγματα κοινοτήτων μέχρι να δημιουργήσετε μία.' : undefined, run: (v) => { const g = groups.find((x) => x.id === v); return g ? actions.onDelete(g) : ROW_GONE; } },
  ]);

  return (
    <AppShell
      title="Manage communities"
      titleEl="Διαχείριση κοινοτήτων"
      description="Communities you own or administer — review members, pending requests, and activity at a glance."
      descriptionEl="Κοινότητες που σας ανήκουν ή διαχειρίζεστε — μέλη, εκκρεμή αιτήματα και δραστηριότητα με μια ματιά."
      actions={(
        <Button asChild>
          <Link href="/groups">
            <Plus className="mr-2 icon-sm" />
            <BilingualText en="Create community" el="Νέα κοινότητα" compact />
          </Link>
        </Button>
      )}
    >
      <div className="space-y-6">
        {showingSample && (
          <SampleDataNotice
            surface="Manage communities"
            detail="You do not run a community yet, so these are samples that show the layout."
            askAiPrompt="How do I start and run a community on CoFounderBay?"
          />
        )}
        {/* Stats */}
        <div className="grid grid-cols-2 kpi-odd-span-md gap-4 md:grid-cols-3">
          {[
            { label: 'Groups Managed', labelEl: 'Κοινότητες που διαχειρίζεστε', value: groups.length },
            { label: 'Total Members', labelEl: 'Σύνολο μελών', value: totalMembers.toLocaleString('en-GB') },
            { label: 'Pending Requests', labelEl: 'Εκκρεμή αιτήματα', value: pendingTotal },
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
          <Input aria-label={bilingualAria("Search groups", "Αναζήτηση κοινοτήτων")} placeholder={bilingualInline("Search groups…", "Αναζήτηση κοινοτήτων…")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {/* Groups */}
        <div className="space-y-3">
          {filtered.map(group => (
            <GroupCard key={group.id} group={group} {...actions} />
          ))}
          {filtered.length === 0 && (
            search ? (
              <NoFilterResults entity="communities" onClear={() => setSearch('')} />
            ) : (
              <ListEmptyState
                icon={Users}
                tone="primary"
                title="You don't manage any communities yet"
                description="Create a community to bring people together. As owner you control privacy, membership, and moderation."
                action={(
                  <Button asChild className="gap-2">
                    <Link href="/groups">
                      <Plus className="icon-sm" />
                      <BilingualText en="Create community" el="Νέα κοινότητα" compact />
                    </Link>
                  </Button>
                )}
              />
            )
          )}
        </div>
      </div>
    </AppShell>
  );
}
