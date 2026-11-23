'use client';

import { choiceControl, rowOptions, usePageControls, usePageList } from '@/lib/page-controls';
import { useState, useCallback, useMemo, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell, BellOff, Check, CheckCheck, Trash2,
  MessageCircle, UserPlus, Calendar, TrendingUp, Award,
  Briefcase, Users, RefreshCw,
  Settings, Square, SquareCheck, X, Bookmark, BookmarkCheck,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { RailAction, RailOptions } from '@/components/layout/RailParts';
import { BilingualText } from '@/components/common/BilingualText';
import { RelativeTime } from '@/components/common/RelativeTime';
import { RowHead } from '@/components/dashboard/SectionCard';
import { StatusText } from '@/components/common/StatusText';
import { notificationsEn, notificationsEl } from '@/lib/i18n/strings-notifications';
import { bilingualAria } from '@/lib/i18n/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Counter } from '@/components/ui/counter';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { AIInsightButton } from '@/components/ai/AIInsightButton';
import { qk } from '@/lib/query-keys';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  markNotificationsRead,
  markNotificationsUnread,
  deleteNotification,
  setNotificationSaved,
  type NotificationItem,
} from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { useBilingualString } from '@/lib/i18n/LanguagePreferenceContext';
import { ASK } from '@/lib/page-questions';
import { elWord } from '@/lib/rows-el';
import { LiveNotices } from '@/components/notifications/LiveNotices';
import { notificationEl } from '@/lib/notification-text';
import { notificationNextAction } from '@/lib/notification-chat';

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

type InboxView = 'all' | 'unread' | 'saved';

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
    <div className="flex items-start gap-3 border-b border-border px-4 py-4 sm:px-6">
      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
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
  onToggleSave,
  selectable,
  selected,
  onSelect,
}: {
  item: NotificationItem;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleSave: (id: string, saved: boolean) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
}) {
  const isUnread = !item.readAt;
  const isSaved = Boolean(item.savedAt);
  const Icon = TYPE_ICONS[item.type] ?? Bell;
  const colorClass = TYPE_COLORS[item.type] ?? TYPE_COLORS.system;
  const typeLabel = TYPE_LABELS[item.type];
  const nextAction = notificationNextAction(item);

  // A row of the list card (RowHead, not a card's head: twenty card titles in
  // one list read as twenty headings): the type's mark, the notification with
  // its kind under it, the time at the right; the sentence and the row's
  // actions start on the mark's left edge.
  return (
    <div
      className={cn(
        'group relative flex items-start gap-3 px-4 py-4 transition-colors hover:bg-muted/30 sm:px-6',
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
          className="relative z-10 mt-3 shrink-0 text-muted-foreground hover:text-primary-accessible transition-colors"
        >
          {selected ? <SquareCheck className="icon-sm text-muted-foreground" aria-hidden="true" /> : <Square className="icon-sm" aria-hidden="true" />}
        </button>
      )}

      <div className="min-w-0 flex-1 space-y-2">
        <RowHead
          mark={(
            // The type's glyph is the row's mark, so it stays on screen in
            // every row (data-keep-icon on the well itself: the in-card
            // decorative-icon rule spares only a glyph whose parent carries
            // it); the dot over it says the row is unread.
            <div className="relative">
              <div data-card-mark="" data-keep-icon="" className={cn('flex h-10 w-10 items-center justify-center rounded-xl', colorClass)}>
                <Icon className="icon-md" aria-hidden="true" />
              </div>
              {isUnread && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
              )}
            </div>
          )}
          // The title is the way in, as on GitHub's inbox: opening it marks
          // the row read. The separate "View" link that said the same thing
          // is gone; a row without a destination keeps a plain title.
          title={item.link ? (
            // Stretched over the row, so the whole row opens it, as the
            // page's line says ("Click a card to jump straight to context");
            // only the words of the title did (docs §76). Mark read and
            // Delete sit above it.
            <Link
              href={item.link}
              onClick={() => { if (!nextAction) onRead(item.id); }}
              className={cn("block first-letter:uppercase after:absolute after:inset-0 after:content-[''] hover:underline", !isUnread && 'text-foreground/80')}
            >
              <BilingualText en={item.title} el={notificationEl(item.title)} compact wrap />
            </Link>
          ) : (
            <span className={cn('block first-letter:uppercase', !isUnread && 'text-foreground/80')}><BilingualText en={item.title} el={notificationEl(item.title)} compact wrap /></span>
          )}
          subtitle={typeLabel
            ? <BilingualText en={typeLabel.en} el={typeLabel.el} compact />
            : <StatusText value={item.type} />}
          aside={<RelativeTime date={item.createdAt} absoluteAfterDays={7} />}
        />
        {item.body && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground first-letter:uppercase"><BilingualText en={item.body} el={notificationEl(item.body)} compact wrap /></p>
        )}
        {/* Always shown: at opacity-0 until hover the three actions were
            invisible on touch screens yet still took taps, and on a desktop
            they left an empty band under every row. */}
        <div className="relative z-10 flex flex-wrap items-center gap-x-4 gap-y-1">
          {nextAction ? <span className="pointer-events-none text-xs font-medium text-primary-accessible"><BilingualText en={nextAction.en} el={nextAction.el} compact /></span> : null}
          {/* tap-target-y on the row actions: they were 16px tall, under the
              24px target minimum, and they sit close enough together that the
              SC 2.5.8 spacing exception does not rescue them either. */}
          {isUnread && (
            <button
              onClick={() => onRead(item.id)}
              className="inline-flex tap-target-y items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <Check className="icon-sm" /> <BilingualText en="Mark read" el="Ως αναγνωσμένη" compact />
            </button>
          )}
          {/* GitHub's Save: kept for later in the Saved view, read or not. */}
          <button
            type="button"
            aria-pressed={isSaved}
            onClick={() => onToggleSave(item.id, !isSaved)}
            className={cn(
              'inline-flex tap-target-y items-center gap-1 text-xs transition-colors hover:text-foreground',
              isSaved ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {isSaved ? <BookmarkCheck className="icon-sm" /> : <Bookmark className="icon-sm" />}{' '}
            {isSaved ? <BilingualText en="Saved" el="Αποθηκευμένη" compact /> : <BilingualText en="Save" el="Αποθήκευση" compact />}
          </button>
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
  // All, Unread, or Saved: GitHub's inbox views (Saved since §111).
  const [view, setView] = useState<InboxView>('all');
  const showUnreadOnly = view === 'unread';
  const showSaved = view === 'saved';
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const queryKey = qk('notifications', activeTab, view);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      listNotifications({
        limit: 50,
        type: activeTab !== 'all' ? activeTab : undefined,
        unread: showUnreadOnly || undefined,
        saved: showSaved || undefined,
      }),
    staleTime: 30_000,
  });

  const notifications = useMemo(() => data?.notifications ?? [], [data]);
  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const sayOne = useBilingualString();
  const { success, error: showError } = useToast();
  // What the last "mark all read" marked, as the API answered it: the one
  // thing its Undo may make unread again (the AI Studio prototype restores
  // the same way, but only its local rows; ours restores the server's too).
  const [lastMarked, setLastMarked] = useState<string[]>([]);

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

  const restoreUnread = useMutation({
    mutationFn: markNotificationsUnread,
    onSuccess: () => setLastMarked([]),
    onSettled: () => qc.invalidateQueries({ queryKey: qk('notifications') }),
  });

  // While a category or the Saved view is chosen, the header's action applies
  // to what is shown: "mark all read" there used to clear every category, the
  // hidden ones too.
  const categoryChosen = activeTab !== 'all' || showSaved;
  const shownUnreadIds = notifications.filter((n) => !n.readAt).map((n) => n.id);
  const markShownRead = useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: (res) => setLastMarked(res?.ids ?? []),
    onSettled: () => qc.invalidateQueries({ queryKey: qk('notifications') }),
  });

  const markAllRead = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: (res) => setLastMarked(res?.ids ?? []),
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
    // The id stays `unread_only` for what already names it; Saved is its third view.
    choiceControl('unread_only', 'Which notifications', 'Ποιες ειδοποιήσεις', [
      { value: 'all', en: 'All notifications', el: 'Όλες οι ειδοποιήσεις' },
      { value: 'unread', en: 'Unread only', el: 'Μόνο αδιάβαστες' },
      { value: 'saved', en: 'Saved only', el: 'Μόνο αποθηκευμένες' },
    ], view, (v) => setView(v === 'unread' || v === 'saved' ? v : 'all')),
    {
      id: 'mark_all_read',
      labelEn: 'Mark all notifications read',
      labelEl: 'Σήμανση όλων ως αναγνωσμένων',
      writes: true,
      unavailableEn: unreadCount === 0 ? 'Nothing is unread.' : undefined,
      unavailableEl: unreadCount === 0 ? 'Δεν υπάρχει τίποτα αδιάβαστο.' : undefined,
      run: async () => { await markAllRead.mutateAsync(); },
      // Exact: the API answers with the ids it marked, and only those return.
      undo: () => (unreadCount > 0 ? { control: 'restore_unread' } : undefined),
    },
    {
      id: 'mark_shown_read',
      labelEn: 'Mark the notifications shown read (the chosen category only)',
      labelEl: 'Σήμανση των ειδοποιήσεων που φαίνονται ως αναγνωσμένων (μόνο η κατηγορία που επιλέξατε)',
      writes: true,
      unavailableEn: shownUnreadIds.length === 0 ? 'Nothing shown is unread.' : undefined,
      unavailableEl: shownUnreadIds.length === 0 ? 'Τίποτα από όσα φαίνονται δεν είναι αδιάβαστο.' : undefined,
      run: async () => { await markShownRead.mutateAsync(shownUnreadIds); },
      // Exact: the API answers with the ids it marked, and only those return.
      undo: () => (shownUnreadIds.length > 0 ? { control: 'restore_unread' } : undefined),
    },
    {
      id: 'restore_unread',
      labelEn: 'Make the notifications just marked read unread again',
      labelEl: 'Ξανά ως αδιάβαστες όσες μόλις σημειώθηκαν αναγνωσμένες',
      writes: true,
      unavailableEn: lastMarked.length ? undefined : 'Nothing was just marked read.',
      unavailableEl: lastMarked.length ? undefined : 'Δεν σημειώθηκε κάτι μόλις ως αναγνωσμένο.',
      run: async () => {
        if (!lastMarked.length) return { error: 'Nothing was just marked read.' };
        await restoreUnread.mutateAsync(lastMarked);
      },
    },
  ]);

  // The header button: the same write, and a toast whose Undo takes back
  // exactly what it marked.
  const markAllWithUndo = () => {
    markAllRead.mutate(undefined, {
      onSuccess: (res) => {
        const ids = res?.ids ?? [];
        if (!ids.length) return;
        success('All notifications marked read', undefined, {
          action: {
            label: sayOne('Undo', 'Αναίρεση'),
            onClick: () => restoreUnread.mutate(ids, {
              onError: (err) => showError('Could not mark them unread', err instanceof Error ? err.message : undefined),
            }),
          },
        });
      },
    });
  };

  const markShownWithUndo = () => {
    if (!shownUnreadIds.length) return;
    markShownRead.mutate(shownUnreadIds, {
      onSuccess: (res) => {
        const ids = res?.ids ?? [];
        if (!ids.length) return;
        success('These notifications marked read', undefined, {
          action: {
            label: sayOne('Undo', 'Αναίρεση'),
            onClick: () => restoreUnread.mutate(ids, {
              onError: (err) => showError('Could not mark them unread', err instanceof Error ? err.message : undefined),
            }),
          },
        });
      },
    });
  };

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

  // Save and unsave, shown at once; in the Saved view an unsaved row leaves
  // the list. The opposite call is the undo, for the toast and the assistant.
  const saveN = useMutation({
    mutationFn: ({ id, saved }: { id: string; saved: boolean }) => setNotificationSaved(id, saved),
    onMutate: async ({ id, saved }) => {
      await qc.cancelQueries({ queryKey });
      qc.setQueryData(queryKey, (old: typeof data) => ({
        ...old,
        notifications: (old?.notifications ?? [])
          .map((n) => (n.id === id ? { ...n, savedAt: saved ? new Date().toISOString() : null } : n))
          .filter((n) => !showSaved || n.savedAt),
      }));
    },
    onError: (err) => showError('Could not save the notification', err instanceof Error ? err.message : undefined),
    onSettled: () => qc.invalidateQueries({ queryKey: qk('notifications') }),
  });

  const handleRead = useCallback((id: string) => markRead.mutate(id), [markRead]);
  const handleDelete = useCallback((id: string) => deleteN.mutate(id), [deleteN]);
  const handleToggleSave = useCallback((id: string, saved: boolean) => {
    saveN.mutate({ id, saved }, {
      onSuccess: () => {
        // Leaving the Saved view is the one change that takes the row away.
        if (saved || !showSaved) return;
        success('Removed from Saved', undefined, {
          action: { label: sayOne('Undo', 'Αναίρεση'), onClick: () => saveN.mutate({ id, saved: true }) },
        });
      },
    });
  }, [saveN, showSaved, success, sayOne]);

  // What the list shows, and each row's Mark read / Delete as commands.
  usePageList([
    {
      id: 'notifications',
      labelEn: 'Notifications',
      labelEl: 'Ειδοποιήσεις',
      rows: isLoading || !data?.notifications ? undefined : notifications.map((n) =>
        `${n.readAt ? '' : '(unread) '}${n.savedAt ? '(saved) ' : ''}${n.title}${n.body ? ` · ${n.body}` : ''} · ${notificationNextAction(n)?.en ?? n.type} · ${n.createdAt?.slice(0, 10) ?? ''}`,
      ),
      rowsEl: isLoading || !data?.notifications ? undefined : notifications.map((n) =>
        `${n.readAt ? '' : '(αδιάβαστη) '}${n.savedAt ? '(αποθηκευμένη) ' : ''}${notificationEl(n.title)}${n.body ? ` · ${notificationEl(n.body)}` : ''} · ${notificationNextAction(n)?.el ?? elWord(n.type)} · ${n.createdAt?.slice(0, 10) ?? ''}`,
      ),
    },
  ]);
  usePageControls([
    {
      id: 'open_notification_action',
      labelEn: 'Open next notification action',
      labelEl: 'Άνοιγμα επόμενης ενέργειας ειδοποίησης',
      writes: false,
      options: rowOptions(notifications.filter((n) => notificationNextAction(n)), (n) => n.id, (n) => n.title),
      run: (v) => {
        const row = notifications.find((n) => n.id === v);
        const action = row && notificationNextAction(row);
        if (action) router.push(action.href);
      },
    },
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
    {
      id: 'save_notification',
      labelEn: 'Save notification for later',
      labelEl: 'Αποθήκευση ειδοποίησης για αργότερα',
      writes: true,
      options: rowOptions(notifications.filter((n) => !n.savedAt), (n) => n.id, (n) => n.title),
      run: async (v) => { if (v) await saveN.mutateAsync({ id: v, saved: true }); },
      undo: (v) => (v ? { control: 'unsave_notification', value: v } : undefined),
    },
    {
      id: 'unsave_notification',
      labelEn: 'Remove notification from Saved',
      labelEl: 'Αφαίρεση ειδοποίησης από τις αποθηκευμένες',
      writes: true,
      options: rowOptions(notifications.filter((n) => n.savedAt), (n) => n.id, (n) => n.title),
      run: async (v) => { if (v) await saveN.mutateAsync({ id: v, saved: false }); },
      undo: (v) => (v ? { control: 'save_notification', value: v } : undefined),
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
  const activeFilter = FILTER_TABS.find((f) => f.value === activeTab);

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
      badge: bulkMode ? 1 : null,
      content: (
        <div className="space-y-1">
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
      askAi={ASK.notifications}
    >
      <div className="space-y-6">
        <LiveNotices />
        {/* Notification list */}
        <Card className="overflow-hidden">
          {/* The inbox's own header, as on GitHub: which notifications are
              shown (all or unread, and the category if one is chosen) on the
              left, the action on all of them on the right. */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2.5 sm:gap-2 sm:px-6">
            <div role="group" aria-label={bilingualAria('Show', 'Εμφάνιση')} className="inline-flex rounded-lg border border-border p-0.5">
              {([
                { value: 'all', en: notificationsEn('filter_all'), el: notificationsEl('filter_all') },
                { value: 'unread', en: notificationsEn('unread'), el: notificationsEl('unread') },
                { value: 'saved', en: 'Saved', el: 'Αποθηκευμένες' },
              ] as Array<{ value: InboxView; en: string; el: string }>).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={view === option.value}
                  onClick={() => setView(option.value)}
                  className={cn(
                    'tap-target-y inline-flex items-center rounded-md px-2 py-1 text-xs font-medium transition-colors sm:px-2.5',
                    view === option.value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <BilingualText en={option.en} el={option.el} compact />
                  {option.value === 'unread' && unreadCount > 0 ? <Counter value={unreadCount} tone="attention" /> : null}
                </button>
              ))}
            </div>
            {activeFilter && activeFilter.value !== 'all' ? (
              <button
                type="button"
                onClick={() => { setActiveTab('all'); setSelectedIds(new Set()); }}
                className="tap-target-y inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-foreground hover:bg-muted/60"
                aria-label={bilingualAria(`Clear filter: ${activeFilter.labelEn}`, `Καθαρισμός φίλτρου: ${activeFilter.labelEl}`)}
              >
                <BilingualText en={activeFilter.labelEn} el={activeFilter.labelEl} compact />
                <X className="icon-sm text-muted-foreground" aria-hidden="true" />
              </button>
            ) : null}
            {unreadCount > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-8 gap-1.5 px-2.5 text-xs max-sm:w-8 max-sm:px-0"
                onClick={categoryChosen ? markShownWithUndo : markAllWithUndo}
                disabled={markAllRead.isPending || markShownRead.isPending}
                title={categoryChosen
                  ? bilingualAria('Mark these read', 'Σήμανση αυτών ως αναγνωσμένων')
                  : bilingualAria(notificationsEn('mark_all_read'), notificationsEl('mark_all_read'))}
              >
                <span data-keep-icon="" className="sm:hidden"><CheckCheck className="icon-sm" aria-hidden="true" /></span>
                {/* The inbox's tools on one row on a phone (docs §115): the
                    words stay for a screen reader and in the tooltip. */}
                <span className="max-sm:sr-only">
                  {categoryChosen ? (
                    <BilingualText en="Mark these read" el="Σήμανση αυτών ως αναγνωσμένων" compact />
                  ) : (
                    <BilingualText en={notificationsEn('mark_all_read')} el={notificationsEl('mark_all_read')} compact />
                  )}
                </span>
              </Button>
            ) : null}
          </div>
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
          ) : notifications.length === 0 && showSaved ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <Bookmark className="icon-lg text-muted-foreground" />
              </div>
              <div>
                <p className="card-title text-foreground">
                  <BilingualText en="Nothing saved yet" el="Δεν έχετε αποθηκεύσει τίποτα ακόμη" />
                </p>
                <p className="card-body mt-1 text-muted-foreground">
                  <BilingualText
                    en="Save a notification to keep it here for later, read or not."
                    el="Αποθηκεύστε μια ειδοποίηση για να τη βρίσκετε εδώ αργότερα, διαβασμένη ή όχι."
                  />
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setView('all')}>
                <BilingualText en={notificationsEn('show_all_notifications')} el={notificationsEl('show_all_notifications')} compact />
              </Button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <Bell className="icon-lg text-muted-foreground" />
              </div>
              <div>
                <p className="card-title text-foreground">
                  <BilingualText
                    en={showUnreadOnly ? notificationsEn('empty_no_unread_title') : notificationsEn('empty_all_caught_up')}
                    el={showUnreadOnly ? notificationsEl('empty_no_unread_title') : notificationsEl('empty_all_caught_up')}
                  />
                </p>
                <p className="card-body mt-1 text-muted-foreground">
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
                  <Button variant="outline" size="sm" onClick={() => setView('all')}>
                    <BilingualText en={notificationsEn('show_all_notifications')} el={notificationsEl('show_all_notifications')} compact />
                  </Button>
                )}
                <AIInsightButton
                  prompt={ASK.notificationsDone}
                  variant="outline"
                  size="sm"
                />
              </div>
            </div>
          ) : (
            grouped.map(({ label, items }) => (
              <div key={label}>
                <div className="border-b border-border bg-muted/30 px-4 py-2 sm:px-6">
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
                    onToggleSave={handleToggleSave}
                    selectable={bulkMode}
                    selected={selectedIds.has(item.id)}
                    onSelect={toggleSelect}
                  />
                ))}
              </div>
            ))
          )}
        </Card>

        {/* No count line under the list: "Showing 3 notifications · 2
            unread" repeated the rows on screen and the Unread counter above
            them, and the selection count is on the rail's buttons (§76). */}
      </div>
    </AppShell>
  );
}
