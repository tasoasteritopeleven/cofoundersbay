import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InvitesService } from './invites.service';

@Controller('invites')
@UseGuards(JwtAuthGuard)
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Get()
  async list(
    @CurrentUser() user: { id: string },
    @Query('limit') limitRaw?: string,
    @Query('status') status?: string,
  ) {
    const limit = Math.min(Math.max(parseInt(limitRaw ?? '50', 10) || 50, 1), 100);
    return this.invitesService.getUserInvites(user.id, { limit, status });
  }

  @Get('stats')
  async getStats(@CurrentUser() user: { id: string }) {
    return this.invitesService.getInviteStats(user.id);
  }

  @Post()
  async create(
    @CurrentUser() user: { id: string },
    @Body() body: { email: string; message?: string },
  ) {
    return this.invitesService.createInvite(user.id, body.email, body.message);
  }

  @Delete(':id')
  async cancel(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.invitesService.cancelInvite(user.id, id);
  }
}
