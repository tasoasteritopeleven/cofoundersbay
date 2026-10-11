'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  Check,
  CheckCheck,
  MessageCircle,
  UserPlus,
  Heart,
  Calendar,
  Star,
  Trash2,
  Settings,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { RelativeTime } from '@/components/common/RelativeTime';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn, initialsOf } from '@/lib/utils';

type NotificationType = 'message' | 'connection' | 'match' | 'event' | 'system';

type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  timestamp: Date;
  href?: string;
  actor?: {
    name: string;
    avatarUrl?: string | null;
  };
};

type NotificationCenterProps = {
  notifications: Notification[];
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  onDelete?: (id: string) => void;
};

const notificationIcons: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  message: MessageCircle,
  connection: UserPlus,
  match: Heart,
  event: Calendar,
  system: Star,
};

const notificationColors: Record<NotificationType, string> = {
  message: 'text-status-accent bg-status-accent-bg',
  connection: 'text-status-success bg-status-success-bg',
  match: 'text-status-accent bg-status-accent-bg',
  event: 'text-status-accent bg-status-accent-bg',
  system: 'text-status-warning bg-status-warning-bg',
};


function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
}: {
  notification: Notification;
  onMarkAsRead?: () => void;
  onDelete?: () => void;
}) {
  const Icon = notificationIcons[notification.type];
  const colorClass = notificationColors[notification.type];

  const content = (
    <div
      className={cn(
        'flex gap-3 p-3 rounded-lg transition-colors cursor-pointer',
        notification.read ? 'bg-transparent' : 'bg-primary/5',
        'hover:bg-secondary/60'
      )}
    >
      {notification.actor ? (
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarImage src={notification.actor?.avatarUrl || undefined} />
          <AvatarFallback className="bg-primary/20 text-primary-accessible text-sm">
            {initialsOf(notification.actor.name)}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div
          className={cn(
            'h-10 w-10 flex-shrink-0 rounded-full flex items-center justify-center',
            colorClass
          )}
        >
          <Icon className="icon-md" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              'text-sm line-clamp-1',
              notification.read ? 'text-muted-foreground' : 'text-foreground font-medium'
            )}
          >
            {notification.title}
          </p>
          {!notification.read && (
            <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
          )}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2 mt-0.5">
          {notification.body}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          <RelativeTime date={notification.timestamp} absoluteAfterDays={7} />
        </p>
      </div>
    </div>
  );

  if (notification.href) {
    return (
      <Link href={notification.href} onClick={onMarkAsRead}>
        {content}
      </Link>
    );
  }

  return <button type="button" onClick={onMarkAsRead} className="w-full text-left">{content}</button>;
}

export function NotificationCenter({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const hasNotifications = notifications.length > 0;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        >
          <Bell className="icon-md" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-2xs font-bold text-primary-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[480px] overflow-hidden p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h3 className="font-semibold text-foreground">Notifications</h3>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onMarkAllAsRead?.()}
              >
                <CheckCheck className="icon-sm mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Notification list */}
        <div className="max-h-[360px] overflow-y-auto">
          {hasNotifications ? (
            notifications.slice(0, 20).map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={() => onMarkAsRead?.(notification.id)}
                onDelete={() => onDelete?.(notification.id)}
              />
            ))
          ) : (
            <div className="py-12 text-center">
              <Bell className="mx-auto icon-xl text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {hasNotifications && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button variant="ghost" size="sm" className="w-full justify-center" asChild>
                <Link href="/notifications">
                  View all notifications
                </Link>
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Notification badge for nav items
export function NotificationBadge({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <Badge
      variant="destructive"
      className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 text-2xs font-bold"
    >
      {count > 99 ? '99+' : count}
    </Badge>
  );
}
