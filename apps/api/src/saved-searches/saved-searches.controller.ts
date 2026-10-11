import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SavedSearchesService } from './saved-searches.service';

/** The five routes `lib/api.ts` has called since `/saved-searches` shipped; all of them are the owner's alone. */
@Controller('saved-searches')
@UseGuards(JwtAuthGuard)
export class SavedSearchesController {
  constructor(private readonly savedSearches: SavedSearchesService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.savedSearches.list(user.id);
  }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  create(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    return this.savedSearches.create(user.id, body);
  }

  @Patch(':id')
  update(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() body: unknown) {
    return this.savedSearches.update(user.id, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.savedSearches.remove(user.id, id);
  }

  @Post(':id/run')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  run(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.savedSearches.run(user.id, id);
  }
}
