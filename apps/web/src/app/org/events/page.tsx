'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Plus,
  Search,
  MapPin,
  Clock,
  Users,
  MoreVertical,
  Video,
  Building,
  Edit,
  Trash2,
  Copy,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createEvent, listEvents, type EventItem } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { UnavailableMenuItem } from '@/components/common/UnavailableMenuItem';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyOrgEvents } from '@/components/common/EmptyStates';
import { cn } from '@/lib/utils';
import { STATUS, type StatusTone } from '@/lib/semantic-colors';
import { qk } from '@/lib/query-keys';
import { choiceControl, ROW_GONE, rowOptions, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { useDemoData } from '@/contexts/DemoDataContext';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualInline } from '@/lib/i18n/format';
import { useDateFormat } from '@/lib/i18n/useDateFormat';

type OrgEvent = {
  id: string;
  title: string;
  type: 'workshop' | 'demo_day' | 'networking' | 'mentorship' | 'keynote';
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  date: string;
  time: string;
  format: 'online' | 'in-person' | 'hybrid';
  location: string;
  attendees: number;
  capacity: number;
  speakers?: string[];
  description: string;
};

const TYPE_CONFIG: Record<OrgEvent['type'], { label: string; labelEl: string; tone: StatusTone }> = {
  workshop: { label: 'Workshop', labelEl: 'Εργαστήριο', tone: 'info' },
  demo_day: { label: 'Demo Day', labelEl: 'Demo Day', tone: 'accent' },
  networking: { label: 'Networking', labelEl: 'Δικτύωση', tone: 'success' },
  mentorship: { label: 'Mentorship', labelEl: 'Καθοδήγηση', tone: 'warning' },
  keynote: { label: 'Keynote', labelEl: 'Κεντρική ομιλία', tone: 'danger' },
};

const STATUS_CONFIG: Record<OrgEvent['status'], { label: string; labelEl: string; tone: StatusTone }> = {
  upcoming: { label: 'Upcoming', labelEl: 'Προσεχές', tone: 'info' },
  ongoing: { label: 'Live', labelEl: 'Σε εξέλιξη', tone: 'success' },
  completed: { label: 'Completed', labelEl: 'Ολοκληρώθηκε', tone: 'neutral' },
  cancelled: { label: 'Cancelled', labelEl: 'Ακυρώθηκε', tone: 'danger' },
};

/**
 * The page's own row from the events API row.
 *
 * `/api/events` has existed all along and this page never called it. The
 * event model has no organisation scope yet, so this lists the events the
 * viewer hosts — which for an organisation account is its programme calendar.
 * Speakers have no field on the model and are left out rather than invented.
 */
const EVENT_TYPE_MAP: Record<string, OrgEvent['type']> = {
  workshop: 'workshop',
  demo_day: 'demo_day',
  networking: 'networking',
  meetup: 'networking',
  webinar: 'keynote',
  other: 'workshop',
};

function toOrgEvent(item: EventItem, fmtDate: (v: string | number | Date, o?: Intl.DateTimeFormatOptions) => string): OrgEvent {
  const start = new Date(item.startAt);
  const end = new Date(item.endAt);
  const now = Date.now();
  return {
    id: item.id,
    title: item.title,
    type: EVENT_TYPE_MAP[item.eventType] ?? 'workshop',
    status:
      end.getTime() < now ? 'completed' : start.getTime() <= now ? 'ongoing' : 'upcoming',
    // Pinned to UTC on both sides of hydration, the way every other date in
    // this codebase is.
    date: fmtDate(start, { day: 'numeric', month: 'short', year: 'numeric' }),
    time: start.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }),
    format: item.mode,
    location: item.location ?? (item.isOnline ? 'Online' : '\u2014'),
    attendees: item.attendeesCount,
    capacity: item.capacity ?? 0,
    description: item.description,
  };
}

/**
 * Shown to an organisation that has scheduled nothing yet, with sample data
 * on. Ages, not dates: the old rows were "upcoming" on dates in April 2025.
 * The speakers are the demo world's people, never a real fund's partner.
 */
const MOCK_EVENT_ROWS: Array<Omit<OrgEvent, 'date' | 'status'> & { inDays: number }> = [
  {
    id: '1',
    title: 'Spring Demo Day',
    type: 'demo_day',
    inDays: 7,
    time: '10:00 – 16:00',
    format: 'hybrid',
    location: 'Aegean Venture Lab + stream',
    attendees: 87,
    capacity: 200,
    speakers: ['Nikos Andreou (angel investor)', 'Elena Papadopoulos (Founder, Harbor)'],
    description: 'Cohort 7 final showcase. 12 startups presenting to investors.',
  },
  {
    id: '2',
    title: 'Fundraising Masterclass',
    type: 'workshop',
    inDays: 14,
    time: '14:00 – 17:00',
    format: 'online',
    location: 'Online',
    attendees: 34,
    capacity: 50,
    speakers: ['Nikos Andreou (angel investor)'],
    description: 'Deep dive on SAFE notes, cap table management, and Series A readiness.',
  },
  {
    id: '3',
    title: 'Mentor Speed Dating',
    type: 'mentorship',
    inDays: 0,
    time: '15:00 – 18:00',
    format: 'in-person',
    location: 'Aegean Venture Lab, Room 4B',
    attendees: 24,
    capacity: 30,
    speakers: [],
    description: 'Rotating 15-min sessions with cohort mentors.',
  },
  {
    id: '4',
    title: 'Cohort 6 Graduation',
    type: 'demo_day',
    inDays: -11,
    time: '11:00 – 15:00',
    format: 'hybrid',
    location: 'Aegean Venture Lab + stream',
    attendees: 156,
    capacity: 200,
    speakers: [],
    description: '10 graduating startups, 3 received follow-on funding.',
  },
];

function mockEvents(now: number, fmtDate: (v: number, o?: Intl.DateTimeFormatOptions) => string): OrgEvent[] {
  return MOCK_EVENT_ROWS.map(({ inDays, ...row }) => ({
    ...row,
    status: inDays > 0 ? 'upcoming' : inDays === 0 ? 'ongoing' : 'completed',
    date: fmtDate(now + inDays * 86_400_000, { day: 'numeric', month: 'short', year: 'numeric' }),
  }));
}

function EventCard({ event, onDuplicate }: { event: OrgEvent; onDuplicate?: (e: OrgEvent) => void }) {
  const typeCfg = TYPE_CONFIG[event.type];
  const statusCfg = STATUS_CONFIG[event.status];
  const typeColors = STATUS[typeCfg.tone];
  const statusColors = STATUS[statusCfg.tone];
  // An event without a cap (the API's capacity is optional, mapped to 0) has
  // no fill: dividing by it printed "156/0 attending · Infinity% full".
  const capped = event.capacity > 0;
  const fill = capped ? Math.round((event.attendees / event.capacity) * 100) : 0;
  const fillColor = fill >= 90 ? STATUS.danger.icon : fill >= 70 ? STATUS.warning.icon : STATUS.success.icon;

  return (
    <Card className="transition-all hover:border-primary/30">
      <CardContent>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold">{event.title}</h3>
              <Badge variant="outline" className={cn('text-xs border', statusColors.chip)}>
                {event.status === 'ongoing' && <span className={cn('mr-1 inline-block h-1.5 w-1.5 rounded-full animate-pulse bg-status-success-mark')} />}
                <BilingualText en={statusCfg.label} el={statusCfg.labelEl} compact />
              </Badge>
            </div>
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="icon-sm" aria-hidden="true" />{event.date}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="icon-sm" aria-hidden="true" />{event.time}
              </span>
              <span className="flex items-center gap-1">
                {event.format === 'online' ? <Video className="icon-sm" aria-hidden="true" /> : <Building className="icon-sm" aria-hidden="true" />}
                {event.location}
              </span>
              <span className="flex items-center gap-1">
                <Users className="icon-sm" aria-hidden="true" />
                <BilingualText
                  en={`${capped ? `${event.attendees}/${event.capacity}` : event.attendees} attending`}
                  el={`${capped ? `${event.attendees}/${event.capacity}` : event.attendees} συμμετέχουν`}
                  compact
                />
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{event.description}</p>
            {event.speakers && event.speakers.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {event.speakers.map(sp => (
                  <Badge key={sp} variant="secondary" className="text-xs">{sp}</Badge>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3 mt-3">
              <Badge variant="secondary" className={cn('text-xs border', typeColors.chip)}><BilingualText en={typeCfg.label} el={typeCfg.labelEl} compact /></Badge>
              <span className="text-xs text-muted-foreground">
                {capped ? (
                  <span className={cn('font-medium', fillColor)}>
                    <BilingualText en={`Capacity: ${fill}% full`} el={`Χωρητικότητα: ${fill}% πλήρης`} compact />
                  </span>
                ) : (
                  <BilingualText en="No attendance cap" el="Χωρίς όριο συμμετοχής" compact />
                )}
              </span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label="More options" variant="ghost" size="icon" className="shrink-0">
                <MoreVertical className="icon-sm" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* None of these had a handler. EventsController serves create
                  and read but no update or delete, so Edit and Delete say
                  so; Duplicate re-creates the event a week later; the public
                  page is /events/:id. */}
              <UnavailableMenuItem
                icon={<Edit className="mr-2 mt-0.5 icon-sm" aria-hidden="true" />}
                en="Edit"
                el="Επεξεργασία"
                reasonEn="Events cannot be edited after creation yet."
                reasonEl="Οι εκδηλώσεις δεν επεξεργάζονται ακόμη μετά τη δημιουργία."
              />
              <DropdownMenuItem disabled={!onDuplicate} onSelect={() => onDuplicate?.(event)}>
                <Copy className="mr-2 icon-sm" aria-hidden="true" /><BilingualText en="Duplicate" el="Αντιγραφή" compact />
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/events/${event.id}`}><ExternalLink className="mr-2 icon-sm" aria-hidden="true" /><BilingualText en="View Public Page" el="Δημόσια σελίδα" compact /></Link>
              </DropdownMenuItem>
              <UnavailableMenuItem
                className="text-destructive-accessible"
                icon={<Trash2 className="mr-2 mt-0.5 icon-sm" aria-hidden="true" />}
                en="Delete"
                el="Διαγραφή"
                reasonEn="Events cannot be deleted yet."
                reasonEl="Οι εκδηλώσεις δεν διαγράφονται ακόμη."
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OrgEventsPage() {
  // Illustrative rows are for the showcase; a real account with nothing
  // to list sees the page's empty state, not invented people and records.
  const { showDemoData } = useDemoData();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: qk('events', 'org'),
    queryFn: () => listEvents({ scope: 'mine', limit: 50 }),
    staleTime: 60_000,
    retry: 0,
  });

  const fmtDate = useDateFormat();
  // Sample rows carry ages and are stamped after mount (no date frozen at build).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  const live = useMemo(() => (data?.events ?? []).map((e) => toOrgEvent(e, fmtDate)), [data, fmtDate]);
  const events = live.length > 0 ? live : isLoading || !showDemoData || now == null ? [] : mockEvents(now, fmtDate);
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const duplicate = async (e: OrgEvent): Promise<PageControlRunResult> => {
    const src = (data?.events ?? []).find((x) => x.id === e.id);
    if (!src) return ROW_GONE;
    const week = 7 * 86_400_000;
    try {
      const created = await createEvent({
        title: `${src.title} (copy)`,
        description: src.description || undefined,
        type: src.eventType,
        startAt: new Date(new Date(src.startAt).getTime() + week).toISOString(),
        endAt: src.endAt ? new Date(new Date(src.endAt).getTime() + week).toISOString() : undefined,
        timezone: src.timezone ?? undefined,
        location: src.location ?? undefined,
        isOnline: src.isOnline,
        meetingUrl: src.meetingUrl ?? undefined,
        capacity: src.capacity ?? undefined,
      });
      success('Event duplicated', `${created?.event?.title ?? src.title} - one week later.`);
    } catch (err) {
      toastError('Could not duplicate the event', err instanceof Error ? err.message : undefined);
      return { error: err instanceof Error && err.message ? err.message : 'The event was not duplicated.' };
    } finally {
      void queryClient.invalidateQueries({ queryKey: qk('events') });
    }
  };

  const filtered = events.filter(e => {
    const q = search.toLowerCase();
    const matchesSearch = !search || e.title.toLowerCase().includes(q) || e.description.toLowerCase().includes(q);
    const matchesTab = activeTab === 'all' || e.status === activeTab || (activeTab === 'active' && ['upcoming', 'ongoing'].includes(e.status));
    return matchesSearch && matchesTab;
  });

  const upcoming = events.filter(e => e.status === 'upcoming').length;
  const totalAttendees = events.reduce((s, e) => s + e.attendees, 0);
  const activeCount = upcoming + events.filter(e => e.status === 'ongoing').length;
  const completedCount = events.filter(e => e.status === 'completed').length;

  const filtersActive = !!search || activeTab !== 'all';
  const clearFilters = () => { setSearch(''); setActiveTab('all'); };

  // Offered to the assistant: the tab, clearing the filters, and the card
  // menu's Duplicate (a week later, refused on sample events).
  usePageList([
    {
      id: 'events',
      labelEn: 'Organisation events',
      labelEl: 'Εκδηλώσεις οργανισμού',
      rows: isLoading ? undefined : filtered.map((e) => `${e.title} · ${e.date} ${e.time} · ${e.format} · ${e.status} · ${e.attendees}/${e.capacity} attendees`),
      total: events.length,
      sample: live.length === 0,
    },
  ]);
  usePageControls([
    choiceControl('event_tab', 'Event filter', 'Φίλτρο εκδηλώσεων', [
      { value: 'all', en: 'All', el: 'Όλες' },
      { value: 'active', en: 'Active', el: 'Ενεργές' },
      { value: 'completed', en: 'Completed', el: 'Ολοκληρωμένες' },
    ], activeTab, setActiveTab),
    { id: 'clear_filters', labelEn: 'Clear the event filters', labelEl: 'Καθαρισμός φίλτρων εκδηλώσεων', writes: false, unavailableEn: filtersActive ? undefined : 'No filter is set.', unavailableEl: filtersActive ? undefined : 'Δεν υπάρχει φίλτρο.', run: clearFilters },
    { id: 'duplicate_event', labelEn: 'Duplicate event a week later', labelEl: 'Αντίγραφο εκδήλωσης μια εβδομάδα αργότερα', writes: true, options: rowOptions(filtered, (e) => e.id, (e) => e.title), unavailableEn: live.length > 0 ? undefined : 'These events are samples; there is nothing to duplicate.', unavailableEl: live.length > 0 ? undefined : 'Οι εκδηλώσεις είναι δείγματα· δεν υπάρχει κάτι για αντιγραφή.', run: (v) => { const e = events.find((x) => x.id === v); return e ? duplicate(e) : ROW_GONE; } },
  ]);

  return (
    <AppShell showHelp
      title="Organization Events"
      description="Demo days, office hours, workshops, and pitch nights for your cohorts."
      descriptionEl="Demo days, ώρες γραφείου, εργαστήρια και βραδιές παρουσιάσεων για τους κύκλους σας."
      actions={(
        <Button asChild>
          <Link href="/events/create">
            <Plus className="mr-2 icon-sm" />
            <BilingualText en="Create Event" el="Νέα εκδήλωση" compact />
          </Link>
        </Button>
      )}
    >
      <div className="space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 kpi-odd-span-md gap-4 md:grid-cols-3">
          {[
            { label: 'Upcoming Events', labelEl: 'Προσεχείς εκδηλώσεις', value: upcoming, icon: Calendar },
            { label: 'Total Attendees (all)', labelEl: 'Συνολικοί συμμετέχοντες', value: totalAttendees, icon: Users },
            // Every event not cancelled — it was labelled "This Month" but never filtered by date.
            { label: 'Events not cancelled', labelEl: 'Εκδηλώσεις σε ισχύ', value: events.filter(e => e.status !== 'cancelled').length, icon: CheckCircle },
          ].map(stat => (
            <Card key={stat.label}>
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground"><BilingualText en={stat.label} el={stat.labelEl} compact wrap /></p>
                  <p className="page-stat text-xl font-bold">{stat.value}</p>
                </div>
                <div className="rounded-lg bg-primary/10 p-2">
                  <stat.icon className="h-4 w-4 text-primary-accessible" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search & Tabs */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
            <Input aria-label="Search events. Αναζήτηση εκδηλώσεων" placeholder={bilingualInline('Search events…', 'Αναζήτηση εκδηλώσεων…')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all"><BilingualText en={`All (${events.length})`} el={`Όλες (${events.length})`} compact /></TabsTrigger>
            <TabsTrigger value="active"><BilingualText en={`Active (${activeCount})`} el={`Ενεργές (${activeCount})`} compact /></TabsTrigger>
            <TabsTrigger value="completed"><BilingualText en={`Completed (${completedCount})`} el={`Ολοκληρωμένες (${completedCount})`} compact /></TabsTrigger>
          </TabsList>
          <TabsContent value={activeTab} className="mt-4 space-y-3">
            {filtered.map(event => (
              <EventCard key={event.id} event={event} onDuplicate={live.length > 0 ? (ev) => void duplicate(ev) : undefined} />
            ))}
            {filtered.length === 0 && (
              <EmptyOrgEvents filtersActive={filtersActive} onClearFilters={clearFilters} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
