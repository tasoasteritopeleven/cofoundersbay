import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface OrgWorkspaceStats {
  totalWorkspaces: number;
  activeWorkspaces: number;
  completedWorkspaces: number;
  totalDocuments: number;
  totalCollaborators: number;
  averageReadiness: number;
}

export interface OrgMemberWorkspace {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  workspaceCount: number;
  lastActivity?: Date;
}

@Injectable()
export class BuilderOrgService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // Organization Workspace Management
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get all workspaces for an organization (tenant)
   */
  async getOrgWorkspaces(
    tenantId: string,
    userId: string,
    params?: {
      status?: string;
      ownerId?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    // Verify user has org access
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { tenantId, userId, isActive: true },
    });

    if (!membership) {
      throw new ForbiddenException('Not a member of this organization');
    }

    const page = params?.page || 1;
    const limit = params?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (params?.status) {
      where.status = params.status;
    }

    if (params?.ownerId) {
      where.ownerId = params.ownerId;
    }

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { startupName: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [workspaces, total] = await Promise.all([
      this.prisma.builderWorkspace.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          owner: {
            select: {
              id: true,
              profile: {
                select: { displayName: true, avatarUrl: true },
              },
            },
          },
          _count: {
            select: {
              documents: true,
              collaborators: true,
            },
          },
        },
      }),
      this.prisma.builderWorkspace.count({ where }),
    ]);

    return {
      data: workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        slug: w.slug,
        description: w.description,
        status: w.status,
        visibility: w.visibility,
        startupName: w.startupName,
        industry: w.industry,
        stage: w.stage,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
        owner: {
          id: w.owner.id,
          displayName: w.owner.profile?.displayName || 'Unknown',
          avatarUrl: w.owner.profile?.avatarUrl,
        },
        documentCount: w._count.documents,
        collaboratorCount: w._count.collaborators,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + workspaces.length < total,
      },
    };
  }

  /**
   * Get organization workspace statistics
   */
  async getOrgStats(tenantId: string, userId: string): Promise<OrgWorkspaceStats> {
    // Verify user has org access
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { tenantId, userId, isActive: true },
    });

    if (!membership) {
      throw new ForbiddenException('Not a member of this organization');
    }

    const [
      totalWorkspaces,
      activeWorkspaces,
      completedWorkspaces,
      totalDocuments,
      collaboratorData,
      readinessData,
    ] = await Promise.all([
      this.prisma.builderWorkspace.count({ where: { tenantId } }),
      this.prisma.builderWorkspace.count({ where: { tenantId, status: 'active' } }),
      this.prisma.builderWorkspace.count({ where: { tenantId, status: 'completed' } }),
      this.prisma.builderDocument.count({
        where: { workspace: { tenantId } },
      }),
      this.prisma.builderCollaborator.findMany({
        where: { workspace: { tenantId }, isActive: true },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.builderReadinessScore.groupBy({
        by: ['workspaceId'],
        where: { workspace: { tenantId } },
        _avg: { score: true },
      }),
    ]);

    const averageReadiness =
      readinessData.length > 0
        ? readinessData.reduce((sum, r) => sum + (r._avg.score || 0), 0) / readinessData.length
        : 0;

    return {
      totalWorkspaces,
      activeWorkspaces,
      completedWorkspaces,
      totalDocuments,
      totalCollaborators: collaboratorData.length,
      averageReadiness: Math.round(averageReadiness),
    };
  }

  /**
   * Get member activity across workspaces
   */
  async getOrgMemberActivity(
    tenantId: string,
    userId: string,
  ): Promise<OrgMemberWorkspace[]> {
    // Verify user has org access
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { tenantId, userId, isActive: true },
    });

    if (!membership) {
      throw new ForbiddenException('Not a member of this organization');
    }

    // Get all org members with their workspace counts
    const members = await this.prisma.tenantMembership.findMany({
      where: { tenantId, isActive: true },
      include: {
        user: {
          include: {
            profile: {
              select: { displayName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    const memberWorkspaces = await Promise.all(
      members.map(async (m) => {
        const workspaceCount = await this.prisma.builderWorkspace.count({
          where: {
            tenantId,
            OR: [
              { ownerId: m.userId },
              { collaborators: { some: { userId: m.userId, isActive: true } } },
            ],
          },
        });

        const lastActivity = await this.prisma.builderActivityLog.findFirst({
          where: {
            userId: m.userId,
            workspace: { tenantId },
          },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        });

        return {
          userId: m.userId,
          displayName: m.user.profile?.displayName || m.user.email.split('@')[0],
          avatarUrl: m.user.profile?.avatarUrl || undefined,
          workspaceCount,
          lastActivity: lastActivity?.createdAt,
        };
      }),
    );

    return memberWorkspaces.sort((a, b) => b.workspaceCount - a.workspaceCount);
  }

  /**
   * Create a workspace for an organization
   */
  async createOrgWorkspace(
    tenantId: string,
    userId: string,
    data: {
      name: string;
      description?: string;
      startupName?: string;
      industry?: string;
      stage?: string;
      targetMarket?: string;
      visibility?: string;
      settings?: Record<string, any>;
    },
  ) {
    // Verify user has org access with appropriate role
    const membership = await this.prisma.tenantMembership.findFirst({
      where: {
        tenantId,
        userId,
        isActive: true,
        role: { in: ['owner', 'admin', 'member'] },
      },
    });

    if (!membership) {
      throw new ForbiddenException('Not authorized to create workspaces in this organization');
    }

    const slug = this.generateSlug(data.name);

    // Check for slug uniqueness within tenant
    const existing = await this.prisma.builderWorkspace.findFirst({
      where: { tenantId, slug },
    });

    if (existing) {
      throw new ConflictException('A workspace with this name already exists in the organization');
    }

    const workspace = await this.prisma.builderWorkspace.create({
      data: {
        ownerId: userId,
        tenantId,
        name: data.name,
        slug,
        description: data.description,
        startupName: data.startupName,
        industry: data.industry,
        stage: data.stage,
        targetMarket: data.targetMarket,
        visibility: (data.visibility as any) || 'team',
        settings: data.settings || {},
      },
      include: {
        owner: {
          select: {
            id: true,
            profile: {
              select: { displayName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    // Add owner as collaborator
    await this.prisma.builderCollaborator.create({
      data: {
        workspaceId: workspace.id,
        userId,
        role: 'owner',
        acceptedAt: new Date(),
      },
    });

    // Log activity
    await this.prisma.builderActivityLog.create({
      data: {
        workspaceId: workspace.id,
        userId,
        action: 'workspace.created',
        entityType: 'workspace',
        entityId: workspace.id,
        metadata: { tenantId },
      },
    });

    return workspace;
  }

  /**
   * Bulk invite organization members to a workspace
   */
  async bulkInviteToWorkspace(
    tenantId: string,
    workspaceId: string,
    inviterId: string,
    invitations: { userId: string; role: string }[],
  ) {
    // Verify inviter has org access and workspace access
    const [membership, workspace] = await Promise.all([
      this.prisma.tenantMembership.findFirst({
        where: { tenantId, userId: inviterId, isActive: true },
      }),
      this.prisma.builderWorkspace.findUnique({
        where: { id: workspaceId },
        include: {
          collaborators: { where: { userId: inviterId } },
        },
      }),
    ]);

    if (!membership) {
      throw new ForbiddenException('Not a member of this organization');
    }

    if (!workspace || workspace.tenantId !== tenantId) {
      throw new NotFoundException('Workspace not found in this organization');
    }

    const inviterCollab = workspace.collaborators[0];
    if (!inviterCollab || !['owner', 'editor'].includes(inviterCollab.role)) {
      throw new ForbiddenException('Not authorized to invite collaborators');
    }

    // Verify all invitees are org members
    const orgMembers = await this.prisma.tenantMembership.findMany({
      where: {
        tenantId,
        userId: { in: invitations.map((i) => i.userId) },
        isActive: true,
      },
    });

    const validUserIds = new Set(orgMembers.map((m) => m.userId));
    const validInvitations = invitations.filter((i) => validUserIds.has(i.userId));

    // Create collaborator records
    const results = await Promise.all(
      validInvitations.map(async (inv) => {
        // Check if already a collaborator
        const existing = await this.prisma.builderCollaborator.findFirst({
          where: { workspaceId, userId: inv.userId },
        });

        if (existing) {
          return { userId: inv.userId, status: 'already_exists' };
        }

        await this.prisma.builderCollaborator.create({
          data: {
            workspaceId,
            userId: inv.userId,
            role: inv.role as any,
            invitedById: inviterId,
          },
        });

        return { userId: inv.userId, status: 'invited' };
      }),
    );

    // Log activity
    await this.prisma.builderActivityLog.create({
      data: {
        workspaceId,
        userId: inviterId,
        action: 'collaborators.bulk_invited',
        entityType: 'collaborator',
        metadata: {
          invitedCount: results.filter((r) => r.status === 'invited').length,
        },
      },
    });

    return results;
  }

  /**
   * Get organization templates
   */
  async getOrgTemplates(tenantId: string, userId: string) {
    // Verify user has org access
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { tenantId, userId, isActive: true },
    });

    if (!membership) {
      throw new ForbiddenException('Not a member of this organization');
    }

    const templates = await this.prisma.builderTemplate.findMany({
      where: {
        OR: [
          { tenantId },
          { isPublic: true },
        ],
      },
      orderBy: [{ usageCount: 'desc' }, { createdAt: 'desc' }],
    });

    // Get creator info separately to avoid type issues
    const creatorIds = templates.map((t: any) => t.createdById).filter(Boolean);
    const creators = creatorIds.length > 0
      ? await this.prisma.user.findMany({
          where: { id: { in: creatorIds } },
          include: { profile: { select: { displayName: true, avatarUrl: true } } },
        })
      : [];
    const creatorMap = new Map(creators.map((c) => [c.id, c]));

    return templates.map((t: any) => {
      const creator = t.createdById ? creatorMap.get(t.createdById) : null;
      return {
        id: t.id,
        type: t.type,
        name: t.name,
        description: t.description,
        category: t.category,
        industry: t.industry,
        stage: t.stage,
        isPublic: t.isPublic,
        usageCount: t.usageCount,
        createdAt: t.createdAt,
        createdBy: creator
          ? {
              id: creator.id,
              displayName: creator.profile?.displayName || 'Unknown',
              avatarUrl: creator.profile?.avatarUrl,
            }
          : null,
      };
    });
  }

  /**
   * Create an organization template
   */
  async createOrgTemplate(
    tenantId: string,
    userId: string,
    data: {
      type: string;
      name: string;
      description?: string;
      content: Record<string, any>;
      category?: string;
      industry?: string;
      stage?: string;
      isPublic?: boolean;
    },
  ) {
    // Verify user has org access with appropriate role
    const membership = await this.prisma.tenantMembership.findFirst({
      where: {
        tenantId,
        userId,
        isActive: true,
        role: { in: ['owner', 'admin'] },
      },
    });

    if (!membership) {
      throw new ForbiddenException('Not authorized to create templates');
    }

    const template = await this.prisma.builderTemplate.create({
      data: {
        tenantId,
        createdById: userId,
        type: data.type as any,
        name: data.name,
        description: data.description,
        content: data.content,
        category: data.category,
        industry: data.industry,
        stage: data.stage,
        isPublic: data.isPublic || false,
      },
    });

    return template;
  }

  /**
   * Get cohort workspaces (for accelerator programs)
   */
  async getCohortWorkspaces(
    tenantId: string,
    cohortId: string,
    userId: string,
  ) {
    // Verify user has org access
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { tenantId, userId, isActive: true },
    });

    if (!membership) {
      throw new ForbiddenException('Not a member of this organization');
    }

    // Get cohort members
    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
      include: {
        members: {
          include: {
            user: {
              include: {
                profile: {
                  select: { displayName: true, avatarUrl: true },
                },
              },
            },
          },
        },
      },
    }) as any;

    if (!cohort || cohort.tenantId !== tenantId) {
      throw new NotFoundException('Cohort not found');
    }

    // Get workspaces for cohort members
    const memberIds = cohort.members.map((m: any) => m.userId);
    
    const workspaces = await this.prisma.builderWorkspace.findMany({
      where: {
        tenantId,
        ownerId: { in: memberIds },
      },
      include: {
        owner: {
          select: {
            id: true,
            profile: {
              select: { displayName: true, avatarUrl: true },
            },
          },
        },
        readinessScores: {
          orderBy: { assessedAt: 'desc' },
          take: 1,
        },
        _count: {
          select: { documents: true },
        },
      },
    });

    return {
      cohort: {
        id: cohort.id,
        name: cohort.name,
        memberCount: cohort.members.length,
      },
      workspaces: workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        slug: w.slug,
        status: w.status,
        startupName: w.startupName,
        industry: w.industry,
        stage: w.stage,
        owner: {
          id: w.owner.id,
          displayName: w.owner.profile?.displayName || 'Unknown',
          avatarUrl: w.owner.profile?.avatarUrl,
        },
        documentCount: w._count.documents,
        latestReadiness: w.readinessScores[0]?.score || 0,
        updatedAt: w.updatedAt,
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Helper Methods
  // ─────────────────────────────────────────────────────────────────────────────

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }
}
