'use client';

import Link from 'next/link';
import { Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export type ActiveMember = {
  id: string;
  displayName: string;
  initials?: string;
  avatarUrl?: string | null;
  isOnline?: boolean;
};

const defaultMembers: ActiveMember[] = [
  { id: '1', displayName: 'Alex K.', initials: 'AK', isOnline: true },
  { id: '2', displayName: 'Maria P.', initials: 'MP', isOnline: true },
  { id: '3', displayName: 'Nikos D.', initials: 'ND', isOnline: true },
  { id: '4', displayName: 'Elena V.', initials: 'EV', isOnline: false },
  { id: '5', displayName: 'Chris M.', initials: 'CM', isOnline: true },
];

type DashboardMembersProps = {
  members?: ActiveMember[] | null;
  className?: string;
};

export function DashboardMembers({ members = defaultMembers, className }: DashboardMembersProps) {
  const list = members ?? defaultMembers;

  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Users className="icon-sm text-muted-foreground" />
          Who&apos;s online
        </CardTitle>
        <Link href="/discover" className="text-xs text-muted-foreground hover:text-primary-accessible">View all</Link>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {list.slice(0, 5).map((m) => (
            <li key={m.id}>
              <Link
                href={`/profiles/${m.id}`}
                className="flex items-center gap-3 rounded-lg p-2 text-sm transition-colors hover:bg-secondary/60"
              >
                <div className="relative">
                  <Avatar className="h-8 w-8">
                    {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt="" />}
                    <AvatarFallback className="text-xs">{m.initials ?? m.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  {m.isOnline !== false && (
                    <span
                      className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-status-success-mark ring-2 ring-card"
                      aria-label="Online"
                    />
                  )}
                </div>
                <span className="truncate text-foreground">{m.displayName}</span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
