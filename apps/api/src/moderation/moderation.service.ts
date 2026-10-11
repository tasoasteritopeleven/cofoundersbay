import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReportStatus, ReportType, UserModerationStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

export type ReportItem = {
  id: string;
  type: ReportType;
  status: ReportStatus;
  reason: string;
  context: unknown;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  reporter: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  reported: {
    id: string;
    email: string;
    name: string;
    role: string;
    moderationStatus: UserModerationStatus;
  };
};

export type AdminUserItem = {
  id: string;
  email: string;
  role: string;
  moderationStatus: UserModerationStatus;
  createdAt: string;
  lastSeenAt: string | null;
  profile: {
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
  reportsCount: number;
};

@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async createReport(params: {
    reporterId: string;
    reportedId: string;
    type: ReportType;
    reason: string;
    context?: unknown;
  }): Promise<ReportItem> {
    if (params.reporterId === params.reportedId) {
      throw new BadRequestException('You cannot report yourself');
    }

    const reported = await this.prisma.user.findUnique({
      where: { id: params.reportedId },
      select: { id: true },
    });
    if (!reported) throw new NotFoundException('Reported user not found');

    const created = await this.prisma.report.create({
      data: {
        reporterId: params.reporterId,
        reportedId: params.reportedId,
        type: params.type,
        reason: params.reason,
        context:
          params.context === undefined
            ? undefined
            : params.context === null
              ? Prisma.JsonNull
              : (params.context as Prisma.InputJsonValue),
      },
      select: { id: true },
    });

    const row = await this.prisma.report.findUnique({
      where: { id: created.id },
      include: this.reportIncludes(),
    });
    if (!row) throw new NotFoundException('Report not found after creation');
    return this.toReportItem(row);
  }

  async listReports(params?: {
    status?: ReportStatus;
    q?: string;
    limit?: number;
  }): Promise<ReportItem[]> {
    const and: Prisma.ReportWhereInput[] = [];
    if (params?.status) and.push({ status: params.status });
    if (params?.q?.trim()) {
      const q = params.q.trim();
      and.push({
        OR: [
          { reason: { contains: q, mode: 'insensitive' } },
          { reporter: { email: { contains: q, mode: 'insensitive' } } },
          { reported: { email: { contains: q, mode: 'insensitive' } } },
          { reporter: { profile: { is: { displayName: { contains: q, mode: 'insensitive' } } } } },
          { reported: { profile: { is: { displayName: { contains: q, mode: 'insensitive' } } } } },
        ],
      });
    }

    const rows = await this.prisma.report.findMany({
      where: and.length ? { AND: and } : undefined,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(params?.limit ?? 100, 1), 300),
      include: this.reportIncludes(),
    });

    return rows.map((row) => this.toReportItem(row));
  }

  async updateReportStatus(params: {
    reportId: string;
    resolverId: string;
    status: ReportStatus;
    moderationStatus?: UserModerationStatus;
  }): Promise<ReportItem> {
    const existing = await this.prisma.report.findUnique({
      where: { id: params.reportId },
      select: { id: true, reportedId: true },
    });
    if (!existing) throw new NotFoundException('Report not found');

    if (params.moderationStatus) {
      await this.prisma.user.update({
        where: { id: existing.reportedId },
        data: { moderationStatus: params.moderationStatus },
      });
    }

    const row = await this.prisma.report.update({
      where: { id: params.reportId },
      data: {
        status: params.status,
        resolvedAt: ['resolved', 'dismissed'].includes(params.status) ? new Date() : null,
        resolvedById: ['resolved', 'dismissed'].includes(params.status) ? params.resolverId : null,
      },
      include: this.reportIncludes(),
    });

    if (params.moderationStatus && ['suspended', 'banned'].includes(params.moderationStatus)) {
      void this.notifications
        .createNotification({
          userId: existing.reportedId,
          type: 'system',
          title: 'Account moderation update',
          body: `Your account status is now "${params.moderationStatus}".`,
          link: '/settings',
        })
        .catch(() => {});
    }

    return this.toReportItem(row);
  }

  async listUsers(params?: { q?: string; limit?: number }): Promise<AdminUserItem[]> {
    const q = params?.q?.trim();
    const where: Prisma.UserWhereInput | undefined = q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { profile: { is: { displayName: { contains: q, mode: 'insensitive' } } } },
          ],
        }
      : undefined;

    const rows = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(params?.limit ?? 100, 1), 300),
      select: {
        id: true,
        email: true,
        role: true,
        moderationStatus: true,
        createdAt: true,
        lastSeenAt: true,
        profile: {
          select: {
            displayName: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            reportsAgainst: true,
          },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      moderationStatus: row.moderationStatus,
      createdAt: row.createdAt.toISOString(),
      lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
      profile: row.profile
        ? {
            displayName: row.profile.displayName,
            avatarUrl: row.profile.avatarUrl,
          }
        : null,
      reportsCount: row._count.reportsAgainst,
    }));
  }

  async setUserModerationStatus(params: {
    userId: string;
    moderationStatus: UserModerationStatus;
  }): Promise<{ ok: true }> {
    await this.prisma.user.update({
      where: { id: params.userId },
      data: { moderationStatus: params.moderationStatus },
    });
    return { ok: true };
  }

  private reportIncludes() {
    return {
      reporter: {
        select: {
          id: true,
          email: true,
          role: true,
          profile: { select: { displayName: true } },
        },
      },
      reported: {
        select: {
          id: true,
          email: true,
          role: true,
          moderationStatus: true,
          profile: { select: { displayName: true } },
        },
      },
    } as const;
  }

  private toReportItem(row: {
    id: string;
    type: ReportType;
    status: ReportStatus;
    reason: string;
    context: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
    resolvedAt: Date | null;
    reporter: {
      id: string;
      email: string;
      role: string;
      profile: { displayName: string } | null;
    };
    reported: {
      id: string;
      email: string;
      role: string;
      moderationStatus: UserModerationStatus;
      profile: { displayName: string } | null;
    };
  }): ReportItem {
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      reason: row.reason,
      context: row.context,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
      reporter: {
        id: row.reporter.id,
        email: row.reporter.email,
        name: row.reporter.profile?.displayName ?? row.reporter.email,
        role: row.reporter.role,
      },
      reported: {
        id: row.reported.id,
        email: row.reported.email,
        name: row.reported.profile?.displayName ?? row.reported.email,
        role: row.reported.role,
        moderationStatus: row.reported.moderationStatus,
      },
    };
  }
}
