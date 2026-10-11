import { Body, Controller, Get, Patch, Post, Put, Query, UseGuards, Param } from '@nestjs/common';
import { BookingStatus, MeetingType } from '@prisma/client';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MentoringService } from './mentoring.service';

const availabilitySlotSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string().trim().max(80).optional(),
});

const replaceAvailabilitySchema = z.object({
  slots: z.array(availabilitySlotSchema).max(40),
});

const createBookingSchema = z.object({
  mentorId: z.string().uuid(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  timezone: z.string().trim().max(80).optional(),
  meetingType: z.nativeEnum(MeetingType).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const updateBookingSchema = z.object({
  status: z.nativeEnum(BookingStatus).optional(),
  meetingUrl: z.string().trim().url().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

@Controller('mentor')
@UseGuards(JwtAuthGuard)
export class MentoringController {
  constructor(private readonly mentoring: MentoringService) {}

  @Get('availability')
  async listAvailability(
    @CurrentUser() user: { id: string },
    @Query('mentorId') mentorId?: string,
  ) {
    const slots = await this.mentoring.listAvailability(mentorId ?? user.id);
    return { slots };
  }

  @Put('availability')
  async replaceAvailability(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    const input = replaceAvailabilitySchema.parse(body);
    const slots = await this.mentoring.replaceAvailability(user.id, input.slots);
    return { slots };
  }

  @Get('bookings')
  async listBookings(
    @CurrentUser() user: { id: string },
    @Query('scope') scope?: 'all' | 'mentor' | 'mentee',
  ) {
    const bookings = await this.mentoring.listBookings(user.id, scope ?? 'all');
    return { bookings };
  }

  @Post('bookings')
  async createBooking(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    const input = createBookingSchema.parse(body);
    const booking = await this.mentoring.createBooking({
      menteeId: user.id,
      mentorId: input.mentorId,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
      timezone: input.timezone,
      meetingType: input.meetingType,
      notes: input.notes,
    });
    return { booking };
  }

  @Patch('bookings/:bookingId')
  async updateBooking(
    @CurrentUser() user: { id: string },
    @Param('bookingId') bookingId: string,
    @Body() body: unknown,
  ) {
    const patch = updateBookingSchema.parse(body);
    const booking = await this.mentoring.updateBooking(user.id, bookingId, patch);
    return { booking };
  }
}
