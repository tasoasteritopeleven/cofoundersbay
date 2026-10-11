import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { endorsementBasis, type EndorsementBasis } from '@cofounderbay/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

export type EndorsementDto = {
  id: string;
  fromUserId: string;
  fromUser: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    headline: string | null;
  };
  toUserId: string;
  /** Present on the giver's list, where the other person is the recipient. */
  toUser?: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    headline: string | null;
  };
  skill: string | null;
  content: string;
  relationship: string | null;
  isPublic: boolean;
  isApproved: boolean;
  /**
   * What the platform can see of the relationship it speaks to: agreed terms
   * on a commitment ladder, a completed mentoring session, a shared cohort.
   * Empty for an endorsement written without one; those keep working.
   */
  basis: EndorsementBasis[];
  createdAt: string;
};

const profileSelect = {
  select: {
    id: true,
    profile: { select: { displayName: true, avatarUrl: true, headline: true } },
  },
} as const;

const basisOf = (row: { basis?: string[] | null }): EndorsementBasis[] =>
  (row.basis ?? []).filter((b): b is EndorsementBasis => b === 'agreement' || b === 'mentoring' || b === 'cohort');

@Injectable()
export class EndorsementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async getEndorsementsForUser(
    userId: string,
    options?: { includeUnapproved?: boolean; viewerId?: string },
  ): Promise<EndorsementDto[]> {
    const where: { toUserId: string; isApproved?: boolean; isPublic?: boolean } = { toUserId: userId };

    if (!options?.includeUnapproved) {
      where.isApproved = true;
      where.isPublic = true;
    } else if (options.viewerId !== userId) {
      // Only the recipient can see unapproved endorsements
      where.isApproved = true;
      where.isPublic = true;
    }

    const endorsements = await this.prisma.endorsement.findMany({
      where,
      include: {
        fromUser: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true, headline: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return endorsements.map((e) => ({
      id: e.id,
      fromUserId: e.fromUserId,
      fromUser: {
        id: e.fromUser.id,
        displayName: e.fromUser.profile?.displayName ?? 'Unknown',
        avatarUrl: e.fromUser.profile?.avatarUrl ?? null,
        headline: e.fromUser.profile?.headline ?? null,
      },
      toUserId: e.toUserId,
      skill: e.skill,
      content: e.content,
      relationship: e.relationship,
      isPublic: e.isPublic,
      isApproved: e.isApproved,
      basis: basisOf(e),
      createdAt: e.createdAt.toISOString(),
    }));
  }

  async getPendingEndorsements(userId: string): Promise<EndorsementDto[]> {
    const endorsements = await this.prisma.endorsement.findMany({
      where: { toUserId: userId, isApproved: false },
      include: {
        fromUser: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true, headline: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return endorsements.map((e) => ({
      id: e.id,
      fromUserId: e.fromUserId,
      fromUser: {
        id: e.fromUser.id,
        displayName: e.fromUser.profile?.displayName ?? 'Unknown',
        avatarUrl: e.fromUser.profile?.avatarUrl ?? null,
        headline: e.fromUser.profile?.headline ?? null,
      },
      toUserId: e.toUserId,
      skill: e.skill,
      content: e.content,
      relationship: e.relationship,
      isPublic: e.isPublic,
      isApproved: e.isApproved,
      basis: basisOf(e),
      createdAt: e.createdAt.toISOString(),
    }));
  }

  /**
   * What the reader has written for others, approved or not. The count was
   * already served by `getEndorsementStats` as `given`, but no read listed
   * them, so the Given tab could only ever be empty for a real account.
   * Only the giver asks for this, so unapproved and private ones are theirs
   * to see; the recipient's approval state is carried so the list can say
   * which are still waiting.
   */
  async getGivenEndorsements(userId: string): Promise<EndorsementDto[]> {
    const endorsements = await this.prisma.endorsement.findMany({
      where: { fromUserId: userId },
      include: { fromUser: profileSelect, toUser: profileSelect },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return endorsements.map((e) => ({
      id: e.id,
      fromUserId: e.fromUserId,
      fromUser: {
        id: e.fromUser.id,
        displayName: e.fromUser.profile?.displayName ?? 'Unknown',
        avatarUrl: e.fromUser.profile?.avatarUrl ?? null,
        headline: e.fromUser.profile?.headline ?? null,
      },
      toUserId: e.toUserId,
      toUser: {
        id: e.toUser.id,
        displayName: e.toUser.profile?.displayName ?? 'Unknown',
        avatarUrl: e.toUser.profile?.avatarUrl ?? null,
        headline: e.toUser.profile?.headline ?? null,
      },
      skill: e.skill,
      content: e.content,
      relationship: e.relationship,
      isPublic: e.isPublic,
      isApproved: e.isApproved,
      basis: basisOf(e),
      createdAt: e.createdAt.toISOString(),
    }));
  }

  async createEndorsement(
    fromUserId: string,
    toUserId: string,
    data: { content: string; skill?: string; relationship?: string },
  ): Promise<EndorsementDto> {
    if (fromUserId === toUserId) {
      throw new BadRequestException('Cannot endorse yourself');
    }

    // Check if target user exists
    const targetUser = await this.prisma.user.findUnique({
      where: { id: toUserId },
      select: { id: true, profile: { select: { displayName: true } } },
    });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // Check for existing endorsement
    const existing = await this.prisma.endorsement.findUnique({
      where: { fromUserId_toUserId: { fromUserId, toUserId } },
    });
    if (existing) {
      throw new BadRequestException('You have already endorsed this user');
    }

    const endorsement = await this.prisma.endorsement.create({
      data: {
        fromUserId,
        toUserId,
        content: data.content.trim(),
        skill: data.skill?.trim() || null,
        relationship: data.relationship?.trim() || null,
        isPublic: true,
        isApproved: false, // Requires recipient approval
        basis: await this.basisBetween(fromUserId, toUserId),
      },
      include: {
        fromUser: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true, headline: true } },
          },
        },
      },
    });

    // Notify the recipient
    const fromDisplayName = endorsement.fromUser.profile?.displayName ?? 'Someone';
    await this.notifications.createNotification({
      userId: toUserId,
      type: 'system',
      title: 'New endorsement received',
      body: `${fromDisplayName} has written an endorsement for you. Review and approve it to display on your profile.`,
      link: '/profile?tab=endorsements',
    });

    return {
      id: endorsement.id,
      fromUserId: endorsement.fromUserId,
      fromUser: {
        id: endorsement.fromUser.id,
        displayName: endorsement.fromUser.profile?.displayName ?? 'Unknown',
        avatarUrl: endorsement.fromUser.profile?.avatarUrl ?? null,
        headline: endorsement.fromUser.profile?.headline ?? null,
      },
      toUserId: endorsement.toUserId,
      skill: endorsement.skill,
      content: endorsement.content,
      relationship: endorsement.relationship,
      isPublic: endorsement.isPublic,
      isApproved: endorsement.isApproved,
      basis: basisOf(endorsement),
      createdAt: endorsement.createdAt.toISOString(),
    };
  }

  async approveEndorsement(userId: string, endorsementId: string): Promise<{ ok: true }> {
    const endorsement = await this.prisma.endorsement.findUnique({
      where: { id: endorsementId },
    });
    if (!endorsement) {
      throw new NotFoundException('Endorsement not found');
    }
    if (endorsement.toUserId !== userId) {
      throw new ForbiddenException('Only the recipient can approve endorsements');
    }

    // The basis is checked again when it goes public: a session or an
    // agreement may have happened since it was written.
    await this.prisma.endorsement.update({
      where: { id: endorsementId },
      data: { isApproved: true, basis: await this.basisBetween(endorsement.fromUserId, endorsement.toUserId) },
    });

    return { ok: true };
  }

  async declineEndorsement(userId: string, endorsementId: string): Promise<{ ok: true }> {
    const endorsement = await this.prisma.endorsement.findUnique({
      where: { id: endorsementId },
    });
    if (!endorsement) {
      throw new NotFoundException('Endorsement not found');
    }
    if (endorsement.toUserId !== userId) {
      throw new ForbiddenException('Only the recipient can decline endorsements');
    }

    await this.prisma.endorsement.delete({
      where: { id: endorsementId },
    });

    return { ok: true };
  }

  async deleteEndorsement(userId: string, endorsementId: string): Promise<{ ok: true }> {
    const endorsement = await this.prisma.endorsement.findUnique({
      where: { id: endorsementId },
    });
    if (!endorsement) {
      throw new NotFoundException('Endorsement not found');
    }
    // Either the giver or receiver can delete
    if (endorsement.fromUserId !== userId && endorsement.toUserId !== userId) {
      throw new ForbiddenException('Not authorized to delete this endorsement');
    }

    await this.prisma.endorsement.delete({
      where: { id: endorsementId },
    });

    return { ok: true };
  }

  /**
   * The relationship two people have on the platform, as `endorsementBasis`
   * reads it. A lookup that fails leaves the endorsement unlabelled rather
   * than failing it: the label is a claim we only make when we can see it.
   */
  async basisBetween(a: string, b: string): Promise<EndorsementBasis[]> {
    try {
      const [agreedThreads, completedSessions, aCohorts] = await Promise.all([
        this.prisma.commitmentThread.count({
          where: { agreedAt: { not: null }, OR: [{ candidateId: a, card: { ownerId: b } }, { candidateId: b, card: { ownerId: a } }] },
        }),
        this.prisma.mentorshipSession.count({
          where: { status: 'completed', OR: [{ mentorId: a, menteeId: b }, { mentorId: b, menteeId: a }] },
        }),
        this.prisma.cohortMember.findMany({ where: { userId: a }, select: { cohortId: true } }),
      ]);
      const sharedCohorts = aCohorts.length
        ? await this.prisma.cohortMember.count({ where: { userId: b, cohortId: { in: aCohorts.map((c) => c.cohortId) } } })
        : 0;
      return endorsementBasis({ agreedThreads, completedSessions, sharedCohorts });
    } catch {
      return [];
    }
  }

  async getEndorsementStats(userId: string): Promise<{
    total: number;
    pending: number;
    given: number;
  }> {
    const [total, pending, given] = await Promise.all([
      this.prisma.endorsement.count({
        where: { toUserId: userId, isApproved: true, isPublic: true },
      }),
      this.prisma.endorsement.count({
        where: { toUserId: userId, isApproved: false },
      }),
      this.prisma.endorsement.count({
        where: { fromUserId: userId },
      }),
    ]);

    return { total, pending, given };
  }
}
