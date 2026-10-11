import { Injectable, Logger } from '@nestjs/common';
import { AIAgentType, AIMessageRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChatMessage } from './ollama.service';

export interface AIConversation {
  id: string;
  userId: string;
  agentId: string;
  title: string;
  messages: AIConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AIConversationMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  model?: string;
  createdAt: Date;
}

export interface CreateConversationDto {
  userId: string;
  agentId?: string;
  title?: string;
  initialMessage?: string;
}

// ── Agent ID ↔ Prisma enum mapping ────────────────────────────────────────────

const AGENT_TO_ENUM: Record<string, AIAgentType> = {
  general: 'general',
  matching: 'matching',
  research: 'research',
  'pitch-coach': 'pitch_coach',
  'mentor-finder': 'mentor_finder',
  'market-analyst': 'market_analyst',
  fundraising: 'fundraising',
  'legal-advisor': 'legal_advisor',
  'technical-advisor': 'technical_advisor',
  'growth-strategist': 'growth_strategist',
} as Record<string, AIAgentType>;

const ENUM_TO_AGENT: Record<string, string> = {
  general: 'general',
  matching: 'matching',
  research: 'research',
  pitch_coach: 'pitch-coach',
  mentor_finder: 'mentor-finder',
  market_analyst: 'market-analyst',
  fundraising: 'fundraising',
  legal_advisor: 'legal-advisor',
  technical_advisor: 'technical-advisor',
  growth_strategist: 'growth-strategist',
};

function toAgentEnum(agentId: string): AIAgentType {
  return (AGENT_TO_ENUM[agentId] ?? 'general') as AIAgentType;
}

function fromAgentEnum(agentType: AIAgentType): string {
  return ENUM_TO_AGENT[agentType as string] ?? 'general';
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class AIConversationService {
  private readonly logger = new Logger(AIConversationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createConversation(dto: CreateConversationDto): Promise<AIConversation> {
    const agentType = toAgentEnum(dto.agentId ?? 'general');
    const autoTitle = dto.initialMessage
      ? dto.initialMessage.slice(0, 50) + (dto.initialMessage.length > 50 ? '...' : '')
      : null;

    const conversation = await this.prisma.aIConversation.create({
      data: {
        userId: dto.userId,
        agentType,
        title: dto.title ?? autoTitle ?? 'New Conversation',
        messageCount: dto.initialMessage ? 1 : 0,
        lastMessageAt: dto.initialMessage ? new Date() : undefined,
        messages: dto.initialMessage
          ? { create: { role: 'user' as AIMessageRole, content: dto.initialMessage } }
          : undefined,
      },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    return this.mapConversation(conversation);
  }

  async getConversation(conversationId: string, userId: string): Promise<AIConversation | null> {
    const conversation = await this.prisma.aIConversation.findFirst({
      where: { id: conversationId, userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation) return null;
    return this.mapConversation(conversation);
  }

  async listConversations(userId: string, limit = 20): Promise<AIConversation[]> {
    const conversations = await this.prisma.aIConversation.findMany({
      where: { userId, isArchived: false },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    return conversations.map((c) => ({
      id: c.id,
      userId: c.userId,
      agentId: fromAgentEnum(c.agentType),
      title: c.title ?? 'New Conversation',
      messages: [],
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }

  async addMessage(
    conversationId: string,
    userId: string,
    message: Omit<AIConversationMessage, 'id' | 'createdAt'>,
  ): Promise<AIConversationMessage | null> {
    const conv = await this.prisma.aIConversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true, title: true },
    });
    if (!conv) return null;

    const newMsg = await this.prisma.aIMessage.create({
      data: {
        conversationId,
        role: message.role as AIMessageRole,
        content: message.content,
        model: message.model,
      },
    });

    const updateData: Parameters<typeof this.prisma.aIConversation.update>[0]['data'] = {
      updatedAt: new Date(),
      lastMessageAt: new Date(),
      messageCount: { increment: 1 },
    };

    if ((conv.title === 'New Conversation' || conv.title === null) && message.role === 'user') {
      updateData.title = message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '');
    }

    await this.prisma.aIConversation.update({
      where: { id: conversationId },
      data: updateData,
    });

    return {
      id: newMsg.id,
      role: newMsg.role as 'system' | 'user' | 'assistant',
      content: newMsg.content,
      model: newMsg.model ?? undefined,
      createdAt: newMsg.createdAt,
    };
  }

  async deleteConversation(conversationId: string, userId: string): Promise<boolean> {
    const result = await this.prisma.aIConversation.deleteMany({
      where: { id: conversationId, userId },
    });
    return result.count > 0;
  }

  async getMessagesForContext(conversationId: string, userId: string, limit = 10): Promise<ChatMessage[]> {
    const messages = await this.prisma.aIMessage.findMany({
      where: {
        conversationId,
        conversation: { userId },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { role: true, content: true },
    });

    return messages.reverse().map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));
  }

  async clearOldConversations(userId: string, keepCount = 50): Promise<number> {
    const toKeep = await this.prisma.aIConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: keepCount,
      select: { id: true },
    });

    const keepIds = toKeep.map((c) => c.id);
    const result = await this.prisma.aIConversation.deleteMany({
      where: { userId, id: { notIn: keepIds } },
    });
    return result.count;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private mapConversation(
    c: { id: string; userId: string; agentType: AIAgentType; title: string | null; createdAt: Date; updatedAt: Date; messages: Array<{ id: string; role: AIMessageRole; content: string; model: string | null; createdAt: Date }> },
  ): AIConversation {
    return {
      id: c.id,
      userId: c.userId,
      agentId: fromAgentEnum(c.agentType),
      title: c.title ?? 'New Conversation',
      messages: c.messages.map((m) => ({
        id: m.id,
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
        model: m.model ?? undefined,
        createdAt: m.createdAt,
      })),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }
}
