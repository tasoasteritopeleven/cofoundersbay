'use client';

import { RailStats } from '@/components/layout/RailParts';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Users,
  Video,
  MapPin,
  Plus,
  Filter,
  LayoutGrid,
  List,
  CalendarDays,
  Sparkles,
  MessageCircle,
  Target,
  GraduationCap,
  Briefcase,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { RailAction } from '@/components/layout/RailParts';
import { choiceControl, usePageControls, usePageList } from '@/lib/page-controls';
import { BilingualText } from '@/components/common/BilingualText';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { SampleDataNotice } from '@/components/common/SampleDataNotice';
import { getUpcomingMentorshipSessions, listEvents, listMilestones, type EventItem, type Milestone, type MentorshipSessionItem } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { useDemoData } from '@/contexts/DemoDataContext';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';
import { bilingualAria } from '@/lib/i18n/format';
import { useHydrated } from '@/components/common/RelativeTime';
import { useI18n } from '@/components/common/I18nProvider';

// ── Types ────────────────────────────────────────────────────────────────────

type EventType = 'milestone' | 'session' | 'event' | 'deadline' | 'meeting';

interface CalendarEvent {
  id: string;
  title: string;
  titleEl?: string;
  type: EventType;
  date: string; // ISO date
  time?: string;
  endTime?: string;
  description?: string;
  location?: string;
  locationEl?: string;
  participants?: string[];
  status?: string;
  priority?: 'high' | 'medium' | 'low';
  href?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<EventType, { labelEn: string; labelEl: string; color: string; icon: React.ElementType; bg: string }> = {
  milestone:  { labelEn: 'Milestone', labelEl: 'Ορόσημο', color: 'text-status-warning',   icon: Flag,           bg: 'bg-status-warning-bg border-status-warning-border' },
  session:    { labelEn: 'Session',   labelEl: 'Συνεδρία', color: 'text-status-info',    icon: Video,          bg: 'bg-status-info-bg border-status-info-border' },
  event:      { labelEn: 'Event',     labelEl: 'Εκδήλωση', color: 'text-status-accent',  icon: CalendarDays,   bg: 'bg-status-accent-bg border-status-accent-border' },
  deadline:   { labelEn: 'Deadline',  labelEl: 'Προθεσμία', color: 'text-status-danger',     icon: Clock,          bg: 'bg-status-danger-bg border-status-danger-border' },
  meeting:    { labelEn: 'Meeting',   labelEl: 'Συνάντηση', color: 'text-status-success', icon: Users,          bg: 'bg-status-success-bg border-status-success-border' },
};

const DAYS = [
  { en: 'Sun', el: 'Κυ' },
  { en: 'Mon', el: 'Δε' },
  { en: 'Tue', el: 'Τρ' },
  { en: 'Wed', el: 'Τε' },
  { en: 'Thu', el: 'Πε' },
  { en: 'Fri', el: 'Πα' },
  { en: 'Sat', el: 'Σα' },
];
const MONTHS = [
  { en: 'January', el: 'Ιανουάριος' },
  { en: 'February', el: 'Φεβρουάριος' },
  { en: 'March', el: 'Μάρτιος' },
  { en: 'April', el: 'Απρίλιος' },
  { en: 'May', el: 'Μάιος' },
  { en: 'June', el: 'Ιούνιος' },
  { en: 'July', el: 'Ιούλιος' },
  { en: 'August', el: 'Αύγουστος' },
  { en: 'September', el: 'Σεπτέμβριος' },
  { en: 'October', el: 'Οκτώβριος' },
  { en: 'November', el: 'Νοέμβριος' },
  { en: 'December', el: 'Δεκέμβριος' },
];

// ── Demo Data ────────────────────────────────────────────────────────────────

// UTC throughout, like every other date the product renders.
//
// `new Date(y, m, day, hour, min)` builds the instant in the *runtime's* zone,
// so the demo events themselves came out different on the server (UTC) than in
// the browser: at UTC+14 this produced a timestamp 14 hours earlier, which lands
// on a different calendar day, and at the extremes `now.getMonth()` was a
// different month entirely. The grid, the events and the "today" highlight all
// disagreed, and React could not hydrate the page.
const now = new Date();
const y = now.getUTCFullYear();
const m = now.getUTCMonth();

function d(day: number, hour = 10, min = 0) {
  return new Date(Date.UTC(y, m, day, hour, min)).toISOString();
}

const DEMO_EVENTS: CalendarEvent[] = [
  { id: '1',  title: 'MVP Sprint Review',           titleEl: 'Ανασκόπηση sprint MVP',           type: 'milestone', date: d(2),  priority: 'high',   status: 'in_progress', href: '/milestones' },
  { id: '2',  title: 'Mentor Session — Dr. Sarah Kim', titleEl: 'Συνεδρία μέντορα — Dr. Sarah Kim',    type: 'session',   date: d(4, 14), time: '14:00', endTime: '15:00', participants: ['Dr. Sarah Kim'], href: '/mentor/sessions' },
  { id: '3',  title: 'Pitch Deck Deadline',          titleEl: 'Προθεσμία pitch deck',             type: 'deadline',  date: d(7),  priority: 'high',   href: '/builder/pitch-deck' },
  { id: '4',  title: 'Startup Meetup Athens',        titleEl: 'Meetup για startups στην Αθήνα',             type: 'event',     date: d(9, 18), time: '18:00', endTime: '21:00', location: 'Aegean Venture Lab, Athens', locationEl: 'Aegean Venture Lab, Αθήνα', href: '/events' },
  { id: '5',  title: 'Team Standup',                 titleEl: 'Standup ομάδας',                   type: 'meeting',   date: d(10, 9, 30), time: '09:30', endTime: '10:00', participants: ['Alex Demo', 'Maria Georgiou', 'Marcus Chen'] },
  { id: '6',  title: 'Seed Round Application',       titleEl: 'Αίτηση Seed round',                type: 'deadline',  date: d(12), priority: 'high',   href: '/fundraising' },
  { id: '7',  title: 'Co-founder Interview',         titleEl: 'Συνέντευξη συνιδρυτή',             type: 'meeting',   date: d(14, 11), time: '11:00', endTime: '11:45', participants: ['Marcus Chen'] },
  { id: '8',  title: 'Accelerator Demo Day',         titleEl: 'Demo Day επιταχυντή',              type: 'event',     date: d(18, 16), time: '16:00', endTime: '20:00', location: 'Online (Zoom)', locationEl: 'Διαδικτυακά (Zoom)', href: '/events' },
  { id: '9',  title: 'Market Analysis Due',          titleEl: 'Λήξη ανάλυσης αγοράς',             type: 'milestone', date: d(20), priority: 'medium', status: 'pending', href: '/milestones' },
  { id: '10', title: 'Investor Call — Nikos Andreou', titleEl: 'Κλήση με επενδυτή — Nikos Andreou', type: 'session',   date: d(22, 15), time: '15:00', endTime: '15:30', participants: ['Nikos Andreou'] },
  { id: '11', title: 'Grant Submission Deadline',    titleEl: 'Προθεσμία υποβολής grant',         type: 'deadline',  date: d(25), priority: 'high',   href: '/fundraising' },
  { id: '12', title: 'User Testing Round 2',         titleEl: 'Δοκιμές χρηστών γύρος 2',          type: 'milestone', date: d(27), priority: 'medium', status: 'pending' },
  { id: '13', title: 'Community AMA',                titleEl: 'AMA κοινότητας',                   type: 'event',     date: d(28, 19), time: '19:00', endTime: '20:00', location: 'Discord', href: '/events' },
];

// ── Live items ───────────────────────────────────────────────────────────────
//
// The calendar drew the thirteen items above for every account, production
// included ("Mentor Session — Sarah Lee", "Advisor Call — Dr. Papadakis"),
// under a notice that there was no merged API. There still is not one, so the
// page merges the three it has: milestone due dates, upcoming mentoring
// sessions (both sides: the ones you attend and the ones you give), and the
// events you said you are going to or interested in. The samples above are the
// showcase's, shown only when the demo has nothing of its own.

const hhmm = (iso: string) => iso.slice(11, 16);

function fromMilestone(mst: Milestone): CalendarEvent | null {
  if (!mst.dueDate) return null;
  return {
    id: `milestone-${mst.id}`,
    title: mst.title,
    type: mst.priority === 'high' ? 'deadline' : 'milestone',
    date: mst.dueDate,
    priority: mst.priority,
    status: mst.status,
    href: '/milestones',
  };
}

function fromSession(sess: MentorshipSessionItem): CalendarEvent {
  const end = new Date(Date.parse(sess.scheduledAt) + (sess.duration ?? 0) * 60_000).toISOString();
  return {
    id: `session-${sess.id}`,
    title: sess.title ?? 'Mentoring session',
    titleEl: sess.title ?? 'Συνεδρία καθοδήγησης',
    type: 'session',
    date: sess.scheduledAt,
    time: hhmm(sess.scheduledAt),
    endTime: sess.duration ? hhmm(end) : undefined,
    description: sess.agenda ?? undefined,
    location: sess.meetingType === 'in_person' ? sess.meetingLocation ?? undefined : sess.meetingType === 'video' ? 'Video call' : undefined,
    locationEl: sess.meetingType === 'video' ? 'Βιντεοκλήση' : undefined,
    status: sess.status,
    href: '/coaching',
  };
}

function fromEvent(ev: EventItem): CalendarEvent {
  return {
    id: `event-${ev.id}`,
    title: ev.title,
    type: 'event',
    date: ev.startAt,
    time: hhmm(ev.startAt),
    endTime: ev.endAt ? hhmm(ev.endAt) : undefined,
    location: ev.isOnline ? 'Online' : ev.location ?? undefined,
    locationEl: ev.isOnline ? 'Διαδικτυακά' : undefined,
    href: `/events/${ev.id}`,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function getDaysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 1)).getUTCDay();
}

const MONTH_SHORT = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  el: ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μάι', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'],
} as const;

/** Controlled "22 Σεπ" — locale short-month on Windows el-GR overflowed a
 *  56px column and the day digit clipped into what read as "?? Σεπ". */
function formatUpcomingDate(iso: string, lang: 'en' | 'el'): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '—';
  return `${dt.getUTCDate()} ${MONTH_SHORT[lang][dt.getUTCMonth()]}`;
}

// ── Components ───────────────────────────────────────────────────────────────

function EventChip({ event }: { event: CalendarEvent }) {
  const cfg = TYPE_CONFIG[event.type];
  const Wrapper = event.href ? Link : 'div';
  const wrapperProps = event.href ? { href: event.href } : {};

  return (
    <Wrapper
      {...(wrapperProps as any)}
      className={cn(
        'flex items-start gap-2.5 rounded-lg border p-3 transition-all hover:shadow-sm',
        cfg.bg,
      )}
    >
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="min-w-0 truncate text-sm font-medium">
            <BilingualText en={event.title} el={event.titleEl} compact />
          </span>
          {event.priority === 'high' && (
            <Badge variant="destructive" size="sm" className="px-1">
              <BilingualText en="High" el="Υψηλή" compact secondaryClassName="hidden" />
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {event.time && (
            <span className="flex items-center gap-0.5"><Clock className="icon-sm" aria-hidden="true" />{event.time}{event.endTime ? ` – ${event.endTime}` : ''}</span>
          )}
          {event.location && (
            <span className="flex items-center gap-0.5">
              <MapPin className="icon-sm" />
              <BilingualText en={event.location} el={event.locationEl} compact />
            </span>
          )}
          {event.participants && event.participants.length > 0 && (
            <span className="flex items-center gap-0.5"><Users className="icon-sm" aria-hidden="true" />{event.participants.join(', ')}</span>
          )}
        </div>
      </div>
      <Badge variant="secondary" className="h-4 shrink-0 text-2xs">
        <BilingualText en={cfg.labelEn} el={cfg.labelEl} compact secondaryClassName="hidden" />
      </Badge>
    </Wrapper>
  );
}

function MiniCalendar({
  year,
  month,
  selectedDate,
  onSelectDate,
  events,
}: {
  year: number;
  month: number;
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  events: CalendarEvent[];
}) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = new Date();
  const { locale, bcp47, t } = useI18n();

  // UTC matches the Date.UTC cells. Only English and Greek pair in one label;
  // every other locale reads its own date format, since the DOM pass cannot
  // re-spell a weekday and month written out in English.
  const dayLabel = (date: Date, hasEvents: boolean) => {
    const spell = (tag: string) =>
      date.toLocaleDateString(tag, { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (locale !== 'en' && locale !== 'el') {
      return hasEvents ? t('{label}, has events', { label: spell(bcp47) }) : spell(bcp47);
    }
    return bilingualAria(
      `${spell('en-GB')}${hasEvents ? ', has events' : ''}`,
      `${spell('el-GR')}${hasEvents ? ', έχει εκδηλώσεις' : ''}`,
    );
  };

  const eventDates = useMemo(() => {
    const set = new Set<number>();
    events.forEach((e) => {
      const ed = new Date(e.date);
      if (ed.getUTCFullYear() === year && ed.getUTCMonth() === month) set.add(ed.getUTCDate());
    });
    return set;
  }, [events, year, month]);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);

  return (
    <div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DAYS.map((d) => (
          <div key={d.en} className="py-1 text-center text-xs font-medium text-muted-foreground">
            <BilingualText en={d.en} el={d.el} compact secondaryClassName="hidden" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />;
          // Date.UTC, to match isSameDay below. The local constructor put this
          // cell on the previous calendar day at UTC+14, so `isToday` and
          // `isSelected` — and therefore the cell's className — differed between
          // the server and the browser.
          const date = new Date(Date.UTC(year, month, day));
          const isToday = isSameDay(date, today);
          const isSelected = isSameDay(date, selectedDate);
          const hasEvents = eventDates.has(day);
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDate(date)}
              // A bare "15" told a screen reader nothing about which month or
              // whether anything happens that day.
              aria-label={dayLabel(date, hasEvents)}
              aria-pressed={isSelected}
              aria-current={isToday ? 'date' : undefined}
              className={cn(
                'relative h-8 w-full rounded-md text-xs transition-all hover:bg-secondary',
                isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90',
                isToday && !isSelected && 'border border-primary/50 font-bold',
              )}
            >
              {day}
              {hasEvents && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const router = useRouter();
  const { primary } = useLanguagePreference();
  // The page is prerendered at build time, and "today" then is not today when
  // it is read: after the date changed, the grid, the today highlight and the
  // sample dates all disagreed with the browser and React #418 fired on every
  // visit. Nothing dated renders until the client has its own clock.
  const hydrated = useHydrated();
  const [currentMonth, setCurrentMonth] = useState(now.getUTCMonth());
  const [currentYear, setCurrentYear] = useState(now.getUTCFullYear());
  const [selectedDate, setSelectedDate] = useState(now);
  const [typeFilter, setTypeFilter] = useState<EventType | 'all'>('all');
  const [view, setView] = useState<'calendar' | 'list'>('calendar');

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
    else setCurrentMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
    else setCurrentMonth((m) => m + 1);
  };

  const { showDemoData } = useDemoData();
  const { data: milestoneData, isLoading: milestonesLoading } = useQuery({
    queryKey: qk('milestones', 'all', 'all'),
    queryFn: () => listMilestones({ limit: 100 }),
    staleTime: 30_000,
    retry: 0,
  });
  const { data: sessionData, isLoading: sessionsLoading } = useQuery({
    queryKey: qk('mentorships', 'sessions-upcoming'),
    queryFn: getUpcomingMentorshipSessions,
    staleTime: 30_000,
    retry: 0,
  });
  const { data: eventData, isLoading: eventsLoading } = useQuery({
    queryKey: qk('events', 'calendar'),
    queryFn: () => listEvents({ scope: 'upcoming', limit: 100 }),
    staleTime: 60_000,
    retry: 0,
  });
  const loading = milestonesLoading || sessionsLoading || eventsLoading;
  const liveEvents = useMemo<CalendarEvent[]>(() => [
    ...(milestoneData?.milestones ?? []).map(fromMilestone).filter((e): e is CalendarEvent => e != null),
    ...(sessionData?.sessions ?? []).filter((x) => x.status === 'scheduled').map(fromSession),
    ...(eventData?.events ?? []).filter((ev) => ev.viewerRsvp === 'going' || ev.viewerRsvp === 'interested').map(fromEvent),
  ], [milestoneData, sessionData, eventData]);
  const isSample = !loading && liveEvents.length === 0 && showDemoData;

  const filteredEvents = useMemo(() => {
    let evts = liveEvents.length ? liveEvents : isSample ? DEMO_EVENTS : [];
    if (typeFilter !== 'all') evts = evts.filter((e) => e.type === typeFilter);
    return [...evts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [typeFilter, liveEvents, isSample]);

  const selectedDayEvents = useMemo(() => {
    return filteredEvents.filter((e) => isSameDay(new Date(e.date), selectedDate));
  }, [filteredEvents, selectedDate]);

  const upcomingEvents = useMemo(() => {
    const n = new Date();
    const todayStart = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
    return filteredEvents.filter((e) => new Date(e.date) >= todayStart).slice(0, 8);
  }, [filteredEvents]);

  // Stats
  const thisMonthEvents = filteredEvents.filter((e) => {
    const ed = new Date(e.date);
    return ed.getUTCFullYear() === currentYear && ed.getUTCMonth() === currentMonth;
  });
  const deadlineCount = thisMonthEvents.filter((e) => e.type === 'deadline').length;
  const sessionCount = thisMonthEvents.filter((e) => e.type === 'session').length;
  const milestoneCount = thisMonthEvents.filter((e) => e.type === 'milestone').length;

  usePageList([
    {
      id: 'month',
      labelEn: 'This month',
      labelEl: 'Αυτός ο μήνας',
      rows: loading ? undefined : thisMonthEvents.map((e) => `${e.date.slice(0, 10)}${e.time ? ` ${e.time}` : ''} · ${e.title} · ${e.type}${e.location ? ` · ${e.location}` : ''}`),
      sample: isSample,
    },
  ]);
  // Offered to the assistant: the event-type filter, through the same setter.
  usePageControls([
    choiceControl('event_type', 'Event type filter', 'Φίλτρο τύπου εκδήλωσης', [
      { value: 'all', en: 'All events', el: 'Όλες οι εκδηλώσεις' },
      ...(Object.entries(TYPE_CONFIG) as [EventType, (typeof TYPE_CONFIG)[EventType]][]).map(([key, cfg]) => ({ value: key, en: cfg.labelEn, el: cfg.labelEl })),
    ], typeFilter, (v) => setTypeFilter(v as EventType | 'all')),
  ]);

  const rail: PageRailSection[] = [
    {
      id: 'stats',
      glyph: 'chart',
      labelEn: 'Month stats',
      labelEl: 'Στατιστικά μήνα',
      content: (
        <RailStats
          items={[
            { key: 'month', label: 'This month', labelEl: 'Αυτόν τον μήνα', value: thisMonthEvents.length, icon: CalendarIcon, tone: 'bg-primary/10 text-primary-accessible' },
            { key: 'deadlines', label: 'Deadlines', labelEl: 'Προθεσμίες', value: deadlineCount, icon: Clock, tone: 'bg-status-danger-bg text-status-danger' },
            { key: 'sessions', label: 'Sessions', labelEl: 'Συνεδρίες', value: sessionCount, icon: Video, tone: 'bg-status-info-bg text-status-info' },
            { key: 'milestones', label: 'Milestones', labelEl: 'Ορόσημα', value: milestoneCount, icon: Flag, tone: 'bg-status-warning-bg text-status-warning' },
          ]}
        />
      ),
    },
    {
      id: 'filters',
      glyph: 'sliders',
      labelEn: 'Event types',
      labelEl: 'Τύποι εκδηλώσεων',
      badge: typeFilter !== 'all' ? 1 : null,
      content: (
        /* The legend folded in here: each row already carries the type's icon
           and bilingual name, and the active state says which one filters. */
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setTypeFilter('all')}
            aria-pressed={typeFilter === 'all'}
            className={cn(
              'tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors',
              typeFilter === 'all' ? 'bg-primary/10 text-primary-accessible' : 'hover:bg-muted/70',
            )}
          >
            <span className="min-w-0 flex-1"><BilingualText en="All" el="Όλα" compact /></span>
          </button>
          {(Object.entries(TYPE_CONFIG) as [EventType, typeof TYPE_CONFIG[EventType]][]).map(([key, cfg]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTypeFilter(key)}
              aria-pressed={typeFilter === key}
              className={cn(
                'tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors',
                typeFilter === key ? 'bg-primary/10 text-primary-accessible' : 'hover:bg-muted/70',
              )}
            >
              <cfg.icon className={cn('icon-sm shrink-0', cfg.color)} aria-hidden="true" />
              <span className="min-w-0 flex-1"><BilingualText en={cfg.labelEn} el={cfg.labelEl} compact wrap /></span>
            </button>
          ))}
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
          <RailAction icon={Flag} en="Open milestones" el="Άνοιγμα οροσήμων" onClick={() => router.push('/milestones')} />
          <RailAction icon={GraduationCap} en="Open mentoring" el="Άνοιγμα καταλόγου μεντόρων" onClick={() => router.push('/mentoring')} />
          <RailAction icon={CalendarDays} en="Open events" el="Άνοιγμα εκδηλώσεων" onClick={() => router.push('/events')} />
          <RailAction icon={MessageCircle} en="Open messages" el="Άνοιγμα μηνυμάτων" onClick={() => router.push('/messages')} />
        </div>
      ),
    },
  ];

  if (!hydrated) {
    return (
      <AppShell showHelp rail={rail} askAi="What is coming up on my calendar this week, and what should I prepare first?">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]" aria-busy="true">
          <div className="h-80 animate-pulse rounded-xl bg-muted/40" />
          <div className="h-[32rem] animate-pulse rounded-xl bg-muted/40" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      showHelp
      rail={rail}
      askAi="What is coming up on my calendar this week, and what should I prepare first?"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center overflow-hidden rounded-xl border">
            <Button variant={view === 'calendar' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-r-none" onClick={() => setView('calendar')} aria-label={bilingualAria('Calendar view', 'Προβολή ημερολογίου')}>
              <LayoutGrid className="icon-sm" />
            </Button>
            <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-l-none" onClick={() => setView('list')} aria-label={bilingualAria('List view', 'Προβολή λίστας')}>
              <List className="icon-sm" />
            </Button>
          </div>
          {/* /events/create has existed all along. */}
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/events/create"><Plus className="icon-sm" /> <BilingualText en="Add Event" el="Προσθήκη εκδήλωσης" compact /></Link>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {isSample && (
          <SampleDataNotice
            surface="Calendar"
            detail="You have no milestone due dates, upcoming sessions or events you are going to yet. These items are samples so you can learn the layout."
            askAiPrompt="What should I put on my calendar first: milestones, a mentoring session, or an event?"
          />
        )}

        {view === 'calendar' ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
            {/* Left: Mini calendar */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="icon" onClick={prevMonth} aria-label={bilingualAria('Previous month', 'Προηγούμενος μήνας')}><ChevronLeft className="icon-sm" /></Button>
                    <span className="text-sm font-semibold">
                      <BilingualText en={MONTHS[currentMonth].en} el={MONTHS[currentMonth].el} compact secondaryClassName="hidden" />{' '}
                      {currentYear}
                    </span>
                    <Button variant="ghost" size="icon" onClick={nextMonth} aria-label={bilingualAria('Next month', 'Επόμενος μήνας')}><ChevronRight className="icon-sm" /></Button>
                  </div>
                </CardHeader>
                <CardContent className="pb-4">
                  <MiniCalendar
                    year={currentYear}
                    month={currentMonth}
                    selectedDate={selectedDate}
                    onSelectDate={setSelectedDate}
                    events={filteredEvents}
                  />
                </CardContent>
              </Card>

            </div>

            {/* Right: Selected day events + upcoming */}
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarDays className="icon-sm text-muted-foreground" />
                    <BilingualText
                      en={selectedDate.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      el={selectedDate.toLocaleDateString('el-GR', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      wrap
                    />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedDayEvents.length > 0 ? (
                    <div className="space-y-2">
                      {selectedDayEvents.map((e) => <EventChip key={e.id} event={e} />)}
                    </div>
                  ) : (
                    <div className="py-2">
                      <CalendarIcon className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground"><BilingualText en="No events on this day" el="Καμία εκδήλωση αυτή την ημέρα" /></p>
                      <Button asChild variant="outline" size="sm" className="mt-3 gap-1">
                        <Link href="/events/create"><Plus className="icon-sm" /> <BilingualText en="Schedule something" el="Προγραμματισμός" compact /></Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="icon-sm text-muted-foreground" /> <BilingualText en="Upcoming" el="Επερχόμενες" compact />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {upcomingEvents.map((e) => (
                      <div key={e.id} className="flex min-w-0 items-center gap-3 overflow-hidden text-sm">
                        <span className="w-[4.5rem] shrink-0 tabular-nums text-xs text-muted-foreground">
                          {formatUpcomingDate(e.date, primary)}
                        </span>
                        <div className={cn('h-2 w-2 rounded-full shrink-0', TYPE_CONFIG[e.type].color.replace('text-', 'bg-'))} />
                        <span className="min-w-0 flex-1 truncate">
                          <BilingualText en={e.title} el={e.titleEl} compact />
                        </span>
                        <Badge variant="secondary" className="h-4 shrink-0 text-2xs">
                          <BilingualText en={TYPE_CONFIG[e.type].labelEn} el={TYPE_CONFIG[e.type].labelEl} compact secondaryClassName="hidden" />
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          /* List view */
          <div className="space-y-2">
            {filteredEvents.length > 0 ? (
              filteredEvents.map((e) => <EventChip key={e.id} event={e} />)
            ) : (
              <Card>
                <CardContent>
                  <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground"><BilingualText en="No events match your filters" el="Καμία εκδήλωση δεν ταιριάζει με τα φίλτρα" /></p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

      </div>
    </AppShell>
  );
}
