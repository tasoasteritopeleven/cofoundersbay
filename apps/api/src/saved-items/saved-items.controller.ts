import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SavedItemsService } from './saved-items.service';

@Controller('saved-items')
@UseGuards(JwtAuthGuard)
export class SavedItemsController {
  constructor(private readonly saved: SavedItemsService) {}

  @Get()
  list(@CurrentUser() user: { id: string }, @Query('kind') kind?: string) {
    return this.saved.list(user.id, kind);
  }

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  save(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    return this.saved.save(user.id, body);
  }

  @Delete(':kind/:itemId')
  remove(@CurrentUser() user: { id: string }, @Param('kind') kind: string, @Param('itemId') itemId: string) {
    return this.saved.remove(user.id, kind, itemId);
  }
}
