'use client';

import Link from 'next/link';
import { MessageSquare, UserPlus, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type ActivityItem = {
  id: string;
  type: 'discussion' | 'connection' | 'event';
  title: string;
  author?: string;
  timeAgo?: string;
  href?: string;
};

const defaultActivity: ActivityItem[] = [
  { id: '1', type: 'discussion', title: 'New thread: Best tools for remote co-founder matching', author: 'Alex K.', timeAgo: '2h', href: '#' },
  { id: '2', type: 'connection', title: 'Maria P. and Nikos D. connected', timeAgo: '3h', href: '/discover' },
  { id: '3', type: 'discussion', title: 'Community call recording is live', author: 'Team', timeAgo: '5h', href: '#' },
];

type DashboardActivityProps = {
  items?: ActivityItem[] | null;
  className?: string;
};

export function DashboardActivity({ items = defaultActivity, className }: DashboardActivityProps) {
  const list = items ?? defaultActivity;

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Activity & discussions</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {list.slice(0, 5).map((a) => (
            <li key={a.id}>
              <Link
                href={a.href ?? '#'}
                className="flex items-start gap-3 rounded-lg p-2 text-sm transition-colors hover:bg-secondary/60"
              >
                <span className="mt-0.5 flex shrink-0 text-muted-foreground">
                  {a.type === 'event' ? <Calendar className="icon-sm" /> : a.type === 'connection' ? <UserPlus className="icon-sm" /> : <MessageSquare className="icon-sm" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground truncate">{a.title}</p>
                  {(a.author || a.timeAgo) && (
                    <p className="text-xs text-muted-foreground">
                      {[a.author, a.timeAgo].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
