import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The investor's book of startups.
 *
 * `/investor/watchlist`, `/investor/pipeline` and `/investor/portfolio` used to
 * be three screens over three unrelated shapes of invented data, which is why
 * a startup could sit in the pipeline at "invested" and be absent from the
 * portfolio. They are three filters over one `InvestorDeal` row here, so they
 * cannot disagree.
 */

export const PIPELINE_STAGES = [
  'discovered',
  'reviewing',
  'meeting',
  'due_diligence',
  'negotiating',
  'invested',
  'passed',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const DEAL_STATUSES = ['active', 'exited', 'written_off'] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number];

/** The stage at which a deal counts as money out of the door. */
const INVESTED_STAGE: PipelineStage = 'invested';

const dealInclude = {
  founder: {
    select: {
      id: true,
      profile: { select: { displayName: true, avatarUrl: true, headline: true } },
    },
  },
  events: { orderBy: { createdAt: 'desc' as const }, take: 5 },
} satisfies Prisma.InvestorDealInclude;

type DealRow = Prisma.InvestorDealGetPayload<{ include: typeof dealInclude }>;

function mapDeal(deal: DealRow) {
  return {
    id: deal.id,
    name: deal.name,
    tagline: deal.tagline,
    industry: deal.industry,
    location: deal.location,
    website: deal.website,
    logoUrl: deal.logoUrl,
    companyStage: deal.companyStage,
    teamSize: deal.teamSize,
    pipelineStage: deal.pipelineStage as PipelineStage,
    starred: deal.starred,
    alertsEnabled: deal.alertsEnabled,
    notes: deal.notes,
    tags: deal.tags,
    currency: deal.currency,
    askAmountCents: deal.askAmountCents,
    investedCents: deal.investedCents,
    currentValueCents: deal.currentValueCents,
    investedAt: deal.investedAt?.toISOString() ?? null,
    status: deal.status as DealStatus,
    lastActivityAt: deal.lastActivityAt.toISOString(),
    createdAt: deal.createdAt.toISOString(),
    founder: deal.founder
      ? {
          id: deal.founder.id,
          displayName: deal.founder.profile?.displayName ?? null,
          avatarUrl: deal.founder.profile?.avatarUrl ?? null,
          headline: deal.founder.profile?.headline ?? null,
        }
      : null,
    recentEvents: deal.events.map((event) => ({
      id: event.id,
      type: event.type,
      title: event.title,
      body: event.body,
      fromStage: event.fromStage,
      toStage: event.toStage,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

export type InvestorDealView = ReturnType<typeof mapDeal>;

@Injectable()
export class InvestorService {
  constructor(private readonly prisma: PrismaService) {}

  async listDeals(
    investorId: string,
    params: {
      pipelineStage?: string;
      starred?: boolean;
      status?: string;
      search?: string;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
    const offset = Math.max(params.offset ?? 0, 0);

    const where: Prisma.InvestorDealWhereInput = { investorId };
    if (params.pipelineStage) {
      if (!PIPELINE_STAGES.includes(params.pipelineStage as PipelineStage)) {
        throw new BadRequestException('Unknown pipeline stage');
      }
      where.pipelineStage = params.pipelineStage;
    }
    if (params.starred !== undefined) where.starred = params.starred;
    if (params.status) where.status = params.status;
    if (params.search) {
      const contains = { contains: params.search, mode: 'insensitive' as const };
      where.OR = [{ name: contains }, { tagline: contains }, { industry: contains }];
    }

    const [deals, total] = await Promise.all([
      this.prisma.investorDeal.findMany({
        where,
        include: dealInclude,
        orderBy: { lastActivityAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.investorDeal.count({ where }),
    ]);

    return {
      deals: deals.map(mapDeal),
      total,
      hasMore: offset + deals.length < total,
    };
  }

  /**
   * The numbers the pipeline board and the portfolio header show.
   *
   * Counted over the investor's own rows in one pass rather than derived from
   * whatever page happens to be loaded, so the board's column counts and the
   * portfolio's totals are the same arithmetic.
   */
  async getSummary(investorId: string) {
    const [byStage, invested] = await Promise.all([
      this.prisma.investorDeal.groupBy({
        by: ['pipelineStage'],
        where: { investorId },
        _count: { _all: true },
      }),
      this.prisma.investorDeal.aggregate({
        where: { investorId, pipelineStage: INVESTED_STAGE },
        _sum: { investedCents: true, currentValueCents: true },
        _count: { _all: true },
      }),
    ]);

    const stageCounts = Object.fromEntries(
      PIPELINE_STAGES.map((stage) => [
        stage,
        byStage.find((row) => row.pipelineStage === stage)?._count._all ?? 0,
      ]),
    ) as Record<PipelineStage, number>;

    const deployedCents = invested._sum.investedCents ?? 0;
    const valueCents = invested._sum.currentValueCents ?? 0;

    return {
      stageCounts,
      totalDeals: Object.values(stageCounts).reduce((sum, n) => sum + n, 0),
      investments: invested._count._all,
      deployedCents,
      currentValueCents: valueCents,
      // Null rather than zero when nothing is deployed: a return of 0% and no
      // investments at all are different statements, and the page says so.
      returnPct:
        deployedCents > 0
          ? Math.round(((valueCents - deployedCents) / deployedCents) * 100)
          : null,
    };
  }

  async getDeal(investorId: string, dealId: string) {
    const deal = await this.prisma.investorDeal.findUnique({
      where: { id: dealId },
      include: dealInclude,
    });
    if (!deal || deal.investorId !== investorId) {
      throw new NotFoundException('Deal not found');
    }
    return { deal: mapDeal(deal) };
  }

  async createDeal(
    investorId: string,
    dto: {
      name: string;
      founderId?: string;
      tagline?: string;
      industry?: string;
      location?: string;
      website?: string;
      companyStage?: string;
      teamSize?: number;
      pipelineStage?: string;
      askAmountCents?: number;
      tags?: string[];
      notes?: string;
    },
  ) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('A deal needs a name');
    if (dto.pipelineStage && !PIPELINE_STAGES.includes(dto.pipelineStage as PipelineStage)) {
      throw new BadRequestException('Unknown pipeline stage');
    }

    const existing = await this.prisma.investorDeal.findFirst({
      where: { investorId, name },
      select: { id: true },
    });
    if (existing) throw new ConflictException('That startup is already on your board');

    const deal = await this.prisma.investorDeal.create({
      data: {
        investorId,
        name,
        founderId: dto.founderId ?? null,
        tagline: dto.tagline?.trim() || null,
        industry: dto.industry?.trim() || null,
        location: dto.location?.trim() || null,
        website: dto.website?.trim() || null,
        companyStage: dto.companyStage?.trim() || null,
        teamSize: dto.teamSize ?? null,
        pipelineStage: dto.pipelineStage ?? 'discovered',
        askAmountCents: dto.askAmountCents ?? null,
        tags: dto.tags ?? [],
        notes: dto.notes?.trim() || null,
        events: {
          create: { type: 'update', title: 'Added to the board' },
        },
      },
      include: dealInclude,
    });

    return { deal: mapDeal(deal) };
  }

  async updateDeal(
    investorId: string,
    dealId: string,
    dto: {
      pipelineStage?: string;
      starred?: boolean;
      alertsEnabled?: boolean;
      notes?: string;
      tags?: string[];
      askAmountCents?: number | null;
      investedCents?: number | null;
      currentValueCents?: number | null;
      status?: string;
      teamSize?: number | null;
    },
  ) {
    const current = await this.prisma.investorDeal.findUnique({
      where: { id: dealId },
      select: { id: true, investorId: true, pipelineStage: true, investedAt: true },
    });
    if (!current || current.investorId !== investorId) {
      throw new NotFoundException('Deal not found');
    }

    if (dto.pipelineStage && !PIPELINE_STAGES.includes(dto.pipelineStage as PipelineStage)) {
      throw new BadRequestException('Unknown pipeline stage');
    }
    if (dto.status && !DEAL_STATUSES.includes(dto.status as DealStatus)) {
      throw new BadRequestException('Unknown deal status');
    }

    const stageChanged = Boolean(dto.pipelineStage && dto.pipelineStage !== current.pipelineStage);
    const data: Prisma.InvestorDealUpdateInput = { lastActivityAt: new Date() };

    if (dto.pipelineStage !== undefined) data.pipelineStage = dto.pipelineStage;
    if (dto.starred !== undefined) data.starred = dto.starred;
    if (dto.alertsEnabled !== undefined) data.alertsEnabled = dto.alertsEnabled;
    if (dto.notes !== undefined) data.notes = dto.notes.trim() || null;
    if (dto.tags !== undefined) data.tags = dto.tags;
    if (dto.askAmountCents !== undefined) data.askAmountCents = dto.askAmountCents;
    if (dto.investedCents !== undefined) data.investedCents = dto.investedCents;
    if (dto.currentValueCents !== undefined) data.currentValueCents = dto.currentValueCents;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.teamSize !== undefined) data.teamSize = dto.teamSize;

    // Reaching `invested` is when the money has a date. Stamped once: moving
    // back and forth must not rewrite when the cheque was written.
    if (dto.pipelineStage === INVESTED_STAGE && !current.investedAt) {
      data.investedAt = new Date();
    }

    const deal = await this.prisma.investorDeal.update({
      where: { id: dealId },
      data: {
        ...data,
        ...(stageChanged
          ? {
              events: {
                create: {
                  type: 'stage_change',
                  title: `Moved to ${String(dto.pipelineStage).replace(/_/g, ' ')}`,
                  fromStage: current.pipelineStage,
                  toStage: dto.pipelineStage,
                },
              },
            }
          : {}),
      },
      include: dealInclude,
    });

    return { deal: mapDeal(deal) };
  }

  async deleteDeal(investorId: string, dealId: string) {
    const deal = await this.prisma.investorDeal.findUnique({
      where: { id: dealId },
      select: { id: true, investorId: true },
    });
    if (!deal || deal.investorId !== investorId) {
      throw new NotFoundException('Deal not found');
    }
    await this.prisma.investorDeal.delete({ where: { id: dealId } });
    return { ok: true, dealId };
  }

  /**
   * Activity across the whole board, newest first. This is what the watchlist
   * column shows, and it is the reason `lastActivity` is a timestamp with a
   * row behind it rather than a phrase written into the page.
   */
  async listActivity(investorId: string, limit = 20) {
    const events = await this.prisma.investorDealEvent.findMany({
      where: { deal: { investorId } },
      include: { deal: { select: { id: true, name: true, logoUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });

    return {
      activity: events.map((event) => ({
        id: event.id,
        dealId: event.deal.id,
        dealName: event.deal.name,
        logoUrl: event.deal.logoUrl,
        type: event.type,
        title: event.title,
        body: event.body,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  }

  async addEvent(
    investorId: string,
    dealId: string,
    dto: { type: string; title: string; body?: string },
  ) {
    const deal = await this.prisma.investorDeal.findUnique({
      where: { id: dealId },
      select: { id: true, investorId: true },
    });
    if (!deal || deal.investorId !== investorId) {
      throw new NotFoundException('Deal not found');
    }

    const title = dto.title.trim();
    if (!title) throw new BadRequestException('An event needs a title');

    const [event] = await this.prisma.$transaction([
      this.prisma.investorDealEvent.create({
        data: { dealId, type: dto.type, title, body: dto.body?.trim() || null },
      }),
      this.prisma.investorDeal.update({
        where: { id: dealId },
        data: { lastActivityAt: new Date() },
      }),
    ]);

    return {
      event: {
        id: event.id,
        type: event.type,
        title: event.title,
        body: event.body,
        createdAt: event.createdAt.toISOString(),
      },
    };
  }
}
