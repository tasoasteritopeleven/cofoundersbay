'use client';

import { useQuery } from '@tanstack/react-query';
import type { CommitmentOutcome } from '@cofounderbay/shared';
import { OutcomeChip } from '@/components/commitments/OutcomeChip';
import { listCommitmentCards } from '@/lib/commitments-api';
import { qk } from '@/lib/query-keys';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Plus, Search, LayoutGrid, List, MoreVertical, Star, MessageSquare,
  ExternalLink, ChevronRight, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { choiceControl, rowOptions, usePageControls, usePageList } from '@/lib/page-controls';
import { BilingualText } from '@/components/common/BilingualText';
import { CfbGlyph, type CfbGlyphName } from '@/components/icons/CfbGlyph';
import { usePopupChat } from '@/contexts/PopupChatContext';
import { useToast } from '@/components/ui/toast';
import { bilingualAria } from '@/lib/i18n/format';
import {
  projectEn,
  projectEl,
  useProjectPrimaryText,
  PROJECT_STAGE_KEYS,
  PROJECT_STAGE_FULL_KEYS,
  PROJECT_ROLE_TITLE_EL,
} from '@/lib/i18n/strings-projects';
import { cn } from '@/lib/utils';
import { BUILDER_BTN } from '@/components/builder/BuilderStageChrome';
import {
  listDemoProjects,
  toggleDemoStar,
  isOwnedProject,
  isJoinedProject,
  demoProjectStats,
  PROJECT_STATUS_GLYPH,
  type DemoProject,
  type DemoRole,
  type ProjectStatus,
} from '@/lib/projects-demo';
import { FactLine } from '@/components/common/FactLine';

const STATUS_COLOR: Record<ProjectStatus, string> = {
  idea: 'bg-status-accent-bg text-status-accent border-status-accent-border',
  validating: 'bg-status-warning-bg text-status-warning border-status-warning-border',
  building: 'bg-status-info-bg text-status-info border-status-info-border',
  launched: 'bg-status-success-bg text-status-success border-status-success-border',
  scaling: 'bg-status-info-bg text-status-info border-status-info-border',
};

const STAGE_PILLS: { value: string; glyph: CfbGlyphName; labelKey: keyof typeof PROJECT_STAGE_KEYS }[] = [
  { value: 'all', glyph: 'briefcase', labelKey: 'all' },
  { value: 'idea', glyph: 'spark', labelKey: 'idea' },
  { value: 'validating', glyph: 'target', labelKey: 'validating' },
  { value: 'building', glyph: 'builder', labelKey: 'building' },
  { value: 'launched', glyph: 'award', labelKey: 'launched' },
  { value: 'scaling', glyph: 'chart', labelKey: 'scaling' },
];

type TabId = 'discover' | 'mine' | 'joined' | 'starred';

function roleLabel(role: DemoRole | string) {
  const title = typeof role === 'string' ? role : role.title;
  const el = typeof role === 'string' ? PROJECT_ROLE_TITLE_EL[title] : (role.titleEl ?? PROJECT_ROLE_TITLE_EL[title]);
  return el ? <BilingualText en={title} el={el} compact wrap /> : title;
}

function ProjectBlurb({ project, clamp }: { project: DemoProject; clamp: 'line-clamp-1' | 'line-clamp-2' }) {
  const en = project.tagline || project.description;
  const el = project.taglineEl || project.descriptionEl;
  return (
    <p className={cn('text-sm text-muted-foreground', clamp)}>
      {el ? <BilingualText en={en} el={el} compact={clamp === 'line-clamp-1'} wrap={clamp === 'line-clamp-2'} /> : en}
    </p>
  );
}

function StageBadge({ status }: { status: ProjectStatus }) {
  const key = PROJECT_STAGE_FULL_KEYS[status];
  return (
    <Badge variant="outline" className={cn('gap-1 rounded-full text-2xs', STATUS_COLOR[status])}>
      <CfbGlyph name={PROJECT_STATUS_GLYPH[status]} className="icon-sm" />
      {key ? <BilingualText en={projectEn(key)} el={projectEl(key)} compact /> : status}
    </Badge>
  );
}

function ProjectCard({
  project,
  viewMode,
  outcome,
  onStar,
  onMessage,
  onShare,
}: {
  project: DemoProject;
  viewMode: 'grid' | 'list';
  /** The outcome of the project's need card, when it has one. */
  outcome?: { outcome: CommitmentOutcome; reason: string | null };
  onStar: (id: string) => void;
  onMessage: (project: DemoProject) => void;
  onShare: (project: DemoProject) => void;
}) {
  if (viewMode === 'list') {
    return (
      <Card className="rounded-xl border-border transition-colors hover:border-primary/30">
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <Link href={`/projects/${project.id}`} className="page-section person-name inline-flex tap-target-y items-center font-semibold leading-snug text-foreground transition-colors hover:text-primary-accessible">
                  {project.name}
                </Link>
                <StageBadge status={project.status} />
                {outcome ? <OutcomeChip outcome={outcome.outcome} reason={outcome.reason} /> : null}
                {project.isStarred && <Star className="icon-sm fill-status-warning text-status-warning" />}
              </div>
              <ProjectBlurb project={project} clamp="line-clamp-1" />
            </div>
            <div className="flex shrink-0 items-center gap-6">
              <div className="flex -space-x-2">
                {project.members.slice(0, 3).map((m) => (
                  <Avatar key={m.id} className="h-8 w-8 border-2 border-background">
                    <AvatarImage src={m.avatar} />
                    <AvatarFallback className="bg-primary/10 text-xs text-primary-accessible">
                      {m.name[0]}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{project.teamSize}</span>/{project.maxTeamSize}
              </div>
              <FactLine className="max-w-[200px]" items={project.rolesNeeded.slice(0, 2).map((role) => roleLabel(role))} />
              <Button variant="outline" size="sm" className={BUILDER_BTN} asChild>
                <Link href={`/projects/${project.id}`}>
                  <BilingualText en={projectEn('view')} el={projectEl('view')} compact />
                  <ChevronRight className="icon-sm ml-1" />
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="group flex min-w-0 flex-col rounded-xl border-0">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <Link href={`/projects/${project.id}`} className="page-section person-name inline-flex tap-target-y items-center font-semibold leading-snug text-foreground transition-colors hover:text-primary-accessible">
                  {project.name}
                </Link>
              {project.isStarred && <Star className="icon-sm fill-status-warning text-status-warning" />}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <StageBadge status={project.status} />
              {outcome ? <OutcomeChip outcome={outcome.outcome} reason={outcome.reason} /> : null}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
                aria-label={bilingualAria(projectEn('more'), projectEl('more'))}
              >
                <MoreVertical className="icon-sm" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem onClick={() => onStar(project.id)}>
                <Star className="icon-sm mr-2" />
                <BilingualText
                  en={project.isStarred ? projectEn('unstar') : projectEn('star')}
                  el={project.isStarred ? projectEl('unstar') : projectEl('star')}
                  compact
                />
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMessage(project)}>
                <MessageSquare className="icon-sm mr-2" />
                <BilingualText en={projectEn('message_team')} el={projectEl('message_team')} compact />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onShare(project)}>
                <ExternalLink className="icon-sm mr-2" />
                <BilingualText en={projectEn('share')} el={projectEl('share')} compact />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-1 flex-col gap-3">
        <ProjectBlurb project={project} clamp="line-clamp-2" />

        <FactLine items={project.tags.slice(0, 4)} />

        {project.progress !== undefined && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-2xs">
              <span className="text-muted-foreground">
                <BilingualText en={projectEn('progress')} el={projectEl('progress')} compact />
              </span>
              <span className="font-medium tabular-nums">{project.progress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${project.progress}%` }} />
            </div>
          </div>
        )}

        <div className="border-t border-border pt-2">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CfbGlyph name="people" className="icon-sm" />
              <span>
                <span className="font-medium text-foreground">{project.teamSize}</span>/{project.maxTeamSize}{' '}
                <BilingualText en={projectEn('members')} el={projectEl('members')} compact />
              </span>
            </div>
            {(project.messageCount ?? 0) > 0 && (
              <div className="flex items-center gap-1 text-2xs text-muted-foreground">
                <CfbGlyph name="messages" className="icon-sm" />
                {project.messageCount}
              </div>
            )}
          </div>

          <div className="mb-3 flex -space-x-2">
            {project.members.slice(0, 4).map((m) => (
              <Avatar key={m.id} className="h-8 w-8 border-2 border-background">
                <AvatarImage src={m.avatar} />
                <AvatarFallback className="bg-primary/10 text-xs text-primary-accessible">
                  {m.name[0]}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>

          {project.rolesNeeded.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-2xs font-medium text-muted-foreground">
                <BilingualText en={projectEn('looking_for')} el={projectEl('looking_for')} compact />
              </p>
              {/* The roles are what the card is looking for: body text under
                  their caption, not accent pills. */}
              <FactLine className="text-sm text-foreground" items={project.rolesNeeded.map((role) => roleLabel(role))} />
            </div>
          )}
        </div>

        <Button variant="secondary" size="sm" className={`mt-auto max-w-full self-start ${BUILDER_BTN}`} asChild>
          <Link href={`/projects/${project.id}`}>
            <BilingualText en={projectEn('view_project')} el={projectEl('view_project')} compact wrap />
            <ChevronRight className="icon-sm ml-1 shrink-0" aria-hidden="true" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  glyph,
  titleEn,
  titleEl,
  hintEn,
  hintEl,
  action,
}: {
  glyph: CfbGlyphName;
  titleEn: string;
  titleEl: string;
  hintEn: string;
  hintEl: string;
  action: React.ReactNode;
}) {
  return (
    <Card className="rounded-xl border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <CfbGlyph name={glyph} className="mb-4 icon-lg text-muted-foreground/50" />
        <h3 className="page-section mb-1 font-semibold text-foreground">
          <BilingualText en={titleEn} el={titleEl} />
        </h3>
        <p className="mb-4 max-w-sm text-sm text-muted-foreground">
          <BilingualText en={hintEn} el={hintEl} />
        </p>
        {action}
      </CardContent>
    </Card>
  );
}

export default function ProjectsPage() {
  const t = useProjectPrimaryText();
  const { open: openAskAi } = usePopupChat();
  const { success } = useToast();
  const [projects, setProjects] = useState(listDemoProjects);
  // Each project's need card outcome, beside its stage: open, in discussion,
  // agreed or closed. One read for every project on the page.
  const projectRefs = useMemo(() => projects.map((p) => p.id), [projects]);
  const needsQ = useQuery({
    queryKey: qk('commitments', 'cards', 'projects', projectRefs.join(',')),
    queryFn: () => listCommitmentCards({ projectRefs }),
    enabled: projectRefs.length > 0,
  });
  const needOutcomes = useMemo(() => {
    const map = new Map<string, { outcome: CommitmentOutcome; reason: string | null }>();
    for (const card of needsQ.data ?? []) {
      if (!card.projectRef) continue;
      const current = map.get(card.projectRef);
      // A live card speaks for the project over a closed one.
      if (!current || (current.outcome === 'closed' && card.outcome !== 'closed')) {
        map.set(card.projectRef, { outcome: card.outcome, reason: card.closedReason });
      }
    }
    return map;
  }, [needsQ.data]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [industryFilter, setIndustryFilter] = useState<string>('all');
  const [tab, setTab] = useState<TabId>('discover');

  const stats = demoProjectStats(projects);
  const industries = [...new Set(projects.map((p) => p.industry))];
  const hasActiveFilters = searchQuery.trim().length > 0 || statusFilter !== 'all' || industryFilter !== 'all';

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const hay = [
          p.name,
          p.tagline,
          p.taglineEl ?? '',
          p.description,
          p.descriptionEl ?? '',
          p.industry,
          p.location,
          p.status,
          p.stage,
          p.founder.name,
          p.members.map((m) => `${m.name} ${m.role} ${m.roleEl ?? ''}`).join(' '),
          p.tags.join(' '),
          p.rolesNeeded.map((r) => `${r.title} ${r.titleEl ?? ''} ${r.description} ${r.descriptionEl ?? ''}`).join(' '),
          p.milestones.map((m) => `${m.title} ${m.titleEl ?? ''}`).join(' '),
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (industryFilter !== 'all' && p.industry !== industryFilter) return false;
      return true;
    });
  }, [projects, searchQuery, statusFilter, industryFilter]);

  const byTab: Record<TabId, DemoProject[]> = {
    discover: filtered,
    mine: filtered.filter((p) => isOwnedProject(p)),
    joined: filtered.filter((p) => isJoinedProject(p)),
    starred: filtered.filter((p) => p.isStarred),
  };

  const counts = {
    discover: projects.length,
    mine: projects.filter((p) => isOwnedProject(p)).length,
    joined: projects.filter((p) => isJoinedProject(p)).length,
    starred: projects.filter((p) => p.isStarred).length,
  };

  function refresh() {
    setProjects(listDemoProjects());
  }

  function handleStar(id: string) {
    toggleDemoStar(id);
    refresh();
  }

  function handleShare(project: DemoProject) {
    const url = `${window.location.origin}/projects/${project.id}`;
    void navigator.clipboard?.writeText(url).catch(() => undefined);
    success('Link copied', 'Anyone with the link can open this project.');
  }

  function clearFilters() {
    setSearchQuery('');
    setStatusFilter('all');
    setIndustryFilter('all');
  }

  function renderList(items: DemoProject[], empty: { glyph: CfbGlyphName; title: 'empty_discover_title' | 'empty_mine_title' | 'empty_joined_title' | 'empty_starred_title'; hint: 'empty_discover_hint' | 'empty_mine_hint' | 'empty_joined_hint' | 'empty_starred_hint'; action: React.ReactNode }) {
    if (items.length === 0) {
      const filteredEmpty = hasActiveFilters;
      return (
        <EmptyState
          glyph={empty.glyph}
          titleEn={projectEn(filteredEmpty ? 'empty_filter_title' : empty.title)}
          titleEl={projectEl(filteredEmpty ? 'empty_filter_title' : empty.title)}
          hintEn={projectEn(filteredEmpty ? 'empty_filter_hint' : empty.hint)}
          hintEl={projectEl(filteredEmpty ? 'empty_filter_hint' : empty.hint)}
          action={
            filteredEmpty ? (
              <Button variant="outline" size="sm" className={BUILDER_BTN} onClick={clearFilters}>
                <BilingualText en={projectEn('clear_filters')} el={projectEl('clear_filters')} compact />
              </Button>
            ) : (
              empty.action
            )
          }
        />
      );
    }
    return (
      <div className={cn(viewMode === 'grid' ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-3')}>
        {items.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            viewMode={viewMode}
            outcome={needOutcomes.get(project.id)}
            onStar={handleStar}
            onMessage={(p) => openAskAi(p.founder.id, 'messages')}
            onShare={handleShare}
          />
        ))}
      </div>
    );
  }

  const createCta = (
    <Button size="sm" className={BUILDER_BTN} asChild>
      <Link href="/projects/create">
        <Plus className="icon-sm mr-1.5" />
        <BilingualText en={projectEn('create')} el={projectEl('create')} compact />
      </Link>
    </Button>
  );

  // Offered to the assistant: stage, industry and layout, through the same
  // setters as the pills, the rail and the view switch.
  usePageControls([
    choiceControl('stage_filter', 'Project stage filter', 'Φίλτρο σταδίου έργου', STAGE_PILLS.map((p) => ({ value: p.value, en: projectEn(PROJECT_STAGE_KEYS[p.labelKey]), el: projectEl(PROJECT_STAGE_KEYS[p.labelKey]) })), statusFilter, setStatusFilter),
    choiceControl('industry_filter', 'Industry filter', 'Φίλτρο κλάδου', [{ value: 'all', en: 'All industries', el: 'Όλοι οι κλάδοι' }, ...industries.map((i) => ({ value: i, en: i, el: i }))], industryFilter, setIndustryFilter),
    choiceControl('view', 'Project layout', 'Διάταξη έργων', [
      { value: 'grid', en: 'Grid', el: 'Πλέγμα' },
      { value: 'list', en: 'List', el: 'Λίστα' },
    ], viewMode, (v) => setViewMode(v as 'grid' | 'list')),
    choiceControl('tab', 'Projects tab', 'Καρτέλα έργων', (['discover', 'mine', 'joined', 'starred'] as const).map((id) => ({ value: id, en: projectEn(`tab_${id}`), el: projectEl(`tab_${id}`) })), tab, (v) => setTab(v as TabId)),
    // The card menu's own actions over the projects on this tab.
    // toggleDemoStar flips one flag on the project kept in this browser.
    { id: 'star_project', labelEn: 'Star project', labelEl: 'Αστέρι σε έργο', writes: true, options: rowOptions(byTab[tab].filter((p) => !p.isStarred), (p) => p.id, (p) => p.name), undo: (v) => ({ control: 'unstar_project', value: v }), run: (v) => { if (v) handleStar(v); } },
    { id: 'unstar_project', labelEn: 'Unstar project', labelEl: 'Αφαίρεση αστεριού από έργο', writes: true, options: rowOptions(byTab[tab].filter((p) => p.isStarred), (p) => p.id, (p) => p.name), undo: (v) => ({ control: 'star_project', value: v }), run: (v) => { if (v) handleStar(v); } },
    { id: 'share_project', labelEn: 'Copy a link to project', labelEl: 'Αντιγραφή συνδέσμου έργου', writes: false, options: rowOptions(byTab[tab], (p) => p.id, (p) => p.name), run: (v) => { const p = projects.find((row) => row.id === v); if (p) handleShare(p); } },
  ]);
  usePageList([
    {
      id: 'projects',
      labelEn: 'Projects',
      labelEl: 'Έργα',
      rows: byTab[tab].map((p) =>
        `${p.name} · ${p.industry}, ${p.stage} · ${p.status} · team ${p.teamSize}/${p.maxTeamSize}${p.rolesNeeded.length ? ` · needs ${p.rolesNeeded.map((r) => r.title).join(', ')}` : ''}${p.isStarred ? ' · starred' : ''}`,
      ),
      total: counts[tab],
      sample: true,
    },
  ]);

  const rail: PageRailSection[] = [
    {
      id: 'overview',
      glyph: 'chart',
      labelEn: 'Project stats',
      labelEl: 'Στατιστικά έργων',
      content: (
        <div className="space-y-2">
          {[
            { labelKey: 'stat_total' as const, value: stats.total, glyph: 'briefcase' as const, color: 'text-status-accent', bg: 'bg-status-accent-bg' },
            { labelKey: 'stat_active' as const, value: stats.active, glyph: 'builder' as const, color: 'text-status-info', bg: 'bg-status-info-bg' },
            { labelKey: 'stat_roles' as const, value: stats.openRoles, glyph: 'people' as const, color: 'text-status-success', bg: 'bg-status-success-bg' },
            { labelKey: 'stat_industries' as const, value: stats.industries, glyph: 'chart' as const, color: 'text-status-warning', bg: 'bg-status-warning-bg' },
          ].map((s) => (
            <div key={s.labelKey} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', s.bg, s.color)}>
                <CfbGlyph name={s.glyph} className="icon-sm" />
              </div>
              <div className="min-w-0">
                <p className="page-stat text-base font-bold leading-none text-foreground tabular-nums">{s.value}</p>
                <p className="page-stat-label mt-0.5 text-2xs leading-snug text-muted-foreground">
                  <BilingualText en={projectEn(s.labelKey)} el={projectEl(s.labelKey)} compact wrap />
                </p>
              </div>
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
      badge: industryFilter !== 'all' ? 1 : null,
      content: (
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              <BilingualText en={projectEn('industry')} el={projectEl('industry')} compact />
            </p>
            <Select value={industryFilter} onValueChange={setIndustryFilter}>
              <SelectTrigger aria-label={t(projectEn('industry'), projectEl('industry'))} className="w-full rounded-xl">
                <SelectValue placeholder={t(projectEn('industry'), projectEl('industry'))} />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">{t(projectEn('all_industries'), projectEl('all_industries'))}</SelectItem>
                {industries.map((ind) => (
                  <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted/70"
            >
              <X className="icon-sm shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1"><BilingualText en={projectEn('clear_filters')} el={projectEl('clear_filters')} compact wrap /></span>
            </button>
          )}
        </div>
      ),
    },
    {
      id: 'view',
      glyph: 'compare',
      labelEn: 'Layout',
      labelEl: 'Διάταξη',
      content: (
        <div className="flex rounded-xl border border-border p-0.5">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            className="flex-1 rounded-xl"
            type="button"
            onClick={() => setViewMode('grid')}
            aria-label={bilingualAria(projectEn('view_grid'), projectEl('view_grid'))}
            aria-pressed={viewMode === 'grid'}
          >
            <LayoutGrid className="icon-sm" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className="flex-1 rounded-xl"
            type="button"
            onClick={() => setViewMode('list')}
            aria-label={bilingualAria(projectEn('view_list'), projectEl('view_list'))}
            aria-pressed={viewMode === 'list'}
          >
            <List className="icon-sm" />
          </Button>
        </div>
      ),
    },
    {
      id: 'related',
      glyph: 'flag',
      labelEn: 'Linked pages',
      labelEl: 'Συνδεδεμένες σελίδες',
      content: (
        <div className="grid grid-cols-1 min-w-0 gap-2">
          {([
            { href: '/builder?tab=idea-core', title: 'link_idea' },
            { href: '/milestones', title: 'link_milestones' },
            { href: '/research', title: 'link_research' },
            { href: '/fundraising', title: 'link_fundraising' },
            { href: '/matches', title: 'link_matches' },
          ] as const).map((step) => (
            <Button key={step.href} asChild variant="outline" className="h-auto min-h-11 justify-start gap-3 whitespace-normal px-3 py-2.5 text-left">
              <Link href={step.href}>
                <span className="min-w-0 flex-1 text-sm font-medium leading-snug">
                  <BilingualText en={projectEn(step.title)} el={projectEl(step.title)} wrap />
                </span>
                <ChevronRight className="icon-sm shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </Button>
          ))}
        </div>
      ),
    },
  ];

  const harborLive = projects.some((p) => p.name === 'Harbor' || p.id === '1');
  const askAi = harborLive
    ? 'Propose which Harbor project to join or start from Idea Core, the GTM board, the complementary-cofounder role, and the $750K seed (Athens Tech Angels, $375K committed).'
    : 'Help me pick a project from Builder artefacts and matches.';

  return (
    <AppShell
      showHelp
      rail={rail}
      askAi={askAi}
      contentClassName="builder-copy overflow-x-clip"
      actions={createCta}
    >
      <div className="space-y-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="space-y-4">
          <TabsList className="rounded-xl">
            {([
              { id: 'discover', key: 'tab_discover', count: counts.discover },
              { id: 'mine', key: 'tab_mine', count: counts.mine },
              { id: 'joined', key: 'tab_joined', count: counts.joined },
              { id: 'starred', key: 'tab_starred', count: counts.starred },
            ] as const).map((item) => (
              <TabsTrigger key={item.id} value={item.id} className="rounded-xl gap-1.5">
                <BilingualText en={projectEn(item.key)} el={projectEl(item.key)} compact />
                <span className="tabular-nums text-2xs text-muted-foreground">{item.count}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="icon-sm absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t(projectEn('search_ph'), projectEl('search_ph'))}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-xl pl-9"
                aria-label={bilingualAria(projectEn('search_ph'), projectEl('search_ph'))}
              />
              {searchQuery && (
                <button aria-label="Clear search" type="button" onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="icon-sm" />
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {STAGE_PILLS.map((pill) => {
              const isActive = statusFilter === pill.value;
              const labelKey = PROJECT_STAGE_KEYS[pill.labelKey];
              return (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => setStatusFilter(pill.value)}
                  aria-pressed={isActive}
                  className={cn(
                    'tap-target-phone inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 font-semibold text-primary-accessible'
                      : 'bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                  )}
                >
                  <CfbGlyph name={pill.glyph} className="icon-sm" />
                  {labelKey ? <BilingualText en={projectEn(labelKey)} el={projectEl(labelKey)} compact /> : pill.value}
                </button>
              );
            })}
          </div>

          {byTab[tab].length > 0 && (
            <p className="text-2xs text-muted-foreground">
              {byTab[tab].length === 1
                ? <BilingualText en={`1 ${projectEn('found_one')}`} el={`1 ${projectEl('found_one')}`} compact />
                : (
                  <BilingualText
                    en={`${byTab[tab].length} ${projectEn('found')}`}
                    el={`${byTab[tab].length} ${projectEl('found')}`}
                    compact
                  />
                )}
            </p>
          )}

          <TabsContent value="discover" className="space-y-4">
            {renderList(byTab.discover, {
              glyph: 'briefcase',
              title: 'empty_discover_title',
              hint: 'empty_discover_hint',
              action: createCta,
            })}
          </TabsContent>
          <TabsContent value="mine" className="space-y-4">
            {renderList(byTab.mine, {
              glyph: 'briefcase',
              title: 'empty_mine_title',
              hint: 'empty_mine_hint',
              action: createCta,
            })}
          </TabsContent>
          <TabsContent value="joined" className="space-y-4">
            {renderList(byTab.joined, {
              glyph: 'people',
              title: 'empty_joined_title',
              hint: 'empty_joined_hint',
              action: (
                <Button variant="outline" size="sm" className={BUILDER_BTN} onClick={() => setTab('discover')}>
                  <BilingualText en={projectEn('browse')} el={projectEl('browse')} compact />
                </Button>
              ),
            })}
          </TabsContent>
          <TabsContent value="starred" className="space-y-4">
            {renderList(byTab.starred, {
              glyph: 'bookmark',
              title: 'empty_starred_title',
              hint: 'empty_starred_hint',
              action: (
                <Button variant="outline" size="sm" className={BUILDER_BTN} onClick={() => setTab('discover')}>
                  <BilingualText en={projectEn('browse')} el={projectEl('browse')} compact />
                </Button>
              ),
            })}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
