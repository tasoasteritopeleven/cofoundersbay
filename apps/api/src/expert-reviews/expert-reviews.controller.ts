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
  ExpertReviewsService,
  REVIEW_STATUSES,
  REVIEW_TYPES,
} from './expert-reviews.service';

const areaNote = z.object({
  area: z.string().trim().min(1).max(80),
  comment: z.string().trim().max(2000).optional(),
  recommendation: z.string().trim().max(2000).optional(),
});

const requestSchema = z.object({
  expertId: z.string().uuid(),
  reviewType: z.enum(REVIEW_TYPES).optional(),
  requestMessage: z.string().trim().max(4000).optional(),
  workspaceId: z.string().trim().max(64).optional(),
  documents: z.array(z.record(z.unknown())).max(20).optional(),
  dueDate: z.string().datetime().optional(),
  isPaid: z.boolean().optional(),
  agreedFee: z.number().min(0).max(1_000_000).optional(),
  currency: z.string().trim().length(3).optional(),
});

const updateSchema = z.object({
  status: z.enum(REVIEW_STATUSES).optional(),
  summaryFeedback: z.string().trim().max(8000).optional(),
  strengths: z.array(areaNote).max(20).optional(),
  improvements: z.array(areaNote).max(20).optional(),
  scoreOverall: z.number().int().min(1).max(10).optional(),
  scoresByArea: z.record(z.number().min(0).max(10)).optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

const rateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  ratingComment: z.string().trim().max(2000).optional(),
});

/**
 * Expert reviews, both sides.
 *
 * `/experts` is the only route open to any signed-in user: it is a directory.
 * Everything else is scoped to the caller, and the service decides which side
 * of a review they are on.
 */
@Controller('expert-reviews')
@UseGuards(JwtAuthGuard)
export class ExpertReviewsController {
  constructor(private readonly reviews: ExpertReviewsService) {}

  @Get()
  async list(
    @CurrentUser() user: { id: string },
    @Query('side') side?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reviews.listReviews(user.id, {
      side: side === 'expert' ? 'expert' : 'requester',
      status: (REVIEW_STATUSES as readonly string[]).includes(status ?? '')
        ? (status as never)
        : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('summary')
  async summary(@CurrentUser() user: { id: string }, @Query('side') side?: string) {
    return this.reviews.getSummary(user.id, side === 'expert' ? 'expert' : 'requester');
  }

  @Get('experts')
  async experts(@Query('search') search?: string, @Query('limit') limit?: string) {
    return this.reviews.listExperts({
      search: search?.trim() || undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  async get(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.reviews.getReview(id, user.id);
  }

  @Post()
  async request(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    return this.reviews.requestReview(user.id, requestSchema.parse(body));
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.reviews.updateReview(id, user.id, updateSchema.parse(body));
  }

  @Post(':id/rating')
  async rate(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.reviews.rateReview(id, user.id, rateSchema.parse(body));
  }
}
