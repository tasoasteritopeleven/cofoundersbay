import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, MeetingType, Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '../mailer/mailer.service';

export type AvailabilitySlot = {
  id: string;
  mentorId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  timezone: string | null;
};

export type BookingItem = {
  id: string;
  mentorId: string;
  menteeId: string;
  startAt: string;
  endAt: string;
  timezone: string | null;
  meetingType: MeetingType;
  meetingUrl: string | null;
  notes: string | null;
  status: BookingStatus;
  priceCents: number | null;
  currency: string | null;
  mentor: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  mentee: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
};

@Injectable()
export class MentoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mailer: MailerService,
  ) {}

  async listAvailability(mentorId: string): Promise<AvailabilitySlot[]> {
    const slots = await this.prisma.mentorAvailability.findMany({
      where: { mentorId },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    });
    return slots.map((slot) => ({
      id: slot.id,
      mentorId: slot.mentorId,
      weekday: slot.weekday,
      startTime: slot.startTime,
      endTime: slot.endTime,
      timezone: slot.timezone,
    }));
  }

  async replaceAvailability(
    mentorId: string,
    slots: Array<{ weekday: number; startTime: string; endTime: string; timezone?: string | null }>,
  ): Promise<AvailabilitySlot[]> {
    await this.prisma.$transaction(async (tx) => {
      await tx.mentorAvailability.deleteMany({ where: { mentorId } });
      if (slots.length) {
        await tx.mentorAvailability.createMany({
          data: slots.map((slot) => ({
            mentorId,
            weekday: slot.weekday,
            startTime: slot.startTime,
            endTime: slot.endTime,
            timezone: slot.timezone ?? null,
          })),
        });
      }
    });
    return this.listAvailability(mentorId);
  }

  async listBookings(userId: string, scope: 'all' | 'mentor' | 'mentee' = 'all'): Promise<BookingItem[]> {
    const where: Prisma.MentorBookingWhereInput =
      scope === 'mentor'
        ? { mentorId: userId }
        : scope === 'mentee'
          ? { menteeId: userId }
          : { OR: [{ mentorId: userId }, { menteeId: userId }] };

    const rows = await this.prisma.mentorBooking.findMany({
      where,
      orderBy: { startAt: 'desc' },
      include: {
        mentor: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
        mentee: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    return rows.map((row) => this.toBookingItem(row));
  }

  async createBooking(params: {
    menteeId: string;
    mentorId: string;
    startAt: Date;
    endAt: Date;
    timezone?: string | null;
    meetingType?: MeetingType;
    notes?: string | null;
  }): Promise<BookingItem> {
    if (params.mentorId === params.menteeId) {
      throw new BadRequestException('You cannot book yourself');
    }
    if (params.endAt <= params.startAt) {
      throw new BadRequestException('endAt must be after startAt');
    }

    const mentor = await this.prisma.user.findUnique({
      where: { id: params.mentorId },
      select: { id: true, profile: { select: { displayName: true } } },
    });
    if (!mentor) throw new NotFoundException('Mentor not found');

    const overlap = await this.prisma.mentorBooking.findFirst({
      where: {
        mentorId: params.mentorId,
        status: { in: ['requested', 'confirmed'] },
        startAt: { lt: params.endAt },
        endAt: { gt: params.startAt },
      },
      select: { id: true },
    });
    if (overlap) throw new BadRequestException('Mentor is unavailable in this time slot');

    const created = await this.prisma.mentorBooking.create({
      data: {
        mentorId: params.mentorId,
        menteeId: params.menteeId,
        startAt: params.startAt,
        endAt: params.endAt,
        timezone: params.timezone ?? null,
        meetingType: params.meetingType ?? 'video',
        notes: params.notes ?? null,
        status: 'requested',
      },
      include: {
        mentor: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
        mentee: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    void this.notifications
      .createNotification({
        userId: params.mentorId,
        type: 'system',
        title: 'New mentoring request',
        body: 'You have a new booking request.',
        link: '/mentoring',
        meta: { bookingId: created.id },
      })
      .catch(() => {});

    return this.toBookingItem(created);
  }

  async updateBooking(
    userId: string,
    bookingId: string,
    patch: { status?: BookingStatus; meetingUrl?: string | null; notes?: string | null },
  ): Promise<BookingItem> {
    const existing = await this.prisma.mentorBooking.findUnique({
      where: { id: bookingId },
      include: {
        mentor: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
        mentee: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
    });
    if (!existing) throw new NotFoundException('Booking not found');

    const canEdit = existing.mentorId === userId || existing.menteeId === userId;
    if (!canEdit) throw new ForbiddenException('You cannot edit this booking');

    const updated = await this.prisma.mentorBooking.update({
      where: { id: bookingId },
      data: {
        status: patch.status ?? undefined,
        meetingUrl: patch.meetingUrl ?? undefined,
        notes: patch.notes ?? undefined,
      },
      include: {
        mentor: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
        mentee: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    const otherUserId = userId === updated.mentorId ? updated.menteeId : updated.mentorId;
    if (patch.status) {
      void this.notifications
        .createNotification({
          userId: otherUserId,
          type: 'system',
          title: 'Booking updated',
          body: `Booking status changed to ${patch.status}`,
          link: '/mentoring',
          meta: { bookingId: updated.id, status: patch.status },
        })
        .catch(() => {});

      // Send email confirmation when booking is confirmed
      if (patch.status === 'confirmed') {
        void this.sendBookingConfirmationEmails(updated).catch(() => {});
      }
    }

    return this.toBookingItem(updated);
  }

  private async sendBookingConfirmationEmails(booking: {
    id: string;
    startAt: Date;
    endAt: Date;
    timezone: string | null;
    meetingType: MeetingType;
    meetingUrl: string | null;
    mentor: { id: string; profile: { displayName: string; avatarUrl: string | null } | null };
    mentee: { id: string; profile: { displayName: string; avatarUrl: string | null } | null };
  }): Promise<void> {
    // Get email addresses
    const [mentorUser, menteeUser] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: booking.mentor.id }, select: { email: true } }),
      this.prisma.user.findUnique({ where: { id: booking.mentee.id }, select: { email: true } }),
    ]);

    if (!mentorUser?.email || !menteeUser?.email) return;

    const mentorName = booking.mentor.profile?.displayName ?? 'Mentor';
    const menteeName = booking.mentee.profile?.displayName ?? 'Mentee';
    const startDate = booking.startAt.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const startTime = booking.startAt.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const endTime = booking.endAt.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const tz = booking.timezone ?? 'UTC';
    const meetingUrl = booking.meetingUrl ?? 'To be provided';

    const emailHtml = (recipientName: string, otherName: string, role: 'mentor' | 'mentee') => `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">Mentoring Session Confirmed!</h2>
        <p>Hi ${recipientName},</p>
        <p>Your mentoring session with <strong>${otherName}</strong> has been confirmed.</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Date:</strong> ${startDate}</p>
          <p style="margin: 4px 0;"><strong>Time:</strong> ${startTime} - ${endTime} (${tz})</p>
          <p style="margin: 4px 0;"><strong>Type:</strong> ${booking.meetingType}</p>
          <p style="margin: 4px 0;"><strong>Meeting Link:</strong> ${meetingUrl}</p>
        </div>
        <p>You can view and manage your bookings in your <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/mentoring" style="color: #6366f1;">mentoring dashboard</a>.</p>
        <p style="color: #6b7280; font-size: 14px;">— The CoFounderBay Team</p>
      </div>
    `;

    // Send to mentor
    await this.mailer.sendEmail({
      to: mentorUser.email,
      subject: `Mentoring session confirmed with ${menteeName}`,
      html: emailHtml(mentorName, menteeName, 'mentor'),
    });

    // Send to mentee
    await this.mailer.sendEmail({
      to: menteeUser.email,
      subject: `Mentoring session confirmed with ${mentorName}`,
      html: emailHtml(menteeName, mentorName, 'mentee'),
    });
  }

  private toBookingItem(row: {
    id: string;
    mentorId: string;
    menteeId: string;
    startAt: Date;
    endAt: Date;
    timezone: string | null;
    meetingType: MeetingType;
    meetingUrl: string | null;
    notes: string | null;
    status: BookingStatus;
    priceCents: number | null;
    currency: string | null;
    mentor: {
      id: string;
      profile: { displayName: string; avatarUrl: string | null } | null;
    };
    mentee: {
      id: string;
      profile: { displayName: string; avatarUrl: string | null } | null;
    };
  }): BookingItem {
    return {
      id: row.id,
      mentorId: row.mentorId,
      menteeId: row.menteeId,
      startAt: row.startAt.toISOString(),
      endAt: row.endAt.toISOString(),
      timezone: row.timezone,
      meetingType: row.meetingType,
      meetingUrl: row.meetingUrl,
      notes: row.notes,
      status: row.status,
      priceCents: row.priceCents,
      currency: row.currency,
      mentor: {
        id: row.mentor.id,
        displayName: row.mentor.profile?.displayName ?? 'Mentor',
        avatarUrl: row.mentor.profile?.avatarUrl ?? null,
      },
      mentee: {
        id: row.mentee.id,
        displayName: row.mentee.profile?.displayName ?? 'Mentee',
        avatarUrl: row.mentee.profile?.avatarUrl ?? null,
      },
    };
  }
}
