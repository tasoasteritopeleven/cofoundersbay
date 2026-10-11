'use client';

import { StatusText } from '@/components/common/StatusText';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  MessageCircle,
  Calendar,
  Target,
  TrendingUp,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useSession } from '@/hooks/useSession';
import { qk } from '@/lib/query-keys';
import { useRouter } from 'next/navigation';
import { rowOptions, usePageControls, usePageList } from '@/lib/page-controls';
import {
  getMyMentorships,
  listMentorBookings,
  type MentorshipRelationshipItem,
} from '@/lib/api';
import { isUpcoming, fromBooking } from '@/lib/mentoring/sessions';
import { BilingualText } from '@/components/common/BilingualText';
import { useDateFormat } from '@/lib/i18n/useDateFormat';
import { FactLine } from '@/components/common/FactLine';
import { CardHead, CardFoot } from '@/components/common/CardAnatomy';

function MenteeCard({ relationship, upcomingBookings = 0 }: { relationship: MentorshipRelationshipItem; upcomingBookings?: number }) {
  const fmtDate = useDateFormat();
  const mentee = relationship.mentee;
  const displayName = mentee?.displayName || 'Unknown';
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '??';

  const statusColors: Record<string, string> = {
    active: 'bg-status-success-bg text-status-success border-status-success-border',
    paused: 'bg-status-warning-bg text-status-warning border-status-warning-border',
    completed: 'bg-status-info-bg text-status-info border-status-info-border',
    cancelled: 'bg-status-danger-bg text-status-danger border-status-danger-border',
  };

  const nextSessionFormatted = relationship.nextSessionAt
    ? fmtDate(relationship.nextSessionAt, { month: 'short', day: 'numeric' })
    : null;

  const startedAtFormatted = fmtDate(relationship.startedAt, { month: 'short', year: 'numeric' });

  return (
    <Card className="transition-all hover:border-primary/20">
      <CardContent className="space-y-3">
        <CardHead
          mark={(
            <Link href={`/p/${relationship.menteeId}`} aria-label={displayName}>
              <Avatar className="h-10 w-10">
                <AvatarImage src={mentee?.avatarUrl || undefined} alt="" />
                <AvatarFallback className="bg-primary/10 text-primary-accessible font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Link>
          )}
          title={(
            <Link href={`/p/${relationship.menteeId}`} className="hover:text-primary-accessible transition-colors">
              {displayName}
            </Link>
          )}
          subtitle={mentee?.headline ? <span className="line-clamp-1">{mentee.headline}</span> : undefined}
          aside={(
            <Badge variant="outline" className={cn('text-xs', statusColors[relationship.status])}>
              <StatusText value={relationship.status} />
            </Badge>
          )}
        />

        {/* Focus areas, then the relationship's figures, on the avatar's edge. */}
        <FactLine items={relationship.focusAreas ?? []} />

        <FactLine
          items={[
            <BilingualText
              key="sessions"
              en={`${relationship.totalSessions} ${relationship.totalSessions === 1 ? 'session' : 'sessions'}`}
              el={`${relationship.totalSessions} ${relationship.totalSessions === 1 ? 'συνεδρία' : 'συνεδρίες'}`}
              compact
            />,
            nextSessionFormatted ? (
              <span key="next" className="text-primary-accessible">
                <BilingualText en={`Next: ${nextSessionFormatted}`} el={`Επόμενη: ${nextSessionFormatted}`} compact />
              </span>
            ) : null,
            upcomingBookings > 0 ? (
              <span key="bookings" className="text-status-warning">
                <BilingualText
                  en={`${upcomingBookings} ${upcomingBookings === 1 ? 'booking' : 'bookings'}`}
                  el={`${upcomingBookings} ${upcomingBookings === 1 ? 'κράτηση' : 'κρατήσεις'}`}
                  compact
                />
              </span>
            ) : null,
          ]}
        />

        <CardFoot meta={<BilingualText en={`Started ${startedAtFormatted}`} el={`Ξεκίνησε ${startedAtFormatted}`} compact />}>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/messages?to=${relationship.menteeId}`}>
              <MessageCircle className="icon-sm mr-1" aria-hidden="true" />
              <BilingualText en="Message" el="Μήνυμα" compact />
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/mentor/sessions?new=1&mentee=${relationship.menteeId}`}>
              <Calendar className="icon-sm mr-1" aria-hidden="true" />
              <BilingualText en="Schedule" el="Προγραμματισμός" compact />
            </Link>
          </Button>
        </CardFoot>
      </CardContent>
    </Card>
  );
}

export default function MenteesPage() {
  const { hasSession, mounted } = useSession();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk('mentorships', 'mentor'),
    queryFn: () => getMyMentorships('mentor'),
    enabled: hasSession && mounted,
  });
  // Direct bookings (the /mentoring store) tell the mentor who else has
  // booked time - including people with no relationship yet.
  const { data: bookingData } = useQuery({
    queryKey: qk('mentorships', 'bookings', 'mentor'),
    queryFn: () => listMentorBookings('mentor'),
    enabled: hasSession && mounted,
    staleTime: 30_000,
    retry: 0,
  });

  const relationships = data?.relationships || [];
  const activeRelationships = relationships.filter((r) => r.status === 'active');
  const completedRelationships = relationships.filter((r) => r.status === 'completed');
  const pausedRelationships = relationships.filter((r) => r.status === 'paused');

  const menteeIds = new Set(relationships.map((r) => r.menteeId));
  const upcomingBookingsByMentee = new Map<string, number>();
  const orphanBookers = new Set<string>();
  for (const b of bookingData?.bookings ?? []) {
    if (!isUpcoming(fromBooking(b, null))) continue;
    if (menteeIds.has(b.menteeId)) {
      upcomingBookingsByMentee.set(b.menteeId, (upcomingBookingsByMentee.get(b.menteeId) ?? 0) + 1);
    } else {
      orphanBookers.add(b.menteeId);
    }
  }

  // Offered to the assistant, above the loading and error returns: each
  // card's Message and Schedule, which are links to the same places.
  const router = useRouter();
  const byMentee = (list: typeof relationships) => rowOptions(list, (r) => r.menteeId, (r) => r.mentee?.displayName || 'Mentee');
  usePageList([
    {
      id: 'mentees',
      labelEn: 'Mentees',
      labelEl: 'Καθοδηγούμενοι',
      rows: isLoading ? undefined : relationships.map((r) => `${r.mentee?.displayName || 'Unknown'} · ${r.status}${r.nextSessionAt ? ` · next session ${r.nextSessionAt.slice(0, 10)}` : ''}`),
    },
  ]);
  usePageControls([
    { id: 'message_mentee', labelEn: 'Message mentee', labelEl: 'Μήνυμα σε καθοδηγούμενο', writes: false, options: byMentee(relationships), run: (v) => { if (v) router.push(`/messages?to=${v}`); } },
    { id: 'schedule_with_mentee', labelEn: 'Schedule a session with', labelEl: 'Προγραμματισμός συνεδρίας με', writes: false, options: byMentee(activeRelationships), run: (v) => { if (v) router.push(`/mentor/sessions?new=1&mentee=${v}`); } },
  ]);

  if (!mounted) {
    return (
      <AppShell showHelp>
        <div className="py-6 flex items-center justify-center min-h-[400px]">
          <Loader2 className="icon-xl animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell showHelp>
        <div className="py-6">
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-destructive-accessible mb-4" />
              <h3 className="font-medium"><BilingualText en="Failed to load mentees" el="Δεν ήταν δυνατή η φόρτωση των μαθητευόμενων" compact /></h3>
              <p className="text-sm text-muted-foreground mt-1">
                {error instanceof Error ? error.message : 'An error occurred'}
              </p>
              <Button className="mt-4" onClick={() => refetch()}>
                <RefreshCw className="icon-sm mr-2" />
                <BilingualText en="Try Again" el="Δοκιμάστε ξανά" compact />
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  const totalSessions = relationships.reduce((acc, r) => acc + (r.totalSessions || 0), 0);

  return (
    <AppShell showHelp
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={cn('icon-sm mr-2', isLoading && 'animate-spin')} />
            <BilingualText en="Refresh" el="Ανανέωση" compact />
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* A booking can arrive before a mentorship exists: name the gap and
            send the mentor to the page that answers it. */}
        {orphanBookers.size > 0 && (
          <Link
            href="/mentor/sessions"
            className="flex items-center gap-2 rounded-xl border border-status-warning-border bg-status-warning-bg px-4 py-3 text-sm font-medium text-status-warning transition-colors hover:border-status-warning"
          >
            <Calendar className="icon-sm shrink-0" aria-hidden="true" />
            <BilingualText
              en={`${orphanBookers.size} ${orphanBookers.size === 1 ? 'person' : 'people'} booked a session without a mentorship yet`}
              el={`${orphanBookers.size} ${orphanBookers.size === 1 ? 'άτομο έκλεισε' : 'άτομα έκλεισαν'} συνεδρία χωρίς σχέση καθοδήγησης ακόμη`}
            />
          </Link>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 kpi-odd-span-md gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Users className="icon-md text-muted-foreground" />
              </div>
              <div>
                <p className="page-stat text-xl font-bold">{activeRelationships.length}</p>
                <p className="text-sm text-muted-foreground"><BilingualText en="Active Mentees" el="Ενεργοί μαθητευόμενοι" compact /></p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3">
              <div className="rounded-lg bg-status-success-bg p-2">
                <Target className="icon-md text-status-success" />
              </div>
              <div>
                <p className="page-stat text-xl font-bold">{completedRelationships.length}</p>
                <p className="text-sm text-muted-foreground"><BilingualText en="Completed" el="Ολοκληρώθηκε" compact /></p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3">
              <div className="rounded-lg bg-status-info-bg p-2">
                <TrendingUp className="icon-md text-status-info" />
              </div>
              <div>
                <p className="page-stat text-xl font-bold">{totalSessions}</p>
                <p className="text-sm text-muted-foreground"><BilingualText en="Total Sessions" el="Σύνολο συνεδριών" compact /></p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Mentees */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-foreground"><BilingualText en={`Active (${activeRelationships.length})`} el={`Ενεργοί (${activeRelationships.length})`} compact /></h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="icon-xl animate-spin text-muted-foreground" />
            </div>
          ) : activeRelationships.length > 0 ? (
            activeRelationships.map((relationship) => (
              <MenteeCard key={relationship.id} relationship={relationship} upcomingBookings={upcomingBookingsByMentee.get(relationship.menteeId) ?? 0} />
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" aria-hidden="true" />
                <h3 className="font-medium"><BilingualText en="No active mentees" el="Δεν υπάρχουν ενεργοί μαθητευόμενοι" compact /></h3>
                <p className="text-sm text-muted-foreground mt-1">
                  <BilingualText en="Accept mentorship requests to start mentoring" el="Αποδεχτείτε αιτήματα καθοδήγησης για να ξεκινήσετε" wrap />
                </p>
                <Button className="mt-4" asChild>
                  <Link href="/mentor/requests"><BilingualText en="View Requests" el="Προβολή αιτημάτων" compact /></Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Paused Mentees */}
        {pausedRelationships.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground"><BilingualText en={`Paused (${pausedRelationships.length})`} el={`Σε παύση (${pausedRelationships.length})`} compact /></h2>
            {pausedRelationships.map((relationship) => (
              <MenteeCard key={relationship.id} relationship={relationship} upcomingBookings={upcomingBookingsByMentee.get(relationship.menteeId) ?? 0} />
            ))}
          </div>
        )}

        {/* Completed Mentees */}
        {completedRelationships.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground"><BilingualText en={`Completed (${completedRelationships.length})`} el={`Ολοκληρωμένοι (${completedRelationships.length})`} compact /></h2>
            {completedRelationships.map((relationship) => (
              <MenteeCard key={relationship.id} relationship={relationship} upcomingBookings={upcomingBookingsByMentee.get(relationship.menteeId) ?? 0} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
