import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

interface CollaboratorPresence {
  odId: string;
  odName: string;
  avatarUrl?: string;
  cursor?: { x: number; y: number };
  selection?: { start: number; end: number; sectionKey?: string };
  lastActivity: Date;
}

interface DocumentRoom {
  documentId: string;
  workspaceId: string;
  collaborators: Map<string, CollaboratorPresence>;
}

interface WorkspaceRoom {
  workspaceId: string;
  members: Map<string, { odId: string; odName: string; socketId: string }>;
}

@WebSocketGateway({
  namespace: '/builder',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class BuilderGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(BuilderGateway.name);
  private documentRooms: Map<string, DocumentRoom> = new Map();
  private workspaceRooms: Map<string, WorkspaceRoom> = new Map();
  private socketToUser: Map<string, { odId: string; odName: string }> = new Map();

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // Connection Lifecycle
  // ─────────────────────────────────────────────────────────────────────────────

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];
      
      if (!token) {
        this.logger.warn(`Connection rejected: No token provided`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          profile: {
            select: { displayName: true, avatarUrl: true },
          },
        },
      });

      if (!user) {
        client.disconnect();
        return;
      }

      const odName = user.profile?.displayName || user.email.split('@')[0];
      this.socketToUser.set(client.id, { odId: user.id, odName });

      this.logger.log(`Builder client connected: ${client.id} (${odName})`);
      
      client.emit('connected', { odId: user.id, odName });
    } catch (error) {
      this.logger.error(`Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const user = this.socketToUser.get(client.id);
    
    if (user) {
      // Remove from all document rooms
      this.documentRooms.forEach((room, documentId) => {
        if (room.collaborators.has(client.id)) {
          room.collaborators.delete(client.id);
          this.server.to(`document:${documentId}`).emit('collaborator:left', {
            odId: user.odId,
            odName: user.odName,
          });
          
          // Clean up empty rooms
          if (room.collaborators.size === 0) {
            this.documentRooms.delete(documentId);
          }
        }
      });

      // Remove from all workspace rooms
      this.workspaceRooms.forEach((room, workspaceId) => {
        if (room.members.has(client.id)) {
          room.members.delete(client.id);
          this.server.to(`workspace:${workspaceId}`).emit('member:left', {
            odId: user.odId,
            odName: user.odName,
          });
          
          if (room.members.size === 0) {
            this.workspaceRooms.delete(workspaceId);
          }
        }
      });

      this.socketToUser.delete(client.id);
      this.logger.log(`Builder client disconnected: ${client.id}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Workspace Room Management
  // ─────────────────────────────────────────────────────────────────────────────

  @SubscribeMessage('workspace:join')
  async handleJoinWorkspace(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workspaceId: string },
  ) {
    const user = this.socketToUser.get(client.id);
    if (!user) return;

    const { workspaceId } = data;

    // Verify access
    const hasAccess = await this.verifyWorkspaceAccess(user.odId, workspaceId);
    if (!hasAccess) {
      client.emit('error', { message: 'Access denied to workspace' });
      return;
    }

    // Join socket room
    client.join(`workspace:${workspaceId}`);

    // Track in workspace room
    if (!this.workspaceRooms.has(workspaceId)) {
      this.workspaceRooms.set(workspaceId, {
        workspaceId,
        members: new Map(),
      });
    }

    const room = this.workspaceRooms.get(workspaceId)!;
    room.members.set(client.id, {
      odId: user.odId,
      odName: user.odName,
      socketId: client.id,
    });

    // Notify others
    client.to(`workspace:${workspaceId}`).emit('member:joined', {
      odId: user.odId,
      odName: user.odName,
    });

    // Send current members to joining user
    const members = Array.from(room.members.values()).map((m) => ({
      odId: m.odId,
      odName: m.odName,
    }));

    client.emit('workspace:joined', { workspaceId, members });

    this.logger.log(`User ${user.odName} joined workspace ${workspaceId}`);
  }

  @SubscribeMessage('workspace:leave')
  handleLeaveWorkspace(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workspaceId: string },
  ) {
    const user = this.socketToUser.get(client.id);
    if (!user) return;

    const { workspaceId } = data;
    client.leave(`workspace:${workspaceId}`);

    const room = this.workspaceRooms.get(workspaceId);
    if (room) {
      room.members.delete(client.id);
      this.server.to(`workspace:${workspaceId}`).emit('member:left', {
        odId: user.odId,
        odName: user.odName,
      });

      if (room.members.size === 0) {
        this.workspaceRooms.delete(workspaceId);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Document Room Management (Real-time Editing)
  // ─────────────────────────────────────────────────────────────────────────────

  @SubscribeMessage('document:join')
  async handleJoinDocument(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { documentId: string; workspaceId: string },
  ) {
    const user = this.socketToUser.get(client.id);
    if (!user) return;

    const { documentId, workspaceId } = data;

    // Verify access
    const hasAccess = await this.verifyWorkspaceAccess(user.odId, workspaceId);
    if (!hasAccess) {
      client.emit('error', { message: 'Access denied to document' });
      return;
    }

    // Join socket room
    client.join(`document:${documentId}`);

    // Track in document room
    if (!this.documentRooms.has(documentId)) {
      this.documentRooms.set(documentId, {
        documentId,
        workspaceId,
        collaborators: new Map(),
      });
    }

    const room = this.documentRooms.get(documentId)!;
    
    // Get user profile for avatar
    const profile = await this.prisma.profile.findUnique({
      where: { userId: user.odId },
      select: { avatarUrl: true },
    });

    room.collaborators.set(client.id, {
      odId: user.odId,
      odName: user.odName,
      avatarUrl: profile?.avatarUrl || undefined,
      lastActivity: new Date(),
    });

    // Notify others
    client.to(`document:${documentId}`).emit('collaborator:joined', {
      odId: user.odId,
      odName: user.odName,
      avatarUrl: profile?.avatarUrl,
    });

    // Send current collaborators to joining user
    const collaborators = Array.from(room.collaborators.values()).map((c) => ({
      odId: c.odId,
      odName: c.odName,
      avatarUrl: c.avatarUrl,
      cursor: c.cursor,
      selection: c.selection,
    }));

    client.emit('document:joined', { documentId, collaborators });

    this.logger.log(`User ${user.odName} joined document ${documentId}`);
  }

  @SubscribeMessage('document:leave')
  handleLeaveDocument(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { documentId: string },
  ) {
    const user = this.socketToUser.get(client.id);
    if (!user) return;

    const { documentId } = data;
    client.leave(`document:${documentId}`);

    const room = this.documentRooms.get(documentId);
    if (room) {
      room.collaborators.delete(client.id);
      this.server.to(`document:${documentId}`).emit('collaborator:left', {
        odId: user.odId,
        odName: user.odName,
      });

      if (room.collaborators.size === 0) {
        this.documentRooms.delete(documentId);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Real-time Cursor & Selection Tracking
  // ─────────────────────────────────────────────────────────────────────────────

  @SubscribeMessage('cursor:move')
  handleCursorMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { documentId: string; x: number; y: number },
  ) {
    const user = this.socketToUser.get(client.id);
    if (!user) return;

    const room = this.documentRooms.get(data.documentId);
    if (room) {
      const collaborator = room.collaborators.get(client.id);
      if (collaborator) {
        collaborator.cursor = { x: data.x, y: data.y };
        collaborator.lastActivity = new Date();
      }
    }

    client.to(`document:${data.documentId}`).emit('cursor:moved', {
      odId: user.odId,
      x: data.x,
      y: data.y,
    });
  }

  @SubscribeMessage('selection:change')
  handleSelectionChange(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { documentId: string; start: number; end: number; sectionKey?: string },
  ) {
    const user = this.socketToUser.get(client.id);
    if (!user) return;

    const room = this.documentRooms.get(data.documentId);
    if (room) {
      const collaborator = room.collaborators.get(client.id);
      if (collaborator) {
        collaborator.selection = {
          start: data.start,
          end: data.end,
          sectionKey: data.sectionKey,
        };
        collaborator.lastActivity = new Date();
      }
    }

    client.to(`document:${data.documentId}`).emit('selection:changed', {
      odId: user.odId,
      start: data.start,
      end: data.end,
      sectionKey: data.sectionKey,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Real-time Content Updates
  // ─────────────────────────────────────────────────────────────────────────────

  @SubscribeMessage('content:update')
  async handleContentUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      documentId: string;
      sectionKey?: string;
      operation: 'insert' | 'delete' | 'replace';
      position: number;
      content?: string;
      length?: number;
      timestamp: number;
    },
  ) {
    const user = this.socketToUser.get(client.id);
    if (!user) return;

    // Broadcast to other collaborators
    client.to(`document:${data.documentId}`).emit('content:updated', {
      odId: user.odId,
      odName: user.odName,
      ...data,
    });

    // Update last activity
    const room = this.documentRooms.get(data.documentId);
    if (room) {
      const collaborator = room.collaborators.get(client.id);
      if (collaborator) {
        collaborator.lastActivity = new Date();
      }
    }
  }

  @SubscribeMessage('section:update')
  async handleSectionUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      documentId: string;
      sectionKey: string;
      content: Record<string, any>;
      timestamp: number;
    },
  ) {
    const user = this.socketToUser.get(client.id);
    if (!user) return;

    // Broadcast to other collaborators
    client.to(`document:${data.documentId}`).emit('section:updated', {
      odId: user.odId,
      odName: user.odName,
      sectionKey: data.sectionKey,
      content: data.content,
      timestamp: data.timestamp,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Comments & Reviews Real-time
  // ─────────────────────────────────────────────────────────────────────────────

  @SubscribeMessage('comment:add')
  async handleCommentAdd(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      documentId: string;
      commentId: string;
      body: string;
      sectionKey?: string;
      parentId?: string;
    },
  ) {
    const user = this.socketToUser.get(client.id);
    if (!user) return;

    // Broadcast to document room
    this.server.to(`document:${data.documentId}`).emit('comment:added', {
      commentId: data.commentId,
      authorId: user.odId,
      authorName: user.odName,
      body: data.body,
      sectionKey: data.sectionKey,
      parentId: data.parentId,
      createdAt: new Date().toISOString(),
    });
  }

  @SubscribeMessage('comment:resolve')
  async handleCommentResolve(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { documentId: string; commentId: string },
  ) {
    const user = this.socketToUser.get(client.id);
    if (!user) return;

    this.server.to(`document:${data.documentId}`).emit('comment:resolved', {
      commentId: data.commentId,
      resolvedById: user.odId,
      resolvedByName: user.odName,
      resolvedAt: new Date().toISOString(),
    });
  }

  @SubscribeMessage('review:submit')
  async handleReviewSubmit(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      documentId: string;
      reviewId: string;
      status: string;
      feedback?: string;
    },
  ) {
    const user = this.socketToUser.get(client.id);
    if (!user) return;

    this.server.to(`document:${data.documentId}`).emit('review:submitted', {
      reviewId: data.reviewId,
      reviewerId: user.odId,
      reviewerName: user.odName,
      status: data.status,
      feedback: data.feedback,
      submittedAt: new Date().toISOString(),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Typing Indicators
  // ─────────────────────────────────────────────────────────────────────────────

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { documentId: string; sectionKey?: string },
  ) {
    const user = this.socketToUser.get(client.id);
    if (!user) return;

    client.to(`document:${data.documentId}`).emit('typing:started', {
      odId: user.odId,
      odName: user.odName,
      sectionKey: data.sectionKey,
    });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { documentId: string; sectionKey?: string },
  ) {
    const user = this.socketToUser.get(client.id);
    if (!user) return;

    client.to(`document:${data.documentId}`).emit('typing:stopped', {
      odId: user.odId,
      sectionKey: data.sectionKey,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Workspace Activity Notifications
  // ─────────────────────────────────────────────────────────────────────────────

  @SubscribeMessage('activity:broadcast')
  handleActivityBroadcast(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      workspaceId: string;
      action: string;
      entityType: string;
      entityId: string;
      metadata?: Record<string, any>;
    },
  ) {
    const user = this.socketToUser.get(client.id);
    if (!user) return;

    client.to(`workspace:${data.workspaceId}`).emit('activity:new', {
      odId: user.odId,
      odName: user.odName,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      metadata: data.metadata,
      timestamp: new Date().toISOString(),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Helper Methods
  // ─────────────────────────────────────────────────────────────────────────────

  private async verifyWorkspaceAccess(userId: string, workspaceId: string): Promise<boolean> {
    const workspace = await this.prisma.builderWorkspace.findUnique({
      where: { id: workspaceId },
      include: {
        collaborators: {
          where: { userId, isActive: true },
        },
      },
    });

    if (!workspace) return false;
    if (workspace.ownerId === userId) return true;
    if (workspace.collaborators.length > 0) return true;
    if (workspace.visibility === 'public') return true;

    return false;
  }

  // Public methods for external service calls
  notifyWorkspace(workspaceId: string, event: string, data: any) {
    this.server.to(`workspace:${workspaceId}`).emit(event, data);
  }

  notifyDocument(documentId: string, event: string, data: any) {
    this.server.to(`document:${documentId}`).emit(event, data);
  }

  getDocumentCollaborators(documentId: string): CollaboratorPresence[] {
    const room = this.documentRooms.get(documentId);
    if (!room) return [];
    return Array.from(room.collaborators.values());
  }

  getWorkspaceMembers(workspaceId: string): { odId: string; odName: string }[] {
    const room = this.workspaceRooms.get(workspaceId);
    if (!room) return [];
    return Array.from(room.members.values()).map((m) => ({
      odId: m.odId,
      odName: m.odName,
    }));
  }
}
