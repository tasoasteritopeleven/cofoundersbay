import { Body, Controller, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FeedService } from './feed.service';

function list(value?: string): string[] | undefined {
  const items = (value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return items.length ? items : undefined;
}

/** The routes `lib/api.ts` calls for `/feed`; every one reads or writes as the signed-in reader. */
@Controller('feed')
@UseGuards(JwtAuthGuard)
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get('personalized')
  personalized(
    @CurrentUser() user: { id: string },
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('contentTypes') contentTypes?: string,
    @Query('topics') topics?: string,
    @Query('refresh') refresh?: string,
  ) {
    return this.feed.personalized(user.id, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      contentTypes: list(contentTypes),
      topics: list(topics),
      refresh: refresh === 'true',
    });
  }

  @Get('preferences')
  preferences(@CurrentUser() user: { id: string }) {
    return this.feed.getPreferences(user.id);
  }

  @Patch('preferences')
  updatePreferences(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    return this.feed.updatePreferences(user.id, body);
  }

  @Get('trending')
  trending(@Query('limit') limit?: string) {
    return this.feed.trending(limit ? parseInt(limit, 10) : undefined);
  }

  @Post('posts')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  createPost(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    return this.feed.createPost(user.id, body);
  }

  @Post('interaction')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  interact(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    return this.feed.interact(user.id, body);
  }
}
