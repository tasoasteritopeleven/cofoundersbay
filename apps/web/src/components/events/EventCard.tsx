'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, initialsOf } from '@/lib/utils';
import { BilingualText } from '@/components/common/BilingualText';
import { useDateFormat } from '@/lib/i18n/useDateFormat';

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

export function EventCard({
  event,
  onRsvp,
  className,
}: EventCardProps) {
  const fmtDate = useDateFormat();
  const [rsvped, setRsvped] = useState(event.isRsvped || false);

  const handleRsvp = () => {
    setRsvped(!rsvped);
    onRsvp?.();
  };

  const isFull = event.maxAttendees ? event.attendeesCount >= event.maxAttendees : false;

  const when = `${fmtDate(event.startDate, { weekday: 'short', month: 'short', day: 'numeric' })} · ${formatEventTime(event.startDate, event.endDate)}`;
  const place = event.location ?? (event.type === 'online' ? 'Online' : null);
  return (
    <Card className={cn('card-interactive', className)}>
      <CardContent className="flex items-center gap-4">
        <Avatar className="h-10 w-10 shrink-0 ring-2 ring-primary/20">
          <AvatarImage src={event.hostAvatar || undefined} />
          <AvatarFallback className="bg-primary/20 text-primary-accessible font-semibold">
            {initialsOf(event.hostName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/events/${event.id}`} className="person-name inline-flex tap-target-y items-center font-display text-base font-semibold text-foreground transition-colors hover:text-primary-accessible">
              {event.title}
            </Link>
            <Badge variant="outline" className="text-xs gap-1">
              <EventTypeLabel type={event.type} />
            </Badge>
          </div>
          <p className="row-ellipsis text-sm text-muted-foreground">
            {[event.hostName, when, place, `${event.attendeesCount} attending`, ...(event.tags ?? []).slice(0, 3)].filter(Boolean).join(' · ')}
          </p>
          {event.description ? (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{event.description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant={rsvped ? 'secondary' : 'default'}
            size="sm"
            className="gap-1"
            onClick={handleRsvp}
            disabled={isFull && !rsvped}
          >
            {rsvped ? 'Going' : isFull ? 'Full' : 'RSVP'}
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
