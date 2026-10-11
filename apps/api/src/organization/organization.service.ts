import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

const PUBLIC_ORGANIZATION_SELECT = {
  id: true,
  type: true,
  name: true,
  slug: true,
  displayName: true,
  description: true,
  tagline: true,
  website: true,
  logoUrl: true,
  coverImageUrl: true,
  primaryColor: true,
  country: true,
  city: true,
  timezone: true,
  industries: true,
  stages: true,
  focusAreas: true,
  isVerified: true,
  isFeatured: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { memberships: true, programs: true } },
} satisfies Prisma.OrganizationSelect;

const ORGANIZATION_MEMBER_ROLES = [
  'owner',
  'admin',
  'program_manager',
  'mentor',
  'reviewer',
  'member',
] as const;

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, data: {
    type: string;
    name: string;
    slug: string;
    displayName?: string;
    description?: string;
    tagline?: string;
    website?: string;
    email?: string;
    phone?: string;
    logoUrl?: string;
    coverImageUrl?: string;
    primaryColor?: string;
    country?: string;
    city?: string;
    address?: string;
    timezone?: string;
    industries?: string[];
    stages?: string[];
    focusAreas?: string[];
    tenantId?: string;
  }) {
    // Check slug uniqueness
    const existing = await this.prisma.organization.findUnique({
      where: { slug: data.slug },
    });

    if (existing) {
      throw new BadRequestException('Organization slug already exists');
    }

    const organization = await this.prisma.organization.create({
      data: {
        createdById: userId,
        type: data.type as any,
        name: data.name,
        slug: data.slug,
        displayName: data.displayName,
        description: data.description,
        tagline: data.tagline,
        website: data.website,
        email: data.email,
        phone: data.phone,
        logoUrl: data.logoUrl,
        coverImageUrl: data.coverImageUrl,
        primaryColor: data.primaryColor,
        country: data.country,
        city: data.city,
        address: data.address,
        timezone: data.timezone,
        industries: data.industries || [],
        stages: data.stages || [],
        focusAreas: data.focusAreas || [],
        tenantId: data.tenantId,
      },
    });

    // Add creator as owner
    await this.prisma.organizationMembership.create({
      data: {
        organizationId: organization.id,
        userId,
        role: 'owner',
      },
    });

    return organization;
  }

  async findById(id: string, userId: string) {
    const membership = await this.prisma.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId: id, userId } },
      select: { isActive: true },
    });

    const org = membership?.isActive
      ? await this.prisma.organization.findUnique({
          where: { id },
          include: {
            memberships: {
              where: { isActive: true },
              include: { user: { select: { id: true, email: true, profile: true } } },
            },
            programs: true,
            _count: { select: { memberships: true, programs: true } },
          },
        })
      : await this.prisma.organization.findFirst({
          where: { id, isActive: true },
          select: PUBLIC_ORGANIZATION_SELECT,
        });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  async findBySlug(slug: string, userId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const membership = await this.prisma.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId: organization.id, userId } },
      select: { isActive: true },
    });

    const org = membership?.isActive
      ? await this.prisma.organization.findUnique({
          where: { id: organization.id },
          include: {
            programs: true,
            _count: { select: { memberships: true, programs: true } },
          },
        })
      : await this.prisma.organization.findFirst({
          where: { id: organization.id, isActive: true },
          select: {
            ...PUBLIC_ORGANIZATION_SELECT,
            programs: {
              where: { isPublic: true, status: { in: ['upcoming', 'active', 'completed'] } },
              select: {
                id: true,
                name: true,
                slug: true,
                shortDescription: true,
                programType: true,
                status: true,
                startDate: true,
                endDate: true,
                applicationDeadline: true,
                capacity: true,
                currentParticipants: true,
                logoUrl: true,
                coverImageUrl: true,
              },
            },
          },
        });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  async findAll(filters: {
    type?: string;
    isVerified?: boolean;
    isFeatured?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { type, isVerified, isFeatured, search, page = 1, limit = 20 } = filters;

    const where: Prisma.OrganizationWhereInput = {
      isActive: true,
      ...(type && { type: type as any }),
      ...(isVerified !== undefined && { isVerified }),
      ...(isFeatured !== undefined && { isFeatured }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { displayName: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [organizations, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        select: PUBLIC_ORGANIZATION_SELECT,
        orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.organization.count({ where }),
    ]);

    return {
      organizations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(id: string, userId: string, data: Partial<{
    name: string;
    displayName: string;
    description: string;
    tagline: string;
    website: string;
    email: string;
    phone: string;
    logoUrl: string;
    coverImageUrl: string;
    primaryColor: string;
    country: string;
    city: string;
    address: string;
    timezone: string;
    industries: string[];
    stages: string[];
    focusAreas: string[];
    settings: Record<string, unknown>;
  }>) {
    await this.checkAdminAccess(id, userId);

    const updateData: Prisma.OrganizationUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.tagline !== undefined) updateData.tagline = data.tagline;
    if (data.website !== undefined) updateData.website = data.website;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
    if (data.coverImageUrl !== undefined) updateData.coverImageUrl = data.coverImageUrl;
    if (data.primaryColor !== undefined) updateData.primaryColor = data.primaryColor;
    if (data.country !== undefined) updateData.country = data.country;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.timezone !== undefined) updateData.timezone = data.timezone;
    if (data.industries !== undefined) updateData.industries = data.industries;
    if (data.stages !== undefined) updateData.stages = data.stages;
    if (data.focusAreas !== undefined) updateData.focusAreas = data.focusAreas;
    if (data.settings !== undefined) updateData.settings = data.settings as Prisma.InputJsonValue;

    return this.prisma.organization.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string, userId: string) {
    const membership = await this.prisma.organizationMembership.findFirst({
      where: { organizationId: id, userId, role: 'owner', isActive: true },
    });

    if (!membership) {
      throw new ForbiddenException('Only owners can delete organizations');
    }

    await this.prisma.organization.update({
      where: { id },
      data: { isActive: false },
    });

    return { success: true };
  }

  // Membership management
  async addMember(orgId: string, adminUserId: string, data: {
    userId: string;
    role: string;
    title?: string;
    department?: string;
  }) {
    const actor = await this.checkAdminAccess(orgId, adminUserId);
    this.assertValidOrganizationRole(data.role);

    if (data.role === 'owner' && actor.role !== 'owner') {
      throw new ForbiddenException('Only owners can add another owner');
    }

    const existing = await this.prisma.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: data.userId } },
    });

    if (existing) {
      throw new BadRequestException('User is already a member');
    }

    return this.prisma.organizationMembership.create({
      data: {
        organizationId: orgId,
        userId: data.userId,
        role: data.role as any,
        title: data.title,
        department: data.department,
        invitedBy: adminUserId,
      },
    });
  }

  async updateMember(orgId: string, adminUserId: string, memberId: string, data: {
    role?: string;
    title?: string;
    department?: string;
    isActive?: boolean;
  }) {
    if (data.role !== undefined) {
      this.assertValidOrganizationRole(data.role);
    }

    return this.withSerializableTransaction(async (tx) => {
      const actor = await tx.organizationMembership.findFirst({
        where: {
          organizationId: orgId,
          userId: adminUserId,
          isActive: true,
          role: { in: ['owner', 'admin'] },
        },
      });

      if (!actor) {
        throw new ForbiddenException('Organization owner or admin access required');
      }

      const membership = await tx.organizationMembership.findFirst({
        where: { id: memberId, organizationId: orgId },
      });

      if (!membership) {
        throw new NotFoundException('Membership not found');
      }

      if ((membership.role === 'owner' || data.role === 'owner') && actor.role !== 'owner') {
        throw new ForbiddenException('Only owners can manage owner memberships');
      }

      const removesActiveOwner = membership.role === 'owner'
        && membership.isActive
        && (data.isActive === false || (data.role !== undefined && data.role !== 'owner'));

      if (removesActiveOwner) {
        await this.assertNotLastOwner(tx, orgId);
      }

      const updateData: Prisma.OrganizationMembershipUpdateInput = {};
      if (data.role !== undefined) updateData.role = data.role as any;
      if (data.title !== undefined) updateData.title = data.title;
      if (data.department !== undefined) updateData.department = data.department;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      return tx.organizationMembership.update({
        where: { id: membership.id },
        data: updateData,
      });
    });
  }

  async removeMember(orgId: string, adminUserId: string, memberId: string) {
    await this.withSerializableTransaction(async (tx) => {
      const actor = await tx.organizationMembership.findFirst({
        where: {
          organizationId: orgId,
          userId: adminUserId,
          isActive: true,
          role: { in: ['owner', 'admin'] },
        },
      });

      if (!actor) {
        throw new ForbiddenException('Organization owner or admin access required');
      }

      const membership = await tx.organizationMembership.findFirst({
        where: { id: memberId, organizationId: orgId },
      });

      if (!membership) {
        throw new NotFoundException('Membership not found');
      }

      if (membership.role === 'owner' && actor.role !== 'owner') {
        throw new ForbiddenException('Only owners can remove another owner');
      }

      if (membership.role === 'owner' && membership.isActive) {
        await this.assertNotLastOwner(tx, orgId);
      }

      if (membership.isActive) {
        await tx.organizationMembership.update({
          where: { id: membership.id },
          data: { isActive: false },
        });
      }
    });

    return { success: true };
  }

  async getMembers(
    orgId: string,
    requestingUserId: string,
    filters?: { role?: string; isActive?: boolean },
  ) {
    await this.checkMemberAccess(orgId, requestingUserId);

    return this.prisma.organizationMembership.findMany({
      where: {
        organizationId: orgId,
        ...(filters?.role && { role: filters.role as any }),
        ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
      },
      include: {
        user: { select: { id: true, email: true, profile: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async getUserOrganizations(userId: string) {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: { userId, isActive: true },
      include: {
        organization: {
          include: { _count: { select: { memberships: true, programs: true } } },
        },
      },
    });

    return memberships.map((m) => ({
      ...m.organization,
      memberRole: m.role,
      memberTitle: m.title,
    }));
  }

  // Mentor pool management
  async addMentorToPool(orgId: string, adminUserId: string, data: {
    userId: string;
    expertiseAreas?: string[];
    maxMentees?: number;
  }) {
    await this.checkAdminAccess(orgId, adminUserId);

    return this.prisma.organizationMentor.create({
      data: {
        organizationId: orgId,
        userId: data.userId,
        expertiseAreas: data.expertiseAreas || [],
        maxMentees: data.maxMentees,
        assignedBy: adminUserId,
      },
    });
  }

  /**
   * The organisation's mentor pool, with the people in it.
   *
   * This returned bare `OrganizationMentor` rows — an id, a user id and a
   * count — so the only screen that wanted it could not name a single mentor
   * and showed a fixed list instead. The profile is what makes the pool
   * usable, so it is joined here rather than left to N follow-up requests.
   */
  async getMentorPool(orgId: string, requestingUserId: string) {
    await this.checkMemberAccess(orgId, requestingUserId);

    const mentors = await this.prisma.organizationMentor.findMany({
      where: { organizationId: orgId, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true, headline: true } },
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    return {
      mentors: mentors.map((mentor) => ({
        id: mentor.id,
        userId: mentor.userId,
        displayName: mentor.user.profile?.displayName ?? null,
        avatarUrl: mentor.user.profile?.avatarUrl ?? null,
        headline: mentor.user.profile?.headline ?? null,
        expertiseAreas: mentor.expertiseAreas,
        maxMentees: mentor.maxMentees,
        currentMentees: mentor.currentMentees,
        isActive: mentor.isActive,
        assignedAt: mentor.assignedAt.toISOString(),
      })),
    };
  }

  // Helper methods
  async checkAdminAccess(orgId: string, userId: string) {
    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        organizationId: orgId,
        userId,
        isActive: true,
        role: { in: ['owner', 'admin'] },
      },
    });

    if (!membership) {
      throw new ForbiddenException('Organization owner or admin access required');
    }

    return membership;
  }

  async checkMemberAccess(orgId: string, userId: string) {
    const membership = await this.prisma.organizationMembership.findFirst({
      where: { organizationId: orgId, userId, isActive: true },
    });

    if (!membership) {
      throw new ForbiddenException('Membership required');
    }

    return membership;
  }

  private assertValidOrganizationRole(role: string) {
    if (!ORGANIZATION_MEMBER_ROLES.includes(role as (typeof ORGANIZATION_MEMBER_ROLES)[number])) {
      throw new BadRequestException('Invalid organization member role');
    }
  }

  private async assertNotLastOwner(tx: Prisma.TransactionClient, orgId: string) {
    const ownerCount = await tx.organizationMembership.count({
      where: { organizationId: orgId, role: 'owner', isActive: true },
    });

    if (ownerCount <= 1) {
      throw new BadRequestException('Cannot remove or demote the last active owner');
    }
  }

  private async withSerializableTransaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        const shouldRetry = error instanceof Prisma.PrismaClientKnownRequestError
          && error.code === 'P2034'
          && attempt < maxAttempts;
        if (!shouldRetry) throw error;
      }
    }

    throw new Error('Organization membership transaction retry limit exceeded');
  }
}
