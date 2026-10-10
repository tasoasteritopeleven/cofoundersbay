'use client';

import { choiceControl, rowOptions, usePageControls, usePageList } from '@/lib/page-controls';
import { useState, useCallback, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell, BellOff, Check, CheckCheck, Trash2, Filter,
  MessageCircle, UserPlus, Calendar, TrendingUp, Award,
  Briefcase, Users, RefreshCw, ExternalLink,
  Settings, Square, SquareCheck,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { RailAction, RailOptions } from '@/components/layout/RailParts';
import { BilingualText } from '@/components/common/BilingualText';
import { RelativeTime } from '@/components/common/RelativeTime';
import { notificationsEn, notificationsEl } from '@/lib/i18n/strings-notifications';
import { bilingualAria } from '@/lib/i18n/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { AIInsightButton } from '@/components/ai/AIInsightButton';
import { qk } from '@/lib/query-keys';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  type NotificationItem,
} from '@/lib/api';

const TYPE_ICONS: Record<string, React.ElementType> = {
  connection: UserPlus,
  message: MessageCircle,
  event: Calendar,
  match: TrendingUp,
  achievement: Award,
  job: Briefcase,
  community: Users,
  system: Bell,
};

const TYPE_COLORS: Record<string, string> = {
  connection: 'bg-status-info-bg text-status-info',
  message: 'bg-primary/10 text-primary-accessible',
  event: 'bg-status-accent-bg text-status-accent',
  match: 'bg-status-success-bg text-status-success',
  achievement: 'bg-status-warning-bg text-status-warning',
  job: 'bg-status-warning-bg text-status-warning',
  community: 'bg-status-accent-bg text-status-accent',
  system: 'bg-muted text-muted-foreground',
};

const FILTER_TABS = [
  { value: 'all', labelEn: 'All', labelEl: 'Όλες', icon: Bell },
  { value: 'connection', labelEn: 'Connections', labelEl: 'Συνδέσεις', icon: UserPlus },
  { value: 'message', labelEn: 'Messages', labelEl: 'Μηνύματα', icon: MessageCircle },
  { value: 'match', labelEn: 'Matches', labelEl: 'Αντιστοιχίσεις', icon: TrendingUp },
  { value: 'event', labelEn: 'Events', labelEl: 'Εκδηλώσεις', icon: Calendar },
  { value: 'achievement', labelEn: 'Achievements', labelEl: 'Επιτεύγματα', icon: Award },
  { value: 'community', labelEn: 'Community', labelEl: 'Κοινότητα', icon: Users },
  { value: 'system', labelEn: 'System', labelEl: 'Σύστημα', icon: Bell },
];

const TYPE_LABELS: Record<string, { en: string; el: string }> = {
  connection: { en: 'Connection', el: 'Σύνδεση' },
  message: { en: 'Message', el: 'Μήνυμα' },
  event: { en: 'Event', el: 'Εκδήλωση' },
  match: { en: 'Match', el: 'Αντιστοίχιση' },
  achievement: { en: 'Achievement', el: 'Επίτευγμα' },
  job: { en: 'Job', el: 'Θέση εργασίας' },
  community: { en: 'Community', el: 'Κοινότητα' },
  system: { en: 'System', el: 'Σύστημα' },
};

/** The date groups' Greek; the keys are the English groupByDate returns. */
const GROUP_EL: Record<string, string> = { Today: 'Σήμερα', Yesterday: 'Χθες', 'This Week': 'Αυτή την εβδομάδα', Older: 'Παλαιότερες' };

function groupByDate(notifications: NotificationItem[]): { label: string; items: NotificationItem[] }[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekStart = new Date(todayStart.getTime() - 6 * 86400000);

  const groups: Record<string, NotificationItem[]> = { Today: [], Yesterday: [], 'This Week': [], Older: [] };
  for (const n of notifications) {
    const d = new Date(n.createdAt);
    if (d >= todayStart) groups['Today'].push(n);
    else if (d >= yesterdayStart) groups['Yesterday'].push(n);
    else if (d >= weekStart) groups['This Week'].push(n);
    else groups['Older'].push(n);
  }
  return Object.entries(groups).filter(([, items]) => items.length > 0).map(([label, items]) => ({ label, items }));
}


function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-3 border-b border-border px-4 py-4">
      <Skeleton className="h-9 w-9 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3 w-64" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

const NotificationRow = memo(function NotificationRow({
  item,
  onRead,
  onDelete,
  selectable,
  selected,
  onSelect,
}: {
  item: NotificationItem;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
}) {
  const isUnread = !item.readAt;
  const Icon = TYPE_ICONS[item.type] ?? Bell;
  const colorClass = TYPE_COLORS[item.type] ?? TYPE_COLORS.system;
  const typeLabel = TYPE_LABELS[item.type] ?? { en: item.type, el: item.type };

  return (
    <div
      className={cn(
        'group flex items-start gap-3 px-4 py-4 transition-colors hover:bg-muted/30',
        'border-b border-border last:border-0',
        isUnread && 'bg-primary/[0.03]',
        selected && 'bg-primary/5',
      )}
    >
      {selectable && (
        <button
          type="button"
          role="checkbox"
          aria-checked={!!selected}
          aria-label={bilingualAria(`Select: ${item.title}`, `Επιλογή: ${item.title}`)}
          onClick={() => onSelect?.(item.id)}
          className="mt-1 shrink-0 text-muted-foreground hover:text-primary-accessible transition-colors"
        >
          {selected ? <SquareCheck className="icon-sm text-muted-foreground" aria-hidden="true" /> : <Square className="icon-sm" aria-hidden="true" />}
        </button>
      )}

      {/* Icon */}
      {/* The type's glyph is the row's mark (the badge naming the type is
          hidden on a phone), so it stays on screen in every row. */}
      <div className="relative mt-0.5 shrink-0" data-keep-icon="">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-full', colorClass)}>
          <Icon className="icon-sm" />
        </div>
        {isUnread && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {/* The title is the notification. On a 360px row it was sharing space
                with this badge and the timestamp and losing 57% of itself —
                "Elena Papadopoulos sent a connection reque…". Two lines on a phone,
                one from sm up. */}
            <p className={cn('text-sm leading-snug line-clamp-2 sm:truncate', isUnread ? 'font-medium text-foreground' : 'text-foreground/80')}>
              {item.title}
            </p>
            {/* Redundant on a phone: the coloured icon to the left already encodes
                the type. Shown again from sm, where there is room for both. */}
            <Badge variant="secondary" className="hidden sm:inline-flex text-2xs px-1.5 py-0 h-4 shrink-0 capitalize">
              <BilingualText en={typeLabel.en} el={typeLabel.el} compact />
            </Badge>
          </div>
          <span className="shrink-0 text-2xs text-muted-foreground"><RelativeTime date={item.createdAt} absoluteAfterDays={7} /></span>
        </div>
        {item.body && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">{item.body}</p>
        )}
        {/* Always shown: at opacity-0 until hover the three actions were
            invisible on touch screens yet still took taps, and on a desktop
            they left an empty band under every row. */}
        <div className="mt-2 flex items-center gap-2">
          {item.link && (
            <Link
              href={item.link}
              onClick={() => onRead(item.id)}
              // tap-target-y on all three row actions: they were 16px tall, under the
              // 24px target minimum, and they sit close enough together that the
              // SC 2.5.8 spacing exception does not rescue them either.
              className="inline-flex tap-target-y items-center gap-1 text-xs font-medium text-primary-accessible hover:underline"
            >
              <BilingualText en="View" el="Προβολή" compact /> <ExternalLink className="icon-sm" />
            </Link>
          )}
          {isUnread && (
            <button
              onClick={() => onRead(item.id)}
              className="inline-flex tap-target-y items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <Check className="icon-sm" /> <BilingualText en="Mark read" el="Αναγνωσμένη" compact />
            </button>
          )}
          <button
            onClick={() => onDelete(item.id)}
            className="inline-flex tap-target-y items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive-accessible"
          >
            <Trash2 className="icon-sm" /> <BilingualText en="Delete" el="Διαγραφή" compact />
          </button>
        </div>
      </div>
    </div>
  );
});

export default function NotificationsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const queryKey = qk('notifications', activeTab, showUnreadOnly);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      listNotifications({
        limit: 50,
        type: activeTab !== 'all' ? activeTab : undefined,
        unread: showUnreadOnly || undefined,
      }),
    staleTime: 30_000,
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey });
      qc.setQueryData(queryKey, (old: typeof data) => ({
        ...old,
        notifications: (old?.notifications ?? []).map((n) =>
          n.id === id ? { ...n, readAt: new Date().toISOString() } : n,
        ),
      }));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk('notifications') }),
  });

  const markAllRead = useMutation({
    mutationFn: markAllNotificationsRead,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey });
      qc.setQueryData(queryKey, (old: typeof data) => ({
        ...old,
        notifications: (old?.notifications ?? []).map((n) => ({
          ...n,
          readAt: n.readAt ?? new Date().toISOString(),
        })),
      }));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk('notifications') }),
  });

  // Offered to the assistant: the category tab, unread-only, and mark all
  // read - the header button's own mutation, so it writes (and says so).
  usePageControls([
    choiceControl('category', 'Notification category', 'Κατηγορία ειδοποιήσεων', FILTER_TABS.map((t) => ({ value: t.value, en: t.labelEn, el: t.labelEl })), activeTab, (v) => { setActiveTab(v); setSelectedIds(new Set()); }),
    choiceControl('unread_only', 'Unread filter', 'Φίλτρο αδιάβαστων', [
      { value: 'all', en: 'All notifications', el: 'Όλες οι ειδοποιήσεις' },
      { value: 'unread', en: 'Unread only', el: 'Μόνο αδιάβαστες' },
    ], showUnreadOnly ? 'unread' : 'all', (v) => setShowUnreadOnly(v === 'unread')),
    {
      id: 'mark_all_read',
      labelEn: 'Mark all notifications read',
      labelEl: 'Σήμανση όλων ως αναγνωσμένων',
      writes: true,
      unavailableEn: unreadCount === 0 ? 'Nothing is unread.' : undefined,
      unavailableEl: unreadCount === 0 ? 'Δεν υπάρχει τίποτα αδιάβαστο.' : undefined,
      run: async () => { await markAllRead.mutateAsync(); },
    },
  ]);

  const deleteN = useMutation({
    mutationFn: deleteNotification,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey });
      qc.setQueryData(queryKey, (old: typeof data) => ({
        ...old,
        notifications: (old?.notifications ?? []).filter((n) => n.id !== id),
      }));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk('notifications') }),
  });

  const handleRead = useCallback((id: string) => markRead.mutate(id), [markRead]);
  const handleDelete = useCallback((id: string) => deleteN.mutate(id), [deleteN]);

  // What the list shows, and each row's Mark read / Delete as commands.
  usePageList([
    {
      id: 'notifications',
      labelEn: 'Notifications',
      labelEl: 'Ειδοποιήσεις',
      rows: isLoading ? undefined : notifications.map((n) =>
        `${n.readAt ? '' : '(unread) '}${n.title}${n.body ? ` · ${n.body}` : ''} · ${n.type} · ${n.createdAt.slice(0, 10)}`,
      ),
    },
  ]);
  usePageControls([
    {
      id: 'mark_read',
      labelEn: 'Mark notification read',
      labelEl: 'Σήμανση ειδοποίησης ως αναγνωσμένης',
      writes: true,
      options: rowOptions(notifications.filter((n) => !n.readAt), (n) => n.id, (n) => n.title),
      run: async (v) => { if (v) await markRead.mutateAsync(v); },
    },
    {
      id: 'delete_notification',
      labelEn: 'Delete notification',
      labelEl: 'Διαγραφή ειδοποίησης',
      writes: true,
      options: rowOptions(notifications, (n) => n.id, (n) => n.title),
      run: async (v) => { if (v) await deleteN.mutateAsync(v); },
    },
  ]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleBulkRead = useCallback(() => {
    selectedIds.forEach((id) => markRead.mutate(id));
    setSelectedIds(new Set());
  }, [selectedIds, markRead]);

  const handleBulkDelete = useCallback(() => {
    selectedIds.forEach((id) => deleteN.mutate(id));
    setSelectedIds(new Set());
    setBulkMode(false);
  }, [selectedIds, deleteN]);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(notifications.map((n) => n.id)));
  }, [notifications]);

  // Per-category unread counts
  const catCounts = notifications.reduce<Record<string, number>>((acc, n) => {
    if (!n.readAt) acc[n.type] = (acc[n.type] ?? 0) + 1;
    return acc;
  }, {});

  const grouped = groupByDate(notifications);

  const rail: PageRailSection[] = [
    {
      id: 'types',
      glyph: 'bell',
      labelEn: 'Categories',
      labelEl: 'Κατηγορίες',
      badge: activeTab !== 'all' ? 1 : null,
      content: (
        <RailOptions
          title="Type"
          titleEl="Τύπος"
          options={FILTER_TABS.map((t) => ({
            value: t.value,
            en: t.labelEn,
            el: t.labelEl,
            icon: t.icon,
            count: catCounts[t.value] || undefined,
          }))}
          value={activeTab}
          onChange={(v) => { setActiveTab(v); setSelectedIds(new Set()); }}
        />
      ),
    },
    {
      id: 'actions',
      glyph: 'sliders',
      labelEn: 'Inbox tools',
      labelEl: 'Εργαλεία εισερχομένων',
      badge: (showUnreadOnly ? 1 : 0) + (bulkMode ? 1 : 0) || null,
      content: (
        <div className="space-y-1">
          <button
            type="button"
            aria-pressed={showUnreadOnly}
            onClick={() => setShowUnreadOnly((v) => !v)}
            className={cn(
              'tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors',
              showUnreadOnly ? 'bg-primary/10 font-medium text-primary-accessible' : 'hover:bg-muted/70',
            )}
          >
            <Filter className="icon-sm shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <BilingualText en={notificationsEn('unread')} el={notificationsEl('unread')} compact wrap />
            </span>
            {unreadCount > 0 ? <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{unreadCount}</span> : null}
          </button>
          <button
            type="button"
            aria-pressed={bulkMode}
            onClick={() => { setBulkMode((v) => !v); setSelectedIds(new Set()); }}
            className={cn(
              'tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors',
              bulkMode ? 'bg-primary/10 font-medium text-primary-accessible' : 'hover:bg-muted/70',
            )}
          >
            <SquareCheck className="icon-sm shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <BilingualText en={bulkMode ? notificationsEn('exit_select') : notificationsEn('select')} el={bulkMode ? notificationsEl('exit_select') : notificationsEl('select')} compact wrap />
            </span>
          </button>
          {bulkMode && (
            <RailAction icon={Square} en={notificationsEn('select_all')} el={notificationsEl('select_all')} onClick={selectAll} />
          )}
          {bulkMode && selectedIds.size > 0 && (
            <>
              <RailAction icon={Check} en={`Mark selected (${selectedIds.size})`} el={`Επιλεγμένες ως αναγνωσμένες (${selectedIds.size})`} onClick={handleBulkRead} />
              <RailAction icon={Trash2} en={`Remove selected (${selectedIds.size})`} el={`Διαγραφή επιλεγμένων (${selectedIds.size})`} onClick={handleBulkDelete} />
            </>
          )}
          {unreadCount > 0 && (
            <RailAction icon={CheckCheck} en={notificationsEn('mark_all_read')} el={notificationsEl('mark_all_read')} onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending} />
          )}
          <RailAction icon={RefreshCw} en={notificationsEn('refresh')} el={notificationsEl('refresh')} onClick={() => void refetch()} />
          <Link
            href="/settings"
            className="tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted/70"
          >
            <Settings className="icon-sm shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <BilingualText en="Notification settings" el="Ρυθμίσεις ειδοποιήσεων" compact wrap />
            </span>
          </Link>
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
          <RailAction icon={MessageCircle} en="Open messages" el="Άνοιγμα μηνυμάτων" onClick={() => router.push('/messages')} />
          <RailAction icon={UserPlus} en="Open connections" el="Άνοιγμα συνδέσεων" onClick={() => router.push('/connections')} />
          <RailAction icon={TrendingUp} en="Open matches" el="Άνοιγμα αντιστοιχίσεων" onClick={() => router.push('/matches')} />
        </div>
      ),
    },
  ];

  return (
    <AppShell
      title={notificationsEn('page_title')}
      titleEl={notificationsEl('page_title')}
      description={notificationsEn('page_description')}
      descriptionEl={notificationsEl('page_description')}
      rail={rail}
      askAi="I am looking at my notifications. What should I act on first — messages, connections, or matches?"
    >
      <div className="">
        {/* Notification list */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {isError ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <BellOff className="icon-xl text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                <BilingualText en={notificationsEn('error_load')} el={notificationsEl('error_load')} />
              </p>
              <Button variant="secondary" size="sm" onClick={() => refetch()}>
                <RefreshCw className="mr-1.5 icon-sm" /> <BilingualText en={notificationsEn('retry')} el={notificationsEl('retry')} compact />
              </Button>
            </div>
          ) : isLoading ? (
            <>{Array.from({ length: 6 }).map((_, i) => <NotificationSkeleton key={i} />)}</>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <Bell className="icon-lg text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  <BilingualText
                    en={showUnreadOnly ? notificationsEn('empty_no_unread_title') : notificationsEn('empty_all_caught_up')}
                    el={showUnreadOnly ? notificationsEl('empty_no_unread_title') : notificationsEl('empty_all_caught_up')}
                  />
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  <BilingualText
                    en={showUnreadOnly ? notificationsEn('empty_no_unread_desc') : notificationsEn('empty_desc')}
                    el={showUnreadOnly ? notificationsEl('empty_no_unread_desc') : notificationsEl('empty_desc')}
                  />
                </p>
              </div>
              {/* Their wrapper and the caught-up Ask AI prompt (a real addition to
                  an otherwise dead-end empty state), with our bilingual label. */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                {showUnreadOnly && (
                  <Button variant="outline" size="sm" onClick={() => setShowUnreadOnly(false)}>
                    <BilingualText en={notificationsEn('show_all_notifications')} el={notificationsEl('show_all_notifications')} compact />
                  </Button>
                )}
                <AIInsightButton
                  prompt="I am all caught up on notifications. What should I do next on Discover, Matches, or Messages?"
                  variant="outline"
                  size="sm"
                />
              </div>
            </div>
          ) : (
            grouped.map(({ label, items }) => (
              <div key={label}>
                <div className="px-4 py-2 border-b border-border bg-muted/30">
                  <p className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
                    <BilingualText en={label} el={GROUP_EL[label] ?? label} compact />
                  </p>
                </div>
                {items.map((item) => (
                  <NotificationRow
                    key={item.id}
                    item={item}
                    onRead={handleRead}
                    onDelete={handleDelete}
                    selectable={bulkMode}
                    selected={selectedIds.has(item.id)}
                    onSelect={toggleSelect}
                  />
                ))}
              </div>
            ))
          )}
        </div>

        {notifications.length > 0 && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            <BilingualText
              en={`Showing ${notifications.length} notification${notifications.length !== 1 ? 's' : ''}${unreadCount > 0 ? ` · ${unreadCount} unread` : ''}${bulkMode && selectedIds.size > 0 ? ` · ${selectedIds.size} selected` : ''}`}
              el={`${notifications.length} ${notifications.length !== 1 ? 'ειδοποιήσεις' : 'ειδοποίηση'}${unreadCount > 0 ? ` · ${unreadCount} ${unreadCount !== 1 ? 'αδιάβαστες' : 'αδιάβαστη'}` : ''}${bulkMode && selectedIds.size > 0 ? ` · ${selectedIds.size} επιλεγμένες` : ''}`}
              compact
              wrap
            />
          </p>
        )}
      </div>
    </AppShell>
  );
}
