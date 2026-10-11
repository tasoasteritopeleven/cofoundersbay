'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RelativeTime } from '@/components/common/RelativeTime';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/lib/api';
import { useHasSession } from '@/hooks/useSession';
import { useAuthenticatedSession } from '@/hooks/useAuthenticatedSession';
import { useApiAvailability } from '@/hooks/useApiAvailability';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { cn, formatRelativeTime } from '@/lib/utils';
import { STATUS } from '@/lib/semantic-colors';
import { CfbGlyph, type CfbGlyphName } from '@/components/icons/CfbGlyph';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualAria } from '@/lib/i18n/format';
import { qk } from '@/lib/query-keys';

const TYPE_GLYPH: Record<string, CfbGlyphName> = {
  message: 'messages',
  connection_request: 'people',
  connection_accepted: 'people',
  match: 'matches',
  event: 'calendar',
  job: 'briefcase',
  group: 'community',
  mention: 'spark',
};

const TYPE_COLOR: Record<string, string> = {
  message: STATUS.info.chip,
  connection_request: STATUS.success.chip,
  connection_accepted: STATUS.success.chip,
  match: STATUS.warning.chip,
  event: STATUS.accent.chip,
  job: STATUS.warning.chip,
  group: STATUS.info.chip,
  mention: STATUS.accent.chip,
};

function NotifIcon({ type }: { type: string }) {
  const name = TYPE_GLYPH[type] ?? 'bell';
  const color = TYPE_COLOR[type] ?? 'bg-secondary text-muted-foreground';
  return (
    <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', color)}>
      <CfbGlyph name={name} className="icon-sm" />
    </div>
  );
}

export function NotificationsBell({ className }: { className?: string }) {
  const router = useRouter();
  const { error: showError } = useToast();
  const hasSession = useHasSession();
  const { isAuthenticated, isChecking } = useAuthenticatedSession();
  const apiAvailable = useApiAvailability();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [hasNew, setHasNew] = useState(false);
  const loadingRef = useRef(false);
  const lastLoadedAt = useRef(0);
  const MIN_RELOAD_MS = 30_000; // minimum 30 s between background reloads

  // The server's count, the one the sidebar and the notifications page show:
  // counting unread among the fifteen rows loaded here said "9+" or "3"
  // depending on which fifteen they were, and never agreed with the sidebar.
  const queryClient = useQueryClient();
  const { notifications: unread } = useUnreadCounts();
  const refreshCounts = () => queryClient.invalidateQueries({ queryKey: qk('notifications') });
  const ready = hasSession && !isChecking && isAuthenticated && apiAvailable;

  const load = async (force = false) => {
    if (loadingRef.current) return;
    const now = Date.now();
    if (!force && now - lastLoadedAt.current < MIN_RELOAD_MS) return;

    if (!ready) {
      setItems([]);
      setHasNew(false);
      return;
    }

    loadingRef.current = true;
    setLoading(true);
    try {
      const result = await listNotifications({ limit: 15 });
      lastLoadedAt.current = Date.now();
      setItems(result.notifications);
    } catch {
      // Silent background failure; the menu itself remains usable.
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ready) {
      setItems([]);
      setHasNew(false);
      return;
    }

    void load(true); // force on initial mount / session change

    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') {
        void load(); // rate-limited
      }
    };

    window.addEventListener('focus', refreshIfVisible);
    window.addEventListener('cfb:api-online', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);

    return () => {
      window.removeEventListener('focus', refreshIfVisible);
      window.removeEventListener('cfb:api-online', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!hasSession || isChecking || !isAuthenticated) return null;

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) {
          void load(true); // always fetch fresh when user opens the panel
          setHasNew(false);
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('relative', className)}
          aria-label={
            unread > 0
              ? bilingualAria(
                  `Notifications (${unread} unread)`,
                  `Ειδοποιήσεις (${unread} ${unread === 1 ? 'μη αναγνωσμένη' : 'μη αναγνωσμένες'})`,
                )
              : bilingualAria('Notifications', 'Ειδοποιήσεις')
          }
        >
          <CfbGlyph name="bell" className={cn('icon-md', hasNew && 'animate-pulse')} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-2xs font-bold text-primary-foreground ring-2 ring-background">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="flex max-h-[min(70dvh,520px)] w-[min(380px,calc(100vw-1.5rem))] flex-col overflow-hidden p-0">
        <div className="flex flex-shrink-0 items-center justify-between px-4 py-3">
          <div>
            <span className="text-sm font-semibold text-foreground">
              <BilingualText en="Notifications" el="Ειδοποιήσεις" compact />
            </span>
            {unread > 0 && (
              <span className="ml-2 rounded-full bg-primary/15 px-1.5 py-0.5 text-2xs font-semibold text-primary-accessible">
                <BilingualText en={`${unread} new`} el={`${unread} ${unread === 1 ? 'νέα' : 'νέες'}`} compact />
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            disabled={unread === 0 || loading}
            onClick={async () => {
              try {
                await markAllNotificationsRead();
                setItems((prev) => prev.map((notification) => ({
                  ...notification,
                  readAt: notification.readAt ?? new Date().toISOString(),
                })));
                void refreshCounts();
              } catch (error) {
                showError('Failed to mark read', error instanceof Error ? error.message : 'Please try again');
              }
            }}
          >
            <CheckCheck className="icon-sm" />
            <BilingualText en="Mark all read" el="Ανάγνωση όλων" compact />
          </Button>
        </div>
        <DropdownMenuSeparator className="my-0" />

        <div className="flex-1 overflow-y-auto">
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/60">
                <CfbGlyph name="bell" className="icon-md text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {loading ? 'Loading...' : "You're all caught up!"}
              </p>
            </div>
          )}

          {items.map((notification) => (
            <button
              key={notification.id}
              className={cn(
                'flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-secondary/50 last:border-0',
                !notification.readAt && 'bg-primary/5',
              )}
              onClick={async () => {
                try {
                  if (!notification.readAt) {
                    await markNotificationRead(notification.id);
                    setItems((prev) =>
                      prev.map((item) => (
                        item.id === notification.id
                          ? { ...item, readAt: new Date().toISOString() }
                          : item
                      )),
                    );
                    void refreshCounts();
                  }
                } catch {
                  // Ignore best-effort read receipts here.
                }

                if (notification.link) {
                  router.push(notification.link);
                }
              }}
            >
              <NotifIcon type={notification.type} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={cn(
                      'text-xs leading-snug',
                      !notification.readAt ? 'font-semibold text-foreground' : 'font-medium text-foreground/80',
                    )}
                  >
                    {notification.title}
                  </p>
                  <span className="mt-0.5 shrink-0 text-2xs text-muted-foreground">
                    <RelativeTime date={notification.createdAt} format={formatRelativeTime} />
                  </span>
                </div>
                {notification.body && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
                )}
              </div>
              {!notification.readAt && (
                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>

        {items.length > 0 && (
          <>
            <DropdownMenuSeparator className="my-0" />
            <div className="flex-shrink-0 px-4 py-2.5">
              <button
                className="w-full text-center text-xs text-primary-accessible hover:underline"
                onClick={() => router.push('/notifications')}
              >
                View all notifications
              </button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
