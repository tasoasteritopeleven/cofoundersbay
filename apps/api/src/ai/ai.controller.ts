import { Controller, Post, Body, UseGuards, Get, Param, Delete, Patch, Query, Req, Res, HttpStatus, NotFoundException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AIService } from './ai.service';
import { OllamaService } from './ollama.service';
import { AIConversationService } from './ai-conversation.service';
import { AIJobQueueService, AIJobData } from './ai-job-queue.service';
import { AIRateLimitGuard } from './guards/ai-rate-limit.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AIAgentType } from '@prisma/client';
import { ChatRequestDto, CreateConversationDto, UpdateAIPreferencesDto } from './dto/chat.dto';
import { EnqueueJobDto } from './dto/enqueue-job.dto';
import { getAgent, listAgents } from './agents/base-agent';
import { toToolCatalog } from '@cofounderbay/shared';
import { AIActionAuditService } from './ai-action-audit.service';
import { RecordAIActionDto } from './dto/record-action.dto';
import { reviewToolCalls } from './tool-calls';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AIController {
  constructor(
    private readonly ai: AIService,
    private readonly ollama: OllamaService,
    private readonly conversations: AIConversationService,
    private readonly jobQueue: AIJobQueueService,
    private readonly actionAudit: AIActionAuditService,
    private readonly prisma: PrismaService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Health & Models
  // ─────────────────────────────────────────────────────────────

  @Get('health')
  async getHealth() {
    const status = await this.ollama.checkHealth();
    return status;
  }

  @Get('models')
  async getModels() {
    const models = await this.ollama.listModels();
    return { models, default: this.ollama.getDefaultModel() };
  }

  @Get('agents')
  getAgents() {
    return { agents: listAgents() };
  }

  /**
   * The function-calling catalogue, derived from `ACTION_DECLARATIONS` in
   * `@cofounderbay/shared`.
   *
   * Served from the same declarations `reviewToolCalls` checks against, so a
   * client cannot be shown one contract while the server enforces another.
   * Executing an accepted call is still the web app's job, behind the
   * confirmation the user gives it.
   */
  @Get('tools')
  getTools(@CurrentUser() user: { id: string; role?: string | null }) {
    // Only what this caller may use: an admin-only read is not offered to a
    // founder's model, and would be refused by the endpoint if it were.
    return { tools: toToolCatalog(user?.role ?? null) };
  }

  // ─────────────────────────────────────────────────────────────
  // Action audit trail
  // ─────────────────────────────────────────────────────────────

  /**
   * Records an assistant action the user confirmed.
   *
   * Validated against the same declarations as a model's tool call, so the
   * trail cannot be filled with capabilities that do not exist. A rejected
   * entry answers 200 with `recorded: false` and a reason rather than an
   * error status: the action it describes has already happened, and turning a
   * completed action into a failed request would misreport it to the user.
   */
  @Post('actions')
  async recordAction(
    @CurrentUser() user: { id: string },
    @Body() dto: RecordAIActionDto,
    @Req() req: Request,
  ) {
    return this.actionAudit.record({
      actorId: user.id,
      actionId: dto.actionId,
      args: dto.args ?? {},
      outcome: dto.outcome,
      ipAddress: req.ip ?? null,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
    });
  }

  /** The caller's own trail. The actor is taken from the token, never the query. */
  @Get('actions')
  async listActions(
    @CurrentUser() user: { id: string },
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
    return this.actionAudit.listForActor(user.id, {
      limit: Number.isFinite(limit) ? limit : undefined,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Chat (Non-Streaming)
  // ─────────────────────────────────────────────────────────────

  @Post('chat')
  @UseGuards(AIRateLimitGuard)
  async chat(
    @CurrentUser() user: { id: string; role?: string | null },
    @Body() dto: ChatRequestDto,
  ) {
    const agent = getAgent(dto.agentId || 'general');
    
    // Get conversation history if conversationId provided
    let history = dto.history || [];
    if (dto.conversationId) {
      const contextMessages = await this.conversations.getMessagesForContext(
        dto.conversationId,
        user.id,
        10,
      );
      history = [...contextMessages, ...history];
    }

    const messages = agent.buildMessages(dto.message, history, {
      userId: user.id,
      userData: dto.context,
    });

    const startMs = Date.now();
    let success = false;
    let isFallback = false;
    let usedModel = dto.model || this.ollama.getDefaultModel();
    let toolCalls: unknown = null;

    try {
      const response = await this.ollama.chat(messages, {
        model: dto.model,
        temperature: agent.config.temperature,
        maxTokens: agent.config.maxTokens,
        tools: dto.enableTools ? toToolCatalog(user?.role ?? null) : undefined,
        onToolCalls: (calls) => {
          toolCalls = calls;
        },
      });

      success = true;

      if (dto.conversationId) {
        await this.conversations.addMessage(dto.conversationId, user.id, {
          role: 'user',
          content: dto.message,
        });
        await this.conversations.addMessage(dto.conversationId, user.id, {
          role: 'assistant',
          content: response,
          model: usedModel,
        });
      }

      // Same contract as the streaming path: validated proposals, never
      // executed here, and the rejections are reported rather than swallowed.
      const review = reviewToolCalls(toolCalls, user?.role ?? null);

      return {
        message: response,
        agent: agent.config.id,
        model: usedModel,
        ...(review.accepted.length ? { toolCalls: review.accepted } : {}),
        ...(review.rejected.length ? { rejectedToolCalls: review.rejected } : {}),
      };
    } catch (err: any) {
      isFallback = true;
      const fallbackMsg = this.getFallbackResponse(dto.message, dto.agentId);
      usedModel = 'fallback';
      return {
        message: fallbackMsg,
        agent: agent.config.id,
        model: 'fallback',
        fallback: true,
      };
    } finally {
      void this.logUsage({
        userId: user.id,
        agentId: dto.agentId || 'general',
        endpoint: '/ai/chat',
        responseTimeMs: Date.now() - startMs,
        model: usedModel,
        success,
        isFallback,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Chat (Streaming via SSE)
  // ─────────────────────────────────────────────────────────────

  @Post('chat/stream')
  @UseGuards(AIRateLimitGuard)
  async chatStream(
    @CurrentUser() user: { id: string; role?: string | null },
    @Body() dto: ChatRequestDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const agent = getAgent(dto.agentId || 'general');
    
    let history = dto.history || [];
    if (dto.conversationId) {
      const contextMessages = await this.conversations.getMessagesForContext(
        dto.conversationId,
        user.id,
        10,
      );
      history = [...contextMessages, ...history];
    }

    const messages = agent.buildMessages(dto.message, history, {
      userId: user.id,
      userData: dto.context,
    });

    // Save user message
    if (dto.conversationId) {
      await this.conversations.addMessage(dto.conversationId, user.id, {
        role: 'user',
        content: dto.message,
      });
    }

    const startMs = Date.now();
    const usedModel = dto.model || this.ollama.getDefaultModel();
    let success = false;
    let isFallback = false;
    let toolCalls: unknown = null;

    try {
      let fullResponse = '';

      for await (const chunk of this.ollama.chatStream(messages, {
        model: dto.model,
        temperature: agent.config.temperature,
        maxTokens: agent.config.maxTokens,
        tools: dto.enableTools ? toToolCatalog(user?.role ?? null) : undefined,
        onToolCalls: (calls) => {
          toolCalls = calls;
        },
      })) {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ chunk, done: false })}\n\n`);
      }

      success = true;

      if (dto.conversationId) {
        await this.conversations.addMessage(dto.conversationId, user.id, {
          role: 'assistant',
          content: fullResponse,
          model: usedModel,
        });
      }

      // Tool calls ride out on the terminal event, as *proposals*.
      //
      // This is the whole design constraint: the assistant must never replay an
      // AI POST after partial streaming output, so there is no second call to
      // the model here and no retry of this one. What the model asked for is
      // assembled during the single stream, checked against the declarations,
      // and handed to the client, which renders it as a confirmable card. If
      // the user confirms, the client performs the action and any continuation
      // is a *new* turn the user initiated — not a resend of this one.
      //
      // `rejected` travels too rather than being dropped silently: a model that
      // keeps inventing capabilities is something the client can surface and a
      // reader of the logs can act on.
      const review = reviewToolCalls(toolCalls, user?.role ?? null);
      res.write(
        `data: ${JSON.stringify({
          done: true,
          model: usedModel,
          ...(review.accepted.length ? { toolCalls: review.accepted } : {}),
          ...(review.rejected.length ? { rejectedToolCalls: review.rejected } : {}),
        })}\n\n`,
      );
      res.end();
    } catch (err: any) {
      isFallback = true;
      const fallback = this.getFallbackResponse(dto.message, dto.agentId);
      res.write(`data: ${JSON.stringify({ chunk: fallback, done: true, fallback: true })}\n\n`);
      res.end();
    } finally {
      void this.logUsage({
        userId: user.id,
        agentId: dto.agentId || 'general',
        endpoint: '/ai/chat/stream',
        responseTimeMs: Date.now() - startMs,
        model: usedModel,
        success,
        isFallback,
        isStreamed: true,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Conversations
  // ─────────────────────────────────────────────────────────────

  @Post('conversations')
  async createConversation(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateConversationDto,
  ) {
    const conversation = await this.conversations.createConversation({
      userId: user.id,
      ...dto,
    });
    return { conversation };
  }

  @Get('conversations')
  async listConversations(@CurrentUser() user: { id: string }) {
    const convs = await this.conversations.listConversations(user.id);
    return { conversations: convs };
  }

  @Get('conversations/:id')
  async getConversation(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    const conversation = await this.conversations.getConversation(id, user.id);
    if (!conversation) {
      return { error: 'Conversation not found', statusCode: HttpStatus.NOT_FOUND };
    }
    return { conversation };
  }

  @Delete('conversations/:id')
  async deleteConversation(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    const deleted = await this.conversations.deleteConversation(id, user.id);
    return { deleted };
  }

  @Get('preferences')
  async getPreferences(@CurrentUser() user: { id: string }) {
    const preferences = await this.prisma.aIUserPreference.findUnique({
      where: { userId: user.id },
    });
    return { preferences };
  }

  @Patch('preferences')
  async updatePreferences(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateAIPreferencesDto,
  ) {
    const data = {
      preferredModel: dto.preferredModel,
      preferredProvider: dto.preferredProvider,
      temperature: dto.temperature,
      maxTokens: dto.maxTokens,
      responseStyle: dto.responseStyle,
      responseLanguage: dto.responseLanguage,
      useEmoji: dto.useEmoji,
      enableStreaming: dto.enableStreaming,
      enableSuggestions: dto.enableSuggestions,
      enableContextMemory: dto.enableContextMemory,
      enableAutoSave: dto.enableAutoSave,
      saveConversations: dto.saveConversations,
      shareForTraining: dto.shareForTraining,
      anonymizeData: dto.anonymizeData,
    };
    const preferences = await this.prisma.aIUserPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
    });
    return { preferences };
  }

  // ─────────────────────────────────────────────────────────────
  // Async Job Queue (heavy generation)
  // ─────────────────────────────────────────────────────────────

  @Post('jobs')
  @UseGuards(AIRateLimitGuard)
  async enqueueJob(
    @CurrentUser() user: { id: string },
    @Body() body: EnqueueJobDto,
  ) {
    const startMs = Date.now();
    const jobId = await this.jobQueue.enqueueJob({ ...body, userId: user.id } as AIJobData);
    if (!jobId) {
      return {
        queued: false,
        message: 'Job queue is unavailable (Redis not configured). Use synchronous /ai/chat instead.',
      };
    }
    await this.logUsage({
      userId: user.id,
      agentId: body.agentId ?? (body.type === 'analyze-profile' ? 'matching' : 'general'),
      endpoint: '/ai/jobs',
      responseTimeMs: Date.now() - startMs,
      model: body.model ?? this.ollama.getDefaultModel(),
      success: true,
      isFallback: false,
    });
    return { queued: true, jobId };
  }

  @Get('jobs/:id')
  async getJobStatus(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    const status = await this.jobQueue.getJobStatus(id, user.id);
    if (!status) throw new NotFoundException(`AI job ${id} not found`);
    return status;
  }

  // ─────────────────────────────────────────────────────────────
  // Existing Endpoints
  // ─────────────────────────────────────────────────────────────

  @Post('profile-suggestions')
  async getProfileSuggestions(@CurrentUser() user: { id: string }) {
    const suggestions = await this.ai.getProfileSuggestions(user.id);
    return { suggestions };
  }

  @Post('meeting-notes/summarize')
  async summarizeMeetingNotes(@Body() body: { notes: string }) {
    const summary = await this.ai.summarizeMeetingNotes(body.notes ?? '');
    return { summary };
  }

  // ─────────────────────────────────────────────────────────────
  // Fallback Responses
  // ─────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────
  // Usage Logging (fire-and-forget)
  // ─────────────────────────────────────────────────────────────

  private async logUsage(params: {
    userId: string;
    agentId: string;
    endpoint: string;
    responseTimeMs: number;
    model: string;
    success: boolean;
    isFallback: boolean;
    isStreamed?: boolean;
  }): Promise<void> {
    try {
      const agentTypeMap: Record<string, string> = {
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
      };
      const agentType = (agentTypeMap[params.agentId] ?? 'general') as AIAgentType;

      await this.prisma.aIUsageLog.create({
        data: {
          userId: params.userId,
          agentType,
          endpoint: params.endpoint,
          method: 'POST',
          responseTimeMs: params.responseTimeMs,
          model: params.model,
          provider: 'ollama',
          isStreamed: params.isStreamed ?? false,
          success: params.success,
          isFallback: params.isFallback,
        },
      });
    } catch {
      // Logging is non-critical — never let it surface to the caller
    }
  }

  private getFallbackResponse(query: string, agentId?: string): string {
    const lower = query.toLowerCase();
    
    if (lower.includes('help') || lower.includes('what can you')) {
      return `I can help you with:
• **Finding co-founders** - Search and matching
• **Platform navigation** - How to use features
• **Mentorship** - Finding or becoming a mentor
• **Profile optimization** - Improve your visibility

What would you like to know more about?`;
    }

    if (lower.includes('cofounder') || lower.includes('co-founder') || lower.includes('find')) {
      return `To find a co-founder on CoFounderBay:

1. **Complete your profile** - Add skills, experience, and what you're looking for
2. **Browse matches** - Check personalized recommendations in the Matching section
3. **Use filters** - Search by skills, location, or startup stage
4. **Connect** - Send connection requests to promising matches
5. **Message** - Start conversations to explore compatibility`;
    }

    if (lower.includes('match') || lower.includes('algorithm')) {
      return `Our matching system analyzes multiple factors:

• **Skills compatibility** - Complementary technical and business skills
• **Goals alignment** - Similar startup stage and vision
• **Availability** - Time commitment preferences
• **Location** - Geographic proximity or remote preferences

Complete your profile fully to get the best match recommendations!`;
    }

    return `I'm here to help with CoFounderBay! I can answer questions about:

• Finding co-founders and mentors
• How matching works
• Profile optimization
• Platform features

*Note: AI service is currently limited. Full AI responses will be available when the service is running.*`;
  }
}
