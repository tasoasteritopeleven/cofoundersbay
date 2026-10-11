import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { z } from 'zod';
import type { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { COOKIE_NAMES } from '../auth/cookie.utils';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingService } from './messaging.service';
import { PresenceService } from './presence.service';

type AuthedSocket = Socket & { data: { user?: { id: string; email: string; role: string } } };

const sendSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().min(1).max(5000),
  tempId: z.string().min(1).max(100).optional(),
  attachmentUploadIds: z.array(z.string().uuid()).max(5).optional(),
});

const joinSchema = z.object({
  conversationId: z.string().uuid(),
});

const typingSchema = z.object({
  conversationId: z.string().uuid(),
  isTyping: z.boolean(),
});

const markReadSchema = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().uuid(),
});

const reactionSchema = z.object({
  messageId: z.string().uuid(),
  emoji: z.string().min(1).max(10),
});

function allowedOrigins(): string[] {
  const corsOriginEnv = process.env.CORS_ORIGIN;
  const origins = corsOriginEnv
    ? corsOriginEnv.split(',').map((o) => o.trim()).filter(Boolean)
    : ['http://localhost:3000'];
  return origins;
}

function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;

  const prefix = `${name}=`;
  for (const part of cookieHeader.split(/;\s*/)) {
    if (!part.startsWith(prefix)) continue;

    const value = part.slice(prefix.length);
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return null;
}

@WebSocketGateway({
  cors: {
    origin: allowedOrigins(),
    credentials: true,
  },
})
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
    private readonly presence: PresenceService,
  ) {}

  async handleConnection(client: AuthedSocket) {
    const token =
      (typeof client.handshake.auth?.token === 'string' ? client.handshake.auth.token : null) ||
      (typeof client.handshake.headers.authorization === 'string' && client.handshake.headers.authorization.startsWith('Bearer ')
        ? client.handshake.headers.authorization.slice(7)
        : null) ||
      readCookie(
        typeof client.handshake.headers.cookie === 'string' ? client.handshake.headers.cookie : undefined,
        COOKIE_NAMES.ACCESS_TOKEN,
      );

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwt.verify<{ sub: string; type?: string }>(token);
      if (!payload?.sub || payload.type !== 'access') {
        client.disconnect(true);
        return;
      }

      const user = await this.auth.validateUser(payload.sub);
      if (!user) {
        client.disconnect(true);
        return;
      }

      client.data.user = user;
      this.presence.setOnline(user.id);
      void this.prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } }).catch(() => {});

      const convoIds = await this.messaging.getConversationIdsForUser(user.id);
      await Promise.all(convoIds.map((id) => client.join(id)));
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthedSocket) {
    const userId = client.data.user?.id;
    if (!userId) return;
    this.presence.setOffline(userId);
    void this.prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }

  @SubscribeMessage('conversation:join')
  async handleJoin(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: unknown,
  ) {
    const userId = client.data.user?.id;
    if (!userId) return;

    const input = joinSchema.parse(body);
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: input.conversationId, userId } },
      select: { conversationId: true },
    });
    if (!participant) return;

    await client.join(input.conversationId);
    return { ok: true };
  }

  @SubscribeMessage('message:send')
  async handleSend(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: unknown,
  ) {
    const userId = client.data.user?.id;
    if (!userId) return;

    const input = sendSchema.parse(body);
    const message = await this.messaging.sendMessage(
      userId,
      input.conversationId,
      input.body,
      input.attachmentUploadIds,
    );

    // Ack to sender (so the UI can reconcile optimistic messages)
    client.emit('message:ack', { tempId: input.tempId ?? null, message });

    // Broadcast to other participants (exclude sender)
    client.to(input.conversationId).emit('message:new', { message });

    return { ok: true };
  }

  @SubscribeMessage('typing:start')
  async handleTypingStart(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: unknown,
  ) {
    const userId = client.data.user?.id;
    if (!userId) return;

    const input = typingSchema.parse(body);
    
    // Verify user is participant
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: input.conversationId, userId } },
      select: { conversationId: true },
    });
    if (!participant) return;

    // Broadcast typing indicator to other participants
    client.to(input.conversationId).emit('typing:update', {
      conversationId: input.conversationId,
      userId,
      isTyping: input.isTyping,
    });

    return { ok: true };
  }

  @SubscribeMessage('message:markRead')
  async handleMarkRead(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: unknown,
  ) {
    const userId = client.data.user?.id;
    if (!userId) return;

    const input = markReadSchema.parse(body);

    // Mark message as read
    await this.prisma.message.update({
      where: { id: input.messageId },
      data: { readAt: new Date() },
    }).catch(() => {});

    // Broadcast read receipt
    client.to(input.conversationId).emit('message:read', {
      messageId: input.messageId,
      userId,
      readAt: new Date().toISOString(),
    });

    return { ok: true };
  }

  @SubscribeMessage('message:react')
  async handleReaction(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: unknown,
  ) {
    const userId = client.data.user?.id;
    if (!userId) return;

    const input = reactionSchema.parse(body);

    // Get message to find conversation
    const message = await this.prisma.message.findUnique({
      where: { id: input.messageId },
      select: { conversationId: true },
    });
    if (!message) return;

    // TODO: Store reaction in database when MessageReaction model is added
    // For now, just broadcast the reaction
    this.server.to(message.conversationId).emit('message:reaction', {
      messageId: input.messageId,
      userId,
      emoji: input.emoji,
    });

    return { ok: true };
  }

  @SubscribeMessage('presence:update')
  async handlePresenceUpdate(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: unknown,
  ) {
    const userId = client.data.user?.id;
    if (!userId) return;

    const status = typeof body === 'object' && body !== null && 'status' in body 
      ? String(body.status) 
      : 'online';

    if (['online', 'away', 'busy'].includes(status)) {
      this.presence.setOnline(userId);
      
      // Broadcast presence update to all connected clients
      this.server.emit('presence:changed', {
        userId,
        status,
        lastSeen: new Date().toISOString(),
      });
    }

    return { ok: true };
  }
}

