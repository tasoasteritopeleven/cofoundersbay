import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PresenceService } from './presence.service';

type UserCard = {
  id: string;
  email: string;
  role: string;
  displayName: string | null;
  headline: string | null;
  avatarUrl: string | null;
  lastSeenAt: Date | null;
};

export type ConversationSummaryDto = {
  id: string;
  type: 'direct' | 'group';
  recipient: {
    id: string;
    displayName: string;
    headline: string | null;
    avatarUrl: string | null;
    role: string;
    isOnline: boolean;
    lastSeenAt: string | null;
  } | null;
  lastMessage: {
    id: string;
    body: string;
    senderId: string;
    createdAt: string;
  } | null;
  unreadCount: number;
  isPinned: boolean;
  isArchived: boolean;
  updatedAt: string;
};

export type MessageDto = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  sender: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    role: string;
  };
  attachments: {
    id: string;
    url: string;
    mimeType: string | null;
    fileName: string | null;
    sizeBytes: number | null;
  }[];
};

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presence: PresenceService,
    private readonly notifications: NotificationsService,
  ) {}

  private async hasBlockedRelationship(userId: string, otherUserId: string): Promise<boolean> {
    const blocked = await this.prisma.connectionRequest.findFirst({
      where: {
        status: 'blocked',
        OR: [
          { requesterId: userId, receiverId: otherUserId },
          { requesterId: otherUserId, receiverId: userId },
        ],
      },
      select: { id: true },
    });
    return !!blocked;
  }

  async getConversationIdsForUser(userId: string): Promise<string[]> {
    const parts = await this.prisma.conversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true },
    });
    return parts.map((p) => p.conversationId);
  }

  async getOrCreateDirectConversation(userId: string, otherUserId: string) {
    if (!otherUserId || otherUserId === userId) {
      throw new BadRequestException('Invalid recipient');
    }

    const other = await this.prisma.user.findUnique({
      where: { id: otherUserId },
      select: { id: true },
    });
    if (!other) throw new NotFoundException('User not found');

    if (await this.hasBlockedRelationship(userId, otherUserId)) {
      throw new ForbiddenException('Cannot message this user');
    }

    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: 'direct',
        participants: { some: { userId } },
        AND: [{ participants: { some: { userId: otherUserId } } }],
      },
      select: { id: true },
    });
    if (existing) return existing;

    return this.prisma.conversation.create({
      data: {
        type: 'direct',
        participants: {
          createMany: {
            data: [{ userId }, { userId: otherUserId }],
          },
        },
      },
      select: { id: true },
    });
  }

  async listConversations(userId: string): Promise<ConversationSummaryDto[]> {
    const conversations = await this.prisma.conversation.findMany({
      where: { participants: { some: { userId } } },
      include: {
        participants: {
          select: {
            userId: true,
            isPinned: true,
            isArchived: true,
            lastReadAt: true,
            user: {
              select: {
                id: true,
                email: true,
                role: true,
                lastSeenAt: true,
                profile: { select: { displayName: true, headline: true, avatarUrl: true } },
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, body: true, senderId: true, createdAt: true },
        },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
      take: 100,
    });

    const unreadCounts = await Promise.all(
      conversations.map(async (conversation) => {
        const me = conversation.participants.find((participant) => participant.userId === userId);
        const lastReadAt = me?.lastReadAt ?? null;

        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: conversation.id,
            senderId: { not: userId },
            ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
          },
        });

        return [conversation.id, unreadCount] as const;
      }),
    );
    const unreadCountMap = new Map(unreadCounts);

    const result: ConversationSummaryDto[] = [];
    for (const c of conversations) {
      const me = c.participants.find((p) => p.userId === userId);
      const other = c.type === 'direct'
        ? c.participants.find((p) => p.userId !== userId)?.user
        : null;

      const otherCard: UserCard | null = other
        ? {
            id: other.id,
            email: other.email,
            role: other.role,
            displayName: other.profile?.displayName ?? null,
            headline: other.profile?.headline ?? null,
            avatarUrl: other.profile?.avatarUrl ?? null,
            lastSeenAt: other.lastSeenAt ?? null,
          }
        : null;

      const last = c.messages[0] ?? null;

      result.push({
        id: c.id,
        type: c.type,
        recipient: otherCard
          ? {
              id: otherCard.id,
              displayName: otherCard.displayName ?? otherCard.email,
              headline: otherCard.headline,
              avatarUrl: otherCard.avatarUrl,
              role: otherCard.role,
              isOnline: this.presence.isOnline(otherCard.id),
              lastSeenAt: otherCard.lastSeenAt ? otherCard.lastSeenAt.toISOString() : null,
            }
          : null,
        lastMessage: last
          ? {
              id: last.id,
              body: last.body,
              senderId: last.senderId,
              createdAt: last.createdAt.toISOString(),
            }
          : null,
        unreadCount: unreadCountMap.get(c.id) ?? 0,
        isPinned: me?.isPinned ?? false,
        isArchived: me?.isArchived ?? false,
        updatedAt: c.updatedAt.toISOString(),
      });
    }

    // Pinned first, then most recently updated
    return result
      .filter((x) => !x.isArchived)
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }

  async listMessages(userId: string, conversationId: string, limit = 50): Promise<MessageDto[]> {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { conversationId: true },
    });
    if (!participant) throw new ForbiddenException('Not a participant');

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: Math.min(Math.max(limit, 1), 200),
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            role: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
        attachments: {
          select: { id: true, url: true, mimeType: true, fileName: true, sizeBytes: true },
        },
      },
    });

    // Mark as read (best effort)
    await this.prisma.conversationParticipant
      .update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { lastReadAt: new Date() },
      })
      .catch(() => {});

    return messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      sender: {
        id: m.sender.id,
        displayName: m.sender.profile?.displayName ?? m.sender.email,
        avatarUrl: m.sender.profile?.avatarUrl ?? null,
        role: m.sender.role,
      },
      attachments: m.attachments.map((a) => ({
        id: a.id,
        url: a.url,
        mimeType: a.mimeType ?? null,
        fileName: a.fileName ?? null,
        sizeBytes: a.sizeBytes ?? null,
      })),
    }));
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    body: string,
    attachmentUploadIds?: string[],
  ): Promise<MessageDto> {
    const trimmed = body?.trim();
    if (!trimmed) throw new BadRequestException('Message body is required');
    if (trimmed.length > 5000) throw new BadRequestException('Message too long');

    const uploadIds = Array.from(new Set((attachmentUploadIds ?? []).filter(Boolean)));
    if (uploadIds.length > 5) throw new BadRequestException('Too many attachments');

    const uploads = uploadIds.length
      ? await this.prisma.upload.findMany({
          where: {
            id: { in: uploadIds },
            userId,
            kind: 'message_attachment',
          },
          select: {
            id: true,
            url: true,
            mimeType: true,
            originalName: true,
            sizeBytes: true,
          },
        })
      : [];

    if (uploadIds.length && uploads.length !== uploadIds.length) {
      throw new BadRequestException('Invalid attachment(s)');
    }

    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { conversationId: true },
    });
    if (!participant) throw new ForbiddenException('Not a participant');

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        type: true,
        participants: {
          where: { userId: { not: userId } },
          select: { userId: true },
        },
      },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.type === 'direct') {
      const otherUserId = conversation.participants[0]?.userId;
      if (otherUserId && await this.hasBlockedRelationship(userId, otherUserId)) {
        throw new ForbiddenException('Cannot message this user');
      }
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId,
          senderId: userId,
          body: trimmed,
          ...(uploads.length
            ? {
                attachments: {
                  create: uploads.map((u) => ({
                    uploadId: u.id,
                    url: u.url,
                    mimeType: u.mimeType ?? null,
                    fileName: u.originalName ?? null,
                    sizeBytes: u.sizeBytes ?? null,
                  })),
                },
              }
            : {}),
        },
        include: {
          sender: {
            select: {
              id: true,
              email: true,
              role: true,
              profile: { select: { displayName: true, avatarUrl: true } },
            },
          },
          attachments: { select: { id: true, url: true, mimeType: true, fileName: true, sizeBytes: true } },
        },
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: created.createdAt },
      });

      await tx.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { lastReadAt: created.createdAt },
      });

      return created;
    });

    const dto: MessageDto = {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      sender: {
        id: message.sender.id,
        displayName: message.sender.profile?.displayName ?? message.sender.email,
        avatarUrl: message.sender.profile?.avatarUrl ?? null,
        role: message.sender.role,
      },
      attachments: message.attachments.map((a) => ({
        id: a.id,
        url: a.url,
        mimeType: a.mimeType ?? null,
        fileName: a.fileName ?? null,
        sizeBytes: a.sizeBytes ?? null,
      })),
    };

    // Best-effort notifications (do not break chat flow if these fail)
    const recipients = await this.prisma.conversationParticipant
      .findMany({
        where: { conversationId, userId: { not: userId } },
        select: {
          userId: true,
          user: { select: { email: true } },
        },
      })
      .catch(() => []);

    const fromDisplayName = dto.sender.displayName;

    await Promise.allSettled(
      recipients.map((r) =>
        this.notifications.notifyNewMessage({
          recipientUserId: r.userId,
          recipientEmail: this.presence.isOnline(r.userId) ? null : r.user.email,
          fromDisplayName,
          conversationId,
          messageBody: dto.body,
          messageId: dto.id,
        }),
      ),
    );

    return dto;
  }

  // ── Conversation Validation ───────────────────────────────────────────────

  private async ensureParticipant(userId: string, conversationId: string) {
    const p = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { conversationId: true },
    });
    if (!p) throw new ForbiddenException('Not a participant in this conversation');
    return p;
  }

  async getConversationValidation(userId: string, conversationId: string) {
    await this.ensureParticipant(userId, conversationId);
    const validation = await this.prisma.conversationValidation.findUnique({
      where: { conversationId },
    });
    if (!validation) {
      return {
        mode: 'casual' as const,
        initiatedBy: null,
        initiatedAt: null,
        acceptedBy: null,
        acceptedAt: null,
        lastValidatedAt: null,
        validationHash: null,
        transcriptAvailable: false,
      };
    }
    return this.mapValidation(validation);
  }

  async updateConversationValidationMode(
    userId: string,
    conversationId: string,
    mode: 'casual' | 'one_party' | 'two_party',
  ) {
    await this.ensureParticipant(userId, conversationId);

    const isCasual = mode === 'casual';
    const validation = await this.prisma.conversationValidation.upsert({
      where: { conversationId },
      create: {
        conversationId,
        mode,
        initiatedById: isCasual ? null : userId,
        initiatedAt: isCasual ? null : new Date(),
        transcriptAvailable: !isCasual,
      },
      update: {
        mode,
        initiatedById: isCasual ? null : userId,
        initiatedAt: isCasual ? null : new Date(),
        acceptedById: null,
        acceptedAt: null,
        transcriptAvailable: !isCasual,
        // Recompute hash on mode change
        lastValidatedAt: isCasual ? null : new Date(),
        validationHash: isCasual ? null : await this.computeValidationHash(conversationId),
      },
    });

    // Notify other participants (transparency requirement)
    if (!isCasual) {
      const others = await this.prisma.conversationParticipant.findMany({
        where: { conversationId, userId: { not: userId } },
        select: { userId: true, user: { select: { email: true } } },
      });
      const modeLabel = mode === 'one_party' ? 'One-Party Validation' : 'Two-Party Validation';
      await Promise.allSettled(
        others.map((o) =>
          this.notifications.createNotification({
            userId: o.userId,
            type: 'system',
            title: 'Conversation validation mode changed',
            body: `A participant has enabled ${modeLabel} for this conversation.`,
            link: `/messages?c=${conversationId}`,
          }),
        ),
      );
    }

    return { success: true, validationState: this.mapValidation(validation) };
  }

  async acceptConversationValidation(userId: string, conversationId: string) {
    await this.ensureParticipant(userId, conversationId);
    const existing = await this.prisma.conversationValidation.findUnique({
      where: { conversationId },
    });
    if (!existing || existing.mode !== 'two_party') {
      throw new BadRequestException('No pending two-party validation request');
    }
    if (existing.initiatedById === userId) {
      throw new BadRequestException('You cannot accept your own validation request');
    }

    const hash = await this.computeValidationHash(conversationId);
    const validation = await this.prisma.conversationValidation.update({
      where: { conversationId },
      data: {
        acceptedById: userId,
        acceptedAt: new Date(),
        lastValidatedAt: new Date(),
        validationHash: hash,
        transcriptAvailable: true,
      },
    });

    return { success: true, validationState: this.mapValidation(validation) };
  }

  async declineConversationValidation(userId: string, conversationId: string) {
    await this.ensureParticipant(userId, conversationId);
    await this.prisma.conversationValidation.upsert({
      where: { conversationId },
      create: { conversationId, mode: 'casual' },
      update: {
        mode: 'casual',
        initiatedById: null,
        initiatedAt: null,
        acceptedById: null,
        acceptedAt: null,
        transcriptAvailable: false,
        validationHash: null,
      },
    });
    return { success: true };
  }

  async exportConversationTranscript(userId: string, conversationId: string, format: 'json' | 'txt') {
    await this.ensureParticipant(userId, conversationId);
    const validation = await this.prisma.conversationValidation.findUnique({
      where: { conversationId },
    });
    if (!validation || !validation.transcriptAvailable) {
      throw new BadRequestException('Transcript not available for this conversation');
    }

    const messages = await this.prisma.message.findMany({
      where: { conversationId, deletedAt: null },
      include: {
        sender: { select: { id: true, profile: { select: { displayName: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (format === 'json') {
      return {
        contentType: 'application/json',
        data: JSON.stringify({
          conversationId,
          exportedAt: new Date().toISOString(),
          validationMode: validation.mode,
          validationHash: validation.validationHash,
          messages: messages.map((m) => ({
            id: m.id,
            senderId: m.senderId,
            senderName: m.sender.profile?.displayName ?? m.senderId,
            body: m.body,
            createdAt: m.createdAt.toISOString(),
          })),
        }),
      };
    }

    const lines = [
      `Conversation Transcript — ${conversationId}`,
      `Exported: ${new Date().toISOString()}`,
      `Validation mode: ${validation.mode}`,
      validation.validationHash ? `Hash: ${validation.validationHash}` : '',
      '',
      ...messages.map(
        (m) =>
          `[${m.createdAt.toISOString()}] ${m.sender.profile?.displayName ?? m.senderId}: ${m.body}`,
      ),
    ];
    return { contentType: 'text/plain', data: lines.filter(Boolean).join('\n') };
  }

  private async computeValidationHash(conversationId: string): Promise<string> {
    const { createHash } = await import('node:crypto');
    const messages = await this.prisma.message.findMany({
      where: { conversationId, deletedAt: null },
      select: { id: true, body: true, senderId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const payload = messages.map((m) => `${m.createdAt.toISOString()}|${m.senderId}|${m.body}`).join('\n');
    return createHash('sha256').update(payload).digest('hex');
  }

  private mapValidation(v: {
    mode: string;
    initiatedById: string | null;
    initiatedAt: Date | null;
    acceptedById: string | null;
    acceptedAt: Date | null;
    lastValidatedAt: Date | null;
    validationHash: string | null;
    transcriptAvailable: boolean;
  }) {
    return {
      mode: v.mode as 'casual' | 'one_party' | 'two_party',
      initiatedBy: v.initiatedById,
      initiatedAt: v.initiatedAt?.toISOString() ?? null,
      acceptedBy: v.acceptedById,
      acceptedAt: v.acceptedAt?.toISOString() ?? null,
      lastValidatedAt: v.lastValidatedAt?.toISOString() ?? null,
      validationHash: v.validationHash,
      transcriptAvailable: v.transcriptAvailable,
    };
  }

  async setConversationFlags(userId: string, conversationId: string, flags: { isPinned?: boolean; isArchived?: boolean }) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { conversationId: true },
    });
    if (!participant) throw new ForbiddenException('Not a participant');

    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: {
        ...(flags.isPinned !== undefined ? { isPinned: flags.isPinned } : {}),
        ...(flags.isArchived !== undefined ? { isArchived: flags.isArchived } : {}),
      },
    });
    return { ok: true };
  }
}

