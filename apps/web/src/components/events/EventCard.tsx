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
import { useDateFormat } from '@/lib/i18n/useDateFormat';
import { FactLine } from '@/components/common/FactLine';
import { StatusText } from '@/components/common/StatusText';

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
            <div className="flex-shrink-0 text-center">
              <div className="w-14 h-14 rounded-lg bg-muted flex flex-col items-center justify-center">
                <span className="text-xs text-primary-accessible">
                  {fmtDate(event.startDate, { month: 'short' })}
                </span>
                <span className="text-lg font-semibold text-primary-accessible">
                  {event.startDate.getDate()}
                </span>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <Link
                href={`/events/${event.id}`}
                className="font-semibold text-foreground hover:text-primary-accessible transition-colors line-clamp-1"
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
                  {event.attendeesCount} attending
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
                  Going
                </>
              ) : isFull ? (
                'Full'
              ) : (
                'RSVP'
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
        
        <CardContent className="space-y-3 pt-4">
          <Link
            href={`/events/${event.id}`}
            className="font-display text-base font-semibold text-foreground hover:text-primary-accessible transition-colors"
          >
            {event.title}
          </Link>
          
          <p className="card-copy text-sm text-muted-foreground leading-relaxed line-clamp-2">
            {event.description}
          </p>
          
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="icon-sm" />
              {fmtDate(event.startDate, { weekday: 'short', month: 'short', day: 'numeric' })} • {formatEventTime(event.startDate, event.endDate)}
            </span>
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="icon-sm" />
                {event.location}
              </span>
            )}
          </div>
          
          {/* Host: the small identity row used on Connections. */}
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={event.hostAvatar || undefined} />
              <AvatarFallback className="bg-primary/20 text-primary-accessible text-sm">
                {initialsOf(event.hostName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{event.hostName}</p>
              <p className="text-xs text-muted-foreground"><StatusText value={event.hostRole} /></p>
            </div>
          </div>
          
          {/* Tags */}
          {event.tags && event.tags.length > 0 && (
            <FactLine items={event.tags} />
          )}

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="icon-sm" />
              {event.attendeesCount} attending
            </span>
            {spotsLeft !== null && spotsLeft > 0 && spotsLeft <= 10 && (
              <span className="text-status-warning">{spotsLeft} spots left</span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
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
                    Going
                  </>
                ) : isFull ? (
                  'Full'
                ) : (
                  'RSVP'
                )}
              </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default variant — the same stack as an opportunity card. The date
  // mark takes the avatar's place.
  return (
    <Card className={cn('group hover:border-primary/30 transition-colors', className)}>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-muted ring-2 ring-border/60">
            <span className="text-2xs leading-none text-primary-accessible">
              {fmtDate(event.startDate, { month: 'short' })}
            </span>
            <span className="text-sm font-semibold leading-none text-foreground">
              {event.startDate.getDate()}
            </span>
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-base font-semibold text-foreground">
                <Link
                  href={`/events/${event.id}`}
                  className="hover:text-primary-accessible transition-colors"
                >
                  {event.title}
                </Link>
              </h3>
              <Badge variant="outline" className="shrink-0 gap-1">
                <EventTypeIcon type={event.type} />
                <EventTypeLabel type={event.type} />
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">by {event.hostName}</p>
          </div>
        </div>

        {event.description && (
          <p className="card-copy text-sm text-muted-foreground leading-relaxed line-clamp-2">
            {event.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="icon-sm" />
            {formatEventTime(event.startDate, event.endDate)}
          </span>
          {event.location && (
            <span className="flex items-center gap-1">
              <MapPin className="icon-sm" />
              {event.location}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="icon-sm" />
            {event.attendeesCount} attending
          </span>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button aria-label="Save"
            variant="ghost"
            size="sm"
            onClick={handleBookmark}
            className={cn('gap-1.5 text-xs', bookmarked && 'text-status-warning')}
          >
            <Bookmark className={cn('icon-sm', bookmarked && 'fill-current')} />
            <BilingualText en="Save" el="Αποθήκευση" compact />
          </Button>
          <Button
            variant={rsvped ? 'secondary' : 'default'}
            size="sm"
            className="gap-1.5 text-xs"
            onClick={handleRsvp}
            disabled={isFull && !rsvped}
          >
            {rsvped ? (
              <>
                <CheckCircle className="icon-sm" />
                Going
              </>
            ) : isFull ? (
              'Full'
            ) : (
              'RSVP'
            )}
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
