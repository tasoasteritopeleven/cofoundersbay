import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Expert reviews.
 *
 * `ExpertReview` has been in the schema since it was written and no controller
 * ever read it, so /expert-reviews held its own fixed arrays and the "request
 * a review" button had nothing to call. The model already carries both sides
 * of the exchange - the request, the written feedback, the scores, the fee and
 * the requester's rating of the review - so this service is a reader over
 * columns that were always there.
 */

export const REVIEW_STATUSES = [
  'requested',
  'accepted',
  'in_progress',
  'submitted',
  'declined',
  'expired',
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_TYPES = [
  'pitch_deck',
  'business_model',
  'financial_model',
  'legal_structure',
  'market_analysis',
  'go_to_market',
  'technical_architecture',
  'product_strategy',
  'general',
] as const;
export type ReviewType = (typeof REVIEW_TYPES)[number];

/** Which statuses an expert may move a review into, from where. */
const EXPERT_TRANSITIONS: Record<string, ReviewStatus[]> = {
  requested: ['accepted', 'declined'],
  accepted: ['in_progress', 'declined'],
  in_progress: ['submitted'],
};

const PERSON_SELECT = {
  id: true,
  profile: {
    select: { displayName: true, headline: true, avatarUrl: true },
  },
} satisfies Prisma.UserSelect;

type PersonRow = {
  id: string;
  profile: { displayName: string | null; headline: string | null; avatarUrl: string | null } | null;
};

function person(row: PersonRow | null | undefined) {
  return {
    id: row?.id ?? '',
    displayName: row?.profile?.displayName ?? null,
    headline: row?.profile?.headline ?? null,
    avatarUrl: row?.profile?.avatarUrl ?? null,
  };
}

/** A JSON column holding `[{ area, comment }]`, read defensively. */
function jsonList(value: Prisma.JsonValue | null): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

/** A JSON column holding `{ market: 7, team: 9 }`, read defensively. */
function jsonScores(value: Prisma.JsonValue | null): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, score] of Object.entries(value as Record<string, unknown>)) {
    if (typeof score === 'number' && Number.isFinite(score)) out[key] = score;
  }
  return out;
}

@Injectable()
export class ExpertReviewsService {
  constructor(private prisma: PrismaService) {}

  private shape(row: any) {
    return {
      id: row.id,
      requester: person(row.requester),
      expert: person(row.expert),
      workspaceId: row.workspaceId ?? null,
      reviewType: row.reviewType as ReviewType,
      status: row.status as ReviewStatus,
      requestMessage: row.requestMessage ?? null,
      documents: jsonList(row.documentsJson),
      summaryFeedback: row.summaryFeedback ?? null,
      strengths: jsonList(row.strengthsJson),
      improvements: jsonList(row.improvementsJson),
      scoreOverall: row.scoreOverall ?? null,
      scoresByArea: jsonScores(row.scoresByArea),
      isPaid: row.isPaid,
      // Decimal never leaves the boundary as a Decimal.
      agreedFee: row.agreedFee == null ? null : Number(row.agreedFee),
      currency: row.currency,
      requestedAt: row.requestedAt,
      acceptedAt: row.acceptedAt ?? null,
      dueDate: row.dueDate ?? null,
      submittedAt: row.submittedAt ?? null,
      rating: row.rating ?? null,
      ratingComment: row.ratingComment ?? null,
    };
  }

  /**
   * The reviews on one side of the exchange.
   *
   * `side` decides whose list this is: a founder asking for feedback, or an
   * expert being asked. Without it a reviewer's own requests would mix into
   * the queue of requests made of them.
   */
  async listReviews(
    userId: string,
    params: { side?: 'requester' | 'expert'; status?: ReviewStatus; limit?: number },
  ) {
    const side = params.side ?? 'requester';
    const where: Prisma.ExpertReviewWhereInput = {
      ...(side === 'expert' ? { expertId: userId } : { requesterId: userId }),
      ...(params.status ? { status: params.status } : {}),
    };

    const rows = await this.prisma.expertReview.findMany({
      where,
      include: {
        requester: { select: PERSON_SELECT },
        expert: { select: PERSON_SELECT },
      },
      orderBy: [{ requestedAt: 'desc' }],
      take: Math.min(Math.max(params.limit ?? 50, 1), 100),
    });

    return { reviews: rows.map((row) => this.shape(row)), total: rows.length };
  }

  async getReview(id: string, userId: string) {
    const row = await this.prisma.expertReview.findUnique({
      where: { id },
      include: {
        requester: { select: PERSON_SELECT },
        expert: { select: PERSON_SELECT },
      },
    });
    if (!row) throw new NotFoundException('Review not found');
    if (row.requesterId !== userId && row.expertId !== userId) {
      throw new ForbiddenException('This review is not yours');
    }
    return { review: this.shape(row) };
  }

  /**
   * The four figures the page puts above the list.
   *
   * Counted over the same rows the list returns, so the tiles cannot disagree
   * with what is under them.
   */
  async getSummary(userId: string, side: 'requester' | 'expert' = 'requester') {
    const scope: Prisma.ExpertReviewWhereInput =
      side === 'expert' ? { expertId: userId } : { requesterId: userId };

    const [total, open, submitted, rated] = await Promise.all([
      this.prisma.expertReview.count({ where: scope }),
      this.prisma.expertReview.count({
        where: { ...scope, status: { in: ['requested', 'accepted', 'in_progress'] } },
      }),
      this.prisma.expertReview.count({ where: { ...scope, status: 'submitted' } }),
      this.prisma.expertReview.findMany({
        where: { ...scope, rating: { not: null } },
        select: { rating: true, scoreOverall: true },
      }),
    ]);

    const ratings = rated.map((r) => r.rating).filter((r): r is number => r != null);
    const scores = rated.map((r) => r.scoreOverall).filter((s): s is number => s != null);

    return {
      total,
      open,
      submitted,
      // Null rather than zero: nobody having rated is not a rating of zero.
      avgRating: ratings.length
        ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1))
        : null,
      avgScore: scores.length
        ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
        : null,
    };
  }

  /**
   * The expert directory.
   *
   * An expert is someone offering their expertise - a `MentorProfile` that is
   * active and accepting - and their standing here is counted from the reviews
   * they have actually delivered, not from their mentoring ratings, which
   * measure a different thing.
   */
  async listExperts(params: { search?: string; limit?: number }) {
    const take = Math.min(Math.max(params.limit ?? 24, 1), 50);
    const profiles = await this.prisma.mentorProfile.findMany({
      where: {
        isActive: true,
        isAcceptingRequests: true,
        ...(params.search
          ? {
              OR: [
                { headline: { contains: params.search, mode: 'insensitive' } },
                { bio: { contains: params.search, mode: 'insensitive' } },
                { skills: { has: params.search } },
              ],
            }
          : {}),
      },
      include: {
        user: { select: PERSON_SELECT },
      },
      orderBy: [{ isVerified: 'desc' }, { totalSessions: 'desc' }],
      take,
    });

    if (profiles.length === 0) return { experts: [], total: 0 };

    // One grouped pass rather than a query per expert.
    const ids = profiles.map((p) => p.userId);
    const delivered = await this.prisma.expertReview.findMany({
      where: { expertId: { in: ids }, status: 'submitted' },
      select: { expertId: true, rating: true },
    });

    const byExpert = new Map<string, { count: number; ratings: number[] }>();
    for (const row of delivered) {
      const entry = byExpert.get(row.expertId) ?? { count: 0, ratings: [] };
      entry.count += 1;
      if (row.rating != null) entry.ratings.push(row.rating);
      byExpert.set(row.expertId, entry);
    }

    const experts = profiles.map((p) => {
      const stats = byExpert.get(p.userId) ?? { count: 0, ratings: [] };
      return {
        id: p.userId,
        userId: p.userId,
        displayName: p.user?.profile?.displayName ?? null,
        headline: p.headline ?? p.user?.profile?.headline ?? null,
        bio: p.bio ?? null,
        avatarUrl: p.user?.profile?.avatarUrl ?? null,
        skills: p.skills ?? [],
        specializations: p.specializations ?? [],
        industries: p.industries ?? [],
        isVerified: p.isVerified,
        isFree: p.isFree,
        // Stored in cents; the boundary is where that stops being true.
        feeFrom: p.isFree || p.hourlyRate == null ? null : p.hourlyRate / 100,
        currency: p.currency,
        completedReviews: stats.count,
        rating: stats.ratings.length
          ? Number((stats.ratings.reduce((a, b) => a + b, 0) / stats.ratings.length).toFixed(1))
          : null,
      };
    });

    return { experts, total: experts.length };
  }

  /** A founder asks an expert to look at something. */
  async requestReview(
    requesterId: string,
    data: {
      expertId: string;
      reviewType?: ReviewType;
      requestMessage?: string;
      workspaceId?: string;
      documents?: Record<string, unknown>[];
      dueDate?: string;
      isPaid?: boolean;
      agreedFee?: number;
      currency?: string;
    },
  ) {
    if (data.expertId === requesterId) {
      throw new BadRequestException('You cannot request a review from yourself');
    }
    const expert = await this.prisma.user.findUnique({
      where: { id: data.expertId },
      select: { id: true },
    });
    if (!expert) throw new NotFoundException('Expert not found');

    const row = await this.prisma.expertReview.create({
      data: {
        requesterId,
        expertId: data.expertId,
        reviewType: (data.reviewType ?? 'general') as any,
        requestMessage: data.requestMessage ?? null,
        workspaceId: data.workspaceId ?? null,
        documentsJson: (data.documents ?? []) as Prisma.InputJsonValue,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        isPaid: data.isPaid ?? false,
        agreedFee: data.agreedFee ?? null,
        currency: data.currency ?? 'USD',
      },
      include: {
        requester: { select: PERSON_SELECT },
        expert: { select: PERSON_SELECT },
      },
    });
    return { review: this.shape(row) };
  }

  /**
   * The expert moves the review along, and writes it.
   *
   * The transition table is what keeps a submitted review from being declined
   * afterwards, and a request from skipping straight to submitted with no
   * feedback attached.
   */
  async updateReview(
    id: string,
    expertId: string,
    data: {
      status?: ReviewStatus;
      summaryFeedback?: string;
      strengths?: Record<string, unknown>[];
      improvements?: Record<string, unknown>[];
      scoreOverall?: number;
      scoresByArea?: Record<string, number>;
      /** Null clears the deadline; undefined leaves it alone. */
      dueDate?: string | null;
    },
  ) {
    const existing = await this.prisma.expertReview.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Review not found');
    if (existing.expertId !== expertId) {
      throw new ForbiddenException('Only the expert can update this review');
    }

    if (data.status && data.status !== existing.status) {
      const allowed = EXPERT_TRANSITIONS[existing.status] ?? [];
      if (!allowed.includes(data.status)) {
        throw new BadRequestException(
          `A ${existing.status} review cannot become ${data.status}`,
        );
      }
      if (data.status === 'submitted' && !data.summaryFeedback && !existing.summaryFeedback) {
        throw new BadRequestException('A submitted review needs its written feedback');
      }
    }

    const row = await this.prisma.expertReview.update({
      where: { id },
      data: {
        ...(data.status ? { status: data.status as any } : {}),
        ...(data.summaryFeedback !== undefined ? { summaryFeedback: data.summaryFeedback } : {}),
        ...(data.strengths ? { strengthsJson: data.strengths as Prisma.InputJsonValue } : {}),
        ...(data.improvements
          ? { improvementsJson: data.improvements as Prisma.InputJsonValue }
          : {}),
        ...(data.scoreOverall !== undefined ? { scoreOverall: data.scoreOverall } : {}),
        ...(data.scoresByArea ? { scoresByArea: data.scoresByArea as Prisma.InputJsonValue } : {}),
        ...(data.dueDate !== undefined ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
        // Stamped once, when the state is actually reached.
        ...(data.status === 'accepted' && !existing.acceptedAt ? { acceptedAt: new Date() } : {}),
        ...(data.status === 'submitted' && !existing.submittedAt
          ? { submittedAt: new Date() }
          : {}),
      },
      include: {
        requester: { select: PERSON_SELECT },
        expert: { select: PERSON_SELECT },
      },
    });
    return { review: this.shape(row) };
  }

  /** The requester rates the review they received. */
  async rateReview(
    id: string,
    requesterId: string,
    data: { rating: number; ratingComment?: string },
  ) {
    const existing = await this.prisma.expertReview.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Review not found');
    if (existing.requesterId !== requesterId) {
      throw new ForbiddenException('Only the requester can rate this review');
    }
    if (existing.status !== 'submitted') {
      throw new BadRequestException('A review can be rated once it has been submitted');
    }

    const row = await this.prisma.expertReview.update({
      where: { id },
      data: { rating: data.rating, ratingComment: data.ratingComment ?? null },
      include: {
        requester: { select: PERSON_SELECT },
        expert: { select: PERSON_SELECT },
      },
    });
    return { review: this.shape(row) };
  }
}
