'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp, Users, Sparkles, Bell, Calendar, MessageCircle,
  Award, Briefcase, RefreshCw, CheckCheck, ExternalLink,
  Flag, Star, Gift, Activity, Zap, Clock, ArrowRight,
  UserCheck, Target, BarChart3, CheckCircle2, X,
} from 'lucide-react';
import Link from 'next/link';
import { getDashboardActivity, listNotifications, markAllNotificationsRead, type DashboardActivityItem, type NotificationItem, type DashboardActivityPage } from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { RailAction, RailOptions, RailStats } from '@/components/layout/RailParts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { BilingualText } from '@/components/common/BilingualText';
import { RelativeTime } from '@/components/common/RelativeTime';
import { bilingualAria } from '@/lib/i18n/format';
import { ACTIVITY_STRINGS, activityEn, activityEl } from '@/lib/i18n/strings-activity';
import { qk } from '@/lib/query-keys';
import { choiceControl, usePageControls, usePageList } from '@/lib/page-controls';
import { FirstRunTour, type TourStep } from '@/components/common/FirstRunTour';

const ACTIVITY_TOUR: TourStep[] = [
  {
    target: 'activity-tabs',
    titleEn: 'Three streams, one page',
    titleEl: 'Τρεις ροές, μία σελίδα',
    bodyEn: 'Network is what people you are connected to did. Notifications are addressed to you — the badge is unread, and Mark all read clears it. Events are sessions and community dates you are on.',
    bodyEl: 'Το Δίκτυο είναι ό,τι έκαναν όσοι είστε συνδεδεμένοι. Οι Ειδοποιήσεις απευθύνονται σε εσάς — το σήμα είναι τα αδιάβαστα και το «Σήμανση όλων» τα καθαρίζει. Οι Εκδηλώσεις είναι συνεδρίες και ημερομηνίες στις οποίες είστε.',
  },
  {
    target: 'activity-stream',
    titleEn: 'The open tab is the only list that filters',
    titleEl: 'Η ανοιχτή καρτέλα είναι η μόνη λίστα που φιλτράρεται',
    bodyEn: 'Type chips in the right rail narrow this stream only. Refresh re-fetches all three. Nothing here is sample data unless it is labelled as sample.',
    bodyEl: 'Τα φίλτρα τύπου στη δεξιά ράγα περιορίζουν μόνο αυτή τη ροή. Η ανανέωση ξαναφορτώνει και τις τρεις. Τίποτα εδώ δεν είναι δείγμα αν δεν φέρει ετικέτα δείγματος.',
  },
];

// ── Type config ─────────────────────────────────────────────────────────────

type ActivityType = 'all' | 'connection' | 'message' | 'match' | 'milestone' | 'achievement' | 'system' | 'event' | 'endorsement';

/* `key` rather than `label`: a literal in a config table is the one place a
   string cannot be rendered bilingually, because it is read as text in four
   different places. The key resolves at the point of render instead. */
type ActivityKey = keyof typeof ACTIVITY_STRINGS;

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; key: ActivityKey }> = {
  connection:  { icon: UserCheck,     color: 'text-status-success', bg: 'bg-status-success-bg', key: 'type_connection' },
  message:     { icon: MessageCircle, color: 'text-status-info',    bg: 'bg-status-info-bg',    key: 'type_message'    },
  match:       { icon: TrendingUp,    color: 'text-status-accent',  bg: 'bg-status-accent-bg',  key: 'type_match'      },
  milestone:   { icon: Flag,          color: 'text-status-warning', bg: 'bg-status-warning-bg', key: 'type_milestone'  },
  achievement: { icon: Award,         color: 'text-status-warning', bg: 'bg-status-warning-bg', key: 'type_achievement'},
  event:       { icon: Calendar,      color: 'text-status-accent',  bg: 'bg-status-accent-bg',  key: 'type_event'      },
  endorsement: { icon: Star,          color: 'text-status-warning', bg: 'bg-status-warning-bg', key: 'type_endorsement'},
  job:         { icon: Briefcase,     color: 'text-status-success', bg: 'bg-status-success-bg', key: 'type_job'        },
  system:      { icon: Bell,          color: 'text-muted-foreground', bg: 'bg-muted',           key: 'type_system'     },
  invite:      { icon: Gift,          color: 'text-status-accent',  bg: 'bg-status-accent-bg',  key: 'type_invite'     },
};

const NOTIF_ICONS: Record<string, React.ElementType> = Object.fromEntries(
  Object.entries(TYPE_CONFIG).map(([k, v]) => [k, v.icon])
);

const FEED_TYPE_FILTERS: { value: ActivityType; key: ActivityKey; icon: React.ElementType }[] = [
  { value: 'all',         key: 'type_all',         icon: Sparkles  },
  { value: 'connection',  key: 'type_connection',  icon: UserCheck },
  { value: 'match',       key: 'type_match',       icon: TrendingUp},
  { value: 'message',     key: 'type_message',     icon: MessageCircle },
  { value: 'milestone',   key: 'type_milestone',   icon: Flag      },
  { value: 'achievement', key: 'type_achievement', icon: Award     },
];

/* The same four actions render twice — as a strip on phones and in the rail
   from `lg`. They were two copies of the same list, which is how the rail ended
   up with a `color` the strip never had. */
const QUICK_ACTIONS: { href: string; key: ActivityKey; icon: React.ElementType; color: string }[] = [
  { href: '/discover', key: 'explore_people', icon: Users, color: 'text-status-accent' },
  { href: '/matches', key: 'view_matches', icon: TrendingUp, color: 'text-status-success' },
  { href: '/events', key: 'browse_events', icon: Calendar, color: 'text-status-accent' },
  { href: '/achievements', key: 'achievements', icon: Award, color: 'text-status-warning' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Both halves at once — the caller renders them as one bilingual run. */
function fill(key: ActivityKey, n: number): { en: string; el: string } {
  return {
    en: activityEn(key).replace('{n}', String(n)),
    el: activityEl(key).replace('{n}', String(n)),
  };
}

function formatTimeAgo(dateStr: string): { en: string; el: string } {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60) return { en: activityEn('time_now'), el: activityEl('time_now') };
  if (s < 3600) return fill('time_minutes', Math.floor(s / 60));
  if (s < 86400) return fill('time_hours', Math.floor(s / 3600));
  if (s < 604800) return fill('time_days', Math.floor(s / 86400));
  /* Past a week it is a date, not an interval. Both locales are pinned to UTC
     for the same reason every other date on the platform is: a rendered day
     must not change under the reader's clock. */
  const opts = { timeZone: 'UTC', month: 'short', day: 'numeric' } as const;
  const d = new Date(dateStr);
  return { en: d.toLocaleDateString('en-GB', opts), el: d.toLocaleDateString('el-GR', opts) };
}

function getDateGroup(dateStr: string): ActivityKey {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'group_today';
  if (diffDays === 1) return 'group_yesterday';
  if (diffDays < 7) return 'group_week';
  return 'group_earlier';
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function ItemSkeleton() {
  return (
    <div className="flex items-start gap-3 border-b border-border px-4 py-4 last:border-0">
      <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3 w-64" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

// ── Network row ───────────────────────────────────────────────────────────────

function NetworkActivityRow({ item }: { item: DashboardActivityItem }) {
  const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG['system'];
  const Icon = cfg.icon;
  return (
    <div className="flex items-start gap-3 border-b border-border px-4 py-3.5 last:border-0 hover:bg-muted/20 transition-colors group">
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', cfg.bg, cfg.color)}>
        <Icon className="icon-sm" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-snug">{item.title}</p>
        {item.author && (
          <p className="text-xs text-muted-foreground mt-0.5">
            <BilingualText
              en={activityEn('by_author').replace('{name}', item.author)}
              el={activityEl('by_author').replace('{name}', item.author)}
              compact
            />
          </p>
        )}
        <div className="mt-1 flex items-center gap-2">
          <Clock className="icon-sm text-muted-foreground/60" />
          <span className="text-2xs text-muted-foreground">{item.timeAgo}</span>
          {/* The type was printed raw and `capitalize`d, which is why it read
              "Connection" in English on a Greek page. */}
          <Badge variant="outline" className="h-4 px-1.5 text-2xs">
            <BilingualText en={activityEn(cfg.key)} el={activityEl(cfg.key)} compact />
          </Badge>
        </div>
      </div>
      {item.href && (
        <Button variant="ghost" size="icon" className="h-7 w-7" asChild aria-label={bilingualAria(activityEn('open_item'), activityEl('open_item'))}>
          <Link
            href={item.href}
            aria-label={bilingualAria(activityEn('open_item'), activityEl('open_item'))}
            className="shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
          >
            <ArrowRight className="icon-sm" aria-hidden="true" />
          </Link>
        </Button>
      )}
    </div>
  );
}

// ── Notification row ─────────────────────────────────────────────────────────

function NotificationRow({ item }: { item: NotificationItem }) {
  const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG['system'];
  const Icon = cfg.icon;
  const isUnread = !item.readAt;
  return (
    <div className={cn(
      'flex items-start gap-3 border-b border-border px-4 py-3.5 last:border-0 hover:bg-muted/20 transition-colors group',
      isUnread && 'bg-primary/[0.03]',
    )}>
      <div className="relative shrink-0">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-full', cfg.bg, cfg.color)}>
          <Icon className="icon-sm" />
        </div>
        {isUnread && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm leading-snug', isUnread ? 'font-medium text-foreground' : 'text-foreground/80')}>
          {item.title}
        </p>
        {item.body && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">{item.body}</p>}
        <div className="mt-1 flex items-center gap-2">
          <Clock className="icon-sm text-muted-foreground/60" />
          <span className="text-2xs text-muted-foreground">
            <RelativeTime
              date={item.createdAt}
              format={(iso) => <BilingualText {...formatTimeAgo(iso)} compact />}
            />
          </span>
          {isUnread && (
            <Badge className="h-4 px-1.5 text-2xs">
              <BilingualText en={activityEn('badge_new')} el={activityEl('badge_new')} compact />
            </Badge>
          )}
        </div>
      </div>
      {item.link && (
        <Button variant="ghost" size="icon" className="h-7 w-7" asChild aria-label={bilingualAria(activityEn('open_item'), activityEl('open_item'))}>
          <Link
            href={item.link}
            aria-label={bilingualAria(activityEn('open_item'), activityEl('open_item'))}
            className="shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
          >
            <ExternalLink className="icon-sm" aria-hidden="true" />
          </Link>
        </Button>
      )}
    </div>
  );
}

// ── Date group header ─────────────────────────────────────────────────────────

function DateGroupHeader({ groupKey }: { groupKey: keyof typeof ACTIVITY_STRINGS }) {
  return (
    <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2">
      <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
        <BilingualText en={activityEn(groupKey)} el={activityEl(groupKey)} compact />
      </span>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

export default function ActivityPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'network' | 'notifications' | 'events'>('network');
  const [typeFilter, setTypeFilter] = useState<ActivityType>('all');
  const [offset, setOffset] = useState(0);
  const [allItems, setAllItems] = useState<DashboardActivityItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const { data: activityData, isLoading: activityLoading, isError: activityError, refetch: refetchActivity } = useQuery<DashboardActivityPage>({
    queryKey: qk('dashboard', 'activity', PAGE_SIZE),
    queryFn: () => getDashboardActivity({ limit: PAGE_SIZE, offset: 0 }),
    staleTime: 30_000,
  });

  // Sync initial query data into accumulated items state
  useEffect(() => {
    if (activityData) {
      setAllItems(activityData.items);
      setHasMore(activityData.hasMore);
      setOffset(activityData.items.length);
    }
  }, [activityData]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const more = await getDashboardActivity({ limit: PAGE_SIZE, offset });
      setAllItems((prev) => [...prev, ...more.items]);
      setHasMore(more.hasMore);
      setOffset((prev) => prev + more.items.length);
    } catch {
      // silently fail
    } finally {
      setLoadingMore(false);
    }
  };

  const { data: notifData, isLoading: notifLoading, isError: notifError, refetch: refetchNotif } = useQuery({
    queryKey: qk('notifications', 'activity'),
    queryFn: () => listNotifications({ limit: 50 }),
    staleTime: 30_000,
    enabled: activeTab === 'notifications',
  });

  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    // The whole root, not this page's list: the bell and the sidebar read
    // `notifications/unread-count`, and refreshing only this list left them
    // counting notifications that had just been read.
    onSuccess: () => qc.invalidateQueries({ queryKey: qk('notifications') }),
  });

  const activityItems = allItems;
  const notifications = notifData?.notifications ?? [];
  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const eventItems = activityItems.filter((i) => i.type === 'event');

  const filteredActivity = useMemo(() => {
    if (typeFilter === 'all') return activityItems;
    return activityItems.filter((i) => i.type === typeFilter);
  }, [activityItems, typeFilter]);

  // Offered to the assistant: the tab, the type chips, Load more and Mark
  // all read - the same setters and mutation; the tab's rows go out as a list.
  usePageList([
    activeTab === 'notifications'
      ? { id: 'notifications', labelEn: 'Notifications', labelEl: 'Ειδοποιήσεις', rows: notifLoading ? undefined : notifications.map((n) => `${n.readAt ? '' : '(unread) '}${n.title} · ${n.createdAt.slice(0, 10)}`) }
      : { id: 'activity', labelEn: 'Network activity', labelEl: 'Δραστηριότητα δικτύου', rows: activityLoading ? undefined : (activeTab === 'events' ? eventItems : filteredActivity).map((i) => `${i.title}${i.author ? ` · ${i.author}` : ''} · ${i.type} · ${i.createdAt.slice(0, 10)}`) },
  ]);
  usePageControls([
    choiceControl('activity_tab', 'Activity section', 'Ενότητα δραστηριότητας', [
      { value: 'network', en: 'Network', el: 'Δίκτυο' },
      { value: 'notifications', en: 'Notifications', el: 'Ειδοποιήσεις' },
      { value: 'events', en: 'Events', el: 'Εκδηλώσεις' },
    ], activeTab, (v) => { setActiveTab(v as typeof activeTab); setTypeFilter('all'); }),
    choiceControl('activity_type', 'Activity type', 'Τύπος δραστηριότητας', FEED_TYPE_FILTERS.map((f) => ({ value: f.value, en: activityEn(f.key), el: activityEl(f.key) })), typeFilter, (v) => setTypeFilter(v as ActivityType)),
    { id: 'load_more', labelEn: 'Load more activity', labelEl: 'Φόρτωση περισσότερης δραστηριότητας', writes: false, unavailableEn: hasMore ? undefined : 'There is no more activity to load.', unavailableEl: hasMore ? undefined : 'Δεν υπάρχει άλλη δραστηριότητα.', run: () => void handleLoadMore() },
    { id: 'mark_all_read', labelEn: 'Mark all notifications read', labelEl: 'Σήμανση όλων ως αναγνωσμένων', writes: true, unavailableEn: activeTab === 'notifications' && unreadCount === 0 ? 'Nothing is unread.' : undefined, unavailableEl: activeTab === 'notifications' && unreadCount === 0 ? 'Δεν υπάρχει τίποτα αδιάβαστο.' : undefined, run: async () => { await markAll.mutateAsync(); } },
  ]);

  // Group items by date
  const groupedActivity = useMemo(() => {
    const groups: Record<string, DashboardActivityItem[]> = {};
    filteredActivity.forEach((item) => {
      const group = getDateGroup(item.timeAgo ?? new Date().toISOString());
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
    });
    return groups;
  }, [filteredActivity]);

  // Stats summary
  const todayCount = activityItems.filter((i) => i.timeAgo && (i.timeAgo.includes('m ago') || i.timeAgo.includes('h ago') || i.timeAgo === 'just now')).length;
  const connectionCount = activityItems.filter((i) => i.type === 'connection').length;
  const matchCount = activityItems.filter((i) => i.type === 'match').length;

  const isLoading = activeTab === 'notifications' ? notifLoading : activityLoading;
  const refetch = activeTab === 'notifications' ? refetchNotif : refetchActivity;

  const rail: PageRailSection[] = [
    {
      id: 'overview',
      glyph: 'spark',
      labelEn: 'Overview',
      labelEl: 'Επισκόπηση',
      badge: unreadCount || null,
      content: (
        <div className="space-y-4">
          <RailStats
            items={[
              { key: 'today', label: activityEn('stat_today'), labelEl: activityEl('stat_today'), value: todayCount, icon: Zap },
              { key: 'unread', label: activityEn('stat_unread'), labelEl: activityEl('stat_unread'), value: unreadCount, icon: Bell },
              { key: 'connections', label: activityEn('stat_connections'), labelEl: activityEl('stat_connections'), value: connectionCount, icon: UserCheck },
              { key: 'matches', label: activityEn('stat_matches'), labelEl: activityEl('stat_matches'), value: matchCount, icon: TrendingUp },
            ]}
          />
          <div className="space-y-2.5">
            <p className="px-2.5 text-xs font-medium text-muted-foreground">
              <BilingualText en={activityEn('activity_breakdown')} el={activityEl('activity_breakdown')} compact wrap />
            </p>
            {Object.entries(TYPE_CONFIG).slice(0, 6).map(([type, cfg]) => {
              const count = activityItems.filter((i) => i.type === type).length;
              const Icon = cfg.icon;
              return (
                <div key={type} className="flex items-center gap-2.5 px-2.5">
                  <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', cfg.bg, cfg.color)}>
                    <Icon className="icon-sm" />
                  </div>
                  <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                    <BilingualText en={activityEn(cfg.key)} el={activityEl(cfg.key)} compact wrap />
                  </span>
                  <span className="text-xs font-semibold text-foreground">{count}</span>
                </div>
              );
            })}
          </div>
          <Card className="border-border bg-primary/[0.03]">
            <CardContent className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <BarChart3 className="icon-md text-muted-foreground" />
              </div>
              <p className="mt-2 text-sm font-semibold text-foreground">
                <BilingualText en={activityEn('stay_active')} el={activityEl('stay_active')} compact />
              </p>
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                <BilingualText en={activityEn('stay_active_hint')} el={activityEl('stay_active_hint')} compact wrap />
              </p>
              <Button variant="outline" size="sm" className="mt-3 h-8 w-full gap-1.5 text-xs" asChild>
                <Link href="/analytics">
                  <Target className="icon-sm" />
                  <BilingualText en={activityEn('view_analytics')} el={activityEl('view_analytics')} compact wrap />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      id: 'filters',
      glyph: 'sliders',
      labelEn: 'Filters and shortcuts',
      labelEl: 'Φίλτρα και συντομεύσεις',
      badge: typeFilter !== 'all' ? 1 : null,
      content: (
        <div className="space-y-4">
          <RailOptions
            title="Type"
            titleEl="Τύπος"
            options={FEED_TYPE_FILTERS.map((f) => ({
              value: f.value,
              en: activityEn(f.key),
              el: activityEl(f.key),
              icon: f.icon,
              count: f.value === 'all' ? undefined : activityItems.filter((i) => i.type === f.value).length,
            }))}
            value={typeFilter}
            onChange={setTypeFilter}
          />
          {typeFilter !== 'all' && (
            <RailAction
              icon={X}
              en={activityEn('clear_filter')}
              el={activityEl('clear_filter')}
              onClick={() => setTypeFilter('all')}
            />
          )}
          <div className="space-y-1">
            <p className="px-2.5 pb-0.5 text-xs font-medium text-muted-foreground">
              <BilingualText en={activityEn('quick_actions')} el={activityEl('quick_actions')} compact wrap />
            </p>
            {QUICK_ACTIONS.map((a) => {
              const AIcon = a.icon;
              return (
                <Link
                  key={a.href}
                  href={a.href}
                  className="tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-foreground hover:bg-muted/70"
                >
                  <AIcon className={cn('icon-sm shrink-0', a.color)} />
                  <span className="min-w-0 flex-1">
                    <BilingualText en={activityEn(a.key)} el={activityEl(a.key)} compact wrap />
                  </span>
                  <ArrowRight className="icon-sm text-muted-foreground/50" />
                </Link>
              );
            })}
          </div>
        </div>
      ),
    },
  ];

  return (
    <AppShell
      rail={rail}
      showHelp
      askAi="Summarise my recent network activity and tell me what to act on first: intros, unread notifications, or upcoming events."
    >
      <FirstRunTour tourId="activity" steps={ACTIVITY_TOUR} ready={!activityLoading} />
      <div className="space-y-6">
          <div>
            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as typeof activeTab); setTypeFilter('all'); }}>
              <div className="mb-3 flex items-center justify-between gap-3" data-tour="activity-tabs">
                <TabsList className="h-9">
                  <TabsTrigger value="network" className="gap-1.5 text-xs">
                    <Sparkles className="icon-sm" /> <BilingualText en={activityEn('tab_network')} el={activityEl('tab_network')} compact />
                    {activityItems.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-4 min-w-[1rem] px-1 text-2xs">{activityItems.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="notifications" className="gap-1.5 text-xs">
                    <Bell className="icon-sm" /> <BilingualText en={activityEn('tab_notifications')} el={activityEl('tab_notifications')} compact />
                    {unreadCount > 0 && (
                      <Badge className="ml-1 h-4 min-w-[1rem] px-1 text-2xs">{unreadCount}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="events" className="gap-1.5 text-xs">
                    <Calendar className="icon-sm" /> <BilingualText en={activityEn('tab_events')} el={activityEl('tab_events')} compact />
                    {eventItems.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-4 min-w-[1rem] px-1 text-2xs">{eventItems.length}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2">
                  {activeTab === 'notifications' && unreadCount > 0 && (
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
                      onClick={() => markAll.mutate()} disabled={markAll.isPending}>
                      <CheckCheck className="icon-sm" /> <BilingualText en={activityEn('mark_all_read')} el={activityEl('mark_all_read')} compact />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={bilingualAria(activityEn('refresh'), activityEl('refresh'))}
                    onClick={() => refetch()}
                  >
                    <RefreshCw className={cn('icon-sm', isLoading && 'animate-spin')} aria-hidden="true" />
                  </Button>
                </div>
              </div>

              {/* Network tab with type filters */}
              <TabsContent value="network" className="mt-0 space-y-3" data-tour="activity-stream">
                <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                  {activityError ? (
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                      <p className="text-sm text-muted-foreground">
                        <BilingualText en={activityEn('activity_failed')} el={activityEl('activity_failed')} compact />
                      </p>
                      <Button variant="secondary" size="sm" onClick={() => refetchActivity()}>
                        <BilingualText en={activityEn('retry')} el={activityEl('retry')} compact />
                      </Button>
                    </div>
                  ) : activityLoading ? (
                    Array.from({ length: 5 }).map((_, i) => <ItemSkeleton key={i} />)
                  ) : filteredActivity.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <Activity className="icon-md text-muted-foreground" />
                      </div>
                      {/* The filtered case used to interpolate the raw type
                          into the sentence — `No milestone activity` — which
                          cannot be said in Greek without declining the noun.
                          One neutral sentence says the same thing in both. */}
                      <p className="text-sm font-medium text-foreground">
                        {typeFilter === 'all' ? <BilingualText en={activityEn('empty_activity')} el={activityEl('empty_activity')} compact /> : <BilingualText en={activityEn('empty_activity_filtered')} el={activityEl('empty_activity_filtered')} compact />}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {typeFilter === 'all' ? <BilingualText en={activityEn('empty_activity_hint')} el={activityEl('empty_activity_hint')} compact /> : <BilingualText en={activityEn('empty_filter_hint')} el={activityEl('empty_filter_hint')} compact />}
                      </p>
                      {typeFilter === 'all' && (
                        <Button variant="outline" size="sm" asChild>
                          <Link href="/discover"><BilingualText en={activityEn('discover_people')} el={activityEl('discover_people')} compact /></Link>
                        </Button>
                      )}
                    </div>
                  ) : (
                    <>
                      {Object.entries(groupedActivity).map(([group, items]) => (
                        <div key={group}>
                          <DateGroupHeader groupKey={group as keyof typeof ACTIVITY_STRINGS} />
                          {items.map((item) => <NetworkActivityRow key={item.id} item={item} />)}
                        </div>
                      ))}
                    </>
                  )}
                </div>
                {hasMore && typeFilter === 'all' && !activityLoading && !activityError && (
                  <div className="mt-3 flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                    >
                      {loadingMore ? (
                        <RefreshCw className="icon-sm animate-spin" />
                      ) : (
                        <ArrowRight className="icon-sm" />
                      )}
                      {loadingMore ? <BilingualText en={activityEn('loading')} el={activityEl('loading')} compact /> : <BilingualText en={activityEn('load_more')} el={activityEl('load_more')} compact />}
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* Notifications */}
              <TabsContent value="notifications" className="mt-0">
                <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                  {notifError ? (
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                      <p className="text-sm text-muted-foreground">
                        <BilingualText en={activityEn('notifications_failed')} el={activityEl('notifications_failed')} compact />
                      </p>
                      <Button variant="secondary" size="sm" onClick={() => refetchNotif()}>
                        <BilingualText en={activityEn('retry')} el={activityEl('retry')} compact />
                      </Button>
                    </div>
                  ) : notifLoading ? (
                    Array.from({ length: 5 }).map((_, i) => <ItemSkeleton key={i} />)
                  ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <CheckCircle2 className="icon-md text-status-success" />
                      </div>
                      <p className="text-sm font-medium text-foreground"><BilingualText en={activityEn('all_caught_up')} el={activityEl('all_caught_up')} compact /></p>
                      <p className="text-xs text-muted-foreground"><BilingualText en={activityEn('no_notifications')} el={activityEl('no_notifications')} compact /></p>
                    </div>
                  ) : (
                    notifications.map((n) => <NotificationRow key={n.id} item={n} />)
                  )}
                </div>
                {notifications.length > 0 && (
                  <div className="mt-3 flex items-center justify-between px-1">
                    <p className="text-xs text-muted-foreground">
                      <BilingualText
                        en={activityEn('unread_of_total').replace('{unread}', String(unreadCount)).replace('{total}', String(notifications.length))}
                        el={activityEl('unread_of_total').replace('{unread}', String(unreadCount)).replace('{total}', String(notifications.length))}
                        compact
                      />
                    </p>
                    <Link href="/notifications" className="text-xs text-primary-accessible hover:underline flex items-center gap-1">
                      <BilingualText en={activityEn('view_all')} el={activityEl('view_all')} compact /> <ArrowRight className="icon-sm" aria-hidden="true" />
                    </Link>
                  </div>
                )}
              </TabsContent>

              {/* Events */}
              <TabsContent value="events" className="mt-0">
                <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                  {activityLoading ? (
                    Array.from({ length: 3 }).map((_, i) => <ItemSkeleton key={i} />)
                  ) : eventItems.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <Calendar className="icon-md text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium text-foreground"><BilingualText en={activityEn('no_events')} el={activityEl('no_events')} compact /></p>
                      <p className="text-xs text-muted-foreground"><BilingualText en={activityEn('no_events_hint')} el={activityEl('no_events_hint')} compact /></p>
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/events"><BilingualText en={activityEn('browse_events')} el={activityEl('browse_events')} compact /></Link>
                      </Button>
                    </div>
                  ) : (
                    eventItems.map((item) => <NetworkActivityRow key={item.id} item={item} />)
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
      </div>
    </AppShell>
  );
}
