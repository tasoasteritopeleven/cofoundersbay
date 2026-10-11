import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ScoutService } from './scout.service';

@Controller('scout')
@UseGuards(JwtAuthGuard)
export class ScoutController {
  constructor(private readonly scout: ScoutService) {}

  @Get()
  get(@CurrentUser() user: { id: string }) {
    return this.scout.get(user.id);
  }

  @Put('brief')
  setBrief(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    return this.scout.setBrief(user.id, body);
  }

  @Post('run')
  @Throttle({ default: { ttl: 60_000, limit: 6 } })
  run(@CurrentUser() user: { id: string }, @Body() body: { lang?: string } = {}) {
    return this.scout.run(user.id, new Date(), body?.lang === 'el' ? 'el' : 'en');
  }

  @Post('proposals/:id/save')
  save(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.scout.save(user.id, id);
  }

  @Post('proposals/:id/dismiss')
  dismiss(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.scout.dismiss(user.id, id);
  }

  @Post('proposals/:id/restore')
  restore(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.scout.restore(user.id, id);
  }
}
