'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getNativeWebSocketOrigin } from '@/lib/api-origin';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Check,
  X,
  MessageCircle,
  UserPlus,
  Heart,
  Calendar,
  Briefcase,
  Award,
  TrendingUp,
  Settings,
  Filter,
  CheckCheck,
  Trash2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RelativeTime } from '@/components/common/RelativeTime';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { listNotifications, markNotificationRead, markAllNotificationsRead, type NotificationItem } from '@/lib/api';
import { usePollingGuards } from '@/hooks/usePollingGuards';
import { qk } from '@/lib/query-keys';

import { pressableProps } from '@/lib/pressable';
// Use NotificationItem from @/lib/api

const NOTIFICATION_ICONS = {
  message: MessageCircle,
  connection: UserPlus,
  like: Heart,
  comment: MessageCircle,
  event: Calendar,
  job: Briefcase,
  achievement: Award,
  system: TrendingUp,
};

const NOTIFICATION_COLORS = {
  message: 'text-status-info',
  connection: 'text-status-success',
  like: 'text-status-danger',
  comment: 'text-status-accent',
  event: 'text-status-warning',
  job: 'text-status-info',
  achievement: 'text-status-warning',
  system: 'text-muted-foreground',
};

function NotificationRow({
  notification,
  onMarkAsRead,
  onDelete,
}: {
  notification: NotificationItem;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const Icon = NOTIFICATION_ICONS[notification.type as keyof typeof NOTIFICATION_ICONS] || NOTIFICATION_ICONS.system;

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 hover:bg-secondary/40 transition-colors cursor-pointer',
        !notification.readAt && 'bg-primary/5'
      )}
      onClick={() => {
        if (!notification.readAt) {
          onMarkAsRead(notification.id);
        }
        if (notification.link) {
          window.location.href = notification.link;
        }
      }}
      // Rows that navigate keep a link role (inner buttons stay announced).
      // A linkless row only marks itself read on click — the same action the
      // inline button already gives keyboard users — so it stays unfocusable
      // rather than wrapping those buttons in a presentational button role.
      {...(notification.link ? pressableProps({ role: 'link' }) : {})}
    >
      <div className={cn('p-2 rounded-full bg-secondary/40 shrink-0', NOTIFICATION_COLORS[notification.type as keyof typeof NOTIFICATION_COLORS] || NOTIFICATION_COLORS.system)}>
        <Icon className="icon-sm" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className="font-semibold text-sm line-clamp-1">{notification.title}</h4>
          {!notification.readAt && (
            <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />
          )}
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-1">
          {notification.body}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground"><RelativeTime date={notification.createdAt} absoluteAfterDays={7} /></span>
          <div className="flex items-center gap-1">
            {!notification.readAt && (
              <Button aria-label="Mark as read"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkAsRead(notification.id);
                }}
              >
                <Check className="icon-sm" />
              </Button>
            )}
            <Button aria-label="Delete notification"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(notification.id);
              }}
            >
              <X className="icon-sm" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const queryClient = useQueryClient();
  const { apiAvailable, pollInterval } = usePollingGuards();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: qk('notifications', filter, categoryFilter),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter === 'unread') params.append('unread', 'true');
      if (categoryFilter !== 'all') params.append('type', categoryFilter);
      
      const result = await listNotifications();
      let items = result?.notifications ?? [];
      if (filter === 'unread') {
        items = items.filter((n) => !n.readAt);
      }
      if (categoryFilter !== 'all') {
        items = items.filter((n) => n.type === categoryFilter);
      }
      return items;
    },
    enabled: apiAvailable,
    refetchInterval: pollInterval(30_000),
    refetchIntervalInBackground: false,
    retry: 0,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await markNotificationRead(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('notifications') });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await markAllNotificationsRead();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('notifications') });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Delete not yet implemented in API, mark as read instead
      await markNotificationRead(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('notifications') });
    },
  });

  const unreadCount = notifications.filter((n: NotificationItem) => n.readAt === null).length;

  useEffect(() => {
    if (!apiAvailable || typeof window === 'undefined' || !('WebSocket' in window)) return;

    const ws = new WebSocket(getNativeWebSocketOrigin());

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'notification') {
        queryClient.invalidateQueries({ queryKey: qk('notifications') });

        if (Notification.permission === 'granted') {
          new Notification(data.title, {
            body: data.message,
            icon: '/logo.png',
          });
        }
      }
    };

    return () => ws.close();
  }, [queryClient, apiAvailable]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const categories = [
    { value: 'all', label: 'All', icon: Bell },
    { value: 'message', label: 'Messages', icon: MessageCircle },
    { value: 'connection', label: 'Connections', icon: UserPlus },
    { value: 'event', label: 'Events', icon: Calendar },
    { value: 'job', label: 'Jobs', icon: Briefcase },
  ];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        >
          <Bell className="icon-md" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[400px] p-0">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-lg">Notifications</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={unreadCount === 0}
              >
                <CheckCheck className="icon-sm mr-1" />
                Mark all read
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Notification settings" asChild>
                <Link href="/settings/notifications">
                  <Settings className="icon-sm" />
                </Link>
              </Button>
            </div>
          </div>

          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1">
                All ({notifications.length})
              </TabsTrigger>
              <TabsTrigger value="unread" className="flex-1">
                Unread ({unreadCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex gap-2 mt-3 flex-wrap">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <button
                  key={category.value}
                  type="button"
                  aria-pressed={categoryFilter === category.value}
                  className={cn(badgeVariants({ variant: categoryFilter === category.value ? 'default' : 'outline' }), 'border-0 shadow-none !shadow-none cursor-pointer gap-1')}
                  onClick={() => setCategoryFilter(category.value)}
                >
                  <Icon className="icon-sm" />
                  {category.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="max-h-[500px] overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" aria-hidden="true" />
              <h4 className="font-semibold mb-1">No notifications</h4>
              <p className="text-sm text-muted-foreground">
                You're all caught up!
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification: NotificationItem) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={(id) => markAsReadMutation.mutate(id)}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </div>

        {notifications.length > 0 && (
          <div className="p-3 border-t text-center">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setOpen(false)}>
              View all notifications
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
