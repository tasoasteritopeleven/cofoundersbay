import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { IntrosService } from './intros.service';

@Controller('intros')
@UseGuards(JwtAuthGuard)
export class IntrosController {
  constructor(private readonly intros: IntrosService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.intros.list(user.id);
  }

  /** Who could introduce the viewer to `targetId`, and the cards it could be for. */
  @Get('paths')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  paths(@CurrentUser() user: { id: string }, @Query('targetId') targetId: string) {
    return this.intros.paths(user.id, targetId);
  }

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  request(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    return this.intros.request(user.id, body);
  }

  @Get(':id/requester-methods')
  requesterMethods(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.intros.requesterMethods(id, user.id);
  }

  @Post(':id/forward')
  forward(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() body: unknown) {
    return this.intros.forward(user.id, id, body);
  }

  @Post(':id/decline')
  decline(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.intros.decline(user.id, id);
  }

  @Post(':id/accept')
  accept(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.intros.accept(user.id, id);
  }

  @Post(':id/not-now')
  notNow(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.intros.notNow(user.id, id);
  }

  @Delete(':id')
  withdraw(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.intros.withdraw(user.id, id);
  }
}
