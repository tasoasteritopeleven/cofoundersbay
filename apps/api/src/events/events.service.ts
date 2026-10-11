import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventType, Prisma, RsvpStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

export type EventViewMode = 'online' | 'in-person' | 'hybrid';

export type EventListItem = {
  id: string;
  title: string;
  description: string;
  eventType: EventType;
  mode: EventViewMode;
  startAt: string;
  endAt: string;
  timezone: string | null;
  location: string | null;
  isOnline: boolean;
  meetingUrl: string | null;
  capacity: number | null;
  coverImageUrl: string | null;
  attendeesCount: number;
  isFeatured: boolean;
  host: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    role: string;
  };
  viewerRsvp: RsvpStatus | null;
};

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async listEvents(params: {
    viewerUserId?: string | null;
    scope?: 'upcoming' | 'mine' | 'past';
    q?: string;
    mode?: EventViewMode;
    limit?: number;
  }): Promise<EventListItem[]> {
    const viewerUserId = params.viewerUserId ?? null;
    const scope = params.scope ?? 'upcoming';
    const now = new Date();
    const and: Prisma.EventWhereInput[] = [];

    if (scope === 'upcoming') {
      and.push({ startAt: { gte: now } });
    } else if (scope === 'past') {
      and.push({ startAt: { lt: now } });
    } else if (scope === 'mine' && viewerUserId) {
      and.push({
        OR: [
          { creatorId: viewerUserId },
          { rsvps: { some: { userId: viewerUserId, status: { in: ['going', 'interested'] } } } },
        ],
      });
    }

    if (params.mode === 'in-person') {
      and.push({ isOnline: false });
    } else if (params.mode === 'online') {
      and.push({ isOnline: true, location: null });
    } else if (params.mode === 'hybrid') {
      and.push({ isOnline: true, location: { not: null } });
    }

    if (params.q?.trim()) {
      const q = params.q.trim();
      and.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { location: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    const items = await this.prisma.event.findMany({
      where: and.length ? { AND: and } : undefined,
      orderBy: { startAt: scope === 'past' ? 'desc' : 'asc' },
      take: Math.min(Math.max(params.limit ?? 24, 1), 100),
      include: {
        creator: {
          select: {
            id: true,
            role: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
        rsvps: {
          where: { userId: viewerUserId ?? '' },
          select: { status: true },
          take: 1,
        },
        _count: { select: { rsvps: true } },
      },
    });

    return items.map((item) => this.toEventListItem(item));
  }

  async getEventById(eventId: string, viewerUserId?: string | null): Promise<EventListItem> {
    const item = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        creator: {
          select: {
            id: true,
            role: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
        rsvps: {
          where: { userId: viewerUserId ?? '' },
          select: { status: true },
          take: 1,
        },
        _count: { select: { rsvps: true } },
      },
    });
    if (!item) throw new NotFoundException('Event not found');
    return this.toEventListItem(item);
  }

  async createEvent(
    creatorId: string,
    input: {
      title: string;
      description?: string | null;
      type: EventType;
      startAt: Date;
      endAt?: Date | null;
      timezone?: string | null;
      location?: string | null;
      isOnline?: boolean;
      meetingUrl?: string | null;
      capacity?: number | null;
      coverImageUrl?: string | null;
    },
  ): Promise<EventListItem> {
    const event = await this.prisma.event.create({
      data: {
        creatorId,
        title: input.title,
        description: input.description ?? null,
        type: input.type,
        startAt: input.startAt,
        endAt: input.endAt ?? null,
        timezone: input.timezone ?? null,
        location: input.location ?? null,
        isOnline: input.isOnline ?? false,
        meetingUrl: input.meetingUrl ?? null,
        capacity: input.capacity ?? null,
        coverImageUrl: input.coverImageUrl ?? null,
      },
      include: {
        creator: {
          select: {
            id: true,
            role: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
        rsvps: { where: { userId: creatorId }, select: { status: true }, take: 1 },
        _count: { select: { rsvps: true } },
      },
    });

    return this.toEventListItem(event);
  }

  async upsertRsvp(params: { userId: string; eventId: string; status: RsvpStatus }) {
    const event = await this.prisma.event.findUnique({
      where: { id: params.eventId },
      select: { id: true, title: true, creatorId: true, capacity: true },
    });
    if (!event) throw new NotFoundException('Event not found');

    const existing = await this.prisma.eventRsvp.findUnique({
      where: {
        eventId_userId: {
          eventId: params.eventId,
          userId: params.userId,
        },
      },
    });

    if (params.status === 'going' && event.capacity) {
      const goingCount = await this.prisma.eventRsvp.count({
        where: {
          eventId: params.eventId,
          status: 'going',
        },
      });

      const alreadyGoing = existing?.status === 'going';
      if (!alreadyGoing && goingCount >= event.capacity) {
        throw new ConflictException('This event is full');
      }
    }

    const rsvp = await this.prisma.eventRsvp.upsert({
      where: {
        eventId_userId: {
          eventId: params.eventId,
          userId: params.userId,
        },
      },
      update: { status: params.status },
      create: {
        eventId: params.eventId,
        userId: params.userId,
        status: params.status,
      },
    });

    if (params.status === 'going' && event.creatorId !== params.userId) {
      void this.notifications
        .createNotification({
          userId: event.creatorId,
          type: 'event_rsvp',
          title: 'New RSVP',
          body: `Someone RSVP'd to "${event.title}"`,
          link: '/events',
          meta: { eventId: event.id, attendeeId: params.userId },
        })
        .catch(() => {});
    }

    return {
      ok: true as const,
      status: rsvp.status,
    };
  }

  generateIcsCalendar(event: EventListItem): string {
    const formatIcsDate = (isoDate: string): string => {
      return new Date(isoDate).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const escapeIcs = (text: string): string => {
      return text.replace(/[\\;,\n]/g, (match) => {
        if (match === '\n') return '\\n';
        return '\\' + match;
      });
    };

    const uid = `${event.id}@cofounderbay.com`;
    const dtstamp = formatIcsDate(new Date().toISOString());
    const dtstart = formatIcsDate(event.startAt);
    const dtend = formatIcsDate(event.endAt);
    const summary = escapeIcs(event.title);
    const description = escapeIcs(event.description || '');
    const location = event.isOnline 
      ? (event.meetingUrl || 'Online') 
      : escapeIcs(event.location || 'TBD');

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CoFounderBay//Events//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      `ORGANIZER;CN=${escapeIcs(event.host.displayName)}:mailto:noreply@cofounderbay.com`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    return icsContent;
  }

  private toEventListItem(item: {
    id: string;
    title: string;
    description: string | null;
    type: EventType;
    startAt: Date;
    endAt: Date | null;
    timezone: string | null;
    location: string | null;
    isOnline: boolean;
    meetingUrl: string | null;
    capacity: number | null;
    coverImageUrl: string | null;
    isFeatured: boolean;
    creator: {
      id: string;
      role: string;
      profile: {
        displayName: string;
        avatarUrl: string | null;
      } | null;
    };
    _count: { rsvps: number };
    rsvps: Array<{ status: RsvpStatus }>;
  }): EventListItem {
    const mode: EventViewMode = item.isOnline
      ? item.location
        ? 'hybrid'
        : 'online'
      : 'in-person';

    const fallbackEndAt = new Date(item.startAt.getTime() + 60 * 60 * 1000);

    return {
      id: item.id,
      title: item.title,
      description: item.description ?? '',
      eventType: item.type,
      mode,
      startAt: item.startAt.toISOString(),
      endAt: (item.endAt ?? fallbackEndAt).toISOString(),
      timezone: item.timezone,
      location: item.location,
      isOnline: item.isOnline,
      meetingUrl: item.meetingUrl,
      capacity: item.capacity,
      coverImageUrl: item.coverImageUrl,
      attendeesCount: item._count.rsvps,
      isFeatured: item.isFeatured,
      host: {
        id: item.creator.id,
        displayName: item.creator.profile?.displayName ?? 'Community host',
        avatarUrl: item.creator.profile?.avatarUrl ?? null,
        role: item.creator.role,
      },
      viewerRsvp: item.rsvps[0]?.status ?? null,
    };
  }
}
