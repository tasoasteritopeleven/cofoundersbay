import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type AdminAction =
  | 'user.ban'
  | 'user.unban'
  | 'user.suspend'
  | 'user.activate'
  | 'user.role_change'
  | 'user.delete'
  | 'report.resolve'
  | 'report.dismiss'
  | 'report.escalate'
  | 'content.feature'
  | 'content.unfeature'
  | 'content.remove'
  | 'cohort.create'
  | 'cohort.update'
  | 'cohort.delete'
  | 'cohort.add_member'
  | 'cohort.remove_member'
  | 'settings.update'
  | 'skill.create'
  | 'skill.update'
  | 'skill.delete';

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string | null;
  meta: Record<string, unknown>;
  createdAt: Date;
}

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    actorId: string;
    action: AdminAction;
    entityType: string;
    entityId?: string;
    meta?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.adminAuditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        meta: (params.meta ?? {}) as any,
      },
    });
  }

  async list(params: {
    actorId?: string;
    action?: string;
    entityType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AuditLogEntry[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (params.actorId) where.actorId = params.actorId;
    if (params.action) where.action = params.action;
    if (params.entityType) where.entityType = params.entityType;

    const [logs, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        where,
        include: {
          actor: {
            select: { id: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: params.limit ?? 50,
        skip: params.offset ?? 0,
      }),
      this.prisma.adminAuditLog.count({ where }),
    ]);

    return {
      logs: logs.map((log) => ({
        id: log.id,
        actorId: log.actorId,
        actorEmail: log.actor.email,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        meta: log.meta as Record<string, unknown>,
        createdAt: log.createdAt,
      })),
      total,
    };
  }
}
