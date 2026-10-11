'use client';

import { StatusText } from '@/components/common/StatusText';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { ScheduleSessionDialog, RescheduleSessionDialog, SessionNotesDialog } from '@/components/mentoring/SessionDialogs';
import {
  Calendar,
  Clock,
  Video,
  Plus,
  CheckCircle2,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useSession } from '@/hooks/useSession';
import { useStoredUser } from '@/hooks/useStoredUser';
import { qk } from '@/lib/query-keys';
import { CANCELLED, choiceControl, ROW_GONE, rowOptions, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { BookingCard, MEETING_TYPE_LABEL } from '@/components/mentoring/BookingCard';
import { CardHead, CardFoot } from '@/components/common/CardAnatomy';
import { FactLine } from '@/components/common/FactLine';
import { SessionDateTile } from '@/components/mentoring/SessionDateTile';
import { fromBooking, fromMentorshipSession, isUpcoming, mergeSessions, type UnifiedSession } from '@/lib/mentoring/sessions';
import {
  getMentorshipSessions,
  getMyMentorships,
  getUpcomingMentorshipSessions,
  listMentorBookings,
  updateMentorBooking,
  updateMentorshipSession,
  type MentorBookingItem,
  type MentorshipSessionItem,
} from '@/lib/api';
import { BilingualText } from '@/components/common/BilingualText';

type SessionActions = {
  onReschedule: (s: MentorshipSessionItem) => void;
  onCancel: (s: MentorshipSessionItem) => void;
  onNotes: (s: MentorshipSessionItem) => void;
};

function SessionCard({ session, onReschedule, onCancel, onNotes }: { session: MentorshipSessionItem } & SessionActions) {
  const statusColors: Record<string, string> = {
    scheduled: 'bg-status-info-bg text-status-info border-status-info-border',
    completed: 'bg-status-success-bg text-status-success border-status-success-border',
    cancelled: 'bg-status-danger-bg text-status-danger border-status-danger-border',
    no_show: 'bg-status-warning-bg text-status-warning border-status-warning-border',
  };

  const scheduledDate = new Date(session.scheduledAt);
  const formattedTime = scheduledDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  const meetingLabel = session.meetingType ? MEETING_TYPE_LABEL[session.meetingType] : undefined;

  // The booking card's anatomy: the date tile is the mark, the title and
  // time beside it, and the facts, agenda and actions on the tile's edge.
  return (
    <Card className="transition-all hover:border-primary/20">
      <CardContent className="space-y-3">
        <CardHead
          mark={<SessionDateTile date={scheduledDate} />}
          title={session.title || 'Mentorship Session'}
          subtitle={formattedTime}
          aside={(
            <>
              <Badge variant="outline" className={cn('text-xs', statusColors[session.status])}>
                <StatusText value={session.status} />
              </Badge>
              <Badge variant="secondary" className="text-xs">
                <BilingualText en="Mentorship" el="Σχέση καθοδήγησης" compact />
              </Badge>
            </>
          )}
        />

        <FactLine
          items={[
            <BilingualText key="len" en={`${session.duration} min`} el={`${session.duration} λεπτά`} compact />,
            session.meetingType
              ? meetingLabel
                ? <BilingualText key="type" en={meetingLabel.en} el={meetingLabel.el} compact />
                : <StatusText key="type" value={session.meetingType} />
              : null,
          ]}
        />

        {session.agenda && (
          <p className="card-body line-clamp-2 text-muted-foreground first-letter:uppercase">
            {session.agenda}
          </p>
        )}

        {session.status === 'scheduled' && (
          <CardFoot>
            {session.meetingUrl && (
              <Button size="sm" variant="default" asChild>
                <a href={session.meetingUrl} target="_blank" rel="noopener noreferrer">
                  <Video className="icon-sm mr-1" aria-hidden="true" />
                  <BilingualText en="Join Meeting" el="Συμμετοχή στη συνάντηση" compact />
                </a>
              </Button>
            )}
            {/* Both had no handler. */}
            <Button size="sm" variant="outline" onClick={() => onReschedule(session)}>
              <BilingualText en="Reschedule" el="Αλλαγή ώρας" compact />
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive-accessible" onClick={() => onCancel(session)}>
              <BilingualText en="Cancel" el="Ακύρωση" compact />
            </Button>
          </CardFoot>
        )}

        {session.status === 'completed' && (
          <CardFoot>
            <Button size="sm" variant="outline" onClick={() => onNotes(session)}>
              <BilingualText en="View Notes" el="Προβολή σημειώσεων" compact />
            </Button>
          </CardFoot>
        )}
      </CardContent>
    </Card>
  );
}

export default function MentorSessionsPage() {
  const [activeTab, setActiveTab] = useState('upcoming');
  const { hasSession, mounted } = useSession();
  const viewerId = useStoredUser()?.id ?? null;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk('mentorships', 'sessions-upcoming'),
    queryFn: getUpcomingMentorshipSessions,
    enabled: hasSession && mounted,
  });
  // The upcoming endpoint returns only what is still scheduled, so "Past"
  // and "Completed" could never show anything. Each mentorship's own session
  // list carries its history; the mentees page reads the same relationships.
  const { data: relData } = useQuery({
    queryKey: qk('mentorships', 'mentor'),
    queryFn: () => getMyMentorships('mentor'),
    enabled: hasSession && mounted,
  });
  const historyQueries = useQueries({
    queries: (relData?.relationships ?? []).map((r) => ({
      queryKey: qk('mentorships', 'sessions', r.id),
      queryFn: () => getMentorshipSessions(r.id),
      staleTime: 60_000,
      retry: 0,
    })),
  });
  const history = historyQueries.flatMap((q) => q.data?.sessions ?? []);
  // Bookings are the same sessions booked directly on /mentoring; until this
  // read they were invisible to the mentor they were sent to.
  const { data: bookingData, isLoading: bookingsLoading } = useQuery({
    queryKey: qk('mentorships', 'bookings', 'mentor'),
    queryFn: () => listMentorBookings('mentor'),
    enabled: hasSession && mounted,
    staleTime: 30_000,
    retry: 0,
  });
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { success, error: toastError } = useToast();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [menteeHint, setMenteeHint] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState<MentorshipSessionItem | null>(null);
  const [notesFor, setNotesFor] = useState<MentorshipSessionItem | null>(null);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: qk('mentorships', 'sessions-upcoming') });
    void queryClient.invalidateQueries({ queryKey: qk('mentorships', 'sessions') });
    void queryClient.invalidateQueries({ queryKey: qk('mentorships', 'bookings') });
  };

  // /mentor/sessions?new=1&mentee=<id> - how the mentees page asks for a new
  // session with a particular mentee. Read after mount so SSR and hydration
  // agree and no Suspense boundary is needed.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('new') === '1') {
      setMenteeHint(q.get('mentee'));
      setScheduleOpen(true);
    }
  }, []);

  const cancelSession = async (s: MentorshipSessionItem): Promise<PageControlRunResult> => {
    const ok = await confirm({
      title: <BilingualText en="Cancel this session?" el="Ακύρωση αυτής της συνεδρίας;" />,
      description: <BilingualText en="Your mentee sees it as cancelled. You can schedule a new one at any time." el="Ο καθοδηγούμενος τη βλέπει ως ακυρωμένη. Μπορείτε να προγραμματίσετε νέα οποτεδήποτε." />,
      confirmLabel: <BilingualText en="Cancel session" el="Ακύρωση συνεδρίας" compact />,
    });
    if (!ok) return CANCELLED;
    try {
      await updateMentorshipSession(s.id, { status: 'cancelled' });
      success('Session cancelled');
      refresh();
    } catch (e) {
      toastError('Could not cancel the session', e instanceof Error ? e.message : undefined);
      return { error: e instanceof Error && e.message ? e.message : 'The session is still booked.' };
    }
  };
  const [bookingActing, setBookingActing] = useState(false);
  const setBookingStatus = async (b: MentorBookingItem, status: 'confirmed' | 'cancelled'): Promise<PageControlRunResult> => {
    if (status === 'cancelled') {
      const ok = await confirm({
        title: <BilingualText en="Cancel this booking?" el="Ακύρωση αυτής της κράτησης;" />,
        description: <BilingualText en="The founder sees it as cancelled." el="Ο ιδρυτής τη βλέπει ως ακυρωμένη." />,
        confirmLabel: <BilingualText en="Cancel booking" el="Ακύρωση κράτησης" compact />,
      });
      if (!ok) return CANCELLED;
    }
    setBookingActing(true);
    try {
      await updateMentorBooking(b.id, { status });
      success(status === 'confirmed' ? 'Booking confirmed' : 'Booking cancelled');
      refresh();
    } catch (e) {
      toastError(status === 'confirmed' ? 'Could not confirm the booking' : 'Could not cancel the booking', e instanceof Error ? e.message : undefined);
      return { error: e instanceof Error && e.message ? e.message : 'The booking did not change.' };
    } finally {
      setBookingActing(false);
    }
  };

  const actions: SessionActions = { onReschedule: setRescheduling, onCancel: (s) => void cancelSession(s), onNotes: setNotesFor };
  const dialogs = (
    <>
      <ScheduleSessionDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        initialMenteeId={menteeHint}
        onScheduled={() => { success('Session scheduled'); refresh(); }}
      />
      <RescheduleSessionDialog
        session={rescheduling}
        onOpenChange={(o) => { if (!o) setRescheduling(null); }}
        onSaved={() => { success('Session rescheduled'); refresh(); }}
      />
      <SessionNotesDialog
        session={notesFor}
        onOpenChange={(o) => { if (!o) setNotesFor(null); }}
        onSaved={() => { success('Notes saved'); refresh(); }}
      />
    </>
  );

  const byId = new Map<string, MentorshipSessionItem>();
  for (const x of [...(data?.sessions ?? []), ...history]) byId.set(x.id, x);
  const sessions = [...byId.values()];

  const relationships = relData?.relationships ?? [];
  const relById = new Map(relationships.map((r) => [r.id, r]));
  const bookings = bookingData?.bookings ?? [];

  // One list over both stores; mergeSessions orders upcoming asc, past desc.
  const unified = mergeSessions([
    ...sessions
      .filter((s) => relById.has(s.relationshipId))
      .map((s) => fromMentorshipSession(s, relById.get(s.relationshipId)!, viewerId)),
    ...bookings.map((b) => fromBooking(b, viewerId)),
  ]);
  const upcomingRows = unified.filter(isUpcoming);
  const pastRows = unified.filter((u) => !isUpcoming(u));
  const requestedBookings = bookings.filter((b) => b.status === 'requested');
  const cancellableBookings = bookings.filter((b) => isUpcoming(fromBooking(b, viewerId)));

  const renderRow = (u: UnifiedSession) =>
    u.source === 'mentorship' && u.session ? (
      <SessionCard key={u.key} session={u.session} {...actions} />
    ) : u.booking ? (
      <BookingCard
        key={u.key}
        booking={u.booking}
        userId={viewerId}
        showSource
        isActing={bookingActing}
        onConfirm={() => void setBookingStatus(u.booking!, 'confirmed')}
        onDecline={() => void setBookingStatus(u.booking!, 'cancelled')}
        onCancel={() => void setBookingStatus(u.booking!, 'cancelled')}
      />
    ) : null;

  // Offered to the assistant, above the loading and error returns: the tab,
  // Schedule, and each session's reschedule, notes and cancel (which asks).
  const when = (s: MentorshipSessionItem) => `${s.title || 'Session'} · ${s.scheduledAt.slice(0, 16).replace('T', ' ')}`;
  const whenBooking = (b: MentorBookingItem) => `${b.mentee?.displayName ?? 'Mentee'} · ${b.startAt.slice(0, 16).replace('T', ' ')}`;
  const sessionById = (id?: string) => sessions.find((s) => s.id === id);
  const bookingById = (id?: string) => bookings.find((b) => b.id === id);
  usePageList([
    {
      id: 'sessions',
      labelEn: 'Mentoring sessions',
      labelEl: 'Συνεδρίες καθοδήγησης',
      rows: isLoading || bookingsLoading ? undefined : (activeTab === 'past' ? pastRows : upcomingRows).map((u) =>
        u.source === 'booking' && u.booking
          ? `${whenBooking(u.booking)} · ${u.durationMin != null ? `${u.durationMin} min` : '—'}${u.meetingType ? ` · ${u.meetingType.replace('_', ' ')}` : ''} · ${u.status} · booking`
          : u.session
            ? `${when(u.session)} · ${u.session.duration} min${u.session.meetingType ? ` · ${u.session.meetingType.replace('_', ' ')}` : ''} · ${u.status}`
            : u.id,
      ),
      total: unified.length,
    },
  ]);
  usePageControls([
    choiceControl('session_tab', 'Session filter', 'Φίλτρο συνεδριών', [
      { value: 'upcoming', en: 'Upcoming', el: 'Επερχόμενες' },
      { value: 'past', en: 'Past', el: 'Παρελθούσες' },
    ], activeTab, setActiveTab),
    { id: 'schedule_session', labelEn: 'Open the schedule session form', labelEl: 'Άνοιγμα φόρμας νέας συνεδρίας', writes: false, run: () => setScheduleOpen(true) },
    { id: 'reschedule_session', labelEn: 'Reschedule session', labelEl: 'Αλλαγή ώρας συνεδρίας', writes: false, options: rowOptions(sessions.filter((s) => s.status === 'scheduled'), (s) => s.id, when), run: (v) => { const s = sessionById(v); if (s) setRescheduling(s); } },
    { id: 'session_notes', labelEn: 'Open session notes', labelEl: 'Άνοιγμα σημειώσεων συνεδρίας', writes: false, options: rowOptions(sessions, (s) => s.id, when), run: (v) => { const s = sessionById(v); if (s) setNotesFor(s); } },
    { id: 'cancel_session', labelEn: 'Cancel session', labelEl: 'Ακύρωση συνεδρίας', writes: true, options: rowOptions(sessions.filter((s) => s.status === 'scheduled'), (s) => s.id, when), run: (v) => { const s = sessionById(v); return s ? cancelSession(s) : ROW_GONE; } },
    { id: 'confirm_booking', labelEn: 'Confirm booking', labelEl: 'Επιβεβαίωση κράτησης', writes: true, options: rowOptions(requestedBookings, (b) => b.id, whenBooking), run: (v) => { const b = bookingById(v); return b ? setBookingStatus(b, 'confirmed') : ROW_GONE; } },
    { id: 'cancel_booking', labelEn: 'Cancel booking', labelEl: 'Ακύρωση κράτησης', writes: true, options: rowOptions(cancellableBookings, (b) => b.id, whenBooking), run: (v) => { const b = bookingById(v); return b ? setBookingStatus(b, 'cancelled') : ROW_GONE; } },
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
              <h3 className="font-medium"><BilingualText en="Failed to load sessions" el="Δεν ήταν δυνατή η φόρτωση των συνεδριών" compact /></h3>
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

  const totalDuration = sessions.reduce((acc, s) => acc + (s.duration || 0), 0)
    + bookings.reduce((acc, b) => {
        const end = new Date(b.endAt).getTime() - new Date(b.startAt).getTime();
        return acc + (Number.isFinite(end) && end > 0 ? Math.round(end / 60000) : 0);
      }, 0);

  return (
    <AppShell showHelp
      actions={
        <>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={cn('icon-sm mr-2', isLoading && 'animate-spin')} />
              <BilingualText en="Refresh" el="Ανανέωση" compact />
            </Button>
            <Button onClick={() => setScheduleOpen(true)}>
              <Plus className="mr-2 icon-sm" aria-hidden="true" />
              <BilingualText en="Schedule Session" el="Προγραμματισμός συνεδρίας" compact />
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3">
              <div className="rounded-lg bg-status-info-bg p-2">
                <Calendar className="icon-md text-status-info" />
              </div>
              <div>
                <p className="page-stat text-xl font-bold">{upcomingRows.length}</p>
                <p className="text-sm text-muted-foreground"><BilingualText en="Upcoming" el="Επερχόμενες" compact /></p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3">
              <div className="rounded-lg bg-status-success-bg p-2">
                <CheckCircle2 className="icon-md text-status-success" />
              </div>
              <div>
                <p className="page-stat text-xl font-bold">
                  {sessions.filter((s) => s.status === 'completed').length + bookings.filter((b) => b.status === 'completed').length}
                </p>
                <p className="text-sm text-muted-foreground"><BilingualText en="Completed" el="Ολοκληρωμένες" compact /></p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Clock className="icon-md text-muted-foreground" />
              </div>
              <div>
                <p className="page-stat text-xl font-bold">{totalDuration} min</p>
                <p className="text-sm text-muted-foreground"><BilingualText en="Total Time" el="Συνολικός χρόνος" compact /></p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="upcoming" className="gap-2">
              Upcoming
              {upcomingRows.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {upcomingRows.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="past"><BilingualText en="Past Sessions" el="Παρελθούσες συνεδρίες" compact /></TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-3 mt-4">
            {isLoading || bookingsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="icon-xl animate-spin text-muted-foreground" />
              </div>
            ) : upcomingRows.length > 0 ? (
              upcomingRows.map(renderRow)
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" aria-hidden="true" />
                  <h3 className="font-medium"><BilingualText en="No upcoming sessions" el="Δεν υπάρχουν επερχόμενες συνεδρίες" compact /></h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    <BilingualText en="Mentorship sessions and session bookings both appear here — schedule one, or answer a founder's booking." el="Οι συνεδρίες καθοδήγησης και οι κρατήσεις εμφανίζονται εδώ — προγραμματίστε μία ή απαντήστε σε κράτηση ιδρυτή." wrap />
                  </p>
                  <Button className="mt-4" onClick={() => setScheduleOpen(true)}>
                    <Plus className="mr-2 icon-sm" aria-hidden="true" />
                    <BilingualText en="Schedule Session" el="Προγραμματισμός συνεδρίας" compact />
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-3 mt-4">
            {isLoading || bookingsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="icon-xl animate-spin text-muted-foreground" />
              </div>
            ) : pastRows.length > 0 ? (
              pastRows.map(renderRow)
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" aria-hidden="true" />
                  <h3 className="font-medium"><BilingualText en="No past sessions" el="Δεν υπάρχουν παρελθούσες συνεδρίες" compact /></h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    <BilingualText en="Completed sessions will appear here" el="Οι ολοκληρωμένες συνεδρίες θα εμφανίζονται εδώ" wrap />
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
      {dialogs}
    </AppShell>
  );
}
