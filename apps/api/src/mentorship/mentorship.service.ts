import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AutomationService } from '../automation/automation.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class MentorshipService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly automation?: AutomationService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // Mentor Request Management
  // ─────────────────────────────────────────────────────────────────────────────

  async sendMentorRequest(requesterId: string, data: {
    mentorId: string;
    message: string;
    goals?: string;
    focusAreas?: string[];
    preferredFormat?: string;
    preferredTimes?: Record<string, unknown>;
    workspaceId?: string;
    programId?: string;
  }) {
    // Check if mentor exists and is accepting requests
    const mentorProfile = await this.prisma.mentorProfile.findUnique({
      where: { userId: data.mentorId },
    });

    if (!mentorProfile) {
      throw new NotFoundException('Mentor profile not found');
    }

    if (!mentorProfile.isActive || !mentorProfile.isAcceptingRequests) {
      throw new BadRequestException('Mentor is not accepting requests');
    }

    // Check for existing request
    const existing = await this.prisma.mentorRequest.findUnique({
      where: {
        requesterId_mentorId: {
          requesterId,
          mentorId: data.mentorId,
        },
      },
    });

    if (existing && existing.status === 'pending') {
      throw new BadRequestException('You already have a pending request to this mentor');
    }

    // Create or update request
    if (existing) {
      return this.prisma.mentorRequest.update({
        where: { id: existing.id },
        data: {
          message: data.message,
          goals: data.goals,
          focusAreas: data.focusAreas || [],
          preferredFormat: data.preferredFormat,
          preferredTimes: data.preferredTimes as Prisma.InputJsonValue,
          workspaceId: data.workspaceId,
          programId: data.programId,
          status: 'pending',
          responseMessage: null,
          respondedAt: null,
        },
      });
    }

    const created = await this.prisma.mentorRequest.create({
      data: {
        requesterId,
        mentorId: data.mentorId,
        message: data.message,
        goals: data.goals,
        focusAreas: data.focusAreas || [],
        preferredFormat: data.preferredFormat,
        preferredTimes: data.preferredTimes as Prisma.InputJsonValue,
        workspaceId: data.workspaceId,
        programId: data.programId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    this.automation?.fire({
      triggerType: 'mentor_request_submitted',
      targetUserId: data.mentorId,
      targetEntityType: 'mentor_request',
      targetEntityId: created.id,
      payload: { requesterId },
    }).catch(() => {});

    return created;
  }

  async respondToMentorRequest(mentorId: string, requestId: string, data: {
    accept: boolean;
    responseMessage?: string;
  }) {
    const request = await this.prisma.mentorRequest.findFirst({
      where: { id: requestId, mentorId },
    });

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException('Request has already been processed');
    }

    const updatedRequest = await this.prisma.mentorRequest.update({
      where: { id: requestId },
      data: {
        status: data.accept ? 'accepted' : 'declined',
        responseMessage: data.responseMessage,
        respondedAt: new Date(),
      },
    });

    // If accepted, create mentorship relationship
    if (data.accept) {
      await this.prisma.mentorshipRelationship.create({
        data: {
          mentorId,
          menteeId: request.requesterId,
          workspaceId: request.workspaceId,
          programId: request.programId,
          focusAreas: request.focusAreas,
          goalsJson: { initialGoals: request.goals },
        },
      });

      // Update mentor profile stats
      await this.prisma.mentorProfile.update({
        where: { userId: mentorId },
        data: { totalMentees: { increment: 1 } },
      });
    }

    if (data.accept) {
      this.automation?.fire({
        triggerType: 'mentor_request_accepted',
        targetUserId: request.requesterId,
        targetEntityType: 'mentor_request',
        targetEntityId: requestId,
        payload: { mentorId },
      }).catch(() => {});
    }

    return updatedRequest;
  }

  async getMyMentorRequests(userId: string, type: 'sent' | 'received') {
    if (type === 'sent') {
      return this.prisma.mentorRequest.findMany({
        where: { requesterId: userId },
        include: {
          mentor: {
            select: {
              id: true,
              email: true,
              profile: true,
              mentorProfile: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.mentorRequest.findMany({
      where: { mentorId: userId },
      include: {
        requester: {
          select: {
            id: true,
            email: true,
            profile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Mentorship Relationship Management
  // ─────────────────────────────────────────────────────────────────────────────

  async getMyMentorships(userId: string, role: 'mentor' | 'mentee') {
    const where = role === 'mentor'
      ? { mentorId: userId }
      : { menteeId: userId };

    return this.prisma.mentorshipRelationship.findMany({
      where: { ...where, status: { in: ['active', 'pending'] } },
      include: {
        mentor: {
          select: {
            id: true,
            email: true,
            profile: true,
            mentorProfile: true,
          },
        },
        mentee: {
          select: {
            id: true,
            email: true,
            profile: true,
          },
        },
        sessions: {
          take: 5,
          orderBy: { scheduledAt: 'desc' },
        },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async getMentorshipById(id: string, userId: string) {
    const relationship = await this.prisma.mentorshipRelationship.findUnique({
      where: { id },
      include: {
        mentor: {
          select: {
            id: true,
            email: true,
            profile: true,
            mentorProfile: true,
          },
        },
        mentee: {
          select: {
            id: true,
            email: true,
            profile: true,
          },
        },
        sessions: {
          orderBy: { scheduledAt: 'desc' },
        },
      },
    });

    if (!relationship) {
      throw new NotFoundException('Mentorship not found');
    }

    if (relationship.mentorId !== userId && relationship.menteeId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return relationship;
  }

  async updateMentorship(id: string, userId: string, data: {
    status?: string;
    goals?: Record<string, unknown>;
    focusAreas?: string[];
    mentorNotes?: string;
    menteeNotes?: string;
    nextSessionAt?: Date;
  }) {
    const relationship = await this.prisma.mentorshipRelationship.findUnique({
      where: { id },
    });

    if (!relationship) {
      throw new NotFoundException('Mentorship not found');
    }

    if (relationship.mentorId !== userId && relationship.menteeId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const updateData: Record<string, unknown> = {};

    if (data.status) updateData.status = data.status;
    if (data.goals) updateData.goals = data.goals;
    if (data.focusAreas) updateData.focusAreas = data.focusAreas;
    if (data.nextSessionAt) updateData.nextSessionAt = data.nextSessionAt;

    // Role-specific notes
    if (relationship.mentorId === userId && data.mentorNotes !== undefined) {
      updateData.mentorNotes = data.mentorNotes;
    }
    if (relationship.menteeId === userId && data.menteeNotes !== undefined) {
      updateData.menteeNotes = data.menteeNotes;
    }

    if (data.status === 'completed' || data.status === 'terminated') {
      updateData.endedAt = new Date();
    }

    return this.prisma.mentorshipRelationship.update({
      where: { id },
      data: updateData as any,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Session Management
  // ─────────────────────────────────────────────────────────────────────────────

  async scheduleSession(userId: string, relationshipId: string, data: {
    title?: string;
    description?: string;
    scheduledAt: Date;
    duration?: number;
    timezone?: string;
    meetingType?: string;
    meetingUrl?: string;
    meetingLocation?: string;
    agenda?: string;
  }) {
    const relationship = await this.prisma.mentorshipRelationship.findUnique({
      where: { id: relationshipId },
    });

    if (!relationship) {
      throw new NotFoundException('Mentorship not found');
    }

    if (relationship.mentorId !== userId && relationship.menteeId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const session = await this.prisma.mentorshipSession.create({
      data: {
        relationshipId,
        mentorId: relationship.mentorId,
        menteeId: relationship.menteeId,
        title: data.title,
        description: data.description,
        scheduledAt: data.scheduledAt,
        duration: data.duration || 30,
        timezone: data.timezone,
        meetingType: data.meetingType || 'video',
        meetingUrl: data.meetingUrl,
        meetingLocation: data.meetingLocation,
        agenda: data.agenda,
      },
    });

    // Update relationship
    await this.prisma.mentorshipRelationship.update({
      where: { id: relationshipId },
      data: { nextSessionAt: data.scheduledAt },
    });

    return session;
  }

  async updateSession(sessionId: string, userId: string, data: {
    title?: string;
    description?: string;
    scheduledAt?: Date;
    duration?: number;
    meetingType?: string;
    meetingUrl?: string;
    meetingLocation?: string;
    status?: string;
    agenda?: string;
    mentorNotes?: string;
    menteeNotes?: string;
    actionItems?: Record<string, unknown>[];
    mentorRating?: number;
    menteeRating?: number;
    mentorFeedback?: string;
    menteeFeedback?: string;
  }) {
    const session = await this.prisma.mentorshipSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.mentorId !== userId && session.menteeId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const updateData: Record<string, unknown> = {};

    // Common fields
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.scheduledAt !== undefined) updateData.scheduledAt = data.scheduledAt;
    if (data.duration !== undefined) updateData.duration = data.duration;
    if (data.meetingType !== undefined) updateData.meetingType = data.meetingType;
    if (data.meetingUrl !== undefined) updateData.meetingUrl = data.meetingUrl;
    if (data.meetingLocation !== undefined) updateData.meetingLocation = data.meetingLocation;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.agenda !== undefined) updateData.agenda = data.agenda;
    if (data.actionItems !== undefined) updateData.actionItems = data.actionItems;

    // Role-specific fields
    if (session.mentorId === userId) {
      if (data.mentorNotes !== undefined) updateData.mentorNotes = data.mentorNotes;
      if (data.mentorRating !== undefined) updateData.mentorRating = data.mentorRating;
      if (data.mentorFeedback !== undefined) updateData.mentorFeedback = data.mentorFeedback;
    }
    if (session.menteeId === userId) {
      if (data.menteeNotes !== undefined) updateData.menteeNotes = data.menteeNotes;
      if (data.menteeRating !== undefined) updateData.menteeRating = data.menteeRating;
      if (data.menteeFeedback !== undefined) updateData.menteeFeedback = data.menteeFeedback;
    }

    if (data.status === 'completed') {
      updateData.completedAt = new Date();

      // Update relationship stats
      await this.prisma.mentorshipRelationship.update({
        where: { id: session.relationshipId },
        data: {
          totalSessions: { increment: 1 },
          lastSessionAt: new Date(),
        },
      });

      // Update mentor profile stats
      await this.prisma.mentorProfile.update({
        where: { userId: session.mentorId },
        data: { totalSessions: { increment: 1 } },
      });
    }

    return this.prisma.mentorshipSession.update({
      where: { id: sessionId },
      data: updateData as any,
    });
  }

  async getSessionsByRelationship(relationshipId: string, userId: string) {
    const relationship = await this.prisma.mentorshipRelationship.findUnique({
      where: { id: relationshipId },
    });

    if (!relationship) {
      throw new NotFoundException('Mentorship not found');
    }

    if (relationship.mentorId !== userId && relationship.menteeId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.mentorshipSession.findMany({
      where: { relationshipId },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async getUpcomingSessions(userId: string) {
    return this.prisma.mentorshipSession.findMany({
      where: {
        OR: [{ mentorId: userId }, { menteeId: userId }],
        scheduledAt: { gte: new Date() },
        status: { in: ['scheduled', 'confirmed'] },
      },
      include: {
        relationship: {
          include: {
            mentor: { select: { id: true, profile: true } },
            mentee: { select: { id: true, profile: true } },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 10,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Mentor Discovery
  // ─────────────────────────────────────────────────────────────────────────────

  async discoverMentors(filters?: {
    industries?: string[];
    skills?: string[];
    startupStages?: string[];
    availabilityStatus?: string;
    isFree?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { industries, skills, startupStages, availabilityStatus, isFree, search, page = 1, limit = 20 } = filters || {};

    const where: Record<string, unknown> = {
      isActive: true,
      isAcceptingRequests: true,
    };

    if (availabilityStatus) {
      where.availabilityStatus = availabilityStatus;
    }

    if (isFree !== undefined) {
      where.isFree = isFree;
    }

    if (industries && industries.length > 0) {
      where.industries = { hasSome: industries };
    }

    if (skills && skills.length > 0) {
      where.skills = { hasSome: skills };
    }

    if (startupStages && startupStages.length > 0) {
      where.startupStages = { hasSome: startupStages };
    }

    if (search) {
      where.OR = [
        { headline: { contains: search, mode: 'insensitive' } },
        { bio: { contains: search, mode: 'insensitive' } },
        { expertiseSummary: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [mentors, total] = await Promise.all([
      this.prisma.mentorProfile.findMany({
        where: where as any,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              profile: true,
            },
          },
        },
        orderBy: [{ isVerified: 'desc' }, { avgRating: 'desc' }, { totalSessions: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.mentorProfile.count({ where: where as any }),
    ]);

    return {
      mentors,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getMentorProfile(userId: string) {
    return this.prisma.mentorProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: true,
          },
        },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Mentor Dashboard Stats
  // ─────────────────────────────────────────────────────────────────────────────

  async getMentorDashboardStats(mentorId: string) {
    const [
      profile,
      pendingRequests,
      activeMentorships,
      upcomingSessions,
      recentSessions,
    ] = await Promise.all([
      this.prisma.mentorProfile.findUnique({ where: { userId: mentorId } }),
      this.prisma.mentorRequest.count({
        where: { mentorId, status: 'pending' },
      }),
      this.prisma.mentorshipRelationship.count({
        where: { mentorId, status: 'active' },
      }),
      this.prisma.mentorshipSession.count({
        where: {
          mentorId,
          scheduledAt: { gte: new Date() },
          status: { in: ['scheduled', 'confirmed'] },
        },
      }),
      this.prisma.mentorshipSession.findMany({
        where: { mentorId, status: 'completed' },
        orderBy: { completedAt: 'desc' },
        take: 5,
        include: {
          mentee: { select: { id: true, profile: true } },
        },
      }),
    ]);

    return {
      profile,
      stats: {
        pendingRequests,
        activeMentorships,
        upcomingSessions,
        totalMentees: profile?.totalMentees || 0,
        totalSessions: profile?.totalSessions || 0,
        avgRating: profile?.avgRating || null,
      },
      recentSessions,
    };
  }
}
