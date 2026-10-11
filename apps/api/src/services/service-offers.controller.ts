import {
  Body,
  Controller,
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
import {
  ServiceOffersService,
  OFFER_STATUSES,
  INQUIRY_STATUSES,
} from './service-offers.service';

const price = z.number().min(0).max(10_000_000);

const createOfferSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(8000),
  shortTagline: z.string().trim().max(240).optional(),
  category: z.string().trim().min(1).max(60),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  pricingModel: z
    .enum(['fixed', 'hourly', 'monthly_retainer', 'project_based', 'equity', 'free', 'contact_for_pricing'])
    .optional(),
  priceFrom: price.optional(),
  priceTo: price.optional(),
  currency: z.string().trim().length(3).optional(),
  deliveryDays: z.number().int().min(0).max(3650).optional(),
  status: z.enum(OFFER_STATUSES).optional(),
});

const updateOfferSchema = createOfferSchema
  .partial()
  .extend({
    priceFrom: price.nullable().optional(),
    priceTo: price.nullable().optional(),
    deliveryDays: z.number().int().min(0).max(3650).nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to update' });

const createInquirySchema = z.object({
  message: z.string().trim().min(1).max(4000),
  budgetEstimate: price.optional(),
  timelineExpected: z.string().trim().max(120).optional(),
});

const updateInquirySchema = z
  .object({
    status: z.enum(INQUIRY_STATUSES).optional(),
    responseMessage: z.string().trim().max(4000).optional(),
    agreedScope: z.string().trim().max(4000).optional(),
    agreedPrice: price.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to update' });

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  reviewComment: z.string().trim().max(2000).optional(),
});

/**
 * Provider offers and the inquiries against them.
 *
 * The models have been in the schema all along with no controller over them,
 * which is why the four provider screens each held their own fixed array and
 * the public marketplace sent people off-platform through a `contactUrl`.
 */
@Controller('services')
export class ServiceOffersController {
  constructor(private readonly offers: ServiceOffersService) {}

  /** Public: active offers only. */
  @Get('offers')
  async listOffers(
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.offers.listOffers({
      category: category?.trim() || undefined,
      search: search?.trim() || undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  /** The caller's own offers, drafts and paused ones included. */
  @Get('offers/mine')
  @UseGuards(JwtAuthGuard)
  async listMyOffers(
    @CurrentUser() user: { id: string },
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.offers.listOffers({
      providerId: user.id,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('offers')
  @UseGuards(JwtAuthGuard)
  async createOffer(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    return this.offers.createOffer(user.id, createOfferSchema.parse(body));
  }

  @Patch('offers/:offerId')
  @UseGuards(JwtAuthGuard)
  async updateOffer(
    @CurrentUser() user: { id: string },
    @Param('offerId') offerId: string,
    @Body() body: unknown,
  ) {
    return this.offers.updateOffer(user.id, offerId, updateOfferSchema.parse(body));
  }

  /**
   * Inquiries the caller is part of.
   *
   * `side` says which end they are on, and `kind` names the two views the
   * provider screens want — projects are the agreed ones, reviews are the
   * rated ones — so those pages do not each invent their own filter.
   */
  @Get('inquiries')
  @UseGuards(JwtAuthGuard)
  async listInquiries(
    @CurrentUser() user: { id: string },
    @Query('side') side?: string,
    @Query('status') status?: string,
    @Query('kind') kind?: string,
    @Query('limit') limit?: string,
  ) {
    return this.offers.listInquiries(user.id, {
      side: side === 'client' ? 'client' : 'provider',
      status: status?.trim() || undefined,
      kind: kind === 'projects' || kind === 'reviews' ? kind : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('summary')
  @UseGuards(JwtAuthGuard)
  async getSummary(@CurrentUser() user: { id: string }) {
    return this.offers.getProviderSummary(user.id);
  }

  @Post('offers/:offerId/inquiries')
  @UseGuards(JwtAuthGuard)
  async createInquiry(
    @CurrentUser() user: { id: string },
    @Param('offerId') offerId: string,
    @Body() body: unknown,
  ) {
    return this.offers.createInquiry(user.id, offerId, createInquirySchema.parse(body));
  }

  @Patch('inquiries/:inquiryId')
  @UseGuards(JwtAuthGuard)
  async updateInquiry(
    @CurrentUser() user: { id: string },
    @Param('inquiryId') inquiryId: string,
    @Body() body: unknown,
  ) {
    return this.offers.updateInquiry(user.id, inquiryId, updateInquirySchema.parse(body));
  }

  @Post('inquiries/:inquiryId/review')
  @UseGuards(JwtAuthGuard)
  async reviewInquiry(
    @CurrentUser() user: { id: string },
    @Param('inquiryId') inquiryId: string,
    @Body() body: unknown,
  ) {
    return this.offers.reviewInquiry(user.id, inquiryId, reviewSchema.parse(body));
  }
}
