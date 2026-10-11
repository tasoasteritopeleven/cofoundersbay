'use client';

import { choiceControl, rowOptions, usePageControls, usePageList } from '@/lib/page-controls';
import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calendar, Grid, List, MapPin, Plus, Search, Video, CheckCircle2, Layers, X, GraduationCap, MessageCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { RailAction, RailOptions, RailStats } from '@/components/layout/RailParts';
import { usePageRail } from '@/components/layout/PageRailContext';
import { bilingualInline } from '@/lib/i18n/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EventCard, EventCardSkeleton, type EventData } from '@/components/events/EventCard';
import { EmptyState } from '@/components/common/EmptyState';
import { AnimatedList } from '@/components/common/AnimatedList';
import { useToast } from '@/components/ui/toast';
import { listEvents, rsvpEvent, type EventItem } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useIsAuthenticated } from '@/hooks/useIsAuthenticated';
import { BilingualText } from '@/components/common/BilingualText';
import { qk } from '@/lib/query-keys';

type ViewMode = 'grid' | 'list';
type EventFilter = 'all' | 'online' | 'in-person' | 'hybrid';

const FORMAT_OPTIONS = [
  { value: 'all', en: 'Any format', el: 'Οποιαδήποτε μορφή', icon: Layers },
  { value: 'online', en: 'Online', el: 'Διαδικτυακές', icon: Video },
  { value: 'in-person', en: 'In-person', el: 'Δια ζώσης', icon: MapPin },
  { value: 'hybrid', en: 'Hybrid', el: 'Υβριδικές', icon: Calendar },
] as const satisfies ReadonlyArray<{ value: EventFilter; en: string; el: string; icon: unknown }>;

function toEventData(item: EventItem): EventData {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    type: item.mode,
    startDate: new Date(item.startAt),
    endDate: new Date(item.endAt),
    location: item.location ?? undefined,
    meetingUrl: item.meetingUrl ?? undefined,
    coverImage: item.coverImageUrl ?? undefined,
    hostName: item.host.displayName,
    hostAvatar: item.host?.avatarUrl ?? undefined,
    hostRole: item.host.role,
    attendeesCount: item.attendeesCount,
    maxAttendees: item.capacity ?? undefined,
    isRsvped: item.viewerRsvp === 'going' || item.viewerRsvp === 'interested',
    tags: [item.eventType.replaceAll('_', ' ')],
  };
}

export default function EventsPage() {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'my-events' | 'past'>('upcoming');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filter, setFilter] = useState<EventFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { openRailSection } = usePageRail();
  // Offered to the assistant: the tab, the format filter and the layout,
  // through the same setters. RSVPs and creating events are capabilities of
  // their own (rsvp_event, create_event).
  usePageControls([
    choiceControl('tab', 'Events tab', 'Καρτέλα εκδηλώσεων', [
      { value: 'upcoming', en: 'Upcoming', el: 'Επερχόμενες' },
      { value: 'my-events', en: 'My Events', el: 'Οι εκδηλώσεις μου' },
      { value: 'past', en: 'Past', el: 'Παρελθούσες' },
    ], activeTab, (v) => setActiveTab(v as typeof activeTab)),
    choiceControl('format', 'Event format filter', 'Φίλτρο μορφής εκδήλωσης',
      FORMAT_OPTIONS.map(({ value, en, el }) => ({ value, en, el })), filter, (v) => setFilter(v as EventFilter)),
    choiceControl('view', 'Events layout', 'Διάταξη εκδηλώσεων', [
      { value: 'grid', en: 'Grid', el: 'Πλέγμα' },
      { value: 'list', en: 'List', el: 'Λίστα' },
    ], viewMode, (v) => setViewMode(v as ViewMode)),
  ]);

  const hasToken = useIsAuthenticated();

  const scope = activeTab === 'my-events' ? 'mine' : activeTab === 'past' ? 'past' : 'upcoming';

  const { data: eventsResult, isLoading: loading, isError, refetch } = useQuery({
    queryKey: qk('events', scope, searchQuery, filter),
    queryFn: () =>
      listEvents({
        scope,
        q: searchQuery.trim() || undefined,
        mode: filter === 'all' ? undefined : filter,
        limit: 48,
      }),
    enabled: scope !== 'mine' || hasToken,
    staleTime: 60_000,
    retry: 1,
  });

  const eventsRaw = eventsResult?.events ?? [];
  const events = useMemo(() => eventsRaw.map(toEventData), [eventsRaw]);
  const featured = viewMode === 'grid' ? events[0] : null;
  const rest = viewMode === 'grid' ? events.slice(1) : events;

  const handleRsvp = async (event: EventItem): Promise<void> => {
    try {
      const nextStatus = event.viewerRsvp === 'going' ? 'not_going' : 'going';
      await rsvpEvent(event.id, nextStatus);
      queryClient.setQueryData(
        qk('events', scope, searchQuery, filter),
        (old: { events: EventItem[] } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            events: old.events.map((item) =>
              item.id === event.id
                ? {
                    ...item,
                    viewerRsvp: nextStatus,
                    attendeesCount:
                      item.attendeesCount + (nextStatus === 'going' ? 1 : item.viewerRsvp === 'going' ? -1 : 0),
                  }
                : item,
            ),
          };
        },
      );
      success(
        bilingualInline('RSVP updated', 'Η δήλωση ενημερώθηκε'),
        nextStatus === 'going'
          ? bilingualInline('You are going to this event', 'Θα παρευρεθείτε σε αυτή την εκδήλωση')
          : bilingualInline('RSVP removed', 'Η δήλωση αφαιρέθηκε'),
      );
    } catch (e) {
      showError(bilingualInline('RSVP failed', 'Η δήλωση απέτυχε'), e instanceof Error ? e.message : bilingualInline('Please try again', 'Δοκιμάστε ξανά'));
    }
  };

  const handleShare = (event: EventData) => {
    navigator.clipboard.writeText(`${window.location.origin}/events/${event.id}`);
    success(bilingualInline('Link copied', 'Ο σύνδεσμος αντιγράφηκε'), bilingualInline('Event link copied to clipboard', 'Ο σύνδεσμος της εκδήλωσης αντιγράφηκε'));
  };

  usePageList([
    {
      id: 'events',
      labelEn: 'Events',
      labelEl: 'Εκδηλώσεις',
      rows: loading ? undefined : eventsRaw.map((e) =>
        `${e.title} · ${e.startAt.slice(0, 10)} · ${e.mode}${e.location ? ` · ${e.location}` : ''} · ${e.attendeesCount} going${e.viewerRsvp === 'going' ? ' (you are going)' : ''}`,
      ),
    },
  ]);
  usePageControls([
    {
      id: 'share_event',
      labelEn: 'Copy a link to event',
      labelEl: 'Αντιγραφή συνδέσμου εκδήλωσης',
      writes: false,
      options: rowOptions(events, (e) => e.id, (e) => e.title),
      run: (v) => {
        const event = events.find((e) => e.id === v);
        if (event) handleShare(event);
      },
    },
  ]);

  /*
   * The column leads with the tabs, the search and the events. The counts
   * describe the list shown and the format filter narrows it: both are
   * auxiliary, so they live in the rail. The first card is labelled by what
   * the API's order makes it (soonest upcoming, latest past), not "featured".
   */
  const rail: PageRailSection[] = [
    {
      id: 'summary',
      glyph: 'calendar',
      labelEn: 'In this list',
      labelEl: 'Σε αυτή τη λίστα',
      content: (
        <RailStats
          items={[
            { key: 'total', label: 'Events shown', labelEl: 'Εκδηλώσεις που εμφανίζονται', value: events.length, icon: Calendar, tone: 'bg-status-accent-bg text-status-accent' },
            { key: 'online', label: 'Online', labelEl: 'Διαδικτυακές', value: events.filter((e) => e.type === 'online').length, icon: Video, tone: 'bg-status-success-bg text-status-success' },
            { key: 'in-person', label: 'In-person', labelEl: 'Δια ζώσης', value: events.filter((e) => e.type === 'in-person').length, icon: MapPin, tone: 'bg-status-info-bg text-status-info' },
            { key: 'going', label: "You're going or interested", labelEl: 'Θα πάτε ή σας ενδιαφέρει', value: events.filter((e) => e.isRsvped).length, icon: CheckCircle2, tone: 'bg-status-warning-bg text-status-warning' },
          ]}
        />
      ),
    },
    {
      id: 'filters',
      glyph: 'sliders',
      labelEn: 'Filters',
      labelEl: 'Φίλτρα',
      badge: filter !== 'all' ? 1 : null,
      content: (
        <div className="space-y-4">
          <RailOptions title="Format" titleEl="Μορφή" options={FORMAT_OPTIONS} value={filter} onChange={setFilter} />
          {filter !== 'all' && (
            <RailAction icon={X} en="Clear filters" el="Καθαρισμός φίλτρων" onClick={() => setFilter('all')} />
          )}
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
          <RailAction icon={Calendar} en="Open calendar" el="Άνοιγμα ημερολογίου" onClick={() => router.push('/calendar')} />
          <RailAction icon={GraduationCap} en="Open mentoring" el="Άνοιγμα καταλόγου μεντόρων" onClick={() => router.push('/mentoring')} />
          <RailAction icon={MessageCircle} en="Open messages" el="Άνοιγμα μηνυμάτων" onClick={() => router.push('/messages')} />
        </div>
      ),
    },
  ];
  const firstLabel = activeTab === 'past'
    ? { en: 'Most recent', el: 'Πιο πρόσφατη' }
    : activeTab === 'my-events'
      ? { en: 'First on your list', el: 'Πρώτη στη λίστα σας' }
      : { en: 'Next up', el: 'Επόμενη' };

  return (
    <AppShell
      rail={rail}
      showHelp
      askAi="What's coming up in events, and which should I RSVP to or create to meet cofounders?"
      actions={
        <Button className="gap-2" asChild>
          <Link href="/events/create">
            <Plus className="icon-sm" />
            <BilingualText en="Create Event" el="Δημιουργία εκδήλωσης" />
          </Link>
        </Button>
      }
    >
      <div className="space-y-6 pb-10">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* min-w-0 so the tab list's own overflow-x-auto can bound it; without
              it the list sat at min-content and the last trigger sat 8px past
              the viewport at 640px. */}
          <TabsList className="min-w-0">
            <TabsTrigger value="upcoming" className="gap-2">
              <Calendar className="icon-sm" />
              <BilingualText en="Upcoming" el="Επερχόμενες" compact />
            </TabsTrigger>
            <TabsTrigger value="my-events" className="gap-2">
              <BilingualText en="My Events" el="Οι εκδηλώσεις μου" compact />
            </TabsTrigger>
            <TabsTrigger value="past" className="gap-2">
              <BilingualText en="Past" el="Παρελθούσες" compact />
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-1 rounded-lg border border-border p-1">
            <Button aria-label={bilingualInline('Grid view', 'Προβολή πλέγματος')} aria-pressed={viewMode === 'grid'}
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="icon-sm" aria-hidden="true" />
            </Button>
            <Button aria-label={bilingualInline('List view', 'Προβολή λίστας')} aria-pressed={viewMode === 'list'}
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode('list')}
            >
              <List className="icon-sm" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="mt-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 icon-sm -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder={bilingualInline('Search events…', 'Αναζήτηση εκδηλώσεων…')}
              aria-label={bilingualInline('Search events', 'Αναζήτηση εκδηλώσεων')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {(['upcoming', 'my-events', 'past'] as const).map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-6">
            {isError ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <p className="text-sm text-muted-foreground">
                  <BilingualText en="Events could not be loaded." el="Δεν ήταν δυνατή η φόρτωση των εκδηλώσεων." wrap />
                </p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <BilingualText en="Try again" el="Δοκιμάστε ξανά" compact />
                </Button>
              </div>
            ) : loading ? (
              // Three columns at most: at four, each card kept ~170px beside
              // its date box and the host collided with the attendee count.
              <div className={cn('grid grid-cols-1 gap-4', viewMode === 'grid' ? 'md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1')}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <EventCardSkeleton key={i} variant={viewMode === 'list' ? 'compact' : 'default'} />
                ))}
              </div>
            ) : events.length === 0 ? (
              <EmptyState
                title={tab === 'my-events'
                  ? <BilingualText en="No events yet" el="Δεν υπάρχουν εκδηλώσεις ακόμα" />
                  : <BilingualText en="No events found" el="Δεν βρέθηκαν εκδηλώσεις" />}
                description={
                  tab === 'my-events'
                    ? hasToken
                      ? <BilingualText en="You have not said you are going to, or interested in, any event yet." el="Δεν έχετε δηλώσει ακόμα συμμετοχή ή ενδιαφέρον για κάποια εκδήλωση." />
                      : <BilingualText en="Sign in to view your event activity." el="Συνδεθείτε για να δείτε τις εκδηλώσεις σας." />
                    : filter !== 'all'
                      ? <BilingualText en="The format filter in the side panel may be hiding events." el="Το φίλτρο μορφής στο πλευρικό πάνελ ίσως κρύβει εκδηλώσεις." />
                      : searchQuery
                        ? <BilingualText en="Try a different search." el="Δοκιμάστε διαφορετική αναζήτηση." />
                        : <BilingualText en="No events are listed right now." el="Δεν υπάρχουν εκδηλώσεις αυτή τη στιγμή." />
                }
                illustration="calendar"
                askAiPrompt="I have no events. Suggest how to use Events and Calendar to meet cofounders this month."
                action={
                  tab === 'my-events' && !hasToken ? (
                    <Button asChild>
                      <Link href="/login"><BilingualText en="Sign in" el="Σύνδεση" compact /></Link>
                    </Button>
                  ) : filter !== 'all' ? (
                    <Button variant="secondary" onClick={() => openRailSection('filters')}>
                      <BilingualText en="Show filters" el="Εμφάνιση φίλτρων" compact />
                    </Button>
                  ) : searchQuery ? (
                    <Button variant="secondary" onClick={() => setSearchQuery('')}>
                      <BilingualText en="Clear search" el="Καθαρισμός αναζήτησης" compact />
                    </Button>
                  ) : (
                    <Button asChild>
                      <Link href="/events/create"><BilingualText en="Create an event" el="Δημιουργία εκδήλωσης" compact /></Link>
                    </Button>
                  )
                }
              />
            ) : (
              <>
                {featured && (
                  <div className="mb-6">
                    <h2 className="mb-4 text-base font-semibold text-foreground">
                      <BilingualText en={firstLabel.en} el={firstLabel.el} compact />
                    </h2>
                    <EventCard
                      event={featured}
                      variant="featured"
                      onRsvp={() => {
                        const raw = eventsRaw.find((x) => x.id === featured.id);
                        if (raw) void handleRsvp(raw);
                      }}
                      onShare={() => handleShare(featured)}
                    />
                  </div>
                )}

                <AnimatedList
                  animation="fade-in-up"
                  staggerDelay={50}
                  className={cn(
                    'grid grid-cols-1 gap-4',
                    viewMode === 'grid' ? 'md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1',
                  )}
                >
                  {rest.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      variant={viewMode === 'list' ? 'compact' : 'default'}
                      onRsvp={() => {
                        const raw = eventsRaw.find((x) => x.id === event.id);
                        if (raw) void handleRsvp(raw);
                      }}
                      onShare={() => handleShare(event)}
                    />
                  ))}
                </AnimatedList>
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
      </div>
    </AppShell>
  );
}
