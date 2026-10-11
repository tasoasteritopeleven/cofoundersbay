import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PitchService } from './pitch.service';

/**
 * `/pitch/[id]` reads, counts and contacts without an account; publishing is
 * the deck owner's alone. Guards are per route, as on the public need card.
 */
@Controller('pitch')
export class PitchController {
  constructor(private readonly pitch: PitchService) {}

  @Get('publication')
  @UseGuards(JwtAuthGuard)
  status(@CurrentUser() user: { id: string }, @Query('documentId') documentId: string) {
    return this.pitch.status(user.id, documentId ?? '');
  }

  @Post('publication')
  @UseGuards(JwtAuthGuard)
  publish(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    return this.pitch.publish(user.id, body);
  }

  @Delete('publication/:documentId')
  @UseGuards(JwtAuthGuard)
  unpublish(@CurrentUser() user: { id: string }, @Param('documentId') documentId: string) {
    return this.pitch.unpublish(user.id, documentId);
  }

  @Get(':id/public')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  getPublic(@Param('id') id: string) {
    return this.pitch.getPublic(id);
  }

  @Post(':id/view')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  view(@Param('id') id: string) {
    return this.pitch.recordView(id);
  }

  @Post(':id/contact')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  contact(@Param('id') id: string, @Body() body: unknown) {
    return this.pitch.contact(id, body);
  }
}
