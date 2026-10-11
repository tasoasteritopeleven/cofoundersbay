import { beforeEach, describe, expect, it, vi } from 'vitest';

const bullMocks = vi.hoisted(() => ({
  queueConstructor: vi.fn(),
  workerConstructor: vi.fn(),
  queueInstance: null as unknown,
  workerInstance: null as unknown,
}));

vi.mock('bullmq', () => ({
  Queue: class MockQueue {
    constructor(...args: unknown[]) {
      bullMocks.queueConstructor(...args);
      return bullMocks.queueInstance as object;
    }
  },
  Worker: class MockWorker {
    constructor(...args: unknown[]) {
      bullMocks.workerConstructor(...args);
      return bullMocks.workerInstance as object;
    }
  },
}));

import { EmailQueueService } from './email-queue.service';

const email = {
  to: 'recipient@example.com',
  subject: 'A useful update',
  text: 'Hello',
};

describe('EmailQueueService', () => {
  let queue: { add: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
  let worker: { on: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    queue = { add: vi.fn().mockResolvedValue({ id: 'job-1' }), close: vi.fn() };
    worker = { on: vi.fn(), close: vi.fn() };
    bullMocks.queueInstance = queue;
    bullMocks.workerInstance = worker;
    bullMocks.queueConstructor.mockReset();
    bullMocks.workerConstructor.mockReset();
  });

  function makeService(options: { redis?: string; enabled?: boolean } = {}) {
    const mailer = {
      isEnabled: vi.fn().mockReturnValue(options.enabled ?? true),
      sendEmail: vi.fn().mockResolvedValue(undefined),
    };
    const config = {
      get: vi.fn((key: string) =>
        key === 'REDIS_URL' ? options.redis : undefined,
      ),
    };
    return {
      service: new EmailQueueService(config as never, mailer as never),
      mailer,
    };
  }

  it('does not start a queue or worker when SMTP is unavailable', () => {
    const { service } = makeService({
      redis: 'redis://localhost:6379',
      enabled: false,
    });
    service.onModuleInit();
    expect(bullMocks.queueConstructor).not.toHaveBeenCalled();
    expect(bullMocks.workerConstructor).not.toHaveBeenCalled();
  });

  it('uses temporal retention and fails rather than acknowledging if SMTP disappears', async () => {
    const { service, mailer } = makeService({
      redis: 'redis://localhost:6379',
    });
    service.onModuleInit();

    expect(bullMocks.queueConstructor).toHaveBeenCalledWith(
      'email',
      expect.objectContaining({
        defaultJobOptions: expect.objectContaining({
          removeOnComplete: { age: 60 * 60 },
          removeOnFail: { age: 24 * 60 * 60 },
        }),
      }),
    );
    const processor = bullMocks.workerConstructor.mock.calls[0][1] as (job: {
      data: typeof email;
    }) => Promise<void>;
    mailer.isEnabled.mockReturnValue(false);
    await expect(processor({ data: email })).rejects.toThrow(
      'Email delivery is disabled',
    );
    expect(mailer.sendEmail).not.toHaveBeenCalled();
  });

  it('returns explicit disabled, sent, and queued outcomes', async () => {
    const disabled = makeService({ enabled: false });
    await expect(disabled.service.enqueueSendEmail(email)).resolves.toBe(
      'disabled',
    );

    const direct = makeService();
    await expect(direct.service.enqueueSendEmail(email)).resolves.toBe('sent');
    expect(direct.mailer.sendEmail).toHaveBeenCalledWith(email);

    const queued = makeService({ redis: 'redis://localhost:6379' });
    queued.service.onModuleInit();
    await expect(queued.service.enqueueSendEmail(email)).resolves.toBe(
      'queued',
    );
  });

  it('derives a stable opaque job id without persisting the semantic key as metadata', async () => {
    const { service } = makeService({ redis: 'redis://localhost:6379' });
    service.onModuleInit();

    await service.enqueueSendEmail(email, {
      idempotencyKey: 'digest:daily:user-1:2026-10-03',
    });
    await service.enqueueSendEmail(email, {
      idempotencyKey: 'digest:daily:user-1:2026-10-03',
    });
    const firstOptions = queue.add.mock.calls[0][2];
    const secondOptions = queue.add.mock.calls[1][2];

    expect(firstOptions.jobId).toMatch(/^email-[a-f0-9]{64}$/);
    expect(firstOptions.jobId).toBe(secondOptions.jobId);
    expect(firstOptions.jobId).not.toContain('user-1');
    expect(queue.add.mock.calls[0][1]).toEqual(email);
  });
});
