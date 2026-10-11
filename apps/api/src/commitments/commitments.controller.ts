import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CommitmentsService } from './commitments.service';

type Body_ = Record<string, unknown>;

/**
 * Need cards and the commitment ladder.
 *
 * Every route but the public card needs a signed-in user; the service decides
 * who may act at each step (author, candidate, either). The public card
 * returns a safe projection by an unguessable token and is rate-limited.
 */
@Controller('commitments')
export class CommitmentsController {
  constructor(private readonly commitments: CommitmentsService) {}

  // ── Cards ─────────────────────────────────────────────────────────────────

  @Get('cards')
  @UseGuards(JwtAuthGuard)
  list(
    @CurrentUser() user: { id: string },
    @Query('mine') mine?: string,
    @Query('owner') owner?: string,
    @Query('kind') kind?: string,
    @Query('stage') stage?: string,
    @Query('category') category?: string,
    @Query('commitment') commitment?: string,
    @Query('place') place?: string,
    @Query('outcome') outcome?: string,
    @Query('projectRefs') projectRefs?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    return this.commitments.listCards(user, {
      mine: mine === '1' || mine === 'true',
      owner: owner?.trim() || undefined,
      kind,
      stage,
      category,
      commitment,
      place,
      outcome,
      projectRefs: projectRefs ? projectRefs.split(',').map((ref) => ref.trim()).filter(Boolean) : undefined,
      q: q?.trim() || undefined,
      limit: limit ? parseInt(limit, 10) || undefined : undefined,
    });
  }

  @Post('cards')
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: { id: string }, @Body() body: Body_) {
    return this.commitments.createCard(user, body);
  }

  @Get('cards/:id')
  @UseGuards(JwtAuthGuard)
  get(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.commitments.getCard(user, id);
  }

  @Patch('cards/:id')
  @UseGuards(JwtAuthGuard)
  update(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() body: Body_) {
    return this.commitments.updateCard(user, id, body);
  }

  @Post('cards/:id/close')
  @UseGuards(JwtAuthGuard)
  close(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() body: Body_) {
    return this.commitments.closeCard(user, id, typeof body?.reason === 'string' ? body.reason : 'withdrawn');
  }

  @Post('cards/:id/reopen')
  @UseGuards(JwtAuthGuard)
  reopen(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.commitments.reopenCard(user, id);
  }

  @Post('cards/:id/share')
  @UseGuards(JwtAuthGuard)
  share(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.commitments.shareCard(user, id);
  }

  @Delete('cards/:id/share')
  @UseGuards(JwtAuthGuard)
  unshare(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.commitments.revokeShare(user, id);
  }

  @Post('cards/:id/interest')
  @UseGuards(JwtAuthGuard)
  interest(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() body: Body_) {
    return this.commitments.expressInterest(user, id, body);
  }

  /** No account needed: the card a founder shared on LinkedIn. */
  @Get('public/:token')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  publicCard(@Param('token') token: string) {
    return this.commitments.getPublicCard(token);
  }

  // ── The ladder ────────────────────────────────────────────────────────────

  /** How many of the viewer's answers wait on authors, against the budget. */
  @Get('interest-budget')
  @UseGuards(JwtAuthGuard)
  interestBudget(@CurrentUser() user: { id: string }) {
    return this.commitments.interestBudget(user);
  }

  @Get('threads')
  @UseGuards(JwtAuthGuard)
  threads(@CurrentUser() user: { id: string }, @Query('as') as?: string) {
    return this.commitments.listThreads(user, as === 'owner' || as === 'candidate' ? as : 'all');
  }

  @Get('threads/:id')
  @UseGuards(JwtAuthGuard)
  thread(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.commitments.getThread(user, id);
  }

  @Delete('threads/:id/interest')
  @UseGuards(JwtAuthGuard)
  withdraw(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.commitments.withdrawInterest(user, id);
  }

  @Post('threads/:id/accept')
  @UseGuards(JwtAuthGuard)
  accept(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.commitments.acceptInterest(user, id);
  }

  @Post('threads/:id/messages')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  message(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() body: Body_) {
    return this.commitments.sendMessage(user, id, body);
  }

  @Post('threads/:id/confirm')
  @UseGuards(JwtAuthGuard)
  confirm(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.commitments.confirm(user, id);
  }

  @Delete('threads/:id/confirm')
  @UseGuards(JwtAuthGuard)
  retract(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.commitments.retractConfirmation(user, id);
  }

  @Post('threads/:id/terms')
  @UseGuards(JwtAuthGuard)
  propose(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() body: Body_) {
    return this.commitments.proposeTerms(user, id, body);
  }

  @Post('threads/:id/terms/:version/accept')
  @UseGuards(JwtAuthGuard)
  acceptTerms(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.commitments.acceptTerms(user, id, version);
  }

  @Post('threads/:id/deal-room/close')
  @UseGuards(JwtAuthGuard)
  closeDealRoom(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.commitments.closeDealRoom(user, id);
  }

  @Post('threads/:id/close')
  @UseGuards(JwtAuthGuard)
  closeThread(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() body: Body_) {
    return this.commitments.closeThread(user, id, body);
  }
}
