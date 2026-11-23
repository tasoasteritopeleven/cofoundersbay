import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { serializable } from '../prisma/serializable';
import { matchNotice, reconnectPairKey } from './reconnect-notices';

const DAY = 86_400_000;
const HOUR = 3_600_000;
const eventFields = { id: true, creatorId: true, startAt: true, endAt: true } as const;
const person = { id: true, profile: { select: { displayName: true, avatarUrl: true } } } as const;
const attendanceRows = { OR: [{ status: { in: ['going', 'interested'] } }, { checkedInAt: { not: null } }] } satisfies Prisma.EventRsvpWhereInput;

function endOf(event: { startAt: Date; endAt: Date | null }) {
  return event.endAt ?? new Date(event.startAt.getTime() + HOUR);
}

@Injectable()
export class EventReconnectService {
  constructor(private readonly prisma: PrismaService) {}

  private async event(db: Prisma.TransactionClient, eventId: string) {
    const event = await db.event.findUnique({ where: { id: eventId }, select: eventFields });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async attendance(eventId: string, viewerId: string) {
    const event = await this.event(this.prisma, eventId);
    if (event.creatorId !== viewerId) throw new ForbiddenException('Only the organizer can manage attendance');
    const closesAt = new Date(endOf(event).getTime() + 7 * DAY);
    const now = new Date();
    const rows = await this.prisma.eventRsvp.findMany({
      where: { eventId, ...attendanceRows },
      orderBy: [{ createdAt: 'asc' }, { userId: 'asc' }],
      select: { status: true, checkedInAt: true, user: { select: person } },
    });
    return {
      opensAt: event.startAt,
      closesAt,
      editable: now >= event.startAt && now < closesAt,
      rows: rows.map(({ status, checkedInAt, user }) => ({
        userId: user.id,
        displayName: user.profile?.displayName ?? null,
        avatarUrl: user.profile?.avatarUrl ?? null,
        status,
        attended: checkedInAt !== null,
      })),
    };
  }

  async updateAttendance(eventId: string, viewerId: string, input: { userId: string; attended: boolean } | { allGoing: true }) {
    return serializable(this.prisma, async (tx) => {
      const event = await this.event(tx, eventId);
      if (event.creatorId !== viewerId) throw new ForbiddenException('Only the organizer can manage attendance');
      const now = new Date();
      if (now < event.startAt || now.getTime() >= endOf(event).getTime() + 7 * DAY) {
        throw new ConflictException('Attendance is not editable now');
      }
      if ('allGoing' in input) {
        const { count } = await tx.eventRsvp.updateMany({
          where: { eventId, status: 'going', checkedInAt: null },
          data: { checkedInAt: now },
        });
        return { changed: count };
      }
      const row = await tx.eventRsvp.findFirst({
        where: { eventId, userId: input.userId, ...attendanceRows },
        select: { checkedInAt: true },
      });
      if (!row) throw new NotFoundException('Attendee not found');
      if (Boolean(row.checkedInAt) === input.attended) return { changed: 0 };
      await tx.eventRsvp.update({
        where: { eventId_userId: { eventId, userId: input.userId } },
        data: { checkedInAt: input.attended ? now : null },
      });
      if (!input.attended) {
        const pairs = await tx.eventReconnectInterest.findMany({
          where: { eventId, fromId: input.userId, expiresAt: null },
          select: { toId: true },
        });
        await tx.eventReconnectInterest.deleteMany({
          where: { eventId, OR: [{ fromId: input.userId }, { toId: input.userId }] },
        });
        for (const pair of pairs) await tx.notification.deleteMany({ where: matchNotice(input.userId, pair.toId, eventId) });
      }
      return { changed: 1 };
    });
  }

  async purgeExpired(now = new Date(), eventId?: string) {
    return this.prisma.eventReconnectInterest.deleteMany({ where: { eventId, expiresAt: { lte: now } } });
  }

  async list(eventId: string, viewerId: string) {
    const event = await this.event(this.prisma, eventId);
    const now = new Date();
    const end = endOf(event);
    const closesAt = new Date(end.getTime() + 14 * DAY);
    await this.purgeExpired(now, eventId);
    if (now < end) return { state: 'before_end' as const, closesAt, rows: [] };
    const viewer = await this.prisma.eventRsvp.findUnique({
      where: { eventId_userId: { eventId, userId: viewerId } },
      select: { checkedInAt: true },
    });
    if (!viewer?.checkedInAt) return { state: 'not_confirmed' as const, closesAt, rows: [] };
    const open = now < closesAt;
    const rows = await this.prisma.eventRsvp.findMany({
      where: {
        eventId,
        userId: { not: viewerId },
        checkedInAt: { not: null },
        user: {
          blocksGiven: { none: { blockedId: viewerId } },
          blocksReceived: { none: { blockerId: viewerId } },
          connectionsSent: { none: { receiverId: viewerId, status: 'blocked' } },
          connectionsReceived: { none: { requesterId: viewerId, status: 'blocked' } },
        },
        ...(open ? {} : { reconnectReceived: { some: { fromId: viewerId, expiresAt: null } } }),
      },
      orderBy: [{ createdAt: 'asc' }, { userId: 'asc' }],
      select: {
        user: { select: person },
        reconnectReceived: { where: { fromId: viewerId }, select: { expiresAt: true }, take: 1 },
      },
    });
    return {
      state: open ? 'open' as const : 'closed' as const,
      closesAt,
      rows: rows.map(({ user, reconnectReceived }) => ({
        userId: user.id,
        displayName: user.profile?.displayName ?? null,
        avatarUrl: user.profile?.avatarUrl ?? null,
        interested: reconnectReceived.length > 0,
        mutual: reconnectReceived[0]?.expiresAt === null,
      })),
    };
  }

  async setInterest(eventId: string, viewerId: string, userId: string, interested: boolean) {
    if (viewerId === userId) throw new ForbiddenException('You cannot select yourself');
    return serializable(this.prisma, async (tx) => {
      const event = await this.event(tx, eventId);
      const now = new Date();
      const end = endOf(event);
      const closesAt = new Date(end.getTime() + 14 * DAY);
      if (now < end || (interested && now >= closesAt)) throw new ConflictException('Reconnect selections are not open');
      const people = await tx.eventRsvp.count({ where: { eventId, userId: { in: [viewerId, userId] }, checkedInAt: { not: null } } });
      if (people !== 2) throw new ForbiddenException('Confirmed attendance is required');
      const own = { eventId, fromId: viewerId, toId: userId };
      const reverse = { eventId, fromId: userId, toId: viewerId };
      const existing = await tx.eventReconnectInterest.findUnique({ where: { eventId_fromId_toId: own } });
      if (!interested) {
        if (existing?.expiresAt === null) {
          await tx.eventReconnectInterest.deleteMany({ where: { OR: [own, reverse] } });
          await tx.notification.deleteMany({ where: matchNotice(viewerId, userId, eventId) });
        } else {
          await tx.eventReconnectInterest.deleteMany({ where: own });
        }
        return { interested: false, mutual: false };
      }
      const [blocked, blockedConnection] = await Promise.all([
        tx.userBlock.findFirst({
          where: { OR: [{ blockerId: viewerId, blockedId: userId }, { blockerId: userId, blockedId: viewerId }] },
          select: { id: true },
        }),
        tx.connectionRequest.findFirst({
          where: { status: 'blocked', OR: [{ requesterId: viewerId, receiverId: userId }, { requesterId: userId, receiverId: viewerId }] },
          select: { id: true },
        }),
      ]);
      if (blocked || blockedConnection) throw new ForbiddenException('This attendee is not available');
      if (existing) return { interested: true, mutual: existing.expiresAt === null };

      const incoming = await tx.eventReconnectInterest.findUnique({ where: { eventId_fromId_toId: reverse } });
      const mutual = Boolean(incoming && incoming.expiresAt && incoming.expiresAt > now);
      await tx.eventReconnectInterest.create({ data: { ...own, expiresAt: mutual ? null : closesAt } });
      if (mutual) {
        await tx.eventReconnectInterest.update({ where: { eventId_fromId_toId: reverse }, data: { expiresAt: null } });
        await tx.notification.createMany({
          data: [viewerId, userId].map((recipient) => ({
            userId: recipient,
            type: 'system' as const,
            title: 'You have a mutual event match',
            link: `/events/${eventId}#reconnect`,
            meta: { eventReconnect: 'match', reconnectPair: reconnectPairKey(viewerId, userId) },
          })),
        });
      }
      return { interested: true, mutual };
    });
  }

  async nudgeEligible() {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 14 * DAY);
    const rows = await this.prisma.eventRsvp.findMany({
      where: {
        reconnectNudgedAt: null,
        checkedInAt: { not: null },
        event: { OR: [
          { endAt: { gt: cutoff, lte: now } },
          { endAt: null, startAt: { gt: new Date(cutoff.getTime() - HOUR), lte: new Date(now.getTime() - HOUR) } },
        ] },
      },
      take: 200,
      orderBy: { checkedInAt: 'asc' },
      select: { eventId: true, userId: true },
    });
    for (const { eventId, userId } of rows) {
      await serializable(this.prisma, async (tx) => {
        const { count } = await tx.eventRsvp.updateMany({
          where: { eventId, userId, checkedInAt: { not: null }, reconnectNudgedAt: null },
          data: { reconnectNudgedAt: now },
        });
        if (count) await tx.notification.create({ data: {
          userId,
          type: 'system',
          title: 'Reconnect after your event',
          link: `/events/${eventId}#reconnect`,
          meta: { eventReconnect: 'nudge' },
        } });
      });
    }
  }
}
