'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Search, Layers, Lock, MessageSquare, ChevronRight } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { HelpCallout } from '@/components/common/HelpCallout';
import { BilingualText } from '@/components/common/BilingualText';
import { RelativeTime } from '@/components/common/RelativeTime';
import { MetricTile } from '@/components/dashboard/MetricTile';
import { EmptyLine } from '@/components/dashboard/SectionCard';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { listGroups } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { formatRelativeTime } from '@/lib/utils';
import { bilingualInline } from '@/lib/i18n/format';
import { usePageList } from '@/lib/page-controls';

const PRIVACY_LABEL: Record<string, { en: string; el: string }> = {
  public: { en: 'Public', el: 'Δημόσια' },
  private: { en: 'Private', el: 'Ιδιωτική' },
  secret: { en: 'Secret', el: 'Μυστική' },
};

/*
 * Three communities written into this file ("Climate Founders EU", 842
 * members, "+12% growth") while /admin/communities listed seven different ones
 * from the groups API - two admin pages about the same thing that did not
 * share a single row, and a "pending review" status groups do not have. This
 * reads the list /admin/communities reads, under the same key, and counts
 * what the rows actually carry. Editing stays on /admin/communities.
 */
export default function CommunityManagementPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading, isError } = useQuery({
    queryKey: qk('groups', 'admin'),
    queryFn: () => listGroups({ limit: 100, sort: 'popular' }),
    staleTime: 60_000,
    retry: 0,
  });

  const groups = data?.groups ?? [];
  const filtered = groups.filter((g) => `${g.name} ${g.category ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  const members = groups.reduce((sum, g) => sum + (g.memberCount ?? 0), 0);
  const posts = groups.reduce((sum, g) => sum + (g.postCount ?? 0), 0);
  const closed = groups.filter((g) => g.privacy !== 'public').length;
  const dash = '—';
  // The groups on screen, for the assistant; editing lives on /admin/communities.
  usePageList([
    {
      id: 'communities',
      labelEn: 'Communities',
      labelEl: 'Κοινότητες',
      rows: isLoading ? undefined : filtered.map((g) => `${g.name}${g.category ? ` · ${g.category}` : ''} · ${g.privacy} · ${g.memberCount ?? 0} members · ${g.postCount ?? 0} posts`),
      total: groups.length,
    },
  ]);

  return (
    <AppShell
      title="Community management"
      titleEl="Διαχείριση κοινοτήτων"
      description="Every group's size and activity at a glance; create, edit or remove them from Communities."
      descriptionEl="Μέγεθος και δραστηριότητα κάθε ομάδας με μια ματιά· δημιουργία, επεξεργασία ή διαγραφή από τις Κοινότητες."
      showHelp
    >
      <HelpCallout id="admin-community-management" title="Managing communities">
        <p>
          A high post-to-member ratio usually means a healthy group; a large group with few posts may need a moderator
          or a nudge. Private and secret groups are listed here but not in public discovery.
        </p>
      </HelpCallout>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricTile icon={Layers} label="Communities" labelEl="Κοινότητες" value={isLoading ? dash : groups.length} href="/admin/communities" />
        <MetricTile icon={Users} label="Memberships" labelEl="Συμμετοχές" value={isLoading ? dash : members.toLocaleString('en-GB')} caption="A person in two groups counts twice" captionEl="Όποιος είναι σε δύο ομάδες μετρά δύο φορές" />
        <MetricTile icon={MessageSquare} label="Posts" labelEl="Αναρτήσεις" value={isLoading ? dash : posts.toLocaleString('en-GB')} />
        <MetricTile icon={Lock} label="Private or secret" labelEl="Ιδιωτικές ή μυστικές" value={isLoading ? dash : closed} />
      </div>

      <div className="relative mt-4 max-w-md">
        <Search className="absolute left-3 top-1/2 icon-sm -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={bilingualInline("Search communities…", "Αναζήτηση κοινοτήτων…")}
          aria-label="Search communities"
          className="pl-9"
        />
      </div>

      <Card className="mt-4 overflow-hidden">
        {isLoading && (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}
          </div>
        )}
        {!isLoading && isError && groups.length === 0 && (
          <EmptyLine en="The groups could not be loaded." el="Οι κοινότητες δεν φορτώθηκαν." />
        )}
        {!isLoading && !isError && filtered.length === 0 && (
          <EmptyLine
            en={search ? 'No community matches that search.' : 'No communities yet.'}
            el={search ? 'Καμία κοινότητα δεν ταιριάζει.' : 'Δεν υπάρχουν κοινότητες ακόμα.'}
          />
        )}
        {filtered.map((g) => {
          const privacy = PRIVACY_LABEL[g.privacy] ?? PRIVACY_LABEL.public;
          const ratio = g.memberCount ? g.postCount / g.memberCount : 0;
          return (
            <Link
              key={g.id}
              href={`/groups/${g.id}`}
              className="group flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/30 focus-ring"
            >
              <div className="min-w-0 flex-1 basis-56">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {g.name}
                  <Badge variant="outline" size="sm">
                    <BilingualText en={privacy.en} el={privacy.el} compact />
                  </Badge>
                </p>
                <p className="text-sm text-muted-foreground">
                  {g.category ? `${g.category} · ` : ''}
                  {g.memberCount.toLocaleString('en-GB')} members · {g.postCount.toLocaleString('en-GB')} posts · created{' '}
                  <RelativeTime date={g.createdAt} format={formatRelativeTime} />
                </p>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground" title="Posts per member">
                {ratio.toFixed(2)} posts / member
              </span>
              <ChevronRight className="icon-sm shrink-0 text-muted-foreground/60 group-hover:text-foreground" aria-hidden="true" />
            </Link>
          );
        })}
      </Card>
    </AppShell>
  );
}
