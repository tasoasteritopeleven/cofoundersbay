'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Video,
  ExternalLink,
  Share2,
  Bookmark,
  CheckCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, initialsOf } from '@/lib/utils';
import { BilingualText } from '@/components/common/BilingualText';
import { CardHead } from '@/components/common/CardAnatomy';
import { useDateFormat } from '@/lib/i18n/useDateFormat';
import { FactLine } from '@/components/common/FactLine';

export type EventData = {
  id: string;
  title: string;
  description: string;
  type: 'online' | 'in-person' | 'hybrid';
  startDate: Date;
  endDate: Date;
  location?: string;
  meetingUrl?: string;
  coverImage?: string;
  hostName: string;
  hostAvatar?: string;
  hostRole: string;
  attendeesCount: number;
  maxAttendees?: number;
  isRsvped?: boolean;
  tags?: string[];
};

type EventCardProps = {
  event: EventData;
  variant?: 'default' | 'featured' | 'compact';
  onRsvp?: () => void;
  onShare?: () => void;
  onBookmark?: () => void;
  isBookmarked?: boolean;
  className?: string;
};

function formatEventTime(start: Date, end: Date): string {
  const startTime = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const endTime = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${startTime} - ${endTime}`;
}

const EVENT_TYPE_LABEL: Record<string, { en: string; el: string }> = {
  online: { en: 'Online', el: 'Διαδικτυακή' },
  'in-person': { en: 'In person', el: 'Δια ζώσης' },
  in_person: { en: 'In person', el: 'Δια ζώσης' },
  hybrid: { en: 'Hybrid', el: 'Υβριδική' },
};

/** The format as a word in the reader's language, not the API's identifier. */
function EventTypeLabel({ type }: { type: string }) {
  const label = EVENT_TYPE_LABEL[type];
  return label ? <BilingualText en={label.en} el={label.el} compact /> : <>{type}</>;
}

function EventTypeIcon({ type }: { type: EventData['type'] }) {
  switch (type) {
    case 'online':
      return <Video className="icon-sm" />;
    case 'in-person':
      return <MapPin className="icon-sm" />;
    case 'hybrid':
      return (
        <div className="flex">
          <Video className="icon-sm" />
          <MapPin className="icon-sm -ml-1" />
        </div>
      );
  }
}

export function EventCard({
  event,
  variant = 'default',
  onRsvp,
  onShare,
  onBookmark,
  isBookmarked = false,
  className,
}: EventCardProps) {
  const fmtDate = useDateFormat();
  const [rsvped, setRsvped] = useState(event.isRsvped || false);
  const [bookmarked, setBookmarked] = useState(isBookmarked);

  const handleRsvp = () => {
    setRsvped(!rsvped);
    onRsvp?.();
  };

  const handleBookmark = () => {
    setBookmarked(!bookmarked);
    onBookmark?.();
  };

  const isFull = event.maxAttendees ? event.attendeesCount >= event.maxAttendees : false;
  const spotsLeft = event.maxAttendees ? event.maxAttendees - event.attendeesCount : null;

  if (variant === 'compact') {
    return (
      <Card className={cn('group hover:border-primary/30 transition-colors', className)}>
        <CardContent>
          <div className="flex gap-4">
            {/* Date box */}
            <div data-card-mark="" className="flex h-12 w-12 flex-shrink-0 flex-col items-center justify-center rounded-xl bg-muted leading-none">
              <span className="text-2xs text-primary-accessible">
                {fmtDate(event.startDate, { month: 'short' })}
              </span>
              <span className="mt-0.5 text-base font-bold tabular-nums text-primary-accessible">
                {event.startDate.getDate()}
              </span>
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <Link
                href={`/events/${event.id}`}
                className="card-title text-foreground hover:text-primary-accessible transition-colors line-clamp-2"
              >
                {event.title}
              </Link>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="icon-sm" />
                {formatEventTime(event.startDate, event.endDate)}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="outline" className="text-xs gap-1">
                  <EventTypeIcon type={event.type} />
                  <EventTypeLabel type={event.type} />
                </Badge>
                <span className="text-xs text-muted-foreground">
                  <BilingualText en={`${event.attendeesCount} attending`} el={`${event.attendeesCount} συμμετέχουν`} compact />
                </span>
              </div>
            </div>
            
            {/* RSVP */}
            <Button
              size="sm"
              variant={rsvped ? 'secondary' : 'default'}
              onClick={handleRsvp}
              disabled={isFull && !rsvped}
              className="flex-shrink-0"
            >
              {rsvped ? (
                <>
                  <CheckCircle className="icon-sm mr-1" />
                  <BilingualText en="Going" el="Θα έρθω" compact />
                </>
              ) : isFull ? (
                <BilingualText en="Full" el="Πλήρες" compact />
              ) : (
                <BilingualText en="RSVP" el="Δήλωση συμμετοχής" compact />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === 'featured') {
    return (
      <Card className={cn('group overflow-hidden', className)}>
        {/* Cover image */}
        {event.coverImage && (
          <div className="relative h-48 overflow-hidden">
            <img
              src={event.coverImage}
              alt={event.title}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
            {/* Date badge */}
            <div className="absolute top-4 left-4">
              <div className="rounded-lg bg-background/90 backdrop-blur-sm px-3 py-2 text-center">
                <span className="text-xs font-medium text-primary-accessible block">
                  {fmtDate(event.startDate, { month: 'short' })}
                </span>
                <span className="text-xl font-bold text-foreground">
                  {event.startDate.getDate()}
                </span>
              </div>
            </div>
            {/* Type badge */}
            <div className="absolute top-4 right-4">
              <Badge variant="secondary" className="gap-1">
                <EventTypeIcon type={event.type} />
                <EventTypeLabel type={event.type} />
              </Badge>
            </div>
          </div>
        )}
        
        <CardContent className="pt-4">
          <Link
            href={`/events/${event.id}`}
            className="card-title text-foreground hover:text-primary-accessible transition-colors"
          >
            {event.title}
          </Link>
          
          <p className="card-body mt-2 text-muted-foreground line-clamp-2">
            {event.description}
          </p>
          
          {/* Meta */}
          <FactLine
            className="mt-3"
            items={[
              `${fmtDate(event.startDate, { weekday: 'short', month: 'short', day: 'numeric' })}, ${formatEventTime(event.startDate, event.endDate)}`,
              event.location,
            ]}
          />
          
          {/* Host */}
          <div className="mt-4 flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={event.hostAvatar || undefined} />
              <AvatarFallback className="bg-primary/20 text-primary-accessible text-xs">
                {initialsOf(event.hostName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-foreground">{event.hostName}</p>
              <p className="text-xs text-muted-foreground">{event.hostRole}</p>
            </div>
          </div>
          
          {/* Tags */}
          {event.tags && event.tags.length > 0 && (
            <FactLine className="mt-4" items={event.tags} />
          )}
          
          {/* Actions */}
          <div className="mt-5 flex items-center justify-between pt-4 border-t border-border">
            <FactLine
              items={[
                <BilingualText key="count" en={`${event.attendeesCount} attending`} el={`${event.attendeesCount} συμμετέχουν`} compact />,
                spotsLeft !== null && spotsLeft > 0 && spotsLeft <= 10
                  ? <span key="spots" className="text-status-warning"><BilingualText en={`${spotsLeft} spots left`} el={`${spotsLeft} θέσεις ακόμη`} compact /></span>
                  : null,
              ]}
            />
            <div className="flex items-center gap-2">
              <Button aria-label="Save"
                variant="ghost"
                size="icon"
                onClick={handleBookmark}
                className={cn('gap-1.5 sm:w-auto sm:px-3', bookmarked && 'text-status-warning ')}
              >
                <Bookmark className={cn('icon-sm', bookmarked && 'fill-current')} />
                <span className="hidden sm:inline"><BilingualText en="Save" el="Αποθήκευση" compact /></span>
              </Button>
              <Button variant="ghost" size="icon" onClick={onShare} aria-label={`Share event ${event.title}`} className="gap-1.5 sm:w-auto sm:px-3">
                <Share2 className="icon-sm" />
                <span className="hidden sm:inline"><BilingualText en="Share" el="Κοινοποίηση" compact /></span>
              </Button>
              <Button
                variant={rsvped ? 'secondary' : 'default'}
                onClick={handleRsvp}
                disabled={isFull && !rsvped}
              >
                {rsvped ? (
                  <>
                    <CheckCircle className="icon-sm mr-2" />
                    <BilingualText en="Going" el="Θα έρθω" compact />
                  </>
                ) : isFull ? (
                  <BilingualText en="Full" el="Πλήρες" compact />
                ) : (
                  <BilingualText en="RSVP" el="Δήλωση συμμετοχής" compact />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default variant: the Opportunities card - the date tile as the mark, the
  // title and when beside it, the kind at the right; where, who and how many
  // on the mark's edge; the actions on the axis.
  return (
    <Card className={cn('group hover:border-primary/30 transition-colors', className)}>
      <CardContent className="space-y-3">
        <CardHead
          mark={(
            <div data-card-mark="" className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-muted leading-none">
              <span className="text-2xs text-primary-accessible">
                {fmtDate(event.startDate, { month: 'short' })}
              </span>
              <span className="mt-0.5 text-base font-bold tabular-nums text-primary-accessible">
                {event.startDate.getDate()}
              </span>
            </div>
          )}
          title={(
            <Link
              href={`/events/${event.id}`}
              className="line-clamp-2 hover:text-primary-accessible transition-colors"
            >
              {event.title}
            </Link>
          )}
          subtitle={formatEventTime(event.startDate, event.endDate)}
          meta={event.location ? <span className="block truncate">{event.location}</span> : undefined}
          aside={(
            <Badge variant="outline" className="gap-1">
              <EventTypeIcon type={event.type} />
              <EventTypeLabel type={event.type} />
            </Badge>
          )}
        />

        {/* Host & attendees */}
        <div className="flex min-w-0 items-center gap-2">
          <Avatar className="h-6 w-6 shrink-0">
            <AvatarImage src={event.hostAvatar || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary-accessible text-xs">
              {initialsOf(event.hostName)}
            </AvatarFallback>
          </Avatar>
          <FactLine
            className="min-w-0"
            items={[
              <BilingualText key="host" en={`By ${event.hostName}`} el={`Από ${event.hostName}`} compact />,
              <BilingualText key="count" en={`${event.attendeesCount} attending`} el={`${event.attendeesCount} συμμετέχουν`} compact />,
            ]}
          />
        </div>

        {/* Actions, on the card's axis. */}
        <div className="flex items-center gap-2 pt-3 border-t border-border">
          <Button
            variant={rsvped ? 'secondary' : 'default'}
            size="sm"
            onClick={handleRsvp}
            disabled={isFull && !rsvped}
          >
            {rsvped ? (
              <>
                <CheckCircle className="icon-sm mr-1" />
                <BilingualText en="Going" el="Θα έρθω" compact />
              </>
            ) : isFull ? (
              <BilingualText en="Full" el="Πλήρες" compact />
            ) : (
              <BilingualText en="RSVP" el="Δήλωση συμμετοχής" compact />
            )}
          </Button>
          <Button aria-label="Save"
            variant="ghost"
            size="icon"
            onClick={handleBookmark}
            className={cn('h-8 w-8 gap-1.5 sm:w-auto sm:px-3', bookmarked && 'text-status-warning ')}
          >
            <Bookmark className={cn('icon-sm', bookmarked && 'fill-current')} />
            <span className="hidden sm:inline"><BilingualText en="Save" el="Αποθήκευση" compact /></span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Event card skeleton
export function EventCardSkeleton({ variant = 'default' }: { variant?: 'default' | 'featured' | 'compact' }) {
  if (variant === 'featured') {
    return (
      <Card>
        <div className="h-48 bg-secondary animate-pulse" />
        <CardContent className="pt-4 space-y-4">
          <div className="h-6 w-3/4 bg-secondary rounded animate-pulse" />
          <div className="h-4 w-full bg-secondary rounded animate-pulse" />
          <div className="h-4 w-2/3 bg-secondary rounded animate-pulse" />
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-secondary rounded-full animate-pulse" />
            <div className="h-4 w-24 bg-secondary rounded animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex gap-4">
          <div className="h-16 w-16 bg-secondary rounded-xl animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-3/4 bg-secondary rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-secondary rounded animate-pulse" />
            <div className="h-4 w-1/3 bg-secondary rounded animate-pulse" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
