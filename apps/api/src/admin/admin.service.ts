import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAuditService } from './admin-audit.service';
import { Role, UserModerationStatus } from '@prisma/client';

export interface PlatformStats {
  totalUsers: number;
  usersByRole: Record<string, number>;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  activeUsersToday: number;
  activeUsersThisWeek: number;
  activeUsersThisMonth: number;
  totalConnections: number;
  totalMessages: number;
  totalEvents: number;
  totalGroups: number;
  totalJobs: number;
  pendingReports: number;
}

export interface UserListItem {
  id: string;
  email: string;
  role: string;
  moderationStatus: string;
  emailVerified: boolean;
  createdAt: Date;
  lastSeenAt: Date | null;
  profile: {
    displayName: string;
    avatarUrl: string | null;
  } | null;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  async getPlatformStats(): Promise<PlatformStats> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart);
    monthStart.setMonth(monthStart.getMonth() - 1);

    const [
      totalUsers,
      founderCount,
      mentorCount,
      investorCount,
      orgCount,
      adminCount,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      activeUsersToday,
      activeUsersThisWeek,
      activeUsersThisMonth,
      totalConnections,
      totalMessages,
      totalEvents,
      totalGroups,
      totalJobs,
      pendingReports,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: 'founder' } }),
      this.prisma.user.count({ where: { role: 'mentor' } }),
      this.prisma.user.count({ where: { role: 'investor' } }),
      this.prisma.user.count({ where: { role: 'org' } }),
      this.prisma.user.count({ where: { role: 'admin' } }),
      this.prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.user.count({ where: { createdAt: { gte: weekStart } } }),
      this.prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
      this.prisma.user.count({ where: { lastSeenAt: { gte: todayStart } } }),
      this.prisma.user.count({ where: { lastSeenAt: { gte: weekStart } } }),
      this.prisma.user.count({ where: { lastSeenAt: { gte: monthStart } } }),
      this.prisma.connectionRequest.count({ where: { status: 'accepted' } }),
      this.prisma.message.count(),
      this.prisma.event.count(),
      this.prisma.group.count(),
      this.prisma.jobPosting.count(),
      this.prisma.report.count({ where: { status: 'pending' } }),
    ]);

    return {
      totalUsers,
      usersByRole: {
        founder: founderCount,
        mentor: mentorCount,
        investor: investorCount,
        org: orgCount,
        admin: adminCount,
      },
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      activeUsersToday,
      activeUsersThisWeek,
      activeUsersThisMonth,
      totalConnections,
      totalMessages,
      totalEvents,
      totalGroups,
      totalJobs,
      pendingReports,
    };
  }

  async listUsers(params: {
    role?: string;
    status?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ users: UserListItem[]; total: number }> {
    const where: Record<string, unknown> = {};
    
    if (params.role) {
      where.role = params.role;
    }
    if (params.status) {
      where.moderationStatus = params.status;
    }
    if (params.q) {
      where.OR = [
        { email: { contains: params.q, mode: 'insensitive' } },
        { profile: { displayName: { contains: params.q, mode: 'insensitive' } } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          profile: {
            select: { displayName: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: params.limit ?? 50,
        skip: params.offset ?? 0,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        moderationStatus: u.moderationStatus,
        emailVerified: u.emailVerified,
        createdAt: u.createdAt,
        lastSeenAt: u.lastSeenAt,
        profile: u.profile,
      })),
      total,
    };
  }

  async changeUserRole(params: {
    adminId: string;
    userId: string;
    newRole: Role;
  }): Promise<void> {
    if (params.adminId === params.userId) {
      throw new ForbiddenException('Administrators cannot change their own role');
    }

    await this.prisma.$transaction(async (tx) => {
      const [actor, user] = await Promise.all([
        tx.user.findUnique({ where: { id: params.adminId }, select: { role: true, moderationStatus: true } }),
        tx.user.findUnique({ where: { id: params.userId }, select: { role: true } }),
      ]);
      if (!actor || !['admin', 'super_admin'].includes(actor.role) || actor.moderationStatus !== 'active') {
        throw new ForbiddenException('Active administrator privileges are required');
      }
      if (!user) throw new NotFoundException('User not found');

      const privilegedRoles: Role[] = [Role.admin, Role.super_admin];
      if (actor.role !== Role.super_admin && (privilegedRoles.includes(user.role) || privilegedRoles.includes(params.newRole))) {
        throw new ForbiddenException('Only a super administrator can grant or remove administrative roles');
      }
      if (user.role === params.newRole) return;
      if (user.role === Role.super_admin && params.newRole !== Role.super_admin) {
        const activeSuperAdmins = await tx.user.count({
          where: { role: Role.super_admin, moderationStatus: UserModerationStatus.active },
        });
        if (activeSuperAdmins <= 1) throw new ForbiddenException('The last active super administrator cannot be demoted');
      }

      await tx.user.update({ where: { id: params.userId }, data: { role: params.newRole } });
      await tx.adminAuditLog.create({
        data: {
          actorId: params.adminId,
          action: 'user.role_change',
          entityType: 'user',
          entityId: params.userId,
          meta: { oldRole: user.role, newRole: params.newRole },
        },
      });
    }, { isolationLevel: 'Serializable' });
  }

  private async assertCanModerateUser(adminId: string, userId: string) {
    if (adminId === userId) throw new ForbiddenException('Administrators cannot moderate their own account');
    const [actor, target] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: adminId }, select: { role: true, moderationStatus: true } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    ]);
    if (!actor || !['admin', 'super_admin'].includes(actor.role) || actor.moderationStatus !== 'active') {
      throw new ForbiddenException('Active administrator privileges are required');
    }
    if (!target) throw new NotFoundException('User not found');
    if (target.role === Role.super_admin) {
      throw new ForbiddenException('Super administrator moderation requires the break-glass workflow');
    }
    if (actor.role !== Role.super_admin && target.role === Role.admin) {
      throw new ForbiddenException('Only a super administrator can moderate an administrator');
    }
    return target;
  }

  async banUser(params: {
    adminId: string;
    userId: string;
    reason: string;
  }): Promise<void> {
    await this.assertCanModerateUser(params.adminId, params.userId);

    await this.prisma.user.update({
      where: { id: params.userId },
      data: { moderationStatus: UserModerationStatus.banned },
    });

    await this.audit.log({
      actorId: params.adminId,
      action: 'user.ban',
      entityType: 'user',
      entityId: params.userId,
      meta: { reason: params.reason },
    });
  }

  async unbanUser(params: {
    adminId: string;
    userId: string;
  }): Promise<void> {
    await this.assertCanModerateUser(params.adminId, params.userId);

    await this.prisma.user.update({
      where: { id: params.userId },
      data: { moderationStatus: UserModerationStatus.active },
    });

    await this.audit.log({
      actorId: params.adminId,
      action: 'user.unban',
      entityType: 'user',
      entityId: params.userId,
    });
  }

  async featureContent(params: {
    adminId: string;
    contentType: 'event' | 'group' | 'job';
    contentId: string;
    featured: boolean;
  }): Promise<void> {
    const { contentType, contentId, featured, adminId } = params;

    if (contentType === 'event') {
      await this.prisma.event.update({
        where: { id: contentId },
        data: { isFeatured: featured },
      });
    } else if (contentType === 'group') {
      await this.prisma.group.update({
        where: { id: contentId },
        data: { isFeatured: featured },
      });
    } else if (contentType === 'job') {
      await this.prisma.jobPosting.update({
        where: { id: contentId },
        data: { isFeatured: featured },
      });
    }

    await this.audit.log({
      actorId: adminId,
      action: featured ? 'content.feature' : 'content.unfeature',
      entityType: contentType,
      entityId: contentId,
    });
  }

  async removeContent(params: {
    adminId: string;
    contentType: 'event' | 'group' | 'job';
    contentId: string;
    reason: string;
  }): Promise<void> {
    const { contentType, contentId, adminId, reason } = params;

    if (contentType === 'event') {
      await this.prisma.event.delete({ where: { id: contentId } });
    } else if (contentType === 'group') {
      await this.prisma.group.delete({ where: { id: contentId } });
    } else if (contentType === 'job') {
      await this.prisma.jobPosting.delete({ where: { id: contentId } });
    }

    await this.audit.log({
      actorId: adminId,
      action: 'content.remove',
      entityType: contentType,
      entityId: contentId,
      meta: { reason },
    });
  }

  async listReports(params: {
    status?: string;
    type?: string;
    limit: number;
    offset: number;
  }) {
    const where: Record<string, unknown> = {};
    if (params.status) where.status = params.status;
    if (params.type) where.type = params.type;

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        take: params.limit,
        skip: params.offset,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        include: {
          reporter: { select: { id: true, email: true, profile: { select: { displayName: true, avatarUrl: true } } } },
          reported: { select: { id: true, email: true, profile: { select: { displayName: true, avatarUrl: true } } } },
          resolvedBy: { select: { id: true, email: true } },
        },
      }),
      this.prisma.report.count({ where }),
    ]);

    return { reports, total };
  }

  async updateUserModerationStatus(params: {
    adminId: string;
    userId: string;
    status: 'active' | 'suspended' | 'banned';
    reason?: string;
  }): Promise<void> {
    await this.assertCanModerateUser(params.adminId, params.userId);

    await this.prisma.user.update({
      where: { id: params.userId },
      data: { moderationStatus: params.status as UserModerationStatus },
    });

    const actionMap: Record<string, 'user.ban' | 'user.suspend' | 'user.activate'> = {
      banned: 'user.ban',
      suspended: 'user.suspend',
      active: 'user.activate',
    };
    await this.audit.log({
      actorId: params.adminId,
      action: actionMap[params.status] ?? 'user.activate',
      entityType: 'user',
      entityId: params.userId,
      meta: { reason: params.reason },
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Cohort / Program Management
  // ─────────────────────────────────────────────────────────────────

  async listCohorts(params: { q?: string; limit: number; offset: number }) {
    const where = params.q
      ? { OR: [{ name: { contains: params.q, mode: 'insensitive' as const } }, { slug: { contains: params.q, mode: 'insensitive' as const } }] }
      : {};

    const [cohorts, total] = await Promise.all([
      this.prisma.cohort.findMany({
        where,
        take: params.limit,
        skip: params.offset,
        orderBy: { createdAt: 'desc' },
        include: {
          organizer: { select: { id: true, email: true, profile: { select: { displayName: true, avatarUrl: true } } } },
          _count: { select: { members: true } },
        },
      }),
      this.prisma.cohort.count({ where }),
    ]);

    return { cohorts, total };
  }

  async createCohort(params: {
    adminId: string;
    name: string;
    slug: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    capacity?: number;
    isPublic?: boolean;
  }) {
    const cohort = await this.prisma.cohort.create({
      data: {
        name: params.name,
        slug: params.slug,
        description: params.description,
        organizerId: params.adminId,
        startDate: params.startDate ? new Date(params.startDate) : undefined,
        endDate: params.endDate ? new Date(params.endDate) : undefined,
        capacity: params.capacity,
        isPublic: params.isPublic ?? true,
      },
    });

    await this.audit.log({
      actorId: params.adminId,
      action: 'cohort.create',
      entityType: 'cohort',
      entityId: cohort.id,
      meta: { name: cohort.name },
    });

    return cohort;
  }

  async updateCohort(params: { adminId: string; cohortId: string; data: Record<string, unknown> }) {
    const { startDate, endDate, ...rest } = params.data as {
      startDate?: string; endDate?: string; [key: string]: unknown;
    };

    const cohort = await this.prisma.cohort.update({
      where: { id: params.cohortId },
      data: {
        ...rest,
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: new Date(endDate) }),
      } as Parameters<typeof this.prisma.cohort.update>[0]['data'],
    });

    await this.audit.log({
      actorId: params.adminId,
      action: 'cohort.update',
      entityType: 'cohort',
      entityId: cohort.id,
    });

    return cohort;
  }

  async deleteCohort(params: { adminId: string; cohortId: string }): Promise<void> {
    await this.prisma.cohort.delete({ where: { id: params.cohortId } });
    await this.audit.log({
      actorId: params.adminId,
      action: 'cohort.delete',
      entityType: 'cohort',
      entityId: params.cohortId,
    });
  }

  async addCohortMember(params: {
    adminId: string;
    cohortId: string;
    userId: string;
    role?: string;
  }): Promise<void> {
    await this.prisma.cohortMember.upsert({
      where: { cohortId_userId: { cohortId: params.cohortId, userId: params.userId } },
      create: { cohortId: params.cohortId, userId: params.userId, role: params.role ?? 'participant' },
      update: { role: params.role ?? 'participant' },
    });

    await this.audit.log({
      actorId: params.adminId,
      action: 'cohort.add_member',
      entityType: 'cohort',
      entityId: params.cohortId,
      meta: { userId: params.userId, role: params.role },
    });
  }

  async removeCohortMember(params: { adminId: string; cohortId: string; userId: string }): Promise<void> {
    await this.prisma.cohortMember.delete({
      where: { cohortId_userId: { cohortId: params.cohortId, userId: params.userId } },
    });

    await this.audit.log({
      actorId: params.adminId,
      action: 'cohort.remove_member',
      entityType: 'cohort',
      entityId: params.cohortId,
      meta: { userId: params.userId },
    });
  }

  async resolveReport(params: {
    adminId: string;
    reportId: string;
    resolution: 'resolved' | 'dismissed';
    note?: string;
    banUser?: boolean;
  }): Promise<void> {
    const report = await this.prisma.report.findUnique({ where: { id: params.reportId } });
    if (!report) throw new NotFoundException('Report not found');

    await this.prisma.report.update({
      where: { id: params.reportId },
      data: {
        status: params.resolution,
        resolvedById: params.adminId,
        resolvedAt: new Date(),
        resolutionNote: params.note,
      },
    });

    if (params.banUser && params.resolution === 'resolved') {
      await this.banUser({
        adminId: params.adminId,
        userId: report.reportedId,
        reason: `Banned due to report: ${report.reason}`,
      });
    }

    await this.audit.log({
      actorId: params.adminId,
      action: params.resolution === 'resolved' ? 'report.resolve' : 'report.dismiss',
      entityType: 'report',
      entityId: params.reportId,
      meta: { note: params.note, banUser: params.banUser },
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Taxonomy / Skill Management
  // ─────────────────────────────────────────────────────────────────

  async listSkillsAdmin(params: { q?: string; category?: string; limit?: number; offset?: number }) {
    const { q, category, limit = 100, offset = 0 } = params;
    const where = {
      ...(category ? { category } : {}),
      ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.skill.findMany({
        where,
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          category: true,
          _count: { select: { profiles: true } },
        },
        take: limit,
        skip: offset,
      }),
      this.prisma.skill.count({ where }),
    ]);
    return {
      items: items.map((s) => ({ ...s, count: s._count.profiles })),
      total,
    };
  }

  async createSkill(adminId: string, body: { name: string; slug: string; category?: string }) {
    const skill = await this.prisma.skill.create({
      data: { name: body.name, slug: body.slug, category: body.category ?? null },
      select: { id: true, name: true, slug: true, category: true },
    });
    await this.audit.log({ actorId: adminId, action: 'skill.create', entityType: 'skill', entityId: skill.id, meta: { name: skill.name } });
    return skill;
  }

  async updateSkill(adminId: string, skillId: string, body: { name?: string; slug?: string; category?: string | null }) {
    const existing = await this.prisma.skill.findUnique({ where: { id: skillId } });
    if (!existing) throw new NotFoundException('Skill not found');
    const skill = await this.prisma.skill.update({
      where: { id: skillId },
      data: { ...(body.name !== undefined && { name: body.name }), ...(body.slug !== undefined && { slug: body.slug }), ...(body.category !== undefined && { category: body.category }) },
      select: { id: true, name: true, slug: true, category: true },
    });
    await this.audit.log({ actorId: adminId, action: 'skill.update', entityType: 'skill', entityId: skillId, meta: body });
    return skill;
  }

  async deleteSkill(adminId: string, skillId: string) {
    const existing = await this.prisma.skill.findUnique({ where: { id: skillId } });
    if (!existing) throw new NotFoundException('Skill not found');
    await this.prisma.skill.delete({ where: { id: skillId } });
    await this.audit.log({ actorId: adminId, action: 'skill.delete', entityType: 'skill', entityId: skillId, meta: { name: existing.name } });
  }
}
