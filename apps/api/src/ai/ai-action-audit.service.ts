import { Injectable, Logger } from '@nestjs/common';
import { getActionDeclaration } from '@cofounderbay/shared';
import { PrismaService } from '../prisma/prisma.service';
import { reviewToolCall } from './tool-calls';

/**
 * Records what the assistant actually did, so a user can see it afterwards.
 *
 * Written to the existing `AuditLog` model rather than a new table. That model
 * was already in the schema — `actorId`, `action`, `entityType`/`entityId`,
 * `metadataJson`, and indexes on exactly the fields this queries — and had no
 * writers at all, so this is its first use. `AdminAuditLog` is a different
 * concern (moderation by staff, with its own typed action union) and
 * `AIUsageLog` is telemetry: tokens, latency, which model answered. Neither
 * records which of the user's own data an assistant changed.
 *
 * WHAT THIS IS NOT: a tamper-proof security log. The executors live in the web
 * app, because the confirm-first design has the user's own session perform the
 * write, so a caller that never posts here still performs its action — the
 * endpoints it calls have their own guards, which is where authorisation
 * actually lives. Treat this as the product's account of itself, for the user
 * and for support, not as evidence against the client. Making it authoritative
 * means moving execution server-side, which is a different architecture.
 *
 * What it does guarantee: every entry names a declared capability with
 * arguments that pass the same validation `reviewToolCall` applies to a model's
 * output. Otherwise the trail would be an unvalidated sink reachable by any
 * authenticated caller.
 */

export type AIActionOutcome = 'applied' | 'undone' | 'failed';

export const AI_ACTION_OUTCOMES: readonly AIActionOutcome[] = ['applied', 'undone', 'failed'];

/** Prefix on `AuditLog.action`, so the indexed column stays queryable by both. */
const ACTION_PREFIX = 'ai';

export type AIActionAuditEntry = {
  id: string;
  actionId: string;
  outcome: string;
  entityType: string;
  entityId: string | null;
  args: Record<string, unknown>;
  writes: boolean;
  reversalKind: string | null;
  createdAt: Date;
};

@Injectable()
export class AIActionAuditService {
  private readonly logger = new Logger(AIActionAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * The subject of an action is the first argument the declaration marks
   * required — `userId` for a shortlist entry, `receiverId` for an intro,
   * `href` for a navigation. Derived rather than passed in so a caller cannot
   * file an entry against an entity the arguments never mentioned.
   *
   * A declaration may name its own subject instead, which is what the page
   * capabilities do: the first required argument of a readiness tick is a
   * dimension, and calling that a user id would have quietly filed every one
   * of those rows against a person who does not exist.
   */
  private subjectOf(actionId: string, args: Record<string, unknown>) {
    const declaration = getActionDeclaration(actionId);
    const declared = declaration?.auditSubject;
    const param = declared
      ? declaration?.params.find((candidate) => candidate.name === declared.param)
      : declaration?.params.find((candidate) => candidate.required);
    const value = param ? args[param.name] : undefined;

    if (!param || typeof value !== 'string' || !value) {
      return { entityType: 'ai_action', entityId: null as string | null };
    }
    if (declared) return { entityType: declared.entityType, entityId: value };
    return { entityType: param.name === 'href' ? 'route' : 'user', entityId: value };
  }

  async record(params: {
    actorId: string;
    actionId: string;
    args: Record<string, unknown>;
    outcome: AIActionOutcome;
    tenantId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<{ recorded: boolean; reason?: string }> {
    // Same gate as a model's tool call: a capability nobody declared, or
    // arguments that do not match its schema, are not recordable.
    const review = reviewToolCall({ name: params.actionId, arguments: params.args });
    if (!review.ok) return { recorded: false, reason: review.rejection.reason };

    if (!AI_ACTION_OUTCOMES.includes(params.outcome)) {
      return { recorded: false, reason: `unknown outcome "${params.outcome}"` };
    }

    const declaration = getActionDeclaration(params.actionId);
    const { entityType, entityId } = this.subjectOf(params.actionId, review.call.args);

    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: params.actorId,
          tenantId: params.tenantId ?? null,
          action: `${ACTION_PREFIX}.${params.actionId}.${params.outcome}`,
          entityType,
          entityId,
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
          metadataJson: {
            source: 'ai_copilot',
            outcome: params.outcome,
            // Only the validated arguments; anything the model or client added
            // on top was already dropped by reviewToolCall.
            args: review.call.args,
            droppedArgs: review.call.droppedArgs,
            writes: review.call.writes,
            reversalKind: declaration?.reversal?.kind ?? null,
          } as never,
        },
      });
      return { recorded: true };
    } catch (err) {
      // An audit write must never turn a completed action into a failure the
      // user sees: by the time this runs, the action has already happened.
      this.logger.error(
        `Failed to record ${params.actionId}/${params.outcome}: ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
      return { recorded: false, reason: 'not recorded' };
    }
  }

  /** The caller's own trail. Never accepts an actor id from the request. */
  async listForActor(
    actorId: string,
    options?: { limit?: number },
  ): Promise<{ entries: AIActionAuditEntry[] }> {
    const take = Math.min(Math.max(options?.limit ?? 50, 1), 200);

    const rows = await this.prisma.auditLog.findMany({
      where: { actorId, action: { startsWith: `${ACTION_PREFIX}.` } },
      orderBy: { createdAt: 'desc' },
      take,
    });

    return {
      entries: rows.map((row) => {
        const meta = (row.metadataJson ?? {}) as Record<string, unknown>;
        // "ai.<actionId>.<outcome>" — actionId can carry underscores but never a
        // dot, so splitting on the first and last separator is unambiguous.
        const withoutPrefix = row.action.slice(ACTION_PREFIX.length + 1);
        const lastDot = withoutPrefix.lastIndexOf('.');

        return {
          id: row.id,
          actionId: lastDot === -1 ? withoutPrefix : withoutPrefix.slice(0, lastDot),
          outcome: lastDot === -1 ? '' : withoutPrefix.slice(lastDot + 1),
          entityType: row.entityType,
          entityId: row.entityId,
          args: (meta.args ?? {}) as Record<string, unknown>,
          writes: meta.writes === true,
          reversalKind: typeof meta.reversalKind === 'string' ? meta.reversalKind : null,
          createdAt: row.createdAt,
        };
      }),
    };
  }
}
