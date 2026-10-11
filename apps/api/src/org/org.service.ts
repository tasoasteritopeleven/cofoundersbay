import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrgService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserMemberships(userId: string) {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        organizationId: true,
        role: true,
        organization: {
          select: { id: true, name: true, slug: true, logoUrl: true },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return {
      memberships: memberships.map(({ organization, ...membership }) => ({
        ...membership,
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          avatarUrl: organization.logoUrl,
        },
      })),
    };
  }

  async getOrgProfile(slug: string) {
    // Use findFirst so we can filter by both slug and role
    const org = await this.prisma.user.findFirst({
      where: { slug, role: 'org' },
      include: {
        profile: true,
        _count: {
          select: {
            opportunities: true,
            cohortsOrganized: true,
            eventsCreated: true,
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const totalMembers = await this.prisma.cohortMember.count({
      where: { cohort: { organizerId: org.id } },
    });

    return {
      org: {
        id: org.id,
        name: org.profile?.displayName ?? org.email,
        slug: org.slug,
        tagline: org.profile?.headline ?? null,
        description: org.profile?.bio ?? null,
        mission: (org.profile as any)?.mission ?? null,
        avatarUrl: org.profile?.avatarUrl ?? null,
        website: (org.profile as any)?.website ?? null,
        email: org.email,
        location: org.profile?.location ?? null,
        industry: (org.profile as any)?.industry ?? null,
        focus: (org.profile as any)?.focus ?? null,
        size: (org.profile as any)?.size ?? null,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
        _count: {
          opportunities: org._count.opportunities,
          cohorts: org._count.cohortsOrganized,
          members: totalMembers,
          events: org._count.eventsCreated,
        },
      },
    };
  }

  async getOrgOpportunities(slug: string, params?: { limit?: number; offset?: number }) {
    const org = await this.prisma.user.findFirst({
      where: { slug, role: 'org' },
      select: { id: true },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const [opportunities, total] = await Promise.all([
      this.prisma.opportunity.findMany({
        where: { createdById: org.id },
        include: {
          createdBy: {
            select: {
              id: true,
              profile: { select: { displayName: true, avatarUrl: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: params?.limit ?? 20,
        skip: params?.offset ?? 0,
      }),
      this.prisma.opportunity.count({ where: { createdById: org.id } }),
    ]);

    return {
      opportunities: opportunities.map((opp) => ({
        id: opp.id,
        title: opp.title,
        description: opp.description,
        type: opp.type,
        company: opp.company,
        location: opp.location,
        isRemote: opp.isRemote,
        url: opp.url,
        tags: opp.tags,
        deadline: opp.deadline,
        isActive: opp.isActive,
        createdAt: opp.createdAt,
        updatedAt: opp.updatedAt,
        createdById: opp.createdById,
        createdBy: {
          id: opp.createdBy.id,
          name: opp.createdBy.profile?.displayName ?? null,
          avatarUrl: opp.createdBy.profile?.avatarUrl ?? null,
        },
      })),
      total,
    };
  }

  async getOrgCohorts(slug: string, params?: { limit?: number; offset?: number }) {
    const org = await this.prisma.user.findFirst({
      where: { slug, role: 'org' },
      select: { id: true },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const [cohorts, total] = await Promise.all([
      this.prisma.cohort.findMany({
        where: { organizerId: org.id },
        include: {
          _count: { select: { members: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: params?.limit ?? 20,
        skip: params?.offset ?? 0,
      }),
      this.prisma.cohort.count({ where: { organizerId: org.id } }),
    ]);

    return { cohorts, total };
  }

  /**
   * One cohort, with everything its dashboard describes.
   *
   * The page asked for participants, the matches between them, the mentoring
   * they do with each other and the totals over all three. Each is already
   * stored; what was missing was a route that scoped them to a cohort. They
   * are fetched together because a detail page that fires five requests is a
   * detail page that flickers through five loading states.
   *
   * Matches and sessions are filtered to pairs where *both* people are in this
   * cohort - a participant's matches with the outside world are their own
   * business, not the programme's.
   */
  async getOrgCohortDetail(slug: string, cohortId: string) {
    const org = await this.prisma.user.findFirst({
      where: { slug, role: 'org' },
      select: { id: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
      include: { _count: { select: { members: true } } },
    });
    // Scoped by organiser as well as id, so one organisation cannot read
    // another's cohort by guessing a uuid.
    if (!cohort || cohort.organizerId !== org.id) {
      throw new NotFoundException('Cohort not found');
    }

    const members = await this.prisma.cohortMember.findMany({
      where: { cohortId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            moderationStatus: true,
            emailVerified: true,
            profile: {
              select: { displayName: true, headline: true, avatarUrl: true, location: true },
            },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    const memberIds = members.map((m) => m.userId);

    const [suggestions, sessions] = await Promise.all([
      memberIds.length
        ? this.prisma.matchSuggestion.findMany({
            where: {
              sourceUserId: { in: memberIds },
              targetUserId: { in: memberIds },
            },
            include: {
              sourceUser: { select: { id: true, role: true, profile: { select: { displayName: true, avatarUrl: true } } } },
              targetUser: { select: { id: true, role: true, profile: { select: { displayName: true, avatarUrl: true } } } },
            },
            orderBy: { overallScore: 'desc' },
            take: 100,
          })
        : Promise.resolve([]),
      memberIds.length
        ? this.prisma.mentorshipSession.findMany({
            where: {
              mentorId: { in: memberIds },
              menteeId: { in: memberIds },
            },
            include: {
              mentor: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
              mentee: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
            },
            orderBy: { scheduledAt: 'desc' },
            take: 100,
          })
        : Promise.resolve([]),
    ]);

    const participants = members.map((m) => ({
      id: m.id,
      userId: m.userId,
      // The cohort's own word for the person wins: someone can be a founder on
      // the platform and a mentor in this programme.
      role:
        m.role === 'mentor'
          ? 'mentor'
          : m.user.role === 'investor'
            ? 'investor'
            : m.user.role === 'mentor'
              ? 'mentor'
              : 'founder',
      cohortRole: m.role,
      name: m.user.profile?.displayName ?? null,
      email: m.user.email,
      // A founder's headline is the line they write about what they are
      // building; there is no separate startup-name column.
      headline: m.user.profile?.headline ?? null,
      avatarUrl: m.user.profile?.avatarUrl ?? null,
      location: m.user.profile?.location ?? null,
      joinedAt: m.joinedAt,
      status:
        m.user.moderationStatus !== 'active'
          ? 'inactive'
          : m.user.emailVerified
            ? 'active'
            : 'pending',
    }));

    const matches = suggestions.map((row) => ({
      id: row.id,
      a: {
        id: row.sourceUserId,
        name: row.sourceUser?.profile?.displayName ?? null,
        role: row.sourceUser?.role ?? null,
        avatarUrl: row.sourceUser?.profile?.avatarUrl ?? null,
      },
      b: {
        id: row.targetUserId,
        name: row.targetUser?.profile?.displayName ?? null,
        role: row.targetUser?.role ?? null,
        avatarUrl: row.targetUser?.profile?.avatarUrl ?? null,
      },
      score: Math.round(row.overallScore),
      status: row.status,
      generatedAt: row.generatedAt,
      reasons: row.reasons ?? [],
    }));

    const shapedSessions = sessions.map((row) => ({
      id: row.id,
      mentor: {
        id: row.mentorId,
        name: row.mentor?.profile?.displayName ?? null,
        avatarUrl: row.mentor?.profile?.avatarUrl ?? null,
      },
      mentee: {
        id: row.menteeId,
        name: row.mentee?.profile?.displayName ?? null,
        avatarUrl: row.mentee?.profile?.avatarUrl ?? null,
      },
      title: row.title ?? null,
      scheduledAt: row.scheduledAt,
      duration: row.duration,
      status: row.status,
      // The mentee's rating: the programme is measuring what the participant
      // got out of it, not what the mentor thought of them.
      rating: (row as { menteeRating?: number | null }).menteeRating ?? null,
    }));

    const now = new Date();
    const scores = matches.map((m) => m.score);
    const ratedSessions = shapedSessions
      .map((x) => x.rating)
      .filter((r): r is number => r != null);

    return {
      cohort: {
        id: cohort.id,
        name: cohort.name,
        slug: cohort.slug,
        description: cohort.description,
        startDate: cohort.startDate,
        endDate: cohort.endDate,
        capacity: cohort.capacity,
        isPublic: cohort.isPublic,
        isActive: cohort.isActive,
        imageUrl: cohort.imageUrl,
        tags: Array.isArray(cohort.tags) ? (cohort.tags as string[]) : [],
        organizerId: cohort.organizerId,
        createdAt: cohort.createdAt,
      },
      participants,
      matches,
      sessions: shapedSessions,
      stats: {
        participants: participants.length,
        founders: participants.filter((p) => p.role === 'founder').length,
        mentors: participants.filter((p) => p.role === 'mentor').length,
        investors: participants.filter((p) => p.role === 'investor').length,
        completedSessions: shapedSessions.filter((x) => x.status === 'completed').length,
        upcomingSessions: shapedSessions.filter(
          (x) => x.status === 'scheduled' && new Date(x.scheduledAt) >= now,
        ).length,
        matches: matches.length,
        // "Successful" is the suggestion that actually became a connection.
        connectedMatches: matches.filter((m) => m.status === 'connected').length,
        // Null rather than zero: no matches is not an average of zero.
        avgMatchScore: scores.length
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : null,
        avgSessionRating: ratedSessions.length
          ? Number(
              (ratedSessions.reduce((a, b) => a + b, 0) / ratedSessions.length).toFixed(1),
            )
          : null,
      },
    };
  }

  async getOrgMembers(slug: string, params?: { limit?: number; offset?: number }) {
    const org = await this.prisma.user.findFirst({
      where: { slug, role: 'org' },
      select: { id: true },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    // Get members from all cohorts organized by this org
    const [members, total] = await Promise.all([
      this.prisma.cohortMember.findMany({
        where: { cohort: { organizerId: org.id } },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              profile: {
                select: {
                  displayName: true,
                  avatarUrl: true,
                  headline: true,
                  location: true,
                },
              },
            },
          },
          cohort: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
        take: params?.limit ?? 50,
        skip: params?.offset ?? 0,
      }),
      this.prisma.cohortMember.count({
        where: { cohort: { organizerId: org.id } },
      }),
    ]);

    // Deduplicate members (a user might be in multiple cohorts)
    const uniqueMembers = new Map<string, typeof members[0]>();
    for (const member of members) {
      if (!uniqueMembers.has(member.userId)) {
        uniqueMembers.set(member.userId, member);
      }
    }

    return {
      members: Array.from(uniqueMembers.values()).map((m) => ({
        id: m.user.id,
        displayName: m.user.profile?.displayName ?? m.user.email,
        avatarUrl: m.user.profile?.avatarUrl ?? null,
        headline: m.user.profile?.headline ?? null,
        location: m.user.profile?.location ?? null,
        role: m.user.role,
        cohortName: m.cohort.name,
        joinedAt: m.joinedAt,
      })),
      total,
    };
  }
}
