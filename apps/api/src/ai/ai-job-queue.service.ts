import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { EnqueueJobDto } from './dto/enqueue-job.dto';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job } from 'bullmq';
import { OllamaService } from './ollama.service';
import { AIConversationService } from './ai-conversation.service';
import { getAgent } from './agents/base-agent';

// ─────────────────────────────────────────────────────────────────────────────
// Job data types
// ─────────────────────────────────────────────────────────────────────────────

export interface GenerateDocumentJobData {
  type: 'generate-document';
  userId: string;
  agentId: string;
  prompt: string;
  conversationId?: string;
  model?: string;
  featureUsed?: string;
}

export interface AnalyzeProfileJobData {
  type: 'analyze-profile';
  userId: string;
  targetUserId: string;
  agentId?: string;
}

export type AIJobData = GenerateDocumentJobData | AnalyzeProfileJobData;

export type AIJobType = AIJobData['type'];

export interface AIJobResult {
  message: string;
  model: string;
  fallback?: boolean;
  completedAt: string;
}

export interface AIJobStatus {
  id: string;
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'unknown';
  progress: number;
  result?: AIJobResult;
  failedReason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class AIJobQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AIJobQueueService.name);

  private queue: Queue<AIJobData, AIJobResult, AIJobType> | null = null;
  private worker: Worker<AIJobData, AIJobResult, AIJobType> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly ollama: OllamaService,
    private readonly conversations: AIConversationService,
  ) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn('REDIS_URL not configured — AI job queue is disabled');
      return;
    }

    const connection = { url: redisUrl, maxRetriesPerRequest: null as null };

    this.queue = new Queue<AIJobData, AIJobResult, AIJobType>('ai-jobs', {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 10_000 },
        // Keep completed jobs for 24 h, failed for 7 d (for client polling)
        removeOnComplete: { count: 500, age: 86_400 },
        removeOnFail: { count: 200, age: 7 * 86_400 },
      },
    });

    this.worker = new Worker<AIJobData, AIJobResult, AIJobType>(
      'ai-jobs',
      (job) => this.processJob(job),
      {
        connection,
        concurrency: 2, // At most 2 heavy jobs in parallel
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`AI job ${job.id} [${job.data.type}] completed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`AI job ${job?.id} [${job?.data?.type}] failed: ${err.message}`);
    });

    this.logger.log('AI job queue initialised');
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Returns the BullMQ job ID, or null when queue is disabled (no Redis). */
  async enqueueJob(data: AIJobData): Promise<string | null> {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new BadRequestException('Invalid AI job');
    }
    const { userId, ...request } = data;
    if (typeof userId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(userId)) {
      throw new BadRequestException('Invalid AI job owner');
    }
    const dto = plainToInstance(EnqueueJobDto, request);
    if (validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length) {
      throw new BadRequestException('Invalid AI job');
    }
    if (!this.queue) return null;
    if (data.type === 'generate-document' && data.conversationId) {
      const conversation = await this.conversations.getConversation(data.conversationId, userId);
      if (!conversation) throw new NotFoundException('Conversation not found');
    }
    const job = await this.queue.add(data.type, data);
    return job.id ?? null;
  }

  /** Polls status of an enqueued job. Returns null if jobId not found. */
  async getJobStatus(jobId: string, userId: string): Promise<AIJobStatus | null> {
    if (typeof jobId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(jobId)) return null;
    if (typeof userId !== 'string' || !userId) return null;
    if (!this.queue) return null;
    const job = await this.queue.getJob(jobId);
    if (!job || job.data?.userId !== userId) return null;

    const raw = await job.getState();
    const state = raw as AIJobStatus['state'];

    return {
      id: job.id!,
      state,
      progress: typeof job.progress === 'number' ? job.progress : 0,
      result: state === 'completed' ? (job.returnvalue as AIJobResult) : undefined,
      failedReason: state === 'failed' ? job.failedReason : undefined,
    };
  }

  // ── Processing ──────────────────────────────────────────────────────────────

  private processJob(job: Job<AIJobData, AIJobResult, AIJobType>): Promise<AIJobResult> {
    switch (job.data.type) {
      case 'generate-document':
        return this.processGenerateDocument(job as Job<GenerateDocumentJobData, AIJobResult>);
      case 'analyze-profile':
        return this.processAnalyzeProfile(job as Job<AnalyzeProfileJobData, AIJobResult>);
      default:
        return Promise.reject(new Error(`Unknown AI job type`));
    }
  }

  private async processGenerateDocument(
    job: Job<GenerateDocumentJobData, AIJobResult>,
  ): Promise<AIJobResult> {
    const { agentId, prompt, userId, conversationId, model } = job.data;
    if (conversationId) {
      const conversation = await this.conversations.getConversation(conversationId, userId);
      if (!conversation) throw new NotFoundException('Conversation not found');
    }
    const agent = getAgent(agentId ?? 'general');
    const messages = agent.buildMessages(prompt, [], { userId });

    await job.updateProgress(5);

    try {
      let fullText = '';
      let chunkCount = 0;

      for await (const chunk of this.ollama.chatStream(messages, {
        model,
        temperature: agent.config.temperature,
        maxTokens: agent.config.maxTokens,
      })) {
        fullText += chunk;
        chunkCount++;
        // Report progress proportional to text length (rough heuristic: 2000 chars ≈ full response)
        if (chunkCount % 5 === 0) {
          await job.updateProgress(Math.min(90, 5 + Math.floor((fullText.length / 2000) * 85)));
        }
      }

      if (conversationId) {
        await this.conversations.addMessage(conversationId, userId, {
          role: 'user',
          content: prompt,
        });
        await this.conversations.addMessage(conversationId, userId, {
          role: 'assistant',
          content: fullText,
          model: model ?? this.ollama.getDefaultModel(),
        });
      }

      await job.updateProgress(100);
      return {
        message: fullText,
        model: model ?? this.ollama.getDefaultModel(),
        completedAt: new Date().toISOString(),
      };
    } catch {
      return {
        message:
          'Document generation is currently unavailable. Please try again shortly or contact support.',
        model: 'fallback',
        fallback: true,
        completedAt: new Date().toISOString(),
      };
    }
  }

  private async processAnalyzeProfile(
    job: Job<AnalyzeProfileJobData, AIJobResult>,
  ): Promise<AIJobResult> {
    const { userId, targetUserId, agentId } = job.data;
    const agent = getAgent(agentId ?? 'matching');
    await job.updateProgress(10);

    try {
      const prompt = `Provide a detailed collaboration compatibility analysis between the current user and profile ${targetUserId}. Cover working dynamics, complementary strengths, potential friction points, and a compatibility score.`;
      const messages = agent.buildMessages(prompt, [], { userId });

      const result = await this.ollama.chat(messages, {
        temperature: agent.config.temperature,
        maxTokens: agent.config.maxTokens,
      });

      await job.updateProgress(100);
      return {
        message: result,
        model: this.ollama.getDefaultModel(),
        completedAt: new Date().toISOString(),
      };
    } catch {
      return {
        message: 'Profile analysis is currently unavailable. Please try again shortly.',
        model: 'fallback',
        fallback: true,
        completedAt: new Date().toISOString(),
      };
    }
  }
}
