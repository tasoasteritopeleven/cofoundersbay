import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationService } from './organization.service';
import { Prisma } from '@prisma/client';

const PUBLIC_PROGRAM_STATUSES = ['upcoming', 'active', 'completed'] as const;
const PROGRAM_STATUSES = ['draft', 'upcoming', 'active', 'completed', 'archived'] as const;
const PARTICIPANT_STATUSES = ['applied', 'accepted', 'active', 'completed', 'dropped', 'rejected'] as const;
const PARTICIPANT_ROLES = ['participant', 'mentor', 'judge', 'organizer', 'reviewer', 'observer'] as const;

const PUBLIC_PROGRAM_SELECT = {
  id: true,
  organizationId: true,
  name: true,
  slug: true,
  description: true,
  shortDescription: true,
  programType: true,
  status: true,
  startDate: true,
  endDate: true,
  applicationDeadline: true,
  capacity: true,
  currentParticipants: true,
  isPublic: true,
  isFeatured: true,
  logoUrl: true,
  coverImageUrl: true,
  curriculum: true,
  requirements: true,
  benefits: true,
  createdAt: true,
  updatedAt: true,
  organization: {
    select: { id: true, type: true, name: true, displayName: true, slug: true, logoUrl: true },
  },
  milestones: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      id: true,
      title: true,
      description: true,
      dueDate: true,
      sortOrder: true,
      isRequired: true,
    },
  },
  _count: { select: { participants: true } },
} satisfies Prisma.ProgramSelect;

@Injectable()
export class ProgramService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationService: OrganizationService,
  ) {}

  async create(userId: string, orgId: string, data: {
    name: string;
    slug: string;
    description?: string;
    shortDescription?: string;
    programType: string;
    startDate?: Date;
    endDate?: Date;
    applicationDeadline?: Date;
    capacity?: number;
    isPublic?: boolean;
    logoUrl?: string;
    coverImageUrl?: string;
    curriculum?: Record<string, unknown>;
    requirements?: Record<string, unknown>;
    benefits?: Record<string, unknown>;
    settings?: Record<string, unknown>;
  }) {
    await this.organizationService.checkAdminAccess(orgId, userId);

    // Check slug uniqueness within org
    const existing = await this.prisma.program.findFirst({
      where: { organizationId: orgId, slug: data.slug },
    });

    if (existing) {
      throw new BadRequestException('Program slug already exists in this organization');
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });

    return this.prisma.program.create({
      data: {
        organizationId: orgId,
        createdById: userId,
        tenantId: org?.tenantId,
        name: data.name,
        slug: data.slug,
        description: data.description,
        shortDescription: data.shortDescription,
        programType: data.programType as any,
        startDate: data.startDate,
        endDate: data.endDate,
        applicationDeadline: data.applicationDeadline,
        capacity: data.capacity,
        isPublic: data.isPublic ?? true,
        logoUrl: data.logoUrl,
        coverImageUrl: data.coverImageUrl,
        curriculum: data.curriculum as Prisma.InputJsonValue,
        requirements: data.requirements as Prisma.InputJsonValue,
        benefits: data.benefits as Prisma.InputJsonValue,
        settings: data.settings as Prisma.InputJsonValue,
      },
    });
  }

  async findById(id: string, userId: string) {
    const scope = await this.prisma.program.findUnique({
      where: { id },
      select: {
        organizationId: true,
        isPublic: true,
        status: true,
        organization: { select: { isActive: true } },
      },
    });

    if (!scope) {
      throw new NotFoundException('Program not found');
    }

    const membership = await this.prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: { organizationId: scope.organizationId, userId },
      },
      select: { isActive: true },
    });

    const isPubliclyVisible = scope.organization.isActive
      && scope.isPublic
      && PUBLIC_PROGRAM_STATUSES.includes(scope.status as (typeof PUBLIC_PROGRAM_STATUSES)[number]);

    if (!membership?.isActive && !isPubliclyVisible) {
      // A private program is deliberately indistinguishable from a missing one.
      throw new NotFoundException('Program not found');
    }

    const program = membership?.isActive
      ? await this.prisma.program.findUnique({
          where: { id },
          include: {
            organization: true,
            participants: {
              include: { user: { select: { id: true, email: true, profile: true } } },
            },
            milestones: { orderBy: { sortOrder: 'asc' } },
            _count: { select: { participants: true } },
          },
        })
      : await this.prisma.program.findUnique({
          where: { id },
          select: PUBLIC_PROGRAM_SELECT,
        });

    if (!program) {
      throw new NotFoundException('Program not found');
    }

    return program;
  }

  async findByOrganization(orgId: string, userId: string, filters?: {
    status?: string;
    programType?: string;
    isPublic?: boolean;
  }) {
    const membership = await this.prisma.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      select: { isActive: true },
    });

    if (membership?.isActive) {
      return this.prisma.program.findMany({
        where: {
          organizationId: orgId,
          ...(filters?.status && { status: filters.status as any }),
          ...(filters?.programType && { programType: filters.programType as any }),
          ...(filters?.isPublic !== undefined && { isPublic: filters.isPublic }),
        },
        include: { _count: { select: { participants: true } } },
        orderBy: { startDate: 'desc' },
      });
    }

    if (filters?.isPublic === false
      || (filters?.status !== undefined
        && !PUBLIC_PROGRAM_STATUSES.includes(filters.status as (typeof PUBLIC_PROGRAM_STATUSES)[number]))) {
      return [];
    }

    return this.prisma.program.findMany({
      where: {
        organizationId: orgId,
        organization: { isActive: true },
        isPublic: true,
        status: filters?.status
          ? filters.status as any
          : { in: [...PUBLIC_PROGRAM_STATUSES] as any },
        ...(filters?.programType && { programType: filters.programType as any }),
      },
      select: PUBLIC_PROGRAM_SELECT,
      orderBy: { startDate: 'desc' },
    });
  }

  async findPublicPrograms(filters?: {
    programType?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { programType, search, page = 1, limit = 20 } = filters || {};

    const where = {
      isPublic: true,
      status: { in: ['upcoming', 'active'] as any },
      organization: { isActive: true },
      ...(programType && { programType: programType as any }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [programs, total] = await Promise.all([
      this.prisma.program.findMany({
        where,
        select: PUBLIC_PROGRAM_SELECT,
        orderBy: [{ isFeatured: 'desc' }, { startDate: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.program.count({ where }),
    ]);

    return {
      programs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async update(id: string, userId: string, data: Partial<{
    name: string;
    description: string;
    shortDescription: string;
    status: string;
    startDate: Date;
    endDate: Date;
    applicationDeadline: Date;
    capacity: number;
    isPublic: boolean;
    isFeatured: boolean;
    logoUrl: string;
    coverImageUrl: string;
    curriculum: Record<string, unknown>;
    requirements: Record<string, unknown>;
    benefits: Record<string, unknown>;
    settings: Record<string, unknown>;
  }>) {
    const program = await this.prisma.program.findUnique({
      where: { id },
    });

    if (!program) {
      throw new NotFoundException('Program not found');
    }

    await this.organizationService.checkAdminAccess(program.organizationId, userId);

    if (data.status !== undefined && !PROGRAM_STATUSES.includes(data.status as (typeof PROGRAM_STATUSES)[number])) {
      throw new BadRequestException('Invalid program status');
    }

    const updateData: Prisma.ProgramUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.shortDescription !== undefined) updateData.shortDescription = data.shortDescription;
    if (data.status !== undefined) updateData.status = data.status as any;
    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.endDate !== undefined) updateData.endDate = data.endDate;
    if (data.applicationDeadline !== undefined) updateData.applicationDeadline = data.applicationDeadline;
    if (data.capacity !== undefined) updateData.capacity = data.capacity;
    if (data.isPublic !== undefined) updateData.isPublic = data.isPublic;
    if (data.isFeatured !== undefined) updateData.isFeatured = data.isFeatured;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
    if (data.coverImageUrl !== undefined) updateData.coverImageUrl = data.coverImageUrl;
    if (data.curriculum !== undefined) updateData.curriculum = data.curriculum as Prisma.InputJsonValue;
    if (data.requirements !== undefined) updateData.requirements = data.requirements as Prisma.InputJsonValue;
    if (data.benefits !== undefined) updateData.benefits = data.benefits as Prisma.InputJsonValue;
    if (data.settings !== undefined) updateData.settings = data.settings as Prisma.InputJsonValue;

    return this.prisma.program.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string, userId: string) {
    const program = await this.prisma.program.findUnique({
      where: { id },
    });

    if (!program) {
      throw new NotFoundException('Program not found');
    }

    await this.organizationService.checkAdminAccess(program.organizationId, userId);

    // Soft delete by archiving
    return this.prisma.program.update({
      where: { id },
      data: { status: 'archived' },
    });
  }

  // Participant management
  async applyToProgram(programId: string, userId: string, application?: Record<string, unknown>) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
    });

    if (!program) {
      throw new NotFoundException('Program not found');
    }

    if (!program.isPublic) {
      await this.organizationService.checkMemberAccess(program.organizationId, userId);
    }

    if (program.status !== 'upcoming' && program.status !== 'active') {
      throw new BadRequestException('Program is not accepting applications');
    }

    if (program.applicationDeadline && new Date() > program.applicationDeadline) {
      throw new BadRequestException('Application deadline has passed');
    }

    const existing = await this.prisma.programParticipant.findFirst({
      where: { programId, userId },
    });

    if (existing) {
      throw new BadRequestException('Already applied to this program');
    }

    return this.prisma.programParticipant.create({
      data: {
        programId,
        userId,
        application: application as Prisma.InputJsonValue,
        appliedAt: new Date(),
      },
    });
  }

  async updateParticipant(programId: string, adminUserId: string, participantId: string, data: {
    status?: string;
    role?: string;
    progress?: number;
    score?: number;
    rank?: number;
    notes?: string;
    feedback?: Record<string, unknown>;
  }) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
    });

    if (!program) {
      throw new NotFoundException('Program not found');
    }

    await this.organizationService.checkAdminAccess(program.organizationId, adminUserId);

    if (data.status !== undefined
      && !PARTICIPANT_STATUSES.includes(data.status as (typeof PARTICIPANT_STATUSES)[number])) {
      throw new BadRequestException('Invalid participant status');
    }
    if (data.role !== undefined
      && !PARTICIPANT_ROLES.includes(data.role as (typeof PARTICIPANT_ROLES)[number])) {
      throw new BadRequestException('Invalid participant role');
    }

    const participant = await this.prisma.programParticipant.findFirst({
      where: { id: participantId, programId },
      select: { id: true },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    const updateData: Prisma.ProgramParticipantUpdateInput = {};
    if (data.status !== undefined) updateData.status = data.status as any;
    if (data.role !== undefined) updateData.role = data.role as any;
    if (data.progress !== undefined) updateData.progress = data.progress;
    if (data.score !== undefined) updateData.score = data.score;
    if (data.rank !== undefined) updateData.rank = data.rank;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.feedback !== undefined) updateData.feedback = data.feedback as Prisma.InputJsonValue;
    if (data.status === 'accepted') {
      updateData.acceptedAt = new Date();
    } else if (data.status === 'completed') {
      updateData.completedAt = new Date();
    }

    return this.prisma.programParticipant.update({
      where: { id: participant.id },
      data: updateData,
    });
  }

  /**
   * A program's participants, applicants included — `status` is what separates
   * them.
   *
   * Returned a bare array while its only client (`getProgramParticipants` in
   * the web) declared `{ participants }`, so every caller read `undefined`.
   * `apiRequest` casts without checking, which is exactly why that mismatch
   * could sit there unnoticed. The envelope matches every neighbouring
   * endpoint and leaves room for a total later.
   *
   * The whole `profile` relation was spread into the response; only four of
   * its fields are ever read, and one of the rest is the person's email.
   */
  async getParticipants(programId: string, requestingUserId: string, filters?: {
    status?: string;
    role?: string;
  }) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      select: { organizationId: true },
    });

    if (!program) {
      throw new NotFoundException('Program not found');
    }

    await this.organizationService.checkMemberAccess(program.organizationId, requestingUserId);

    const participants = await this.prisma.programParticipant.findMany({
      where: {
        programId,
        ...(filters?.status && { status: filters.status as any }),
        ...(filters?.role && { role: filters.role as any }),
      },
      include: {
        user: {
          select: {
            id: true,
            profile: {
              select: { displayName: true, avatarUrl: true, headline: true, location: true },
            },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return {
      participants: participants.map((participant) => ({
        id: participant.id,
        userId: participant.userId,
        status: participant.status,
        role: participant.role,
        appliedAt: participant.joinedAt.toISOString(),
        acceptedAt: participant.acceptedAt?.toISOString() ?? null,
        completedAt: participant.completedAt?.toISOString() ?? null,
        score: participant.score ?? null,
        // The relation is optional in the schema: a participant whose account
        // has gone still belongs in the list, without a person attached.
        user: {
          id: participant.user?.id ?? participant.userId,
          profile: participant.user?.profile
            ? {
                displayName: participant.user.profile.displayName,
                avatarUrl: participant.user.profile.avatarUrl,
                headline: participant.user.profile.headline,
                location: participant.user.profile.location,
              }
            : null,
        },
      })),
    };
  }

  async getUserPrograms(userId: string) {
    return this.prisma.programParticipant.findMany({
      where: { userId },
      include: {
        program: {
          include: {
            organization: { select: { id: true, name: true, logoUrl: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });
  }

  // Milestone management
  async addMilestone(programId: string, userId: string, data: {
    title: string;
    description?: string;
    dueDate?: Date;
    sortOrder?: number;
    requirements?: Record<string, unknown>;
    deliverables?: Record<string, unknown>;
    isRequired?: boolean;
  }) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
    });

    if (!program) {
      throw new NotFoundException('Program not found');
    }

    await this.organizationService.checkAdminAccess(program.organizationId, userId);

    return this.prisma.programMilestone.create({
      data: {
        programId,
        title: data.title,
        description: data.description,
        dueDate: data.dueDate,
        sortOrder: data.sortOrder ?? 0,
        requirements: data.requirements as Prisma.InputJsonValue,
        deliverables: data.deliverables as Prisma.InputJsonValue,
        isRequired: data.isRequired ?? true,
      },
    });
  }

  async updateMilestone(milestoneId: string, userId: string, data: Partial<{
    title: string;
    description: string;
    dueDate: Date;
    sortOrder: number;
    requirements: Record<string, unknown>;
    deliverables: Record<string, unknown>;
    isRequired: boolean;
  }>) {
    const milestone = await this.prisma.programMilestone.findUnique({
      where: { id: milestoneId },
      include: { program: true },
    });

    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    await this.organizationService.checkAdminAccess(milestone.program.organizationId, userId);

    const updateData: Prisma.ProgramMilestoneUpdateInput = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
    if (data.requirements !== undefined) updateData.requirements = data.requirements as Prisma.InputJsonValue;
    if (data.deliverables !== undefined) updateData.deliverables = data.deliverables as Prisma.InputJsonValue;
    if (data.isRequired !== undefined) updateData.isRequired = data.isRequired;

    return this.prisma.programMilestone.update({
      where: { id: milestoneId },
      data: updateData,
    });
  }

  async deleteMilestone(milestoneId: string, userId: string) {
    const milestone = await this.prisma.programMilestone.findUnique({
      where: { id: milestoneId },
      include: { program: true },
    });

    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    await this.organizationService.checkAdminAccess(milestone.program.organizationId, userId);

    await this.prisma.programMilestone.delete({
      where: { id: milestoneId },
    });

    return { success: true };
  }
}
