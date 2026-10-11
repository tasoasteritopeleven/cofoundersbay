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

type AuthedSocket = Socket & { data: { user?: { id: string; email: string; role: string } } };

const joinBoardSchema = z.object({ boardId: z.string().uuid() });
const cursorSchema = z.object({
  boardId: z.string().uuid(),
  x: z.number(),
  y: z.number(),
});
const nodeUpdateSchema = z.object({
  boardId: z.string().uuid(),
  nodeId: z.string().uuid(),
  posX: z.number().optional(),
  posY: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  content: z.string().optional(),
  title: z.string().optional(),
  color: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
const commentSchema = z.object({
  boardId: z.string().uuid(),
  nodeId: z.string().uuid(),
  commentId: z.string().uuid(),
  body: z.string(),
  resolved: z.boolean().optional(),
});

function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const prefix = `${name}=`;
  for (const part of cookieHeader.split(/;\s*/)) {
    if (!part.startsWith(prefix)) continue;
    const value = part.slice(prefix.length);
    try { return decodeURIComponent(value); } catch { return value; }
  }
  return null;
}

function allowedOrigins(): string[] {
  const corsOriginEnv = process.env.CORS_ORIGIN;
  return corsOriginEnv
    ? corsOriginEnv.split(',').map((o) => o.trim()).filter(Boolean)
    : ['http://localhost:3000'];
}

@WebSocketGateway({
  namespace: '/research',
  cors: { origin: allowedOrigins(), credentials: true },
})
export class ResearchGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: AuthedSocket) {
    const token =
      (typeof client.handshake.auth?.token === 'string' ? client.handshake.auth.token : null) ||
      (typeof client.handshake.headers.authorization === 'string' && client.handshake.headers.authorization.startsWith('Bearer ')
        ? client.handshake.headers.authorization.slice(7) : null) ||
      readCookie(
        typeof client.handshake.headers.cookie === 'string' ? client.handshake.headers.cookie : undefined,
        COOKIE_NAMES.ACCESS_TOKEN,
      );

    if (!token) { client.disconnect(true); return; }

    try {
      const payload = this.jwt.verify<{ sub: string; type?: string }>(token);
      if (!payload?.sub || payload.type !== 'access') { client.disconnect(true); return; }
      const user = await this.auth.validateUser(payload.sub);
      if (!user) { client.disconnect(true); return; }
      client.data.user = user;
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthedSocket) {
    const userId = client.data.user?.id;
    if (!userId) return;
    // Notify all rooms this socket was in that the user left
    for (const room of client.rooms) {
      if (room !== client.id) {
        client.to(room).emit('board:presence', { userId, status: 'offline', boardId: room });
      }
    }
  }

  private async canAccessBoard(userId: string, boardId: string): Promise<boolean> {
    const board = await this.prisma.researchBoard.findUnique({
      where: { id: boardId },
      select: { ownerId: true, visibility: true, collaborators: { select: { userId: true } } },
    });
    if (!board) return false;
    if (board.ownerId === userId) return true;
    if (board.visibility === 'public') return true;
    if (board.collaborators.some((c) => c.userId === userId)) return true;
    return false;
  }

  @SubscribeMessage('board:join')
  async handleJoinBoard(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: unknown,
  ) {
    const userId = client.data.user?.id;
    if (!userId) return { error: 'Unauthorized' };

    const { boardId } = joinBoardSchema.parse(body);
    if (!(await this.canAccessBoard(userId, boardId))) return { error: 'Forbidden' };

    await client.join(boardId);

    // Broadcast that this user joined
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { displayName: true, avatarUrl: true },
    });

    client.to(boardId).emit('board:presence', {
      userId,
      status: 'online',
      boardId,
      displayName: profile?.displayName ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
    });

    return { ok: true };
  }

  @SubscribeMessage('board:leave')
  async handleLeaveBoard(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: unknown,
  ) {
    const userId = client.data.user?.id;
    if (!userId) return;
    const { boardId } = joinBoardSchema.parse(body);
    await client.leave(boardId);
    client.to(boardId).emit('board:presence', { userId, status: 'offline', boardId });
    return { ok: true };
  }

  @SubscribeMessage('board:cursor')
  async handleCursor(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: unknown,
  ) {
    const userId = client.data.user?.id;
    if (!userId) return;
    const input = cursorSchema.parse(body);
    // Broadcast cursor position to other board members (exclude sender)
    client.to(input.boardId).emit('board:cursor', {
      userId,
      boardId: input.boardId,
      x: input.x,
      y: input.y,
    });
  }

  @SubscribeMessage('node:move')
  async handleNodeMove(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: unknown,
  ) {
    const userId = client.data.user?.id;
    if (!userId) return;
    const input = nodeUpdateSchema.parse(body);
    // Broadcast to other participants
    client.to(input.boardId).emit('node:moved', {
      nodeId: input.nodeId,
      posX: input.posX,
      posY: input.posY,
      movedBy: userId,
    });
    return { ok: true };
  }

  @SubscribeMessage('node:update')
  async handleNodeUpdate(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: unknown,
  ) {
    const userId = client.data.user?.id;
    if (!userId) return;
    const input = nodeUpdateSchema.parse(body);
    client.to(input.boardId).emit('node:updated', {
      nodeId: input.nodeId,
      changes: {
        title: input.title,
        content: input.content,
        color: input.color,
        tags: input.tags,
        width: input.width,
        height: input.height,
      },
      updatedBy: userId,
    });
    return { ok: true };
  }

  @SubscribeMessage('comment:new')
  async handleNewComment(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: unknown,
  ) {
    const userId = client.data.user?.id;
    if (!userId) return;
    const input = commentSchema.parse(body);
    // Broadcast new comment to all board members
    this.server.to(input.boardId).emit('comment:created', {
      commentId: input.commentId,
      nodeId: input.nodeId,
      boardId: input.boardId,
      authorId: userId,
      body: input.body,
    });
    return { ok: true };
  }

  @SubscribeMessage('comment:resolve')
  async handleResolveComment(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: unknown,
  ) {
    const userId = client.data.user?.id;
    if (!userId) return;
    const input = commentSchema.parse(body);
    this.server.to(input.boardId).emit('comment:resolved', {
      commentId: input.commentId,
      nodeId: input.nodeId,
      boardId: input.boardId,
      resolvedBy: userId,
    });
    return { ok: true };
  }

  // Called by service layer to broadcast board-level events
  broadcastToBoard(boardId: string, event: string, data: unknown) {
    this.server.to(boardId).emit(event, data);
  }
}
