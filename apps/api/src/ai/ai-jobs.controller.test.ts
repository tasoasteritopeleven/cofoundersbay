import 'reflect-metadata';
import { ExecutionContext, INestApplication, Module, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AIActionAuditService } from './ai-action-audit.service';
import { AIConversationService } from './ai-conversation.service';
import { AIJobQueueService } from './ai-job-queue.service';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { EnqueueJobDto } from './dto/enqueue-job.dto';
import { AIRateLimitGuard } from './guards/ai-rate-limit.guard';
import { OllamaService } from './ollama.service';

const queue = { getJob: vi.fn(), add: vi.fn() };
const conversations = { getConversation: vi.fn(), addMessage: vi.fn() };
const ollama = { getDefaultModel: vi.fn().mockReturnValue('test-model'), chat: vi.fn(), chatStream: vi.fn() };
const service = new AIJobQueueService({} as never, ollama as never, conversations as never);
const jobQueue = {
  enqueueJob: vi.fn((...args: Parameters<AIJobQueueService['enqueueJob']>) => service.enqueueJob(...args)),
  getJobStatus: vi.fn((...args: Parameters<AIJobQueueService['getJobStatus']>) => service.getJobStatus(...args)),
};
let usageCount = 0;
const prisma = {
  subscription: { findFirst: vi.fn().mockResolvedValue(null) },
  aIUsageLog: {
    count: vi.fn(async () => usageCount),
    create: vi.fn(async () => { usageCount++; return {}; }),
  },
};
const authGuard = {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const userId = request.headers['x-test-user'];
    if (!userId) throw new UnauthorizedException();
    request.user = { id: userId };
    return true;
  },
};

@Module({
  controllers: [AIController],
  providers: [
    { provide: AIService, useValue: {} },
    { provide: OllamaService, useValue: ollama },
    { provide: AIConversationService, useValue: conversations },
    { provide: AIJobQueueService, useValue: jobQueue },
    // AIController took a constructor dependency on the action audit service.
    // These tests cover the jobs routes and never reach it, so a stub keeps the
    // module resolvable without pretending to exercise it.
    { provide: AIActionAuditService, useValue: { record: vi.fn(), listForActor: vi.fn() } },
    { provide: PrismaService, useValue: prisma },
    { provide: JwtAuthGuard, useValue: authGuard },
    AIRateLimitGuard,
  ],
})
class JobsTestModule {}

describe('AI jobs decorated HTTP routes with mocked dependencies', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    app = await NestFactory.create(JobsTestModule, { logger: false });
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }));
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(JwtAuthGuard.prototype, 'canActivate').mockImplementation(async (context) => authGuard.canActivate(context));
    usageCount = 0;
    Object.assign(service, { queue });
    queue.add.mockResolvedValue({ id: '42' });
    queue.getJob.mockResolvedValue(undefined);
    conversations.getConversation.mockResolvedValue(null);
    prisma.aIUsageLog.create.mockImplementation(async () => { usageCount++; return {}; });
  });

  afterAll(async () => { await app?.close(); });

  async function request(path: string, body?: unknown, user = 'owner') {
    const response = await fetch(`${baseUrl}/ai/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(user ? { 'x-test-user': user } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }

  const document = { type: 'generate-document', agentId: 'general', prompt: 'Draft a pitch' };

  it('retains JWT protection and the enqueue quota guard, with real DTO metadata', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AIController)).toContain(JwtAuthGuard);
    expect(Reflect.getMetadata(GUARDS_METADATA, AIController.prototype.enqueueJob)).toContain(AIRateLimitGuard);
    expect(Reflect.getMetadata('design:paramtypes', AIController.prototype, 'enqueueJob')[1]).toBe(EnqueueJobDto);
    expect(Reflect.getMetadata('design:paramtypes', AIController)[3]).toBe(AIJobQueueService);
  });

  it('requires authentication for enqueue and polling', async () => {
    expect((await request('jobs', document, '')).status).toBe(401);
    expect((await request('jobs/42', undefined, '')).status).toBe(401);
    expect(queue.add).not.toHaveBeenCalled();
    expect(queue.getJob).not.toHaveBeenCalled();
  });

  it('returns the existing queue response and accounts admitted jobs toward the existing quota', async () => {
    expect(await request('jobs', document)).toEqual({ status: 201, body: { queued: true, jobId: '42' } });
    expect(queue.add).toHaveBeenCalledWith('generate-document', expect.objectContaining({ ...document, userId: 'owner' }));
    expect(prisma.aIUsageLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: 'owner', endpoint: '/ai/jobs', success: true, model: 'test-model',
    }) });
    expect(usageCount).toBe(1);
    expect(ollama.chat).not.toHaveBeenCalled();
    expect(ollama.chatStream).not.toHaveBeenCalled();
  });

  it('supports the analyze-profile job contract', async () => {
    expect((await request('jobs', { type: 'analyze-profile', targetUserId: 'target' })).body)
      .toEqual({ queued: true, jobId: '42' });
    expect(queue.add).toHaveBeenCalledWith('analyze-profile', expect.objectContaining({ targetUserId: 'target', userId: 'owner' }));
  });

  it.each([
    { ...document, userId: 'other-user' },
    { ...document, unknown: 'field' },
    { ...document, prompt: 123 },
    { ...document, prompt: 'x'.repeat(20_001) },
    { type: 'analyze-profile' },
    { type: 'analyze-profile', targetUserId: 'target', conversationId: 'private' },
  ])('rejects invalid HTTP bodies before enqueue', async (body) => {
    expect((await request('jobs', body)).status).toBe(400);
    expect(jobQueue.enqueueJob).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
    expect(prisma.aIUsageLog.create).not.toHaveBeenCalled();
  });

  it('does not let direct controller callers override the authenticated owner', async () => {
    await app.get(AIController).enqueueJob({ id: 'owner' }, { ...document, userId: 'attacker' } as EnqueueJobDto);
    expect(queue.add).toHaveBeenCalledWith('generate-document', expect.objectContaining({ userId: 'owner' }));
  });

  it('returns 404 for an inaccessible conversation before enqueue', async () => {
    expect((await request('jobs', { ...document, conversationId: 'private' })).status).toBe(404);
    expect(conversations.getConversation).toHaveBeenCalledWith('private', 'owner');
    expect(queue.add).not.toHaveBeenCalled();
    expect(prisma.aIUsageLog.create).not.toHaveBeenCalled();
  });

  it('returns an identical not-found response for another owner and a missing job', async () => {
    const job = { data: { userId: 'other-user' }, getState: vi.fn(), progress: 50 };
    queue.getJob.mockResolvedValueOnce(job);
    const inaccessible = await request('jobs/42');
    const missing = await request('jobs/42');
    expect(inaccessible.status).toBe(404);
    expect(inaccessible).toEqual(missing);
    expect(jobQueue.getJobStatus).toHaveBeenCalledWith('42', 'owner');
    expect(job.getState).not.toHaveBeenCalled();
  });

  it('preserves the owner polling response', async () => {
    const result = { message: 'Private result', model: 'test-model', completedAt: '2026-01-01' };
    queue.getJob.mockResolvedValue({
      id: '42', data: { userId: 'owner' }, getState: vi.fn().mockResolvedValue('completed'), progress: 100, returnvalue: result,
    });
    expect(await request('jobs/42')).toEqual({ status: 200, body: { id: '42', state: 'completed', progress: 100, result } });
  });

  it('rejects unsafe polling IDs without accessing the queue', async () => {
    expect((await request('jobs/jobs%3A42')).status).toBe(404);
    expect(queue.getJob).not.toHaveBeenCalled();
  });

  it('preserves queue-disabled response without recording admitted usage', async () => {
    Object.assign(service, { queue: null });
    expect(await request('jobs', document)).toEqual({
      status: 201,
      body: { queued: false, message: 'Job queue is unavailable (Redis not configured). Use synchronous /ai/chat instead.' },
    });
    expect(prisma.aIUsageLog.create).not.toHaveBeenCalled();
  });

  it('blocks enqueue at the existing free-tier quota without spending provider or queue resources', async () => {
    usageCount = 9;
    expect((await request('jobs', document)).status).toBe(201);
    expect((await request('jobs', document)).status).toBe(429);
    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(prisma.aIUsageLog.count).toHaveBeenCalledWith({ where: expect.objectContaining({ userId: 'owner', success: true }) });
    expect(ollama.chat).not.toHaveBeenCalled();
    expect(ollama.chatStream).not.toHaveBeenCalled();
  });
});
