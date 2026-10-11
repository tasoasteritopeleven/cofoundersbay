import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OpenToService } from './open-to.service';

@Controller('open-to')
@UseGuards(JwtAuthGuard)
export class OpenToController {
  constructor(private readonly openTo: OpenToService) {}

  @Get('me')
  mine(@CurrentUser() user: { id: string }) {
    return this.openTo.mine(user.id);
  }

  @Put('me')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  set(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    return this.openTo.set(user.id, body);
  }

  @Delete('me')
  clear(@CurrentUser() user: { id: string }) {
    return this.openTo.clear(user.id);
  }

  /** Another person's signal, as far as its visibility lets this viewer see it. */
  @Get(':userId')
  forViewer(@CurrentUser() user: { id: string }, @Param('userId') userId: string) {
    return this.openTo.forViewer(user.id, userId);
  }
}
