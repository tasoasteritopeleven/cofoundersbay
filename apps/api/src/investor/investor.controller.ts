import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InvestorService, PIPELINE_STAGES, DEAL_STATUSES } from './investor.service';

/** Money crosses the wire in minor units, so no float ever touches it. */
const cents = z.number().int().min(0).max(1_000_000_000);

const createDealSchema = z.object({
  name: z.string().trim().min(1).max(120),
  founderId: z.string().uuid().optional(),
  tagline: z.string().trim().max(240).optional(),
  industry: z.string().trim().max(80).optional(),
  location: z.string().trim().max(120).optional(),
  website: z.string().trim().url().max(300).optional(),
  companyStage: z.string().trim().max(40).optional(),
  teamSize: z.number().int().min(0).max(100_000).optional(),
  pipelineStage: z.enum(PIPELINE_STAGES).optional(),
  askAmountCents: cents.optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  notes: z.string().trim().max(4000).optional(),
});

const updateDealSchema = z
  .object({
    pipelineStage: z.enum(PIPELINE_STAGES).optional(),
    starred: z.boolean().optional(),
    alertsEnabled: z.boolean().optional(),
    notes: z.string().trim().max(4000).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
    askAmountCents: cents.nullable().optional(),
    investedCents: cents.nullable().optional(),
    currentValueCents: cents.nullable().optional(),
    status: z.enum(DEAL_STATUSES).optional(),
    teamSize: z.number().int().min(0).max(100_000).nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Nothing to update',
  });

const eventSchema = z.object({
  type: z.enum(['milestone', 'fundraise', 'team', 'deck', 'update', 'note']),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(2000).optional(),
});

/**
 * The investor's board. Every route is scoped to the calling investor by the
 * service, which is what keeps one investor's private notes private.
 */
@Controller('investor')
@UseGuards(JwtAuthGuard)
export class InvestorController {
  constructor(private readonly investor: InvestorService) {}

  @Get('deals')
  async listDeals(
    @CurrentUser() user: { id: string },
    @Query('pipelineStage') pipelineStage?: string,
    @Query('starred') starred?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.investor.listDeals(user.id, {
      pipelineStage: pipelineStage?.trim() || undefined,
      starred: starred === undefined ? undefined : starred === 'true',
      status: status?.trim() || undefined,
      search: search?.trim() || undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('summary')
  async getSummary(@CurrentUser() user: { id: string }) {
    return this.investor.getSummary(user.id);
  }

  @Get('activity')
  async listActivity(@CurrentUser() user: { id: string }, @Query('limit') limit?: string) {
    return this.investor.listActivity(user.id, limit ? Number(limit) : undefined);
  }

  @Get('deals/:dealId')
  async getDeal(@CurrentUser() user: { id: string }, @Param('dealId') dealId: string) {
    return this.investor.getDeal(user.id, dealId);
  }

  @Post('deals')
  async createDeal(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    return this.investor.createDeal(user.id, createDealSchema.parse(body));
  }

  @Patch('deals/:dealId')
  async updateDeal(
    @CurrentUser() user: { id: string },
    @Param('dealId') dealId: string,
    @Body() body: unknown,
  ) {
    return this.investor.updateDeal(user.id, dealId, updateDealSchema.parse(body));
  }

  @Delete('deals/:dealId')
  async deleteDeal(@CurrentUser() user: { id: string }, @Param('dealId') dealId: string) {
    return this.investor.deleteDeal(user.id, dealId);
  }

  @Post('deals/:dealId/events')
  async addEvent(
    @CurrentUser() user: { id: string },
    @Param('dealId') dealId: string,
    @Body() body: unknown,
  ) {
    return this.investor.addEvent(user.id, dealId, eventSchema.parse(body));
  }
}
