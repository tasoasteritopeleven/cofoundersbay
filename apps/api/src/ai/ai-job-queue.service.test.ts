import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Job } from 'bullmq';
import { AIJobData, AIJobQueueService, AIJobResult } from './ai-job-queue.service';

function setup() {
  const queue = { getJob: vi.fn(), add: vi.fn().mockResolvedValue({ id: '42' }) };
  const conversations = { getConversation: vi.fn(), addMessage: vi.fn() };
  const ollama = { chat: vi.fn(), chatStream: vi.fn(), getDefaultModel: vi.fn() };
  const service = new AIJobQueueService({} as never, ollama as never, conversations as never);
  Object.assign(service, { queue });
  return { service, queue, conversations, ollama };
}

describe('AI job status ownership', () => {
  it.each(['completed', 'failed', 'active'])('does not disclose another user\'s %s job', async (state) => {
    const { service, queue } = setup();
    const job = {
      id: '42',
      data: { userId: 'owner' },
      getState: vi.fn().mockResolvedValue(state),
      progress: 75,
      returnvalue: { message: 'Private generated document' },
      failedReason: 'Private provider failure',
    };
    queue.getJob.mockResolvedValue(job);

    await expect(service.getJobStatus('42', 'other-user')).resolves.toBeNull();
    expect(job.getState).not.toHaveBeenCalled();
  });

  it('checks ownership before reading progress, results, or failures', async () => {
    const { service, queue } = setup();
    const disclose = vi.fn(() => { throw new Error('Private job fields were accessed'); });
    queue.getJob.mockResolvedValue({
      data: { userId: 'owner' },
      getState: disclose,
      get progress() { return disclose(); },
      get returnvalue() { return disclose(); },
      get failedReason() { return disclose(); },
    });
    await expect(service.getJobStatus('42', 'other-user')).resolves.toBeNull();
    expect(disclose).not.toHaveBeenCalled();
  });

  it.each(['waiting', 'active', 'completed', 'failed', 'delayed'])('preserves owner status for %s jobs', async (state) => {
    const { service, queue } = setup();
    const result = { message: 'Owner document', model: 'test', completedAt: '2026-01-01' };
    queue.getJob.mockResolvedValue({
      id: '42', data: { userId: 'owner' }, progress: 75,
      getState: vi.fn().mockResolvedValue(state), returnvalue: result, failedReason: 'Owner failure',
    });
    await expect(service.getJobStatus('42', 'owner')).resolves.toEqual({
      id: '42', state, progress: 75,
      result: state === 'completed' ? result : undefined,
      failedReason: state === 'failed' ? 'Owner failure' : undefined,
    });
  });

  it('preserves progress normalization', async () => {
    const { service, queue } = setup();
    queue.getJob.mockResolvedValue({
      id: '42', data: { userId: 'owner' }, progress: { step: 1 },
      getState: vi.fn().mockResolvedValue('waiting'),
    });
    await expect(service.getJobStatus('42', 'owner')).resolves.toMatchObject({ progress: 0 });
  });

  it.each([undefined, { data: {} }, { data: { userId: null } }])('returns null for absent jobs or absent owners', async (job) => {
    const { service, queue } = setup();
    queue.getJob.mockResolvedValue(job);
    await expect(service.getJobStatus('42', 'owner')).resolves.toBeNull();
  });

  it.each(['', 'jobs:42', '../42', ' ', 'a'.repeat(129), null, undefined, 42])('rejects unsafe job IDs before queue access: %s', async (id) => {
    const { service, queue } = setup();
    await expect(service.getJobStatus(id as string, 'owner')).resolves.toBeNull();
    expect(queue.getJob).not.toHaveBeenCalled();
  });

  it.each(['', undefined, null])('rejects polling without an owner', async (owner) => {
    const { service, queue } = setup();
    await expect(service.getJobStatus('42', owner as string)).resolves.toBeNull();
    expect(queue.getJob).not.toHaveBeenCalled();
  });

  it('returns null when the queue is disabled', async () => {
    const { service, queue } = setup();
    Object.assign(service, { queue: null });
    await expect(service.getJobStatus('42', 'owner')).resolves.toBeNull();
    expect(queue.getJob).not.toHaveBeenCalled();
  });
});

const documentJob = {
  type: 'generate-document' as const, userId: 'owner', agentId: 'general', prompt: 'Draft a pitch',
};

describe('AI job enqueue security for direct service callers', () => {
  it('rejects an unowned or missing conversation before queueing', async () => {
    const { service, queue, conversations, ollama } = setup();
    conversations.getConversation.mockResolvedValue(null);
    await expect(service.enqueueJob({ ...documentJob, conversationId: 'private-conversation' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(conversations.getConversation).toHaveBeenCalledWith('private-conversation', 'owner');
    expect(queue.add).not.toHaveBeenCalled();
    expect(ollama.chatStream).not.toHaveBeenCalled();
  });

  it('waits for conversation ownership before enqueueing', async () => {
    const { service, queue, conversations } = setup();
    let resolve!: (value: unknown) => void;
    conversations.getConversation.mockReturnValue(new Promise((done) => { resolve = done; }));
    const data = { ...documentJob, conversationId: 'owned-conversation' };
    const pending = service.enqueueJob(data);
    expect(queue.add).not.toHaveBeenCalled();
    resolve({ id: 'owned-conversation', userId: 'owner' });
    await expect(pending).resolves.toBe('42');
    expect(queue.add).toHaveBeenCalledWith('generate-document', data);
  });

  it('does not queue when the ownership lookup fails', async () => {
    const { service, queue, conversations } = setup();
    conversations.getConversation.mockRejectedValue(new Error('Lookup failed'));
    await expect(service.enqueueJob({ ...documentJob, conversationId: 'conversation' })).rejects.toThrow('Lookup failed');
    expect(queue.add).not.toHaveBeenCalled();
  });

  it.each([
    null,
    { ...documentJob, userId: '' },
    { ...documentJob, userId: undefined },
    { ...documentJob, type: 'unknown' },
    { ...documentJob, prompt: '' },
    { ...documentJob, prompt: 'x'.repeat(20_001) },
    { ...documentJob, prompt: 42 },
    { ...documentJob, unexpected: 'value' },
    { ...documentJob, targetUserId: 'cross-type' },
    { type: 'analyze-profile', userId: 'owner' },
  ])('rejects invalid direct input before queueing', async (data) => {
    const { service, queue, conversations } = setup();
    await expect(service.enqueueJob(data as AIJobData)).rejects.toBeInstanceOf(BadRequestException);
    expect(queue.add).not.toHaveBeenCalled();
    expect(conversations.getConversation).not.toHaveBeenCalled();
  });

  it.each([documentJob, { type: 'analyze-profile' as const, userId: 'owner', targetUserId: 'target' }])('preserves both job types without a conversation', async (data) => {
    const { service, queue, conversations, ollama } = setup();
    await expect(service.enqueueJob(data)).resolves.toBe('42');
    expect(queue.add).toHaveBeenCalledWith(data.type, data);
    expect(conversations.getConversation).not.toHaveBeenCalled();
    expect(ollama.chat).not.toHaveBeenCalled();
    expect(ollama.chatStream).not.toHaveBeenCalled();
  });

  it('preserves disabled-queue behavior for valid requests', async () => {
    const { service, queue } = setup();
    Object.assign(service, { queue: null });
    await expect(service.enqueueJob(documentJob)).resolves.toBeNull();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rechecks ownership before generation when a queued conversation is deleted', async () => {
    const { service, conversations, ollama } = setup();
    conversations.getConversation.mockResolvedValue(null);
    const worker = service as unknown as {
      processJob(job: Job<AIJobData, AIJobResult>): Promise<AIJobResult>;
    };
    const job = { data: { ...documentJob, conversationId: 'deleted-conversation' }, updateProgress: vi.fn() };
    await expect(worker.processJob(job as unknown as Job<AIJobData, AIJobResult>)).rejects.toBeInstanceOf(NotFoundException);
    expect(ollama.chatStream).not.toHaveBeenCalled();
    expect(conversations.addMessage).not.toHaveBeenCalled();
  });
});
