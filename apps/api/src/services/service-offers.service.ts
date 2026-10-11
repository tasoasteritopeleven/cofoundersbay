import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * A provider's offers, and the inquiries against them.
 *
 * `ServiceOffer` and `ServiceInquiry` have been in the schema since it was
 * written, with pricing, deliverables, targeting, status, a rating and a
 * review comment — and no controller ever read them. The four provider
 * screens each rendered their own fixed array, and the public marketplace
 * sent people off-platform through a `contactUrl`, so the product had no
 * inquiry loop at all.
 *
 * All four screens are one entity filtered by status, the same way the
 * investor board is: an inquiry at `open` is an enquiry, at `accepted` or
 * `completed` it is a project, and one carrying a rating is a review. Modelling
 * it once is what stops them disagreeing about the same piece of work.
 */

export const OFFER_STATUSES = ['draft', 'active', 'paused', 'archived'] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const INQUIRY_STATUSES = [
  'open',
  'in_discussion',
  'accepted',
  'declined',
  'completed',
  'cancelled',
] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

/** The statuses that mean work was agreed, which is what a "project" is. */
const PROJECT_STATUSES: InquiryStatus[] = ['accepted', 'completed'];

const personSelect = {
  id: true,
  profile: { select: { displayName: true, avatarUrl: true, headline: true } },
} satisfies Prisma.UserSelect;

/** Decimal crosses the wire as a number, or null — never as a Prisma object. */
function money(value: Prisma.Decimal | null): number | null {
  return value == null ? null : Number(value);
}

@Injectable()
export class ServiceOffersService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Offers ────────────────────────────────────────────────────────────────

  /**
   * Public offers, or one provider's own.
   *
   * With `providerId` set, drafts and paused offers are included: their owner
   * is the one person who needs to see an offer they have not published.
   */
  async listOffers(params: {
    providerId?: string;
    category?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
    const offset = Math.max(params.offset ?? 0, 0);

    const where: Prisma.ServiceOfferWhereInput = params.providerId
      ? { providerId: params.providerId }
      : { status: 'active' };
    if (params.category) where.category = params.category;
    if (params.search) {
      const contains = { contains: params.search, mode: 'insensitive' as const };
      where.OR = [{ title: contains }, { description: contains }, { shortTagline: contains }];
    }

    const [offers, total] = await Promise.all([
      this.prisma.serviceOffer.findMany({
        where,
        include: { provider: { select: personSelect } },
        orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.serviceOffer.count({ where }),
    ]);

    return {
      offers: offers.map((offer) => ({
        id: offer.id,
        title: offer.title,
        description: offer.description,
        shortTagline: offer.shortTagline,
        category: offer.category,
        subcategory: offer.subcategory,
        tags: offer.tags,
        pricingModel: offer.pricingModel,
        priceFrom: money(offer.priceFrom),
        priceTo: money(offer.priceTo),
        currency: offer.currency,
        pricingNotes: offer.pricingNotes,
        deliveryDays: offer.deliveryDays,
        revisionsIncluded: offer.revisionsIncluded,
        status: offer.status,
        isFeatured: offer.isFeatured,
        viewCount: offer.viewCount,
        inquiryCount: offer.inquiryCount,
        // Null rather than 0: "nobody has rated this" and "rated zero" are
        // different statements, and the card says which.
        avgRating: money(offer.avgRating),
        reviewCount: offer.reviewCount,
        completedProjects: offer.completedProjects,
        createdAt: offer.createdAt.toISOString(),
        provider: {
          id: offer.provider.id,
          displayName: offer.provider.profile?.displayName ?? null,
          avatarUrl: offer.provider.profile?.avatarUrl ?? null,
          headline: offer.provider.profile?.headline ?? null,
        },
      })),
      total,
      hasMore: offset + offers.length < total,
    };
  }

  async createOffer(
    providerId: string,
    dto: {
      title: string;
      description: string;
      shortTagline?: string;
      category: string;
      tags?: string[];
      pricingModel?: string;
      priceFrom?: number;
      priceTo?: number;
      currency?: string;
      deliveryDays?: number;
      status?: OfferStatus;
    },
  ) {
    const title = dto.title.trim();
    if (!title) throw new BadRequestException('An offer needs a title');

    const offer = await this.prisma.serviceOffer.create({
      data: {
        providerId,
        title,
        description: dto.description.trim(),
        shortTagline: dto.shortTagline?.trim() || null,
        category: dto.category,
        tags: dto.tags ?? [],
        pricingModel: (dto.pricingModel ?? 'contact_for_pricing') as never,
        priceFrom: dto.priceFrom ?? null,
        priceTo: dto.priceTo ?? null,
        currency: dto.currency ?? 'EUR',
        deliveryDays: dto.deliveryDays ?? null,
        status: (dto.status ?? 'draft') as never,
      },
      select: { id: true },
    });
    return { offerId: offer.id };
  }

  async updateOffer(
    providerId: string,
    offerId: string,
    dto: Partial<{
      title: string;
      description: string;
      shortTagline: string;
      category: string;
      tags: string[];
      priceFrom: number | null;
      priceTo: number | null;
      deliveryDays: number | null;
      status: OfferStatus;
    }>,
  ) {
    const offer = await this.prisma.serviceOffer.findUnique({
      where: { id: offerId },
      select: { id: true, providerId: true },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.providerId !== providerId) throw new ForbiddenException('Not your offer');

    await this.prisma.serviceOffer.update({
      where: { id: offerId },
      data: { ...dto, status: dto.status as never },
    });
    return { ok: true, offerId };
  }

  // ── Inquiries ─────────────────────────────────────────────────────────────

  /**
   * The inquiries a person can see, in whichever direction they are involved.
   *
   * `side` decides which: a provider sees what was sent to them, a client sees
   * what they sent. Without it the same row would be visible to both with no
   * indication of whose it is.
   */
  async listInquiries(
    userId: string,
    params: { side?: 'provider' | 'client'; status?: string; kind?: 'projects' | 'reviews'; limit?: number },
  ) {
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
    const where: Prisma.ServiceInquiryWhereInput =
      params.side === 'client' ? { clientId: userId } : { providerId: userId };

    if (params.status) {
      if (!INQUIRY_STATUSES.includes(params.status as InquiryStatus)) {
        throw new BadRequestException('Unknown inquiry status');
      }
      where.status = params.status as never;
    }
    // Two named views over the same rows, so the pages cannot invent their own.
    if (params.kind === 'projects') where.status = { in: PROJECT_STATUSES as never };
    if (params.kind === 'reviews') where.rating = { not: null };

    const inquiries = await this.prisma.serviceInquiry.findMany({
      where,
      include: {
        offer: { select: { id: true, title: true, category: true } },
        client: { select: personSelect },
        provider: { select: personSelect },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return {
      inquiries: inquiries.map((inquiry) => ({
        id: inquiry.id,
        status: inquiry.status,
        message: inquiry.message,
        responseMessage: inquiry.responseMessage,
        agreedScope: inquiry.agreedScope,
        budgetEstimate: money(inquiry.budgetEstimate),
        agreedPrice: money(inquiry.agreedPrice),
        currency: inquiry.currency,
        timelineExpected: inquiry.timelineExpected,
        rating: inquiry.rating,
        reviewComment: inquiry.reviewComment,
        createdAt: inquiry.createdAt.toISOString(),
        resolvedAt: inquiry.resolvedAt?.toISOString() ?? null,
        offer: inquiry.offer,
        client: {
          id: inquiry.client.id,
          displayName: inquiry.client.profile?.displayName ?? null,
          avatarUrl: inquiry.client.profile?.avatarUrl ?? null,
        },
        provider: {
          id: inquiry.provider.id,
          displayName: inquiry.provider.profile?.displayName ?? null,
          avatarUrl: inquiry.provider.profile?.avatarUrl ?? null,
        },
      })),
      total: inquiries.length,
    };
  }

  /** A founder contacting a provider — the step the marketplace never had. */
  async createInquiry(
    clientId: string,
    offerId: string,
    dto: { message: string; budgetEstimate?: number; timelineExpected?: string },
  ) {
    const offer = await this.prisma.serviceOffer.findUnique({
      where: { id: offerId },
      select: { id: true, providerId: true, status: true },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.status !== 'active') throw new BadRequestException('That offer is not taking inquiries');
    if (offer.providerId === clientId) {
      throw new BadRequestException('You cannot enquire about your own offer');
    }

    const message = dto.message.trim();
    if (!message) throw new BadRequestException('An inquiry needs a message');

    const [inquiry] = await this.prisma.$transaction([
      this.prisma.serviceInquiry.create({
        data: {
          offerId,
          clientId,
          providerId: offer.providerId,
          message,
          budgetEstimate: dto.budgetEstimate ?? null,
          timelineExpected: dto.timelineExpected?.trim() || null,
        },
        select: { id: true },
      }),
      // Kept on the offer so a list of offers can be ordered by demand without
      // counting rows for each one.
      this.prisma.serviceOffer.update({
        where: { id: offerId },
        data: { inquiryCount: { increment: 1 } },
      }),
    ]);

    return { inquiryId: inquiry.id };
  }

  /** The provider's side: respond, agree a scope, accept, decline or finish. */
  async updateInquiry(
    userId: string,
    inquiryId: string,
    dto: Partial<{
      status: InquiryStatus;
      responseMessage: string;
      agreedScope: string;
      agreedPrice: number;
    }>,
  ) {
    const inquiry = await this.prisma.serviceInquiry.findUnique({
      where: { id: inquiryId },
      select: { id: true, providerId: true, status: true },
    });
    if (!inquiry) throw new NotFoundException('Inquiry not found');
    if (inquiry.providerId !== userId) {
      throw new ForbiddenException('Only the provider can answer an inquiry');
    }
    if (dto.status && !INQUIRY_STATUSES.includes(dto.status)) {
      throw new BadRequestException('Unknown inquiry status');
    }

    const resolving = dto.status === 'completed' || dto.status === 'declined' || dto.status === 'cancelled';
    await this.prisma.serviceInquiry.update({
      where: { id: inquiryId },
      data: {
        ...dto,
        status: dto.status as never,
        ...(resolving ? { resolvedAt: new Date() } : {}),
      },
    });
    return { ok: true, inquiryId };
  }

  /**
   * The client's side: rate the work once it is done.
   *
   * Recomputed onto the offer rather than stored twice, so the card's average
   * is always the average of the reviews behind it.
   */
  async reviewInquiry(
    clientId: string,
    inquiryId: string,
    dto: { rating: number; reviewComment?: string },
  ) {
    if (dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException('A rating is 1 to 5');
    }

    const inquiry = await this.prisma.serviceInquiry.findUnique({
      where: { id: inquiryId },
      select: { id: true, clientId: true, offerId: true, status: true },
    });
    if (!inquiry) throw new NotFoundException('Inquiry not found');
    if (inquiry.clientId !== clientId) {
      throw new ForbiddenException('Only the client can review the work');
    }
    if (inquiry.status !== 'completed') {
      throw new BadRequestException('The work has to be completed before it can be reviewed');
    }

    await this.prisma.serviceInquiry.update({
      where: { id: inquiryId },
      data: { rating: dto.rating, reviewComment: dto.reviewComment?.trim() || null },
    });

    const rated = await this.prisma.serviceInquiry.aggregate({
      where: { offerId: inquiry.offerId, rating: { not: null } },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await this.prisma.serviceOffer.update({
      where: { id: inquiry.offerId },
      data: {
        avgRating: rated._avg.rating ?? null,
        reviewCount: rated._count._all,
      },
    });

    return { ok: true, inquiryId };
  }

  /** The four provider screens' headline figures, counted in one pass. */
  async getProviderSummary(providerId: string) {
    const [offers, byStatus, rated] = await Promise.all([
      this.prisma.serviceOffer.groupBy({
        by: ['status'],
        where: { providerId },
        _count: { _all: true },
      }),
      this.prisma.serviceInquiry.groupBy({
        by: ['status'],
        where: { providerId },
        _count: { _all: true },
      }),
      this.prisma.serviceInquiry.aggregate({
        where: { providerId, rating: { not: null } },
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);

    const inquiryCounts = Object.fromEntries(
      INQUIRY_STATUSES.map((status) => [
        status,
        byStatus.find((row) => row.status === status)?._count._all ?? 0,
      ]),
    ) as Record<InquiryStatus, number>;

    return {
      offers: {
        total: offers.reduce((sum, row) => sum + row._count._all, 0),
        active: offers.find((row) => row.status === 'active')?._count._all ?? 0,
      },
      inquiryCounts,
      openInquiries: inquiryCounts.open + inquiryCounts.in_discussion,
      projects: inquiryCounts.accepted + inquiryCounts.completed,
      reviewCount: rated._count._all,
      // Null when nothing is rated, so the tile can say so instead of "0.0".
      avgRating: rated._avg.rating == null ? null : Math.round(rated._avg.rating * 10) / 10,
    };
  }
}
