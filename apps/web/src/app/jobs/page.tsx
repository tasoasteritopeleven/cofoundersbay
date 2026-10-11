'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  MapPin,
  Wifi,
  Search,
  Plus,
  ExternalLink,
  Loader2,
  AlertCircle,
  Star,
  Filter,
  Code2,
  Megaphone,
  Palette,
  Scale,
  BarChart3,
  Users,
  Sparkles,
  Zap,
  X,
  Handshake,
  Store,
} from 'lucide-react';
import { listJobs, createJobPosting, type JobPostingView } from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { RailAction, RailOptions, RailStats } from '@/components/layout/RailParts';
import { usePageRail } from '@/components/layout/PageRailContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn, initialsOf } from '@/lib/utils';
import { BilingualText } from '@/components/common/BilingualText';
import { StatusText } from '@/components/common/StatusText';
import { SaveItemButton } from '@/components/common/SaveItemButton';
import { jobsEn, jobsEl } from '@/lib/i18n/strings-jobs';
import { bilingualInline } from '@/lib/i18n/format';
import { qk } from '@/lib/query-keys';
import { choiceControl, usePageControls, usePageList } from '@/lib/page-controls';
import { CardHead, CardFoot } from '@/components/common/CardAnatomy';
import { FactLine } from '@/components/common/FactLine';

const ROLE_FILTERS = [
  { value: 'all',         labelKey: 'role_all' as const,         icon: Briefcase },
  { value: 'engineering', labelKey: 'role_engineering' as const, icon: Code2     },
  { value: 'marketing',   labelKey: 'role_marketing' as const,   icon: Megaphone },
  { value: 'design',      labelKey: 'role_design' as const,      icon: Palette   },
  { value: 'legal',       labelKey: 'role_legal' as const,       icon: Scale     },
  { value: 'analytics',   labelKey: 'role_analytics' as const,   icon: BarChart3 },
  { value: 'operations',  labelKey: 'role_operations' as const,  icon: Users     },
] as const;
type RoleFilter = typeof ROLE_FILTERS[number]['value'];

const EMPLOYMENT_TYPES = [
  { value: 'all',       labelKey: 'emp_all' as const },
  { value: 'full-time', labelKey: 'emp_full_time' as const },
  { value: 'part-time', labelKey: 'emp_part_time' as const },
  { value: 'contract',  labelKey: 'emp_contract' as const },
  { value: 'cofounder', labelKey: 'emp_cofounder' as const },
  { value: 'advisor',   labelKey: 'emp_advisor' as const },
] as const;

function JobCard({ job, featured = false }: { job: JobPostingView; featured?: boolean }) {
  // The Opportunities card: the poster's mark, the role's title with the
  // poster and the kind of work under it, then the facts and the actions,
  // all on the mark's left edge.
  return (
    <Card className={cn(
      'card-interactive group transition-all hover:border-primary/20',
      featured && 'border-primary/15 bg-primary/[0.03]'
    )}>
      <CardContent className="space-y-3">
        <CardHead
          mark={(
            <Avatar className="h-10 w-10">
              <AvatarImage src={job.creator?.avatarUrl ?? undefined} alt="" />
              <AvatarFallback className="bg-primary/10 font-semibold text-primary-accessible">
                {initialsOf(job.creator?.displayName ?? '')}
              </AvatarFallback>
            </Avatar>
          )}
          title={<span className="transition-colors group-hover:text-primary-accessible">{job.title}</span>}
          subtitle={(
            <FactLine
              className="text-sm"
              items={[
                job.creator?.displayName,
                job.type ? <StatusText key="type" value={job.type} /> : null,
              ]}
            />
          )}
          asideStays
          aside={featured ? (
            // A state, not decoration: kept through the card's icon rule.
            <span data-keep-icon role="img" aria-label={bilingualInline('Featured', 'Προτεινόμενη')} className="inline-flex">
              <Star className="icon-sm fill-status-warning text-status-warning" aria-hidden="true" />
            </span>
          ) : undefined}
        />

        <FactLine
          items={[
            job.role ? <StatusText key="role" value={job.role} /> : null,
            // "Remote — EU time zones" already says remote; the word is added
            // only when the place does not.
            job.isRemote && !/remote/i.test(job.location ?? '') ? <BilingualText key="remote" en={jobsEn('remote')} el={jobsEl('remote')} compact /> : null,
            job.location || null,
            !job.location && !job.isRemote
              ? <BilingualText key="where" en={jobsEn('location_unknown')} el={jobsEl('location_unknown')} compact />
              : null,
          ]}
        />

        <CardFoot>
          <SaveItemButton kind="job" itemId={job.id} title={job.title} />
          {/* "View" linked to /discover (API) or back to /jobs (demo) for
              every role; it opens the poster's profile when the poster is known. */}
          {job.creator?.id ? (
            <Button variant="outline" size="sm" className="gap-1" asChild>
              <Link href={`/profiles/${job.creator.id}`}>
                <ExternalLink className="icon-sm" aria-hidden="true" />
                <BilingualText en="View poster" el="Προβολή εκδότη" compact />
              </Link>
            </Button>
          ) : null}
        </CardFoot>
      </CardContent>
    </Card>
  );
}

function JobSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-start gap-4">
        <Skeleton className="h-11 w-11 rounded-lg shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

function PostJobForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { success, error: showError } = useToast();
  const [form, setForm] = useState({ title: '', role: '', location: '', isRemote: false });
  const set = (k: keyof typeof form, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  const mutation = useMutation({
    mutationFn: () =>
      createJobPosting({
        title: form.title.trim(),
        role: form.role.trim() || undefined,
        location: form.location.trim() || undefined,
        isRemote: form.isRemote,
      }),
    onSuccess: () => {
      success(jobsEn('posted'), jobsEn('posted_body'));
      onCreated();
      onClose();
    },
    onError: (err) => showError('Failed', err instanceof Error ? err.message : 'Please try again'),
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            <BilingualText en={jobsEn('dialog_title')} el={jobsEl('dialog_title')} compact />
          </DialogTitle>
          <DialogDescription className="sr-only"><BilingualText en="Post a role so candidates can apply." el="Δημοσιεύστε μια θέση για να υποβάλουν υποψήφιοι αίτηση." /></DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="job-f1" className="text-sm font-medium">
              <BilingualText en={jobsEn('field_title')} el={jobsEl('field_title')} compact /> *
            </label>
            <Input id="job-f1"
              placeholder="e.g. Full-Stack Engineer (equity)"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              maxLength={120}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="job-f2" className="text-sm font-medium">
              <BilingualText en={jobsEn('field_role')} el={jobsEl('field_role')} compact />
            </label>
            <Input id="job-f2"
              placeholder="e.g. Engineering, Marketing, Design"
              value={form.role}
              onChange={(e) => set('role', e.target.value)}
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="job-f3" className="text-sm font-medium">
              <BilingualText en={jobsEn('field_location')} el={jobsEl('field_location')} compact />
            </label>
            <Input id="job-f3"
              placeholder="e.g. Athens, GR"
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              maxLength={120}
              disabled={form.isRemote}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isRemote}
              onChange={(e) => set('isRemote', e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <BilingualText en={jobsEn('field_remote')} el={jobsEl('field_remote')} compact />
          </label>
        <DialogFooter>
            <Button variant="ghost" onClick={onClose}>
              <BilingualText en={jobsEn('cancel')} el={jobsEl('cancel')} compact />
            </Button>
            <Button
              className="gap-2"
              onClick={() => mutation.mutate()}
              disabled={!form.title.trim() || mutation.isPending}
            >
              {mutation.isPending ? <Loader2 className="icon-sm animate-spin" /> : <Briefcase className="icon-sm" />}
              <BilingualText en={jobsEn('submit')} el={jobsEl('submit')} compact />
            </Button>
        </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function JobsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [employmentType, setEmploymentType] = useState<(typeof EMPLOYMENT_TYPES)[number]['value']>('all');
  const [showPostForm, setShowPostForm] = useState(false);
  const { openRailSection } = usePageRail();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: qk('jobs'),
    queryFn: () => listJobs({ limit: 50 }),
    staleTime: 60_000,
    retry: 1,
  });

  const jobs = data?.jobs ?? [];

  const filtered = jobs.filter((j) => {
    const matchSearch = !search.trim() ||
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.role?.toLowerCase().includes(search.toLowerCase()) ||
      j.creator.displayName.toLowerCase().includes(search.toLowerCase()) ||
      j.location?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || j.role?.toLowerCase().includes(roleFilter);
    const typeSlug = (j.type ?? '').toLowerCase().replace(/\s+/g, '-');
    const roleSlug = (j.role ?? '').toLowerCase();
    const matchEmp =
      employmentType === 'all' ||
      typeSlug === employmentType ||
      (employmentType === 'cofounder' && (roleSlug.includes('co-founder') || roleSlug.includes('cofounder') || typeSlug.includes('cofounder')));
    return matchSearch && matchRole && matchEmp;
  });

  // The featured strip shows the postings flagged as featured, or the three
  // newest when none are, and the sections below it do not repeat them - the
  // same three cards used to appear twice, once as featured and again under
  // Remote or On-site.
  const showFeatured = !search && roleFilter === 'all';
  const flagged = filtered.filter((j) => j.isFeatured);
  const featuredJobs = showFeatured ? (flagged.length ? flagged : filtered).slice(0, 3) : [];
  const featuredIds = new Set(featuredJobs.map((j) => j.id));
  const remoteJobs = filtered.filter((j) => j.isRemote);
  const onsiteJobs = filtered.filter((j) => !j.isRemote);
  const remoteRest = remoteJobs.filter((j) => !featuredIds.has(j.id));
  const onsiteRest = onsiteJobs.filter((j) => !featuredIds.has(j.id));

  // Offered to the assistant: the role and type chips, the search reset and
  // the Post form, through the same setters; the postings go out as a list.
  usePageList([
    {
      id: 'jobs',
      labelEn: 'Job postings',
      labelEl: 'Αγγελίες',
      rows: isLoading ? undefined : filtered.map((j) =>
        `${j.title}${j.role ? ` · ${j.role}` : ''} · ${j.creator.displayName} · ${j.isRemote ? 'remote' : (j.location ?? 'on-site')}${j.type ? ` · ${j.type}` : ''}`,
      ),
      total: jobs.length,
    },
  ]);
  usePageControls([
    choiceControl('role_filter', 'Role filter', 'Φίλτρο ρόλου', ROLE_FILTERS.map((r) => ({ value: r.value, en: jobsEn(r.labelKey), el: jobsEl(r.labelKey) })), roleFilter, (v) => setRoleFilter(v as RoleFilter)),
    choiceControl('employment_type', 'Employment type', 'Τύπος απασχόλησης', EMPLOYMENT_TYPES.map((t) => ({ value: t.value, en: jobsEn(t.labelKey), el: jobsEl(t.labelKey) })), employmentType, (v) => setEmploymentType(v as typeof employmentType)),
    {
      id: 'clear_search',
      labelEn: 'Clear the job search',
      labelEl: 'Καθαρισμός αναζήτησης αγγελιών',
      writes: false,
      unavailableEn: search ? undefined : 'No search is set.',
      unavailableEl: search ? undefined : 'Δεν υπάρχει αναζήτηση.',
      run: () => setSearch(''),
    },
    { id: 'post_job', labelEn: 'Open the post a job form', labelEl: 'Άνοιγμα φόρμας νέας αγγελίας', writes: false, run: () => setShowPostForm(true) },
  ]);

  /*
   * The column leads with the search and the roles. The three counts and the
   * two filter tiers (role, then employment type) sat above them, four rows
   * of chrome before the first posting; they live in the rail now, with the
   * active filter count on its collapsed strip.
   */
  const activeFilters = (roleFilter !== 'all' ? 1 : 0) + (employmentType !== 'all' ? 1 : 0);
  const rail: PageRailSection[] = [
    {
      id: 'summary',
      glyph: 'chart',
      labelEn: 'Hiring at a glance',
      labelEl: 'Προσλήψεις με μια ματιά',
      content: (
        <RailStats
          items={[
            { key: 'open', label: jobsEn('stat_open'), labelEl: jobsEl('stat_open'), value: jobs.length || '\u2014', icon: Briefcase, tone: 'bg-status-accent-bg text-status-accent' },
            { key: 'remote', label: jobsEn('stat_remote'), labelEl: jobsEl('stat_remote'), value: remoteJobs.length || '\u2014', icon: Wifi, tone: 'bg-status-success-bg text-status-success' },
            { key: 'hiring', label: jobsEn('stat_hiring'), labelEl: jobsEl('stat_hiring'), value: new Set(jobs.map((j) => j.creator.displayName)).size || '\u2014', icon: Zap, tone: 'bg-status-warning-bg text-status-warning' },
          ]}
        />
      ),
    },
    {
      id: 'filters',
      glyph: 'sliders',
      labelEn: 'Filters',
      labelEl: 'Φίλτρα',
      badge: activeFilters || null,
      content: (
        <div className="space-y-4">
          <RailOptions
            title="Role"
            titleEl="Ρόλος"
            options={ROLE_FILTERS.map((rf) => ({ value: rf.value, en: jobsEn(rf.labelKey), el: jobsEl(rf.labelKey), icon: rf.icon }))}
            value={roleFilter}
            onChange={setRoleFilter}
          />
          <RailOptions
            title="Employment type"
            titleEl="Τύπος απασχόλησης"
            options={EMPLOYMENT_TYPES.map((t) => ({ value: t.value, en: jobsEn(t.labelKey), el: jobsEl(t.labelKey) }))}
            value={employmentType}
            onChange={setEmploymentType}
          />
          {activeFilters > 0 && (
            <RailAction icon={X} en="Clear filters" el="Καθαρισμός φίλτρων" onClick={() => { setRoleFilter('all'); setEmploymentType('all'); }} />
          )}
        </div>
      ),
    },
    {
      id: 'related',
      glyph: 'flag',
      labelEn: 'Linked pages',
      labelEl: 'Συνδεδεμένες σελίδες',
      content: (
        <div className="space-y-1">
          <RailAction icon={Handshake} en="Open opportunities" el="Άνοιγμα ευκαιριών" onClick={() => router.push('/opportunities')} />
          <RailAction icon={Store} en="Open marketplace" el="Άνοιγμα αγοράς" onClick={() => router.push('/marketplace')} />
          <RailAction icon={Sparkles} en="Open discover" el="Άνοιγμα ανακάλυψης" onClick={() => router.push('/discover')} />
        </div>
      ),
    },
  ];

  return (
    <>
    {showPostForm && (
      <PostJobForm
        onClose={() => setShowPostForm(false)}
        onCreated={() => queryClient.invalidateQueries({ queryKey: qk('jobs') })}
      />
    )}
    <AppShell
      showHelp
      rail={rail}
      actions={
        <Button className="gap-2" onClick={() => setShowPostForm(true)}>
          <Plus className="icon-sm" />
          <BilingualText en={jobsEn('post')} el={jobsEl('post')} compact />
        </Button>
      }
    >
      <div className="space-y-6 pb-10">
      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 icon-sm -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label={bilingualInline("Search jobs, roles, companies", "Αναζήτηση θέσεων, ρόλων, εταιρειών")}
            placeholder={bilingualInline(jobsEn('search'), jobsEl('search'))}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isError ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <AlertCircle className="icon-xl text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            <BilingualText en={jobsEn('load_failed')} el={jobsEl('load_failed')} compact />
          </p>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            <BilingualText en={jobsEn('try_again')} el={jobsEl('try_again')} compact />
          </Button>
        </CardContent></Card>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <JobSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        // A role or type narrowed in the rail empties the list as surely as a
        // search does; "post a job" would misread that as an empty board.
        <EmptyState
          illustration="rocket"
          title={
            search ? <BilingualText en={jobsEn('empty_search')} el={jobsEl('empty_search')} />
            : activeFilters > 0 ? <BilingualText en="No jobs match these filters" el="Καμία θέση δεν ταιριάζει με αυτά τα φίλτρα" />
            : <BilingualText en={jobsEn('empty')} el={jobsEl('empty')} />
          }
          description={
            search ? <BilingualText en={jobsEn('empty_search_hint')} el={jobsEl('empty_search_hint')} />
            : activeFilters > 0 ? <BilingualText en="The role and type filters are set in the side panel." el="Τα φίλτρα ρόλου και τύπου βρίσκονται στο πλευρικό πάνελ." />
            : <BilingualText en={jobsEn('empty_hint')} el={jobsEl('empty_hint')} />
          }
          askAiPrompt={
            search
              ? `No jobs matched "${search}". Suggest better keywords or people I should reach instead of a job post.`
              : 'Help me write a cofounder or early-hire job post based on my profile gaps.'
          }
          action={
            search ? (
              <Button variant="secondary" onClick={() => setSearch('')}>
                <BilingualText en={jobsEn('clear_search')} el={jobsEl('clear_search')} compact />
              </Button>
            ) : activeFilters > 0 ? (
              <Button variant="secondary" onClick={() => openRailSection('filters')}>
                <BilingualText en="Show filters" el="Εμφάνιση φίλτρων" compact />
              </Button>
            ) : (
              <Button className="gap-2" onClick={() => setShowPostForm(true)}>
                <Plus className="icon-sm" />
                <BilingualText en={jobsEn('post_job')} el={jobsEl('post_job')} compact />
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-6">
          <p className="text-xs text-muted-foreground">
            <BilingualText
              en={`${filtered.length === 1 ? jobsEn('found_one') : jobsEn('found_many').replace('{n}', String(filtered.length))}${remoteJobs.length > 0 ? ` · ${jobsEn('remote_suffix').replace('{n}', String(remoteJobs.length))}` : ''}`}
              el={`${filtered.length === 1 ? jobsEl('found_one') : jobsEl('found_many').replace('{n}', String(filtered.length))}${remoteJobs.length > 0 ? ` · ${jobsEl('remote_suffix').replace('{n}', String(remoteJobs.length))}` : ''}`}
              compact
            />
          </p>

          {/* Featured strip */}
          {featuredJobs.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="icon-sm text-muted-foreground" />
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  <BilingualText en={jobsEn('featured')} el={jobsEl('featured')} compact />
                </h2>
              </div>
              {featuredJobs.map((job) => <JobCard key={job.id} job={job} featured />)}
            </section>
          )}

          {/* Remote jobs */}
          {remoteRest.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Wifi className="icon-sm text-status-success" />
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  <BilingualText en={jobsEn('remote_section')} el={jobsEl('remote_section')} compact />
                </h2>
              </div>
              {remoteRest.map((job) => <JobCard key={job.id} job={job} />)}
            </section>
          )}

          {onsiteRest.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="icon-sm text-status-info" />
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  <BilingualText en={jobsEn('onsite_section')} el={jobsEl('onsite_section')} compact />
                </h2>
              </div>
              {onsiteRest.map((job) => <JobCard key={job.id} job={job} />)}
            </section>
          )}
        </div>
      )}
      </div>
    </AppShell>
    </>
  );
}
