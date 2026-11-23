'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarPlus, Clock, ExternalLink, MapPin, Share2, Users, Video } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { BilingualText } from '@/components/common/BilingualText';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CardHead } from '@/components/common/CardAnatomy';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { getEvent, rsvpEvent, type EventItem } from '@/lib/api';
import { cn, initialsOf } from '@/lib/utils';
import { qk } from '@/lib/query-keys';
import { usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { PersonHovercard } from '@/components/common/PersonHovercard';
import { buildIcs, downloadIcs, icsFileName } from '@/lib/ics';
import { onRadioGroupKeyDown, radioTabIndex } from '@/lib/radio-keys';
import { bilingualAria } from '@/lib/i18n/format';
import { StatusText, statusEl, statusEn } from '@/components/common/StatusText';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';
import { PhoneStickyAction } from '@/components/common/PhoneStickyAction';
import { EventReconnect, useEventParticipation } from './EventReconnect';

type Rsvp = 'going' | 'interested' | 'not_going';

const RSVP_OPTIONS: { value: Rsvp; en: string; el: string }[] = [
  { value: 'going', en: 'Going', el: 'Θα έρθω' },
  { value: 'interested', en: 'Interested', el: 'Ενδιαφέρομαι' },
  { value: 'not_going', en: 'Not going', el: 'Δεν θα έρθω' },
];

/** RFC 5545 UTC timestamp: 20260924T170000Z. */
/** This event as a calendar file (lib/ics: the semicolon is escaped now). */
function downloadEventIcs(event: EventItem) {
  const url = `${window.location.origin}/events/${event.id}`;
  downloadIcs(
    icsFileName(event.title, 'event'),
    buildIcs([{
      uid: event.id,
      title: event.title,
      start: event.startAt,
      end: event.endAt || event.startAt,
      description: event.description ?? '',
      location: event.location || event.meetingUrl || null,
      url,
    }]),
  );
}

/**
 * One event.
 *
 * Every event card, the events list's Share action and the calendar linked to
 * /events/:id, and the route did not exist - each of those links ended on a
 * 404. GET /events/:eventId was already served (with the viewer's RSVP), so
 * this page reads it and offers what the card offers - RSVP, calendar,
 * share - plus the description, the host and the meeting link.
 */
export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();

  const { data, isLoading, isError } = useQuery({
    queryKey: qk('events', 'detail', id),
    queryFn: () => getEvent(id),
    enabled: Boolean(id),
    staleTime: 60_000,
    retry: 0,
  });
  const event = data?.event ?? null;
  const participation = useEventParticipation(event);
  const { primary } = useLanguagePreference();
  const coverRef = useRef<HTMLImageElement>(null);
  const [coverFailed, setCoverFailed] = useState(false);
  // An image that failed before hydration fired no onError.
  useEffect(() => {
    const img = coverRef.current;
    if (img && img.complete && img.naturalWidth === 0) setCoverFailed(true);
  }, [event?.coverImageUrl]);

  const respond = async (status: Rsvp): Promise<PageControlRunResult> => {
    if (!event) return { error: 'The event has not loaded.' };
    try {
      await rsvpEvent(event.id, status);
      queryClient.setQueryData(qk('events', 'detail', id), (old: { event: EventItem } | undefined) =>
        old
          ? {
              event: {
                ...old.event,
                viewerRsvp: status,
                attendeesCount:
                  old.event.attendeesCount +
                  (status === 'going' && old.event.viewerRsvp !== 'going' ? 1 : 0) -
                  (status !== 'going' && old.event.viewerRsvp === 'going' ? 1 : 0),
              },
            }
          : old,
      );
      void queryClient.invalidateQueries({ queryKey: qk('events') });
      success('RSVP updated');
    } catch (e) {
      showError('RSVP failed', e instanceof Error ? e.message : 'Sign in and try again.');
      return { error: e instanceof Error && e.message ? e.message : 'The RSVP was not saved.' };
    }
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/events/${id}`);
      success('Link copied', 'Event link copied to clipboard');
    } catch {
      showError('Could not copy', 'The browser refused clipboard access.');
    }
  };

  /*
   * RSVP, calendar and share, offered to the assistant. `upsertRsvp` writes
   * the status, and "going" also notifies the host and is capped by capacity,
   * so an RSVP names its previous answer as the undo only when neither side
   * is "going": interested and not going swap one field and nothing else.
   */
  const previous = event?.viewerRsvp ?? null;
  const unloaded = !event ? 'The event has not loaded.' : undefined;
  const unloadedEl = !event ? 'Η εκδήλωση δεν έχει φορτωθεί.' : undefined;
  usePageControls([
    {
      id: 'rsvp',
      labelEn: 'RSVP to this event',
      labelEl: 'Απάντηση για την εκδήλωση',
      writes: true,
      options: RSVP_OPTIONS.map((o) => ({ value: o.value, labelEn: o.en, labelEl: o.el })),
      current: previous ?? undefined,
      unavailableEn: unloaded,
      unavailableEl: unloadedEl,
      undo: (value) =>
        previous && previous !== 'going' && value && value !== 'going' && value !== previous
          ? { control: 'rsvp', value: previous }
          : undefined,
      run: (value) => (value ? respond(value as Rsvp) : undefined),
    },
    {
      id: 'add_to_calendar',
      labelEn: 'Download the event for my calendar (.ics)',
      labelEl: 'Λήψη της εκδήλωσης για το ημερολόγιο (.ics)',
      writes: false,
      unavailableEn: unloaded,
      unavailableEl: unloadedEl,
      run: () => { if (event) downloadEventIcs(event); },
    },
    {
      id: 'copy_event_link',
      labelEn: 'Copy the event link',
      labelEl: 'Αντιγραφή συνδέσμου εκδήλωσης',
      writes: false,
      run: share,
    },
    ...participation.controls,
  ]);
  usePageList([...participation.lists]);

  if (isLoading) {
    return (
      <AppShell title="Event" titleEl="Εκδήλωση">
        <div className="space-y-6">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      </AppShell>
    );
  }

  if (isError || !event) {
    return (
      <AppShell title="Event not found" titleEl="Η εκδήλωση δεν βρέθηκε">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              <BilingualText
                en="This event does not exist, was removed, or is not visible to you."
                el="Η εκδήλωση δεν υπάρχει, αφαιρέθηκε ή δεν είναι ορατή σε εσάς."
                compact
                wrap
              />
            </p>
            <Button variant="outline" className="mt-4 gap-2" asChild>
              <Link href="/events">
                <ArrowLeft className="icon-sm" aria-hidden="true" />
                <BilingualText en="All events" el="Όλες οι εκδηλώσεις" compact />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const tz = event.timezone || undefined;
  // In the reader's language: a Greek reader met "Wednesday 21 October 2026"
  // (docs §70).
  const dateLocale = primary === 'el' ? 'el-GR' : 'en-GB';
  const when = new Intl.DateTimeFormat(dateLocale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz, timeZoneName: 'short',
  });
  const ended = new Date(event.endAt || event.startAt).getTime() < Date.now();
  const full = event.capacity != null && event.attendeesCount >= event.capacity && event.viewerRsvp !== 'going';

  return (
    <AppShell
      title={event.title}
      // The kind as a word in the reader's language ("webinar" printed raw).
      description={statusEn(event.eventType)}
      descriptionEl={statusEl(event.eventType)}
      askAi={{
        en: `Help me prepare for the event "${event.title}".`,
        el: `Βοήθησέ με να προετοιμαστώ για την εκδήλωση «${event.title}».`,
      }}
      actions={
        <>
          {/* Not for an event that is over: the RSVP card already says so. */}
          {ended ? null : (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => downloadEventIcs(event)}>
              <CalendarPlus className="icon-sm" aria-hidden="true" />
              <BilingualText en="Add to calendar" el="Προσθήκη στο ημερολόγιο" compact />
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-2" onClick={() => void share()}>
            <Share2 className="icon-sm" aria-hidden="true" />
            <BilingualText en="Share" el="Κοινοποίηση" compact />
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {/* A cover that does not load leaves no empty band (it was a third
              of the column, blank, above the facts). */}
          {event.coverImageUrl && !coverFailed && (
            <img
              ref={coverRef}
              onError={() => setCoverFailed(true)}
              src={event.coverImageUrl}
              alt=""
              className="aspect-[3/1] w-full rounded-2xl object-cover"
            />
          )}
          <Card>
            <CardContent className="space-y-3">
              <p className="flex items-start gap-2 text-sm">
                <Clock className="mt-0.5 icon-sm shrink-0 text-muted-foreground" aria-hidden="true" />
                <span>
                  {when.format(new Date(event.startAt))}
                  {event.endAt && <> – {new Intl.DateTimeFormat(dateLocale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(new Date(event.endAt))}</>}
                </span>
              </p>
              <p className="flex items-start gap-2 text-sm">
                {event.isOnline ? (
                  <Video className="mt-0.5 icon-sm shrink-0 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <MapPin className="mt-0.5 icon-sm shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <StatusText value={event.mode} />
                {event.location && <span className="text-muted-foreground">· {event.location}</span>}
              </p>
              {event.meetingUrl && event.viewerRsvp === 'going' && (
                <a
                  href={event.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-accessible hover:underline"
                >
                  <ExternalLink className="icon-sm" aria-hidden="true" />
                  <BilingualText en="Join link" el="Σύνδεσμος συμμετοχής" compact />
                </a>
              )}
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="icon-sm shrink-0" aria-hidden="true" />
                {event.attendeesCount}
                {event.capacity != null && ` / ${event.capacity}`}
                <BilingualText en="attending" el="συμμετέχουν" compact />
              </p>
            </CardContent>
          </Card>
          {event.description && (
            <Card>
              <CardContent>
                <p className="card-body whitespace-pre-line first-letter:uppercase">{event.description}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card id="event-rsvp">
            <CardHeader>
              <CardTitle>
                <BilingualText en="Your RSVP" el="Η απάντησή σας" compact />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ended ? (
                <Badge variant="secondary"><BilingualText en="This event has ended" el="Η εκδήλωση ολοκληρώθηκε" compact /></Badge>
              ) : (
                // The arrows move without answering: an RSVP is sent the moment it is chosen.
                <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-label={bilingualAria('RSVP', 'Συμμετοχή')} onKeyDown={(e) => onRadioGroupKeyDown(e, { select: false })}>
                  {RSVP_OPTIONS.map((o, i) => (
                    <Button
                      key={o.value}
                      role="radio"
                      aria-checked={event.viewerRsvp === o.value}
                      tabIndex={radioTabIndex(event.viewerRsvp === o.value, i, RSVP_OPTIONS.some((x) => x.value === event.viewerRsvp))}
                      variant={event.viewerRsvp === o.value ? 'default' : 'outline'}
                      size="sm"
                      disabled={o.value === 'going' && full}
                      onClick={() => void respond(o.value)}
                      className={cn('justify-start')}
                    >
                      <BilingualText en={o.en} el={o.el} compact />
                    </Button>
                  ))}
                  {full && (
                    <p className="text-xs text-muted-foreground">
                      <BilingualText en="The event is at capacity." el="Η εκδήλωση είναι πλήρης." compact wrap />
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <CardHead
                mark={(
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={event.host?.avatarUrl ?? undefined} alt="" />
                    <AvatarFallback className="bg-primary/10 font-semibold text-primary-accessible">{initialsOf(event.host?.displayName)}</AvatarFallback>
                  </Avatar>
                )}
                title={event.host?.id ? (
                  <PersonHovercard userId={event.host.id}><Link href={`/profiles/${event.host.id}`} className="transition-colors hover:text-primary-accessible">{event.host.displayName}</Link></PersonHovercard>
                ) : (
                  <span>{event.host?.displayName || '—'}</span>
                )}
                // A role under the name, as on every card: "Hosted by" under it
                // read backwards.
                subtitle={<BilingualText en="Host" el="Διοργανωτής" compact />}
              />
            </CardContent>
          </Card>
        </aside>
      </div>
      <EventReconnect participation={participation} event={event} />

      {/* The answer stays in reach on a phone while the RSVP card is off
          screen (docs §115): the same three answers, sent the same way. */}
      {!ended ? (
        <PhoneStickyAction watchId="event-rsvp" label={{ en: 'Your RSVP', el: 'Η απάντησή σας' }}>
          <div className="grid grid-cols-3 gap-2">
            {RSVP_OPTIONS.map((o) => (
              <Button
                key={o.value}
                size="sm"
                variant={event.viewerRsvp === o.value ? 'default' : 'outline'}
                aria-pressed={event.viewerRsvp === o.value}
                disabled={o.value === 'going' && full}
                onClick={() => void respond(o.value)}
                className="min-w-0 px-2"
              >
                <BilingualText en={o.en} el={o.el} compact />
              </Button>
            ))}
          </div>
        </PhoneStickyAction>
      ) : null}
    </AppShell>
  );
}
