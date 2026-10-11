import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AutomationService } from './automation.service';

const MINUTE_MS  = 60 * 1000;
const HOUR_MS    = 60 * MINUTE_MS;
const DAY_MS     = 24 * HOUR_MS;

@Injectable()
export class AutomationScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(AutomationScheduler.name);
  private readonly timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly automation: AutomationService,
  ) {}

  onApplicationBootstrap() {
    // Every minute: process due jobs
    this.timers.push(setInterval(() => this.runDueJobs(), MINUTE_MS));

    // Every hour: run daily checks (they self-gate by time-of-day)
    this.timers.push(setInterval(() => this.runDailyChecks(), HOUR_MS));

    this.logger.log('AutomationScheduler started (native intervals)');
  }

  onApplicationShutdown() {
    for (const t of this.timers) clearInterval(t);
    this.timers.length = 0;
    this.logger.log('AutomationScheduler stopped');
  }

  private async runDueJobs() {
    try {
      await this.automation.processDueJobs();
    } catch (err: any) {
      this.logger.error(`Error processing due jobs: ${err?.message}`);
    }
  }

  /**
   * Daily checks: fires once per hour, but each check only activates
   * in its designated UTC hour window (to approximate cron scheduling).
   */
  private async runDailyChecks() {
    const hour = new Date().getUTCHours();
    try {
      if (hour === 8)  await this.checkTrialEnding();
      if (hour === 9)  await this.checkIncompleteOnboarding();
      if (hour === 10) await this.checkInactiveUsers();
      if (hour === 11) await this.checkUnansweredConnections();
      if (hour === 12) await this.checkIdleMentorSessions();
    } catch (err: any) {
      this.logger.error(`Error in daily checks (hour ${hour}): ${err?.message}`);
    }
  }

  private async checkInactiveUsers() {
    const cutoff = new Date(Date.now() - 14 * DAY_MS);
    const users = await this.prisma.user.findMany({
      where: { lastSeenAt: { lt: cutoff }, moderationStatus: 'active' },
      select: { id: true },
      take: 200,
    });
    for (const u of users) {
      await this.automation.fire({ triggerType: 'user_inactive', targetUserId: u.id, payload: { daysInactive: 14 } });
    }
    if (users.length) this.logger.log(`Fired user_inactive for ${users.length} users`);
  }

  private async checkIncompleteOnboarding() {
    const cutoff = new Date(Date.now() - DAY_MS);
    const users = await this.prisma.user.findMany({
      where: { hasCompletedOnboarding: false, createdAt: { lt: cutoff }, moderationStatus: 'active' },
      select: { id: true },
      take: 200,
    });
    for (const u of users) {
      await this.automation.fire({ triggerType: 'onboarding_incomplete', targetUserId: u.id, payload: { reminder: true } });
    }
    if (users.length) this.logger.log(`Fired onboarding_incomplete for ${users.length} users`);
  }

  private async checkUnansweredConnections() {
    const cutoff = new Date(Date.now() - 3 * DAY_MS);
    const pending = await this.prisma.connectionRequest.findMany({
      where: { status: 'pending', createdAt: { lt: cutoff } },
      select: { id: true, receiverId: true },
      take: 200,
    });
    for (const c of pending) {
      await this.automation.fire({
        triggerType: 'connection_not_answered',
        targetUserId: c.receiverId,
        targetEntityType: 'connection',
        targetEntityId: c.id,
        payload: { daysPending: 3 },
      });
    }
    if (pending.length) this.logger.log(`Fired connection_not_answered for ${pending.length} connections`);
  }

  private async checkIdleMentorSessions() {
    const cutoff = new Date(Date.now() - 7 * DAY_MS);
    const sessions = await this.prisma.mentorBooking.findMany({
      where: { status: 'requested', createdAt: { lt: cutoff } },
      select: { id: true, mentorId: true },
      take: 100,
    });
    for (const s of sessions) {
      await this.automation.fire({
        triggerType: 'mentor_session_idle',
        targetUserId: s.mentorId,
        targetEntityType: 'mentor_booking',
        targetEntityId: s.id,
      });
    }
  }

  private async checkTrialEnding() {
    const now = new Date();
    const in3Days = new Date(Date.now() + 3 * DAY_MS);
    const subs = await this.prisma.subscription.findMany({
      where: { status: 'trialing', trialEnd: { gte: now, lte: in3Days } },
      select: { id: true, userId: true, tenantId: true },
      take: 200,
    });
    for (const sub of subs) {
      if (sub.userId) {
        await this.automation.fire({
          triggerType: 'subscription_trial_ending',
          targetUserId: sub.userId,
          targetEntityType: 'subscription',
          targetEntityId: sub.id,
          tenantId: sub.tenantId ?? undefined,
          payload: { daysRemaining: 3 },
        });
      }
    }
  }
}
