'use client';

import { StatusText } from '@/components/common/StatusText';
import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useDemoData } from '@/contexts/DemoDataContext';
import {
  ArrowUpDown,
  Compass,
  DollarSign,
  Eye,
  Filter,
  Flame,
  GanttChart,
  GitCompare,
  Globe,
  LayoutGrid,
  List,
  MapPin,
  MessageCircle,
  MoreVertical,
  Rocket,
  Search,
  SlidersHorizontal,
  Star,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useToast } from '@/components/ui/toast';
import {
  createInvestorDeal,
  deleteInvestorDeal,
  listInvestorDeals,
  updateInvestorDeal,
} from '@/lib/api';
import { UnavailableMenuItem } from '@/components/common/UnavailableMenuItem';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
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
import { cn } from '@/lib/utils';
import { qk } from '@/lib/query-keys';
import { choiceControl, ROW_GONE, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualAria, bilingualInline } from '@/lib/i18n/format';

type Startup = {
  id: string;
  name: string;
  logoUrl?: string;
  tagline: string;
  industry: string;
  stage: string;
  location: string;
  teamSize: number;
  readinessScore: number;
  matchScore: number;
  tags: string[];
  raisingAmount: string;
  businessModel: 'B2B' | 'B2C' | 'B2B2C' | 'Marketplace';
  isHot: boolean;
  isFeatured: boolean;
  revenue: string;
};

/** The deal a scouted startup becomes - one shape for the card and the assistant. */
function startupDeal(startup: Startup, pipelineStage?: 'reviewing') {
  return {
    name: startup.name,
    tagline: startup.tagline,
    industry: startup.industry,
    location: startup.location,
    companyStage: startup.stage,
    teamSize: startup.teamSize,
    tags: startup.tags,
    ...(pipelineStage ? { pipelineStage } : {}),
  };
}

function StartupCard({ startup, compact = false }: { startup: Startup; compact?: boolean }) {
  /*
   * Watching used to be `useState(false)` on the card: the eye filled in, and
   * nothing anywhere else knew. It writes a deal at `discovered` now, which is
   * the same row the watchlist lists, the pipeline board groups and — once it
   * reaches `invested` — the portfolio totals. Scouting is the front door of
   * that loop, so this is the step that made the loop exist.
   */
  const qc = useQueryClient();
  const { success, error: showError } = useToast();

  const { data: watched } = useQuery({
    queryKey: qk('investor', 'deals', 'discovered'),
    queryFn: () => listInvestorDeals({ pipelineStage: 'discovered', limit: 100 }),
    staleTime: 60_000,
    retry: 0,
  });

  const existing = watched?.deals.find((deal) => deal.name === startup.name);
  const inWatchlist = Boolean(existing);
  const [pending, setPending] = useState(false);

  const toggle = useMutation({
    mutationFn: async () => {
      if (existing) {
        await deleteInvestorDeal(existing.id);
        return false;
      }
      await createInvestorDeal(startupDeal(startup));
      return true;
    },
    onMutate: () => setPending(true),
    onSettled: () => setPending(false),
    onSuccess: (added) => {
      void qc.invalidateQueries({ queryKey: qk('investor') });
      success(added ? 'Added to your watchlist' : 'Removed from your watchlist');
    },
    onError: (err) =>
      showError('Could not update the watchlist', err instanceof Error ? err.message : undefined),
  });

  const setInWatchlist = () => {
    if (pending) return;
    toggle.mutate();
  };

  // "Add to Pipeline" had no handler. It is the watchlist add with the deal
  // placed at Reviewing - or, when the startup is already watched, that
  // deal moved to Reviewing.
  const addToPipeline = useMutation({
    mutationFn: async () => {
      if (existing) {
        await updateInvestorDeal(existing.id, { pipelineStage: 'reviewing' });
        return;
      }
      await createInvestorDeal(startupDeal(startup, 'reviewing'));
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk('investor') });
      success('Added to your pipeline', `${startup.name} is in Reviewing.`);
    },
    onError: (err) => showError('Could not add to the pipeline', err instanceof Error ? err.message : undefined),
  });

  return (
    <Card className={cn('transition-all hover:border-primary/30', startup.isFeatured && 'border-primary/40 bg-primary/2')}>
      <CardContent>
        <div className="flex gap-4">
          <Avatar className="h-11 w-11 rounded-lg shrink-0">
            <AvatarImage src={startup.logoUrl} />
            <AvatarFallback className="rounded-xl bg-primary/10 text-primary-accessible font-semibold text-sm">
              {startup.name[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/startups/${startup.id}`} className="font-semibold hover:text-primary-accessible transition-colors">
                    {startup.name}
                  </Link>
                  {startup.isHot && <Badge variant="destructive" className="text-2xs h-4 gap-0.5 px-1.5"><Flame className="h-2.5 w-2.5" aria-hidden="true" /><BilingualText en="Hot" el="Δημοφιλές" compact /></Badge>}
                  {startup.isFeatured && <Badge className="text-2xs h-4 px-1.5 bg-primary/10 text-primary-accessible border-primary/30"><BilingualText en="Featured" el="Προτεινόμενο" compact /></Badge>}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{startup.tagline}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7 gap-1 sm:w-auto sm:px-2" onClick={() => setInWatchlist()} title={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'} aria-label={inWatchlist ? `Remove ${startup.name} from watchlist` : `Add ${startup.name} to watchlist`} aria-pressed={inWatchlist}>
                  <Eye className={cn('icon-sm', inWatchlist ? 'text-primary-accessible fill-primary/20' : 'text-muted-foreground')} />
                  <span className="hidden sm:inline text-xs"><BilingualText en={inWatchlist ? 'Watching' : 'Watch'} el={inWatchlist ? 'Σε παρακολούθηση' : 'Παρακολούθηση'} compact /></span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`More actions for ${startup.name}`}>
                      <MoreVertical className="icon-sm" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      {/* A startup already on the board opens its deal. */}
                      <Link href={`/startups/${existing?.id ?? startup.id}`}><Eye className="mr-2 icon-sm" aria-hidden="true" /><BilingualText en="View Details" el="Λεπτομέρειες" compact /></Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={addToPipeline.isPending} onSelect={() => addToPipeline.mutate()}>
                      <GanttChart className="mr-2 icon-sm" aria-hidden="true" /><BilingualText en="Add to Pipeline" el="Προσθήκη στο pipeline" compact />
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setInWatchlist()}>
                      <Eye className="mr-2 icon-sm" />{inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <UnavailableMenuItem
                      icon={<MessageCircle className="mr-2 mt-0.5 icon-sm" aria-hidden="true" />}
                      en="Request Intro"
                      el="Αίτημα γνωριμίας"
                      reasonEn="Scouted startups are not linked to founder accounts yet."
                      reasonEl="Οι startups της αναζήτησης δεν συνδέονται ακόμη με λογαριασμούς ιδρυτών."
                    />
                    <UnavailableMenuItem
                      icon={<GitCompare className="mr-2 mt-0.5 icon-sm" aria-hidden="true" />}
                      en="Compare"
                      el="Σύγκριση"
                      reasonEn="Startup comparison is not built yet."
                      reasonEl="Η σύγκριση startups δεν υπάρχει ακόμη."
                    />
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 mt-2">
              <Badge variant="outline" className="text-2xs h-4 px-1.5"><StatusText value={startup.stage} /></Badge>
              <Badge variant="secondary" className="text-2xs h-4 px-1.5">{startup.businessModel}</Badge>
              {startup.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-2xs h-4 px-1.5">{tag}</Badge>
              ))}
            </div>

            <div className="flex flex-wrap gap-4 mt-2.5 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><MapPin className="icon-sm" />{startup.location}</span>
              <span className="flex items-center gap-1"><Users className="icon-sm" />{startup.teamSize} founders</span>
              <span className="flex items-center gap-1 font-medium text-primary-accessible"><DollarSign className="icon-sm" />Raising {startup.raisingAmount}</span>
              {startup.revenue !== 'Pre-revenue' && (
                <span className="flex items-center gap-1 text-status-success"><TrendingUp className="icon-sm" />{startup.revenue}</span>
              )}
            </div>

            <div className="flex items-center gap-4 mt-3">
              <div className="flex-1">
                <div className="flex items-center justify-between text-2xs mb-1">
                  <span className="text-muted-foreground"><BilingualText en="Readiness" el="Ετοιμότητα" compact /></span>
                  <span className="font-medium">{startup.readinessScore}%</span>
                </div>
                <Progress value={startup.readinessScore} className="h-1.5" />
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xs text-muted-foreground"><BilingualText en="Match Score" el="Βαθμός ταιριάσματος" compact /></p>
                <p className={cn('text-sm font-semibold', startup.matchScore >= 85 ? 'text-status-success' : startup.matchScore >= 70 ? 'text-primary-accessible' : 'text-muted-foreground')}>
                  {startup.matchScore}%
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border">
              <Button size="sm" variant="default" className="h-7 text-xs flex-1" asChild>
                <Link href={`/startups/${startup.id}`}><Eye className="mr-1 icon-sm" /><BilingualText en="View" el="Προβολή" compact /></Link>
              </Button>
              {/* Both had no handler: Pipeline is the menu's Add to Pipeline,
                  and Intro has no founder account to reach yet. */}
              <Button size="sm" variant="outline" className="h-7 text-xs flex-1" disabled={addToPipeline.isPending} onClick={() => addToPipeline.mutate()}>
                <GanttChart className="mr-1 icon-sm" aria-hidden="true" /><BilingualText en="Pipeline" el="Pipeline" compact />
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs flex-1" disabled title="Scouted startups are not linked to founder accounts yet">
                <MessageCircle className="mr-1 icon-sm" aria-hidden="true" /><BilingualText en="Intro" el="Γνωριμία" compact />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const ALL_STARTUPS: Startup[] = [
  { id: '1', name: 'NeuralFlow AI', tagline: 'AI-powered workflow automation for enterprises', industry: 'AI/ML', stage: 'Seed', location: 'San Francisco', teamSize: 3, readinessScore: 85, matchScore: 92, tags: ['SaaS', 'Automation'], raisingAmount: '$1.5M', businessModel: 'B2B', isHot: true, isFeatured: true, revenue: '$24K MRR' },
  { id: '2', name: 'GreenGrid Energy', tagline: 'Smart grid solutions for renewable energy', industry: 'CleanTech', stage: 'Pre-seed', location: 'Berlin', teamSize: 2, readinessScore: 72, matchScore: 78, tags: ['Energy', 'IoT'], raisingAmount: '$500K', businessModel: 'B2B', isHot: false, isFeatured: false, revenue: 'Pre-revenue' },
  { id: '3', name: 'PayStream', tagline: 'Next-gen payment infrastructure for SMBs', industry: 'FinTech', stage: 'Seed', location: 'London', teamSize: 4, readinessScore: 91, matchScore: 88, tags: ['Payments', 'API'], raisingAmount: '$2M', businessModel: 'B2B', isHot: true, isFeatured: true, revenue: '$58K MRR' },
  { id: '4', name: 'HealthPulse', tagline: 'Remote patient monitoring platform', industry: 'HealthTech', stage: 'Pre-seed', location: 'Boston', teamSize: 2, readinessScore: 65, matchScore: 71, tags: ['IoT', 'Clinical'], raisingAmount: '$750K', businessModel: 'B2B2C', isHot: false, isFeatured: false, revenue: 'Pre-revenue' },
  { id: '5', name: 'DataVault', tagline: 'Enterprise data security and compliance', industry: 'Cybersecurity', stage: 'Seed', location: 'New York', teamSize: 5, readinessScore: 78, matchScore: 85, tags: ['Security', 'Enterprise'], raisingAmount: '$3M', businessModel: 'B2B', isHot: false, isFeatured: false, revenue: '$12K MRR' },
  { id: '6', name: 'EduTrack', tagline: 'Adaptive learning for K-12 institutions', industry: 'EdTech', stage: 'Pre-seed', location: 'Toronto', teamSize: 3, readinessScore: 69, matchScore: 74, tags: ['Education', 'AI'], raisingAmount: '$600K', businessModel: 'B2B', isHot: false, isFeatured: false, revenue: 'Pre-revenue' },
  { id: '7', name: 'LogiChain', tagline: 'Supply chain visibility for e-commerce', industry: 'Logistics', stage: 'Series A', location: 'Singapore', teamSize: 8, readinessScore: 93, matchScore: 80, tags: ['Logistics', 'Analytics'], raisingAmount: '$5M', businessModel: 'B2B', isHot: true, isFeatured: false, revenue: '$210K MRR' },
];

export default function InvestorScoutingPage() {
  const { showDemoData } = useDemoData();
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('all');
  const [stage, setStage] = useState('all');
  const [model, setModel] = useState('all');
  const [sortBy, setSortBy] = useState('match');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const startups = showDemoData ? ALL_STARTUPS : [];
  const industries = useMemo(() => ['all', ...new Set(startups.map(s => s.industry))], [startups]);
  const stages = useMemo(() => ['all', ...new Set(startups.map(s => s.stage))], [startups]);

  const filtered = useMemo(() => {
    let list = startups.filter(s => {
      const q = search.toLowerCase();
      return (
        (!search || s.name.toLowerCase().includes(q) || s.tagline.toLowerCase().includes(q) || s.industry.toLowerCase().includes(q)) &&
        (industry === 'all' || s.industry === industry) &&
        (stage === 'all' || s.stage === stage) &&
        (model === 'all' || s.businessModel === model)
      );
    });
    if (sortBy === 'match') list = [...list].sort((a, b) => b.matchScore - a.matchScore);
    else if (sortBy === 'readiness') list = [...list].sort((a, b) => b.readinessScore - a.readinessScore);
    else if (sortBy === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [startups, search, industry, stage, model, sortBy]);

  const featured = startups.filter(s => s.isFeatured);

  // The same writes the cards make, from the page, so the assistant can
  // scout by name: watch (a deal at Discovered), stop watching, or put a
  // startup straight into Reviewing.
  const qc = useQueryClient();
  const { success, error: showError } = useToast();
  const { data: watchedDeals } = useQuery({
    queryKey: qk('investor', 'deals', 'discovered'),
    queryFn: () => listInvestorDeals({ pipelineStage: 'discovered', limit: 100 }),
    staleTime: 60_000,
    retry: 0,
  });
  const dealFor = (st: Startup) => watchedDeals?.deals?.find((deal) => deal.name === st.name);
  const scout = async (st: Startup | undefined, action: 'watch' | 'unwatch' | 'pipeline'): Promise<PageControlRunResult> => {
    if (!st) return ROW_GONE;
    const existing = dealFor(st);
    try {
      if (action === 'watch' && !existing) await createInvestorDeal(startupDeal(st));
      if (action === 'unwatch' && existing) await deleteInvestorDeal(existing.id);
      if (action === 'pipeline') {
        if (existing) await updateInvestorDeal(existing.id, { pipelineStage: 'reviewing' });
        else await createInvestorDeal(startupDeal(st, 'reviewing'));
      }
      success(action === 'watch' ? 'Added to your watchlist' : action === 'unwatch' ? 'Removed from your watchlist' : 'Added to your pipeline', st.name);
    } catch (err) {
      showError('Could not update your board', err instanceof Error ? err.message : undefined);
      return { error: err instanceof Error && err.message ? err.message : 'Your board was not updated.' };
    } finally {
      void qc.invalidateQueries({ queryKey: qk('investor') });
    }
  };
  const startupRows = (list: Startup[]) => list.map((st) => ({ value: st.id, labelEn: st.name, labelEl: st.name }));
  const byId = (id?: string) => startups.find((st) => st.id === id);
  usePageList([
    {
      id: 'startups',
      labelEn: 'Startups',
      labelEl: 'Startups',
      rows: filtered.map((s) =>
        `${s.name} · ${s.industry}, ${s.stage}, ${s.businessModel} · ${s.location} · match ${s.matchScore}% · raising ${s.raisingAmount}${dealFor(s) ? ' · watched' : ''}`,
      ),
      total: startups.length,
      sample: true,
    },
  ]);
  usePageControls([
    choiceControl('industry', 'Industry', 'Κλάδος', industries.map((i) => ({ value: i, en: i === 'all' ? 'All industries' : i, el: i === 'all' ? 'Όλοι οι κλάδοι' : i })), industry, setIndustry),
    choiceControl('stage', 'Stage', 'Στάδιο', stages.map((i) => ({ value: i, en: i === 'all' ? 'All stages' : i, el: i === 'all' ? 'Όλα τα στάδια' : i })), stage, setStage),
    choiceControl('sort', 'Sort startups', 'Ταξινόμηση startups', [
      { value: 'match', en: 'Best match', el: 'Καλύτερο ταίριασμα' },
      { value: 'readiness', en: 'Readiness', el: 'Ετοιμότητα' },
      { value: 'name', en: 'Name', el: 'Όνομα' },
    ], sortBy, setSortBy),
    choiceControl('view_mode', 'Layout', 'Διάταξη', [
      { value: 'list', en: 'List', el: 'Λίστα' },
      { value: 'grid', en: 'Grid', el: 'Πλέγμα' },
    ], viewMode, (v) => setViewMode(v as 'list' | 'grid')),
    // Watching creates a fresh deal from this card, so stopping deletes
    // exactly what was made. Not the reverse: a watched deal may carry notes
    // that deleting it loses and watching again would not bring back.
    { id: 'watch_startup', labelEn: 'Watch startup', labelEl: 'Παρακολούθηση startup', writes: true, options: startupRows(startups.filter((st) => !dealFor(st))), undo: (v) => ({ control: 'unwatch_startup', value: v }), run: (v) => scout(byId(v), 'watch') },
    { id: 'unwatch_startup', labelEn: 'Stop watching startup', labelEl: 'Διακοπή παρακολούθησης startup', writes: true, options: startupRows(startups.filter((st) => dealFor(st))), run: (v) => scout(byId(v), 'unwatch') },
    { id: 'add_to_pipeline', labelEn: 'Add startup to pipeline', labelEl: 'Προσθήκη startup στο pipeline', writes: true, options: startupRows(startups), run: (v) => scout(byId(v), 'pipeline') },
  ]);
  const activeFilters = [industry !== 'all' && industry, stage !== 'all' && stage, model !== 'all' && model].filter(Boolean) as string[];

  return (
    <AppShell showHelp
      actions={
        <>
          <div className="flex items-center gap-2">
            <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="icon" className="h-8 w-8" onClick={() => setViewMode('list')} aria-label="List view" aria-pressed={viewMode === 'list'}>
              <List className="icon-sm" />
            </Button>
            <Button variant={viewMode === 'grid' ? 'default' : 'outline'} size="icon" className="h-8 w-8" onClick={() => setViewMode('grid')} aria-label="Grid view" aria-pressed={viewMode === 'grid'}>
              <LayoutGrid className="icon-sm" />
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-6">
        {/* Featured */}
        {featured.length > 0 && (
          <Card className="border-primary/15 bg-primary/[0.03]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Zap className="icon-sm text-muted-foreground" /><BilingualText en="Featured Startups" el="Προτεινόμενες startups" compact /></CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
              {featured.map(s => (
                <div key={s.id} className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-primary/10 text-primary-accessible font-semibold">{s.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{s.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.tagline}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-primary-accessible font-semibold">{s.matchScore}% match</p>
                    <p className="text-xs text-muted-foreground">{s.raisingAmount}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
              <Input aria-label={bilingualAria("Search startups", "Αναζήτηση startups")} placeholder={bilingualInline("Search by name, industry, or keyword…", "Αναζήτηση με όνομα, κλάδο ή λέξη-κλειδί…")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger aria-label="Industry" className="w-full sm:w-[140px]"><SelectValue placeholder={bilingualInline("Industry", "Κλάδος")} /></SelectTrigger>
              <SelectContent>
                {industries.map(i => <SelectItem key={i} value={i}>{i === 'all' ? 'All Industries' : i}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger aria-label="Stage" className="w-full sm:w-[130px]"><SelectValue placeholder={bilingualInline("Stage", "Στάδιο")} /></SelectTrigger>
              <SelectContent>
                {stages.map(s => <SelectItem key={s} value={s}>{s === 'all' ? 'All Stages' : s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger aria-label="Business model" className="w-full sm:w-[120px]"><SelectValue placeholder={bilingualInline("Model", "Μοντέλο")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all"><BilingualText en="All Models" el="Όλα τα μοντέλα" compact /></SelectItem>
                {['B2B', 'B2C', 'B2B2C', 'Marketplace'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger aria-label="Sort by" className="w-full sm:w-[130px]"><ArrowUpDown className="mr-1.5 icon-sm" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="match"><BilingualText en="Best Match" el="Καλύτερο ταίριασμα" compact /></SelectItem>
                <SelectItem value="readiness"><BilingualText en="Readiness" el="Ετοιμότητα" compact /></SelectItem>
                <SelectItem value="name"><BilingualText en="Name A–Z" el="Όνομα Α–Ω" compact /></SelectItem>
              </SelectContent>
            </Select>
          </div>
          {activeFilters.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Active filters:</span>
              {activeFilters.map(f => (
                <Badge key={f} variant="secondary" className="gap-1 text-xs">
                  {f}
                  <button aria-label={`Remove filter ${f}`} onClick={() => { if (f === industry) setIndustry('all'); else if (f === stage) setStage('all'); else setModel('all'); }}>
                    <X className="icon-sm" />
                  </button>
                </Badge>
              ))}
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setIndustry('all'); setStage('all'); setModel('all'); setSearch(''); }}><BilingualText en="Clear all" el="Καθαρισμός όλων" compact /></Button>
            </div>
          )}
        </div>

        {/* Results header */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{filtered.length}</span> startup{filtered.length !== 1 ? 's' : ''} found
            {ALL_STARTUPS.filter(s => s.isHot).length > 0 && <span className="ml-2 inline-flex items-center gap-1 text-status-warning"><Flame className="h-3 w-3" aria-hidden="true" />{ALL_STARTUPS.filter(s => s.isHot).length} trending</span>}
          </p>
          <Link href="/investor/pipeline" className="text-xs text-primary-accessible hover:underline flex items-center gap-1">
            <GanttChart className="icon-sm" /><BilingualText en="View Pipeline" el="Προβολή pipeline" compact />
          </Link>
        </div>

        {/* Results */}
        <div className={cn('gap-4', viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2' : 'space-y-3')}>
          {filtered.map(startup => (
            <StartupCard key={startup.id} startup={startup} compact={viewMode === 'grid'} />
          ))}
          {filtered.length === 0 && (
            <Card className="col-span-2">
              <CardContent className="py-12 text-center">
                <Compass className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" aria-hidden="true" />
                <h3 className="font-medium"><BilingualText en="No startups found" el="Δεν βρέθηκαν startups" compact /></h3>
                <p className="text-sm text-muted-foreground mt-1"><BilingualText en="Try adjusting your filters or search term" el="Δοκιμάστε να αλλάξετε φίλτρα ή αναζήτηση" wrap /></p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => { setIndustry('all'); setStage('all'); setModel('all'); setSearch(''); }}><BilingualText en="Clear Filters" el="Καθαρισμός φίλτρων" compact /></Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
