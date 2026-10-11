import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailQueueService } from '../mailer/email-queue.service';
import { PrismaService } from '../prisma/prisma.service';

export type DigestType = 'daily' | 'weekly' | 'monthly';
export type DigestContentType =
  | 'connections'
  | 'messages'
  | 'opportunities'
  | 'events'
  | 'updates'
  | 'searches';

/**
 * Section headings for the sections whose generic "N New <Type>" would read
 * wrongly. `updates` are founder updates from people the reader follows;
 * `searches` are saved searches (people or need cards) with results the
 * reader has not seen, governed by the `opportunities` preference.
 */
const SECTION_TITLES: Partial<Record<DigestContentType, (count: number) => string>> = {
  updates: (n) => (n === 1 ? '1 update from a founder you follow' : `${n} updates from founders you follow`),
  searches: (n) => (n === 1 ? '1 saved search found something new' : `${n} saved searches found something new`),
};

function sectionTitle(type: string, count: number): string {
  const custom = SECTION_TITLES[type as DigestContentType];
  return custom ? custom(count) : `${count} New ${type.charAt(0).toUpperCase() + type.slice(1)}`;
}

interface DigestContent {
  type: DigestContentType;
  count: number;
  items: Array<{
    id: string;
    title: string;
    description?: string;
    url?: string;
    createdAt: Date;
  }>;
}

interface DigestData {
  userId: string;
  type: DigestType;
  frequency: DigestType;
  content: Partial<Record<DigestContentType, DigestContent>>;
  preferences: {
    connections: boolean;
    messages: boolean;
    opportunities: boolean;
    events: boolean;
    updates: boolean;
  };
}

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function shiftCalendarPeriod(
  date: Date,
  type: DigestType,
  direction: -1 | 1,
): Date {
  const shifted = new Date(date);
  if (type === 'daily') {
    shifted.setUTCDate(shifted.getUTCDate() + direction);
    return shifted;
  }
  if (type === 'weekly') {
    shifted.setUTCDate(shifted.getUTCDate() + 7 * direction);
    return shifted;
  }

  const sourceYear = shifted.getUTCFullYear();
  const sourceMonth = shifted.getUTCMonth();
  const sourceDay = shifted.getUTCDate();
  const sourceIsMonthEnd =
    sourceDay === daysInUtcMonth(sourceYear, sourceMonth);
  const targetMonthIndex = sourceMonth + direction;
  const targetYear = sourceYear + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const targetLastDay = daysInUtcMonth(targetYear, targetMonth);

  // Set day to one before changing month to prevent JavaScript's implicit
  // overflow (for example March 31 -> March 3 instead of February 28).
  shifted.setUTCDate(1);
  shifted.setUTCFullYear(
    targetYear,
    targetMonth,
    sourceIsMonthEnd ? targetLastDay : Math.min(sourceDay, targetLastDay),
  );
  return shifted;
}

export function digestPeriodStart(type: DigestType, now: Date): Date {
  return shiftCalendarPeriod(now, type, -1);
}

export function nextDigestDueAt(type: DigestType, lastSentAt: Date): Date {
  return shiftCalendarPeriod(lastSentAt, type, 1);
}

export function isDigestDue(
  type: DigestType,
  lastSentAt: Date | null,
  now: Date,
): boolean {
  return (
    !lastSentAt || nextDigestDueAt(type, lastSentAt).getTime() <= now.getTime()
  );
}

function cadenceBucketKey(type: DigestType, now: Date): string {
  const bucket = new Date(now);
  bucket.setUTCHours(0, 0, 0, 0);
  if (type === 'weekly') {
    const daysSinceMonday = (bucket.getUTCDay() + 6) % 7;
    bucket.setUTCDate(bucket.getUTCDate() - daysSinceMonday);
  } else if (type === 'monthly') {
    bucket.setUTCDate(1);
  }
  return bucket.toISOString();
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

@Injectable()
export class EmailDigestService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailDigestService.name);
  private digestJobs: Map<string, NodeJS.Timeout> = new Map();
  private readonly inFlightPreferences = new Set<string>();

  constructor(
    private readonly config: ConfigService,
    private readonly emailQueue: EmailQueueService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.logger.log('Email Digest Service initialized');
  }

  onModuleDestroy() {
    // Clear all scheduled jobs
    this.digestJobs.forEach((job) => clearTimeout(job));
    this.digestJobs.clear();
  }

  // Note: Cron jobs should be set up using a proper scheduler like @nestjs/schedule
  // For now, these methods can be called manually or via external scheduler

  async sendDailyDigests() {
    this.logger.log('Starting daily digest generation');
    await this.generateDigests('daily');
  }

  async sendWeeklyDigests() {
    this.logger.log('Starting weekly digest generation');
    await this.generateDigests('weekly');
  }

  async sendMonthlyDigests() {
    this.logger.log('Starting monthly digest generation');
    await this.generateDigests('monthly');
  }

  async generateDigests(type: DigestType) {
    const now = new Date();
    const preferences = await this.prisma.activityDigestPreference.findMany({
      where: {
        frequency: type,
        user: {
          email: { not: { equals: '' } },
          emailVerified: true,
          moderationStatus: 'active',
        },
      },
      select: { id: true, userId: true, lastSentAt: true },
      orderBy: { userId: 'asc' },
    });
    const summary = {
      eligible: preferences.length,
      sent: 0,
      queued: 0,
      disabled: 0,
      empty: 0,
      skipped: 0,
      failed: 0,
    };
    this.logger.log(
      `Generating ${type} digests for ${preferences.length} opted-in users`,
    );

    for (const preference of preferences) {
      if (!isDigestDue(type, preference.lastSentAt, now)) {
        summary.skipped += 1;
        continue;
      }

      // This reservation prevents duplicate work inside one process without
      // overloading lastSentAt with an untrue "sent" state. BullMQ's stable job
      // id provides cross-process deduplication when the queue is configured.
      if (this.inFlightPreferences.has(preference.id)) {
        summary.skipped += 1;
        continue;
      }
      this.inFlightPreferences.add(preference.id);

      try {
        const since = preference.lastSentAt ?? digestPeriodStart(type, now);
        const digestData = await this.generateUserDigest(
          preference.userId,
          type,
          { since },
        );
        if (!digestData) {
          summary.empty += 1;
          continue;
        }
        const deliveryWindow =
          preference.lastSentAt?.toISOString() ?? cadenceBucketKey(type, now);
        const idempotencyKey = `digest:${type}:${preference.userId}:${deliveryWindow}`;
        const delivery = await this.sendDigestEmail(digestData, idempotencyKey);
        if (delivery === 'ineligible') {
          summary.skipped += 1;
          continue;
        }
        if (delivery === 'disabled') {
          summary.disabled += 1;
          continue;
        }

        // Record delivery only after SMTP accepted the message or BullMQ
        // durably accepted the deterministic job. A failed conditional update
        // does not undo an already accepted delivery, but avoids overwriting a
        // concurrent preference change.
        await this.prisma.activityDigestPreference.updateMany({
          where: {
            id: preference.id,
            frequency: type,
            lastSentAt: preference.lastSentAt,
          },
          data: { lastSentAt: new Date() },
        });
        summary[delivery] += 1;
      } catch (error) {
        summary.failed += 1;
        this.logger.error(
          `Failed to generate digest for user ${preference.userId}`,
          error,
        );
      } finally {
        this.inFlightPreferences.delete(preference.id);
      }
    }
    this.logger.log(
      `Completed ${type} digest generation: ${JSON.stringify(summary)}`,
    );
    return summary;
  }

  async generateUserDigest(
    userId: string,
    type: DigestType,
    options: { ignoreFrequency?: boolean; since?: Date } = {},
  ): Promise<DigestData | null> {
    const now = new Date();
    const startDate = options.since ?? digestPeriodStart(type, now);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        emailVerified: true,
        moderationStatus: true,
        digestPreference: { select: { frequency: true } },
        notificationChannels: {
          where: {
            channel: 'email',
            category: {
              in: [
                'connections',
                'messages',
                'opportunities',
                'events',
                'updates',
              ],
            },
          },
          select: { category: true, isEnabled: true },
        },
      },
    });

    if (!user || !user.emailVerified || user.moderationStatus !== 'active')
      return null;
    if (!options.ignoreFrequency && user.digestPreference?.frequency !== type)
      return null;

    const digestPrefs = {
      connections: true,
      messages: true,
      opportunities: true,
      events: true,
      // Founder updates from people the reader chose to follow: a source they
      // asked for, so on unless they turned the category off.
      updates: true,
    };
    for (const channel of user.notificationChannels) {
      if (channel.category in digestPrefs) {
        digestPrefs[channel.category as keyof typeof digestPrefs] = channel.isEnabled;
      }
    }

    // Generate content for each type
    const content: Record<DigestContentType, DigestContent | undefined> = {
      connections: undefined,
      messages: undefined,
      opportunities: undefined,
      events: undefined,
      updates: undefined,
      searches: undefined,
    };

    if (digestPrefs.connections) {
      const connectionsData = await this.getConnectionsDigest(
        userId,
        startDate,
      );
      if (connectionsData) content.connections = connectionsData;
    }
    if (digestPrefs.messages) {
      const messagesData = await this.getMessagesDigest(userId, startDate);
      if (messagesData) content.messages = messagesData;
    }
    if (digestPrefs.opportunities) {
      const opportunitiesData = await this.getOpportunitiesDigest(
        userId,
        startDate,
      );
      if (opportunitiesData) content.opportunities = opportunitiesData;
    }
    if (digestPrefs.events) {
      const eventsData = await this.getEventsDigest(userId, startDate);
      if (eventsData) content.events = eventsData;
    }
    if (digestPrefs.updates) {
      const updatesData = await this.getUpdatesDigest(userId, startDate);
      if (updatesData) content.updates = updatesData;
    }
    if (digestPrefs.opportunities) {
      const searchesData = await this.getSavedSearchesDigest(userId);
      if (searchesData) content.searches = searchesData;
    }

    // Return null if no content
    if (!Object.values(content).some((section) => section && section.count > 0))
      return null;

    return {
      userId,
      type,
      frequency: type,
      content,
      preferences: {
        connections: digestPrefs.connections || false,
        messages: digestPrefs.messages || false,
        opportunities: digestPrefs.opportunities || false,
        events: digestPrefs.events || false,
        updates: digestPrefs.updates || false,
      },
    };
  }

  private async getConnectionsDigest(
    userId: string,
    since: Date,
  ): Promise<DigestContent | null> {
    const connections = await this.prisma.connectionRequest.findMany({
      where: {
        OR: [{ requesterId: userId }, { receiverId: userId }],
        status: 'accepted',
        updatedAt: { gte: since },
      },
      include: {
        requester: {
          select: { id: true, profile: { select: { displayName: true } } },
        },
        receiver: {
          select: { id: true, profile: { select: { displayName: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    if (connections.length === 0) return null;

    return {
      type: 'connections',
      count: connections.length,
      items: connections.map((conn: any) => {
        const otherUser =
          conn.requesterId === userId ? conn.receiver : conn.requester;
        const name = otherUser.profile?.displayName || 'a connection';
        return {
          id: conn.id,
          title: `New connection with ${name}`,
          description: 'You connected with this person',
          url: `/connections`,
          createdAt: conn.updatedAt,
        };
      }),
    };
  }

  private async getMessagesDigest(
    userId: string,
    since: Date,
  ): Promise<DigestContent | null> {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId, isArchived: false, isMuted: false },
        },
        messages: {
          some: {
            createdAt: { gte: since },
            senderId: { not: userId },
            deletedAt: null,
          },
        },
      },
      include: {
        messages: {
          where: {
            createdAt: { gte: since },
            senderId: { not: userId },
            deletedAt: null,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            sender: { select: { profile: { select: { displayName: true } } } },
          },
        },
      },
      take: 10,
    });

    if (conversations.length === 0) return null;

    return {
      type: 'messages',
      count: conversations.length,
      items: conversations.map((conv: any) => {
        const latestMessage = conv.messages[0];
        return {
          id: conv.id,
          // In group conversations the first participant is not necessarily
          // the author. Attribute the preview to the actual latest sender.
          title: `Messages from ${latestMessage?.sender?.profile?.displayName || 'a connection'}`,
          description: latestMessage?.body?.substring(0, 100) || 'New messages',
          url: '/messages',
          createdAt: latestMessage?.createdAt || conv.updatedAt,
        };
      }),
    };
  }

  private async getOpportunitiesDigest(
    userId: string,
    since: Date,
  ): Promise<DigestContent | null> {
    const opportunities = await this.prisma.opportunity.findMany({
      where: {
        createdAt: { gte: since },
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (opportunities.length === 0) return null;

    return {
      type: 'opportunities',
      count: opportunities.length,
      items: opportunities.map((opp: any) => ({
        id: opp.id,
        title: opp.title,
        description:
          opp.description?.substring(0, 100) || 'New opportunity available',
        url: '/opportunities',
        createdAt: opp.createdAt,
      })),
    };
  }

  private async getEventsDigest(
    userId: string,
    since: Date,
  ): Promise<DigestContent | null> {
    const now = new Date();
    const windowMs = Math.max(
      24 * 60 * 60 * 1000,
      now.getTime() - since.getTime(),
    );
    const until = new Date(now.getTime() + windowMs);
    const events = await this.prisma.event.findMany({
      where: {
        startAt: { gte: now, lte: until },
      },
      orderBy: { startAt: 'asc' },
      take: 10,
    });

    if (events.length === 0) return null;

    return {
      type: 'events',
      count: events.length,
      items: events.map((event: any) => ({
        id: event.id,
        title: event.title,
        description: event.description?.substring(0, 100) || 'Upcoming event',
        url: `/events/${event.id}`,
        createdAt: event.createdAt,
      })),
    };
  }

  /**
   * Founder updates from the people this reader follows, published in the
   * period, to followers or publicly. Platform announcements still have no
   * persisted source and are not claimed here. A database without the
   * schema-only follow tables yields no section, not an error.
   */
  private async getUpdatesDigest(
    userId: string,
    since: Date,
  ): Promise<DigestContent | null> {
    try {
      const follows = (await this.prisma.userFollow.findMany({
        where: { followerId: userId },
        select: { followingId: true },
        take: 500,
      })) as Array<{ followingId: string }>;
      if (!follows.length) return null;
      const updates = (await this.prisma.founderUpdate.findMany({
        where: { authorId: { in: follows.map((f) => f.followingId) }, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, title: true, body: true, createdAt: true, author: { select: { profile: { select: { displayName: true } } } } },
      })) as Array<{ id: string; title: string; body: string; createdAt: Date; author?: { profile?: { displayName?: string | null } | null } | null }>;
      if (!updates.length) return null;
      return {
        type: 'updates',
        count: updates.length,
        items: updates.map((u) => ({
          id: u.id,
          title: `${u.author?.profile?.displayName ?? 'A founder you follow'}: ${u.title}`,
          description: u.body.substring(0, 100),
          url: `/updates?update=${encodeURIComponent(u.id)}`,
          createdAt: u.createdAt,
        })),
      };
    } catch {
      return null;
    }
  }

  /**
   * Saved searches (people or need cards) whose alerts found results the
   * reader has not opened yet: the count the "N new" badge shows on
   * /saved-searches. Names and counts only; the results are on the site.
   */
  private async getSavedSearchesDigest(userId: string): Promise<DigestContent | null> {
    try {
      const rows = (await this.prisma.savedSearch.findMany({
        where: { userId, pendingNewCount: { gt: 0 } },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: { id: true, name: true, searchType: true, pendingNewCount: true, updatedAt: true },
      })) as Array<{ id: string; name: string; searchType: string; pendingNewCount: number; updatedAt: Date }>;
      if (!rows.length) return null;
      return {
        type: 'searches',
        count: rows.length,
        items: rows.map((r) => {
          const cards = r.searchType === 'opportunity';
          const what = cards ? (r.pendingNewCount === 1 ? 'new need card' : 'new need cards') : r.pendingNewCount === 1 ? 'new profile' : 'new profiles';
          return { id: r.id, title: r.name, description: `${r.pendingNewCount} ${what}`, url: '/saved-searches', createdAt: r.updatedAt };
        }),
      };
    } catch {
      return null;
    }
  }

  private webBaseUrl(): string {
    const configured =
      this.config.get<string>('WEB_BASE_URL') ??
      this.config.get<string>('FRONTEND_URL') ??
      'http://localhost:3000';
    const url = new URL(configured);
    if (!['http:', 'https:'].includes(url.protocol))
      throw new Error('WEB_BASE_URL must use HTTP or HTTPS');
    return url.origin;
  }

  private absoluteUrl(path: string): string {
    return new URL(
      path.startsWith('/') ? path : `/${path}`,
      `${this.webBaseUrl()}/`,
    ).toString();
  }

  private async currentRecipient(
    userId: string,
    type: DigestType,
    ignoreFrequency = false,
  ): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        emailVerified: true,
        moderationStatus: true,
        digestPreference: { select: { frequency: true } },
      },
    });
    if (
      !user?.email ||
      !user.emailVerified ||
      user.moderationStatus !== 'active'
    )
      return null;
    if (!ignoreFrequency && user.digestPreference?.frequency !== type)
      return null;
    return user.email;
  }

  private async sendDigestEmail(
    digestData: DigestData,
    idempotencyKey: string,
    ignoreFrequency = false,
  ): Promise<'disabled' | 'sent' | 'queued' | 'ineligible'> {
    // Re-read the address and eligibility immediately before enqueueing. This
    // avoids sending to a stale address or to an account that was suspended,
    // unverified, or opted out while content was being assembled.
    const recipient = await this.currentRecipient(
      digestData.userId,
      digestData.type,
      ignoreFrequency,
    );
    if (!recipient) return 'ineligible';
    const subject = `Your ${digestData.type} CoFounderBay Digest`;

    // Generate HTML content
    const html = this.generateDigestHTML(digestData);

    // Generate text content
    const text = this.generateDigestText(digestData);

    const delivery = await this.emailQueue.enqueueSendEmail(
      {
        to: recipient,
        subject,
        html,
        text,
      },
      {
        idempotencyKey,
      },
    );
    if (delivery !== 'disabled') {
      this.logger.log(
        `${delivery === 'queued' ? 'Queued' : 'Sent'} ${digestData.type} digest for user ${digestData.userId}`,
      );
    }
    return delivery;
  }

  private generateDigestHTML(data: DigestData): string {
    const typeTitle = data.type.charAt(0).toUpperCase() + data.type.slice(1);

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>CoFounderBay ${typeTitle} Digest</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6756dc; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px 0; }
          .section { margin-bottom: 30px; }
          .section-title { color: #6756dc; font-size: 18px; font-weight: bold; margin-bottom: 10px; }
          .item { border-left: 3px solid #e5e7eb; padding-left: 15px; margin-bottom: 15px; }
          .item-title { font-weight: bold; margin-bottom: 5px; }
          .item-description { color: #666; font-size: 14px; margin-bottom: 5px; }
          .item-time { color: #999; font-size: 12px; }
          .footer { border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center; color: #666; font-size: 12px; }
          .btn { display: inline-block; background: #6756dc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>CoFounderBay ${typeTitle} Digest</h1>
            <p>Your personalized summary of the past ${data.type}</p>
          </div>
          
          <div class="content">
    `;

    // Add content sections
    Object.entries(data.content).forEach(([type, content]) => {
      if (content && content.count > 0) {
        html += `
          <div class="section">
            <div class="section-title">${escapeHtml(sectionTitle(type, content.count))}</div>
        `;

        content.items.forEach((item) => {
          html += `
            <div class="item">
              <div class="item-title">${escapeHtml(item.title)}</div>
              ${item.description ? `<div class="item-description">${escapeHtml(item.description)}</div>` : ''}
              <div class="item-time">${escapeHtml(item.createdAt.toLocaleDateString('en-GB', { timeZone: 'UTC' }))}</div>
              ${item.url ? `<a href="${escapeHtml(this.absoluteUrl(item.url))}" class="btn">View</a>` : ''}
            </div>
          `;
        });

        html += '</div>';
      }
    });

    html += `
          </div>
          
          <div class="footer">
            <p>You're receiving this because you subscribed to CoFounderBay digests.</p>
            <p><a href="${escapeHtml(this.absoluteUrl('/settings/notifications'))}">Manage your preferences</a> | <a href="${escapeHtml(this.absoluteUrl('/settings/notifications?digest=never'))}">Unsubscribe</a></p>
          </div>
        </div>
      </body>
      </html>
    `;

    return html;
  }

  private generateDigestText(data: DigestData): string {
    const typeTitle = data.type.charAt(0).toUpperCase() + data.type.slice(1);

    let text = `CoFounderBay ${typeTitle} Digest\n\n`;
    text += `Your personalized summary of the past ${data.type}\n\n`;

    Object.entries(data.content).forEach(([type, content]) => {
      if (content && content.count > 0) {
        text += `${sectionTitle(type, content.count)}\n`;
        text += '─'.repeat(30) + '\n';

        content.items.forEach((item) => {
          text += `• ${item.title}\n`;
          if (item.description) {
            text += `  ${item.description}\n`;
          }
          if (item.url) {
            text += `  View: ${this.absoluteUrl(item.url)}\n`;
          }
          text += '\n';
        });

        text += '\n';
      }
    });

    text += '─'.repeat(50) + '\n';
    text +=
      "You're receiving this because you subscribed to CoFounderBay digests.\n";
    text += `Manage preferences: ${this.absoluteUrl('/settings/notifications')}\n`;
    text += `Unsubscribe: ${this.absoluteUrl('/settings/notifications?digest=never')}\n`;

    return text;
  }

  // Manual trigger for testing
  async sendTestDigest(userId: string, type: DigestType = 'daily') {
    const digestData = await this.generateUserDigest(userId, type, {
      ignoreFrequency: true,
    });
    if (!digestData) {
      throw new Error('No digest content available');
    }

    const delivery = await this.sendDigestEmail(
      digestData,
      `test-digest:${type}:${userId}:${Date.now()}`,
      true,
    );
    if (delivery === 'ineligible')
      throw new Error('User is not eligible for email delivery');
    if (delivery === 'disabled') throw new Error('Email delivery is disabled');
    this.logger.log(`Test ${type} digest ${delivery} for user ${userId}`);
  }
}
