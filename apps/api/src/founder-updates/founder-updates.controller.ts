import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FounderUpdatesService } from './founder-updates.service';

@Controller('follows')
@UseGuards(JwtAuthGuard)
export class FollowsController {
  constructor(private readonly updates: FounderUpdatesService) {}

  @Get()
  following(@CurrentUser() user: { id: string }) {
    return this.updates.following(user.id);
  }

  @Get(':userId')
  status(@CurrentUser() user: { id: string }, @Param('userId') userId: string) {
    return this.updates.followStatus(user.id, userId);
  }

  @Post(':userId')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  follow(@CurrentUser() user: { id: string }, @Param('userId') userId: string) {
    return this.updates.follow(user.id, userId);
  }

  @Delete(':userId')
  unfollow(@CurrentUser() user: { id: string }, @Param('userId') userId: string) {
    return this.updates.unfollow(user.id, userId);
  }
}

@Controller('updates')
export class FounderUpdatesController {
  constructor(private readonly updates: FounderUpdatesService) {}

  /** No account needed: the update a founder shared on LinkedIn. */
  @Get('public/:token')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  getPublic(@Param('token') token: string) {
    return this.updates.getPublic(token);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() user: { id: string }) {
    return this.updates.mine(user.id);
  }

  @Get('feed')
  @UseGuards(JwtAuthGuard)
  feed(@CurrentUser() user: { id: string }) {
    return this.updates.feed(user.id);
  }

  /** One person's updates, as far as this viewer may read them (profile Activity). */
  @Get('by/:userId')
  @UseGuards(JwtAuthGuard)
  byAuthor(@CurrentUser() user: { id: string }, @Param('userId') userId: string) {
    return this.updates.byAuthor(user.id, userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  create(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    return this.updates.create(user.id, body);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  get(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.updates.get(user.id, id);
  }

  @Patch(':id/visibility')
  @UseGuards(JwtAuthGuard)
  setVisibility(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() body: { visibility?: unknown }) {
    return this.updates.setVisibility(user.id, id, body?.visibility);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.updates.remove(user.id, id);
  }
}
