import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { ConnectionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AutomationService } from '../automation/automation.service';

// User model only has: id, email, role, etc. — NOT displayName/avatarUrl/headline.
// Those live on the related Profile model. We include profile nested under each User.
const profileInclude = {
  select: {
    id: true,
    role: true,
    profile: {
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        headline: true,
        userId: true,
      },
    },
  },
} as const;

type UserWithProfile = {
  id: string;
  role: string;
  profile: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    headline: string | null;
    userId: string;
  } | null;
};

function mapParticipant(u: UserWithProfile) {
  return {
    id: u.profile?.id ?? u.id,
    userId: u.id,
    displayName: u.profile?.displayName ?? 'Unknown',
    avatarUrl: u.profile?.avatarUrl ?? null,
    headline: u.profile?.headline ?? null,
    role: u.role,
  };
}

function mapConnection(c: {
  id: string;
  requesterId: string;
  receiverId: string;
  status: ConnectionStatus;
  message: string | null;
  createdAt: Date;
  updatedAt: Date;
  requester: UserWithProfile;
  receiver: UserWithProfile;
}) {
  return {
    id: c.id,
    requesterId: c.requesterId,
    receiverId: c.receiverId,
    status: c.status,
    message: c.message,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    requester: mapParticipant(c.requester),
    receiver: mapParticipant(c.receiver),
  };
}

@Injectable()
export class ConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly automation?: AutomationService,
  ) {}

  async sendRequest(requesterId: string, receiverId: string, message?: string) {
    if (requesterId === receiverId) {
      throw new BadRequestException('Cannot connect with yourself');
    }

    const existing = await this.prisma.connectionRequest.findFirst({
      where: {
        OR: [
          { requesterId, receiverId },
          { requesterId: receiverId, receiverId: requesterId },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'accepted') throw new ConflictException('Already connected');
      if (existing.status === 'pending') throw new ConflictException('Connection request already sent');
      if (existing.status === 'blocked') throw new ForbiddenException('Cannot connect with this user');
      // declined — allow re-request by deleting old record
      await this.prisma.connectionRequest.delete({ where: { id: existing.id } });
    }

    const connection = await this.prisma.connectionRequest.create({
      data: { requesterId, receiverId, message: message?.trim() || null },
      include: {
        requester: profileInclude,
        receiver: profileInclude,
      },
    });

    // Notify receiver
    await this.notifications.createNotification({
      userId: receiverId,
      type: 'connection_request',
      title: `${connection.requester.profile?.displayName ?? 'Someone'} wants to connect`,
      body: message?.trim() || 'Sent you a connection request',
      link: '/connections',
    }).catch(() => {});

    return { connection: mapConnection(connection) };
  }

  async listConnections(userId: string, type: 'sent' | 'received' | 'accepted' = 'received', limit = 50) {
    const where =
      type === 'sent'
        ? { requesterId: userId, status: 'pending' as ConnectionStatus }
        : type === 'received'
          ? { receiverId: userId, status: 'pending' as ConnectionStatus }
          : {
              OR: [{ requesterId: userId }, { receiverId: userId }],
              status: 'accepted' as ConnectionStatus,
            };

    const connections = await this.prisma.connectionRequest.findMany({
      where,
      include: {
        requester: profileInclude,
        receiver: profileInclude,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });

    return { connections: connections.map(mapConnection) };
  }

  async respondToRequest(connectionId: string, userId: string, status: 'accepted' | 'declined') {
    const connection = await this.prisma.connectionRequest.findUnique({
      where: { id: connectionId },
      include: {
        requester: profileInclude,
        receiver: profileInclude,
      },
    });

    if (!connection) throw new NotFoundException('Connection request not found');
    if (connection.receiverId !== userId) throw new ForbiddenException('Not authorized');
    if (connection.status !== 'pending') throw new ConflictException('Request already responded to');

    const updated = await this.prisma.connectionRequest.update({
      where: { id: connectionId },
      data: { status, respondedAt: new Date() },
      include: {
        requester: profileInclude,
        receiver: profileInclude,
      },
    });

    if (status === 'accepted') {
      await this.notifications.createNotification({
        userId: connection.requesterId,
        type: 'connection_accepted',
        title: `${connection.receiver.profile?.displayName ?? 'Someone'} accepted your connection`,
        body: 'You are now connected',
        link: `/profiles/${connection.receiverId}`,
      }).catch(() => {});

      this.automation?.fire({
        triggerType: 'connection_accepted',
        targetUserId: connection.requesterId,
        targetEntityType: 'connection',
        targetEntityId: connectionId,
      }).catch(() => {});
    }

    return { connection: mapConnection(updated) };
  }

  /**
   * Takes back a request the sender has not had answered yet.
   *
   * The product had no route for this at all: `respondToRequest` belongs to
   * the receiver and throws for anyone else, so a request sent by mistake was
   * permanent. Deleting rather than marking withdrawn follows the precedent
   * `sendRequest` already sets for a declined request — the row goes, and the
   * two can connect later without tripping the duplicate check.
   *
   * The receiver's notification stays. It records that the request happened,
   * which is true, and the request itself no longer appears in their list.
   */
  async withdrawRequest(connectionId: string, requesterId: string) {
    const connection = await this.prisma.connectionRequest.findUnique({
      where: { id: connectionId },
    });

    if (!connection) throw new NotFoundException('Connection request not found');
    if (connection.requesterId !== requesterId) {
      throw new ForbiddenException('Only the sender can withdraw a request');
    }
    if (connection.status !== 'pending') {
      throw new ConflictException('Request has already been answered');
    }

    await this.prisma.connectionRequest.delete({ where: { id: connectionId } });
    return { ok: true, connectionId };
  }

  async blockUser(blockerId: string, targetUserId: string) {
    if (blockerId === targetUserId) {
      throw new BadRequestException('Cannot block yourself');
    }

    const existing = await this.prisma.connectionRequest.findFirst({
      where: {
        OR: [
          { requesterId: blockerId, receiverId: targetUserId },
          { requesterId: targetUserId, receiverId: blockerId },
        ],
      },
      include: {
        requester: profileInclude,
        receiver: profileInclude,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (existing?.status === 'blocked') {
      return { connection: mapConnection(existing) };
    }

    const connection = existing
      ? await this.prisma.connectionRequest.update({
          where: { id: existing.id },
          data: {
            status: 'blocked',
            respondedAt: new Date(),
            message: null,
          },
          include: {
            requester: profileInclude,
            receiver: profileInclude,
          },
        })
      : await this.prisma.connectionRequest.create({
          data: {
            requesterId: blockerId,
            receiverId: targetUserId,
            status: 'blocked',
            respondedAt: new Date(),
          },
          include: {
            requester: profileInclude,
            receiver: profileInclude,
          },
        });

    return { connection: mapConnection(connection) };
  }

  async getConnectionStatus(viewerId: string, targetUserId: string) {
    const connection = await this.prisma.connectionRequest.findFirst({
      where: {
        OR: [
          { requesterId: viewerId, receiverId: targetUserId },
          { requesterId: targetUserId, receiverId: viewerId },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!connection) {
      return { status: null, connectionId: null, direction: null };
    }

    return {
      status: connection.status,
      connectionId: connection.id,
      direction: connection.requesterId === viewerId ? 'sent' : 'received',
    };
  }

  // profileInclude uses nested profile select — displayName is on Profile, NOT User
}
