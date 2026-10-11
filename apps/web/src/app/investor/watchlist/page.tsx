'use client';

import { StatusText } from '@/components/common/StatusText';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useDemoData } from '@/contexts/DemoDataContext';
import {
  Eye,
  Bell,
  BellOff,
  Star,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Search,
  Filter,
  Trash2,
  MoreVertical,
  MessageCircle,
  GitCompare,
  Zap,
  Clock,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { RelativeTime } from '@/components/common/RelativeTime';
import { companyStageLabel, formatRelativeTime } from '@/lib/utils';
import {
  listInvestorDeals,
  getInvestorActivity,
  updateInvestorDeal,
  deleteInvestorDeal,
  type InvestorDeal,
} from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { UnavailableMenuItem } from '@/components/common/UnavailableMenuItem';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { qk } from '@/lib/query-keys';
import { CANCELLED, choiceControl, ROW_GONE, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { BilingualText } from '@/components/common/BilingualText';
import { CardFoot, CardHead } from '@/components/common/CardAnatomy';
import { FactLine } from '@/components/common/FactLine';
import { formatCompactMoney } from '@/lib/i18n/format';
import { bilingualAria, bilingualInline } from '@/lib/i18n/format';

// ── Mock data ─────────────────────────────────────────────────────────────────

type WatchedStartup = {
  /** The founder's user id when the deal is linked to one; Request Intro messages them. */
  founderId?: string;
  id: string;
  name: string;
  logoUrl: string | null;
  tagline: string;
  industry: string;
  stage: string;
  location: string;
  teamSize: number;
  /** Both null until the platform is allowed to show a founder's own
   *  readiness and match to the people looking at them. */
  readinessScore: number | null;
  matchScore: number | null;
  raisingAmount: string;
  tags: string[];
  watchedSince: string;
  alertsEnabled: boolean;
  lastActivity: string;
  activityType: 'update' | 'fundraise' | 'milestone' | 'team';
  progressChange: number; // +/- % change
  notes: string;
};

type ActivityItem = {
  id: string;
  startupId: string;
  startupName: string;
  logoUrl: string | null;
  type: 'milestone' | 'fundraise' | 'team' | 'deck' | 'update' | 'stage_change' | 'note';
  title: string;
  time: string;
};

/**
 * A watched startup is a deal the investor has not moved off `discovered`.
 * It is the same row the pipeline board and the portfolio read, which is why
 * starring one here shows it starred there.
 */
function toWatched(deal: InvestorDeal): WatchedStartup {
  return {
    founderId: deal.founder?.id,
    id: deal.id,
    name: deal.name,
    logoUrl: deal.logoUrl,
    tagline: deal.tagline ?? '',
    industry: deal.industry ?? '\u2014',
    stage: companyStageLabel(deal.companyStage) || '\u2014',
    location: deal.location ?? '\u2014',
    teamSize: deal.teamSize ?? 0,
    // Neither is the investor's to see yet — see the note on `Deal` in
    // /investor/pipeline. The cards omit the line rather than invent one.
    readinessScore: null,
    matchScore: null,
    raisingAmount:
      deal.askAmountCents != null
        ? formatCompactMoney(deal.askAmountCents / 100, deal.currency)
        : '\u2014',
    tags: deal.tags,
    watchedSince: deal.createdAt,
    alertsEnabled: deal.alertsEnabled,
    lastActivity: deal.lastActivityAt,
    activityType: toWatchedActivity(deal.recentEvents?.[0]?.type),
    progressChange: 0,
    notes: deal.notes ?? '',
  };
}

/** Only four kinds headline a card; anything else (a stage change, a note) reads as an update. */
function toWatchedActivity(type: string | null | undefined): WatchedStartup['activityType'] {
  return type === 'fundraise' || type === 'milestone' || type === 'team' ? type : 'update';
}

const MOCK_WATCHED: WatchedStartup[] = [
  {
    id: '1',
    name: 'NeuralFlow AI',
    logoUrl: null,
    tagline: 'AI-powered workflow automation for enterprises',
    industry: 'AI/ML',
    stage: 'Seed',
    location: 'San Francisco',
    teamSize: 3,
    readinessScore: 85,
    matchScore: 92,
    raisingAmount: '$1.5M',
    tags: ['AI/ML', 'B2B', 'SaaS'],
    watchedSince: '2026-08-14T10:00:00.000Z',
    alertsEnabled: true,
    lastActivity: '2026-09-04T08:00:00.000Z',
    activityType: 'milestone',
    progressChange: +8,
    notes: 'Strong team, unique positioning. Follow up after MVP demo.',
  },
  {
    id: '2',
    name: 'PayStream',
    logoUrl: null,
    tagline: 'Next-gen payment infrastructure for SMBs',
    industry: 'FinTech',
    stage: 'Seed',
    location: 'London',
    teamSize: 4,
    readinessScore: 91,
    matchScore: 88,
    raisingAmount: '$2M',
    tags: ['FinTech', 'Payments', 'B2B'],
    watchedSince: '2026-08-21T10:00:00.000Z',
    alertsEnabled: true,
    lastActivity: '2026-09-03T10:00:00.000Z',
    activityType: 'fundraise',
    progressChange: +5,
    notes: 'Already have LOIs from 2 angels. Valuation looks fair.',
  },
  {
    id: '3',
    name: 'GreenGrid Energy',
    logoUrl: null,
    tagline: 'Smart grid solutions for renewable energy',
    industry: 'CleanTech',
    stage: 'Pre-seed',
    location: 'Berlin',
    teamSize: 2,
    readinessScore: 72,
    matchScore: 78,
    raisingAmount: '$500K',
    tags: ['CleanTech', 'Energy', 'IoT'],
    watchedSince: '2026-08-04T10:00:00.000Z',
    alertsEnabled: false,
    lastActivity: '2026-09-01T10:00:00.000Z',
    activityType: 'update',
    progressChange: -2,
    notes: 'Tech is solid but market timing uncertain. Monitor for 3 more months.',
  },
  {
    id: '4',
    name: 'DataVault',
    logoUrl: null,
    tagline: 'Enterprise data security and compliance',
    industry: 'Cybersecurity',
    stage: 'Seed',
    location: 'New York',
    teamSize: 5,
    readinessScore: 78,
    matchScore: 85,
    raisingAmount: '$3M',
    tags: ['Security', 'Enterprise', 'SaaS'],
    watchedSince: '2026-08-30T10:00:00.000Z',
    alertsEnabled: true,
    lastActivity: '2026-09-04T05:00:00.000Z',
    activityType: 'team',
    progressChange: +12,
    notes: 'New CTO hire is very strong. Re-evaluating conviction.',
  },
];

const MOCK_ACTIVITY: ActivityItem[] = [
  { id: 'a1', startupId: '1', startupName: 'NeuralFlow AI', logoUrl: null, type: 'milestone', title: 'Reached 100 beta users milestone', time: '2026-09-04T08:00:00.000Z' },
  { id: 'a2', startupId: '4', startupName: 'DataVault', logoUrl: null, type: 'team', title: 'Added ex-Palantir CTO to team', time: '2026-09-04T05:00:00.000Z' },
  { id: 'a3', startupId: '2', startupName: 'PayStream', logoUrl: null, type: 'fundraise', title: 'Updated raise target to $2M SAFE', time: '2026-09-03T10:00:00.000Z' },
  { id: 'a4', startupId: '3', startupName: 'GreenGrid Energy', logoUrl: null, type: 'update', title: 'Published Q1 2025 progress update', time: '2026-09-01T10:00:00.000Z' },
  { id: 'a5', startupId: '1', startupName: 'NeuralFlow AI', logoUrl: null, type: 'deck', title: 'Updated pitch deck (v4)', time: '2026-08-31T10:00:00.000Z' },
];

const ACTIVITY_TYPE_CONFIG: Record<ActivityItem['type'], { label: string; labelEl: string; color: string }> = {
  milestone: { label: 'Milestone', labelEl: 'Ορόσημο', color: 'bg-status-success-bg text-status-success' },
  fundraise: { label: 'Fundraise', labelEl: 'Χρηματοδότηση', color: 'bg-status-info-bg text-status-info' },
  team: { label: 'Team', labelEl: 'Ομάδα', color: 'bg-status-accent-bg text-status-accent' },
  deck: { label: 'Deck', labelEl: 'Παρουσίαση', color: 'bg-status-warning-bg text-status-warning' },
  update: { label: 'Update', labelEl: 'Ενημέρωση', color: 'bg-muted text-muted-foreground' },
  // InvestorDealEvent.type also records these two (schema.prisma). They were
  // missing here while the live mapping cast the API's string straight to
  // this union, so the first stage change on the board threw inside `.map`
  // and blanked the Activity tab.
  stage_change: { label: 'Stage change', labelEl: 'Αλλαγή σταδίου', color: 'bg-status-info-bg text-status-info' },
  note: { label: 'Note', labelEl: 'Σημείωση', color: 'bg-muted text-muted-foreground' },
};

/** Narrow the API's free-form event type to one this page can render. */
function toActivityType(type: string | null | undefined): ActivityItem['type'] {
  return type && type in ACTIVITY_TYPE_CONFIG ? (type as ActivityItem['type']) : 'update';
}

// Each answers how it ended, so the assistant's card can say so; the card's
// buttons ignore the answer, since the toast has already told the reader.
type WatchActions = {
  onPromote: (s: WatchedStartup) => Promise<PageControlRunResult>;
  onRemove: (s: WatchedStartup) => Promise<PageControlRunResult>;
  onAlerts: (s: WatchedStartup, enabled: boolean) => Promise<PageControlRunResult>;
};

function WatchlistCard({ startup, live, onPromote, onRemove, onAlerts }: { startup: WatchedStartup; live: boolean } & WatchActions) {
  const [alertsEnabled, setAlertsEnabled] = useState(startup.alertsEnabled);
  // Follow the deal when it changes from elsewhere (the assistant, a refetch).
  useEffect(() => setAlertsEnabled(startup.alertsEnabled), [startup.alertsEnabled]);

  // The Opportunities card: the mark and name with the tagline under it,
  // the alert toggle and menu at the right; facts, scores, the note and the
  // dates start on the mark's left edge.
  return (
    <Card className="transition-all hover:border-primary/20">
      <CardContent className="space-y-3">
        <CardHead
          mark={(
            <Avatar className="h-10 w-10 rounded-xl">
              <AvatarImage src={startup.logoUrl ?? undefined} alt="" />
              <AvatarFallback className="rounded-xl bg-primary/10 font-semibold text-primary-accessible">
                {startup.name[0]}
              </AvatarFallback>
            </Avatar>
          )}
          title={(
            <Link href={`/startups/${startup.id}`} className="transition-colors hover:text-primary-accessible">
              {startup.name}
            </Link>
          )}
          subtitle={startup.tagline ? <span className="line-clamp-1">{startup.tagline}</span> : undefined}
          asideStays
          aside={(
            <>
              <Button aria-label="Notifications"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                // Toggled local state only; the deal has an alertsEnabled
                // column and PATCH writes it.
                onClick={() => { const next = !alertsEnabled; setAlertsEnabled(next); if (live) onAlerts(startup, next); }}
                aria-pressed={alertsEnabled}
                title={alertsEnabled ? 'Disable alerts' : 'Enable alerts'}
              >
                {alertsEnabled ? (
                  <Bell className="icon-sm text-muted-foreground" />
                ) : (
                  <BellOff className="icon-sm text-muted-foreground" />
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Open actions for ${startup.name}`}>
                    <MoreVertical className="icon-sm" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/startups/${startup.id}`}>
                      <Eye className="mr-2 icon-sm" /> <BilingualText en="View Details" el="Λεπτομέρειες" compact />
                    </Link>
                  </DropdownMenuItem>
                  {/* These four had no handler. A watched startup is a
                      deal at "discovered", so adding it to the pipeline
                      moves it to "reviewing" and removing it deletes it. */}
                  <DropdownMenuItem disabled={!live} onSelect={() => onPromote(startup)}>
                    <ArrowUpRight className="mr-2 icon-sm" aria-hidden="true" /> <BilingualText en="Add to Pipeline" el="Προσθήκη στο pipeline" compact />
                  </DropdownMenuItem>
                  {startup.founderId ? (
                    <DropdownMenuItem asChild>
                      <Link href={`/messages?to=${startup.founderId}`}>
                        <MessageCircle className="mr-2 icon-sm" aria-hidden="true" /> <BilingualText en="Request Intro" el="Αίτημα γνωριμίας" compact />
                      </Link>
                    </DropdownMenuItem>
                  ) : (
                    <UnavailableMenuItem
                      icon={<MessageCircle className="mr-2 mt-0.5 icon-sm" aria-hidden="true" />}
                      en="Request Intro"
                      el="Αίτημα γνωριμίας"
                      reasonEn="This startup is not linked to a founder account."
                      reasonEl="Η startup δεν συνδέεται με λογαριασμό ιδρυτή."
                    />
                  )}
                  <UnavailableMenuItem
                    icon={<GitCompare className="mr-2 mt-0.5 icon-sm" aria-hidden="true" />}
                    en="Compare"
                    el="Σύγκριση"
                    reasonEn="Deal comparison is not built yet."
                    reasonEl="Η σύγκριση συμφωνιών δεν υπάρχει ακόμη."
                  />
                  <DropdownMenuItem className="text-destructive-accessible" disabled={!live} onSelect={() => onRemove(startup)}>
                    <Trash2 className="mr-2 icon-sm" aria-hidden="true" /> <BilingualText en="Remove from Watchlist" el="Αφαίρεση από τη λίστα παρακολούθησης" compact />
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        />

        {/* Facts */}
        <FactLine
          items={[
            <StatusText key="stage" value={startup.stage} />,
            startup.teamSize ? <BilingualText key="team" en={`Team of ${startup.teamSize}`} el={`Ομάδα ${startup.teamSize}`} compact /> : null,
            startup.location,
            startup.raisingAmount ? <span key="raising" className="font-medium text-primary-accessible">{startup.raisingAmount}</span> : null,
          ]}
        />

        {/* Scores */}
        {(startup.readinessScore != null || startup.matchScore != null) && (
          <div className="flex items-end gap-4">
            {startup.readinessScore != null && (
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground"><BilingualText en="Readiness" el="Ετοιμότητα" compact /></span>
                <div className="flex items-center gap-1">
                  <span className="font-medium tabular-nums">{startup.readinessScore}%</span>
                  {startup.progressChange !== 0 && (
                    <span className={cn(
                      'flex items-center tabular-nums',
                      startup.progressChange > 0 ? 'text-status-success' : 'text-status-danger'
                    )}>
                      {startup.progressChange > 0 ? <TrendingUp className="h-2.5 w-2.5" aria-hidden="true" /> : <TrendingDown className="h-2.5 w-2.5" aria-hidden="true" />}
                      {Math.abs(startup.progressChange)}%
                    </span>
                  )}
                </div>
              </div>
              <Progress value={startup.readinessScore} className="h-1.5" />
            </div>
            )}
            {startup.matchScore != null && (
            <div className={cn('shrink-0', startup.readinessScore != null && 'text-right')}>
              <p className="text-xs text-muted-foreground"><BilingualText en="Match" el="Ταίριασμα" compact /></p>
              <p className="card-body font-semibold tabular-nums text-primary-accessible">{startup.matchScore}%</p>
            </div>
            )}
          </div>
        )}

        {/* Notes */}
        {startup.notes && (
          <p className="card-body line-clamp-1 italic text-muted-foreground">
            📝 {startup.notes}
          </p>
        )}

        <CardFoot
          meta={(
            <FactLine
              items={[
                <span key="activity" className="inline-flex items-center gap-1"><Clock className="icon-sm" aria-hidden="true" /><RelativeTime date={startup.lastActivity} format={formatRelativeTime} /></span>,
                <span key="since"><BilingualText en="Watching since" el="Παρακολουθείται από" compact /> <RelativeTime date={startup.watchedSince} format={formatRelativeTime} /></span>,
              ]}
            />
          )}
        />
      </CardContent>
    </Card>
  );
}

export default function InvestorWatchlistPage() {
  const { showDemoData } = useDemoData();
  const [search, setSearch] = useState('');
  const [alertsOnly, setAlertsOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /*
   * Watching is a stage on the investor's board, not a separate list. The demo
   * fixtures remain what an empty watchlist shows while the "demo data" switch
   * is on; a real one always wins.
   */
  const { data: watchedPage, isLoading: watchedLoading } = useQuery({
    queryKey: qk('investor', 'deals', 'discovered'),
    queryFn: () => listInvestorDeals({ pipelineStage: 'discovered', limit: 100 }),
    staleTime: 60_000,
    retry: 0,
  });
  const { data: activityPage } = useQuery({
    queryKey: qk('investor', 'activity'),
    queryFn: () => getInvestorActivity(20),
    staleTime: 60_000,
    retry: 0,
  });

  const liveWatched = (watchedPage?.deals ?? []).map(toWatched);
  const watched = liveWatched.length > 0 ? liveWatched : showDemoData ? MOCK_WATCHED : [];
  const watchLive = liveWatched.length > 0;
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const confirm = useConfirm();
  const refreshBoard = () => void queryClient.invalidateQueries({ queryKey: qk('investor') });
  const watchActions: WatchActions = {
    onPromote: async (st) => {
      try {
        await updateInvestorDeal(st.id, { pipelineStage: 'reviewing' });
        success('Added to pipeline', `${st.name} is now in Reviewing.`);
      } catch (e) {
        toastError('Could not add to pipeline', e instanceof Error ? e.message : undefined);
        return { error: e instanceof Error && e.message ? e.message : 'It was not added to the pipeline.' };
      } finally { refreshBoard(); }
    },
    onRemove: async (st) => {
      const ok = await confirm({
        title: <BilingualText en={`Remove ${st.name} from your watchlist?`} el={`Αφαίρεση του ${st.name} από τη λίστα παρακολούθησης;`} />,
        description: <BilingualText en="The deal and its notes are deleted from your board." el="Η ευκαιρία και οι σημειώσεις της διαγράφονται από τον πίνακά σας." />,
        confirmLabel: <BilingualText en="Remove" el="Αφαίρεση" compact />,
      });
      if (!ok) return CANCELLED;
      try {
        await deleteInvestorDeal(st.id);
        success('Removed from watchlist', st.name);
      } catch (e) {
        toastError('Could not remove it', e instanceof Error ? e.message : undefined);
        return { error: e instanceof Error && e.message ? e.message : 'It was not removed.' };
      } finally { refreshBoard(); }
    },
    onAlerts: async (st, enabled) => {
      try {
        await updateInvestorDeal(st.id, { alertsEnabled: enabled });
      } catch (e) {
        toastError('Could not change alerts', e instanceof Error ? e.message : undefined);
        return { error: e instanceof Error && e.message ? e.message : 'The alerts were not changed.' };
      } finally { refreshBoard(); }
    },
  };
  const liveActivity: ActivityItem[] = (activityPage?.activity ?? []).map((event) => ({
    id: event.id,
    startupId: event.dealId,
    startupName: event.dealName,
    logoUrl: event.logoUrl,
    type: toActivityType(event.type),
    title: event.title,
    time: event.createdAt,
  }));
  const activity = liveActivity.length > 0 ? liveActivity : showDemoData ? MOCK_ACTIVITY : [];

  const filtered = watched.filter(
    s => (!search || s.name.toLowerCase().includes(search.toLowerCase()) || s.tagline.toLowerCase().includes(search.toLowerCase()))
      && (!alertsOnly || s.alertsEnabled)
  );

  const alertCount = watched.filter(s => s.alertsEnabled).length;

  const [tab, setTab] = useState('watchlist');
  const liveOnlyEn = watchLive ? undefined : 'These are sample startups; the action needs a startup on your own watchlist.';
  const liveOnlyEl = watchLive ? undefined : 'Είναι δείγματα· η ενέργεια χρειάζεται startup από τη δική σας λίστα.';
  const startupRows = (list: WatchedStartup[]) => list.map((st) => ({ value: st.id, labelEn: st.name, labelEl: st.name }));
  const byId = (id?: string) => watched.find((st) => st.id === id);
  usePageList([
    {
      id: 'watched',
      labelEn: 'Watched startups',
      labelEl: 'Startups υπό παρακολούθηση',
      rows: watchedLoading ? undefined : filtered.map((s) =>
        `${s.name} · ${s.industry}, ${s.stage} · ${s.location}${s.raisingAmount ? ` · raising ${s.raisingAmount}` : ''}${s.alertsEnabled ? ' · alerts on' : ''}`,
      ),
      total: watched.length,
      sample: !watchLive,
    },
  ]);
  usePageControls([
    choiceControl('watchlist_tab', 'Watchlist section', 'Ενότητα λίστας', [
      { value: 'watchlist', en: 'My watchlist', el: 'Η λίστα μου' },
      { value: 'activity', en: 'Recent activity', el: 'Πρόσφατη δραστηριότητα' },
    ], tab, setTab),
    choiceControl('alerts_only', 'Alerts filter', 'Φίλτρο ειδοποιήσεων', [
      { value: 'off', en: 'All startups', el: 'Όλα τα startups' },
      { value: 'on', en: 'Alerts on only', el: 'Μόνο με ειδοποιήσεις' },
    ], alertsOnly ? 'on' : 'off', (v) => setAlertsOnly(v === 'on')),
    { id: 'add_to_pipeline', labelEn: 'Add startup to pipeline', labelEl: 'Προσθήκη startup στο pipeline', writes: true, options: startupRows(watched), unavailableEn: liveOnlyEn, unavailableEl: liveOnlyEl, run: (v) => { const st = byId(v); return st ? watchActions.onPromote(st) : ROW_GONE; } },
    { id: 'remove_from_watchlist', labelEn: 'Remove startup from watchlist', labelEl: 'Αφαίρεση startup από τη λίστα', writes: true, options: startupRows(watched), unavailableEn: liveOnlyEn, unavailableEl: liveOnlyEl, run: (v) => { const st = byId(v); return st ? watchActions.onRemove(st) : ROW_GONE; } },
    // `alertsEnabled` is one field on the deal (updateInvestorDeal), so on and
    // off are each other's exact opposite.
    { id: 'alerts_on', labelEn: 'Turn alerts on for startup', labelEl: 'Ενεργοποίηση ειδοποιήσεων για startup', writes: true, options: startupRows(watched.filter((st) => !st.alertsEnabled)), unavailableEn: liveOnlyEn, unavailableEl: liveOnlyEl, undo: (v) => ({ control: 'alerts_off', value: v }), run: (v) => { const st = byId(v); return st ? watchActions.onAlerts(st, true) : ROW_GONE; } },
    { id: 'alerts_off', labelEn: 'Turn alerts off for startup', labelEl: 'Απενεργοποίηση ειδοποιήσεων για startup', writes: true, options: startupRows(watched.filter((st) => st.alertsEnabled)), unavailableEn: liveOnlyEn, unavailableEl: liveOnlyEl, undo: (v) => ({ control: 'alerts_on', value: v }), run: (v) => { const st = byId(v); return st ? watchActions.onAlerts(st, false) : ROW_GONE; } },
  ]);

  return (
    <AppShell showHelp
      actions={
        <>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1.5">
              <Bell className="icon-sm" />
              {alertCount} alerts active
            </Badge>
            <Button variant="outline" size="sm" asChild>
              <Link href="/investor/scouting">
                <Search className="mr-1.5 icon-sm" />
                <BilingualText en="Scout More" el="Αναζήτηση περισσότερων" compact />
              </Link>
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-6">

        {/* Summary Cards */}
        <div className="grid grid-cols-2 kpi-odd-span-md gap-4 md:grid-cols-4">
          {[
            { label: 'Watching', value: watched.length, icon: Eye },
            { label: 'Alerts On', value: alertCount, icon: Bell },
            { label: 'New Activity', value: activity.length, icon: Zap },
            { label: 'Avg Match', value: (() => {
              // Averaged over the rows that carry a score, so adding an
              // unscored startup cannot drag the average down.
              const scored = watched.filter((w) => w.matchScore != null);
              return scored.length
                ? `${Math.round(scored.reduce((sum, w) => sum + (w.matchScore ?? 0), 0) / scored.length)}%`
                : '—';
            })(), icon: Star },
          ].map(stat => (
            <Card key={stat.label}>
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="page-stat text-xl font-bold">{stat.value}</p>
                </div>
                <div className="rounded-lg bg-primary/10 p-2">
                  <stat.icon className="h-4 w-4 text-primary-accessible" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="watchlist">My Watchlist ({watched.length})</TabsTrigger>
            <TabsTrigger value="activity">Recent Activity ({activity.length})</TabsTrigger>
          </TabsList>

          {/* Watchlist Tab */}
          <TabsContent value="watchlist" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
                <Input
                  aria-label={bilingualAria("Search watchlist", "Αναζήτηση στη λίστα παρακολούθησης")}
                  placeholder={bilingualInline("Search watchlist…", "Αναζήτηση στη λίστα παρακολούθησης…")}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {/* "Filter" had no handler; alerts are the watchlist's own facet. */}
              <Button variant={alertsOnly ? 'default' : 'outline'} size="sm" aria-pressed={alertsOnly} onClick={() => setAlertsOnly((v) => !v)}>
                <Filter className="mr-1.5 icon-sm" aria-hidden="true" />
                <BilingualText en="Alerts on only" el="Μόνο με ειδοποιήσεις" compact />
              </Button>
              {selectedIds.size > 0 && (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/investor/scouting">
                    <GitCompare className="mr-1.5 icon-sm" />
                    Compare ({selectedIds.size})
                  </Link>
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {filtered.map(startup => (
                <WatchlistCard key={startup.id} startup={startup} live={watchLive} {...watchActions} />
              ))}
              {filtered.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Eye className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" aria-hidden="true" />
                    <h3 className="card-title text-foreground"><BilingualText en="No results" el="Κανένα αποτέλεσμα" compact /></h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {search ? 'No startups match your search' : 'Add startups from the scouting feed'}
                    </p>
                    <Button size="sm" className="mt-4" asChild>
                      <Link href="/investor/scouting"><BilingualText en="Scout Startups" el="Αναζήτηση startups" compact /></Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Activity Feed Tab */}
          <TabsContent value="activity" className="space-y-3">
            {activity.map(item => {
              const cfg = ACTIVITY_TYPE_CONFIG[item.type];
              return (
                <Card key={item.id} className="transition-all hover:border-primary/20">
                  <CardContent className="space-y-3">
                    <CardHead
                      mark={(
                        <Avatar className="h-10 w-10 rounded-xl">
                          <AvatarFallback className="rounded-xl bg-primary/10 font-semibold text-primary-accessible">
                            {item.startupName[0]}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      title={(
                        <Link href={`/startups/${item.startupId}`} className="transition-colors hover:text-primary-accessible">
                          {item.startupName}
                        </Link>
                      )}
                      subtitle={item.title}
                      meta={<RelativeTime date={item.time} format={formatRelativeTime} />}
                      aside={(
                        <Badge variant="secondary" className={cn('text-xs', cfg.color)}>
                          <BilingualText en={cfg.label} el={cfg.labelEl} compact />
                        </Badge>
                      )}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
