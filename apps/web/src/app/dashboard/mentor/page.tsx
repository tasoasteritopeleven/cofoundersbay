'use client';

import Link from 'next/link';
import {
  Calendar,
  Clock,
  DollarSign,
  GraduationCap,
  MessageCircle,
  Star,
  TrendingUp,
  UserCheck,
  Users,
  Video,
  Zap,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { BilingualText } from '@/components/common/BilingualText';
import { MetricTile } from '@/components/dashboard/MetricTile';
import { EmptyLine, QuickLinks, RowHead, SectionCard } from '@/components/dashboard/SectionCard';
import { bilingualInline } from '@/lib/i18n/format';
import { useSession } from '@/hooks/useSession';
import { useDemoData } from '@/contexts/DemoDataContext';
import { cn, initialsOf } from '@/lib/utils';
import {
  getMeProfile,
  getMentorDashboardStats,
  getMyMentorships,
  getMyReceivedMentorRequests,
  getUpcomingMentorshipSessions,
  listMentorBookings,
} from '@/lib/api';
import { fromBooking } from '@/lib/mentoring/sessions';
import { mentorDemoMonthEarnings, mentorDemoRating } from '@/lib/demo/mentor-world';
import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting';
import { dashboardEl, dashboardEn } from '@/lib/i18n/strings-dashboard';
import { qk, queryKeys } from '@/lib/query-keys';
import { WhatsNewPanel } from '@/components/dashboard/WhatsNewPanel';

type MenteeRow = { id: string; name: string; startup: string | null; sessionsCompleted: number; avatarUrl: string | null };
type SessionRow = { id: string; menteeName: string; scheduledAt: string; duration: number; meetingUrl?: string | null };
type RequestRow = { id: string; name: string; message?: string | null; avatarUrl: string | null };

/** "Sat 26 Sep · 10:00" (or "Σάβ 26 Σεπ · 10:00") in the reader's own calendar. */
function sessionWhen(iso: string, locale: 'en-GB' | 'el-GR' = 'en-GB'): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
}

function MenteeRowItem({ mentee }: { mentee: MenteeRow }) {
  return (
    <RowHead
      mark={(
        <Avatar className="h-10 w-10">
          <AvatarImage src={mentee.avatarUrl ?? undefined} alt="" />
          <AvatarFallback className="bg-primary/10 text-primary-accessible">{initialsOf(mentee.name)}</AvatarFallback>
        </Avatar>
      )}
      title={<span className="block truncate">{mentee.name}</span>}
      subtitle={(
        <span className="block truncate">
          {mentee.startup || <BilingualText en="No startup yet" el="Χωρίς startup ακόμη" compact />}
        </span>
      )}
      asideStays
      aside={(
        <>
          <span className="tabular-nums">
            <BilingualText
              en={`${mentee.sessionsCompleted} ${mentee.sessionsCompleted === 1 ? 'session' : 'sessions'}`}
              el={`${mentee.sessionsCompleted} ${mentee.sessionsCompleted === 1 ? 'συνεδρία' : 'συνεδρίες'}`}
              compact
            />
          </span>
          {/* Named per mentee: three unnamed icon buttons read as "button" three
              times, and axe reported button-name (critical). */}
          <Button variant="ghost" size="icon" aria-label={bilingualInline(`Message ${mentee.name}`, `Μήνυμα σε ${mentee.name}`)} asChild>
            <Link href={mentee.id ? `/messages?to=${mentee.id}` : '/messages'}>
              <MessageCircle className="icon-sm" aria-hidden="true" />
            </Link>
          </Button>
        </>
      )}
    />
  );
}

/** The next session stands out by its filled Join button; the rest are a quiet list. */
function SessionRowItem({ session, next }: { session: SessionRow; next: boolean }) {
  return (
    <RowHead
      mark={(
        <div data-card-mark="" className={cn('flex h-10 w-10 items-center justify-center rounded-xl', next ? 'bg-primary/10 text-primary-accessible' : 'bg-muted text-muted-foreground')}>
          <Video className="icon-md" aria-hidden="true" />
        </div>
      )}
      title={<span className="block truncate">{session.menteeName}</span>}
      subtitle={(
        <span className="tabular-nums">
          <BilingualText
            en={`${sessionWhen(session.scheduledAt)} · ${session.duration} min`}
            el={`${sessionWhen(session.scheduledAt, 'el-GR')} · ${session.duration} λεπτά`}
            compact
          />
        </span>
      )}
      asideStays
      aside={(
        <Button size="sm" variant={next ? 'default' : 'outline'} asChild>
          {session.meetingUrl ? (
            <a href={session.meetingUrl} target="_blank" rel="noopener noreferrer"><BilingualText en="Join" el="Σύνδεση" compact /></a>
          ) : (
            <Link href="/mentor/sessions"><BilingualText en="Join" el="Σύνδεση" compact /></Link>
          )}
        </Button>
      )}
    />
  );
}

function RequestRowItem({ request }: { request: RequestRow }) {
  return (
    <RowHead
      mark={(
        <Avatar className="h-10 w-10">
          <AvatarImage src={request.avatarUrl ?? undefined} alt="" />
          <AvatarFallback className="bg-muted text-foreground">{initialsOf(request.name)}</AvatarFallback>
        </Avatar>
      )}
      title={request.name}
      subtitle={request.message ? <span className="line-clamp-2 first-letter:uppercase">{request.message}</span> : undefined}
      asideStays
      aside={(
        <Button size="sm" variant="outline" asChild>
          <Link href="/mentor/requests"><BilingualText en="Review" el="Εξέταση" compact /></Link>
        </Button>
      )}
    />
  );
}

export default function MentorDashboard() {
  const { hasSession, mounted } = useSession();
  const { showDemoData } = useDemoData();

  const { data: profile } = useQuery({
    queryKey: queryKeys.me.profile(),
    queryFn: getMeProfile,
    enabled: hasSession && mounted,
  });

  const displayName = profile?.profile?.displayName || 'Mentor';

  /*
   * Read from the mentorship endpoints the mentor pages use. The figures
   * were constants - 8 mentees, 47 sessions, a 4.8 "based on 32 reviews",
   * "2 new this month", "24 mentees helped", "Top 10% mentor" - with mentees
   * and requests nobody on /mentor/mentees or /mentor/requests had heard of.
   * Earnings and reviews have no endpoint yet; in the showcase they come from
   * the same rows /mentor/earnings and /mentor/reviews list, and outside it
   * the cards say there is nothing recorded rather than showing a number.
   */
  const enabled = hasSession && mounted;
  const { data: stats } = useQuery({
    queryKey: qk('mentorships', 'dashboard', 'mentor'),
    queryFn: getMentorDashboardStats,
    enabled,
    retry: 0,
  });
  const { data: relData } = useQuery({
    queryKey: qk('mentorships', 'mentor'),
    queryFn: () => getMyMentorships('mentor'),
    enabled,
    retry: 0,
  });
  const { data: sessionData } = useQuery({
    queryKey: qk('mentorships', 'sessions-upcoming'),
    queryFn: getUpcomingMentorshipSessions,
    enabled,
    retry: 0,
  });
  const { data: requestData } = useQuery({
    queryKey: qk('mentorships', 'requests-received'),
    queryFn: getMyReceivedMentorRequests,
    enabled,
    retry: 0,
  });
  // Founders' direct bookings (the /mentoring store) count on the mentor's
  // calendar too - before this read they were invisible here.
  const { data: bookingData } = useQuery({
    queryKey: qk('mentorships', 'bookings', 'mentor'),
    queryFn: () => listMentorBookings('mentor'),
    enabled,
    retry: 0,
  });

  const relationships = relData?.relationships ?? [];
  const activeRelationships = relationships.filter((r) => r.status === 'active');
  const relById = new Map(relationships.map((r) => [r.id, r]));
  // The endpoint returns both sides of the reader's calendar; this page is
  // the sessions they give.
  const upcomingSessions = (sessionData?.sessions ?? [])
    .filter((x) => relById.has(x.relationshipId))
    .map((x) => ({
      id: x.id,
      menteeName: relById.get(x.relationshipId)?.mentee?.displayName ?? 'Mentee',
      scheduledAt: x.scheduledAt,
      duration: x.duration,
      meetingUrl: x.meetingUrl,
    }));
  const requestedBookings = (bookingData?.bookings ?? []).filter((b) => b.status === 'requested');
  const upcomingBookings = (bookingData?.bookings ?? [])
    .filter((b) => b.status === 'requested' || b.status === 'confirmed')
    .map((b) => {
      const u = fromBooking(b, null);
      return {
        id: b.id,
        menteeName: u.counterpart.displayName,
        scheduledAt: u.startAt,
        duration: u.durationMin ?? 0,
        meetingUrl: u.meetingUrl,
      };
    });
  const upcomingAll = [...upcomingSessions, ...upcomingBookings].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const mentees = activeRelationships.map((r) => ({
    id: r.menteeId,
    name: r.mentee?.displayName ?? 'Mentee',
    startup: r.mentee?.headline?.replace(/^Founder at /, '') ?? null,
    sessionsCompleted: r.totalSessions,
    avatarUrl: r.mentee?.avatarUrl ?? null,
  }));
  const pendingRequests = (requestData?.requests ?? [])
    .filter((r) => r.status === 'pending')
    .map((r) => ({ id: r.id, name: r.requester?.displayName ?? 'Founder', message: r.message, avatarUrl: r.requester?.avatarUrl ?? null }));

  const month = showDemoData ? mentorDemoMonthEarnings() : null;
  const rating = showDemoData ? mentorDemoRating() : null;
  const averageRating = stats?.averageRating ?? rating?.average ?? null;
  const mentorStats = {
    activeMentees: stats?.activeMentees ?? activeRelationships.length,
    totalSessions: stats?.totalSessions ?? relationships.reduce((sum, r) => sum + r.totalSessions, 0),
    completedMentorships: stats?.completedMentorships ?? relationships.filter((r) => r.status === 'completed').length,
    upcomingSessions: upcomingAll.length,
    avgRating: averageRating == null ? '\u2014' : averageRating.toFixed(1),
    hoursThisMonth: month ? Math.round((month.minutes / 60) * 10) / 10 : null,
    earningsThisMonth: month ? `$${month.amount.toLocaleString('en-US')}` : null,
  };

  const nextSession = upcomingAll[0];
  const nextSessionMinsAway = nextSession
    ? Math.round((new Date(nextSession.scheduledAt).getTime() - Date.now()) / 60000)
    : null;

  if (!mounted) {
    return (
      <AppShell showHelp>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell showHelp
      description="Sessions, mentee requests, reviews, and earnings at a glance."
      descriptionEl="Συνεδρίες, αιτήματα καθοδηγούμενων, αξιολογήσεις και έσοδα με μια ματιά."
      actions={
        <Badge variant="outline" className="gap-1.5">
          <GraduationCap className="icon-sm" aria-hidden="true" />
          Mentor
        </Badge>
      }
    >
      <div className="space-y-6">
        <DashboardGreeting name={displayName} lead={{ en: dashboardEn('mentor_lead'), el: dashboardEl('mentor_lead') }} />
        <WhatsNewPanel audience="mentor" />

        {/* Within the hour, the next session is the one thing on this page. */}
        {nextSessionMinsAway !== null && nextSessionMinsAway <= 60 && nextSessionMinsAway > 0 && nextSession && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-status-info-border bg-status-info-bg px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Video className="icon-sm text-status-info" aria-hidden="true" />
              Session with {nextSession.menteeName} in {nextSessionMinsAway} min
            </p>
            <Button size="sm" variant="outline" asChild>
              {nextSession.meetingUrl ? (
                <a href={nextSession.meetingUrl} target="_blank" rel="noopener noreferrer">Join now</a>
              ) : (
                <Link href="/mentor/sessions">Join now</Link>
              )}
            </Button>
          </div>
        )}

        {/* Four figures, each a different fact and each linking to its rows.
            Rating and hours were drawn twice (a tile and a tinted banner). */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          <MetricTile
            icon={Users}
            label="Active mentees"
            labelEl="Ενεργοί καθοδηγούμενοι"
            value={mentorStats.activeMentees}
            caption={mentorStats.completedMentorships ? `${mentorStats.completedMentorships} completed before` : 'In progress now'}
            captionEl={mentorStats.completedMentorships ? `${mentorStats.completedMentorships} ολοκληρωμένες πριν` : 'Σε εξέλιξη τώρα'}
            href="/mentor/mentees"
          />
          <MetricTile
            icon={Calendar}
            label="Upcoming sessions"
            labelEl="Επόμενες συνεδρίες"
            value={mentorStats.upcomingSessions}
            caption={nextSession ? `Next ${sessionWhen(nextSession.scheduledAt)}` : 'Nothing scheduled'}
            captionEl={nextSession ? `Επόμενη ${sessionWhen(nextSession.scheduledAt, 'el-GR')}` : 'Τίποτα προγραμματισμένο'}
            href="/mentor/sessions"
          />
          <MetricTile
            icon={DollarSign}
            label="Earnings this month"
            labelEl="Έσοδα μήνα"
            value={mentorStats.earningsThisMonth ?? '\u2014'}
            caption={mentorStats.hoursThisMonth != null ? `${mentorStats.hoursThisMonth}h of sessions` : 'Paid sessions appear on Earnings'}
            captionEl={mentorStats.hoursThisMonth != null ? `${mentorStats.hoursThisMonth} ώρες συνεδριών` : 'Οι πληρωμένες συνεδρίες εμφανίζονται στα Έσοδα'}
            href="/mentor/earnings"
          />
          <MetricTile
            icon={Star}
            label="Average rating"
            labelEl="Μέση βαθμολογία"
            value={mentorStats.avgRating}
            caption={rating ? `From ${rating.count} reviews` : averageRating != null ? 'Across your reviews' : 'No reviews recorded yet'}
            captionEl={rating ? `Από ${rating.count} αξιολογήσεις` : averageRating != null ? 'Από τις αξιολογήσεις σας' : 'Καμία αξιολόγηση ακόμα'}
            href="/mentor/reviews"
          />
        </div>

        {/* A booking waits on the mentor, not the founder: surface it as a
            warning line rather than letting it pass for a scheduled session. */}
        {requestedBookings.length > 0 && (
          <Link
            href="/mentor/sessions"
            className="flex items-center gap-2 rounded-xl border border-status-warning-border bg-status-warning-bg px-4 py-3 text-sm font-medium text-status-warning transition-colors hover:border-status-warning"
          >
            <Calendar className="icon-sm shrink-0" aria-hidden="true" />
            <BilingualText
              en={`${requestedBookings.length} ${requestedBookings.length === 1 ? 'booking' : 'bookings'} await your confirmation`}
              el={`${requestedBookings.length} ${requestedBookings.length === 1 ? 'κράτηση περιμένει' : 'κρατήσεις περιμένουν'} επιβεβαίωση`}
            />
          </Link>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Requests lead when there are any: they wait on this mentor. */}
            {pendingRequests.length > 0 && (
              <SectionCard
                title={`Mentorship requests (${pendingRequests.length})`}
                titleEl={`Αιτήματα καθοδήγησης (${pendingRequests.length})`}
                icon={Zap}
                action={{ href: '/mentor/requests', label: 'View all', labelEl: 'Όλα' }}
                contentClassName="card-rows"
              >
                {pendingRequests.map((request) => (
                  <RequestRowItem key={request.id} request={request} />
                ))}
              </SectionCard>
            )}

            <SectionCard title="Upcoming sessions" titleEl="Επόμενες συνεδρίες" icon={Calendar} action={{ href: '/mentor/sessions', label: 'View all', labelEl: 'Όλες' }} contentClassName="card-rows">
              {upcomingAll.map((session, i) => (
                <SessionRowItem key={session.id} session={session} next={i === 0} />
              ))}
              {upcomingAll.length === 0 && <EmptyLine en="No upcoming sessions scheduled." el="Δεν υπάρχουν προγραμματισμένες συνεδρίες." />}
            </SectionCard>

            <SectionCard title="Your mentees" titleEl="Οι καθοδηγούμενοί σας" icon={UserCheck} action={{ href: '/mentor/mentees', label: 'View all', labelEl: 'Όλοι' }} contentClassName="card-rows">
              {mentees.map((mentee) => (
                <MenteeRowItem key={mentee.id} mentee={mentee} />
              ))}
              {mentees.length === 0 && <EmptyLine en="Accepted requests become mentees here." el="Τα αιτήματα που αποδέχεστε εμφανίζονται εδώ ως καθοδηγούμενοι." />}
            </SectionCard>
          </div>

          <div className="space-y-6">
            <QuickLinks
              label="Mentor pages"
              links={[
                { href: '/mentor/availability', icon: Clock, label: 'Set availability', labelEl: 'Διαθεσιμότητα' },
                { href: '/mentor/requests', icon: UserCheck, label: 'Mentorship requests', labelEl: 'Αιτήματα' },
                { href: '/mentor/sessions', icon: Video, label: 'Sessions', labelEl: 'Συνεδρίες' },
                { href: '/mentor/reviews', icon: Star, label: 'My reviews', labelEl: 'Αξιολογήσεις' },
                { href: '/mentor/earnings', icon: DollarSign, label: 'Earnings', labelEl: 'Έσοδα' },
                { href: '/mentor/profile', icon: TrendingUp, label: 'Mentor profile', labelEl: 'Προφίλ μέντορα' },
              ]}
            />

            <SectionCard title="Your impact" titleEl="Ο αντίκτυπός σας" contentClassName="space-y-2">
              {[
                { en: 'Founders mentored', el: 'Ιδρυτές που καθοδηγήσατε', value: relationships.length },
                { en: 'Sessions given', el: 'Συνεδρίες', value: mentorStats.totalSessions },
                { en: 'Mentorships completed', el: 'Ολοκληρωμένες καθοδηγήσεις', value: mentorStats.completedMentorships },
              ].map((row) => (
                <div key={row.en} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">
                    <BilingualText en={row.en} el={row.el} />
                  </span>
                  <span className="font-semibold tabular-nums">{row.value}</span>
                </div>
              ))}
            </SectionCard>

            <SectionCard title="Availability" titleEl="Διαθεσιμότητα" contentClassName="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">
                  <BilingualText en="Accepting requests" el="Δέχεστε αιτήματα" />
                </span>
                <Badge variant="success"><BilingualText en="Active" el="Ενεργό" compact /></Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                <BilingualText
                  en="Founders can request you while this is on. Set the hours you offer on the availability page."
                  el="Οι ιδρυτές μπορούν να σας στείλουν αίτημα όσο είναι ενεργό. Ορίστε τις ώρες σας στη σελίδα διαθεσιμότητας."
                  wrap
                />
              </p>
              <Button variant="secondary" size="sm" className="w-full" asChild>
                <Link href="/mentor/availability"><BilingualText en="Manage availability" el="Διαχείριση διαθεσιμότητας" compact /></Link>
              </Button>
            </SectionCard>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
