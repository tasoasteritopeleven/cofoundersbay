import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import { createHash } from 'node:crypto';
import { MailerService, type SendEmailParams } from './mailer.service';

export type EmailDeliveryStatus = 'disabled' | 'sent' | 'queued';

export type EnqueueEmailOptions = {
  /**
   * A non-secret, semantic identity for an email delivery. Only its SHA-256
   * digest is persisted as the BullMQ job id, so callers do not add user data
   * to queue metadata and retries remain idempotent while the job is retained.
   */
  idempotencyKey?: string;
};

function emailJobId(idempotencyKey: string): string {
  return `email-${createHash('sha256').update(idempotencyKey).digest('hex')}`;
}

@Injectable()
export class EmailQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailQueueService.name);
  private queue: Queue<SendEmailParams, void, 'sendEmail'> | null = null;
  private worker: Worker<SendEmailParams, void, 'sendEmail'> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly mailer: MailerService,
  ) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL');
    // Do not create a queue consumer that can acknowledge and discard jobs
    // while SMTP is unavailable. enqueueSendEmail has the same guard.
    if (!redisUrl || !this.mailer.isEnabled()) return;

    this.queue = new Queue<SendEmailParams, void, 'sendEmail'>('email', {
      connection: {
        url: redisUrl,
        maxRetriesPerRequest: null,
      },
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5_000 },
        // Email jobs contain the recipient and rendered body required for
        // delivery. Retain that PII for a bounded diagnostic window only.
        removeOnComplete: { age: 60 * 60 },
        removeOnFail: { age: 24 * 60 * 60 },
      },
    });

    this.worker = new Worker<SendEmailParams, void, 'sendEmail'>(
      'email',
      async (job) => {
        // This should only be reachable after an unexpected runtime config
        // change. Failing keeps the job retryable instead of falsely completing it.
        if (!this.mailer.isEnabled())
          throw new Error('Email delivery is disabled');
        await this.mailer.sendEmail(job.data);
      },
      {
        connection: {
          url: redisUrl,
          maxRetriesPerRequest: null,
        },
        concurrency: 5,
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Email job failed (${job?.id ?? 'unknown'}): ${err.message}`,
        err.stack,
      );
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  async enqueueSendEmail(
    params: SendEmailParams,
    options: EnqueueEmailOptions = {},
  ): Promise<EmailDeliveryStatus> {
    if (!this.mailer.isEnabled()) return 'disabled';

    if (!this.queue) {
      await this.mailer.sendEmail(params);
      return 'sent';
    }

    await this.queue.add('sendEmail', params, {
      jobId: options.idempotencyKey
        ? emailJobId(options.idempotencyKey)
        : undefined,
    });
    return 'queued';
  }
}
