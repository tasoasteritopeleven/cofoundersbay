import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NotificationType } from '@prisma/client';
import { EmailQueueService } from '../mailer/email-queue.service';
import { PrismaService } from '../prisma/prisma.service';

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly emailQueue: EmailQueueService,
  ) {}

  private webBaseUrl(): string {
    return this.config.get<string>('WEB_BASE_URL') ?? 'http://localhost:3000';
  }

  async createNotification(params: {
    userId: string;
    type: NotificationType;
    title: string;
    body?: string | null;
    link?: string | null;
    meta?: unknown;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body ?? null,
        link: params.link ?? null,
        meta: params.meta as any,
      },
    });
  }

  async notifyNewMessage(params: {
    recipientUserId: string;
    recipientEmail?: string | null;
    fromDisplayName: string;
    conversationId: string;
    messageBody: string;
    messageId: string;
  }) {
    const link = `/messages?c=${encodeURIComponent(params.conversationId)}`;

    const notification = await this.createNotification({
      userId: params.recipientUserId,
      type: 'message',
      title: `New message from ${params.fromDisplayName}`,
      body: truncate(params.messageBody, 160),
      link,
      meta: {
        conversationId: params.conversationId,
        messageId: params.messageId,
      },
    });

    const to = params.recipientEmail?.trim();
    if (to) {
      const url = `${this.webBaseUrl()}${link}`;
      await this.emailQueue.enqueueSendEmail({
        to,
        subject: `New message from ${params.fromDisplayName}`,
        text: `${truncate(params.messageBody, 400)}\n\nOpen: ${url}`,
        html: `
          <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.6">
            <h2 style="margin: 0 0 12px 0; font-size: 18px;">New message from ${escapeHtml(
              params.fromDisplayName,
            )}</h2>
            <p style="margin: 0 0 16px 0; color: #333">${escapeHtml(truncate(params.messageBody, 400))}</p>
            <p style="margin: 0">
              <a href="${url}" style="display: inline-block; padding: 10px 14px; background: #111827; color: #fff; text-decoration: none; border-radius: 10px;">
                Open conversation
              </a>
            </p>
          </div>
        `.trim(),
      });
    }

    return { notification };
  }
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

