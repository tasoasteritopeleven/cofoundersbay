import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailerService } from '../mailer/mailer.service';
import { MatchingService } from '../matching/matching.service';
import { sendSafeWebhook } from './safe-webhook';

export interface TriggerContext {
  triggerType: string;
  targetUserId?: string;
  targetEntityType?: string;
  targetEntityId?: string;
  tenantId?: string;
  payload?: Record<string, unknown>;
}

type ConditionDef = { field: string; operator: string; value: unknown }[];
type ActionDef = { type: string; params: Record<string, unknown> };

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mailer: MailerService,
    private readonly matching: MatchingService,
  ) {}

  // ── Rule CRUD ──────────────────────────────────────────────────────────────

  async listRules(params: { tenantId?: string | null; status?: string; limit?: number; offset?: number }) {
    const where: any = {};
    if (params.tenantId !== undefined) where.tenantId = params.tenantId;
    if (params.status) where.status = params.status;

    const [rules, total] = await Promise.all([
      this.prisma.automationRule.findMany({
        where,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        take: params.limit ?? 50,
        skip: params.offset ?? 0,
        include: { _count: { select: { executions: true } } },
      }),
      this.prisma.automationRule.count({ where }),
    ]);
    return { rules, total };
  }

  async getRule(id: string) {
    return this.prisma.automationRule.findUniqueOrThrow({ where: { id } });
  }

  async createRule(data: {
    name: string;
    description?: string;
    triggerType: string;
    conditionDef?: unknown;
    actionDef: unknown;
    delaySeconds?: number;
    scheduleExpression?: string;
    priority?: number;
    tenantId?: string;
    createdBy?: string;
  }) {
    return this.prisma.automationRule.create({
      data: {
        name: data.name,
        description: data.description,
        triggerType: data.triggerType as any,
        conditionDef: (data.conditionDef ?? null) as any,
        actionDef: data.actionDef as any,
        delaySeconds: data.delaySeconds ?? 0,
        scheduleExpression: data.scheduleExpression,
        priority: data.priority ?? 100,
        tenantId: data.tenantId ?? null,
        createdBy: data.createdBy,
        status: 'draft',
      },
    });
  }

  async updateRule(id: string, data: Partial<{
    name: string;
    description: string;
    conditionDef: unknown;
    actionDef: unknown;
    delaySeconds: number;
    scheduleExpression: string;
    priority: number;
    status: string;
  }>) {
    return this.prisma.automationRule.update({
      where: { id },
      data: data as any,
    });
  }

  async setRuleStatus(id: string, status: 'active' | 'paused' | 'archived') {
    return this.prisma.automationRule.update({ where: { id }, data: { status } });
  }

  async deleteRule(id: string) {
    await this.prisma.automationRule.delete({ where: { id } });
  }

  // ── Trigger handling ───────────────────────────────────────────────────────

  // ── Category → config field mapping ────────────────────────────────────────

  private static readonly TRIGGER_CATEGORY_MAP: Record<string, string> = {
    user_signup: 'onboardingAutomation',
    onboarding_incomplete: 'onboardingAutomation',
    profile_incomplete: 'onboardingAutomation',
    profile_complete: 'onboardingAutomation',
    match_generated: 'matchingAutomation',
    match_not_viewed: 'matchingAutomation',
    connection_request_sent: 'matchingAutomation',
    connection_not_answered: 'matchingAutomation',
    connection_accepted: 'matchingAutomation',
    mentor_request_submitted: 'mentorshipAutomation',
    mentor_request_accepted: 'mentorshipAutomation',
    mentor_session_idle: 'mentorshipAutomation',
    community_join: 'communityAutomation',
    community_inactive: 'communityAutomation',
    subscription_trial_ending: 'billingAutomation',
    subscription_failed_payment: 'billingAutomation',
    subscription_canceled: 'billingAutomation',
    subscription_seat_limit: 'billingAutomation',
    user_inactive: 'reEngagementAutomation',
    tenant_setup_incomplete: 'onboardingAutomation',
    content_reported_threshold: 'onboardingAutomation',
  };

  /**
   * Entry point: fires when a platform event occurs.
   * Finds all matching active rules and enqueues or runs them.
   * Enforces: category flags, quiet hours, deduplication cooldown.
   */
  async fire(ctx: TriggerContext): Promise<void> {
    const rules = await this.prisma.automationRule.findMany({
      where: {
        triggerType: ctx.triggerType as any,
        status: 'active',
        OR: [{ tenantId: null }, { tenantId: ctx.tenantId ?? null }],
      },
      orderBy: { priority: 'asc' },
    });

    if (rules.length === 0) return;

    // Load tenant config (best-effort) for spam checks
    const tenantId = ctx.tenantId ?? rules.find(r => r.tenantId)?.tenantId ?? null;
    const tenantConfig = tenantId
      ? await this.prisma.tenantAutomationConfig.findUnique({ where: { tenantId } }).catch(() => null)
      : null;

    // Master kill-switch
    if (tenantConfig && tenantConfig.automationsEnabled === false) return;

    // Quiet-hours check (UTC hour comparison)
    if (tenantConfig?.quietHoursStart != null && tenantConfig?.quietHoursEnd != null) {
      const nowHour = new Date().getUTCHours();
      const { quietHoursStart: qStart, quietHoursEnd: qEnd } = tenantConfig;
      const inQuiet = qStart < qEnd
        ? nowHour >= qStart && nowHour < qEnd
        : nowHour >= qStart || nowHour < qEnd;
      if (inQuiet) {
        this.logger.debug(`Automation suppressed: quiet hours (${qStart}–${qEnd} UTC) for tenant ${tenantId}`);
        return;
      }
    }

    // Category flag check
    const categoryField = AutomationService.TRIGGER_CATEGORY_MAP[ctx.triggerType];
    if (categoryField && tenantConfig && (tenantConfig as any)[categoryField] === false) {
      this.logger.debug(`Automation suppressed: category ${categoryField} disabled for tenant ${tenantId}`);
      return;
    }

    for (const rule of rules) {
      try {
        // Condition evaluation
        const conditionsMet = this.evaluateConditions(
          rule.conditionDef as ConditionDef | null,
          ctx.payload ?? {},
        );
        if (!conditionsMet) continue;

        // Deduplication: skip if same rule+user ran within cooldown window (1h default)
        if (ctx.targetUserId) {
          const cooldownMs = rule.delaySeconds > 0 ? rule.delaySeconds * 1000 + 3_600_000 : 3_600_000;
          const since = new Date(Date.now() - cooldownMs);
          const recent = await this.prisma.automationExecution.findFirst({
            where: {
              ruleId: rule.id,
              targetUserId: ctx.targetUserId,
              status: { in: ['completed', 'running', 'pending'] },
              scheduledAt: { gte: since },
            },
            select: { id: true },
          });
          if (recent) {
            this.logger.debug(`Automation dedup: rule ${rule.id} already ran for user ${ctx.targetUserId} within cooldown`);
            continue;
          }
        }

        await this.scheduleExecution(rule.id, ctx, rule.delaySeconds);
      } catch (err: any) {
        this.logger.warn(`Error scheduling rule ${rule.id}: ${err?.message}`);
      }
    }
  }

  // ── Execution scheduling ───────────────────────────────────────────────────

  async scheduleExecution(ruleId: string, ctx: TriggerContext, delaySeconds: number = 0) {
    const scheduledAt = delaySeconds > 0
      ? new Date(Date.now() + delaySeconds * 1000)
      : new Date();

    const execution = await this.prisma.automationExecution.create({
      data: {
        ruleId,
        targetUserId: ctx.targetUserId,
        targetEntityType: ctx.targetEntityType,
        targetEntityId: ctx.targetEntityId,
        status: 'pending',
        scheduledAt,
      },
    });

    // Schedule or run immediately
    if (delaySeconds <= 0) {
      // Run inline (fire-and-forget)
      this.runExecution(execution.id).catch(e =>
        this.logger.error(`Execution ${execution.id} failed: ${e?.message}`)
      );
    } else {
      // Persist as ScheduledJob for the cron runner
      await this.prisma.scheduledJob.create({
        data: {
          type: 'automation_execution',
          payload: { executionId: execution.id },
          runAt: scheduledAt,
        },
      });
    }

    return execution;
  }

  /** Called by cron runner and inline handler */
  async runExecution(executionId: string): Promise<void> {
    const execution = await this.prisma.automationExecution.findUnique({
      where: { id: executionId },
      include: { rule: true },
    });

    if (!execution || execution.status !== 'pending') return;

    await this.prisma.automationExecution.update({
      where: { id: executionId },
      data: { status: 'running', startedAt: new Date() },
    });

    try {
      const actionDef = execution.rule.actionDef as ActionDef;
      await this.executeAction(actionDef, execution);

      await this.prisma.automationExecution.update({
        where: { id: executionId },
        data: { status: 'completed', completedAt: new Date() },
      });

      await this.prisma.automationRule.update({
        where: { id: execution.ruleId },
        data: {
          executionCount: { increment: 1 },
          lastRunAt: new Date(),
          failureCount: 0,
        },
      });

      await this.addLog(executionId, 'info', `Action ${actionDef.type} executed successfully`);
    } catch (err: any) {
      const msg = err?.message ?? 'Unknown error';

      await this.prisma.automationExecution.update({
        where: { id: executionId },
        data: { status: 'failed', completedAt: new Date(), errorMessage: msg },
      });

      await this.prisma.automationRule.update({
        where: { id: execution.ruleId },
        data: { failureCount: { increment: 1 } },
      });

      await this.addLog(executionId, 'error', msg);

      // Auto-pause rule if too many failures
      const rule = await this.prisma.automationRule.findUnique({ where: { id: execution.ruleId } });
      if (rule && rule.failureCount >= rule.maxFailures) {
        await this.prisma.automationRule.update({
          where: { id: rule.id },
          data: { status: 'paused' },
        });
        this.logger.warn(`Rule ${rule.id} auto-paused after ${rule.failureCount} failures`);
      }
    }
  }

  /** Process pending scheduled jobs (called by cron) */
  async processDueJobs(): Promise<void> {
    const jobs = await this.prisma.scheduledJob.findMany({
      where: { status: 'pending', runAt: { lte: new Date() } },
      take: 50,
      orderBy: { runAt: 'asc' },
    });

    for (const job of jobs) {
      await this.prisma.scheduledJob.update({ where: { id: job.id }, data: { status: 'processing', startedAt: new Date() } });
      try {
        if (job.type === 'automation_execution') {
          const payload = job.payload as { executionId: string };
          await this.runExecution(payload.executionId);
        }
        await this.prisma.scheduledJob.update({ where: { id: job.id }, data: { status: 'completed', completedAt: new Date() } });
      } catch (err: any) {
        const retryCount = job.retryCount + 1;
        if (retryCount >= job.maxRetries) {
          await this.prisma.scheduledJob.update({
            where: { id: job.id },
            data: { status: 'failed', errorMessage: err?.message, retryCount, completedAt: new Date() },
          });
        } else {
          const backoffSeconds = Math.pow(2, retryCount) * 60;
          await this.prisma.scheduledJob.update({
            where: { id: job.id },
            data: {
              status: 'pending',
              retryCount,
              runAt: new Date(Date.now() + backoffSeconds * 1000),
              errorMessage: err?.message,
            },
          });
        }
      }
    }
  }

  // ── Action executor ────────────────────────────────────────────────────────

  private async executeAction(actionDef: ActionDef, execution: any): Promise<void> {
    const { type, params } = actionDef;
    const userId = execution.targetUserId as string | undefined;

    switch (type) {
      case 'send_in_app_notification': {
        if (!userId) throw new Error('targetUserId required for send_in_app_notification');
        await this.notifications.createNotification({
          userId,
          type: (params.notificationType as any) ?? 'system',
          title: params.title as string ?? 'Notification',
          body: params.body as string ?? '',
        });
        break;
      }

      case 'send_email': {
        if (!userId) throw new Error('targetUserId required for send_email');
        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
        if (!user) throw new Error(`User ${userId} not found`);
        await this.mailer.sendEmail({
          to: user.email,
          subject: params.subject as string ?? 'CoFounderBay',
          html: params.bodyHtml as string ?? '',
          text: params.bodyText as string | undefined,
        });
        break;
      }

      case 'generate_matches': {
        if (!userId) throw new Error('targetUserId required for generate_matches');
        await this.matching.getRecommendations(userId, (params.limit as number) ?? 10);
        break;
      }

      case 'flag_for_admin_review': {
        await this.addLog(execution.id, 'info', `Flagged entity ${execution.targetEntityType}:${execution.targetEntityId} for admin review`);
        break;
      }

      case 'send_admin_alert': {
        this.logger.warn(`[AutomationAlert] Rule ${execution.ruleId}: ${params.message ?? 'Admin alert triggered'}`);
        break;
      }

      case 'log_event': {
        await this.addLog(execution.id, 'info', (params.message as string) ?? 'Event logged', params.context as any);
        break;
      }

      case 'update_user_field': {
        if (!userId) throw new Error('targetUserId required for update_user_field');
        const field = params.field as string;
        const value = params.value;
        const SAFE_FIELDS: Record<string, boolean> = {
          hasCompletedOnboarding: true, moderationStatus: true,
        };
        if (!SAFE_FIELDS[field]) {
          throw new Error(`Field "${field}" is not allowed for update_user_field action`);
        }
        await this.prisma.user.update({ where: { id: userId }, data: { [field]: value } as any });
        await this.addLog(execution.id, 'info', `Set user.${field} = ${JSON.stringify(value)}`);
        break;
      }

      case 'webhook_call': {
        const url = params.url as string;
        if (!url) throw new Error('url required for webhook_call action');
        const body = params.body ?? {
          ruleId: execution.ruleId,
          executionId: execution.id,
          targetUserId: execution.targetUserId,
          targetEntityType: execution.targetEntityType,
          targetEntityId: execution.targetEntityId,
          timestamp: new Date().toISOString(),
        };
        const allowedHosts = (process.env.AUTOMATION_WEBHOOK_ALLOWED_HOSTS ?? '')
          .split(',').map((host) => host.trim()).filter(Boolean);
        const result = await sendSafeWebhook({
          url,
          method: params.method as string | undefined,
          headers: params.headers as Record<string, string> | undefined,
          body,
        }, { allowedHosts });
        // Query strings commonly carry signatures. Never persist them in
        // execution logs, and never include a remote response body in errors.
        await this.addLog(execution.id, 'info', `Webhook ${result.method} ${result.destination} -> ${result.status}`);
        break;
      }

      case 'trigger_another_rule': {
        const targetRuleId = params.ruleId as string;
        if (!targetRuleId) throw new Error('ruleId required for trigger_another_rule action');
        const targetRule = await this.prisma.automationRule.findUnique({ where: { id: targetRuleId } });
        if (!targetRule || targetRule.status !== 'active') break;
        await this.scheduleExecution(targetRuleId, {
          triggerType: targetRule.triggerType,
          targetUserId: execution.targetUserId,
          targetEntityType: execution.targetEntityType,
          targetEntityId: execution.targetEntityId,
        }, 0);
        await this.addLog(execution.id, 'info', `Triggered chain rule ${targetRuleId}`);
        break;
      }

      default:
        throw new Error(`Unknown action type: ${type}`);
    }
  }

  // ── Condition evaluator ────────────────────────────────────────────────────

  private evaluateConditions(conditions: ConditionDef | null | undefined, payload: Record<string, unknown>): boolean {
    if (!conditions || conditions.length === 0) return true;
    return conditions.every(cond => this.evaluateCondition(cond, payload));
  }

  private evaluateCondition(cond: { field: string; operator: string; value: unknown }, payload: Record<string, unknown>): boolean {
    const actual = payload[cond.field];
    switch (cond.operator) {
      case 'eq': return actual === cond.value;
      case 'neq': return actual !== cond.value;
      case 'gt': return typeof actual === 'number' && typeof cond.value === 'number' && actual > cond.value;
      case 'gte': return typeof actual === 'number' && typeof cond.value === 'number' && actual >= cond.value;
      case 'lt': return typeof actual === 'number' && typeof cond.value === 'number' && actual < cond.value;
      case 'lte': return typeof actual === 'number' && typeof cond.value === 'number' && actual <= cond.value;
      case 'contains': return typeof actual === 'string' && typeof cond.value === 'string' && actual.includes(cond.value);
      case 'in': return Array.isArray(cond.value) && cond.value.includes(actual);
      case 'not_in': return Array.isArray(cond.value) && !cond.value.includes(actual);
      case 'is_null': return actual == null;
      case 'is_not_null': return actual != null;
      default: return true;
    }
  }

  // ── Logs ───────────────────────────────────────────────────────────────────

  async addLog(executionId: string, level: 'info' | 'warn' | 'error', message: string, context?: unknown) {
    await this.prisma.automationLog.create({
      data: { executionId, level, message, context: context as any },
    });
  }

  async getExecutionLogs(executionId: string) {
    return this.prisma.automationLog.findMany({
      where: { executionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ── Execution listing ──────────────────────────────────────────────────────

  async listExecutions(params: { ruleId?: string; status?: string; limit?: number }) {
    return this.prisma.automationExecution.findMany({
      where: {
        ...(params.ruleId ? { ruleId: params.ruleId } : {}),
        ...(params.status ? { status: params.status as any } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: params.limit ?? 50,
      include: { _count: { select: { logs: true } } },
    });
  }

  async manualTrigger(ruleId: string, actorUserId: string): Promise<void> {
    const rule = await this.prisma.automationRule.findUniqueOrThrow({ where: { id: ruleId } });
    await this.scheduleExecution(ruleId, {
      triggerType: rule.triggerType,
      targetUserId: actorUserId,
      payload: { manual: true },
    }, 0);
  }

  // ── Tenant config ──────────────────────────────────────────────────────────

  async getTenantConfig(tenantId: string) {
    return this.prisma.tenantAutomationConfig.findUnique({ where: { tenantId } });
  }

  async upsertTenantConfig(tenantId: string, data: Partial<{
    automationsEnabled: boolean;
    maxEmailsPerUserPerDay: number;
    maxNotificationsPerDay: number;
    quietHoursStart: number;
    quietHoursEnd: number;
    timezone: string;
    onboardingAutomation: boolean;
    matchingAutomation: boolean;
    mentorshipAutomation: boolean;
    communityAutomation: boolean;
    billingAutomation: boolean;
    reEngagementAutomation: boolean;
  }>) {
    return this.prisma.tenantAutomationConfig.upsert({
      where: { tenantId },
      create: { tenantId, ...data } as any,
      update: data as any,
    });
  }

  // ── Notification templates ─────────────────────────────────────────────────

  async listTemplates(tenantId?: string) {
    return this.prisma.notificationTemplate.findMany({
      where: { OR: [{ tenantId: null }, { tenantId: tenantId ?? null }] },
      orderBy: { key: 'asc' },
    });
  }

  async upsertTemplate(data: {
    key: string;
    name: string;
    type: string;
    subject?: string;
    bodyHtml?: string;
    bodyText?: string;
    variables?: unknown;
    tenantId?: string;
  }) {
    return this.prisma.notificationTemplate.upsert({
      where: { key: data.key },
      create: data as any,
      update: data as any,
    });
  }
}
