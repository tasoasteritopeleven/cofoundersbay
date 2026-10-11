import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PollsService } from './polls.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/jwt-optional.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller()
export class PollsController {
  constructor(private readonly polls: PollsService) {}

  @Get('polls/active')
  @UseGuards(OptionalJwtAuthGuard)
  async getActivePoll(@CurrentUser() user?: { id: string }) {
    const poll = await this.polls.getActivePoll(user?.id);
    return poll ? { poll } : { poll: null };
  }

  @Post('polls/:pollId/vote')
  @UseGuards(JwtAuthGuard)
  async vote(
    @Param('pollId') pollId: string,
    @Body() body: { optionId: string },
    @CurrentUser() user: { id: string },
  ) {
    if (!body?.optionId || typeof body.optionId !== 'string') {
      throw new BadRequestException('optionId is required');
    }
    return this.polls.vote(pollId, body.optionId, user.id);
  }
}
