import { Body, Controller, Get, Param, Post, Query, UnauthorizedException, UseGuards } from '@nestjs/common';
import { EventType, RsvpStatus } from '@prisma/client';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/jwt-optional.guard';
import { EventsService, type EventViewMode } from './events.service';

const createEventSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(5000).optional(),
  type: z.nativeEnum(EventType).optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().optional(),
  timezone: z.string().trim().max(80).optional(),
  location: z.string().trim().max(180).optional(),
  isOnline: z.boolean().optional(),
  meetingUrl: z.string().trim().url().optional(),
  capacity: z.number().int().min(1).max(5000).optional(),
  coverImageUrl: z.string().trim().url().optional(),
});

const rsvpSchema = z.object({
  status: z.nativeEnum(RsvpStatus).default('going'),
});

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async listEvents(
    @CurrentUser() user: { id: string } | undefined,
    @Query('scope') scope?: 'upcoming' | 'mine' | 'past',
    @Query('q') q?: string,
    @Query('mode') mode?: EventViewMode,
    @Query('limit') limitRaw?: string,
  ) {
    if (scope === 'mine' && !user?.id) {
      throw new UnauthorizedException('Sign in required for your events');
    }

    const limit = limitRaw ? parseInt(limitRaw, 10) : undefined;
    const events = await this.events.listEvents({
      viewerUserId: user?.id ?? null,
      scope,
      q: q?.trim() || undefined,
      mode,
      limit,
    });
    return { events };
  }

  @Get(':eventId')
  @UseGuards(OptionalJwtAuthGuard)
  async getEvent(
    @Param('eventId') eventId: string,
    @CurrentUser() user: { id: string } | undefined,
  ) {
    const event = await this.events.getEventById(eventId, user?.id ?? null);
    return { event };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async createEvent(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    const input = createEventSchema.parse(body);
    const event = await this.events.createEvent(user.id, {
      title: input.title,
      description: input.description,
      type: input.type ?? 'networking',
      startAt: new Date(input.startAt),
      endAt: input.endAt ? new Date(input.endAt) : null,
      timezone: input.timezone,
      location: input.location,
      isOnline: input.isOnline ?? false,
      meetingUrl: input.meetingUrl,
      capacity: input.capacity,
      coverImageUrl: input.coverImageUrl,
    });
    return { event };
  }

  @Post(':eventId/rsvp')
  @UseGuards(JwtAuthGuard)
  async rsvp(
    @CurrentUser() user: { id: string },
    @Param('eventId') eventId: string,
    @Body() body: unknown,
  ) {
    const input = rsvpSchema.parse(body);
    return this.events.upsertRsvp({
      userId: user.id,
      eventId,
      status: input.status,
    });
  }
}
