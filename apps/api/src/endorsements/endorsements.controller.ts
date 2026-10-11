import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EndorsementsService } from './endorsements.service';

const createEndorsementSchema = z.object({
  toUserId: z.string().uuid(),
  content: z.string().min(10).max(1000),
  skill: z.string().max(100).optional(),
  relationship: z.string().max(100).optional(),
});

@Controller('endorsements')
@UseGuards(JwtAuthGuard)
export class EndorsementsController {
  constructor(private readonly endorsements: EndorsementsService) {}

  @Get('user/:userId')
  async getForUser(
    @CurrentUser() user: { id: string },
    @Param('userId') userId: string,
    @Query('includeUnapproved') includeUnapproved?: string,
  ) {
    const endorsements = await this.endorsements.getEndorsementsForUser(userId, {
      includeUnapproved: includeUnapproved === 'true',
      viewerId: user.id,
    });
    return { endorsements };
  }

  @Get('pending')
  async getPending(@CurrentUser() user: { id: string }) {
    const endorsements = await this.endorsements.getPendingEndorsements(user.id);
    return { endorsements };
  }

  @Get('given')
  async getGiven(@CurrentUser() user: { id: string }) {
    const endorsements = await this.endorsements.getGivenEndorsements(user.id);
    return { endorsements };
  }

  @Get('stats')
  async getStats(@CurrentUser() user: { id: string }) {
    const stats = await this.endorsements.getEndorsementStats(user.id);
    return { stats };
  }

  @Post()
  async create(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    const data = createEndorsementSchema.parse(body);
    const endorsement = await this.endorsements.createEndorsement(user.id, data.toUserId, {
      content: data.content,
      skill: data.skill,
      relationship: data.relationship,
    });
    return { endorsement };
  }

  @Post(':id/approve')
  async approve(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.endorsements.approveEndorsement(user.id, id);
  }

  @Post(':id/decline')
  async decline(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.endorsements.declineEndorsement(user.id, id);
  }

  @Delete(':id')
  async delete(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.endorsements.deleteEndorsement(user.id, id);
  }
}
