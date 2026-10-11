'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, BookOpen, Video, FileText, Award, Clock, TrendingUp, Play, ExternalLink, Sparkles, Flame, Bookmark, CheckCircle2, ChevronRight, Target, X, GraduationCap } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { RailAction, RailOptions, RailStats } from '@/components/layout/RailParts';
import { usePageRail } from '@/components/layout/PageRailContext';
import { Button } from '@/components/ui/button';
import { BilingualText } from '@/components/common/BilingualText';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { CardHead, CardFoot } from '@/components/common/CardAnatomy';
import { Badge } from '@/components/ui/badge';
import { FactLine } from '@/components/common/FactLine';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getMeProfile, listLearningResources, getLearningCategories, type LearningResourceItem } from '@/lib/api';
import { queryKeys, qk } from '@/lib/query-keys';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { bilingualAria } from '@/lib/i18n/format';
import { learningEn, learningEl } from '@/lib/i18n/strings-learning';
import { bilingualInline } from '@/lib/i18n/format';
import { CfbGlyph, type CfbGlyphName } from '@/components/icons/CfbGlyph';
import { useDemoData } from '@/contexts/DemoDataContext';
import { choiceControl, rowOptions, usePageControls, usePageList } from '@/lib/page-controls';

interface Resource {
  id: string;
  title: string;
  description: string;
  type: 'article' | 'video' | 'course' | 'guide';
  category: string;
  duration?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  author: string;
  authorRole: string;
  url: string;
  isFeatured?: boolean;
  tags: string[];
  completedBy?: number;
}

const SAVED_KEY = 'cfb:learning-saved';

const CATEGORIES = ['All', 'Fundraising', 'Product', 'Marketing', 'Sales', 'Leadership', 'Tech'];

const TYPE_FILTERS = [
  { key: 'all', labelKey: 'type_all' as const },
  { key: 'course', labelKey: 'type_course' as const },
  { key: 'guide', labelKey: 'type_guide' as const },
  { key: 'video', labelKey: 'type_video' as const },
  { key: 'article', labelKey: 'type_article' as const },
] as const;
type TypeFilterKey = typeof TYPE_FILTERS[number]['key'];

interface LearningPath {
  id: string;
  titleKey: 'path_fast_title' | 'path_fund_title' | 'path_growth_title' | 'path_team_title';
  descKey: 'path_fast_desc' | 'path_fund_desc' | 'path_growth_desc' | 'path_team_desc';
  category: string;
  steps: number;
  duration: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  progress: number;
  glyph: CfbGlyphName;
}

const LEARNING_PATHS: LearningPath[] = [
  { id: 'lp1', titleKey: 'path_fast_title', descKey: 'path_fast_desc', category: 'Product', steps: 8, duration: '12 hours', level: 'beginner', progress: 0, glyph: 'spark' },
  { id: 'lp2', titleKey: 'path_fund_title', descKey: 'path_fund_desc', category: 'Fundraising', steps: 6, duration: '9 hours', level: 'intermediate', progress: 33, glyph: 'wallet' },
  { id: 'lp3', titleKey: 'path_growth_title', descKey: 'path_growth_desc', category: 'Marketing', steps: 5, duration: '7 hours', level: 'intermediate', progress: 60, glyph: 'chart' },
  { id: 'lp4', titleKey: 'path_team_title', descKey: 'path_team_desc', category: 'Leadership', steps: 4, duration: '5 hours', level: 'advanced', progress: 0, glyph: 'people' },
];

const DEMO_RESOURCES: Resource[] = [
  {
    id: '1',
    title: 'The Complete Guide to Seed Fundraising',
    description: 'Everything you need to know about raising your first round. From pitch deck to term sheets.',
    type: 'guide',
    category: 'Fundraising',
    duration: '45 min read',
    difficulty: 'intermediate',
    author: 'Sarah Chen',
    authorRole: 'VC Partner',
    url: '#',
    isFeatured: true,
    tags: ['Pitch Deck', 'Term Sheets', 'VC'],
    completedBy: 1247,
  },
  {
    id: '2',
    title: 'Building Your First MVP in 30 Days',
    description: 'Step-by-step video course on validating ideas and shipping fast with no-code tools.',
    type: 'course',
    category: 'Product',
    duration: '4.5 hours',
    difficulty: 'beginner',
    author: 'Alex Kumar',
    authorRole: 'Product Lead',
    url: '#',
    isFeatured: true,
    tags: ['MVP', 'No-Code', 'Validation'],
    completedBy: 892,
  },
  {
    id: '3',
    title: 'Growth Marketing Playbook 2024',
    description: 'Latest tactics and case studies from successful B2B SaaS companies achieving product-market fit.',
    type: 'article',
    category: 'Marketing',
    duration: '20 min read',
    difficulty: 'advanced',
    author: 'Maria Santos',
    authorRole: 'Growth Lead',
    url: '#',
    tags: ['Growth', 'B2B', 'SaaS'],
    completedBy: 567,
  },
  {
    id: '4',
    title: 'Sales for Technical Founders',
    description: 'How to sell when you hate selling. Frameworks and scripts that actually work.',
    type: 'video',
    category: 'Sales',
    duration: '1.5 hours',
    difficulty: 'beginner',
    author: 'James Wilson',
    authorRole: 'Sales Coach',
    url: '#',
    tags: ['Sales', 'Founders', 'B2B'],
    completedBy: 734,
  },
  {
    id: '5',
    title: 'Building High-Performance Teams',
    description: 'Leadership principles for scaling from 5 to 50 people without losing culture.',
    type: 'course',
    category: 'Leadership',
    duration: '3 hours',
    difficulty: 'intermediate',
    author: 'David Park',
    authorRole: 'CEO',
    url: '#',
    tags: ['Leadership', 'Culture', 'Hiring'],
    completedBy: 423,
  },
  {
    id: '6',
    title: 'System Design for Startups',
    description: 'Architecture patterns that scale without over-engineering. Real-world examples.',
    type: 'guide',
    category: 'Tech',
    duration: '35 min read',
    difficulty: 'advanced',
    author: 'Lisa Zhang',
    authorRole: 'CTO',
    url: '#',
    tags: ['Architecture', 'Scaling', 'Backend'],
    completedBy: 645,
  },
];

const TYPE_CONFIG = {
  article: { labelKey: 'type_article' as const, icon: FileText },
  video:   { labelKey: 'type_video' as const,   icon: Video },
  course:  { labelKey: 'type_course' as const,  icon: BookOpen },
  guide:   { labelKey: 'type_guide' as const,   icon: Award },
};

const DIFFICULTY_CONFIG = {
  beginner: { labelKey: 'difficulty_beginner' as const, color: 'bg-status-success-bg text-status-success ' },
  intermediate: { labelKey: 'difficulty_intermediate' as const, color: 'bg-status-warning-bg text-status-warning ' },
  advanced: { labelKey: 'difficulty_advanced' as const, color: 'bg-status-danger-bg text-status-danger ' },
};

function ResourceCard({ resource, saved, onToggleSave }: { resource: Resource; saved: boolean; onToggleSave: (id: string) => void }) {
  const typeConfig = TYPE_CONFIG[resource.type] ?? TYPE_CONFIG.article;
  const difficultyConfig = DIFFICULTY_CONFIG[resource.difficulty] ?? DIFFICULTY_CONFIG.beginner;

  return (
    <Card className="flex flex-col transition-all hover:border-primary/20">
      <CardContent className="flex flex-1 flex-col gap-3">
        {/* The kind of resource is the card's mark; its title, then type and
            level as one line of facts. "Featured" is the card's one pill. */}
        <CardHead
          mark={(
            <div data-card-mark="" className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <typeConfig.icon className="icon-md" aria-hidden="true" />
            </div>
          )}
          title={<span className="line-clamp-2">{resource.title}</span>}
          // "Featured" is a fact of the resource, in the accent: as a pill
          // that wrapped under the facts its padding put the word off the
          // title's edge.
          subtitle={(
            <FactLine
              className="text-sm"
              items={[
                <BilingualText key="type" en={learningEn(typeConfig.labelKey)} el={learningEl(typeConfig.labelKey)} compact />,
                <BilingualText key="level" en={learningEn(difficultyConfig.labelKey)} el={learningEl(difficultyConfig.labelKey)} compact />,
                resource.isFeatured ? (
                  <span key="featured" className="font-medium text-primary-accessible">
                    <BilingualText en={learningEn('featured_badge')} el={learningEl('featured_badge')} compact />
                  </span>
                ) : null,
              ]}
            />
          )}
          asideStays
          aside={(
            <button
              type="button"
              onClick={() => onToggleSave(resource.id)}
              aria-pressed={saved}
              aria-label={
                saved
                  ? bilingualAria(`Saved: ${resource.title}`, `Αποθηκευμένο: ${resource.title}`)
                  : bilingualAria(`Save ${resource.title}`, `Αποθήκευση: ${resource.title}`)
              }
              // WCAG 2.5.8 wants 24x24 CSS px. The icon stays 16px; the negative margin cancels the extra 8px so nothing moves, only the hit area grows.
              // Unsaved was text-muted-foreground/40: an icon that is the whole
              // control needs 3:1 against the card (WCAG 1.4.11), and 40% of the
              // muted tone is well under it in every theme.
              className={cn(
                '-m-1 inline-flex shrink-0 tap-target items-center justify-center gap-1 rounded-md transition-colors',
                saved ? 'text-primary-accessible' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Bookmark className={cn('icon-sm', saved && 'fill-current')} aria-hidden="true" />
              <span className="hidden sm:inline text-xs"><BilingualText en={saved ? 'Saved' : 'Save'} el={saved ? 'Αποθηκεύτηκε' : 'Αποθήκευση'} compact /></span>
            </button>
          )}
        />

        <p className="card-body line-clamp-2 flex-1 text-muted-foreground first-letter:uppercase">
          {resource.description}
        </p>

        <FactLine label={bilingualAria('Topics', 'Θέματα')} items={(resource.tags ?? []).slice(0, 3)} />

        {/* Who wrote it, how long it takes and how many finished it: the
            foot's caption. The count had only a check glyph for a label, and
            glyphs outside a control are hidden, so it now says what it counts. */}
        <CardFoot
          className="mt-auto"
          meta={(
            <FactLine
              items={[
                resource.author ? <span key="author" className="font-medium text-foreground">{resource.author}</span> : null,
                resource.duration ? <span key="duration">{resource.duration}</span> : null,
                resource.completedBy ? (
                  <BilingualText
                    key="completed"
                    en={`${resource.completedBy.toLocaleString('en-GB')} completed`}
                    el={`${resource.completedBy.toLocaleString('el-GR')} ολοκλήρωσαν`}
                    compact
                  />
                ) : null,
              ]}
            />
          )}
        >
          <Button size="sm" className="gap-1" onClick={() => window.open(resource.url, '_blank')}>
            {resource.type === 'video' || resource.type === 'course' ? (
              <><Play className="icon-sm" aria-hidden="true" /><BilingualText en={learningEn('start')} el={learningEl('start')} compact /></>
            ) : (
              <><ExternalLink className="icon-sm" aria-hidden="true" /><BilingualText en={learningEn('open')} el={learningEl('open')} compact /></>
            )}
          </Button>
        </CardFoot>
      </CardContent>
    </Card>
  );
}

function LearningPathCard({ path, onSelect }: { path: LearningPath; onSelect: (category: string) => void }) {
  const level = DIFFICULTY_CONFIG[path.level] ?? DIFFICULTY_CONFIG.beginner;
  const n = String(path.steps);
  const done = String(path.progress);
  return (
    // An entity card like a resource: the path's glyph as its mark, level,
    // modules and length as facts, the way in as the foot's action. The
    // whole tile used to be one button holding a heading, tinted in a
    // status hue that meant nothing about the path.
    <Card className="flex flex-col transition-all hover:border-primary/20">
      <CardContent className="flex flex-1 flex-col gap-3">
        <CardHead
          mark={(
            <div data-card-mark="" className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <CfbGlyph name={path.glyph} className="icon-md" />
            </div>
          )}
          title={<BilingualText en={learningEn(path.titleKey)} el={learningEl(path.titleKey)} compact />}
          subtitle={(
            <FactLine
              className="text-sm"
              items={[
                <BilingualText key="level" en={learningEn(level.labelKey)} el={learningEl(level.labelKey)} compact />,
                <BilingualText key="modules" en={learningEn('modules').replace('{n}', n)} el={learningEl('modules').replace('{n}', n)} compact />,
                <span key="duration">{path.duration}</span>,
              ]}
            />
          )}
          aside={path.progress > 0 ? (
            <Badge variant="outline" className="text-xs tabular-nums">
              <BilingualText en={learningEn('percent_done').replace('{n}', done)} el={learningEl('percent_done').replace('{n}', done)} compact />
            </Badge>
          ) : undefined}
        />
        <p className="card-body line-clamp-2 flex-1 text-muted-foreground">
          <BilingualText en={learningEn(path.descKey)} el={learningEl(path.descKey)} wrap />
        </p>
        {path.progress > 0 && <Progress value={path.progress} className="h-1.5" aria-label={bilingualAria(`${done}% done`, `${done}% ολοκληρωμένο`)} />}
        <CardFoot className="mt-auto">
          <Button size="sm" variant="outline" className="gap-1" onClick={() => onSelect(path.category)}>
            {path.progress > 0
              ? <BilingualText en={learningEn('continue_path')} el={learningEl('continue_path')} compact />
              : <BilingualText en={learningEn('start_path')} el={learningEl('start_path')} compact />}
            <ChevronRight className="icon-sm" aria-hidden="true" />
          </Button>
        </CardFoot>
      </CardContent>
    </Card>
  );
}

const ROLE_CATEGORY_MAP: Record<string, string[]> = {
  founder: ['Fundraising', 'Product', 'Marketing', 'Sales', 'Leadership'],
  mentor: ['Leadership', 'Product', 'Sales'],
  investor: ['Fundraising', 'Leadership', 'Marketing'],
  org: ['Leadership', 'Marketing', 'Sales'],
};

// Map backend LearningResourceItem to local Resource shape
function backendToResource(r: LearningResourceItem): Resource {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? '',
    type: (r.type as Resource['type']) ?? 'article',
    category: r.category ?? 'General',
    duration: r.duration != null ? `${r.duration} min` : undefined,
    difficulty: (r.difficulty as Resource['difficulty']) ?? 'beginner',
    author: r.author ?? 'CoFounderBay',
    authorRole: '',
    url: r.url,
    isFeatured: r.isFeatured,
    tags: r.tags ?? [],
    completedBy: undefined,
  };
}

export default function LearningPage() {
  // Illustrative rows are for the showcase; a real account with nothing
  // to list sees the page's empty state, not invented people and records.
  const { showDemoData } = useDemoData();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'all' | 'saved' | 'completed'>('all');
  /*
   * The bookmark on each card was its own state, lost on the next render of
   * the list, and the Saved tab showed every resource regardless. There is no
   * API for learning bookmarks, so they are kept on this device: the Saved
   * tab lists what was bookmarked here, and says so.
   */
  const [savedIds, setSavedIds] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SAVED_KEY);
      if (raw) setSavedIds(JSON.parse(raw) as string[]);
    } catch {
      /* storage unavailable: bookmarks last for this visit */
    }
  }, []);
  const toggleSaved = (id: string) =>
    setSavedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [typeFilter, setTypeFilter] = useState<TypeFilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { openRailSection } = usePageRail();

  const { data: meData } = useQuery({
    queryKey: queryKeys.me.profile(),
    queryFn: getMeProfile,
    staleTime: 5 * 60_000,
  });

  // Fetch from real backend; fall back to DEMO_RESOURCES if empty (new installation)
  const { data: learningData, isLoading: learningLoading } = useQuery({
    queryKey: qk('learning', selectedCategory !== 'All' ? selectedCategory : undefined, searchQuery || undefined),
    queryFn: () => listLearningResources({
      category: selectedCategory !== 'All' ? selectedCategory : undefined,
      search: searchQuery.trim() || undefined,
      limit: 50,
    }),
    staleTime: 5 * 60_000,
  });

  const { data: categoriesData } = useQuery({
    queryKey: qk('learning', 'categories'),
    queryFn: getLearningCategories,
    staleTime: 60 * 60_000,
  });

  // Dynamic category list from backend (fallback to hardcoded CATEGORIES)
  const allCategories = categoriesData?.categories?.length
    ? ['All', ...categoriesData.categories]
    : CATEGORIES;

  // Use backend data if available, fall back to DEMO_RESOURCES
  const allResources: Resource[] = learningData?.resources?.length
    ? learningData.resources.map(backendToResource)
    : showDemoData ? DEMO_RESOURCES : [];

  const userRole = meData?.profile?.role ?? 'founder';
  const userSkills = meData?.profile?.skills?.map((s) => s.skillName.toLowerCase()) ?? [];

  const recommendedResources = allResources.filter((r) => {
    const roleCategories = ROLE_CATEGORY_MAP[userRole] ?? [];
    const matchesRole = roleCategories.includes(r.category);
    const matchesSkill = userSkills.some((skill) =>
      r.tags.some((tag) => tag.toLowerCase().includes(skill) || skill.includes(tag.toLowerCase()))
    );
    const matchesPath = selectedCategory === 'All' || r.category === selectedCategory;
    return (matchesRole || matchesSkill) && matchesPath;
  }).slice(0, 4);

  // If backend is handling filtering, skip client-side filter; otherwise apply client-side
  const filteredResources = (learningData?.resources?.length ? allResources : allResources).filter((resource) => {
    const matchesCategory = selectedCategory === 'All' || resource.category === selectedCategory;
    const matchesType = typeFilter === 'all' || resource.type === typeFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesTab = activeTab !== 'saved' || savedIds.includes(resource.id);
    return matchesCategory && matchesType && matchesSearch && matchesTab;
  });

  // Each resource appears once on the page: the same two guides used to show
  // under Recommended, again under Featured, and again in the full list.
  const recommendedShown = activeTab === 'all' ? new Set(recommendedResources.map((r) => r.id)) : new Set<string>();
  const featuredResources = filteredResources.filter((r) => r.isFeatured && !recommendedShown.has(r.id));
  const featuredShown = activeTab === 'all' ? new Set(featuredResources.map((r) => r.id)) : new Set<string>();
  const regularResources = filteredResources.filter((r) => !recommendedShown.has(r.id) && !featuredShown.has(r.id));
  const listedAbove = recommendedShown.size + featuredShown.size > 0;

  const inProgressPaths = LEARNING_PATHS.filter((p) => p.progress > 0 && p.progress < 100);
  const totalResourceCount = allResources.length;
  const courseCount = allResources.filter((r) => r.type === 'course').length;
  const totalHours = Math.round(allResources.reduce((acc, r) => {
    const match = r.duration?.match(/(\d+\.?\d*)/);
    return acc + (match ? parseFloat(match[1]) : 0);
  }, 0));

  /*
   * The column leads with the paths, what is recommended, and the library.
   * The four counts and the two chip rows (type, category) moved to the rail;
   * the search stays with the list it searches.
   */
  const activeFilters = (typeFilter !== 'all' ? 1 : 0) + (selectedCategory !== 'All' ? 1 : 0);

  // The assistant uses the same filters and bookmarks as the page. Bookmarks
  // live on this device (no API), so saving one is a view change, not a write.
  usePageControls([
    choiceControl('learning_tab', 'Learning tab', 'Καρτέλα μάθησης', [
      { value: 'all', en: 'All resources', el: 'Όλοι οι πόροι' },
      { value: 'saved', en: 'Saved on this device', el: 'Αποθηκευμένα σε αυτή τη συσκευή' },
    ], activeTab, (v) => setActiveTab(v as typeof activeTab)),
    choiceControl('category', 'Category', 'Κατηγορία', allCategories.map((c) => ({ value: c, en: c, el: c === 'All' ? 'Όλες' : c })), selectedCategory, setSelectedCategory),
    choiceControl('resource_type', 'Resource type', 'Τύπος πόρου', TYPE_FILTERS.map((tf) => ({ value: tf.key, en: learningEn(tf.labelKey), el: learningEl(tf.labelKey) })), typeFilter, (v) => setTypeFilter(v as TypeFilterKey)),
    {
      id: 'toggle_saved',
      labelEn: 'Save or unsave a resource on this device',
      labelEl: 'Αποθήκευση ή αφαίρεση πόρου σε αυτή τη συσκευή',
      writes: false,
      options: rowOptions(filteredResources, (r) => r.id, (r) => r.title),
      unavailableEn: filteredResources.length === 0 ? 'No resource is listed.' : undefined,
      unavailableEl: filteredResources.length === 0 ? 'Δεν εμφανίζεται κανένας πόρος.' : undefined,
      run: (id) => { if (id) toggleSaved(id); },
    },
    {
      id: 'clear_filters',
      labelEn: 'Clear the learning filters',
      labelEl: 'Καθαρισμός φίλτρων μάθησης',
      writes: false,
      unavailableEn: activeFilters === 0 && !searchQuery ? 'No filter is set.' : undefined,
      unavailableEl: activeFilters === 0 && !searchQuery ? 'Δεν υπάρχει φίλτρο.' : undefined,
      run: () => { setTypeFilter('all'); setSelectedCategory('All'); setSearchQuery(''); },
    },
  ]);
  usePageList([
    {
      id: 'resources',
      labelEn: 'Learning resources',
      labelEl: 'Πόροι μάθησης',
      rows: learningLoading ? undefined : filteredResources.map((r) =>
        [r.title, r.type, r.category, r.duration, savedIds.includes(r.id) ? 'saved' : ''].filter(Boolean).join(' · '),
      ),
      total: allResources.length,
      sample: !learningData?.resources?.length && showDemoData,
    },
  ]);

  const rail: PageRailSection[] = [
    {
      id: 'summary',
      glyph: 'book',
      labelEn: 'Library at a glance',
      labelEl: 'Βιβλιοθήκη με μια ματιά',
      content: (
        <RailStats
          items={[
            { key: 'resources', label: learningEn('stat_resources'), labelEl: learningEl('stat_resources'), value: totalResourceCount, icon: BookOpen, tone: 'bg-status-accent-bg text-status-accent' },
            { key: 'courses', label: learningEn('stat_courses'), labelEl: learningEl('stat_courses'), value: courseCount, icon: Play, tone: 'bg-status-success-bg text-status-success' },
            { key: 'hours', label: learningEn('stat_hours'), labelEl: learningEl('stat_hours'), value: `${totalHours}h`, icon: Clock, tone: 'bg-status-info-bg text-status-info' },
            { key: 'progress', label: learningEn('stat_progress'), labelEl: learningEl('stat_progress'), value: inProgressPaths.length, icon: Flame, tone: 'bg-status-warning-bg text-status-warning' },
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
            title="Format"
            titleEl="Μορφή"
            options={TYPE_FILTERS.map((tf) => ({ value: tf.key, en: learningEn(tf.labelKey), el: learningEl(tf.labelKey) }))}
            value={typeFilter}
            onChange={setTypeFilter}
          />
          <RailOptions
            title="Topic"
            titleEl="Θέμα"
            options={allCategories.map((c) => ({ value: c, en: c === 'All' ? 'All topics' : c, el: c === 'All' ? 'Όλα τα θέματα' : c }))}
            value={selectedCategory}
            onChange={setSelectedCategory}
          />
          {activeFilters > 0 && (
            <RailAction icon={X} en="Clear filters" el="Καθαρισμός φίλτρων" onClick={() => { setTypeFilter('all'); setSelectedCategory('All'); }} />
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
          <RailAction icon={Award} en="Open programs" el="Άνοιγμα προγραμμάτων" onClick={() => router.push('/programs')} />
          <RailAction icon={GraduationCap} en="Open mentoring" el="Άνοιγμα καταλόγου μεντόρων" onClick={() => router.push('/mentoring')} />
          <RailAction icon={Target} en="Open coaching" el="Άνοιγμα coaching" onClick={() => router.push('/coaching')} />
        </div>
      ),
    },
  ];

  return (
    <AppShell showHelp rail={rail} askAi="Which readiness gap should I study first, and which learning path or resource matches it?">
      <div className="space-y-6 pb-10">
      {/* Learning Paths */}
      {activeTab === 'all' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="icon-sm text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <BilingualText en={learningEn('paths')} el={learningEl('paths')} compact />
              </h2>
            </div>
            {/* "View all" had nothing to reveal — the grid below already
                renders every path. A count says something true in the space
                the promise was occupying. */}
            <span className="text-xs tabular-nums text-muted-foreground">
              {LEARNING_PATHS.length}{' '}
              <BilingualText en="paths" el="μονοπάτια" compact />
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            {LEARNING_PATHS.map((path) => (
              <LearningPathCard
                key={path.id}
                path={path}
                onSelect={(category) => {
                  setSelectedCategory(category);
                  setActiveTab('all');
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recommended for you */}
      {recommendedResources.length > 0 && activeTab === 'all' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="icon-sm text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <BilingualText en={learningEn('recommended')} el={learningEl('recommended')} compact />
            </h2>
            <Badge variant="secondary" className="text-2xs capitalize">{userRole}</Badge>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {recommendedResources.map((resource) => (
              <ResourceCard key={`rec-${resource.id}`} resource={resource} saved={savedIds.includes(resource.id)} onToggleSave={toggleSaved} />
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">
            <BilingualText en={learningEn('tab_all')} el={learningEl('tab_all')} compact />
          </TabsTrigger>
          <TabsTrigger value="saved">
            <BilingualText en={learningEn('tab_saved')} el={learningEl('tab_saved')} compact />
          </TabsTrigger>
          {/* Nothing records a resource as completed yet, so the tab cannot
              list any; it stays visible and says why rather than showing
              every resource under "Completed". */}
          <TabsTrigger value="completed" disabled title="Completion is not recorded yet">
            <BilingualText en={learningEn('tab_completed')} el={learningEl('tab_completed')} compact />
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {/* Search & Filters */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 icon-sm -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label={bilingualInline("Search courses, guides, topics", "Αναζήτηση μαθημάτων, οδηγών, θεμάτων")}
                placeholder={bilingualInline(learningEn('search'), learningEl('search'))}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

          </div>

          {/* Loading skeleton */}
          {learningLoading && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border p-5 space-y-3">
                  <div className="flex gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ))}
            </div>
          )}

          {/* Featured Resources */}
          {!learningLoading && featuredResources.length > 0 && activeTab === 'all' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="icon-sm text-muted-foreground" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  <BilingualText en={learningEn('featured')} el={learningEl('featured')} compact />
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {featuredResources.map((resource) => (
                  <ResourceCard key={resource.id} resource={resource} saved={savedIds.includes(resource.id)} onToggleSave={toggleSaved} />
                ))}
              </div>
            </div>
          )}

          {/* All Resources */}
          {!learningLoading && regularResources.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {listedAbove ? (
                  <BilingualText en="More resources" el="Περισσότεροι πόροι" compact />
                ) : (
                  <BilingualText en={learningEn('all_resources')} el={learningEl('all_resources')} compact />
                )}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {regularResources.map((resource) => (
                  <ResourceCard key={resource.id} resource={resource} saved={savedIds.includes(resource.id)} onToggleSave={toggleSaved} />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!learningLoading && filteredResources.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BookOpen className="h-12 w-12 mb-4 text-muted-foreground/30" />
              {activeTab === 'saved' && savedIds.length === 0 ? (
                <>
                  <p className="font-medium text-foreground">
                    <BilingualText en="Nothing saved yet" el="Δεν έχετε αποθηκεύσει τίποτα ακόμα" compact />
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    <BilingualText en="Use the bookmark on a resource to keep it here. Bookmarks are kept on this device." el="Πατήστε τον σελιδοδείκτη σε έναν πόρο για να τον κρατήσετε εδώ. Οι σελιδοδείκτες μένουν σε αυτή τη συσκευή." wrap />
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-foreground">
                    <BilingualText en={learningEn('empty')} el={learningEl('empty')} compact />
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    <BilingualText en={learningEn('empty_hint')} el={learningEl('empty_hint')} compact />
                  </p>
                  {(searchQuery.trim() !== '' || typeFilter !== 'all' || selectedCategory !== 'All') && (
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => { setSearchQuery(''); setTypeFilter('all'); setSelectedCategory('All'); }}
                      >
                        <BilingualText en="Show all resources" el="Εμφάνιση όλων των πόρων" compact />
                      </Button>
                      {(typeFilter !== 'all' || selectedCategory !== 'All') && (
                        <Button variant="ghost" size="sm" onClick={() => openRailSection('filters')}>
                          <BilingualText en="Show filters" el="Εμφάνιση φίλτρων" compact />
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
      </div>
    </AppShell>
  );
}
