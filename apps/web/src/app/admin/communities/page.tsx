'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Users2,
  Search,
  Plus,
  MoreVertical,
  Globe,
  Lock,
  Shield,
  MessageSquare,
  Calendar,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { choiceControl, usePageControls, usePageList } from '@/lib/page-controls';
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createGroup, updateGroup, deleteGroup, listGroups, type GroupPrivacy, type GroupView } from '@/lib/api';
import { UnavailableMenuItem } from '@/components/common/UnavailableMenuItem';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { SampleDataNotice } from '@/components/common/SampleDataNotice';
import { BilingualText } from '@/components/common/BilingualText';
import { useToast } from '@/components/ui/toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RelativeTime } from '@/components/common/RelativeTime';
import { formatRelativeTime } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { qk } from '@/lib/query-keys';
import { useDemoData } from '@/contexts/DemoDataContext';
import { bilingualAria, bilingualInline } from '@/lib/i18n/format';
import { StatusText } from '@/components/common/StatusText';

/**
 * The page's own row from a group.
 *
 * A community on this screen is a `Group`: the model already carries the
 * member count, post count, category and privacy the cards show, and
 * `listGroups` has existed all along. Cohorts were the other candidate and
 * are the wrong one — they are an organisation's programme intake, not a
 * public room.
 *
 * `status` has no field: a group is not archived or flagged in the schema, so
 * every row reads active rather than being sorted into states the model does
 * not have.
 */
function toCommunity(group: GroupView): Community {
  return {
    id: group.id,
    name: group.name,
    description: group.description ?? undefined,
    category: group.category ?? '\u2014',
    visibility: group.privacy === 'secret' ? 'private' : group.privacy,
    privacy: group.privacy,
    memberCount: group.memberCount,
    postCount: group.postCount,
    createdAt: group.createdAt,
    status: 'active',
  };
}

type Community = {
  id: string;
  name: string;
  description?: string;
  category: string;
  visibility: 'public' | 'private' | 'tenant';
  memberCount: number;
  postCount: number;
  createdAt: string;
  status: 'active' | 'archived' | 'flagged';
  tenant?: string;
  /** The group's own privacy, kept so Edit can seed its form exactly. */
  privacy?: GroupPrivacy;
};

function CommunityCard({
  community,
  onEdit,
  onDelete,
}: {
  community: Community;
  onEdit: (c: Community) => void;
  onDelete: (c: Community) => void;
}) {
  const visibilityIcons: Record<string, React.ReactNode> = {
    public: <Globe className="icon-sm" />,
    private: <Lock className="icon-sm" />,
    tenant: <Shield className="icon-sm" />,
  };

  const statusColors: Record<string, string> = {
    active: 'bg-status-success-bg text-status-success border-status-success-border',
    archived: 'bg-muted text-muted-foreground border-border',
    flagged: 'bg-status-danger-bg text-status-danger border-status-danger-border',
  };

  return (
    <Card className="transition-all hover:border-primary/30">
      <CardContent>
        <div className="flex gap-4">
          <Avatar className="h-12 w-12 rounded-lg">
            <AvatarFallback className="rounded-lg bg-primary/10 text-primary-accessible font-semibold">
              {community.name[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Link href={`/groups/${community.id}`} className="font-medium hover:text-primary-accessible transition-colors">
                    {community.name}
                  </Link>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {visibilityIcons[community.visibility]}
                    <StatusText value={community.visibility} />
                  </span>
                </div>
                <p className="text-sm text-muted-foreground"><StatusText value={community.category} /></p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn('text-xs', statusColors[community.status])}>
                  <StatusText value={community.status} />
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button aria-label="More options" variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="icon-sm" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/groups/${community.id}`}><BilingualText en="View Community" el="Προβολή κοινότητας" compact /></Link>
                    </DropdownMenuItem>
                    {/* All five below had no handler, and both links above
                        pointed at /communities/:id, a route that does not
                        exist - the groups surface is /groups/[groupId]. */}
                    <DropdownMenuItem onSelect={() => onEdit(community)}><BilingualText en="Edit Settings" el="Επεξεργασία ρυθμίσεων" compact /></DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/groups/${community.id}?section=members`}><BilingualText en="Manage Members" el="Διαχείριση μελών" compact /></Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/admin/reports"><BilingualText en="View Reports" el="Προβολή αναφορών" compact /></Link>
                    </DropdownMenuItem>
                    <UnavailableMenuItem
                      className="text-status-warning"
                      en="Archive"
                      el="Αρχειοθέτηση"
                      reasonEn="Groups have no archived state in the schema yet."
                      reasonEl="Οι ομάδες δεν έχουν ακόμη κατάσταση αρχειοθέτησης."
                    />
                    <DropdownMenuItem className="text-destructive-accessible" onSelect={() => onDelete(community)}>
                      <BilingualText en="Delete" el="Διαγραφή" compact />
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {community.description && (
              <p className="card-copy text-sm text-muted-foreground mt-2 line-clamp-2">
                {community.description}
              </p>
            )}

            <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users2 className="icon-sm" />
                <BilingualText en={`${community.memberCount} members`} el={`${community.memberCount} μέλη`} compact />
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="icon-sm" />
                <BilingualText en={`${community.postCount} posts`} el={`${community.postCount} αναρτήσεις`} compact />
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="icon-sm" />
                <RelativeTime date={community.createdAt} format={formatRelativeTime} />
              </span>
              {community.tenant && (
                <span className="flex items-center gap-1">
                  <Shield className="icon-sm" />
                  {community.tenant}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Shown when no community has loaded. */
const SEED_COMMUNITIES: Community[] = [
  {
    id: '1',
    name: 'AI Founders',
    description: 'A community for founders building AI-powered products',
    category: 'Technology',
    visibility: 'public',
    memberCount: 1250,
    postCount: 456,
    createdAt: '2024-01-15T09:00:00.000Z',
    status: 'active',
  },
  {
    id: '2',
    name: 'TechStars Athens Network',
    description: 'Private community for TechStars Athens alumni and mentors',
    category: 'Accelerator',
    visibility: 'tenant',
    memberCount: 85,
    postCount: 234,
    createdAt: '2024-03-15T09:00:00.000Z',
    status: 'active',
    tenant: 'TechStars Athens',
  },
  {
    id: '3',
    name: 'FinTech Innovators',
    description: 'Discuss the latest in financial technology',
    category: 'Industry',
    visibility: 'public',
    memberCount: 890,
    postCount: 312,
    createdAt: '2024-02-15T09:00:00.000Z',
    status: 'active',
  },
  {
    id: '4',
    name: 'Startup Legal',
    description: 'Legal discussions for startups',
    category: 'Resources',
    visibility: 'private',
    memberCount: 156,
    postCount: 89,
    createdAt: '2023-12-15T09:00:00.000Z',
    status: 'flagged',
  },
];

export default function AdminCommunitiesPage() {
  // Illustrative rows are for the showcase; a real account with nothing
  // to list sees the page's empty state, not invented people and records.
  const { showDemoData } = useDemoData();
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [visibility, setVisibility] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);
  /** Set when the dialog edits an existing group rather than creating one. */
  const [editing, setEditing] = useState<Community | null>(null);
  const confirm = useConfirm();
  const [form, setForm] = useState({ name: '', description: '', category: '', privacy: 'public' as GroupPrivacy });

  // Mock data
  const { data, isLoading } = useQuery({
    queryKey: qk('groups', 'admin'),
    queryFn: () => listGroups({ limit: 100, sort: 'popular' }),
    staleTime: 60_000,
    retry: 0,
  });

  const createMutation = useMutation({
    mutationFn: createGroup,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk('groups') });
      success('Community created', `${form.name} is now listed.`);
      setCreateOpen(false);
      setForm({ name: '', description: '', category: '', privacy: 'public' });
    },
    onError: () => toastError('Could not create the community', 'The groups API rejected the request. Check the name and try again.'),
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; body: Parameters<typeof updateGroup>[1] }) => updateGroup(vars.id, vars.body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk('groups') });
      success('Community updated', `${form.name} was saved.`);
      setCreateOpen(false);
      setEditing(null);
      setForm({ name: '', description: '', category: '', privacy: 'public' });
    },
    onError: () => toastError('Could not save the community', 'The groups API rejected the change.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGroup(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk('groups') });
      success('Community deleted');
    },
    onError: () => toastError('Could not delete the community', 'The groups API rejected the request.'),
  });

  const live = useMemo(() => (data?.groups ?? []).map(toCommunity), [data]);
  const showingSeed = !isLoading && live.length === 0;

  const openEdit = (c: Community) => {
    if (showingSeed) {
      toastError('Nothing to edit', 'These rows are samples until the groups API returns communities.');
      return;
    }
    setEditing(c);
    setForm({ name: c.name, description: c.description ?? '', category: c.category === '\u2014' ? '' : c.category, privacy: c.privacy ?? 'public' });
    setCreateOpen(true);
  };

  const confirmDelete = async (c: Community) => {
    if (showingSeed) {
      toastError('Nothing to delete', 'These rows are samples until the groups API returns communities.');
      return;
    }
    const ok = await confirm({
      title: <BilingualText en={`Delete ${c.name}?`} el={`Διαγραφή: ${c.name};`} />,
      description: <BilingualText en="The group, its posts and its member list are removed. This cannot be undone." el="Η κοινότητα, οι αναρτήσεις και τα μέλη της αφαιρούνται. Δεν αναιρείται." />,
      confirmLabel: <BilingualText en="Delete community" el="Διαγραφή κοινότητας" compact />,
    });
    if (ok) deleteMutation.mutate(c.id);
  };
  const communities: Community[] = live.length > 0 ? live : isLoading || !showDemoData ? [] : SEED_COMMUNITIES;


  const filteredCommunities = communities.filter((c) => {
    const matchesSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase());
    const matchesVisibility = visibility === 'all' || c.visibility === visibility;
    const matchesStatus = status === 'all' || c.status === status;
    return matchesSearch && matchesVisibility && matchesStatus;
  });

  const activeFilterCount = (visibility !== 'all' ? 1 : 0) + (status !== 'all' ? 1 : 0);

  usePageList([
    {
      id: 'communities',
      labelEn: 'Communities',
      labelEl: 'Κοινότητες',
      rows: isLoading ? undefined : filteredCommunities.map((c) =>
        `${c.name} · ${c.category} · ${c.visibility} · ${c.status} · ${c.memberCount} members, ${c.postCount} posts`,
      ),
      total: communities.length,
      sample: showingSeed,
    },
  ]);
  // Offered to the assistant: the rail's two filters, same setters.
  usePageControls([
    choiceControl('visibility_filter', 'Visibility filter', 'Φίλτρο ορατότητας', [
      { value: 'all', en: 'Any visibility', el: 'Οποιαδήποτε ορατότητα' },
      { value: 'public', en: 'Public', el: 'Δημόσια' },
      { value: 'private', en: 'Private', el: 'Ιδιωτική' },
      { value: 'tenant', en: 'Tenant', el: 'Οργανισμός' },
    ], visibility, setVisibility),
    choiceControl('status_filter', 'Community status filter', 'Φίλτρο κατάστασης κοινότητας', [
      { value: 'all', en: 'Any status', el: 'Οποιαδήποτε κατάσταση' },
      { value: 'active', en: 'Active', el: 'Ενεργή' },
      { value: 'archived', en: 'Archived', el: 'Αρχειοθετημένη' },
      { value: 'flagged', en: 'Flagged', el: 'Σημασμένη' },
    ], status, setStatus),
  ]);

  const rail: PageRailSection[] = [
    {
      id: 'overview',
      glyph: 'chart',
      labelEn: 'Community stats',
      labelEl: 'Στατιστικά κοινοτήτων',
      badge: communities.filter((c) => c.status === 'flagged').length || null,
      content: (
        <div className="space-y-2">
          {[
            { label: 'Total Communities', labelEl: 'Σύνολο κοινοτήτων', value: communities.length },
            { label: 'Total Members', labelEl: 'Σύνολο μελών', value: communities.reduce((acc, c) => acc + c.memberCount, 0).toLocaleString('en-GB') },
            { label: 'Total Posts', labelEl: 'Σύνολο αναρτήσεων', value: communities.reduce((acc, c) => acc + c.postCount, 0).toLocaleString('en-GB') },
            { label: 'Flagged', labelEl: 'Με σήμανση', value: communities.filter((c) => c.status === 'flagged').length, danger: true },
          ].map(({ label, labelEl, value, danger }) => (
            <div key={label} className="rounded-lg border border-border p-3">
              <p className="text-sm text-muted-foreground"><BilingualText en={label} el={labelEl} compact wrap /></p>
              <p className={cn('page-stat mt-1 text-xl font-bold tabular-nums', danger && 'text-status-danger')}>{value}</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'filters',
      glyph: 'sliders',
      labelEn: 'Filters',
      labelEl: 'Φίλτρα',
      badge: activeFilterCount || null,
      content: (
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground"><BilingualText en="Visibility" el="Ορατότητα" compact /></p>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger aria-label="Visibility" className="w-full">
                <SelectValue placeholder={bilingualInline("Visibility", "Ορατότητα")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all"><BilingualText en="All" el="Όλες" compact /></SelectItem>
                <SelectItem value="public"><BilingualText en="Public" el="Δημόσια" compact /></SelectItem>
                <SelectItem value="private"><BilingualText en="Private" el="Ιδιωτική" compact /></SelectItem>
                <SelectItem value="tenant"><BilingualText en="Tenant" el="Οργανισμού" compact /></SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground"><BilingualText en="Status" el="Κατάσταση" compact /></p>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger aria-label="Status" className="w-full">
                <SelectValue placeholder={bilingualInline("Status", "Κατάσταση")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all"><BilingualText en="All Status" el="Όλες οι καταστάσεις" compact /></SelectItem>
                <SelectItem value="active"><BilingualText en="Active" el="Ενεργή" compact /></SelectItem>
                <SelectItem value="archived"><BilingualText en="Archived" el="Αρχειοθετημένη" compact /></SelectItem>
                <SelectItem value="flagged"><BilingualText en="Flagged" el="Επισημασμένη" compact /></SelectItem>
              </SelectContent>
            </Select>
          </div>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => { setVisibility('all'); setStatus('all'); }}
              className="tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted/70"
            >
              <span className="min-w-0 flex-1"><BilingualText en="Clear filters" el="Καθαρισμός φίλτρων" compact /></span>
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <AppShell rail={rail}
      actions={
        <>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 icon-sm" aria-hidden="true" />
            <BilingualText en="Create Community" el="Δημιουργία κοινότητας" compact />
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {showingSeed && (
          <SampleDataNotice
            surface="Communities"
            detail="The groups API returned no communities, so these rows are samples that show the layout. Creating a community writes to the real groups service."
            askAiPrompt="The communities list is showing sample rows. What live group-management actions can you take here?"
          />
        )}

        {/* Search — the rail carries visibility and status */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" aria-hidden="true" />
          <Input
            aria-label={bilingualAria("Search communities", "Αναζήτηση κοινοτήτων")}
            placeholder={bilingualInline("Search communities…", "Αναζήτηση κοινοτήτων…")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Communities List */}
        <div className="space-y-3">
          {filteredCommunities.map((community) => (
            <CommunityCard key={community.id} community={community} onEdit={openEdit} onDelete={confirmDelete} />
          ))}
          {filteredCommunities.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Users2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" aria-hidden="true" />
                <h3 className="font-medium"><BilingualText en="No communities found" el="Δεν βρέθηκαν κοινότητες" compact /></h3>
                <p className="text-sm text-muted-foreground mt-1">
                  <BilingualText en="Try adjusting your filters" el="Δοκιμάστε να αλλάξετε τα φίλτρα" compact />
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setEditing(null);
            setForm({ name: '', description: '', category: '', privacy: 'public' });
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : 'Create community'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Saves to the group through the groups API.'
                : 'Creates a real group via the groups API. The slug is derived from the name.'}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const slug = form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
              if (!form.name.trim() || !slug) return;
              if (editing) {
                updateMutation.mutate({
                  id: editing.id,
                  body: {
                    name: form.name.trim(),
                    description: form.description.trim(),
                    category: form.category.trim(),
                    privacy: form.privacy,
                  },
                });
                return;
              }
              createMutation.mutate({
                name: form.name.trim(),
                slug,
                description: form.description.trim() || undefined,
                category: form.category.trim() || undefined,
                privacy: form.privacy,
              });
            }}
          >
            <div className="space-y-1.5">
              <label htmlFor="community-name" className="text-sm font-medium"><BilingualText en="Name" el="Όνομα" compact /></label>
              <Input
                id="community-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. AI Founders"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="community-description" className="text-sm font-medium"><BilingualText en="Description" el="Περιγραφή" compact /></label>
              <Input
                id="community-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={bilingualInline("What is this community about?", "Ποιο είναι το θέμα της κοινότητας;")}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="community-category" className="text-sm font-medium"><BilingualText en="Category" el="Κατηγορία" compact /></label>
                <Input
                  id="community-category"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Technology"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="community-privacy" className="text-sm font-medium"><BilingualText en="Privacy" el="Απόρρητο" compact /></label>
                <Select value={form.privacy} onValueChange={(v) => setForm((f) => ({ ...f, privacy: v as GroupPrivacy }))}>
                  <SelectTrigger id="community-privacy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public"><BilingualText en="Public" el="Δημόσια" compact /></SelectItem>
                    <SelectItem value="private"><BilingualText en="Private" el="Ιδιωτική" compact /></SelectItem>
                    <SelectItem value="secret"><BilingualText en="Secret" el="Μυστική" compact /></SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}><BilingualText en="Cancel" el="Ακύρωση" compact /></Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending || !form.name.trim()}>
                {editing
                  ? updateMutation.isPending ? 'Saving…' : 'Save'
                  : createMutation.isPending ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
