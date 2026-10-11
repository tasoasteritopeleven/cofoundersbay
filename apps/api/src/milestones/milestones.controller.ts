import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  MilestonesService,
  type CreateMilestoneDto,
  type UpdateMilestoneDto,
  type MilestoneStatus,
  type MilestonePriority,
} from './milestones.service';

@Controller('milestones')
@UseGuards(JwtAuthGuard)
export class MilestonesController {
  constructor(private readonly milestones: MilestonesService) {}

  @Get()
  async list(
    @CurrentUser() user: { id: string },
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('category') category?: string,
    @Query('collaboratorId') collaboratorId?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = Math.min(Math.max(parseInt(limitRaw ?? '50', 10) || 50, 1), 100);
    return this.milestones.list(user.id, {
      status: status as MilestoneStatus | undefined,
      priority: priority as MilestonePriority | undefined,
      category,
      collaboratorId,
      limit,
      cursor,
    });
  }

  @Get('summary')
  async summary(@CurrentUser() user: { id: string }) {
    return this.milestones.getSummary(user.id);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.milestones.findOne(id, user.id);
  }

  @Post()
  async create(
    @CurrentUser() user: { id: string },
    @Body() body: CreateMilestoneDto,
  ) {
    if (!body.title?.trim()) throw new BadRequestException('Title is required');
    if (body.progress !== undefined && (body.progress < 0 || body.progress > 100)) {
      throw new BadRequestException('Progress must be between 0 and 100');
    }
    return this.milestones.create(user.id, body);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() body: UpdateMilestoneDto,
  ) {
    if (body.progress !== undefined && (body.progress < 0 || body.progress > 100)) {
      throw new BadRequestException('Progress must be between 0 and 100');
    }
    return this.milestones.update(id, user.id, body);
  }

  @Delete(':id')
  async delete(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.milestones.delete(id, user.id);
  }
}
